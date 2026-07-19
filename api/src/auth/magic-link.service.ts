import { Injectable } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { MagicLinkPurpose, SubjectType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

// §7.1 — passwordless magic links. The raw token exists only in the URL and
// in the caller's hands; the DB stores a hash of it, never the token itself.
const TTL_SECONDS_BY_PURPOSE: Record<MagicLinkPurpose, number> = {
  wathb: 6 * 3600, // end of slot window + grace, simplified for dev to a flat 6h
  weekly_report: 7 * 24 * 3600,
  supervisor_report: 7 * 24 * 3600,
  renewal: 3600,
  link_invite: 7 * 24 * 3600,
};

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

@Injectable()
export class MagicLinkService {
  constructor(private prisma: PrismaService) {}

  async mint(params: {
    subjectId: string;
    subjectType: SubjectType;
    purpose: MagicLinkPurpose;
    targetId?: string;
    maxUses?: number;
  }): Promise<{ id: string; token: string; expiresAt: Date }> {
    const raw = randomBytes(32).toString('base64url'); // 256 bits of entropy, well above the 128-bit floor
    const tokenHash = hashToken(raw);
    const expiresAt = new Date(Date.now() + TTL_SECONDS_BY_PURPOSE[params.purpose] * 1000);
    const link = await this.prisma.magicLink.create({
      data: {
        tokenHash,
        subjectId: params.subjectId,
        subjectType: params.subjectType,
        purpose: params.purpose,
        targetId: params.targetId,
        expiresAt,
        maxUses: params.maxUses ?? 1,
      },
    });
    return { id: link.id, token: raw, expiresAt };
  }

  /**
   * Exchange a raw token for the MagicLink row, enforcing expiry/revocation/use-count.
   * A link is a capability scoped to one purpose+target, never a general session —
   * the caller is responsible for only granting access to that target.
   */
  async exchange(rawToken: string, access: { ip?: string; userAgent?: string }) {
    const tokenHash = hashToken(rawToken);
    const link = await this.prisma.magicLink.findUnique({ where: { tokenHash } });
    if (!link) return { ok: false as const, reason: 'not_found' as const };
    if (link.revokedAt) return { ok: false as const, reason: 'revoked' as const };
    if (link.expiresAt < new Date()) return { ok: false as const, reason: 'expired' as const };
    if (link.uses >= link.maxUses) return { ok: false as const, reason: 'exhausted' as const };

    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.magicLink.update({
        where: { id: link.id },
        data: {
          uses: { increment: 1 },
          firstUsedAt: link.firstUsedAt ?? now,
          lastUsedAt: now,
        },
      }),
      this.prisma.magicLinkAccess.create({
        data: { magicLinkId: link.id, ip: access.ip, userAgent: access.userAgent },
      }),
    ]);

    return { ok: true as const, link };
  }

  async revokeAllForSubject(subjectId: string) {
    await this.prisma.magicLink.updateMany({
      where: { subjectId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
