import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SchoolReportService } from './school-report.service';
import { SchoolAuthService } from './school-auth.service';
import { SchoolLoginDto, SchoolVerifyDto } from './dto/school.dto';
import { RequireSession, SessionGuard } from '../auth/session.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionPayload } from '../auth/auth.types';

const AUTH_THROTTLE = { default: { limit: 5, ttl: 5 * 60_000 } };

/**
 * SCH — the school dashboard.
 *
 * Login is unguarded by necessity and rate-limited like every other OTP
 * surface. Everything else requires a 'school' session specifically: not
 * 'supervisor', not 'admin'. A supervisor session reaching these routes would
 * be a different person's authority arriving at a school's data.
 */
@Controller('school')
export class SchoolController {
  constructor(
    private reports: SchoolReportService,
    private auth: SchoolAuthService,
  ) {}

  @Throttle(AUTH_THROTTLE)
  @Post('auth/otp/request')
  requestCode(@Body() dto: SchoolLoginDto) {
    return this.auth.requestCode(dto.mobile);
  }

  @Throttle({ default: { limit: 10, ttl: 5 * 60_000 } })
  @Post('auth/otp/verify')
  verifyCode(@Body() dto: SchoolVerifyDto) {
    return this.auth.verifyCode(dto.mobile, dto.code);
  }

  // The schools this session may read. Declared before ':schoolId' routes so
  // 'me' is never parsed as a school id.
  @UseGuards(SessionGuard)
  @RequireSession('school')
  @Get('me/schools')
  mySchools(@CurrentSession() session: SessionPayload) {
    return this.reports.schoolsFor(session.sub);
  }

  @UseGuards(SessionGuard)
  @RequireSession('school')
  @Get(':schoolId/overview')
  overview(@Param('schoolId') schoolId: string, @CurrentSession() session: SessionPayload) {
    return this.reports.overview(session.sub, schoolId);
  }

  @UseGuards(SessionGuard)
  @RequireSession('school')
  @Get(':schoolId/areas')
  areas(@Param('schoolId') schoolId: string, @CurrentSession() session: SessionPayload) {
    return this.reports.areaBreakdown(session.sub, schoolId);
  }

  @UseGuards(SessionGuard)
  @RequireSession('school')
  @Get(':schoolId/attention')
  attention(@Param('schoolId') schoolId: string, @CurrentSession() session: SessionPayload) {
    return this.reports.attentionList(session.sub, schoolId);
  }
}
