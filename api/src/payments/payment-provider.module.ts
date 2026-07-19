import { Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PAYMENT_PROVIDER } from './payment-provider.interface';
import { ConsolePaymentProvider } from './console-payment-provider';
import { PaymobProvider } from './paymob-provider';

const paymentProviderFactory: Provider = {
  provide: PAYMENT_PROVIDER,
  useFactory: (config: ConfigService) => {
    const hasCredentials = !!config.get('PAYMOB_SECRET_KEY') && !!config.get('PAYMOB_PUBLIC_KEY') && !!config.get('PAYMOB_INTEGRATION_ID');
    return hasCredentials ? new PaymobProvider(config) : new ConsolePaymentProvider(config);
  },
  inject: [ConfigService],
};

@Module({
  providers: [paymentProviderFactory],
  exports: [paymentProviderFactory],
})
export class PaymentProviderModule {}
