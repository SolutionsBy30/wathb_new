import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MagicLinkService } from '../auth/magic-link.service';
import { NOTIFICATION_CHANNEL, NotificationChannel } from '../notifications/channel.interface';

/** The notification's idempotency key is a date; this is the day of the send. */
function dayKey(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * SIM-017 — §7.6 result delivery.
 *
 * Utility, not Marketing: the message is tied to an action the student just
 * completed, which is what the category is for. It carries a magic link to the
 * report and does not itself open a free 24h session window.
 *
 * Every path here is best-effort. A failed WhatsApp send must never roll back
 * a finalized attempt — the exam is over and the result exists whether or not
 * the message went out. That is why finalize() calls this outside its
 * transaction and swallows what comes back.
 */
@Injectable()
export class SimulationNotifyService {
  private readonly log = new Logger(SimulationNotifyService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private magicLinks: MagicLinkService,
    @Inject(NOTIFICATION_CHANNEL) private channel: NotificationChannel,
  ) {}

  /** Fire-and-forget: student first, then every accepted supervisor. */
  async notifyResult(attemptId: string) {
    try {
      await this.notifyStudent(attemptId);
      await this.notifySupervisors(attemptId);
    } catch (e: any) {
      // Logged rather than raised: the caller is finalize(), and an attempt
      // that scored correctly must not appear to have failed because a
      // message did not send.
      this.log.error(`simulation result notify failed for ${attemptId}: ${e.message}`);
    }
  }

  private async load(attemptId: string) {
    return this.prisma.simulationAttempt.findUnique({
      where: { id: attemptId },
      include: {
        result: { select: { rawScore: true, scoredCount: true } },
        blueprint: { select: { nameAr: true } },
        student: { select: { userId: true, user: { select: { name: true, mobileE164: true, whatsappOptedOutAt: true } } } },
      },
    });
  }

  private summary(rawScore: number, scoredCount: number, blueprintNameAr: string) {
    const accuracy = scoredCount > 0 ? Math.round((rawScore / scoredCount) * 100) : 0;
    // Deliberately a percentage and never a قياس-style score: §12.1 is
    // unresolved and a number in a WhatsApp message is the one place a
    // student is most likely to read it as official.
    return `${blueprintNameAr} · ${accuracy}٪ (${rawScore} من ${scoredCount})`;
  }

  private async notifyStudent(attemptId: string) {
    const attempt = await this.load(attemptId);
    if (!attempt?.result) return { skipped: 'no_result' as const };

    const user = attempt.student.user;
    if (user.whatsappOptedOutAt) return { skipped: 'opted_out' as const };
    if (!user.mobileE164) return { skipped: 'no_mobile' as const };

    const scheduledFor = dayKey(new Date());
    // The [userId, kind, scheduledFor] unique key is the guard against a
    // duplicate. An admin override can put two attempts in one day, in which
    // case the second result is simply not messaged — the report is still in
    // the app, and a second identical-looking message the same day would read
    // as a bug.
    const already = await this.prisma.notification.findUnique({
      where: { userId_kind_scheduledFor: { userId: attempt.studentId, kind: 'simulation_result_student', scheduledFor } },
    });
    if (already) return { skipped: 'already_sent' as const };

    const { token } = await this.magicLinks.mint({
      subjectId: attempt.studentId,
      subjectType: 'student',
      purpose: 'simulation_report',
      targetId: attemptId,
    });
    const url = `${this.config.get('STUDENT_APP_URL', 'http://localhost:5173/wathb')}/#magic=${token}&go=simulation`;

    const notification = await this.prisma.notification.create({
      data: {
        userId: attempt.studentId,
        kind: 'simulation_result_student',
        channel: 'whatsapp_template',
        category: 'utility',
        scheduledFor,
        status: 'scheduled',
      },
    });
    try {
      const result = await this.channel.sendTemplate({
        to: user.mobileE164,
        templateName: this.config.get('WHATSAPP_TEMPLATE_SIMULATION_STUDENT', 'simulation_result_student'),
        languageCode: 'ar',
        bodyParams: [user.name, this.summary(attempt.result.rawScore, attempt.result.scoredCount, attempt.blueprint.nameAr), url],
      });
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'sent', sentAt: new Date(), waMessageId: result.providerMessageId },
      });
      return { sent: true as const };
    } catch (e: any) {
      await this.prisma.notification.update({ where: { id: notification.id }, data: { status: 'failed', error: e.message } });
      return { failed: true as const };
    }
  }

  /** §7.5 — "supervisor receives a report notification via WhatsApp." */
  private async notifySupervisors(attemptId: string) {
    const attempt = await this.load(attemptId);
    if (!attempt?.result) return;

    const links = await this.prisma.studentSupervisor.findMany({
      where: { studentId: attempt.studentId, acceptedAt: { not: null }, revokedAt: null },
      include: { supervisor: { select: { userId: true, user: { select: { name: true, mobileE164: true, whatsappOptedOutAt: true } } } } },
    });

    const scheduledFor = dayKey(new Date());
    for (const link of links) {
      const sup = link.supervisor;
      if (sup.user.whatsappOptedOutAt || !sup.user.mobileE164) continue;

      const already = await this.prisma.notification.findUnique({
        where: { userId_kind_scheduledFor: { userId: sup.userId, kind: 'simulation_result_supervisor', scheduledFor } },
      });
      if (already) continue;

      // A supervisor's link is minted against the supervisor, not the
      // student: it must log in as them and land on their own portal, or a
      // forwarded message would hand over the student's account.
      const { token } = await this.magicLinks.mint({
        subjectId: sup.userId,
        subjectType: 'supervisor',
        purpose: 'simulation_report',
        targetId: attemptId,
      });
      const url = `${this.config.get('SUPERVISOR_APP_URL', 'http://localhost:5175/supervisor')}/#magic=${token}&go=simulation`;

      const notification = await this.prisma.notification.create({
        data: {
          userId: sup.userId,
          kind: 'simulation_result_supervisor',
          channel: 'whatsapp_template',
          category: 'utility',
          scheduledFor,
          status: 'scheduled',
        },
      });
      try {
        const result = await this.channel.sendTemplate({
          to: sup.user.mobileE164,
          templateName: this.config.get('WHATSAPP_TEMPLATE_SIMULATION_SUPERVISOR', 'simulation_result_supervisor'),
          languageCode: 'ar',
          bodyParams: [
            sup.user.name,
            attempt.student.user.name,
            this.summary(attempt.result.rawScore, attempt.result.scoredCount, attempt.blueprint.nameAr),
            url,
          ],
        });
        await this.prisma.notification.update({
          where: { id: notification.id },
          data: { status: 'sent', sentAt: new Date(), waMessageId: result.providerMessageId },
        });
      } catch (e: any) {
        await this.prisma.notification.update({ where: { id: notification.id }, data: { status: 'failed', error: e.message } });
      }
    }
  }
}
