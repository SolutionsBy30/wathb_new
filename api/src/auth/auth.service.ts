import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { MagicLinkService } from './magic-link.service';
import { SessionPayload } from './auth.types';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private magicLinks: MagicLinkService,
  ) {}

  issueSession(payload: SessionPayload, expiresInSeconds: number): string {
    return this.jwt.sign(payload, { expiresIn: expiresInSeconds });
  }

  verifySession(token: string): SessionPayload {
    try {
      return this.jwt.verify<SessionPayload>(token);
    } catch {
      throw new UnauthorizedException('invalid or expired session');
    }
  }

  async adminLogin(email: string, password: string): Promise<{ token: string; name: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== 'admin' || !user.passwordHash) {
      throw new UnauthorizedException('invalid credentials');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('invalid credentials');
    if (user.status === 'suspended') throw new UnauthorizedException('account suspended'); // ADM-085
    const token = this.issueSession({ sub: user.id, kind: 'admin' }, 12 * 3600);
    return { token, name: user.name };
  }

  /**
   * Exchange a magic-link token for a scoped session. This is the ONLY way a
   * student or supervisor authenticates in this product — see spec §7.1.
   */
  async exchangeMagicLink(rawToken: string, access: { ip?: string; userAgent?: string }) {
    const result = await this.magicLinks.exchange(rawToken, access);
    if (!result.ok) throw new UnauthorizedException(`magic link ${result.reason}`);
    const { link } = result;
    // ADM-085 — suspending revokes live links, but a link minted by a
    // scheduled job *after* suspension (e.g. a weekly report) wouldn't be
    // caught by that alone — check status here too.
    const subject = await this.prisma.user.findUnique({ where: { id: link.subjectId } });
    if (subject?.status === 'suspended') throw new UnauthorizedException('account suspended');
    const kind = link.subjectType === 'student' ? 'student' : 'supervisor';
    const ttl = Math.max(60, Math.floor((link.expiresAt.getTime() - Date.now()) / 1000));
    const token = this.issueSession(
      { sub: link.subjectId, kind, purpose: link.purpose, targetId: link.targetId ?? undefined },
      ttl,
    );
    return { token, kind, purpose: link.purpose, targetId: link.targetId };
  }
}
