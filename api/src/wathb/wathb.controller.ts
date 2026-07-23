import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { WathbService } from './wathb.service';
import { RequireSession, SessionGuard } from '../auth/session.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionPayload } from '../auth/auth.types';
import { AnswerDto } from './dto/answer.dto';
import { RateExplanationDto, ReportProblemDto } from './dto/feedback.dto';

@UseGuards(SessionGuard)
@RequireSession('student')
@Controller('wathb')
export class WathbController {
  constructor(private wathb: WathbService) {}

  @Get('today')
  today(@CurrentSession() session: SessionPayload) {
    return this.wathb.today(session.sub);
  }

  @Post(':id/answer')
  answer(@Param('id') id: string, @Body() dto: AnswerDto, @CurrentSession() session: SessionPayload) {
    return this.wathb.answer(session.sub, id, dto.position, dto.selectedKey ?? null);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string, @CurrentSession() session: SessionPayload) {
    return this.wathb.complete(session.sub, id);
  }

  // STU-012 — these key off the answer, not the wathb, so they live under
  // /wathb/answers rather than nested one level deeper under /:id.
  @Post('answers/:answerId/rate-explanation')
  rateExplanation(@Param('answerId') answerId: string, @Body() dto: RateExplanationDto, @CurrentSession() session: SessionPayload) {
    return this.wathb.rateExplanation(session.sub, answerId, dto.rating);
  }

  @Post('answers/:answerId/report-problem')
  reportProblem(@Param('answerId') answerId: string, @Body() dto: ReportProblemDto, @CurrentSession() session: SessionPayload) {
    return this.wathb.reportProblem(session.sub, answerId, dto.note);
  }
}
