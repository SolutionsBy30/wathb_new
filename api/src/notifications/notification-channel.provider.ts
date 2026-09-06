import { Logger, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NOTIFICATION_CHANNEL } from './channel.interface';
import { ConsoleChannel } from './console-channel';
import { RoutingChannel } from './routing-channel';
import { ProviderSettingsService } from './provider-settings.service';
import { resolveWhatsAppProvider } from './whatsapp-provider.util';

/**
 * NOT-013/NOT-023 — which transport sends.
 *
 * The senders now live in the database (primary + backup, see
 * ProviderSettingsService), so this resolves to RoutingChannel, which picks
 * between them per send and falls back when one is down. The primary row is
 * seeded from .env on first read, so an existing deployment keeps sending with
 * exactly the configuration it already had.
 *
 * ConsoleChannel remains the stand-in when the env resolves to no provider at
 * all — a developer running locally must not start messaging real students
 * from a copy of production, and the OTP boot guard reads the same helper.
 */
export const notificationChannelProvider: Provider = {
  provide: NOTIFICATION_CHANNEL,
  useFactory: (config: ConfigService, settings: ProviderSettingsService) => {
    const logger = new Logger('NotificationChannel');
    const envProvider = resolveWhatsAppProvider(process.env);
    if (envProvider === 'none') {
      logger.log('WhatsApp provider: none — using the console stand-in');
      return new ConsoleChannel();
    }
    logger.log(`WhatsApp provider: ${envProvider} (routed, with backup failover)`);
    return new RoutingChannel(settings);
  },
  inject: [ConfigService, ProviderSettingsService],
};
