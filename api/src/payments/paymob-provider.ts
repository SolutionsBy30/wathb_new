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
//
// Paymob runs a separate instance per market (KSA, Egypt, UAE, Pakistan) and
// credentials are scoped to exactly one of them — a Saudi merchant account
// authenticating against the Egyptian host gets a 401 whose body reads
// "Authentication credentials were not provided", which looks like a missing
// key rather than a wrong host. This defaults to KSA because everything else
// about this product is Saudi-only: prices are SAR, mobiles are +966, and
// billing_data below hardcodes country 'SA'. Override for another market.
const DEFAULT_PAYMOB_BASE_URL = 'https://ksa.paymob.com';

@Injectable()
export class PaymobProvider implements PaymentProvider {
  private readonly logger = new Logger(PaymobProvider.name);
  private readonly secretKey: string;
  private readonly publicKey: string;
  private readonly integrationId: string;
  private readonly baseUrl: string;

  constructor(private config: ConfigService) {
    this.secretKey = this.config.getOrThrow<string>('PAYMOB_SECRET_KEY');
    this.publicKey = this.config.getOrThrow<string>('PAYMOB_PUBLIC_KEY');
    this.integrationId = this.config.getOrThrow<string>('PAYMOB_INTEGRATION_ID');
    // Trailing slashes are stripped so the URLs below can't end up doubled.
    this.baseUrl = this.config.get<string>('PAYMOB_BASE_URL', DEFAULT_PAYMOB_BASE_URL).replace(/\/+$/, '');
  }

  async createCheckout(params: CreateCheckoutParams): Promise<CheckoutResult> {
    const [firstName, ...rest] = params.customerName.split(' ');
    const res = await fetch(`${this.baseUrl}/v1/intention/`, {
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
    const checkoutUrl = `${this.baseUrl}/unifiedcheckout/?publicKey=${this.publicKey}&clientSecret=${json.client_secret}`;
    return { checkoutUrl, providerRef: json.id?.toString() ?? params.merchantOrderId };
  }

  /**
   * Retrieve the intention we created and look for hard evidence of a
   * successful payment. Deliberately tolerant about the response shape
   * (Paymob's intention payload nests transactions differently across
   * markets/versions): any object anywhere in the tree with success===true
   * and pending===false counts, as does a top-level PAID payment status.
   * Anything else — including transport errors — is 'unknown', which the
   * caller treats as "leave it pending".
   */
  async fetchPaymentStatus(providerRef: string): Promise<'paid' | 'unknown'> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/intention/${providerRef}`, {
        headers: { Authorization: `Token ${this.secretKey}` },
      });
      const json = await res.json();
      if (!res.ok) {
        this.logger.warn(`intention lookup failed: ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
        return 'unknown';
      }
      const paidStatus = String(json?.payment_status ?? json?.status ?? '').toUpperCase();
      if (paidStatus === 'PAID' || paidStatus === 'SUCCESS') return 'paid';
      const hasSuccessfulTxn = (node: unknown): boolean => {
        if (Array.isArray(node)) return node.some(hasSuccessfulTxn);
        if (node && typeof node === 'object') {
          const o = node as Record<string, unknown>;
          if (o['success'] === true && o['pending'] !== true) return true;
          return Object.values(o).some((v) => (Array.isArray(v) || (v && typeof v === 'object')) && hasSuccessfulTxn(v));
        }
        return false;
      };
      if (hasSuccessfulTxn(json)) return 'paid';
      this.logger.log(`intention ${providerRef} shows no successful transaction yet (payment_status=${paidStatus || 'n/a'})`);
      return 'unknown';
    } catch (e: any) {
      this.logger.warn(`intention lookup error: ${e?.message ?? e}`);
      return 'unknown';
    }
  }
}
