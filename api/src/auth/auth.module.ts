import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { MagicLinkService } from './magic-link.service';
import { OtpService } from './otp.service';
import { SessionGuard } from './session.guard';
import { NotificationChannelModule } from '../notifications/notification-channel.module';
import { AccountsModule } from '../people/accounts.module';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'dev-secret-change-me'),
      }),
    }),
    NotificationChannelModule,
    AccountsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, MagicLinkService, OtpService, SessionGuard],
  exports: [AuthService, MagicLinkService, SessionGuard],
})
export class AuthModule {}
