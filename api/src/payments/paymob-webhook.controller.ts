import { BadRequestException, Body, Controller, Logger, Post, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CheckoutService } from './checkout.service';
import { computePaymobHmac } from './paymob-hmac.util';

// Paymob "Transaction Processed Callback" (async server-to-server POST).
// Verification is skipped only when no HMAC secret is configured (dev
// mode), mirroring the WhatsApp webhook's signature check.

@Controller('webhooks/paymob')
export class PaymobWebhookController {
  private readonly logger = new Logger(PaymobWebhookController.name);

  constructor(
    private checkout: CheckoutService,
    private config: ConfigService,
  ) {}

  @Post()
  async receive(@Body() body: any, @Query('hmac') hmac?: string) {
    const transaction = body?.obj ?? body;
    // A payment that succeeds at Paymob but never activates the subscription
    // is invisible without this: the failure is always here, and previously
    // this handler rejected silently from the server's point of view. Logged
    // before any validation so "did the callback even arrive?" is answerable
    // from the logs alone.
    this.logger.log(
      `callback received: ref=${transaction?.order?.merchant_order_id ?? transaction?.special_reference ?? 'none'} ` +
        `success=${transaction?.success} hmacPresent=${!!hmac}`,
    );

    this.verifyHmac(transaction, hmac);

    const subscriptionId = transaction?.order?.merchant_order_id ?? transaction?.special_reference;
    if (!subscriptionId) {
      this.logger.error(`callback has no merchant order reference — payload keys: ${Object.keys(transaction ?? {}).join(',')}`);
      throw new BadRequestException('missing merchant order reference');
    }

    if (transaction?.success === true) {
      await this.checkout.confirmPayment(subscriptionId);
      this.logger.log(`subscription ${subscriptionId} confirmed active`);
    } else {
      this.logger.warn(`callback for ${subscriptionId} reported success=${transaction?.success} — subscription left pending`);
    }
    return { received: true };
  }

  private verifyHmac(transaction: any, hmac?: string) {
    const secret = this.config.get<string>('PAYMOB_HMAC_SECRET');
    if (!secret) return; // dev mode — never the case in production
    if (!hmac) throw new BadRequestException('missing hmac');
    if (computePaymobHmac(transaction, secret) !== hmac) throw new BadRequestException('invalid hmac');
  }
}
