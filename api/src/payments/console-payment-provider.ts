import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { CreateCheckoutParams, CheckoutResult, PaymentProvider } from './payment-provider.interface';

/**
 * Default provider when no Paymob credentials are configured. Instead of a
 * real hosted checkout page, the "checkout URL" points back at our own API's
 * dev-complete endpoint — visiting it instantly marks the subscription paid
 * and redirects onward, so the whole checkout UX (redirect out, come back,
 * subscription active) is testable without a payment gateway. That endpoint
 * refuses to run at all once real Paymob credentials are configured (see
 * checkout.controller.ts), so this can't leak into a real deployment.
 */
@Injectable()
export class ConsolePaymentProvider implements PaymentProvider {
  private readonly logger = new Logger('ConsolePaymentProvider(Paymob stand-in)');

  constructor(private config: ConfigService) {}

  async createCheckout(params: CreateCheckoutParams): Promise<CheckoutResult> {
    const providerRef = `console-${randomUUID()}`;
    const apiUrl = this.config.get<string>('API_PUBLIC_URL', 'http://localhost:4000/api');
    const checkoutUrl = `${apiUrl}/checkout/dev-complete?subscriptionId=${params.merchantOrderId}&redirect=${encodeURIComponent(params.successRedirectUrl)}`;
    this.logger.log(
      `[checkout] order=${params.merchantOrderId} amount=${params.amountHalalas / 100} ${params.currency} customer=${params.customerName} url=${checkoutUrl}`,
    );
    return { checkoutUrl, providerRef };
  }
}
