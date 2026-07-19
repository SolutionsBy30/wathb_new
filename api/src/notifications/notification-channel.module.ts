import { Module } from '@nestjs/common';
import { notificationChannelProvider } from './notification-channel.provider';

// Split out so both AuthModule (OTP) and NotificationsModule can depend on
// the channel without a circular import between them.
@Module({
  providers: [notificationChannelProvider],
  exports: [notificationChannelProvider],
})
export class NotificationChannelModule {}
