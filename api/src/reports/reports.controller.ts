import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { RequireSession, SessionGuard } from '../auth/session.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionPayload } from '../auth/auth.types';

@UseGuards(SessionGuard)
@Controller('report')
export class ReportsController {
  constructor(private reports: ReportsService) {}

  // Shared by student/supervisor/admin, role-scoped — mirrors spec §9.3 GET /api/report/student/:id.
  @RequireSession('student', 'supervisor', 'admin')
  @Get('student/:id')
  async studentReport(@Param('id') id: string, @CurrentSession() session: SessionPayload) {
    await this.reports.assertAccess(session, id);
    // FRE-004 — the partial-report restriction only ever applies to the
    // student viewing their own data; a supervisor or admin always sees the
    // full report regardless of the student's package.
    const restricted = session.kind === 'student' && (await this.reports.isReportRestricted(id));
    return this.reports.getStudentReport(id, restricted);
  }

  // §4.8 — ADMIN ONLY, 403 for student/supervisor (enforced by @RequireSession, not just UI hiding).
  @RequireSession('admin')
  @Get('cohort')
  cohortReport(@Query('type') type: 'school' | 'city' | 'region', @Query('id') id: string) {
    return this.reports.getCohortReport(type, id);
  }
}
