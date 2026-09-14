import { ForbiddenException, Inject, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomInt } from 'crypto';
import { SubjectType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NOTIFICATION_CHANNEL, NotificationChannel } from '../notifications/channel.interface';
import { AuditLogService } from '../admin-ops/audit-log.service';
import { isWhatsAppConfigured } from '../notifications/whatsapp-provider.util';
import { holdsRole } from './roles.util';
import { ProviderSettingsService } from '../notifications/provider-settings.service';

const OTP_TTL_MINUTES = 5;
const MAX_ATTEMPTS = 5;

// Fixed fallback code used whenever no real WhatsApp channel is wired up —
// ConsoleChannel just logs to the server, which isn't reachable to whoever
// is testing signup/login, so a predictable code stands in for it.
const FALLBACK_OTP_CODE = '1928';

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

// Mobile + OTP login (spec §9.3). A dedicated Authentication-category
// template is required here, not free-form — a first-time login has no
// open customer-service window yet (spec §7.2), so free-form would
// silently fail to send.
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(NOTIFICATION_CHANNEL) private channel: NotificationChannel,
    private config: ConfigService,
    private auditLog: AuditLogService,
    private providers: ProviderSettingsService,
  ) {}

  /**
   * True only when a real outbound WhatsApp transport is wired up.
   *
   * NOT-024 — asks the provider table first, because that is where senders
   * actually live now: they are created and edited in the admin console, and
   * a backup sender typically exists *only* there. Reading process.env (which
   * this did) made a database-configured sender invisible, so a primary whose
   * credentials had been moved into the table turned every login OTP into the
   * fixed, publicly-known fallback code.
   *
   * Env remains the fallback answer purely so a boot with an unreachable
   * database behaves as before rather than throwing inside a login.
   */
  private async hasWhatsAppConfigured(): Promise<boolean> {
    try {
      return await this.providers.hasWorkingSender();
    } catch {
      return isWhatsAppConfigured(process.env);
    }
  }

  async requestOtp(mobile: string, subjectType: SubjectType) {
    // AUTH-030 — the profile rows decide, not the `role` column: one number
    // may hold both a student and a supervisor account, and `role` records
    // only whichever came first.
    const user = await this.prisma.user.findUnique({
      where: { mobileE164: mobile },
      include: { student: true, supervisor: true },
    });
    if (!user || !holdsRole(user, subjectType)) {
      throw new ForbiddenException('no account found for this mobile number');
    }
    // ADM-085 — fail before ever generating/sending a code, not after.
    if (user.status === 'suspended') throw new ForbiddenException('account suspended');

    const whatsappConfigured = await this.hasWhatsAppConfigured();

    // NFR-005a — the boot guard checks the environment, which is no longer
    // where senders live, so it can pass while the provider table is empty.
    // This is the same rule enforced against the state that actually decides:
    // in production the fixed public code is never issued, whatever env says.
    if (!whatsappConfigured && process.env.NODE_ENV === 'production'
        && process.env.ALLOW_OTP_FALLBACK_IN_PRODUCTION !== 'true') {
      this.logger.error('no WhatsApp sender is configured — refusing to issue the fallback OTP code in production');
      throw new ServiceUnavailableException('خدمة إرسال رموز الدخول غير متاحة حاليًا. تواصل معنا.');
    }
    const code = whatsappConfigured ? randomInt(1000, 10000).toString() : FALLBACK_OTP_CODE;
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);
    await this.prisma.otpCode.create({ data: { mobileE164: mobile, subjectType, codeHash: hashCode(code), expiresAt } });

    // ONB-014 — every use of the fixed fallback value is recorded in the
    // audit log, not just returned in devCode.
    if (!whatsappConfigured) {
      await this.auditLog.record({
        actorId: null,
        actorLabel: 'system',
        action: 'otp.fallback_used',
        entityType: 'User',
        entityId: user.id,
        after: { mobile, subjectType },
        note: 'WhatsApp channel not configured — fixed fallback OTP code issued',
      });
    }

    let deliveryError: string | null = null;
    if (whatsappConfigured) {
      try {
        // RoutingChannel walks primary → backup, so reaching the catch below
        // means every configured sender refused, not just the first.
        await this.channel.sendTemplate({
          to: mobile,
          templateName: this.config.get('WHATSAPP_TEMPLATE_OTP', 'wathb_otp_login'),
          languageCode: 'ar',
          bodyParams: [code],
        });
      } catch (e) {
        deliveryError = (e as Error).message;
        this.logger.error(`OTP delivery failed for a ${subjectType} login: ${deliveryError}`);
        await this.auditLog.record({
          actorId: null,
          actorLabel: 'system',
          action: 'otp.delivery_failed',
          entityType: 'User',
          entityId: user.id,
          after: { subjectType, error: deliveryError },
          note: 'every configured WhatsApp sender refused the OTP',
        });
      }
    }

    // NFR-005b — SECURITY. This previously returned the real code to the
    // caller whenever delivery failed, reasoning that an unsent code is not a
    // secret. It is: the code is already stored and verifyOtp will accept it.
    // Since otp/request is public and takes any registered mobile, a WhatsApp
    // outage turned into "anyone may log in as anyone" — including school
    // administrators, who read other people's children's data.
    //
    // So a configured-but-failing channel is now an honest 503. The code stays
    // stored (a code that arrives late still works) but never crosses the wire.
    if (deliveryError) {
      throw new ServiceUnavailableException(
        'تعذّر إرسال رمز الدخول عبر واتساب حاليًا. حاول بعد قليل أو تواصل معنا.',
      );
    }

    // The fixed fallback code is only ever surfaced when no sender exists at
    // all — a local/dev state that the boot guard refuses to let production
    // start in. ALLOW_DEV_LOGIN additionally surfaces a genuinely-delivered
    // code for test accounts.
    const allowDev = this.config.get('ALLOW_DEV_LOGIN') === 'true';
    const devCode = !whatsappConfigured || allowDev ? code : undefined;
    return { sent: whatsappConfigured, expiresInMinutes: OTP_TTL_MINUTES, devCode };
  }

  async verifyOtp(mobile: string, subjectType: SubjectType, code: string) {
    const otp = await this.prisma.otpCode.findFirst({
      where: { mobileE164: mobile, subjectType, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) throw new UnauthorizedException('code expired or was never requested');
    if (otp.attempts >= MAX_ATTEMPTS) throw new UnauthorizedException('too many incorrect attempts — request a new code');

    if (otp.codeHash !== hashCode(code)) {
      await this.prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      throw new UnauthorizedException('incorrect code');
    }

    await this.prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { mobileE164: mobile },
      include: { student: true, supervisor: true },
    });
    // Defense in depth — the same account could be suspended between
    // requestOtp and verifyOtp.
    if (user.status === 'suspended') throw new UnauthorizedException('account suspended');
    // AUTH-030 — and re-check the role here, not only at request time. The
    // caller hands us subjectType and issues a session of that kind from it,
    // so this is the last point at which "may this person hold this role?" can
    // be asked before a token exists. A role revoked mid-flow must not be
    // spendable through a code minted a minute earlier.
    if (!holdsRole(user, subjectType)) throw new UnauthorizedException('account not found for this role');
    return user;
  }
}
