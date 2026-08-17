import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MagicLinkService } from '../auth/magic-link.service';
import { MIN_SAMPLE_FOR_REPORTING, ReportsService } from '../reports/reports.service';
import { AccountsService } from './accounts.service';
import { NOTIFICATION_CHANNEL, NotificationChannel } from '../notifications/channel.interface';
import { isReminderDue } from './invite-reminder.util';

@Injectable()
export class SupervisorsService {
  constructor(
    private prisma: PrismaService,
    private magicLinks: MagicLinkService,
    private accounts: AccountsService,
    private reports: ReportsService,
    @Inject(NOTIFICATION_CHANNEL) private channel: NotificationChannel,
    private config: ConfigService,
  ) {}

  createSupervisor(mobile: string, name: string, type: 'parent' | 'instructor') {
    return this.accounts.createSupervisor(mobile, name, type);
  }

  /** Admin "المشرفون" screen — every supervisor and how many students they're linked to. */
  async adminList() {
    const supervisors = await this.prisma.supervisor.findMany({
      include: {
        user: true,
        studentLinks: { where: { revokedAt: null }, include: { student: { include: { user: true } } } },
      },
      orderBy: { user: { createdAt: 'desc' } },
    });
    return supervisors.map((s) => ({
      supervisorId: s.userId,
      name: s.user.name,
      mobile: s.user.mobileE164,
      type: s.type,
      // ADM-086 — the admin table's edit/disable controls read these; without
      // them the row could show actions it had no state to render.
      status: s.user.status,
      suspendReason: s.user.suspendReason,
      notificationEmail: s.user.notificationEmail,
      students: s.studentLinks.map((l) => ({
        studentId: l.studentId,
        name: l.student.user.name,
        accepted: !!l.acceptedAt,
      })),
    }));
  }

  /** Student invites a supervisor by mobile — spec §2: "linking is done by student invite." */
  async invite(studentId: string, mobile: string, name: string, type: 'parent' | 'instructor') {
    // FRE-006/FRE-007 — server-enforced, not just an omitted button: a
    // free-tier student cannot add a supervisor at all. The frontend still
    // renders the invite affordance in a locked state with an upgrade
    // prompt rather than hiding it, per spec.
    const activeSub = await this.prisma.subscription.findFirst({
      where: { studentId, status: 'active' },
      include: { package: true },
      orderBy: { createdAt: 'desc' },
    });
    if (activeSub && !activeSub.package.supervisorLinkingAllowed) {
      throw new ForbiddenException('supervisor linking is not available on the free package');
    }

    let supervisorUser = await this.prisma.user.findUnique({ where: { mobileE164: mobile } });
    // STU-027 — an unregistered number gets a real account created right
    // away rather than a separate "pending invite" record: the magic link
    // below already logs them straight into it and lands on the accept/
    // decline screen (supervisor/src/App.jsx), which functionally *is* "signup
    // completion, automatically establishing the pending link" — there's no
    // separate form to fill in. What was actually missing (fixed here) is
    // that the invitation was never sent anywhere; it only ever existed in
    // the API response.
    const wasUnregistered = !supervisorUser;
    if (!supervisorUser) {
      supervisorUser = await this.prisma.user.create({
        data: { mobileE164: mobile, name, role: 'supervisor', supervisor: { create: { type } } },
      });
    } else if (supervisorUser.role !== 'supervisor') {
      throw new BadRequestException('this mobile number belongs to a non-supervisor account');
    }

    // SUP-009 — invitedAt is reset on every invite, including a re-invite of
    // a link that already exists, so the reminder ladder restarts from this
    // moment instead of inheriting rungs already spent on the earlier attempt.
    const invitedAt = new Date();
    const link = await this.prisma.studentSupervisor.upsert({
      where: { studentId_supervisorId: { studentId, supervisorId: supervisorUser.id } },
      create: { studentId, supervisorId: supervisorUser.id, invitedAt },
      update: { revokedAt: null, invitedAt, reminderCount: 0, lastRemindedAt: null },
    });

    const student = await this.prisma.student.findUnique({
      where: { userId: studentId },
      include: { user: true },
    });

    // SUP-009 — both scenarios are now messaged. Previously only the
    // newly-created branch was, on the reading that an existing supervisor
    // would find the invite in their console; in practice nothing told them
    // to go and look, so invites to registered supervisors sat unanswered.
    const established = wasUnregistered ? false : await this.isEstablished(supervisorUser);
    const delivered = await this.deliverInvite({
      linkId: link.id,
      supervisorUser,
      studentName: student?.user.name ?? 'طالب',
      established,
      isReminder: false,
    });

    return { studentSupervisorId: link.id, delivered };
  }

  /**
   * Does this supervisor already have an account they know how to get into?
   *
   * Decides which of the two message variants to send, and — more importantly
   * — whether the message carries a magic link at all. Someone auto-created by
   * an invite has no other way in, so they get one. Someone already using Wathb
   * is pointed at the app and logs in as usual, because a magic link is a
   * bearer credential and there is no reason to mint a fresh one every week for
   * an account that has a working login.
   */
  private async isEstablished(supervisorUser: { id: string; whatsappOptInAt: Date | null }): Promise<boolean> {
    if (supervisorUser.whatsappOptInAt) return true; // signed themselves up
    const accepted = await this.prisma.studentSupervisor.findFirst({
      where: { supervisorId: supervisorUser.id, acceptedAt: { not: null } },
      select: { id: true },
    });
    return !!accepted;
  }

  /**
   * The one place an invite or a reminder is actually put on the wire.
   *
   * A dedicated Utility-category template rather than free-form text: for an
   * unregistered number this is first contact, so there is no open
   * customer-service window (spec §7.2) — same reasoning as OTP's
   * first-time-login send. No config gate is needed because the injected
   * channel is already the ConsoleChannel dev stand-in when WhatsApp is not
   * configured.
   */
  private async deliverInvite(params: {
    linkId: string;
    supervisorUser: { id: string; name: string; mobileE164: string | null; whatsappOptedOutAt: Date | null; status: string };
    studentName: string;
    established: boolean;
    isReminder: boolean;
  }): Promise<boolean> {
    const { supervisorUser, studentName, established, isReminder } = params;
    // NOT-010 — STOP is permanent and applies to reminders above all: chasing
    // someone who has asked to be left alone is exactly the behaviour that
    // gets the sending number blocked.
    if (!supervisorUser.mobileE164) return false;
    if (supervisorUser.whatsappOptedOutAt) return false;
    if (supervisorUser.status === 'suspended') return false;

    const appUrl = this.config.get<string>('SUPERVISOR_APP_URL', 'http://localhost:5175/supervisor');
    let url = appUrl;
    if (!established) {
      // NOT-004 — magic links live 24h, so a reminder cannot reuse the token
      // minted with the original invite; by rung 1 it is already dead. Each
      // send mints its own.
      const magicLink = await this.magicLinks.mint({
        subjectId: supervisorUser.id,
        subjectType: 'supervisor',
        purpose: 'link_invite',
        targetId: params.linkId,
      });
      url = `${appUrl}/#magic=${magicLink.token}`;
    }

    const templateKey = isReminder
      ? established
        ? ['WHATSAPP_TEMPLATE_SUPERVISOR_INVITE_REMINDER_EXISTING', 'wathb_supervisor_invite_reminder_existing']
        : ['WHATSAPP_TEMPLATE_SUPERVISOR_INVITE_REMINDER', 'wathb_supervisor_invite_reminder']
      : established
        ? ['WHATSAPP_TEMPLATE_SUPERVISOR_INVITE_EXISTING', 'wathb_supervisor_invite_existing']
        : ['WHATSAPP_TEMPLATE_SUPERVISOR_INVITE', 'wathb_supervisor_invite'];

    try {
      await this.channel.sendTemplate({
        to: supervisorUser.mobileE164,
        templateName: this.config.get(templateKey[0], templateKey[1]),
        languageCode: 'ar',
        bodyParams: [supervisorUser.name, studentName, url],
      });
      return true;
    } catch {
      // Non-fatal — the account and pending link already exist; a failed send
      // must not fail the whole invite request (mirrors OTP's tolerant
      // delivery-failure handling).
      return false;
    }
  }

  /**
   * SUP-009 — one pass of the pending-invite reminder ladder, driven by the
   * scheduler. See invite-reminder.util for the cadence.
   *
   * The rung advances whether or not the send succeeded. Retrying a failed
   * send on the next tick would collapse the ladder into a daily nag for
   * exactly the numbers that are already failing to receive; NOT-009's retry
   * ladder is the mechanism for delivery failure, not this one.
   */
  async sendDueInviteReminders(now = new Date()) {
    const pending = await this.prisma.studentSupervisor.findMany({
      where: { acceptedAt: null, revokedAt: null, invitedAt: { not: null } },
      include: { supervisor: { include: { user: true } }, student: { include: { user: true } } },
    });

    const due = pending.filter((l) => isReminderDue(l.invitedAt!, l.reminderCount, now));
    if (due.length === 0) return { considered: pending.length, due: 0, sent: 0 };

    // One query for the whole batch rather than isEstablished() per row.
    const acceptedElsewhere = await this.prisma.studentSupervisor.findMany({
      where: { supervisorId: { in: [...new Set(due.map((l) => l.supervisorId))] }, acceptedAt: { not: null } },
      select: { supervisorId: true },
      distinct: ['supervisorId'],
    });
    const establishedIds = new Set(acceptedElsewhere.map((r) => r.supervisorId));

    let sent = 0;
    for (const l of due) {
      const delivered = await this.deliverInvite({
        linkId: l.id,
        supervisorUser: l.supervisor.user,
        studentName: l.student.user.name,
        established: !!l.supervisor.user.whatsappOptInAt || establishedIds.has(l.supervisorId),
        isReminder: true,
      });
      if (delivered) sent++;
      await this.prisma.studentSupervisor.update({
        where: { id: l.id },
        data: { reminderCount: { increment: 1 }, lastRemindedAt: now },
      });
    }
    return { considered: pending.length, due: due.length, sent };
  }

  /** Shared trust boundary: a supervisor may only read a student they're accepted on. */
  async assertLinkedTo(supervisorId: string, studentId: string) {
    const link = await this.prisma.studentSupervisor.findUnique({
      where: { studentId_supervisorId: { studentId, supervisorId } },
    });
    if (!link || !link.acceptedAt || link.revokedAt) throw new ForbiddenException('not linked to this student');
    return link;
  }

  async acceptInvite(supervisorId: string, studentSupervisorId: string) {
    const link = await this.prisma.studentSupervisor.findUnique({ where: { id: studentSupervisorId } });
    if (!link) throw new NotFoundException('invite not found');
    if (link.supervisorId !== supervisorId) throw new ForbiddenException();
    // A rejected invite is revoked without ever having been accepted — that
    // must stay a dead end, not something a later accept call can revive
    // into the contradictory "accepted and revoked" state.
    if (link.revokedAt) throw new BadRequestException('invite was rejected or revoked');
    return this.prisma.studentSupervisor.update({ where: { id: studentSupervisorId }, data: { acceptedAt: new Date() } });
  }

  // SUP-007 — reject reuses revokedAt (a link that's revoked without ever
  // having been accepted reads unambiguously as "rejected"), so no new
  // status column is needed alongside the existing accept/revoke pair.
  async rejectInvite(supervisorId: string, studentSupervisorId: string) {
    const link = await this.prisma.studentSupervisor.findUnique({ where: { id: studentSupervisorId } });
    if (!link) throw new NotFoundException('invite not found');
    if (link.supervisorId !== supervisorId) throw new ForbiddenException();
    if (link.acceptedAt) throw new BadRequestException('invite was already accepted — use revoke instead');
    if (link.revokedAt) throw new BadRequestException('invite was already rejected');
    return this.prisma.studentSupervisor.update({ where: { id: studentSupervisorId }, data: { revokedAt: new Date() } });
  }

  // SUP-007 — pending invites shall be browsable within a logged-in
  // session, not only reachable by tapping the original magic link.
  async listPendingInvites(supervisorId: string) {
    return this.prisma.studentSupervisor.findMany({
      where: { supervisorId, acceptedAt: null, revokedAt: null },
      include: { student: { include: { user: true } } },
      orderBy: { id: 'desc' },
    });
  }

  /** Consent is explicit and revocable by the student — spec §2. */
  async revoke(studentId: string, studentSupervisorId: string) {
    const link = await this.prisma.studentSupervisor.findUnique({ where: { id: studentSupervisorId } });
    if (!link || link.studentId !== studentId) throw new NotFoundException('link not found');
    return this.prisma.studentSupervisor.update({ where: { id: studentSupervisorId }, data: { revokedAt: new Date() } });
  }

  async dashboard(supervisorId: string) {
    const supervisor = await this.prisma.supervisor.findUnique({ where: { userId: supervisorId } });
    if (!supervisor) throw new NotFoundException('supervisor not found');

    const links = await this.prisma.studentSupervisor.findMany({
      where: { supervisorId, acceptedAt: { not: null }, revokedAt: null },
      include: { student: { include: { user: true } } },
    });

    const cards = await Promise.all(
      links.map(async (link) => {
        const stats = await this.prisma.studentLabelStat.findMany({
          where: { studentId: link.studentId },
          include: { label: true },
        });
        const reportable = stats.filter((s) => s.nAnswered >= MIN_SAMPLE_FOR_REPORTING);
        const strongest = reportable.sort((a, b) => b.nCorrect / b.nAnswered - a.nCorrect / a.nAnswered)[0];
        const weakest = reportable.sort((a, b) => a.nCorrect / a.nAnswered - b.nCorrect / b.nAnswered)[0];
        const weekStart = new Date();
        weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
        weekStart.setUTCHours(0, 0, 0, 0);
        const weekAnswered = await this.prisma.answer.count({
          where: { studentId: link.studentId, answeredAt: { gte: weekStart } },
        });
        const totalAnswered = stats.reduce((sum, s) => sum + s.nAnswered, 0);
        const totalCorrect = stats.reduce((sum, s) => sum + s.nCorrect, 0);
        const { compositeIndex, delta: compositeIndexDelta } = await this.reports.getCompositeSummary(link.studentId);
        // The card shows the student's current plan so an upgrade (their
        // own, or one this supervisor just paid for) is visible here
        // without asking the student.
        const latestSub = await this.prisma.subscription.findFirst({
          where: { studentId: link.studentId },
          orderBy: { createdAt: 'desc' },
          include: { package: true },
        });
        return {
          studentId: link.studentId,
          name: link.student.user.name,
          streak: link.student.currentStreak,
          weekAnswered,
          weeklyTarget: 35,
          totalAnswered,
          totalCorrect,
          totalWrong: totalAnswered - totalCorrect,
          testDate: link.student.testDate,
          compositeIndex,
          compositeIndexDelta,
          topStrength: strongest ? { nameAr: strongest.label.nameAr, nameEn: strongest.label.nameEn, accuracy: strongest.nCorrect / strongest.nAnswered } : null,
          topWeakness: weakest ? { nameAr: weakest.label.nameAr, nameEn: weakest.label.nameEn, accuracy: weakest.nCorrect / weakest.nAnswered } : null,
          subscription: latestSub
            ? { packageNameAr: latestSub.package.nameAr, status: latestSub.status, endsAt: latestSub.endsAt, isFree: latestSub.package.priceHalalas === 0 }
            : null,
        };
      }),
    );

    return { supervisorType: supervisor.type, viewMode: supervisor.type === 'parent' || cards.length <= 3 ? 'family_card' : 'instructor_table', students: cards };
  }

  // V3 in the spec — supervisor sets the weekly report day/time, or mutes it.
  // NOT-012 — the email channel lives on `users`, so it is joined in here
  // rather than making the preferences screen fetch from two places.
  async getPreferences(supervisorId: string) {
    const sup = await this.prisma.supervisor.findUniqueOrThrow({
      where: { userId: supervisorId },
      select: {
        weeklyReportDay: true,
        weeklyReportHour: true,
        weeklyReportMuted: true,
        user: { select: { notificationEmail: true, emailNotificationsEnabled: true } },
      },
    });
    const { user, ...prefs } = sup;
    return { ...prefs, ...user };
  }

  setPreferences(supervisorId: string, dto: { weeklyReportDay?: number; weeklyReportHour?: number; weeklyReportMuted?: boolean }) {
    return this.prisma.supervisor.update({ where: { userId: supervisorId }, data: dto });
  }
}
