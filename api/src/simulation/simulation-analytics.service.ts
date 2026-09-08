import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../admin-ops/audit-log.service';
import { AttemptService } from './attempt.service';
import { evaluateEligibility } from './eligibility.util';

export interface AnalyticsFilter {
  blueprintId?: string;
  formId?: string;
  from?: Date;
  to?: Date;
  schoolSnapshot?: string;
  citySnapshot?: string;
  regionSnapshot?: string;
}

/**
 * SIM-021 — §7.4 admin analytics and the per-attempt actions.
 *
 * Every cohort cut here reads the snapshot columns on the attempt, never a
 * live join to enrolment (§7.2). A student who transfers schools in March must
 * not retroactively move the result they earned in January — otherwise every
 * school comparison silently rewrites itself as students move.
 */
@Injectable()
export class SimulationAnalyticsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditLogService,
    private attempts: AttemptService,
  ) {}

  private async label(adminUserId: string): Promise<string> {
    const admin = await this.prisma.user.findUnique({ where: { id: adminUserId }, select: { name: true, email: true } });
    return admin?.email ?? admin?.name ?? adminUserId;
  }

  private where(f: AnalyticsFilter) {
    return {
      ...(f.blueprintId ? { blueprintId: f.blueprintId } : {}),
      ...(f.formId ? { formId: f.formId } : {}),
      ...(f.schoolSnapshot ? { schoolSnapshot: f.schoolSnapshot } : {}),
      ...(f.citySnapshot ? { citySnapshot: f.citySnapshot } : {}),
      ...(f.regionSnapshot ? { regionSnapshot: f.regionSnapshot } : {}),
      ...(f.from || f.to
        ? { startedAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) } }
        : {}),
    };
  }

  /** The attempt list an admin scrolls, newest first. */
  async attemptsList(f: AnalyticsFilter, limit = 100) {
    const rows = await this.prisma.simulationAttempt.findMany({
      where: this.where(f),
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
      select: {
        id: true,
        status: true,
        startedAt: true,
        finalizedAt: true,
        schoolSnapshot: true,
        citySnapshot: true,
        student: { select: { userId: true, user: { select: { name: true } } } },
        form: { select: { code: true, isStatic: true } },
        blueprint: { select: { nameAr: true } },
        result: { select: { rawScore: true, scoredCount: true } },
      },
    });
    return rows.map((a) => ({
      id: a.id,
      status: a.status,
      startedAt: a.startedAt,
      finalizedAt: a.finalizedAt,
      studentId: a.student.userId,
      studentName: a.student.user.name,
      formCode: a.form.code,
      isStatic: a.form.isStatic,
      blueprintNameAr: a.blueprint.nameAr,
      school: a.schoolSnapshot,
      city: a.citySnapshot,
      accuracy: a.result && a.result.scoredCount > 0
        ? Math.round((a.result.rawScore / a.result.scoredCount) * 1000) / 10
        : null,
    }));
  }

  /**
   * §7.4 — the funnel, score distribution and per-area map in one pass.
   *
   * One query for attempts and one for answers, then aggregated in memory:
   * the volumes here are a few thousand rows, and hand-written SQL for this
   * would be a third place the snapshot-vs-live-join rule could be got wrong.
   */
  async overview(f: AnalyticsFilter) {
    const attempts = await this.prisma.simulationAttempt.findMany({
      where: this.where(f),
      select: {
        id: true,
        status: true,
        startedAt: true,
        finalizedAt: true,
        schoolSnapshot: true,
        citySnapshot: true,
        regionSnapshot: true,
        result: { select: { rawScore: true, scoredCount: true, verbalEstimate: true, quantEstimate: true } },
        sections: { select: { sectionIndex: true, submittedAt: true, lockReason: true } },
        blueprint: { select: { sectionCount: true } },
      },
    });

    const byStatus: Record<string, number> = {};
    for (const a of attempts) byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;

    // Funnel: how many reached the end of each section. "Reached section N"
    // means N sections were closed, which is what a drop-off point is.
    const sectionCount = attempts[0]?.blueprint.sectionCount ?? 0;
    const funnel = Array.from({ length: sectionCount + 1 }, (_, i) => ({
      sectionsCompleted: i,
      attempts: attempts.filter((a) => a.sections.filter((s) => s.submittedAt).length === i).length,
    }));

    const scored = attempts.filter((a) => a.result && a.result.scoredCount > 0);
    const accuracies = scored.map((a) => (a.result!.rawScore / a.result!.scoredCount) * 100);
    const sorted = [...accuracies].sort((x, y) => x - y);

    // Ten-point buckets: fine enough to see a shape, coarse enough that a
    // cohort of thirty is not one attempt per bar.
    const histogram = Array.from({ length: 10 }, (_, i) => ({
      from: i * 10,
      to: i * 10 + 10,
      count: accuracies.filter((v) => v >= i * 10 && (i === 9 ? v <= 100 : v < i * 10 + 10)).length,
    }));

    const mean = accuracies.length ? accuracies.reduce((a, b) => a + b, 0) / accuracies.length : 0;
    const median = sorted.length
      ? sorted.length % 2
        ? sorted[(sorted.length - 1) / 2]
        : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : 0;

    const verbal = scored.map((a) => a.result!.verbalEstimate).filter((v): v is number => v !== null);
    const quant = scored.map((a) => a.result!.quantEstimate).filter((v): v is number => v !== null);
    const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

    const areas = await this.areaMap(attempts.map((a) => a.id));

    return {
      totalAttempts: attempts.length,
      byStatus,
      funnel,
      scoredAttempts: scored.length,
      meanAccuracy: Math.round(mean * 10) / 10,
      medianAccuracy: Math.round(median * 10) / 10,
      meanVerbal: avg(verbal),
      meanQuant: avg(quant),
      histogram,
      areas,
    };
  }

  /** §7.4 — "per-area difficulty map across all attempts". */
  private async areaMap(attemptIds: string[]) {
    if (attemptIds.length === 0) return [];
    const answers = await this.prisma.simulationAnswer.findMany({
      where: { attemptId: { in: attemptIds }, formItem: { isScored: true } },
      select: {
        selectedKey: true,
        isCorrect: true,
        timeSpentMs: true,
        formItem: {
          select: { question: { select: { label: { select: { area: { select: { id: true, nameAr: true } } } } } } },
        },
      },
    });

    const agg = new Map<string, { nameAr: string; served: number; correct: number; unanswered: number; timeMs: number }>();
    for (const a of answers) {
      const area = a.formItem.question.label.area;
      const cur = agg.get(area.id) ?? { nameAr: area.nameAr, served: 0, correct: 0, unanswered: 0, timeMs: 0 };
      cur.served++;
      if (a.isCorrect) cur.correct++;
      if (a.selectedKey === null) cur.unanswered++;
      cur.timeMs += a.timeSpentMs;
      agg.set(area.id, cur);
    }

    return [...agg.entries()]
      .map(([areaId, v]) => ({
        areaId,
        areaNameAr: v.nameAr,
        served: v.served,
        accuracy: v.served ? Math.round((v.correct / v.served) * 1000) / 10 : 0,
        unansweredRate: v.served ? Math.round((v.unanswered / v.served) * 1000) / 10 : 0,
        meanTimeMs: v.served ? Math.round(v.timeMs / v.served) : 0,
      }))
      .sort((a, b) => a.accuracy - b.accuracy);
  }

  /**
   * §7.4 — per-question statistics for simulation items, with the distractor
   * split. This is the loop that keeps the bank honest: an item with a
   * negative discrimination is one the strong students get wrong.
   */
  async itemStats(f: AnalyticsFilter, minServed = 5) {
    const attempts = await this.prisma.simulationAttempt.findMany({ where: this.where(f), select: { id: true } });
    if (attempts.length === 0) return [];

    const answers = await this.prisma.simulationAnswer.findMany({
      where: { attemptId: { in: attempts.map((a) => a.id) } },
      select: {
        attemptId: true,
        selectedKey: true,
        isCorrect: true,
        timeSpentMs: true,
        flagged: true,
        formItem: {
          select: {
            questionId: true,
            isScored: true,
            questionVersion: { select: { correctKey: true, stem: true } },
            question: { select: { label: { select: { nameAr: true, area: { select: { nameAr: true } } } } } },
          },
        },
      },
    });

    // Discrimination needs each student's overall score on the same sitting,
    // so it is computed from these attempts rather than read off QuestionStats
    // (which aggregates the daily leap, a different and easier context).
    const totals = new Map<string, { correct: number; n: number }>();
    for (const a of answers) {
      const t = totals.get(a.attemptId) ?? { correct: 0, n: 0 };
      if (a.formItem.isScored) {
        t.n++;
        if (a.isCorrect) t.correct++;
      }
      totals.set(a.attemptId, t);
    }
    const overall = new Map([...totals].map(([id, t]) => [id, t.n ? t.correct / t.n : 0]));

    const byQuestion = new Map<string, typeof answers>();
    for (const a of answers) {
      const list = byQuestion.get(a.formItem.questionId) ?? [];
      list.push(a);
      byQuestion.set(a.formItem.questionId, list);
    }

    const rows = [];
    for (const [questionId, list] of byQuestion) {
      if (list.length < minServed) continue;
      const correct = list.filter((a) => a.isCorrect).length;
      const pValue = correct / list.length;

      // Point-biserial: the correlation between getting this item right and
      // scoring well overall. Negative means the item is misleading the
      // students who actually know the material.
      const xs = list.map((a) => (a.isCorrect ? 1 : 0));
      const ys = list.map((a) => overall.get(a.attemptId) ?? 0);
      const discrimination = correlation(xs, ys);

      const distractors: Record<string, number> = {};
      for (const a of list) {
        const key = a.selectedKey ?? '—';
        distractors[key] = (distractors[key] ?? 0) + 1;
      }

      rows.push({
        questionId,
        stem: list[0].formItem.questionVersion.stem.slice(0, 120),
        areaNameAr: list[0].formItem.question.label.area.nameAr,
        labelNameAr: list[0].formItem.question.label.nameAr,
        isScored: list[0].formItem.isScored,
        served: list.length,
        pValue: Math.round(pValue * 1000) / 1000,
        discrimination: discrimination === null ? null : Math.round(discrimination * 1000) / 1000,
        correctKey: list[0].formItem.questionVersion.correctKey,
        distractors,
        meanTimeMs: Math.round(list.reduce((n, a) => n + a.timeSpentMs, 0) / list.length),
        flagRate: Math.round((list.filter((a) => a.flagged).length / list.length) * 1000) / 10,
        // Surfaced so the admin does not have to eyeball every row: §7.4 wants
        // items outside the expected band pulled out for review.
        suspect: pValue < 0.15 || pValue > 0.95 || (discrimination !== null && discrimination < 0),
      });
    }

    return rows.sort((a, b) => (a.discrimination ?? 1) - (b.discrimination ?? 1));
  }

  /**
   * §7.4 — gate diagnostics: how many students the gates are actually holding
   * back, which is the evidence for or against §12.3's threshold of 20.
   */
  async gateDiagnostics(blueprintId: string) {
    const bp = await this.prisma.simulationBlueprint.findUnique({
      where: { id: blueprintId },
      select: {
        testId: true,
        minCompletedLeaps: true,
        minAnsweredQuestions: true,
        minCoverageAreas: true,
        minDaysBetweenAttempts: true,
        minLeapsBetweenAttempts: true,
        requirePlacement: true,
        sections: { select: { quotas: { select: { areaId: true } } } },
      },
    });
    if (!bp) throw new NotFoundException('المخطط غير موجود');
    const totalAreas = new Set(bp.sections.flatMap((s) => s.quotas.map((q) => q.areaId))).size;

    // Only students actually aiming at this test — counting everyone would
    // report the whole platform as "blocked by Gate A".
    const students = await this.prisma.student.findMany({
      where: { targetTestId: bp.testId },
      select: {
        userId: true,
        placementDoneAt: true,
        _count: { select: { answers: true } },
      },
    });

    const counts = { eligible: 0, gateA: 0, cooldown: 0, noPlacement: 0, total: students.length };
    const now = new Date();

    for (const s of students) {
      const completedLeaps = await this.prisma.wathb.count({
        where: { studentId: s.userId, status: 'completed', bundleType: { not: 'placement' } },
      });
      const last = await this.prisma.simulationAttempt.findFirst({
        where: { studentId: s.userId, blueprintId, finalizedAt: { not: null } },
        orderBy: { finalizedAt: 'desc' },
        select: { finalizedAt: true },
      });
      const leapsSince = last?.finalizedAt
        ? await this.prisma.wathb.count({
            where: { studentId: s.userId, status: 'completed', bundleType: { not: 'placement' }, completedAt: { gt: last.finalizedAt } },
          })
        : 0;

      const result = evaluateEligibility(
        {
          completedLeaps,
          answeredQuestions: s._count.answers,
          // Area coverage needs a per-student query; the diagnostic is about
          // the two hard gates, so it is reported as met rather than run for
          // every student on the platform.
          areasCovered: totalAreas,
          placementDoneAt: s.placementDoneAt,
          lastAttemptFinalizedAt: last?.finalizedAt ?? null,
          leapsSinceLastAttempt: leapsSince,
          hasUnusedOverride: false,
        },
        { ...bp, totalAreas },
        now,
      );

      if (result.eligible) counts.eligible++;
      if (result.blockedReasons.includes('placement_required')) counts.noPlacement++;
      if (result.blockedReasons.some((r) => r === 'not_enough_leaps' || r === 'not_enough_questions')) counts.gateA++;
      if (result.blockedReasons.some((r) => r === 'cooldown_days' || r === 'cooldown_leaps')) counts.cooldown++;
    }

    return counts;
  }

  // ------------------------------------------------------------- actions

  /** §7.4 — force-finalize a stuck attempt. */
  async forceFinalize(attemptId: string, adminUserId: string, reason: string) {
    const attempt = await this.prisma.simulationAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new NotFoundException('المحاولة غير موجودة');
    if (attempt.finalizedAt) throw new BadRequestException('المحاولة منتهية بالفعل.');

    const done = await this.attempts.finalize(attempt, 'force', new Date());
    await this.audit.record({
      actorId: adminUserId,
      actorLabel: await this.label(adminUserId),
      action: 'simulation_attempt_force_finalize',
      entityType: 'simulation_attempt',
      entityId: attemptId,
      after: { status: done.status },
      note: reason,
    });
    return done;
  }

  /**
   * §7.4 — void an attempt and refund the entitlement.
   *
   * The refund is clearing entitlementId, because §5.5's entitlement is a
   * count of attempts carrying a subscription id rather than a mutable
   * counter. Nothing to decrement, so nothing to get out of step.
   *
   * The attempt itself is kept. Deleting it would erase the answers the item
   * statistics were computed from, and a void is usually a support decision
   * about one student, not a statement that the sitting never happened.
   */
  async voidAttempt(attemptId: string, adminUserId: string, reason: string) {
    const attempt = await this.prisma.simulationAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new NotFoundException('المحاولة غير موجودة');
    if (!reason?.trim()) throw new BadRequestException('اذكر سبب الإلغاء.');

    const updated = await this.prisma.simulationAttempt.update({
      where: { id: attemptId },
      data: { entitlementId: null },
    });
    await this.audit.record({
      actorId: adminUserId,
      actorLabel: await this.label(adminUserId),
      action: 'simulation_attempt_void',
      entityType: 'simulation_attempt',
      entityId: attemptId,
      before: { entitlementId: attempt.entitlementId },
      after: { entitlementId: null },
      note: reason,
    });
    return updated;
  }

  /** §5.6 — a one-off, logged exemption. No self-service, no bypass by paying. */
  async grantOverride(studentId: string, blueprintId: string, adminUserId: string, reason: string) {
    if (!reason?.trim()) throw new BadRequestException('اذكر سبب الاستثناء.');
    const student = await this.prisma.student.findUnique({ where: { userId: studentId }, select: { userId: true } });
    if (!student) throw new NotFoundException('الطالب غير موجود');

    const existing = await this.prisma.simulationOverride.findFirst({
      where: { studentId, blueprintId, usedAt: null },
      select: { id: true },
    });
    // A second unused exemption would sit unnoticed and silently let a third
    // attempt through later.
    if (existing) throw new BadRequestException('لدى الطالب استثناء غير مستخدم بالفعل.');

    const override = await this.prisma.simulationOverride.create({
      data: { studentId, blueprintId, grantedBy: adminUserId, reason: reason.trim() },
    });
    await this.audit.record({
      actorId: adminUserId,
      actorLabel: await this.label(adminUserId),
      action: 'simulation_override_grant',
      entityType: 'simulation_override',
      entityId: override.id,
      after: { studentId, blueprintId },
      note: reason,
    });
    return override;
  }

  listOverrides(blueprintId: string) {
    return this.prisma.simulationOverride.findMany({
      where: { blueprintId },
      orderBy: { grantedAt: 'desc' },
      take: 200,
      include: { student: { select: { user: { select: { name: true } } } } },
    });
  }
}

/** Pearson correlation; null when either side has no spread to correlate. */
function correlation(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 2) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}
