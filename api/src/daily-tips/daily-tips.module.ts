import { Module } from '@nestjs/common';
import { DailyTipsService } from './daily-tips.service';
import { DailyTipsController } from './daily-tips.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [DailyTipsService],
  controllers: [DailyTipsController],
})
export class DailyTipsModule {}
