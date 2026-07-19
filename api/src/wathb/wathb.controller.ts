import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { WathbService } from './wathb.service';
import { RequireSession, SessionGuard } from '../auth/session.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionPayload } from '../auth/auth.types';
import { AnswerDto } from './dto/answer.dto';

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
}
