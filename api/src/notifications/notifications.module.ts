import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { WebhooksController } from './webhooks.controller';
import { notificationChannelProvider } from './notification-channel.provider';
import { AuthModule } from '../auth/auth.module';
import { WathbModule } from '../wathb/wathb.module';

@Module({
  imports: [AuthModule, WathbModule],
  providers: [NotificationsService, notificationChannelProvider],
  controllers: [NotificationsController, WebhooksController],
  exports: [NotificationsService],
})
export class NotificationsModule {}
