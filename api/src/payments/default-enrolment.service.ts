import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * FRE-009 / FRE-010 — the free tier is a real package flagged `isDefault`,
 * not an absence of one. Every entitlement check downstream (daily leap cap,
 * report visibility, weekly report, supervisor linking, daily notification)
 * reads the package on the student's active subscription, so a student with
 * no subscription at all has nothing to read and is simply blocked. Enrolling
 * non-subscribers into the default package is what makes "what non-paying
 * users get" an admin setting rather than a constant in the code.
 *
 * Shared by signup (AccountsService) and by the nightly expiry sweep
 * (CheckoutService), which is why it lives in its own module rather than in
 * either caller: both need it and neither should own it.
 */
@Injectable()
export class DefaultEnrolmentService {
  private readonly logger = new Logger(DefaultEnrolmentService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Enrol a student into the nominated default package.
   *
   * No-ops when no default is nominated, or when the student already has an
   * active subscription — this must never displace a package someone paid
   * for. Failure is deliberately non-fatal: an admin who has not nominated a
   * default must not block signup, and a bad row must not abort the sweep.
   * Returns the subscription when one was created, otherwise null.
   */
  async enrol(studentId: string) {
    try {
      const pkg = await this.prisma.package.findFirst({ where: { isDefault: true, isActive: true } });
      if (!pkg) return null;

      const alreadyActive = await this.prisma.subscription.findFirst({ where: { studentId, status: 'active' } });
      if (alreadyActive) return null;

      const startsAt = new Date();
      // A free tier that quietly switches off after durationMonths would lock
      // the student out of the product entirely — the opposite of what a free
      // plan is for. Zero-price defaults are open-ended (endsAt null, which
      // isSubscriptionCovering treats as no expiry and sweepExpired's
      // `endsAt < now` never matches). A priced default still expires, since
      // that is a trial and expiring is the point.
      const endsAt = pkg.priceHalalas === 0 ? null : (() => {
        const d = new Date(startsAt);
        d.setUTCMonth(d.getUTCMonth() + pkg.durationMonths);
        return d;
      })();

      return await this.prisma.subscription.create({
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
      return null;
    }
  }
}
