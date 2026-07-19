import { BadRequestException, Body, Controller, Post, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { CheckoutService } from './checkout.service';

// Paymob "Transaction Processed Callback". Field order for the HMAC is
// fixed by Paymob's docs — do not reorder. Verification is skipped only
// when no HMAC secret is configured (dev mode), mirroring the WhatsApp
// webhook's signature check.
const HMAC_FIELDS = [
  'amount_cents', 'created_at', 'currency', 'error_occured', 'has_parent_transaction', 'id',
  'integration_id', 'is_3d_secure', 'is_auth', 'is_capture', 'is_refunded', 'is_standalone_payment',
  'is_voided', 'order.id', 'owner', 'pending', 'source_data.pan', 'source_data.sub_type',
  'source_data.type', 'success',
];

function getPath(obj: any, path: string) {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}

@Controller('webhooks/paymob')
export class PaymobWebhookController {
  constructor(
    private checkout: CheckoutService,
    private config: ConfigService,
  ) {}

  @Post()
  async receive(@Body() body: any, @Query('hmac') hmac?: string) {
    const transaction = body?.obj ?? body;
    this.verifyHmac(transaction, hmac);

    const subscriptionId = transaction?.order?.merchant_order_id ?? transaction?.special_reference;
    if (!subscriptionId) throw new BadRequestException('missing merchant order reference');

    if (transaction?.success === true) {
      await this.checkout.confirmPayment(subscriptionId);
    }
    return { received: true };
  }

  private verifyHmac(transaction: any, hmac?: string) {
    const secret = this.config.get<string>('PAYMOB_HMAC_SECRET');
    if (!secret) return; // dev mode — never the case in production
    if (!hmac) throw new BadRequestException('missing hmac');
    const concatenated = HMAC_FIELDS.map((f) => String(getPath(transaction, f) ?? '')).join('');
    const expected = createHmac('sha512', secret).update(concatenated).digest('hex');
    if (expected !== hmac) throw new BadRequestException('invalid hmac');
  }
}
