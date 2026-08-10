import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailChannel } from './email-channel';

const LOOKBACK_HOURS = 24;

/**
 * SEL-008 — "notify the admin of exhausted sections".
 *
 * Exhaustion has been recorded to AuditLog and shown on the admin dashboard
 * since SEL-006, but that only helps an admin who happens to log in. A bank
 * that has run dry silently degrades every student's bundle until someone
 * notices, so this pushes it.
 *
 * Email rather than WhatsApp: the recipient is staff, the content is a list
 * that wants reading at a desk, and SMTP is already configured for NOT-012.
 * Recipients come from ADMIN_ALERT_EMAILS (comma-separated); with none set
 * the digest is a no-op and says so rather than failing.
 */
@Injectable()
export class AdminAlertService {
  private readonly logger = new Logger(AdminAlertService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private email: EmailChannel,
  ) {}

  private get recipients(): string[] {
    return (this.config.get<string>('ADMIN_ALERT_EMAILS') ?? '')
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);
  }

  /** Sections (and labels) that ran out of eligible questions in the window. */
  async collectExhaustion(sinceHours = LOOKBACK_HOURS) {
    const since = new Date(Date.now() - sinceHours * 3600_000);
    const events = await this.prisma.auditLog.findMany({
      where: {
        action: { in: ['selection.section_exhausted', 'selection.bank_exhausted'] },
        createdAt: { gte: since },
      },
      select: { action: true, entityId: true },
    });

    const sectionCounts = new Map<string, number>();
    const labelCounts = new Map<string, number>();
    for (const e of events) {
      const target = e.action === 'selection.section_exhausted' ? sectionCounts : labelCounts;
      target.set(e.entityId, (target.get(e.entityId) ?? 0) + 1);
    }

    const [sections, labels] = await Promise.all([
      this.prisma.section.findMany({
        where: { id: { in: [...sectionCounts.keys()] } },
        include: { test: true },
      }),
      this.prisma.label.findMany({
        where: { id: { in: [...labelCounts.keys()] } },
        include: { area: { include: { section: { include: { test: true } } } } },
      }),
    ]);

    return {
      since,
      sections: sections
        .map((s) => ({
          sectionId: s.id,
          nameAr: s.nameAr,
          testNameAr: s.test.nameAr,
          events: sectionCounts.get(s.id) ?? 0,
        }))
        .sort((a, b) => b.events - a.events),
      labels: labels
        .map((l) => ({
          labelId: l.id,
          nameAr: l.nameAr,
          sectionNameAr: l.area.section.nameAr,
          testNameAr: l.area.section.test.nameAr,
          events: labelCounts.get(l.id) ?? 0,
        }))
        .sort((a, b) => b.events - a.events),
    };
  }

  /**
   * Called nightly by the scheduler. Silent when there is nothing to report —
   * a digest that arrives every day whether or not anything happened stops
   * being read.
   */
  async sendExhaustionDigest(sinceHours = LOOKBACK_HOURS) {
    const report = await this.collectExhaustion(sinceHours);
    if (report.sections.length === 0 && report.labels.length === 0) {
      return { skipped: 'nothing to report' as const };
    }
    const recipients = this.recipients;
    if (recipients.length === 0) {
      this.logger.warn(
        `bank exhaustion in ${report.sections.length} section(s) but ADMIN_ALERT_EMAILS is unset — nobody notified`,
      );
      return { skipped: 'no recipients' as const, sections: report.sections.length };
    }
    if (!this.email.isConfigured) {
      this.logger.warn('bank exhaustion to report but SMTP is not configured — nobody notified');
      return { skipped: 'email not configured' as const, sections: report.sections.length };
    }

    const lines: string[] = [
      `تنبيه: نفاد أسئلة خلال آخر ${sinceHours} ساعة.`,
      '',
    ];
    if (report.sections.length > 0) {
      lines.push('أقسام نفدت أسئلتها (وثبات ناقصة):');
      for (const s of report.sections) {
        lines.push(`  • ${s.testNameAr} — ${s.nameAr}: ${s.events} حالة`);
      }
      lines.push('');
    }
    if (report.labels.length > 0) {
      lines.push('تصنيفات بلا أسئلة متاحة:');
      for (const l of report.labels.slice(0, 40)) {
        lines.push(`  • ${l.testNameAr} — ${l.sectionNameAr} — ${l.nameAr}: ${l.events} حالة`);
      }
      if (report.labels.length > 40) lines.push(`  … و${report.labels.length - 40} تصنيفاً آخر`);
      lines.push('');
    }
    lines.push('أضف أسئلة منشورة تحت هذه الأقسام لإعادة الوثبات إلى حجمها الكامل.');

    const subject = `وثب — نفاد أسئلة في ${report.sections.length} قسم`;
    const text = lines.join('\n');
    let sent = 0;
    for (const to of recipients) {
      const id = await this.email.send({ to, subject, text });
      if (id) sent += 1;
    }
    return { sent, recipients: recipients.length, sections: report.sections.length, labels: report.labels.length };
  }
}
