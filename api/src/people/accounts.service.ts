import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Shared by admin-created accounts (people.controller.ts) and public signup
// (auth.controller.ts) — lives outside AuthModule/PeopleModule so neither has
// to import the other (PeopleModule already imports AuthModule for
// SessionGuard).
@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(private prisma: PrismaService) {}

  // whatsappOptInAt is left null for admin-created accounts (no self-service
  // consent step happened) — only public signup captures it.
  async createStudent(mobile: string, name: string, whatsappOptInAt?: Date) {
    await this.assertMobileFree(mobile);
    const user = await this.prisma.user.create({
      data: { mobileE164: mobile, name, role: 'student', whatsappOptInAt, student: { create: {} } },
      include: { student: true },
    });
    await this.enrolInDefaultPackage(user.id);
    return user;
  }

  /**
   * FRE-009 — a new student lands on the default package immediately rather
   * than in the no-subscription state.
   *
   * That state was the worse of the two: the Wathb loop is gated on an active
   * subscription, so a student who signed up and did nothing else could not
   * take a leap at all, and the free-tier limits (1/day, partial report) had
   * nothing to hang off. Enrolling on creation means the entitlement checks
   * everywhere downstream have a package to read, and "free" becomes a tier
   * with configurable limits rather than an absence.
   *
   * Failure here is deliberately non-fatal: an admin who has not nominated a
   * default, or a transient write error, must not block signup. The student
   * is simply in the old no-subscription state and can pick a package.
   */
  private async enrolInDefaultPackage(studentId: string): Promise<void> {
    try {
      const pkg = await this.prisma.package.findFirst({ where: { isDefault: true, isActive: true } });
      if (!pkg) return;
      const startsAt = new Date();
      const endsAt = new Date(startsAt);
      endsAt.setUTCMonth(endsAt.getUTCMonth() + pkg.durationMonths);
      await this.prisma.subscription.create({
        data: {
          studentId,
          packageId: pkg.id,
          priceSnapshotHalalas: pkg.priceHalalas,
          status: 'active',
          startsAt,
          endsAt,
          paymentRef: 'default_enrolment',
        },
      });
    } catch (e: any) {
      this.logger.error(`default-package enrolment failed for student ${studentId}: ${e?.message ?? e}`);
    }
  }

  async createSupervisor(mobile: string, name: string, type: 'parent' | 'instructor', whatsappOptInAt?: Date) {
    await this.assertMobileFree(mobile);
    return this.prisma.user.create({
      data: { mobileE164: mobile, name, role: 'supervisor', whatsappOptInAt, supervisor: { create: { type } } },
      include: { supervisor: true },
    });
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
