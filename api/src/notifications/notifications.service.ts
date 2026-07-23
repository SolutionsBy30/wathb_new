import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { WathbGenerationService } from '../wathb/wathb-generation.service';
import { MagicLinkService } from '../auth/magic-link.service';
import { NOTIFICATION_CHANNEL, NotificationChannel } from './channel.interface';
import { decideSendChannel, resolveSlotForDay } from './reactive-scheduler';

const DEFAULT_BUNDLE_SIZE = 5;
// Never more than 2 messages/day to a student — spec §7.4 frequency cap.
// Exported so admin-initiated sends (campaigns, manual resends) enforce the
// exact same cap as the automated daily job — NOT-011 requires both paths
// to "pass through the same... frequency caps... as automated messages."
export const MAX_STUDENT_MESSAGES_PER_DAY = 2;

function dayKey(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
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
  ) {}

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

    const existingWathb = await this.prisma.wathb.findUnique({
      where: { studentId_scheduledFor: { studentId, scheduledFor } },
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
  async sendDailyWathbNotification(studentId: string, forDate: Date) {
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
    if (!student.user.mobileE164) {
      await this.prisma.notification.update({ where: { id: notif.id }, data: { status: 'failed', error: 'no mobile number on file' } });
      return { failed: true as const };
    }

    const wathb = await this.prisma.wathb.findUnique({ where: { studentId_scheduledFor: { studentId, scheduledFor } } });
    if (!wathb) {
      await this.prisma.notification.update({ where: { id: notif.id }, data: { status: 'failed', error: 'no wathb planned for this day' } });
      return { failed: true as const };
    }

    const waSession = await this.prisma.waSession.findUnique({ where: { userId: studentId } });
    const slot = resolveSlotForDay(scheduledFor, student.notifSlotStartHour, student.notifSlotEndHour);
    const decision = decideSendChannel(waSession?.lastInboundAt ?? null, slot);

    const { token } = await this.magicLinks.mint({ subjectId: studentId, subjectType: 'student', purpose: 'wathb', targetId: wathb.id });
    const appUrl = this.config.get<string>('STUDENT_APP_URL', 'http://localhost:5173/wathb');
    const url = `${appUrl}/#magic=${token}`;

    try {
      const result =
        decision.channelType === 'template'
          ? await this.channel.sendTemplate({
              to: student.user.mobileE164,
              templateName: this.config.get('WHATSAPP_TEMPLATE_DAILY_WATHB', 'daily_wathb_reminder'),
              languageCode: 'ar',
              bodyParams: [student.user.name, url],
            })
          : await this.channel.sendFreeform({ to: student.user.mobileE164, text: `وثبتك اليومية جاهزة، ${student.user.name}: ${url}` });

      await this.prisma.notification.update({
        where: { id: notif.id },
        data: {
          channel: decision.channelType === 'template' ? 'whatsapp_template' : 'whatsapp_freeform',
          status: 'sent',
          sentAt: new Date(),
          waMessageId: result.providerMessageId,
          wasBillable: decision.billable,
        },
      });
      return { sent: true as const, channelType: decision.channelType, billable: decision.billable };
    } catch (e: any) {
      await this.prisma.notification.update({ where: { id: notif.id }, data: { status: 'failed', error: e.message } });
      return { failed: true as const, error: e.message };
    }
  }

  async sendDueForAllStudents(forDate: Date) {
    const students = await this.prisma.student.findMany({ where: { targetTestId: { not: null } } });
    const results = [];
    for (const s of students) results.push({ studentId: s.userId, ...(await this.sendDailyWathbNotification(s.userId, forDate)) });
    return results;
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
