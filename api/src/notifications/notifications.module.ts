import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { WebhooksController } from './webhooks.controller';
import { WeeklyReportService } from './weekly-report.service';
import { NotificationChannelModule } from './notification-channel.module';
import { AuthModule } from '../auth/auth.module';
import { WathbModule } from '../wathb/wathb.module';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [AuthModule, WathbModule, NotificationChannelModule, ReportsModule],
  providers: [NotificationsService, WeeklyReportService],
  controllers: [NotificationsController, WebhooksController],
  exports: [NotificationsService, WeeklyReportService],
})
export class NotificationsModule {}
