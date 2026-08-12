import { Logger, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NOTIFICATION_CHANNEL } from './channel.interface';
import { ConsoleChannel } from './console-channel';
import { WhatsAppCloudChannel } from './whatsapp-cloud-channel';
import { WasenderChannel } from './wasender-channel';
import { resolveWhatsAppProvider } from './whatsapp-provider.util';

// NOT-013 — WHATSAPP_PROVIDER picks the transport; see
// whatsapp-provider.util.ts for how it resolves and why the same helper
// guards the OTP fallback. ConsoleChannel remains the safe dev stand-in.
export const notificationChannelProvider: Provider = {
  provide: NOTIFICATION_CHANNEL,
  useFactory: (config: ConfigService) => {
    const logger = new Logger('NotificationChannel');
    const provider = resolveWhatsAppProvider(process.env);
    // Logged at boot so which transport is live is answerable from the logs
    // rather than by re-deriving it from the env file.
    logger.log(`WhatsApp provider: ${provider}`);
    if (provider === 'wasender') return new WasenderChannel(config);
    if (provider === 'meta') return new WhatsAppCloudChannel(config);
    return new ConsoleChannel();
  },
  inject: [ConfigService],
};
