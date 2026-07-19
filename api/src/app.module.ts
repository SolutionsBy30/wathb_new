import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TaxonomyModule } from './taxonomy/taxonomy.module';
import { QuestionsModule } from './questions/questions.module';
import { WathbModule } from './wathb/wathb.module';
import { ReportsModule } from './reports/reports.module';
import { PeopleModule } from './people/people.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    TaxonomyModule,
    QuestionsModule,
    WathbModule,
    ReportsModule,
    PeopleModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
