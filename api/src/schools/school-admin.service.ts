import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SchoolIdentityDisclosure } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../admin-ops/audit-log.service';
import { GrantSchoolAdminDto } from './dto/school.dto';

/**
 * SCH-005 — the وثب side: who administers which school, and how much that
 * school may see.
 *
 * Every write here is audit-logged with the acting admin. Turning on identity
 * disclosure hands a third party the names of minors alongside their
 * performance; that is not a setting anyone should be able to change without
 * a record of who did it and when.
 */
@Injectable()
export class SchoolAdminService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditLogService,
  ) {}

  private async label(adminUserId: string) {
    const a = await this.prisma.user.findUnique({ where: { id: adminUserId }, select: { name: true, email: true } });
    return a?.email ?? a?.name ?? adminUserId;
  }

  list(schoolId?: string) {
    return this.prisma.schoolAdmin.findMany({
      where: schoolId ? { schoolId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, mobileE164: true, status: true } },
        school: { select: { id: true, nameAr: true, identityDisclosure: true } },
      },
    });
  }

  /** Schools that have at least one administrator, plus their disclosure state. */
  async schoolsWithAccess() {
    const rows = await this.prisma.school.findMany({
      where: { admins: { some: {} } },
      select: {
        id: true,
        nameAr: true,
        identityDisclosure: true,
        city: { select: { nameAr: true } },
        _count: { select: { admins: true, students: true } },
      },
      orderBy: { nameAr: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      nameAr: r.nameAr,
      cityNameAr: r.city.nameAr,
      disclosure: r.identityDisclosure,
      admins: r._count.admins,
      students: r._count.students,
    }));
  }

  /**
   * Grant dashboard access, creating the login if the person has none.
   *
   * A school administrator's User row carries role 'school' and nothing else:
   * no Student, no Supervisor. That is what stops a school login from ever
   * resolving to a student's own account.
   */
  async grant(dto: GrantSchoolAdminDto, adminUserId: string) {
    const school = await this.prisma.school.findUnique({ where: { id: dto.schoolId } });
    if (!school) throw new NotFoundException('المدرسة غير موجودة');

    const existing = await this.prisma.user.findUnique({
      where: { mobileE164: dto.mobile },
      select: { id: true, role: true },
    });
    // Refusing rather than silently converting: turning a student's or a
    // supervisor's account into a school login would detach them from their
    // own data, and there is no way to tell from here that it was intended.
    if (existing && existing.role !== 'school') {
      throw new BadRequestException('هذا الرقم مسجّل بحساب آخر (طالب أو مشرف). استخدم رقمًا مختلفًا.');
    }

    const user = existing
      ? await this.prisma.user.update({ where: { id: existing.id }, data: { name: dto.name } })
      : await this.prisma.user.create({
          data: { name: dto.name, mobileE164: dto.mobile, role: 'school', status: 'active' },
        });

    const link = await this.prisma.schoolAdmin.upsert({
      where: { userId_schoolId: { userId: user.id, schoolId: dto.schoolId } },
      create: { userId: user.id, schoolId: dto.schoolId, title: dto.title ?? null },
      update: { isActive: true, title: dto.title ?? null },
    });

    await this.audit.record({
      actorId: adminUserId,
      actorLabel: await this.label(adminUserId),
      action: 'school_admin.granted',
      entityType: 'School',
      entityId: dto.schoolId,
      after: { userId: user.id, name: dto.name },
      note: `مُنح ${dto.name} صلاحية لوحة ${school.nameAr}`,
    });
    return link;
  }

  async setActive(id: string, isActive: boolean, adminUserId: string) {
    const link = await this.prisma.schoolAdmin.findUnique({ where: { id }, include: { user: true, school: true } });
    if (!link) throw new NotFoundException('غير موجود');

    const updated = await this.prisma.schoolAdmin.update({ where: { id }, data: { isActive } });
    await this.audit.record({
      actorId: adminUserId,
      actorLabel: await this.label(adminUserId),
      action: isActive ? 'school_admin.reactivated' : 'school_admin.revoked',
      entityType: 'School',
      entityId: link.schoolId,
      after: { userId: link.userId, isActive },
      note: `${link.user.name} — ${link.school.nameAr}`,
    });
    return updated;
  }

  /**
   * How much this school may see.
   *
   * Logged loudly because 'full' is the moment minors' names start leaving the
   * platform. The student-level opt-out still overrides it, so this is a
   * ceiling rather than a switch.
   */
  async setDisclosure(schoolId: string, disclosure: SchoolIdentityDisclosure, adminUserId: string) {
    const school = await this.prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) throw new NotFoundException('المدرسة غير موجودة');

    const updated = await this.prisma.school.update({ where: { id: schoolId }, data: { identityDisclosure: disclosure } });
    await this.audit.record({
      actorId: adminUserId,
      actorLabel: await this.label(adminUserId),
      action: 'school.identity_disclosure',
      entityType: 'School',
      entityId: schoolId,
      before: { disclosure: school.identityDisclosure },
      after: { disclosure },
      note: `${school.nameAr}: ${school.identityDisclosure} ← ${disclosure}`,
    });
    return updated;
  }
}
