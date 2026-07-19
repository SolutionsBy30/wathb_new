import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreateCheckoutParams, CheckoutResult, PaymentProvider } from './payment-provider.interface';

// Paymob "no-code" integration path — Intention API + hosted Unified
// Checkout page. See https://developers.paymob.com/paymob-docs/integration-paths/no-code
// Requires PAYMOB_SECRET_KEY + PAYMOB_PUBLIC_KEY + PAYMOB_INTEGRATION_ID;
// falls back to ConsolePaymentProvider when unset (see payment-provider.module.ts).
// Field names verified against Paymob's published Intention API docs at
// build time — re-verify before going live, per the same discipline the
// spec asks for on the WhatsApp pricing rules (§7.2).
@Injectable()
export class PaymobProvider implements PaymentProvider {
  private readonly logger = new Logger(PaymobProvider.name);
  private readonly secretKey: string;
  private readonly publicKey: string;
  private readonly integrationId: string;

  constructor(private config: ConfigService) {
    this.secretKey = this.config.getOrThrow<string>('PAYMOB_SECRET_KEY');
    this.publicKey = this.config.getOrThrow<string>('PAYMOB_PUBLIC_KEY');
    this.integrationId = this.config.getOrThrow<string>('PAYMOB_INTEGRATION_ID');
  }

  async createCheckout(params: CreateCheckoutParams): Promise<CheckoutResult> {
    const [firstName, ...rest] = params.customerName.split(' ');
    const res = await fetch('https://accept.paymob.com/v1/intention/', {
      method: 'POST',
      headers: {
        Authorization: `Token ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: params.amountHalalas,
        currency: params.currency,
        payment_methods: [Number(this.integrationId)],
        special_reference: params.merchantOrderId,
        notification_url: `${this.config.get('API_PUBLIC_URL', 'http://localhost:4000/api')}/webhooks/paymob`,
        redirection_url: params.successRedirectUrl,
        billing_data: {
          first_name: firstName || 'Wathb',
          last_name: rest.join(' ') || 'Student',
          phone_number: params.customerMobile,
          email: `${params.customerMobile.replace('+', '')}@wathb.invalid`,
          country: 'SA',
        },
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      this.logger.error(`Paymob intention failed: ${res.status} ${JSON.stringify(json)}`);
      throw new Error(json?.message ?? `Paymob API error ${res.status}`);
    }
    const checkoutUrl = `https://accept.paymob.com/unifiedcheckout/?publicKey=${this.publicKey}&clientSecret=${json.client_secret}`;
    return { checkoutUrl, providerRef: json.id?.toString() ?? params.merchantOrderId };
  }
}
