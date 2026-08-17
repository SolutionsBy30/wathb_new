import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_PROVIDER, PaymentProvider } from './payment-provider.interface';
import { AuditLogService } from '../admin-ops/audit-log.service';
import { MagicLinkService } from '../auth/magic-link.service';
import { DefaultEnrolmentService } from './default-enrolment.service';
import { applyPromoCode, PROMO_REJECTION_AR } from './pricing.util';
import { normaliseCode } from './discount-codes.service';

@Injectable()
export class CheckoutService {
  constructor(
    private prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private provider: PaymentProvider,
    private config: ConfigService,
    private auditLog: AuditLogService,
    private magicLinks: MagicLinkService,
    private defaultEnrolment: DefaultEnrolmentService,
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
  async startCheckout(studentId: string, packageId: string, payer?: { id: string; type: 'supervisor' }, promoCode?: string) {
    const pkg = await this.prisma.package.findUnique({ where: { id: packageId } });
    if (!pkg || !pkg.isActive) throw new NotFoundException('package not found or inactive');

    // PAY-011 — the discount is recomputed here from the stored code, never
    // taken from the client. The preview endpoint exists so the student sees
    // the total before committing; trusting the number it returned would let
    // anyone post their own price.
    let discountCodeId: string | null = null;
    let discountHalalas = 0;
    if (promoCode?.trim()) {
      const code = await this.prisma.discountCode.findUnique({ where: { code: normaliseCode(promoCode) } });
      const applied = applyPromoCode(code as any, packageId, pkg.priceHalalas);
      if (!applied.ok) throw new BadRequestException(PROMO_REJECTION_AR[applied.reason]);
      discountCodeId = code!.id;
      discountHalalas = applied.discountHalalas;
    }
    const payableHalalas = pkg.priceHalalas - discountHalalas;

    const student = await this.prisma.student.findUniqueOrThrow({ where: { userId: studentId }, include: { user: true } });
    const payerUser = payer ? await this.prisma.user.findUniqueOrThrow({ where: { id: payer.id } }) : student.user;
    if (!payerUser.mobileE164) throw new BadRequestException('no mobile number on file');

    // Price snapshot at purchase time — spec §4.5: a later price change must
    // never touch this subscription once it's paid for.
    const subscription = await this.prisma.subscription.create({
      data: {
        studentId,
        packageId,
        // The snapshot is what the student actually pays, so history and any
        // future invoice reconcile against the charge rather than the list
        // price; discountHalalas keeps the "before" recoverable.
        priceSnapshotHalalas: payableHalalas,
        discountCodeId,
        discountHalalas,
        status: 'pending',
        payerId: payer?.id,
        payerType: payer?.type,
      },
    });

    // FRE-001 — a zero-price package has nothing to charge for, so it must
    // never reach the payment gateway (Paymob rejects a 0 amount outright,
    // and even where it didn't, bouncing a student through a card form to
    // pay nothing is wrong). Activate it directly and hand back the same
    // success URL the paid path produces, so callers need no special case.
    if (payableHalalas === 0) {
      await this.confirmPayment(subscription.id);
      return { subscriptionId: subscription.id, checkoutUrl: `${this.appReturnUrl(payer?.type)}/#subscription=success`, free: true };
    }

    // The gateway redirects the payer back through OUR API, not straight to
    // an app: Paymob appends the transaction outcome (+HMAC) as query params
    // to this URL, and handleGatewayReturn() below confirms the subscription
    // from them before bouncing on to the right app. This makes activation
    // work even when the async server-to-server webhook never arrives (the
    // exact failure observed in production — dashboard callback unset or
    // undeliverable), while the webhook remains as reinforcement.
    const apiUrl = this.config.get<string>('API_PUBLIC_URL', 'http://localhost:4000/api');
    const { checkoutUrl, providerRef } = await this.provider.createCheckout({
      amountHalalas: payableHalalas,
      currency: 'SAR',
      merchantOrderId: subscription.id,
      customerName: payerUser.name,
      customerMobile: payerUser.mobileE164,
      successRedirectUrl: `${apiUrl}/checkout/return`,
    });

    await this.prisma.subscription.update({ where: { id: subscription.id }, data: { paymentRef: providerRef } });
    return { subscriptionId: subscription.id, checkoutUrl, free: false };
  }

  /** Which app to land the payer back on — supervisors started from theirs. */
  private appReturnUrl(payerType?: 'supervisor' | 'student' | null): string {
    return payerType === 'supervisor'
      ? this.config.get<string>('SUPERVISOR_APP_URL', 'http://localhost:5175/supervisor')
      : this.config.get<string>('STUDENT_APP_URL', 'http://localhost:5173/wathb');
  }

  /**
   * Paymob's Transaction Response Callback — the GET the payer's browser is
   * redirected through after the hosted checkout. Verifies the outcome and
   * activates the subscription synchronously, then hands back the app URL
   * to bounce the payer to. Idempotent alongside the webhook: whichever
   * lands first activates, the other finds status already 'active'.
   */
  async handleGatewayReturn(query: Record<string, string>): Promise<{ redirectUrl: string }> {
    const subscriptionId = query['merchant_order_id'] || query['special_reference'];
    const succeeded = query['success'] === 'true';

    const subscription = subscriptionId
      ? await this.prisma.subscription.findUnique({ where: { id: subscriptionId } })
      : null;
    // Can't tell whose flow this was without the subscription — default to
    // the student app rather than erroring at the payer mid-redirect.
    const appUrl = this.appReturnUrl(subscription?.payerType ?? undefined);

    if (!subscription || !succeeded) {
      return { redirectUrl: `${appUrl}/#subscription=failed` };
    }
    await this.confirmPayment(subscription.id);
    return { redirectUrl: `${appUrl}/#subscription=success` };
  }

  /**
   * SUP-008 — the supervisor-facing entry point. Requires an accepted,
   * non-revoked link to the student (the same trust boundary that gates
   * every other supervisor-to-student action in this app), so a
   * supervisor can only ever pay for a student who has actually accepted
   * their invite, never an arbitrary studentId.
   */
  async startCheckoutForLinkedStudent(supervisorId: string, studentId: string, packageId: string, promoCode?: string) {
    const link = await this.prisma.studentSupervisor.findUnique({
      where: { studentId_supervisorId: { studentId, supervisorId } },
    });
    if (!link || !link.acceptedAt || link.revokedAt) {
      throw new BadRequestException('no accepted supervisor link to this student');
    }
    return this.startCheckout(studentId, packageId, { id: supervisorId, type: 'supervisor' }, promoCode);
  }

  /** Idempotent — a webhook or dev-complete hit twice must not double-extend the subscription. */
  async confirmPayment(subscriptionId: string) {
    const subscription = await this.prisma.subscription.findUnique({ where: { id: subscriptionId }, include: { package: true } });
    if (!subscription) throw new NotFoundException('subscription not found');
    if (subscription.status === 'active') return subscription; // already confirmed

    const startsAt = new Date();
    const endsAt = new Date(startsAt);
    endsAt.setUTCMonth(endsAt.getUTCMonth() + subscription.package.durationMonths);

    // PAY-011 — count the redemption only once the money is actually in.
    // Counting at checkout-start would let an abandoned card form burn a
    // limited code, and the early return above (status already 'active')
    // keeps this idempotent when the gateway return and the webhook both
    // land.
    if (subscription.discountCodeId) {
      await this.prisma.discountCode.update({
        where: { id: subscription.discountCodeId },
        data: { timesRedeemed: { increment: 1 } },
      });
    }

    return this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { status: 'active', startsAt, endsAt },
    });
  }

  async myLatestSubscription(studentId: string) {
    const latest = await this.prisma.subscription.findFirst({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      include: { package: true },
    });
    // Self-healing for the "paid at the gateway but still pending here"
    // case: when neither the webhook nor the redirect-return delivered the
    // confirmation (both observed failing in production), ask the gateway
    // directly the next time the student's app loads their subscription.
    // Only positive evidence ('paid') activates; 'unknown' leaves pending.
    if (latest?.status === 'pending' && latest.paymentRef && !latest.paymentRef.startsWith('console-') && !latest.paymentRef.startsWith('wire_transfer:')) {
      const status = await this.provider.fetchPaymentStatus(latest.paymentRef);
      if (status === 'paid') {
        await this.confirmPayment(latest.id);
        return this.prisma.subscription.findUniqueOrThrow({ where: { id: latest.id }, include: { package: true } });
      }
    }
    return latest;
  }

  /**
   * STU-029/STU-025 — "viewing payment history" behind step-up auth. There's
   * no separate Invoice/Payment model (see gap-analysis §4) — every purchase
   * or renewal is its own Subscription row already carrying what a payment
   * history needs: price paid at the time (priceSnapshotHalalas, immune to
   * later package price changes), status, and dates.
   */
  async myPaymentHistory(studentId: string) {
    return this.prisma.subscription.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      include: { package: true },
    });
  }

  /**
   * STU-029 — subscription cancellation is one of the three sensitive
   * actions requiring step-up auth. Cancelling stops the subscription from
   * covering access immediately (mirrors sweepExpiredSubscriptions' revoke
   * of any live magic links) rather than just marking status and leaving
   * endsAt/access untouched until the period would have lapsed anyway —
   * "cancel" should mean cancel, not "stop auto-renewing".
   */
  async cancelSubscription(studentId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { studentId, status: 'active' },
      orderBy: { createdAt: 'desc' },
    });
    if (!subscription) throw new NotFoundException('no active subscription to cancel');
    const cancelled = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: 'cancelled', endsAt: new Date() },
    });
    await this.magicLinks.revokeAllForSubject(studentId);
    return cancelled;
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
    let downgraded = 0;
    for (const sub of expired) {
      await this.prisma.subscription.update({ where: { id: sub.id }, data: { status: 'expired' } });
      await this.magicLinks.revokeAllForSubject(sub.studentId);
      // FRE-010 — a lapsed paid plan drops to the free tier rather than to
      // nothing. Without this the admin's free-account settings only ever
      // applied to brand-new signups, and an expired student was locked out
      // of the product completely instead of falling back to the limited
      // plan the admin configured. No-ops when no default is nominated, so
      // the old hard-stop behaviour is still one un-nominated flag away.
      if (await this.defaultEnrolment.enrol(sub.studentId)) downgraded += 1;
    }
    return { expired: expired.length, downgradedToDefault: downgraded };
  }
}
