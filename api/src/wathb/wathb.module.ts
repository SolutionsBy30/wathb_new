import { Module } from '@nestjs/common';
import { WathbService } from './wathb.service';
import { WathbGenerationService } from './wathb-generation.service';
import { WathbController } from './wathb.controller';
import { AuthModule } from '../auth/auth.module';
import { AuditLogModule } from '../admin-ops/audit-log.module';

@Module({
  imports: [AuthModule, AuditLogModule],
  providers: [WathbService, WathbGenerationService],
  controllers: [WathbController],
  exports: [WathbGenerationService],
})
export class WathbModule {}
