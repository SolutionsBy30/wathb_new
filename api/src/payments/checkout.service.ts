import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_PROVIDER, PaymentProvider } from './payment-provider.interface';
import { AuditLogService } from '../admin-ops/audit-log.service';
import { MagicLinkService } from '../auth/magic-link.service';

@Injectable()
export class CheckoutService {
  constructor(
    private prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private provider: PaymentProvider,
    private config: ConfigService,
    private auditLog: AuditLogService,
    private magicLinks: MagicLinkService,
  ) {}

  /** True only when no real Paymob credentials are configured — see payment-provider.module.ts's identical check. */
  isDevProviderActive(): boolean {
    return !(this.config.get('PAYMOB_SECRET_KEY') && this.config.get('PAYMOB_PUBLIC_KEY') && this.config.get('PAYMOB_INTEGRATION_ID'));
  }

  /**
   * SUP-008 — payer is optional and defaults to the student paying for
   * themself (the original, still-supported path). When a supervisor pays
   * on behalf of a linked student, the checkout provider gets the payer's
   * own name/mobile (they're the one completing the transaction and
   * receiving the receipt), while the subscription itself is still the
   * student's — payerId/payerType record who actually paid.
   */
  async startCheckout(studentId: string, packageId: string, payer?: { id: string; type: 'supervisor' }) {
    const pkg = await this.prisma.package.findUnique({ where: { id: packageId } });
    if (!pkg || !pkg.isActive) throw new NotFoundException('package not found or inactive');

    const student = await this.prisma.student.findUniqueOrThrow({ where: { userId: studentId }, include: { user: true } });
    const payerUser = payer ? await this.prisma.user.findUniqueOrThrow({ where: { id: payer.id } }) : student.user;
    if (!payerUser.mobileE164) throw new BadRequestException('no mobile number on file');

    // Price snapshot at purchase time — spec §4.5: a later price change must
    // never touch this subscription once it's paid for.
    const subscription = await this.prisma.subscription.create({
      data: {
        studentId,
        packageId,
        priceSnapshotHalalas: pkg.priceHalalas,
        status: 'pending',
        payerId: payer?.id,
        payerType: payer?.type,
      },
    });

    const studentAppUrl = this.config.get<string>('STUDENT_APP_URL', 'http://localhost:5173/wathb');
    const { checkoutUrl, providerRef } = await this.provider.createCheckout({
      amountHalalas: pkg.priceHalalas,
      currency: 'SAR',
      merchantOrderId: subscription.id,
      customerName: payerUser.name,
      customerMobile: payerUser.mobileE164,
      successRedirectUrl: `${studentAppUrl}/#subscription=success`,
    });

    await this.prisma.subscription.update({ where: { id: subscription.id }, data: { paymentRef: providerRef } });
    return { subscriptionId: subscription.id, checkoutUrl };
  }

  /**
   * SUP-008 — the supervisor-facing entry point. Requires an accepted,
   * non-revoked link to the student (the same trust boundary that gates
   * every other supervisor-to-student action in this app), so a
   * supervisor can only ever pay for a student who has actually accepted
   * their invite, never an arbitrary studentId.
   */
  async startCheckoutForLinkedStudent(supervisorId: string, studentId: string, packageId: string) {
    const link = await this.prisma.studentSupervisor.findUnique({
      where: { studentId_supervisorId: { studentId, supervisorId } },
    });
    if (!link || !link.acceptedAt || link.revokedAt) {
      throw new BadRequestException('no accepted supervisor link to this student');
    }
    return this.startCheckout(studentId, packageId, { id: supervisorId, type: 'supervisor' });
  }

  /** Idempotent — a webhook or dev-complete hit twice must not double-extend the subscription. */
  async confirmPayment(subscriptionId: string) {
    const subscription = await this.prisma.subscription.findUnique({ where: { id: subscriptionId }, include: { package: true } });
    if (!subscription) throw new NotFoundException('subscription not found');
    if (subscription.status === 'active') return subscription; // already confirmed

    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    endsAt.setUTCMonth(endsAt.getUTCMonth() + subscription.package.durationMonths);

    return this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'active', startsAt, endsAt },
    });
  }

  async myLatestSubscription(studentId: string) {
    return this.prisma.subscription.findFirst({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      include: { package: true },
    });
  }

  /**
   * Manual activation path for when Paymob isn't configured yet (or a
   * student simply paid by bank transfer instead of card) — an admin
   * confirms the transfer happened and activates the subscription directly.
   * Not gated on isDevProviderActive(): a real production deployment may
   * still want the ability to honour an offline wire transfer alongside a
   * configured gateway.
   */
  async activateViaWireTransfer(studentId: string, packageId: string, adminUserId: string) {
    const pkg = await this.prisma.package.findUnique({ where: { id: packageId } });
    if (!pkg || !pkg.isActive) throw new NotFoundException('package not found or inactive');
    await this.prisma.student.findUniqueOrThrow({ where: { userId: studentId } });

    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    endsAt.setUTCMonth(endsAt.getUTCMonth() + pkg.durationMonths);

    const subscription = await this.prisma.subscription.create({
      data: {
        studentId,
        packageId,
        priceSnapshotHalalas: pkg.priceHalalas,
        status: 'active',
        startsAt,
        endsAt,
        paymentRef: `wire_transfer:${adminUserId}`,
      },
      include: { package: true },
    });

    // ADM-073 — every manual activation is written to the audit log with
    // the acting administrator, the amount, and the reference.
    const admin = await this.prisma.user.findUnique({ where: { id: adminUserId }, select: { name: true, email: true } });
    await this.auditLog.record({
      actorId: adminUserId,
      actorLabel: admin?.email ?? admin?.name ?? adminUserId,
      action: 'subscription.activate_wire_transfer',
      entityType: 'Subscription',
      entityId: subscription.id,
      after: { studentId, packageId, priceSnapshotHalalas: pkg.priceHalalas, paymentRef: subscription.paymentRef },
      note: `wire transfer activation for student ${studentId}`,
    });

    return subscription;
  }

  /**
   * NOT-005 — magic links are revoked on subscription expiry, not just on
   * suspension (ADM-085). Access itself is already gated at read-time
   * (isSubscriptionCovering checks endsAt), so this only affects any
   * already-minted, not-yet-used link (e.g. a weekly report sent shortly
   * before expiry) — those should stop working the moment the subscription
   * actually lapses, not linger for their own 24h TTL.
   * No real cron in this sandbox — admin-triggered like plan_day/send_notification.
   */
  async sweepExpiredSubscriptions(now: Date = new Date()) {
    const expired = await this.prisma.subscription.findMany({
      where: { status: 'active', endsAt: { lt: now } },
      select: { id: true, studentId: true },
    });
    for (const sub of expired) {
      await this.prisma.subscription.update({ where: { id: sub.id }, data: { status: 'expired' } });
      await this.magicLinks.revokeAllForSubject(sub.studentId);
    }
    return { expired: expired.length };
  }
}
