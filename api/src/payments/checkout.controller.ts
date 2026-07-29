import { Body, Controller, ForbiddenException, Get, Logger, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { CheckoutService } from './checkout.service';
import { computePaymobHmac } from './paymob-hmac.util';
import { RequireSession, RequireStepUp, SessionGuard } from '../auth/session.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionPayload } from '../auth/auth.types';
import { StartCheckoutDto, StartCheckoutForStudentDto, ActivateWireTransferDto } from './dto/packages.dto';

@Controller()
export class CheckoutController {
  private readonly logger = new Logger(CheckoutController.name);

  constructor(
    private checkout: CheckoutService,
    private config: ConfigService,
  ) {}

  /**
   * Paymob's Transaction Response Callback — the payer's browser lands here
   * after the hosted checkout, with the transaction outcome as query params.
   * Confirms the subscription synchronously (see
   * CheckoutService.handleGatewayReturn) so activation doesn't depend on the
   * async webhook arriving, then bounces the payer on to their app.
   *
   * The HMAC check matters here even more than on the webhook: this URL is
   * in the payer's browser history, so without it anyone could replay it
   * with success=true and a guessed subscription id. Invalid/missing HMAC
   * (when a secret is configured) downgrades the outcome to failed rather
   * than 400ing — the payer mid-redirect should always land somewhere sane.
   */
  @Get('checkout/return')
  async gatewayReturn(@Query() query: Record<string, string>, @Res() res: Response) {
    const secret = this.config.get<string>('PAYMOB_HMAC_SECRET');
    let effectiveQuery = query;
    if (secret) {
      const expected = computePaymobHmac(query, secret);
      if (query['hmac'] !== expected) {
        this.logger.warn(`gateway return with bad/missing hmac for ref=${query['merchant_order_id'] ?? 'none'} — treating as failed`);
        effectiveQuery = { ...query, success: 'false' };
      }
    } else {
      this.logger.warn('PAYMOB_HMAC_SECRET not set — gateway return accepted unverified (dev only, never production)');
    }
    const { redirectUrl } = await this.checkout.handleGatewayReturn(effectiveQuery);
    res.redirect(302, redirectUrl);
  }

  @UseGuards(SessionGuard)
  @RequireSession('student')
  @Post('checkout/start')
  start(@Body() dto: StartCheckoutDto, @CurrentSession() session: SessionPayload) {
    return this.checkout.startCheckout(session.sub, dto.packageId);
  }

  // SUP-008 — a supervisor pays on behalf of a linked (accepted, not
  // revoked) student. Authorization is enforced in the service, not just
  // the UI, matching every other supervisor-to-student action in this app.
  @UseGuards(SessionGuard)
  @RequireSession('supervisor')
  @Post('checkout/start-for-student')
  startForStudent(@Body() dto: StartCheckoutForStudentDto, @CurrentSession() session: SessionPayload) {
    return this.checkout.startCheckoutForLinkedStudent(session.sub, dto.studentId, dto.packageId);
  }

  @UseGuards(SessionGuard)
  @RequireSession('student')
  @Get('checkout/me')
  mySubscription(@CurrentSession() session: SessionPayload) {
    return this.checkout.myLatestSubscription(session.sub);
  }

  // STU-029 — "viewing payment history" is one of the three sensitive
  // actions requiring step-up auth via a fresh OTP, not just a valid
  // session.
  @UseGuards(SessionGuard)
  @RequireSession('student')
  @RequireStepUp()
  @Get('checkout/me/history')
  myPaymentHistory(@CurrentSession() session: SessionPayload) {
    return this.checkout.myPaymentHistory(session.sub);
  }

  // STU-029 — subscription cancellation, same step-up requirement.
  @UseGuards(SessionGuard)
  @RequireSession('student')
  @RequireStepUp()
  @Post('checkout/me/cancel')
  cancelSubscription(@CurrentSession() session: SessionPayload) {
    return this.checkout.cancelSubscription(session.sub);
  }

  /**
   * Dev-only stand-in for a completed Paymob checkout — see
   * ConsolePaymentProvider. Refuses to run at all once real Paymob
   * credentials are configured, so it can never substitute for a real
   * payment outside local dev.
   */
  @Get('checkout/dev-complete')
  async devComplete(@Query('subscriptionId') subscriptionId: string, @Query('redirect') redirect: string, @Res() res: Response) {
    if (!this.checkout.isDevProviderActive()) {
      throw new ForbiddenException('dev checkout completion is disabled when real payment credentials are configured');
    }
    await this.checkout.confirmPayment(subscriptionId);
    res.redirect(302, redirect);
  }

  // Lets the admin UI decide whether to surface the wire-transfer activation
  // path prominently (gateway not configured) or as a secondary option.
  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @Get('admin/payment-status')
  paymentStatus() {
    return { gatewayConfigured: !this.checkout.isDevProviderActive() };
  }

  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @Post('admin/subscriptions/activate-wire-transfer')
  activateWireTransfer(@Body() dto: ActivateWireTransferDto, @CurrentSession() session: SessionPayload) {
    return this.checkout.activateViaWireTransfer(dto.studentId, dto.packageId, session.sub);
  }

  // NOT-005/NOT-008-style manual trigger standing in for a real cron —
  // same rationale as plan_day/send_notification/refresh-stats.
  @UseGuards(SessionGuard)
  @RequireSession('admin')
  @Post('admin/subscriptions/sweep-expired')
  sweepExpired() {
    return this.checkout.sweepExpiredSubscriptions();
  }
}
