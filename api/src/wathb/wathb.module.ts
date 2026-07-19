import { Module } from '@nestjs/common';
import { WathbService } from './wathb.service';
import { WathbGenerationService } from './wathb-generation.service';
import { WathbController } from './wathb.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [WathbService, WathbGenerationService],
  controllers: [WathbController],
  exports: [WathbGenerationService],
})
export class WathbModule {}
