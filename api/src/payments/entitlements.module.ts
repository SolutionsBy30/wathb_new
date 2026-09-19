import { Module } from '@nestjs/common';
import { EntitlementsService } from './entitlements.service';

/**
 * PAY-013 — split into its own module, like NotificationChannelModule, so
 * every consumer (people, reports, wathb, notifications, simulation) can ask
 * what a student is entitled to without importing PaymentsModule and creating
 * an import cycle back through checkout.
 */
@Module({
  providers: [EntitlementsService],
  exports: [EntitlementsService],
})
export class EntitlementsModule {}
