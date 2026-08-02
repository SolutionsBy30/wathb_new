// Same shape as NotificationChannel: everything above this interface is
// completely ignorant of Paymob. Swapping to Moyasar/Tap/HyperPay (spec
// §9.1 lists all three as viable for KSA) means writing one new class here.

export interface CreateCheckoutParams {
  amountHalalas: number;
  currency: string; // 'SAR'
  /** Our subscription id — carried through as Paymob's merchant/special reference for webhook matching. */
  merchantOrderId: string;
  customerName: string;
  customerMobile: string;
  successRedirectUrl: string;
}

export interface CheckoutResult {
  checkoutUrl: string;
  providerRef: string;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface PaymentProvider {
  createCheckout(params: CreateCheckoutParams): Promise<CheckoutResult>;
  /**
   * Ask the gateway what actually happened to a checkout, by the providerRef
   * returned from createCheckout. Backstop for a webhook/redirect that never
   * arrived: 'paid' flips the subscription active, 'unknown' changes nothing
   * (fail-open toward pending — never activate without positive evidence).
   */
  fetchPaymentStatus(providerRef: string): Promise<'paid' | 'unknown'>;
}
