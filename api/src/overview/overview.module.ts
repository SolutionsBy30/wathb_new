import { Module } from '@nestjs/common';
import { OverviewController } from './overview.controller';
import { OverviewService } from './overview.service';
import { AuthModule } from '../auth/auth.module';
import { AuditLogModule } from '../admin-ops/audit-log.module';

@Module({
  imports: [AuthModule, AuditLogModule],
  providers: [OverviewService],
  controllers: [OverviewController],
})
export class OverviewModule {}
