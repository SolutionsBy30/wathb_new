import { Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';

// Split from AdminOpsModule so AuthModule (OtpService needs AuditLogService
// for the ONB-014 fallback-code log entry) can import just this, without a
// AuthModule <-> AdminOpsModule cycle (AdminOpsController needs SessionGuard
// from AuthModule).
@Module({
  providers: [AuditLogService],
  exports: [AuditLogService],
})
export class AuditLogModule {}
