import { Controller, Post, UseGuards } from '@nestjs/common';
import { WathbService } from './wathb.service';
import { RequireSession, SessionGuard } from '../auth/session.guard';

// STU-009 — admin-triggered stand-in for the idle-window close job, same
// manual-trigger rationale as plan_day/send_notification in
// NotificationsController (no real cron in this sandbox).
@UseGuards(SessionGuard)
@RequireSession('admin')
@Controller('admin/wathb')
export class AdminWathbController {
  constructor(private wathb: WathbService) {}

  @Post('close-idle')
  closeIdle() {
    return this.wathb.closeIdleWathbs();
  }
}
