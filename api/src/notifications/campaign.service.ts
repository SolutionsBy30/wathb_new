import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../admin-ops/audit-log.service';
import { NOTIFICATION_CHANNEL, NotificationChannel } from './channel.interface';
import { MAX_STUDENT_MESSAGES_PER_DAY } from './notifications.service';
import { CampaignAudienceDto, CampaignSendDto } from './dto/campaign.dto';

// A flat, illustrative per-conversation cost — spec §3.4 asks bulk sends to
// be "recorded... with their cost estimate," not to reproduce Meta's actual
// tiered pricing, which varies by market and changes outside our control.
const TEMPLATE_COST_ESTIMATE_SAR = 0.15;
// Spec §3.4 "shall be rate-limited" — a small inter-send delay keeps a
// large campaign from bursting the WhatsApp API (or, on this console
// stand-in, from mattering at all — the guard just needs to exist).
const SEND_DELAY_MS = 50;

function dayKey(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class CampaignService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
    @Inject(NOTIFICATION_CHANNEL) private channel: NotificationChannel,
    private config: ConfigService,
  ) {}

  /** ADM-083 — filters compose with AND; an empty filter targets every student. */
  private audienceWhere(filter: CampaignAudienceDto): Prisma.StudentWhereInput {
    const where: Prisma.StudentWhereInput = {};

    if (filter.subscriptionStatus === 'none') {
      where.subscriptions = { none: { status: 'active' } };
    } else if (filter.subscriptionStatus || filter.packageId) {
      where.subscriptions = {
        some: {
          ...(filter.subscriptionStatus ? { status: filter.subscriptionStatus as any } : {}),
          ...(filter.packageId ? { packageId: filter.packageId } : {}),
        },
      };
    }

    if (filter.schoolId) where.schoolId = filter.schoolId;
    else if (filter.cityId) where.school = { cityId: filter.cityId };
    else if (filter.regionId) where.school = { city: { regionId: filter.regionId } };

    if (filter.inactiveDays) {
      const cutoff = new Date();
      cutoff.setUTCDate(cutoff.getUTCDate() - filter.inactiveDays);
      where.OR = [{ lastCompletedOn: null }, { lastCompletedOn: { lt: cutoff } }];
    }

    return where;
  }

  /** Recipient count shown to the admin before dispatch — spec §3.4 "preview the recipient count before dispatch." */
  async previewAudience(filter: CampaignAudienceDto) {
    const where = this.audienceWhere(filter);
    const [count, sample] = await this.prisma.$transaction([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({ where, take: 5, include: { user: { select: { name: true, mobileE164: true } } } }),
    ]);
    return {
      count,
      sample: sample.map((s) => ({ studentId: s.userId, name: s.user.name, mobile: s.user.mobileE164 })),
    };
  }

  async send(dto: CampaignSendDto, adminId: string) {
    const where = this.audienceWhere(dto);
    const students = await this.prisma.student.findMany({ where, include: { user: true } });

    const today = dayKey(new Date());
    const templateName = this.config.get(
      dto.category === 'marketing' ? 'WHATSAPP_TEMPLATE_CAMPAIGN_MARKETING' : 'WHATSAPP_TEMPLATE_CAMPAIGN_UTILITY',
      dto.category === 'marketing' ? 'admin_campaign_marketing' : 'admin_campaign_utility',
    );

    const result = { targeted: students.length, sent: 0, optedOut: 0, frequencyCapped: 0, noMobile: 0, failed: 0, costEstimateSar: 0 };

    for (const student of students) {
      if (student.user.whatsappOptedOutAt) {
        result.optedOut++;
        continue;
      }
      if (!student.user.mobileE164) {
        result.noMobile++;
        continue;
      }
      // NOT-010/NOT-011 — the same daily frequency cap the automated job enforces.
      const sentToday = await this.prisma.notification.count({
        where: { userId: student.userId, scheduledFor: today, status: { in: ['sent', 'delivered', 'read'] } },
      });
      if (sentToday >= MAX_STUDENT_MESSAGES_PER_DAY) {
        result.frequencyCapped++;
        continue;
      }
      // Every campaign notification shares kind 'nudge', and the Notification
      // table has one (userId, kind, scheduledFor) row per day by design
      // (daily_wathb's own idempotency guard, spec §7.3: "a duplicate daily
      // message is a trust-destroying bug"). That means at most one campaign
      // can reach a given student per day even when the 2/day cap above
      // would allow a second — checked explicitly here so a second campaign
      // the same day degrades to a counted skip instead of a 500 on the
      // unique-constraint violation (found via live testing this pass).
      const alreadyCampaigned = await this.prisma.notification.findUnique({
        where: { userId_kind_scheduledFor: { userId: student.userId, kind: 'nudge', scheduledFor: today } },
      });
      if (alreadyCampaigned) {
        result.frequencyCapped++;
        continue;
      }

      const waSession = await this.prisma.waSession.findUnique({ where: { userId: student.userId } });
      const windowOpen = !!waSession?.windowExpiresAt && waSession.windowExpiresAt > new Date();
      const billable = !windowOpen;

      const notif = await this.prisma.notification.create({
        data: {
          userId: student.userId,
          kind: 'nudge',
          channel: billable ? 'whatsapp_template' : 'whatsapp_freeform',
          templateName: billable ? templateName : null,
          category: dto.category,
          scheduledFor: today,
          status: 'scheduled',
          wasBillable: billable,
          costEstimate: billable ? TEMPLATE_COST_ESTIMATE_SAR : 0,
        },
      });

      try {
        const sendResult = billable
          ? await this.channel.sendTemplate({ to: student.user.mobileE164, templateName, languageCode: 'ar', bodyParams: [student.user.name, dto.message] })
          : await this.channel.sendFreeform({ to: student.user.mobileE164, text: dto.message });
        await this.prisma.notification.update({
          where: { id: notif.id },
          data: { status: 'sent', sentAt: new Date(), waMessageId: sendResult.providerMessageId },
        });
        result.sent++;
        if (billable) result.costEstimateSar += TEMPLATE_COST_ESTIMATE_SAR;
      } catch (e: any) {
        await this.prisma.notification.update({ where: { id: notif.id }, data: { status: 'failed', error: e.message } });
        result.failed++;
      }

      await sleep(SEND_DELAY_MS);
    }

    await this.auditLog.record({
      actorId: adminId,
      actorLabel: 'admin',
      action: 'notification.campaign_sent',
      entityType: 'NotificationCampaign',
      entityId: today.toISOString().slice(0, 10),
      after: { filter: { ...dto, message: undefined }, category: dto.category, ...result },
      note: dto.message,
    });

    return result;
  }
}
