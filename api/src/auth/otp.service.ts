import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomInt } from 'crypto';
import { SubjectType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NOTIFICATION_CHANNEL, NotificationChannel } from '../notifications/channel.interface';

const OTP_TTL_MINUTES = 5;
const MAX_ATTEMPTS = 5;

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

  async requestOtp(mobile: string, subjectType: SubjectType) {
    const user = await this.prisma.user.findUnique({ where: { mobileE164: mobile } });
    if (!user || user.role !== subjectType) {
      throw new ForbiddenException('no account found for this mobile number');
    }

    const code = randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);
    await this.prisma.otpCode.create({ data: { mobileE164: mobile, subjectType, codeHash: hashCode(code), expiresAt } });

    await this.channel.sendTemplate({
      to: mobile,
      templateName: this.config.get('WHATSAPP_TEMPLATE_OTP', 'wathb_otp_login'),
      languageCode: 'ar',
      bodyParams: [code],
    });

    const allowDev = this.config.get('ALLOW_DEV_LOGIN') === 'true';
    return { sent: true, expiresInMinutes: OTP_TTL_MINUTES, devCode: allowDev ? code : undefined };
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
