import { Module } from '@nestjs/common';
import { PackagesService } from './packages.service';
import { PackagesController } from './packages.controller';
import { CheckoutService } from './checkout.service';
import { CheckoutController } from './checkout.controller';
import { PaymobWebhookController } from './paymob-webhook.controller';
import { PaymentProviderModule } from './payment-provider.module';
import { AuthModule } from '../auth/auth.module';
import { AuditLogModule } from '../admin-ops/audit-log.module';

@Module({
  imports: [AuthModule, PaymentProviderModule, AuditLogModule],
  providers: [PackagesService, CheckoutService],
  controllers: [PackagesController, CheckoutController, PaymobWebhookController],
  exports: [CheckoutService],
})
export class PaymentsModule {}
