import { Module } from '@nestjs/common';
import { notificationChannelProvider } from './notification-channel.provider';
import { EmailChannel } from './email-channel';

// Split out so both AuthModule (OTP) and NotificationsModule can depend on
// the channel without a circular import between them.
@Module({
  providers: [notificationChannelProvider, EmailChannel],
  exports: [notificationChannelProvider, EmailChannel],
})
export class NotificationChannelModule {}
