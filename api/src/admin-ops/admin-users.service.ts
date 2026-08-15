import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from './audit-log.service';
import { ADMIN_PERMISSION_GROUPS, ADMIN_PERMISSION_LABELS, isAdminPermission } from './admin-permissions';

const SELECT = {
  id: true,
  name: true,
  email: true,
  status: true,
  isSuperAdmin: true,
  adminPermissions: true,
  createdAt: true,
} as const;

/**
 * ADM-088 — admin accounts and what each one may reach.
 *
 * Every mutation is audit-logged with the acting admin: granting console
 * access is exactly the kind of action that needs a trail, and the AuditLog
 * table already exists for it (ADM-085).
 */
@Injectable()
export class AdminUsersService {
  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  /** The permission vocabulary, so the console renders it without hardcoding a copy. */
  catalogue() {
    return {
      groups: ADMIN_PERMISSION_GROUPS.map((g) => ({
        group: g.group,
        items: g.keys.map((key) => ({ key, label: ADMIN_PERMISSION_LABELS[key] })),
      })),
    };
  }

  list() {
    return this.prisma.user.findMany({
      where: { role: 'admin' },
      select: SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  /** The caller's own identity and reach — drives nav filtering in the console. */
  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: SELECT });
    if (!user) throw new NotFoundException('admin not found');
    return user;
  }

  private cleanPermissions(permissions: unknown): string[] {
    if (!Array.isArray(permissions)) return [];
    // Unknown keys are dropped rather than stored: a typo must not sit in the
    // database looking like a grant that will start working if the key is
    // ever added.
    return [...new Set(permissions.filter((p): p is string => typeof p === 'string' && isAdminPermission(p)))];
  }

  private async assertSuperAdmin(actorId: string) {
    const actor = await this.prisma.user.findUnique({
      where: { id: actorId },
      select: { role: true, isSuperAdmin: true, status: true, name: true, email: true },
    });
    if (!actor || actor.role !== 'admin' || actor.status === 'suspended' || !actor.isSuperAdmin) {
      throw new ForbiddenException('only a super admin can manage admin accounts');
    }
    return actor;
  }

  async create(
    actorId: string,
    dto: { name: string; email: string; password: string; permissions?: string[]; isSuperAdmin?: boolean },
  ) {
    const actor = await this.assertSuperAdmin(actorId);
    const email = dto.email.trim().toLowerCase();
    if (!email || !dto.password || dto.password.length < 8) {
      throw new BadRequestException('name, email and a password of at least 8 characters are required');
    }
    const clash = await this.prisma.user.findUnique({ where: { email } });
    if (clash) throw new BadRequestException('an account with this email already exists');

    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email,
        passwordHash: await bcrypt.hash(dto.password, 10),
        role: 'admin',
        isSuperAdmin: dto.isSuperAdmin ?? false,
        adminPermissions: this.cleanPermissions(dto.permissions),
      },
      select: SELECT,
    });

    await this.auditLog.record({
      actorId,
      actorLabel: actor.email ?? actor.name ?? actorId,
      action: 'admin.created',
      entityType: 'User',
      entityId: user.id,
      after: { email: user.email, isSuperAdmin: user.isSuperAdmin, permissions: user.adminPermissions },
      note: `admin account created for ${user.email}`,
    });
    return user;
  }

  async update(
    actorId: string,
    targetId: string,
    dto: { name?: string; email?: string; password?: string; permissions?: string[]; isSuperAdmin?: boolean; status?: 'active' | 'suspended' },
  ) {
    const actor = await this.assertSuperAdmin(actorId);
    const before = await this.prisma.user.findUnique({ where: { id: targetId }, select: SELECT });
    if (!before || (await this.prisma.user.findUnique({ where: { id: targetId }, select: { role: true } }))?.role !== 'admin') {
      throw new NotFoundException('admin not found');
    }

    // Two self-inflicted lockouts worth refusing outright: disabling yourself,
    // and dropping your own super-admin flag. Either can leave a console with
    // nobody able to administer it, recoverable only via SQL.
    if (targetId === actorId) {
      if (dto.status === 'suspended') throw new BadRequestException('you cannot disable your own account');
      if (dto.isSuperAdmin === false) throw new BadRequestException('you cannot remove your own super-admin role');
    }
    // Same failure one step out: removing the last super admin entirely.
    if (before.isSuperAdmin && (dto.isSuperAdmin === false || dto.status === 'suspended')) {
      const remaining = await this.prisma.user.count({
        where: { role: 'admin', isSuperAdmin: true, status: { not: 'suspended' }, NOT: { id: targetId } },
      });
      if (remaining === 0) throw new BadRequestException('at least one active super admin must remain');
    }

    const email = dto.email?.trim().toLowerCase();
    if (email && email !== before.email) {
      const clash = await this.prisma.user.findUnique({ where: { email } });
      if (clash) throw new BadRequestException('an account with this email already exists');
    }

    const user = await this.prisma.user.update({
      where: { id: targetId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(email ? { email } : {}),
        ...(dto.password ? { passwordHash: await bcrypt.hash(dto.password, 10) } : {}),
        ...(dto.permissions !== undefined ? { adminPermissions: this.cleanPermissions(dto.permissions) } : {}),
        ...(dto.isSuperAdmin !== undefined ? { isSuperAdmin: dto.isSuperAdmin } : {}),
        ...(dto.status !== undefined ? { status: dto.status, suspendedAt: dto.status === 'suspended' ? new Date() : null } : {}),
      },
      select: SELECT,
    });

    await this.auditLog.record({
      actorId,
      actorLabel: actor.email ?? actor.name ?? actorId,
      action: 'admin.updated',
      entityType: 'User',
      entityId: targetId,
      before: { status: before.status, isSuperAdmin: before.isSuperAdmin, permissions: before.adminPermissions },
      after: { status: user.status, isSuperAdmin: user.isSuperAdmin, permissions: user.adminPermissions },
      // Never log the password itself, only that one was set.
      note: dto.password ? 'admin account updated (password changed)' : 'admin account updated',
    });
    return user;
  }
}
