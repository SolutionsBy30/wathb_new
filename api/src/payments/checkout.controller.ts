import { Body, Controller, ForbiddenException, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { CheckoutService } from './checkout.service';
import { RequireSession, SessionGuard } from '../auth/session.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionPayload } from '../auth/auth.types';
import { StartCheckoutDto, StartCheckoutForStudentDto, ActivateWireTransferDto } from './dto/packages.dto';

@Controller()
export class CheckoutController {
  constructor(private checkout: CheckoutService) {}

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
