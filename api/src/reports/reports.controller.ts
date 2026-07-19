import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { RequireSession, SessionGuard } from '../auth/session.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionPayload } from '../auth/auth.types';

@UseGuards(SessionGuard)
@RequireSession('student', 'supervisor', 'admin')
@Controller('report')
export class ReportsController {
  constructor(private reports: ReportsService) {}

  // Shared by student/supervisor/admin, role-scoped — mirrors spec §9.3 GET /api/report/student/:id.
  @Get('student/:id')
  async studentReport(@Param('id') id: string, @CurrentSession() session: SessionPayload) {
    await this.reports.assertAccess(session, id);
    return this.reports.getStudentReport(id);
  }
}
