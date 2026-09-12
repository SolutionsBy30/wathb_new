import { Module } from '@nestjs/common';
import { SchoolReportService } from './school-report.service';
import { SchoolAuthService } from './school-auth.service';
import { SchoolController } from './school.controller';
import { SchoolAdminController } from './school-admin.controller';
import { SchoolAdminService } from './school-admin.service';
import { AuthModule } from '../auth/auth.module';
import { AuditLogModule } from '../admin-ops/audit-log.module';

// SCH — the school-facing dashboard and the وثب-side controls that govern it.
@Module({
  imports: [AuthModule, AuditLogModule],
  providers: [SchoolReportService, SchoolAuthService, SchoolAdminService],
  controllers: [SchoolController, SchoolAdminController],
  exports: [SchoolReportService],
})
export class SchoolsModule {}
