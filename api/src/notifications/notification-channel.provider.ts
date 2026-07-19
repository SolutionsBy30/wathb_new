import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NOTIFICATION_CHANNEL } from './channel.interface';
import { ConsoleChannel } from './console-channel';
import { WhatsAppCloudChannel } from './whatsapp-cloud-channel';

export const notificationChannelProvider: Provider = {
  provide: NOTIFICATION_CHANNEL,
  useFactory: (config: ConfigService) => {
    const hasCredentials = !!config.get('WHATSAPP_ACCESS_TOKEN') && !!config.get('WHATSAPP_PHONE_NUMBER_ID');
    return hasCredentials ? new WhatsAppCloudChannel(config) : new ConsoleChannel();
  },
  inject: [ConfigService],
};
