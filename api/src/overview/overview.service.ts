import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ADM-026's full "months-of-runway" bank-health calculation needs a
// per-day-plan demand model this codebase doesn't have yet; this pass uses
// a simpler, defensible floor for both the headline score (ADM-001) and the
// "approaching exhaustion" alert (ADM-002): a label needs at least this many
// *published* questions to comfortably support the selection engine's ±1
// difficulty window and 3-per-label variety cap without early repeats.
const MIN_PUBLISHED_PER_LABEL = 10;
// NFR-007 — flag, don't auto-ban: a single link opened from this many
// distinct IPs within the lookback window is a signal for human review.
const SHARING_ANOMALY_IP_THRESHOLD = 3;
const SHARING_ANOMALY_LOOKBACK_DAYS = 7;
const WATHB_COMPLETION_LOOKBACK_DAYS = 30;
const DISCRIMINATION_NEGATIVE = 0;
const P_VALUE_LOW = 0.15;
const P_VALUE_HIGH = 0.95;

@Injectable()
export class OverviewService {
  constructor(private prisma: PrismaService) {}

  private async labelPublishedCounts() {
    const labels = await this.prisma.label.findMany({ where: { isRetired: false }, select: { id: true, nameAr: true, nameEn: true } });
    const counts = await this.prisma.question.groupBy({
      by: ['labelId'],
      where: { status: 'published', labelId: { in: labels.map((l) => l.id) } },
      _count: { id: true },
    });
    const countMap = new Map(counts.map((c) => [c.labelId, c._count.id]));
    return labels.map((l) => ({ labelId: l.id, nameAr: l.nameAr, nameEn: l.nameEn, published: countMap.get(l.id) ?? 0 }));
  }

  // ADM-001 — headline KPIs.
  async kpis() {
    const [activeSubscriptions, activeSubsForMrr] = await Promise.all([
      this.prisma.subscription.count({ where: { status: 'active' } }),
      this.prisma.subscription.findMany({ where: { status: 'active' }, include: { package: { select: { durationMonths: true } } } }),
    ]);
    const mrrHalalas = activeSubsForMrr.reduce((sum, s) => sum + s.priceSnapshotHalalas / Math.max(1, s.package.durationMonths), 0);

    const since = new Date(Date.now() - WATHB_COMPLETION_LOOKBACK_DAYS * 86400_000);
    const [wathbTotal, wathbCompleted] = await Promise.all([
      this.prisma.wathb.count({ where: { scheduledFor: { gte: since } } }),
      this.prisma.wathb.count({ where: { scheduledFor: { gte: since }, status: 'completed' } }),
    ]);

    const labelCounts = await this.labelPublishedCounts();
    const healthyLabels = labelCounts.filter((l) => l.published >= MIN_PUBLISHED_PER_LABEL).length;

    return {
      activeSubscriptions,
      mrrSar: Math.round(mrrHalalas) / 100,
      wathbCompletionRate: wathbTotal > 0 ? wathbCompleted / wathbTotal : null,
      wathbCompletionSampleSize: wathbTotal,
      bankHealthScore: labelCounts.length > 0 ? Math.round((healthyLabels / labelCounts.length) * 100) : null,
    };
  }

  // ADM-002 — alerts feed.
  async alerts() {
    const labelCounts = await this.labelPublishedCounts();
    const thinLabels = labelCounts
      .filter((l) => l.published < MIN_PUBLISHED_PER_LABEL)
      .sort((a, b) => a.published - b.published)
      .map((l) => ({ labelId: l.labelId, nameAr: l.nameAr, nameEn: l.nameEn, published: l.published, floor: MIN_PUBLISHED_PER_LABEL }));

    const flaggedStats = await this.prisma.questionStats.findMany({
      where: { OR: [{ discrimination: { lt: DISCRIMINATION_NEGATIVE } }, { pValue: { lt: P_VALUE_LOW } }, { pValue: { gt: P_VALUE_HIGH } }] },
      include: { questionVersion: { include: { question: { include: { label: true } } } } },
    });
    const negativeDiscrimination = flaggedStats
      .filter((s) => s.discrimination !== null && s.discrimination < DISCRIMINATION_NEGATIVE)
      .map((s) => ({
        questionId: s.questionVersion.question.id,
        stem: s.questionVersion.stem.slice(0, 120),
        labelNameAr: s.questionVersion.question.label.nameAr,
        discrimination: s.discrimination,
      }));
    const nonDiscriminating = flaggedStats
      .filter((s) => s.pValue !== null && (s.pValue < P_VALUE_LOW || s.pValue > P_VALUE_HIGH))
      .map((s) => ({
        questionId: s.questionVersion.question.id,
        stem: s.questionVersion.stem.slice(0, 120),
        labelNameAr: s.questionVersion.question.label.nameAr,
        pValue: s.pValue,
      }));

    const since = new Date(Date.now() - SHARING_ANOMALY_LOOKBACK_DAYS * 86400_000);
    const accesses = await this.prisma.magicLinkAccess.findMany({
      where: { accessedAt: { gte: since }, ip: { not: null } },
      select: { magicLinkId: true, ip: true },
    });
    const ipsByLink = new Map<string, Set<string>>();
    for (const a of accesses) {
      const set = ipsByLink.get(a.magicLinkId) ?? new Set<string>();
      set.add(a.ip!);
      ipsByLink.set(a.magicLinkId, set);
    }
    const anomalousLinkIds = [...ipsByLink.entries()].filter(([, ips]) => ips.size >= SHARING_ANOMALY_IP_THRESHOLD);
    const anomalousLinks = await this.prisma.magicLink.findMany({
      where: { id: { in: anomalousLinkIds.map(([id]) => id) } },
      select: { id: true, subjectId: true, subjectType: true, purpose: true },
    });
    const sharingAnomalies = anomalousLinks.map((link) => ({
      ...link,
      distinctIps: ipsByLink.get(link.id)?.size ?? 0,
    }));

    return { thinLabels, negativeDiscrimination, nonDiscriminating, sharingAnomalies };
  }
}
