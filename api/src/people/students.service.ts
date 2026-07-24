import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccountsService } from './accounts.service';
import { GoalSetupDto } from './dto/people.dto';
import { ReportsService } from '../reports/reports.service';

export type AdminStudentSort = 'name' | 'subscriptionEnd' | 'performance' | 'createdAt';

@Injectable()
export class StudentsService {
  constructor(
    private prisma: PrismaService,
    private accounts: AccountsService,
    private reports: ReportsService,
  ) {}

  createStudent(mobile: string, name: string) {
    return this.accounts.createStudent(mobile, name);
  }

  /**
   * ADM-050 — admin students list. Filterable by school/city, sortable by
   * name/subscription end date/performance (composite index). Composite
   * index and subscription end date aren't stored columns, so a sort by
   * either fetches the full filtered set and sorts/paginates in memory
   * rather than pushing the sort into Prisma — a documented, pragmatic
   * limit fine at today's data volumes (same trade-off as the cohort
   * report's live-computed aggregation).
   */
  async adminList(search?: string, offset = 0, limit = 50, sortBy: AdminStudentSort = 'createdAt', sortDir: 'asc' | 'desc' = 'desc', schoolId?: string, cityId?: string) {
    const where = {
      ...(search ? { user: { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { mobileE164: { contains: search } }] } } : {}),
      ...(schoolId ? { schoolId } : {}),
      ...(cityId ? { school: { cityId } } : {}),
    };

    if (sortBy === 'createdAt') {
      const [total, items] = await this.prisma.$transaction([
        this.prisma.student.count({ where }),
        this.prisma.student.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: { user: { createdAt: sortDir } },
          include: {
            user: true,
            targetTest: true,
            school: { include: { city: true } },
            subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
            _count: { select: { answers: true } },
          },
        }),
      ]);
      const ids = items.map((s) => s.userId);
      const compositeIndexById = await this.reports.getCompositeIndexBulk(ids);
      return {
        total,
        items: items.map((s) => ({ ...s, compositeIndex: compositeIndexById.get(s.userId) ?? null, subscriptionEnd: s.subscriptions[0]?.endsAt ?? null })),
      };
    }

    const all = await this.prisma.student.findMany({
      where,
      include: {
        user: true,
        targetTest: true,
        school: { include: { city: true } },
        subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: { select: { answers: true } },
      },
    });
    const compositeIndexById = await this.reports.getCompositeIndexBulk(all.map((s) => s.userId));
    const withComposite = all.map((s) => ({ ...s, compositeIndex: compositeIndexById.get(s.userId) ?? null, subscriptionEnd: s.subscriptions[0]?.endsAt ?? null }));

    const dir = sortDir === 'asc' ? 1 : -1;
    withComposite.sort((a, b) => {
      if (sortBy === 'name') return dir * a.user.name.localeCompare(b.user.name, 'ar');
      if (sortBy === 'subscriptionEnd') {
        if (!a.subscriptionEnd && !b.subscriptionEnd) return 0;
        if (!a.subscriptionEnd) return 1; // nulls last regardless of direction
        if (!b.subscriptionEnd) return -1;
        return dir * (a.subscriptionEnd.getTime() - b.subscriptionEnd.getTime());
      }
      // performance (composite index)
      if (a.compositeIndex === null && b.compositeIndex === null) return 0;
      if (a.compositeIndex === null) return 1;
      if (b.compositeIndex === null) return -1;
      return dir * (a.compositeIndex - b.compositeIndex);
    });

    return { total: withComposite.length, items: withComposite.slice(offset, offset + limit) };
  }

  setSchool(studentId: string, schoolId: string | null) {
    return this.prisma.student.update({ where: { userId: studentId }, data: { schoolId } });
  }

  /**
   * ADM-052 — everything the student list's report link-out doesn't show:
   * subscription/payment history, the notification-delivery log, raw
   * session-by-session answers, and a device/link access log — for support
   * and abuse investigation. Each list is capped rather than paginated;
   * that's enough for a single student's history at today's data volumes
   * and keeps this one call instead of four separate paginated endpoints.
   */
  async adminDetail(studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId: studentId },
      include: { user: true, targetTest: true, school: { include: { city: true } } },
    });
    if (!student) throw new NotFoundException('student not found');

    const [subscriptions, notifications, sessions, magicLinks] = await Promise.all([
      this.prisma.subscription.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' }, include: { package: true } }),
      this.prisma.notification.findMany({ where: { userId: studentId }, orderBy: { createdAt: 'desc' }, take: 50 }),
      this.prisma.wathb.findMany({
        where: { studentId },
        orderBy: { scheduledFor: 'desc' },
        take: 30,
        include: { answers: { select: { isCorrect: true, timeTakenMs: true, timedOut: true, isReview: true, answeredAt: true, labelId: true } } },
      }),
      this.prisma.magicLink.findMany({
        where: { subjectId: studentId, subjectType: 'student' },
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { accessLog: { orderBy: { accessedAt: 'desc' } } },
      }),
    ]);

    return { student, subscriptions, notifications, sessions, magicLinks };
  }

  /** Admin lookup for manual actions (e.g. wire-transfer activation) — exact mobile match. */
  async searchByMobile(mobile: string) {
    const user = await this.prisma.user.findUnique({
      where: { mobileE164: mobile },
      include: {
        student: {
          include: {
            targetTest: true,
            subscriptions: { orderBy: { createdAt: 'desc' }, take: 1, include: { package: true } },
          },
        },
      },
    });
    if (!user || !user.student) return null;
    return {
      studentId: user.id,
      name: user.name,
      mobile: user.mobileE164,
      targetTest: user.student.targetTest?.nameAr ?? null,
      latestSubscription: user.student.subscriptions[0] ?? null,
    };
  }

  async me(studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId: studentId },
      include: { user: true, targetTest: true },
    });
    if (!student) throw new NotFoundException('student not found');
    return student;
  }

  async listSupervisors(studentId: string) {
    return this.prisma.studentSupervisor.findMany({
      where: { studentId, revokedAt: null },
      include: { supervisor: { include: { user: true } } },
    });
  }

  async setGoal(studentId: string, dto: GoalSetupDto) {
    return this.prisma.student.update({
      where: { userId: studentId },
      data: {
        targetTestId: dto.targetTestId,
        track: dto.track,
        targetScore: dto.targetScore,
        testDate: dto.testDate ? new Date(dto.testDate) : undefined,
      },
    });
  }

  setNotificationPrefs(studentId: string, dto: { notifSlotStartHour?: number; notifSlotEndHour?: number; skipDays?: number[] }) {
    return this.prisma.student.update({
      where: { userId: studentId },
      data: dto,
      select: { notifSlotStartHour: true, notifSlotEndHour: true, skipDays: true },
    });
  }
}
