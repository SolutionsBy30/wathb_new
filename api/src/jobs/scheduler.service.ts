import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsService } from '../notifications/notifications.service';
import { WeeklyReportService } from '../notifications/weekly-report.service';
import { AdminAlertService } from '../notifications/admin-alert.service';
import { WathbService } from '../wathb/wathb.service';
import { CheckoutService } from '../payments/checkout.service';

const TZ = 'Asia/Riyadh';

/**
 * OPS-001 — the clock that actually drives the product.
 *
 * Every recurring job (plan_day, send_notification, weekly reports, the
 * NOT-009 retry ladder, STU-009 idle close, subscription expiry) shipped as a
 * manual admin endpoint and nothing ever called them, so no daily notification
 * had ever been sent automatically on any channel.
 *
 * In-process rather than system cron because the endpoints are admin-
 * authenticated and admin tokens expire in 12 hours — a crontab with a baked-in
 * token dies overnight. This runs inside the API, needs no credentials, and
 * starts and stops with PM2.
 *
 * SINGLE INSTANCE ONLY. Every replica would fire every job. The
 * [userId, kind, scheduledFor] idempotency key stops duplicate *messages*, but
 * it is not a distributed lock — concurrent runs would still do duplicate work
 * and can race. Before scaling past one instance, move these to BullMQ (Redis
 * is already in docker-compose) or leave SCHEDULER_ENABLED unset on all but one.
 */
@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  /** Guards against a slow run overlapping its own next tick. */
  private readonly inFlight = new Set<string>();

  constructor(
    private config: ConfigService,
    private notifications: NotificationsService,
    private weeklyReports: WeeklyReportService,
    private wathb: WathbService,
    private checkout: CheckoutService,
    private adminAlerts: AdminAlertService,
  ) {}

  /**
   * Off unless explicitly enabled, so a developer running the API locally
   * doesn't start messaging real students from a copy of the production
   * database — the failure mode that makes people distrust schedulers.
   */
  private get enabled(): boolean {
    return this.config.get<string>('SCHEDULER_ENABLED') === 'true';
  }

  private async run(name: string, fn: () => Promise<unknown>): Promise<void> {
    if (!this.enabled) return;
    if (this.inFlight.has(name)) {
      this.logger.warn(`${name}: previous run still in flight, skipping this tick`);
      return;
    }
    this.inFlight.add(name);
    const startedAt = Date.now();
    try {
      const result = await fn();
      this.logger.log(`${name}: ok in ${Date.now() - startedAt}ms ${summarise(result)}`);
    } catch (e: any) {
      // Never rethrow: an unhandled rejection out of a cron tick takes the
      // whole API process down under PM2, turning a failed job into an outage.
      this.logger.error(`${name}: failed after ${Date.now() - startedAt}ms — ${e?.message ?? e}`);
    } finally {
      this.inFlight.delete(name);
    }
  }

  /** Queue tomorrow's bundle for every active student, before the day starts. */
  @Cron('0 21 * * *', { timeZone: TZ })
  planDay() {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    return this.run('plan_day', () => this.notifications.planDayForAllActiveStudents(tomorrow));
  }

  /**
   * Ticks often; the reactive scheduler decides per student whether they are
   * actually inside their notification window, so a frequent tick is cheap and
   * a sparse one would miss narrow windows.
   */
  @Cron('*/15 * * * *', { timeZone: TZ })
  sendDue() {
    return this.run('send_due', () => this.notifications.sendDueForAllStudents(new Date()));
  }

  /** NOT-009 — retry ladder for undelivered messages. */
  @Cron('*/30 * * * *', { timeZone: TZ })
  processRetries() {
    return this.run('process_retries', () => this.notifications.processRetries());
  }

  /**
   * Hourly, with respectSchedule=true so each supervisor is sent to in their
   * own configured day/hour slot rather than whenever the first tick lands.
   */
  @Cron(CronExpression.EVERY_HOUR, { timeZone: TZ })
  sendWeeklyReports() {
    return this.run('weekly_reports', () => this.weeklyReports.sendAllDueWeeklyReports(new Date(), true));
  }

  /** STU-009 — close bundles abandoned past their idle window as partial. */
  @Cron(CronExpression.EVERY_HOUR, { timeZone: TZ })
  closeIdle() {
    return this.run('close_idle', () => this.wathb.closeIdleWathbs());
  }

  /** Expire subscriptions whose end date has passed. */
  @Cron('30 0 * * *', { timeZone: TZ })
  sweepExpired() {
    return this.run('sweep_expired', () => this.checkout.sweepExpiredSubscriptions());
  }

  /**
   * SEL-008 — one digest a morning of the sections that ran out of questions
   * overnight. 07:00 rather than midnight so it lands at the start of an
   * authoring day, and after plan_day (21:00) has generated every bundle for
   * the day ahead, which is when exhaustion actually shows up.
   */
  @Cron('0 7 * * *', { timeZone: TZ })
  exhaustionDigest() {
    return this.run('exhaustion_digest', () => this.adminAlerts.sendExhaustionDigest());
  }
}

/** Compact one-line summary for the log — counts, never message content. */
function summarise(result: unknown): string {
  if (Array.isArray(result)) return `(${result.length} processed)`;
  if (result && typeof result === 'object') {
    const parts = Object.entries(result as Record<string, unknown>)
      .map(([k, v]) => (Array.isArray(v) ? `${k}=${v.length}` : typeof v === 'number' ? `${k}=${v}` : null))
      .filter(Boolean);
    if (parts.length) return `(${parts.join(' ')})`;
  }
  return '';
}
