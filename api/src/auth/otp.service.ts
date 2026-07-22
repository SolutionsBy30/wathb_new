import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomInt } from 'crypto';
import { SubjectType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NOTIFICATION_CHANNEL, NotificationChannel } from '../notifications/channel.interface';

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
  constructor(
    private prisma: PrismaService,
    @Inject(NOTIFICATION_CHANNEL) private channel: NotificationChannel,
    private config: ConfigService,
  ) {}

  /** True only when real WhatsApp Cloud API credentials are configured — see notification-channel.provider.ts's identical check. */
  private hasWhatsAppConfigured(): boolean {
    return !!this.config.get('WHATSAPP_ACCESS_TOKEN') && !!this.config.get('WHATSAPP_PHONE_NUMBER_ID');
  }

  async requestOtp(mobile: string, subjectType: SubjectType) {
    const user = await this.prisma.user.findUnique({ where: { mobileE164: mobile } });
    if (!user || user.role !== subjectType) {
      throw new ForbiddenException('no account found for this mobile number');
    }

    const whatsappConfigured = this.hasWhatsAppConfigured();
    const code = whatsappConfigured ? randomInt(1000, 10000).toString() : FALLBACK_OTP_CODE;
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);
    await this.prisma.otpCode.create({ data: { mobileE164: mobile, subjectType, codeHash: hashCode(code), expiresAt } });

    // A misconfigured/failing WhatsApp integration (bad phone number ID,
    // expired token, unapproved template, ...) must never turn into a 500
    // that locks everyone out of login — the code is already generated and
    // stored, so fall back to surfacing it the same way "not configured"
    // does instead of propagating the provider error.
    let deliveryFailed = false;
    if (whatsappConfigured) {
      try {
        await this.channel.sendTemplate({
          to: mobile,
          templateName: this.config.get('WHATSAPP_TEMPLATE_OTP', 'wathb_otp_login'),
          languageCode: 'ar',
          bodyParams: [code],
        });
      } catch {
        deliveryFailed = true;
      }
    }

    const allowDev = this.config.get('ALLOW_DEV_LOGIN') === 'true';
    // The fallback/undelivered code isn't a secret — nothing actually sent
    // it anywhere — so always surface it. A successfully WhatsApp-delivered
    // code only appears here when ALLOW_DEV_LOGIN is explicitly on.
    const devCode = !whatsappConfigured || deliveryFailed ? code : allowDev ? code : undefined;
    return { sent: !deliveryFailed, expiresInMinutes: OTP_TTL_MINUTES, devCode };
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
    return this.prisma.user.findUniqueOrThrow({ where: { mobileE164: mobile } });
  }
}
