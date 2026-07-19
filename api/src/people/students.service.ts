import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoalSetupDto } from './dto/people.dto';

@Injectable()
export class StudentsService {
  constructor(private prisma: PrismaService) {}

  async createStudent(mobile: string, name: string) {
    const user = await this.prisma.user.create({
      data: { mobileE164: mobile, name, role: 'student', student: { create: {} } },
      include: { student: true },
    });
    return user;
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
}
