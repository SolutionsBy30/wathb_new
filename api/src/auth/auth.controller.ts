import { Body, Controller, ForbiddenException, Ip, Param, Post, Headers } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { MagicLinkService } from './magic-link.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { DevRequestLinkDto } from './dto/dev-request-link.dto';
import { PrismaService } from '../prisma/prisma.service';

@Controller('auth')
export class AuthController {
  constructor(
    private auth: AuthService,
    private magicLinks: MagicLinkService,
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  @Post('admin/login')
  adminLogin(@Body() dto: AdminLoginDto) {
    return this.auth.adminLogin(dto.email, dto.password);
  }

  // Mirrors spec §9.3: POST /api/auth/magic/:token -> exchange for scoped session.
  @Post('magic/:token')
  async exchange(@Param('token') token: string, @Ip() ip: string, @Headers('user-agent') userAgent?: string) {
    return this.auth.exchangeMagicLink(token, { ip, userAgent });
  }

  /**
   * Dev-only stand-in for "the WhatsApp message arrives and the student taps
   * it." Real delivery is Phase 3 (Meta WhatsApp Business Cloud API). Gated
   * off unless ALLOW_DEV_LOGIN=true so it can never ship live by accident.
   */
  @Post('dev/request-link')
  async devRequestLink(@Body() dto: DevRequestLinkDto) {
    if (this.config.get('ALLOW_DEV_LOGIN') !== 'true') {
      throw new ForbiddenException('dev login is disabled');
    }
    const user = await this.prisma.user.findUnique({ where: { mobileE164: dto.mobile } });
    if (!user) throw new ForbiddenException('no user with that mobile number');
    const { token, expiresAt } = await this.magicLinks.mint({
      subjectId: user.id,
      subjectType: dto.subjectType,
      purpose: 'dev_login',
      maxUses: 5,
    });
    return { token, expiresAt, name: user.name };
  }
}
