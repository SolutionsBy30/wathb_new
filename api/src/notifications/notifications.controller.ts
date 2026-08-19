import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { WeeklyReportService } from './weekly-report.service';
import { CampaignService } from './campaign.service';
import { AdminAlertService } from './admin-alert.service';
import { RequirePermission, RequireSession, SessionGuard } from '../auth/session.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionPayload } from '../auth/auth.types';
import { TriggerDateDto } from './dto/trigger.dto';
import { CampaignAudienceDto, CampaignSendDto } from './dto/campaign.dto';
import { NotificationMessagesService } from './notification-messages.service';
import { CreateNotificationMessageDto, PreviewMessageDto, UpdateNotificationMessageDto } from './dto/notification-message.dto';

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
@RequirePermission('notifications')
@Controller('admin/notifications')
export class NotificationsController {
  constructor(
    private notifications: NotificationsService,
    private weeklyReports: WeeklyReportService,
    private campaigns: CampaignService,
    private adminAlerts: AdminAlertService,
    private messages: NotificationMessagesService,
  ) {}

  @Get()
  deliveryLog() {
    return this.notifications.deliveryLog();
  }

  // SEL-008 — same digest the 07:00 job sends, on demand, so an admin can
  // check what would go out (and that SMTP works) without waiting a day.
  @Post('exhaustion-digest')
  exhaustionDigest(@Query('sinceHours') sinceHours?: string) {
    const hours = Number(sinceHours);
    return this.adminAlerts.sendExhaustionDigest(Number.isFinite(hours) && hours > 0 ? hours : undefined);
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

  // NOT-009 — admin-triggered retry-ladder pass + the "repeatedly
  // undelivered numbers" surfaced to the admin console.
  @Post('process-retries')
  processRetries() {
    return this.notifications.processRetries();
  }

  // NOT-014 — reset exhausted notifications so the ladder runs again, after
  // fixing a fault on our side. `errorContains` narrows it to one cause.
  @Post('requeue-failed')
  requeueFailed(@Body() dto: { errorContains?: string; sinceDate?: string }) {
    return this.notifications.requeueFailed({
      errorContains: dto?.errorContains,
      since: dto?.sinceDate ? new Date(dto.sinceDate) : undefined,
    });
  }

  @Get('undelivered')
  undelivered() {
    return this.notifications.repeatedlyUndelivered();
  }

  @Post('send/:studentId')
  sendOne(@Param('studentId') studentId: string, @Query('forDate') forDate?: string) {
    return this.notifications.sendDailyWathbNotification(studentId, resolveDate(forDate));
  }

  // ADM-087 — the admin console's per-student "send now": plans today's
  // bundle if the 21:00 job hasn't yet, then sends. See sendNowForStudent
  // for why entitlement rules still apply.
  // NOT-018 — bulk recovery: every active student, window ignored. Declared
  // before the :studentId route purely for readability; the paths are
  // distinct so order does not decide matching. Nothing may be inserted
  // between this decorator and its method.
  @Post('send-now')
  sendNowAll(@Query('forDate') forDate?: string) {
    return this.notifications.sendNowForAllStudents(resolveDate(forDate));
  }

  @Post('send-now/:studentId')
  sendNow(@Param('studentId') studentId: string, @Query('forDate') forDate?: string) {
    return this.notifications.sendNowForStudent(studentId, resolveDate(forDate));
  }

  // ADM-087 — the same manual send for the weekly report, one recipient at a
  // time. The bulk /weekly-reports trigger above fires for everyone due;
  // these two are for support ("resend Ahmad's report") and for verifying a
  // channel change without messaging the whole roster.
  @Post('weekly-report/student/:studentId')
  sendStudentWeeklyReport(@Param('studentId') studentId: string, @Query('forDate') forDate?: string) {
    return this.weeklyReports.sendStudentWeeklyReport(studentId, resolveDate(forDate));
  }

  // respectSchedule stays false: an admin pressing send means now, not "only
  // if this happens to be the supervisor's configured day and hour".
  @Post('weekly-report/supervisor/:supervisorId')
  sendSupervisorWeeklyReport(@Param('supervisorId') supervisorId: string, @Query('forDate') forDate?: string) {
    return this.weeklyReports.sendSupervisorWeeklyReport(supervisorId, resolveDate(forDate), false);
  }

  // weekly_report job (spec §9.4) — student + supervisor, same manual-trigger
  // rationale as plan_day/send_notification above.
  // respectSchedule stays false here: an admin pressing "send weekly reports"
  // means now, not "only for whoever's configured slot happens to be this hour".
  @Post('weekly-reports')
  sendWeeklyReports(@Body() dto: TriggerDateDto) {
    return this.weeklyReports.sendAllDueWeeklyReports(resolveDate(dto.forDate), false);
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

  /**
   * NOT-017 — the pool of daily-leap message variants.
   *
   * Class-level @UseGuards/@RequireSession/@RequirePermission('notifications')
   * cover every route here, so these carry only their verb decorator — and
   * nothing may be inserted between a decorator and the method it binds to.
   *
   * 'messages/placeholders' and 'messages/preview' are declared with literal
   * paths and there is no 'messages/:id' GET, so no static path can be
   * swallowed by a parameter route.
   */
  @Get('messages')
  listMessages() {
    return this.messages.list();
  }

  /** The placeholder vocabulary, so the console never hardcodes it. */
  @Get('messages/placeholders')
  messagePlaceholders() {
    return this.messages.placeholders();
  }

  @Post('messages/preview')
  previewMessage(@Body() dto: PreviewMessageDto) {
    return this.messages.preview(dto.body);
  }

  @Post('messages')
  createMessage(@Body() dto: CreateNotificationMessageDto) {
    return this.messages.create(dto.body, dto.isActive ?? true);
  }

  @Patch('messages/:id')
  updateMessage(@Param('id') id: string, @Body() dto: UpdateNotificationMessageDto) {
    return this.messages.update(id, dto);
  }

  @Delete('messages/:id')
  deleteMessage(@Param('id') id: string) {
    return this.messages.remove(id);
  }
}
