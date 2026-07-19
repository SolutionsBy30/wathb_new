import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PAYMENT_PROVIDER, PaymentProvider } from './payment-provider.interface';

@Injectable()
export class CheckoutService {
  constructor(
    private prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER) private provider: PaymentProvider,
    private config: ConfigService,
  ) {}

  /** True only when no real Paymob credentials are configured — see payment-provider.module.ts's identical check. */
  isDevProviderActive(): boolean {
    return !(this.config.get('PAYMOB_SECRET_KEY') && this.config.get('PAYMOB_PUBLIC_KEY') && this.config.get('PAYMOB_INTEGRATION_ID'));
  }

  async startCheckout(studentId: string, packageId: string) {
    const pkg = await this.prisma.package.findUnique({ where: { id: packageId } });
    if (!pkg || !pkg.isActive) throw new NotFoundException('package not found or inactive');

    const student = await this.prisma.student.findUniqueOrThrow({ where: { userId: studentId }, include: { user: true } });
    if (!student.user.mobileE164) throw new BadRequestException('no mobile number on file');

    // Price snapshot at purchase time — spec §4.5: a later price change must
    // never touch this subscription once it's paid for.
    const subscription = await this.prisma.subscription.create({
      data: { studentId, packageId, priceSnapshotHalalas: pkg.priceHalalas, status: 'pending' },
    });

    const studentAppUrl = this.config.get<string>('STUDENT_APP_URL', 'http://localhost:5173/wathb');
    const { checkoutUrl, providerRef } = await this.provider.createCheckout({
      amountHalalas: pkg.priceHalalas,
      currency: 'SAR',
      merchantOrderId: subscription.id,
      customerName: student.user.name,
      customerMobile: student.user.mobileE164,
      successRedirectUrl: `${studentAppUrl}/#subscription=success`,
    });

    await this.prisma.subscription.update({ where: { id: subscription.id }, data: { paymentRef: providerRef } });
    return { subscriptionId: subscription.id, checkoutUrl };
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
}
