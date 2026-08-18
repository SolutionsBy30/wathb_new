import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { WathbGenerationService } from '../wathb/wathb-generation.service';
import { MagicLinkService } from '../auth/magic-link.service';
import { NOTIFICATION_CHANNEL, NotificationChannel } from './channel.interface';
import { decideSendChannel, resolveSlotForDay } from './reactive-scheduler';
import { riyadhDayKey } from './riyadh-clock.util';
import { NotificationMessagesService } from './notification-messages.service';
import { EmailChannel } from './email-channel';

const DEFAULT_BUNDLE_SIZE = 5;
// Never more than 2 messages/day to a student — spec §7.4 frequency cap.
// Exported so admin-initiated sends (campaigns, manual resends) enforce the
// exact same cap as the automated daily job — NOT-011 requires both paths
// to "pass through the same... frequency caps... as automated messages."
export const MAX_STUDENT_MESSAGES_PER_DAY = 2;

// NOT-009 — retry/fallback ladder: back off 15m, then 1h, then 4h before
// giving up. A notification that's still failing after the ladder is
// exhausted (nextRetryAt left null) is what "repeatedly undelivered"
// means for admin surfacing, not a single one-off failure.
const RETRY_LADDER_MINUTES = [15, 60, 240];

// NOT-016 — how long after a student's window closes a reminder may still go
// out. Covers a missed tick or a short outage without ever turning into a
// message at 3am for a window that ended at 20:00.
const WINDOW_GRACE_MINUTES = 60;
export const MAX_RETRY_ATTEMPTS = RETRY_LADDER_MINUTES.length;

function dayKey(d: Date): Date {
  // NOT-015 — the Riyadh calendar date, not the UTC one. Between 00:00 and
  // 03:00 Riyadh, UTC is still on the previous date, so setUTCHours(0,0,0,0)
  // filed those three hours under "yesterday": a student practising at 1am
  // had it credited to the wrong day and their streak broke despite showing
  // up. Same stored shape (UTC midnight of a calendar date), correct date.
  return riyadhDayKey(d);
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private generation: WathbGenerationService,
    private magicLinks: MagicLinkService,
    @Inject(NOTIFICATION_CHANNEL) private channel: NotificationChannel,
    private config: ConfigService,
    private email: EmailChannel,
    private messages: NotificationMessagesService,
  ) {}

  /**
   * NOT-012 — send the same notification to the user's email when they have
   * opted in. Returns nothing and throws nothing: email is the secondary
   * channel, so every failure mode (unconfigured SMTP, bounce, timeout) must
   * be invisible to the WhatsApp path that follows it.
   */
  private async sendEmailCopy(
    user: { notificationEmail: string | null; emailNotificationsEnabled: boolean; suspendedAt: Date | null },
    notificationId: string,
    subject: string,
    text: string,
  ): Promise<void> {
    if (!user.emailNotificationsEnabled || !user.notificationEmail || user.suspendedAt) return;
    const messageId = await this.email.send({ to: user.notificationEmail, subject, text });
    if (!messageId) return;
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { emailSentAt: new Date() },
    });
  }

  /**
   * ADM-087 — "send this student their leap now", from the admin console.
   *
   * plan_day runs at 21:00 for the NEXT day, so on any given afternoon there
   * is usually no notification row for today and a bare send returns
   * 'not_scheduled'. Planning and sending are therefore one operation here:
   * an admin pressing the button means "today, now", not "if a job happened
   * to queue one already".
   *
   * Entitlement and preference rules are deliberately NOT overridden. A
   * free-tier package with notifications off, a student's own skip-day, an
   * opt-out, a suspension — all still stop the send and are reported back by
   * reason, so the admin sees why rather than the button silently doing
   * nothing. Overriding a student's stated preference from a support screen
   * is not a thing an admin should be able to do by accident.
   */
  async sendNowForStudent(studentId: string, forDate: Date) {
    const scheduledFor = dayKey(forDate);
    const existing = await this.prisma.notification.findUnique({
      where: { userId_kind_scheduledFor: { userId: studentId, kind: 'daily_wathb', scheduledFor } },
    });
    if (!existing) {
      const planned = await this.planDayForStudent(studentId, forDate);
      if ('skipped' in planned) return planned;
    }
    return this.sendDailyWathbNotification(studentId, forDate, { respectWindow: false });
  }

  /**
   * plan_day (spec §9.4) — pre-generate tomorrow's bundle and queue the
   * notification row. Idempotent per (student, day): safe to call twice.
   */
  async planDayForStudent(studentId: string, forDate: Date) {
    const student = await this.prisma.student.findUnique({ where: { userId: studentId } });
    if (!student?.targetTestId) return { skipped: 'no_goal' as const };

    // FRE-002 — a free-tier student gets no daily WhatsApp send at all; the
    // Wathb itself is still generated on-demand when they open the app
    // (WathbService.today()), so skipping the whole plan/notify pass here
    // costs them nothing but the proactive nudge.
    const activeSub = await this.prisma.subscription.findFirst({
      where: { studentId, status: 'active' },
      include: { package: true },
      orderBy: { createdAt: 'desc' },
    });
    if (activeSub && !activeSub.package.dailyNotificationEnabled) return { skipped: 'free_tier' as const };

    const scheduledFor = dayKey(forDate);
    if (student.skipDays.includes(scheduledFor.getUTCDay())) return { skipped: 'skip_day' as const };

    // Daily planning/notifications only ever concern the planned bundle
    // (sequence 0) — a paid student's extra same-day bundles are pull, not push.
    const existingWathb = await this.prisma.wathb.findFirst({
      where: { studentId, scheduledFor, sequence: 0 },
    });
    if (!existingWathb) {
      const wathb = !student.placementDoneAt
        ? await this.generation.generatePlacement(studentId, student.targetTestId, student.track ?? null, scheduledFor)
        : await this.generation.generateDaily(studentId, student.targetTestId, student.track ?? null, DEFAULT_BUNDLE_SIZE, scheduledFor);
      if (!wathb) {
        // "degrade gracefully... and fire an admin alert, not throw" — spec §6.4.
        this.logger.error(`bank exhaustion: could not plan a Wathb for student ${studentId} on ${scheduledFor.toDateString()}`);
        return { skipped: 'bank_exhausted' as const };
      }
    }

    await this.prisma.notification.upsert({
      where: { userId_kind_scheduledFor: { userId: studentId, kind: 'daily_wathb', scheduledFor } },
      create: { userId: studentId, kind: 'daily_wathb', channel: 'console', category: 'utility', scheduledFor, status: 'scheduled' },
      update: {},
    });
    return { planned: true as const };
  }

  async planDayForAllActiveStudents(forDate: Date) {
    const students = await this.prisma.student.findMany({ where: { targetTestId: { not: null } } });
    const results = [];
    for (const s of students) results.push({ studentId: s.userId, ...(await this.planDayForStudent(s.userId, forDate)) });
    return results;
  }

  /**
   * send_notification (spec §9.4) — chooses template vs free-form off
   * wa_sessions (§7.3) and actually calls the NotificationChannel adapter.
   */
  async sendDailyWathbNotification(
    studentId: string,
    forDate: Date,
    opts: { respectWindow?: boolean; now?: Date } = {},
  ) {
    const scheduledFor = dayKey(forDate);
    const notif = await this.prisma.notification.findUnique({
      where: { userId_kind_scheduledFor: { userId: studentId, kind: 'daily_wathb', scheduledFor } },
    });
    if (!notif || notif.status !== 'scheduled') return { skipped: 'not_scheduled' as const };

    const sentToday = await this.prisma.notification.count({
      where: { userId: studentId, scheduledFor, status: { in: ['sent', 'delivered', 'read'] } },
    });
    if (sentToday >= MAX_STUDENT_MESSAGES_PER_DAY) return { skipped: 'frequency_cap' as const };

    const student = await this.prisma.student.findUniqueOrThrow({ where: { userId: studentId }, include: { user: true } });
    if (student.user.whatsappOptedOutAt) {
      await this.prisma.notification.update({ where: { id: notif.id }, data: { status: 'failed', error: 'opted_out' } });
      return { skipped: 'opted_out' as const };
    }
    // NOT-009 — "the scheduler shall handle... suspended... states."
    if (student.user.status === 'suspended') {
      await this.prisma.notification.update({ where: { id: notif.id }, data: { status: 'skipped', error: 'suspended' } });
      return { skipped: 'suspended' as const };
    }
    if (!student.user.mobileE164) {
      await this.prisma.notification.update({ where: { id: notif.id }, data: { status: 'failed', error: 'no mobile number on file' } });
      return { failed: true as const };
    }

    const wathb = await this.prisma.wathb.findFirst({ where: { studentId, scheduledFor, sequence: 0 }, include: { test: true } });
    if (!wathb) {
      await this.prisma.notification.update({ where: { id: notif.id }, data: { status: 'failed', error: 'no wathb planned for this day' } });
      return { failed: true as const };
    }
    // NOT-009 — "already-completed" states: the student did today's Wathb
    // on their own before the reminder fired, so the nudge is now moot.
    if (wathb.status === 'completed' || wathb.status === 'partial') {
      await this.prisma.notification.update({ where: { id: notif.id }, data: { status: 'skipped', error: 'already_completed' } });
      return { skipped: 'already_completed' as const };
    }

    // NOT-016 — the student's chosen window is now enforced, not merely
    // consulted.
    //
    // decideSendChannel already computed a sendAt, but nothing ever compared
    // it to the clock: the slot only chose template vs freeform, and the send
    // itself went out on whichever send_due tick first saw a scheduled row.
    // plan_day queues tomorrow's row at 21:00, so the moment the Riyadh date
    // rolled over the row became "today's" and the next tick fired it — which
    // is exactly why every reminder arrived around midnight regardless of what
    // the student picked.
    //
    // Skipped, not failed: the row stays 'scheduled' so a later tick inside
    // the window sends it. respectWindow is off only for the admin's explicit
    // "send now" button, where the operator means now.
    if (opts.respectWindow !== false) {
      const slot = resolveSlotForDay(scheduledFor, student.notifSlotStartHour, student.notifSlotEndHour);
      const now = opts.now ?? new Date();
      if (now < slot.slotStart) return { skipped: 'before_window' as const };
      if (now.getTime() > slot.slotEnd.getTime() + WINDOW_GRACE_MINUTES * 60_000) {
        return { skipped: 'window_missed' as const };
      }
    }

    return this.attemptSend(student, wathb, notif.id, 0);
  }

  /**
   * Shared by the initial send and every retry — resolves the channel
   * decision and performs the actual send, then either marks the
   * notification sent or schedules the next rung of the retry ladder.
   */
  private async attemptSend(
    student: {
      userId: string;
      notifSlotStartHour: number;
      notifSlotEndHour: number;
      user: {
        name: string;
        mobileE164: string | null;
        // NOT-012 — needed for the parallel email copy below.
        notificationEmail: string | null;
        emailNotificationsEnabled: boolean;
        suspendedAt: Date | null;
      };
    },
    wathb: { id: string; scheduledFor: Date; test?: { nameAr: string } | null },
    notifId: string,
    retryCount: number,
  ) {
    const waSession = await this.prisma.waSession.findUnique({ where: { userId: student.userId } });
    const slot = resolveSlotForDay(wathb.scheduledFor, student.notifSlotStartHour, student.notifSlotEndHour);
    const decision = decideSendChannel(waSession?.lastInboundAt ?? null, slot);

    // A daily practice link is one student's own link for one day, and
    // reopening it (to continue, or to start another bundle) is ordinary
    // use — single-use here stranded students on the link-expired screen.
    // Sensitive purposes (renewal, reports) keep maxUses=1; the per-open
    // access log still feeds the anti-sharing signal either way.
    const { token } = await this.magicLinks.mint({ subjectId: student.userId, subjectType: 'student', purpose: 'wathb', targetId: wathb.id, maxUses: 5 });
    const appUrl = this.config.get<string>('STUDENT_APP_URL', 'http://localhost:5173/wathb');
    const url = `${appUrl}/#magic=${token}`;

    // NOT-012 — email is a parallel second channel, sent before the WhatsApp
    // attempt and never allowed to affect it. It is fire-and-forget on
    // purpose: EmailChannel.send swallows its own failures and returns null,
    // so a bounced address cannot fail the job or trip the WhatsApp retry
    // ladder below. The STOP opt-out is WhatsApp-specific and deliberately
    // does not gate email, but a suspended account is silenced everywhere.
    await this.sendEmailCopy(
      student.user,
      notifId,
      'وثبتك اليومية جاهزة',
      `${student.user.name}، وثبتك اليومية جاهزة:\n${url}`,
    );

    // NOT-017 — the same sentence every morning stops being read. An admin
    // pool of variants is drawn from at random; null means the pool is empty
    // (or the chosen body rendered blank), and the built-in wording stands.
    const customBody = await this.messages.renderRandom({
      student_name: student.user.name,
      magic_link: url,
      test_name: wathb.test?.nameAr ?? '',
    });

    try {
      const result =
        decision.channelType === 'template'
          ? await this.channel.sendTemplate({
              to: student.user.mobileE164!,
              templateName: this.config.get('WHATSAPP_TEMPLATE_DAILY_WATHB', 'daily_wathb_reminder'),
              languageCode: 'ar',
              // Kept populated alongside the override: Meta's adapter cannot
              // honour a custom body and falls back to these (channel.interface).
              bodyParams: [student.user.name, url],
              bodyOverride: customBody ?? undefined,
            })
          : await this.channel.sendFreeform({
              to: student.user.mobileE164!,
              text: customBody ?? `وثبتك اليومية جاهزة، ${student.user.name}: ${url}`,
            });

      await this.prisma.notification.update({
        where: { id: notifId },
        data: {
          channel: decision.channelType === 'template' ? 'whatsapp_template' : 'whatsapp_freeform',
          status: 'sent',
          sentAt: new Date(),
          waMessageId: result.providerMessageId,
          wasBillable: decision.billable,
          nextRetryAt: null,
        },
      });
      return { sent: true as const, channelType: decision.channelType, billable: decision.billable };
    } catch (e: any) {
      const nextAttempt = retryCount + 1;
      const exhausted = nextAttempt > MAX_RETRY_ATTEMPTS;
      await this.prisma.notification.update({
        where: { id: notifId },
        data: {
          status: 'failed',
          error: e.message,
          retryCount: nextAttempt,
          nextRetryAt: exhausted ? null : new Date(Date.now() + RETRY_LADDER_MINUTES[retryCount] * 60_000),
        },
      });
      return { failed: true as const, error: e.message, retriesExhausted: exhausted };
    }
  }

  async sendDueForAllStudents(forDate: Date) {
    const students = await this.prisma.student.findMany({ where: { targetTestId: { not: null } } });
    const results = [];
    for (const s of students) results.push({ studentId: s.userId, ...(await this.sendDailyWathbNotification(s.userId, forDate)) });
    return results;
  }

  /**
   * NOT-009 — admin-triggered stand-in for the retry-ladder cron: reattempt
   * every notification whose next rung is due, same manual-trigger pattern
   * as plan_day/send_notification (no real scheduler in this sandbox).
   */
  async processRetries(now: Date = new Date()) {
    const due = await this.prisma.notification.findMany({
      where: { status: 'failed', nextRetryAt: { lte: now }, retryCount: { lt: MAX_RETRY_ATTEMPTS } },
      include: { user: { include: { student: true } } },
    });

    const results = [];
    for (const notif of due) {
      const student = notif.user.student;
      if (!student) continue; // retry ladder only covers student-facing notifications today
      const wathb = await this.prisma.wathb.findFirst({ where: { studentId: student.userId, scheduledFor: notif.scheduledFor, sequence: 0 }, include: { test: true } });
      if (!wathb) continue;
      // NOT-016 — a retry is still a message to a student, so it obeys the
      // same window. The ladder's 4-hour step can easily land past midnight;
      // waiting for tomorrow's send beats waking them now.
      const retrySlot = resolveSlotForDay(notif.scheduledFor, student.notifSlotStartHour, student.notifSlotEndHour);
      if (now < retrySlot.slotStart || now.getTime() > retrySlot.slotEnd.getTime() + WINDOW_GRACE_MINUTES * 60_000) {
        results.push({ notificationId: notif.id, skipped: 'outside_window' as const });
        continue;
      }
      const result = await this.attemptSend(
        {
          userId: student.userId,
          notifSlotStartHour: student.notifSlotStartHour,
          notifSlotEndHour: student.notifSlotEndHour,
          user: {
            name: notif.user.name,
            mobileE164: notif.user.mobileE164,
            notificationEmail: notif.user.notificationEmail,
            emailNotificationsEnabled: notif.user.emailNotificationsEnabled,
            suspendedAt: notif.user.suspendedAt,
          },
        },
        wathb,
        notif.id,
        notif.retryCount,
      );
      results.push({ notificationId: notif.id, ...result });
    }
    return { attempted: results.length, results };
  }

  /** NOT-009 — "surfacing repeatedly undelivered numbers to the admin console." */
  /**
   * NOT-014 — put exhausted notifications back in the queue.
   *
   * The retry ladder is finite by design (3 attempts): a number that is
   * genuinely wrong should stop being dialled. But when the cause was on our
   * side — a bad provider credential, a rate limit we were not respecting —
   * every student in the batch ends up permanently undeliverable for a fault
   * that has since been fixed, with no way back except SQL.
   *
   * Resets status and retryCount so the ladder starts over. Scoped to
   * failures whose recorded error matches, so an operator fixing one cause
   * does not also re-dial numbers that failed for unrelated reasons.
   */
  async requeueFailed(opts: { errorContains?: string; since?: Date } = {}) {
    const rows = await this.prisma.notification.findMany({
      where: {
        status: 'failed',
        retryCount: { gte: MAX_RETRY_ATTEMPTS },
        ...(opts.since ? { scheduledFor: { gte: dayKey(opts.since) } } : {}),
        ...(opts.errorContains ? { error: { contains: opts.errorContains, mode: 'insensitive' as const } } : {}),
      },
      select: { id: true },
    });
    if (rows.length === 0) return { requeued: 0 };
    await this.prisma.notification.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      // nextRetryAt in the past so the very next process_retries tick picks
      // them up rather than waiting a full ladder step.
      data: { status: 'failed', retryCount: 0, nextRetryAt: new Date(Date.now() - 1000), error: null },
    });
    this.logger.log(`requeued ${rows.length} exhausted notification(s)`);
    return { requeued: rows.length };
  }

  async repeatedlyUndelivered() {
    const rows = await this.prisma.notification.findMany({
      where: { status: 'failed', retryCount: { gte: MAX_RETRY_ATTEMPTS } },
      include: { user: { select: { name: true, mobileE164: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows;
  }

  async deliveryLog(limit = 100) {
    return this.prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { user: { select: { name: true, mobileE164: true } } },
    });
  }

  /** Called from the webhook on any inbound message — opens/refreshes the 24h window (spec §7.2). */
  async recordInbound(userId: string, at: Date = new Date()) {
    await this.prisma.waSession.upsert({
      where: { userId },
      create: { userId, lastInboundAt: at, windowOpenedAt: at, windowExpiresAt: new Date(at.getTime() + 24 * 3600_000) },
      update: { lastInboundAt: at, windowOpenedAt: at, windowExpiresAt: new Date(at.getTime() + 24 * 3600_000) },
    });
  }

  /**
   * NOT-010 — STOP/إيقاف is honored instantly and permanently. Idempotent:
   * re-texting STOP just keeps the same timestamp rather than erroring.
   */
  async recordOptOut(userId: string, at: Date = new Date()) {
    await this.prisma.user.updateMany({ where: { id: userId, whatsappOptedOutAt: null }, data: { whatsappOptedOutAt: at } });
    this.logger.log(`user ${userId} opted out of WhatsApp notifications (STOP)`);
  }

  async recordDeliveryStatus(waMessageId: string, status: 'delivered' | 'read' | 'failed', at: Date = new Date()) {
    const notif = await this.prisma.notification.findFirst({ where: { waMessageId } });
    if (!notif) return;
    const data: Record<string, unknown> = { status };
    if (status === 'delivered') data.deliveredAt = at;
    if (status === 'read') data.readAt = at;
    await this.prisma.notification.update({ where: { id: notif.id }, data });
  }
}
