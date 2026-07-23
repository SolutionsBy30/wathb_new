import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MagicLinkService } from '../auth/magic-link.service';
import { AuditLogService } from './audit-log.service';

// ADM-085 — suspend/unsuspend any User (student, supervisor, or admin).
// Suspending invalidates every live magic link for that subject; both
// directions are logged and reversible.
@Injectable()
export class SuspensionService {
  constructor(
    private prisma: PrismaService,
    private magicLinks: MagicLinkService,
    private auditLog: AuditLogService,
  ) {}

  private async actorLabel(actorId: string): Promise<string> {
    const actor = await this.prisma.user.findUnique({ where: { id: actorId }, select: { name: true, email: true } });
    return actor?.email ?? actor?.name ?? actorId;
  }

  async suspend(userId: string, reason: string, note: string | undefined, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('user not found');
    if (user.status === 'suspended') throw new BadRequestException('user is already suspended');

    const before = { status: user.status, suspendReason: user.suspendReason };
    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'suspended', suspendedAt: new Date(), suspendReason: reason },
    });
    await this.magicLinks.revokeAllForSubject(userId);

    await this.auditLog.record({
      actorId,
      actorLabel: await this.actorLabel(actorId),
      action: 'user.suspend',
      entityType: 'User',
      entityId: userId,
      before,
      after: { status: 'suspended', suspendReason: reason },
      note,
    });
    return { suspended: true as const };
  }

  async unsuspend(userId: string, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('user not found');
    if (user.status !== 'suspended') throw new BadRequestException('user is not suspended');

    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'active', suspendedAt: null, suspendReason: null },
    });

    await this.auditLog.record({
      actorId,
      actorLabel: await this.actorLabel(actorId),
      action: 'user.unsuspend',
      entityType: 'User',
      entityId: userId,
      before: { status: 'suspended', suspendReason: user.suspendReason },
      after: { status: 'active' },
    });
    return { unsuspended: true as const };
  }
}
