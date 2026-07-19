import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MagicLinkService } from '../auth/magic-link.service';
import { ReportsService, MIN_SAMPLE_FOR_REPORTING } from '../reports/reports.service';
import { NOTIFICATION_CHANNEL, NotificationChannel } from './channel.interface';
import { accuracyBand, compositeDelta, pickTopStrengthWeakness, speedBand, WeeklyLabelStat } from '../reports/weekly-report.util';

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() - out.getUTCDay());
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

function fmtDelta(delta: number | null): string {
  if (delta === null) return '';
  const pct = Math.round(delta * 100);
  if (pct === 0) return 'بلا تغيير هذا الأسبوع';
  return pct > 0 ? `تحسّن ${pct} نقطة هذا الأسبوع` : `تراجع ${Math.abs(pct)} نقطة هذا الأسبوع`;
}

@Injectable()
export class WeeklyReportService {
  private readonly logger = new Logger(WeeklyReportService.name);

  constructor(
    private prisma: PrismaService,
    private reports: ReportsService,
    private magicLinks: MagicLinkService,
    @Inject(NOTIFICATION_CHANNEL) private channel: NotificationChannel,
    private config: ConfigService,
  ) {}

  private async flattenReportableLabels(studentId: string): Promise<{ labels: WeeklyLabelStat[]; trend: { weekStart: string; accuracy: number | null }[] }> {
    const report = await this.reports.getStudentReport(studentId);
    const labels: WeeklyLabelStat[] = report.accuracyByArea
      .flatMap((a) => a.labels)
      .filter((l) => !l.collecting && l.accuracy !== null)
      .map((l) => ({
        labelId: l.labelId,
        nameAr: l.nameAr,
        nAnswered: l.nAnswered,
        nCorrect: Math.round((l.accuracy as number) * l.nAnswered),
        meanTimeMs: (l.meanTimeS ?? 0) * 1000,
        targetTimeS: l.targetTimeS ?? 45,
      }));
    return { labels, trend: report.trend };
  }

  private async adviceFor(weakness: WeeklyLabelStat | null): Promise<string | null> {
    if (!weakness) return null;
    const band = accuracyBand(weakness.nCorrect / weakness.nAnswered);
    const speed = speedBand(weakness.meanTimeMs / 1000, weakness.targetTimeS);
    const rule = await this.prisma.adviceRule.findUnique({
      where: { labelId_accuracyBand_speedBand: { labelId: weakness.labelId, accuracyBand: band, speedBand: speed } },
    });
    return rule?.textAr ?? null;
  }

  async sendStudentWeeklyReport(studentId: string, forWeek: Date) {
    const scheduledFor = startOfWeek(forWeek);
    const already = await this.prisma.notification.findUnique({
      where: { userId_kind_scheduledFor: { userId: studentId, kind: 'weekly_report_student', scheduledFor } },
    });
    if (already) return { skipped: 'already_sent' as const };

    const student = await this.prisma.student.findUniqueOrThrow({ where: { userId: studentId }, include: { user: true } });
    if (!student.user.mobileE164) return { skipped: 'no_mobile' as const };

    const { labels, trend } = await this.flattenReportableLabels(studentId);
    const { strength, weakness } = pickTopStrengthWeakness(labels, MIN_SAMPLE_FOR_REPORTING);
    const delta = compositeDelta(trend);
    const advice = await this.adviceFor(weakness);

    const { token } = await this.magicLinks.mint({ subjectId: studentId, subjectType: 'student', purpose: 'weekly_report' });
    const url = `${this.config.get('STUDENT_APP_URL', 'http://localhost:5173/wathb')}/#magic=${token}`;

    const summary = [
      `سلسلتك: ${student.currentStreak} يوماً`,
      fmtDelta(delta),
      strength ? `أقوى مجال: ${strength.nameAr}` : null,
      weakness ? `الأضعف: ${weakness.nameAr}${advice ? ` — ${advice}` : ''}` : null,
    ].filter(Boolean).join(' · ');

    const notification = await this.prisma.notification.create({
      data: { userId: studentId, kind: 'weekly_report_student', channel: 'whatsapp_template', category: 'utility', scheduledFor, status: 'scheduled' },
    });
    try {
      const result = await this.channel.sendTemplate({
        to: student.user.mobileE164,
        templateName: this.config.get('WHATSAPP_TEMPLATE_WEEKLY_STUDENT', 'weekly_report_student'),
        languageCode: 'ar',
        bodyParams: [student.user.name, summary, url],
      });
      await this.prisma.notification.update({ where: { id: notification.id }, data: { status: 'sent', sentAt: new Date(), waMessageId: result.providerMessageId } });
      return { sent: true as const };
    } catch (e: any) {
      await this.prisma.notification.update({ where: { id: notification.id }, data: { status: 'failed', error: e.message } });
      return { failed: true as const };
    }
  }

  async sendSupervisorWeeklyReport(supervisorId: string, forWeek: Date) {
    const scheduledFor = startOfWeek(forWeek);
    const already = await this.prisma.notification.findUnique({
      where: { userId_kind_scheduledFor: { userId: supervisorId, kind: 'weekly_report_supervisor', scheduledFor } },
    });
    if (already) return { skipped: 'already_sent' as const };

    const supervisor = await this.prisma.supervisor.findUniqueOrThrow({ where: { userId: supervisorId }, include: { user: true } });
    if (supervisor.weeklyReportMuted) return { skipped: 'muted' as const };
    if (!supervisor.user.mobileE164) return { skipped: 'no_mobile' as const };

    const links = await this.prisma.studentSupervisor.findMany({
      where: { supervisorId, acceptedAt: { not: null }, revokedAt: null },
      include: { student: { include: { user: true } } },
    });
    if (links.length === 0) return { skipped: 'no_students' as const };

    const perStudentLines = await Promise.all(
      links.map(async (link) => {
        const { labels, trend } = await this.flattenReportableLabels(link.studentId);
        const { weakness } = pickTopStrengthWeakness(labels, MIN_SAMPLE_FOR_REPORTING);
        const delta = compositeDelta(trend);
        return `${link.student.user.name}: ${fmtDelta(delta) || 'لا بيانات كافية بعد'}${weakness ? ` — الأضعف: ${weakness.nameAr}` : ''}`;
      }),
    );
    // Fewer than 5 lines — spec §5.3.
    const summary = perStudentLines.slice(0, 4).join(' · ');

    const { token } = await this.magicLinks.mint({ subjectId: supervisorId, subjectType: 'supervisor', purpose: 'supervisor_report' });
    const url = `${this.config.get('SUPERVISOR_APP_URL', 'http://localhost:5175/supervisor')}/#magic=${token}`;

    const notification = await this.prisma.notification.create({
      data: { userId: supervisorId, kind: 'weekly_report_supervisor', channel: 'whatsapp_template', category: 'utility', scheduledFor, status: 'scheduled' },
    });
    try {
      const result = await this.channel.sendTemplate({
        to: supervisor.user.mobileE164,
        templateName: this.config.get('WHATSAPP_TEMPLATE_WEEKLY_SUPERVISOR', 'weekly_report_supervisor'),
        languageCode: 'ar',
        bodyParams: [supervisor.user.name, summary, url],
      });
      await this.prisma.notification.update({ where: { id: notification.id }, data: { status: 'sent', sentAt: new Date(), waMessageId: result.providerMessageId } });
      return { sent: true as const };
    } catch (e: any) {
      await this.prisma.notification.update({ where: { id: notification.id }, data: { status: 'failed', error: e.message } });
      return { failed: true as const };
    }
  }

  async sendAllDueWeeklyReports(forWeek: Date) {
    const students = await this.prisma.student.findMany({ where: { targetTestId: { not: null } } });
    const supervisors = await this.prisma.supervisor.findMany();
    const studentResults = [];
    for (const s of students) studentResults.push({ studentId: s.userId, ...(await this.sendStudentWeeklyReport(s.userId, forWeek)) });
    const supervisorResults = [];
    for (const sup of supervisors) supervisorResults.push({ supervisorId: sup.userId, ...(await this.sendSupervisorWeeklyReport(sup.userId, forWeek)) });
    return { studentResults, supervisorResults };
  }
}
