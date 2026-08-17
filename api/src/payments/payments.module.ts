import { Module } from '@nestjs/common';
import { PackagesService } from './packages.service';
import { PackagesController } from './packages.controller';
import { CheckoutService } from './checkout.service';
import { DiscountCodesService } from './discount-codes.service';
import { CheckoutController } from './checkout.controller';
import { PaymobWebhookController } from './paymob-webhook.controller';
import { PaymentProviderModule } from './payment-provider.module';
import { AuthModule } from '../auth/auth.module';
import { AuditLogModule } from '../admin-ops/audit-log.module';
import { DefaultEnrolmentModule } from './default-enrolment.module';

@Module({
  imports: [AuthModule, PaymentProviderModule, AuditLogModule, DefaultEnrolmentModule],
  providers: [PackagesService, CheckoutService, DiscountCodesService],
  controllers: [PackagesController, CheckoutController, PaymobWebhookController],
  exports: [CheckoutService],
})
export class PaymentsModule {}
