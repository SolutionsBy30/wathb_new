import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { WeeklyReportService } from './weekly-report.service';
import { CampaignService } from './campaign.service';
import { RequireSession, SessionGuard } from '../auth/session.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionPayload } from '../auth/auth.types';
import { TriggerDateDto } from './dto/trigger.dto';
import { CampaignAudienceDto, CampaignSendDto } from './dto/campaign.dto';

function resolveDate(forDate?: string, defaultOffsetDays = 0): Date {
  if (forDate) return new Date(forDate);
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + defaultOffsetDays);
  return d;
}

/**
 * Manual triggers standing in for the real cron (plan_day at 03:00/tz,
 * send_notification on schedule — spec §9.4). This sandbox has no
 * clock-driven job runner to demonstrate against, so Phase 3 exposes the
 * same two operations as admin-triggerable endpoints — exactly what spec
 * §11 Phase 1 recommends doing manually before the scheduler is wired end
 * to end ("Manually trigger sends... prove the core experience works").
 * Register these as BullMQ repeatable jobs before any real deployment.
 */
@UseGuards(SessionGuard)
@RequireSession('admin')
@Controller('admin/notifications')
export class NotificationsController {
  constructor(
    private notifications: NotificationsService,
    private weeklyReports: WeeklyReportService,
    private campaigns: CampaignService,
  ) {}

  @Get()
  deliveryLog() {
    return this.notifications.deliveryLog();
  }

  @Post('plan-day')
  planDayAll(@Body() dto: TriggerDateDto) {
    return this.notifications.planDayForAllActiveStudents(resolveDate(dto.forDate, 1));
  }

  @Post('plan-day/:studentId')
  planDayOne(@Param('studentId') studentId: string, @Body() dto: TriggerDateDto) {
    return this.notifications.planDayForStudent(studentId, resolveDate(dto.forDate, 1));
  }

  @Post('send-due')
  sendDueAll(@Query('forDate') forDate?: string) {
    return this.notifications.sendDueForAllStudents(resolveDate(forDate));
  }

  @Post('send/:studentId')
  sendOne(@Param('studentId') studentId: string, @Query('forDate') forDate?: string) {
    return this.notifications.sendDailyWathbNotification(studentId, resolveDate(forDate));
  }

  // weekly_report job (spec §9.4) — student + supervisor, same manual-trigger
  // rationale as plan_day/send_notification above.
  @Post('weekly-reports')
  sendWeeklyReports(@Body() dto: TriggerDateDto) {
    return this.weeklyReports.sendAllDueWeeklyReports(resolveDate(dto.forDate));
  }

  // ADM-083 — bulk/filtered campaign send. Preview is a read-only dry run of
  // the same audience filter used by send, so the admin sees the recipient
  // count before anything goes out.
  @Post('campaign/preview')
  previewCampaign(@Body() dto: CampaignAudienceDto) {
    return this.campaigns.previewAudience(dto);
  }

  @Post('campaign/send')
  sendCampaign(@Body() dto: CampaignSendDto, @CurrentSession() session: SessionPayload) {
    return this.campaigns.send(dto, session.sub);
  }
}
