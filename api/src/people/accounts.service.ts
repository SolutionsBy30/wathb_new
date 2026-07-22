import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Shared by admin-created accounts (people.controller.ts) and public signup
// (auth.controller.ts) — lives outside AuthModule/PeopleModule so neither has
// to import the other (PeopleModule already imports AuthModule for
// SessionGuard).
@Injectable()
export class AccountsService {
  constructor(private prisma: PrismaService) {}

  async createStudent(mobile: string, name: string) {
    await this.assertMobileFree(mobile);
    return this.prisma.user.create({
      data: { mobileE164: mobile, name, role: 'student', student: { create: {} } },
      include: { student: true },
    });
  }

  async createSupervisor(mobile: string, name: string, type: 'parent' | 'instructor') {
    await this.assertMobileFree(mobile);
    return this.prisma.user.create({
      data: { mobileE164: mobile, name, role: 'supervisor', supervisor: { create: { type } } },
      include: { supervisor: true },
    });
  }

  private async assertMobileFree(mobile: string) {
    const existing = await this.prisma.user.findUnique({ where: { mobileE164: mobile } });
    if (existing) throw new BadRequestException('this mobile number is already registered');
  }
}
