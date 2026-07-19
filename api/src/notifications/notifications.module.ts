import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { WebhooksController } from './webhooks.controller';
import { NotificationChannelModule } from './notification-channel.module';
import { AuthModule } from '../auth/auth.module';
import { WathbModule } from '../wathb/wathb.module';

@Module({
  imports: [AuthModule, WathbModule, NotificationChannelModule],
  providers: [NotificationsService],
  controllers: [NotificationsController, WebhooksController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
