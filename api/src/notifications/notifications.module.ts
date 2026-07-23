import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { WebhooksController } from './webhooks.controller';
import { WeeklyReportService } from './weekly-report.service';
import { CampaignService } from './campaign.service';
import { NotificationChannelModule } from './notification-channel.module';
import { AuthModule } from '../auth/auth.module';
import { WathbModule } from '../wathb/wathb.module';
import { ReportsModule } from '../reports/reports.module';
import { AuditLogModule } from '../admin-ops/audit-log.module';

@Module({
  imports: [AuthModule, WathbModule, NotificationChannelModule, ReportsModule, AuditLogModule],
  providers: [NotificationsService, WeeklyReportService, CampaignService],
  controllers: [NotificationsController, WebhooksController],
  exports: [NotificationsService, WeeklyReportService, CampaignService],
})
export class NotificationsModule {}
