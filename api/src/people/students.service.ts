import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccountsService } from './accounts.service';
import { GoalSetupDto } from './dto/people.dto';

@Injectable()
export class StudentsService {
  constructor(
    private prisma: PrismaService,
    private accounts: AccountsService,
  ) {}

  createStudent(mobile: string, name: string) {
    return this.accounts.createStudent(mobile, name);
  }

  /** A9 in the spec — admin students list. Paginated, optional name/mobile search. */
  async adminList(search?: string, offset = 0, limit = 50) {
    const where = search
      ? { user: { OR: [{ name: { contains: search, mode: 'insensitive' as const } }, { mobileE164: { contains: search } }] } }
      : {};
    const [total, items] = await this.prisma.$transaction([
      this.prisma.student.count({ where }),
      this.prisma.student.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { user: { createdAt: 'desc' } },
        include: { user: true, targetTest: true, school: { include: { city: true } } },
      }),
    ]);
    return { total, items };
  }

  setSchool(studentId: string, schoolId: string | null) {
    return this.prisma.student.update({ where: { userId: studentId }, data: { schoolId } });
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

  setNotificationPrefs(studentId: string, dto: { notifSlotStartHour?: number; notifSlotEndHour?: number }) {
    return this.prisma.student.update({
      where: { userId: studentId },
      data: dto,
      select: { notifSlotStartHour: true, notifSlotEndHour: true },
    });
  }
}
