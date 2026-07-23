import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TaxonomyModule } from './taxonomy/taxonomy.module';
import { QuestionsModule } from './questions/questions.module';
import { WathbModule } from './wathb/wathb.module';
import { ReportsModule } from './reports/reports.module';
import { PeopleModule } from './people/people.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { GeographyModule } from './geography/geography.module';
import { AdminOpsModule } from './admin-ops/admin-ops.module';
import { OverviewModule } from './overview/overview.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // NFR-005 — a generous global default (generic abuse protection); the
    // OTP/magic-link/admin-login endpoints override this with much tighter
    // per-endpoint limits via @Throttle (see auth.controller.ts).
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    PrismaModule,
    AuthModule,
    TaxonomyModule,
    QuestionsModule,
    WathbModule,
    ReportsModule,
    PeopleModule,
    NotificationsModule,
    PaymentsModule,
    GeographyModule,
    AdminOpsModule,
    OverviewModule,
  ],
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
