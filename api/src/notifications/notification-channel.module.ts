import { Module } from '@nestjs/common';
import { notificationChannelProvider } from './notification-channel.provider';
import { EmailChannel } from './email-channel';
import { ProviderSettingsService } from './provider-settings.service';

// Split out so both AuthModule (OTP) and NotificationsModule can depend on
// the channel without a circular import between them.
@Module({
  providers: [ProviderSettingsService, notificationChannelProvider, EmailChannel],
  exports: [ProviderSettingsService, notificationChannelProvider, EmailChannel],
})
export class NotificationChannelModule {}
