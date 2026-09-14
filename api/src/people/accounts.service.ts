import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DefaultEnrolmentService } from '../payments/default-enrolment.service';
import { canAddRole, SelfServiceRole } from '../auth/roles.util';

// Shared by admin-created accounts (people.controller.ts) and public signup
// (auth.controller.ts) — lives outside AuthModule/PeopleModule so neither has
// to import the other (PeopleModule already imports AuthModule for
// SessionGuard).
@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(
    private prisma: PrismaService,
    private defaultEnrolment: DefaultEnrolmentService,
  ) {}

  // whatsappOptInAt is left null for admin-created accounts (no self-service
  // consent step happened) — only public signup captures it.
  async createStudent(mobile: string, name: string, whatsappOptInAt?: Date) {
    const existing = await this.findCombinable(mobile, 'student');
    if (existing) {
      // AUTH-030 — already a supervisor on this number: add the student
      // profile rather than refusing. `role` is left alone; it records what
      // they signed up as first, and rolesHeldBy() reads the profile rows.
      const user = existing.student
        ? existing
        : await this.prisma.user.update({
            where: { id: existing.id },
            data: { student: { create: {} }, ...(whatsappOptInAt ? { whatsappOptInAt } : {}) },
            include: { student: true, supervisor: true },
          });
      // Enrolment is idempotent on its own side, but skip it for a student
      // profile that already existed so a repeat signup cannot disturb a
      // subscription already in flight.
      if (!existing.student) await this.defaultEnrolment.enrol(user.id);
      return user;
    }

    await this.assertMobileFree(mobile);
    const user = await this.prisma.user.create({
      data: { mobileE164: mobile, name, role: 'student', whatsappOptInAt, student: { create: {} } },
      include: { student: true },
    });
    // FRE-009 — a new student lands on the default package immediately rather
    // than in the no-subscription state, so every entitlement check downstream
    // has a package to read and "free" is a tier with admin-set limits rather
    // than an absence. Non-fatal by design (see DefaultEnrolmentService).
    await this.defaultEnrolment.enrol(user.id);
    return user;
  }


  async createSupervisor(mobile: string, name: string, type: 'parent' | 'instructor', whatsappOptInAt?: Date) {
    const existing = await this.findCombinable(mobile, 'supervisor');
    if (existing) {
      // Already a supervisor: return as-is. The `type` is deliberately not
      // overwritten — a parent who signs up again does not become an
      // instructor because a form defaulted to it.
      if (existing.supervisor) return existing;
      return this.prisma.user.update({
        where: { id: existing.id },
        data: { supervisor: { create: { type } }, ...(whatsappOptInAt ? { whatsappOptInAt } : {}) },
        include: { student: true, supervisor: true },
      });
    }

    await this.assertMobileFree(mobile);
    return this.prisma.user.create({
      data: { mobileE164: mobile, name, role: 'supervisor', whatsappOptInAt, supervisor: { create: { type } } },
      include: { supervisor: true },
    });
  }

  /**
   * AUTH-030 — the account on this number, if it may take on `role`.
   *
   * Null means there is no account at all and the caller should create one.
   * A staff account throws here instead: admin and school logins are granted
   * by us and must never be reachable by proving control of a phone number.
   */
  private async findCombinable(mobile: string, role: SelfServiceRole) {
    const existing = await this.prisma.user.findUnique({
      where: { mobileE164: mobile },
      include: { student: true, supervisor: true },
    });
    if (!existing) return null;
    const verdict = canAddRole(existing, role);
    if (!verdict.ok) throw new BadRequestException(verdict.reasonAr);
    return existing;
  }

  /**
   * NOT-012 — set the email channel for any user (student or supervisor).
   * Clearing the address also switches the channel off, so we can never be
   * left "enabled" with nowhere to send.
   */
  async setEmailPrefs(userId: string, dto: { notificationEmail?: string | null; emailNotificationsEnabled?: boolean }) {
    const clearing = dto.notificationEmail === null || dto.notificationEmail === '';
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.notificationEmail !== undefined ? { notificationEmail: clearing ? null : dto.notificationEmail } : {}),
        ...(clearing
          ? { emailNotificationsEnabled: false }
          : dto.emailNotificationsEnabled !== undefined
            ? { emailNotificationsEnabled: dto.emailNotificationsEnabled }
            : {}),
      },
      select: { notificationEmail: true, emailNotificationsEnabled: true },
    });
    // Enabling without an address on file is the other half of the same
    // invariant — reject rather than silently store an unusable setting.
    if (user.emailNotificationsEnabled && !user.notificationEmail) {
      await this.prisma.user.update({ where: { id: userId }, data: { emailNotificationsEnabled: false } });
      throw new BadRequestException('add an email address before switching email notifications on');
    }
    return user;
  }

  /** ADM-086 — admin edits a student's or supervisor's contact details. */
  async adminUpdateAccount(userId: string, dto: { name?: string; mobile?: string; notificationEmail?: string | null }) {
    if (dto.mobile) {
      const clash = await this.prisma.user.findUnique({ where: { mobileE164: dto.mobile } });
      if (clash && clash.id !== userId) throw new BadRequestException('this mobile number is already registered');
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.mobile ? { mobileE164: dto.mobile } : {}),
        ...(dto.notificationEmail !== undefined
          ? { notificationEmail: dto.notificationEmail || null, ...(dto.notificationEmail ? {} : { emailNotificationsEnabled: false }) }
          : {}),
      },
      select: { id: true, name: true, mobileE164: true, notificationEmail: true, emailNotificationsEnabled: true, status: true, suspendedAt: true },
    });
  }

  private async assertMobileFree(mobile: string) {
    const existing = await this.prisma.user.findUnique({ where: { mobileE164: mobile } });
    if (existing) throw new BadRequestException('this mobile number is already registered');
  }
}
