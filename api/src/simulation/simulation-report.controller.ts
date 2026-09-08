import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { SimulationReportService } from './simulation-report.service';
import { RequireSession, SessionGuard } from '../auth/session.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionPayload } from '../auth/auth.types';

/**
 * SIM-016 — §7.2/§7.3/§7.4 the report, one endpoint for three readers.
 *
 * All three roles are on the same route because they read the same result;
 * the service scopes access per role and adds the admin extras. Splitting it
 * into three endpoints would mean three places for the scoping rule to drift.
 */
@UseGuards(SessionGuard)
@RequireSession('student', 'supervisor', 'admin')
@Controller('simulation/report')
export class SimulationReportController {
  constructor(private reports: SimulationReportService) {}

  // Declared before ':attemptId' so 'student' is not parsed as an attempt id.
  @Get('student/:studentId')
  list(@Param('studentId') studentId: string, @CurrentSession() session: SessionPayload) {
    return this.reports.list(session, studentId);
  }

  @Get(':attemptId')
  report(@Param('attemptId') attemptId: string, @CurrentSession() session: SessionPayload) {
    return this.reports.report(session, attemptId);
  }
}
