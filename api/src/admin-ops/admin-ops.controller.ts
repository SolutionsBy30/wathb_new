import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { SuspensionService } from './suspension.service';
import { AuditLogService } from './audit-log.service';
import { SuspendUserDto } from './dto/suspend-user.dto';
import { RequireSession, SessionGuard } from '../auth/session.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionPayload } from '../auth/auth.types';

@UseGuards(SessionGuard)
@RequireSession('admin')
@Controller('admin')
export class AdminOpsController {
  constructor(
    private suspension: SuspensionService,
    private auditLog: AuditLogService,
  ) {}

  // ADM-085 — required reason, optional note, reversible, logged.
  @Post('users/:id/suspend')
  suspend(@Param('id') id: string, @Body() dto: SuspendUserDto, @CurrentSession() session: SessionPayload) {
    return this.suspension.suspend(id, dto.reason, dto.note, session.sub);
  }

  @Post('users/:id/unsuspend')
  unsuspend(@Param('id') id: string, @CurrentSession() session: SessionPayload) {
    return this.suspension.unsuspend(id, session.sub);
  }

  @Get('audit-log')
  auditLog_() {
    return this.auditLog.list();
  }
}
