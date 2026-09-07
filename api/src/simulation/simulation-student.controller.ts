import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AttemptService } from './attempt.service';
import { EligibilityService } from './eligibility.service';
import { AnswerSimulationDto, FlagItemDto, SimulationEventDto, StartAttemptDto } from './dto/attempt.dto';
import { RequireSession, SessionGuard } from '../auth/session.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionPayload } from '../auth/auth.types';

/**
 * SIM-010 — §5/§6 the student-facing exam runtime.
 *
 * Every route derives the student from the session, never from the body: an
 * attempt id is not a capability, and acceptance criterion 2 requires that a
 * replayed or forged request cannot reach someone else's sitting.
 *
 * The clock is not a parameter anywhere here. The server reads its own
 * `expiresAt` on every write, so a client with a doctored clock, a queued
 * request, or a reopened tab all fail identically.
 */
@UseGuards(SessionGuard)
@RequireSession('student')
@Controller('simulation')
export class SimulationStudentController {
  constructor(
    private attempts: AttemptService,
    private eligibility: EligibilityService,
  ) {}

  // Published blueprints plus this student's gate progress and entitlement —
  // what the pre-exam screen (§6.1) and the locked state (§5.6) both read.
  @Get('available')
  available(@CurrentSession() session: SessionPayload, @Query('testId') testId?: string) {
    return this.attempts.available(session.sub, testId);
  }

  @Get('access/:blueprintId')
  access(@Param('blueprintId') blueprintId: string, @CurrentSession() session: SessionPayload) {
    return this.eligibility.access(session.sub, blueprintId);
  }

  // The one read the exam screen makes. Walks the clock forward first, so a
  // student returning after a lapse is handled by the same path as one who
  // never left.
  @Get('attempt')
  current(@CurrentSession() session: SessionPayload) {
    return this.attempts.state(session.sub);
  }

  @Post('attempt/start')
  start(@Body() dto: StartAttemptDto, @CurrentSession() session: SessionPayload) {
    return this.attempts.start(session.sub, dto.blueprintId);
  }

  // §6.2 — the student leaves the section intro and the clock starts here,
  // not on the page load that rendered the intro.
  @Post('attempt/:id/begin-section')
  beginSection(@Param('id') id: string, @CurrentSession() session: SessionPayload) {
    return this.attempts.beginSection(session.sub, id);
  }

  @Post('attempt/:id/answer')
  answer(@Param('id') id: string, @Body() dto: AnswerSimulationDto, @CurrentSession() session: SessionPayload) {
    return this.attempts.answer(session.sub, id, dto.formItemId, dto.selectedKey ?? null, dto.timeSpentMs ?? 0);
  }

  @Post('attempt/:id/flag')
  flag(@Param('id') id: string, @Body() dto: FlagItemDto, @CurrentSession() session: SessionPayload) {
    return this.attempts.flag(session.sub, id, dto.formItemId, dto.flagged);
  }

  @Post('attempt/:id/submit-section')
  submitSection(@Param('id') id: string, @CurrentSession() session: SessionPayload) {
    return this.attempts.submitSection(session.sub, id);
  }

  @Post('attempt/:id/event')
  event(@Param('id') id: string, @Body() dto: SimulationEventDto, @CurrentSession() session: SessionPayload) {
    return this.attempts.event(session.sub, id, dto.type);
  }

  // §5.4 — leaving deliberately. Costs the entitlement and starts the full
  // cooldown, which is why it is its own explicit call and not a side effect
  // of starting a second attempt.
  @Post('attempt/:id/abandon')
  abandon(@Param('id') id: string, @CurrentSession() session: SessionPayload) {
    return this.attempts.abandon(session.sub, id);
  }
}
