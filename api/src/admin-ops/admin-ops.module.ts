import { Module } from '@nestjs/common';
import { AdminOpsController } from './admin-ops.controller';
import { SuspensionService } from './suspension.service';
import { AuditLogModule } from './audit-log.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, AuditLogModule],
  providers: [SuspensionService],
  controllers: [AdminOpsController],
})
export class AdminOpsModule {}
