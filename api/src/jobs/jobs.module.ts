import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { WathbModule } from '../wathb/wathb.module';
import { PaymentsModule } from '../payments/payments.module';

// OPS-001 — holds the only clock in the system. Kept in its own module so the
// jobs are registered in exactly one place and can be switched off wholesale
// (SCHEDULER_ENABLED) without touching the services they drive.
@Module({
  imports: [NotificationsModule, WathbModule, PaymentsModule],
  providers: [SchedulerService],
})
export class JobsModule {}
