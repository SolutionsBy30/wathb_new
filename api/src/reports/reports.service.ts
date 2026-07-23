import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SessionPayload } from '../auth/auth.types';
import { computeCompositeIndex, LabelStatForComposite } from './composite-index.util';
import { compositeDelta } from './weekly-report.util';

// Statistical honesty requirement, spec §5.2: never render a percentage for
// an area/label with fewer than this many answers.
export const MIN_SAMPLE_FOR_REPORTING = 20;
const DEFAULT_DAILY_TARGET = 5; // Package.questionsPerDay is a later phase; hardcoded until packages exist.
const HEATMAP_WEEKS = 8;

// §4.8 guardrail #1 — a school with 3 students is not a data point. Both
// floors must clear before any cohort percentage renders.
export const MIN_COHORT_STUDENTS = 15;
export const MIN_COHORT_ANSWERS = 500;

function accuracyOrCollecting(nAnswered: number, nCorrect: number) {
  if (nAnswered < MIN_SAMPLE_FOR_REPORTING) {
    return { accuracy: null, nAnswered, collecting: true, needed: MIN_SAMPLE_FOR_REPORTING };
  }
  return { accuracy: nCorrect / nAnswered, nAnswered, collecting: false, needed: MIN_SAMPLE_FOR_REPORTING };
}

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  /** role-scoped per spec §9.3: student sees self, supervisor sees only linked+accepted students, admin sees any. */
  async assertAccess(session: SessionPayload, studentId: string) {
    if (session.kind === 'admin') return;
    if (session.kind === 'student') {
      if (session.sub !== studentId) throw new ForbiddenException();
      return;
    }
    if (session.kind === 'supervisor') {
      const link = await this.prisma.studentSupervisor.findUnique({
        where: { studentId_supervisorId: { studentId, supervisorId: session.sub } },
      });
      if (!link || !link.acceptedAt || link.revokedAt) throw new ForbiddenException();
      return;
    }
    throw new ForbiddenException();
  }

  /**
   * §1.3.1 — weekly composite index (accuracy weighted by each answer's
   * section weight, not a raw answer-count average). Shared by the 8-week
   * trend chart and any short trend/delta lookup (weekly report, supervisor
   * dashboard, admin list).
   */
  private async weightedWeeklyTrend(studentId: string, weeks: number) {
    const rows = await this.prisma.$queryRaw<{ week: Date; weightSum: number; weightedCorrect: number }[]>`
      SELECT date_trunc('week', a."answeredAt") as week,
             SUM(sec.weight)::float as "weightSum",
             SUM(CASE WHEN a."isCorrect" THEN sec.weight ELSE 0 END)::float as "weightedCorrect"
      FROM answers a
      JOIN questions q ON q.id = a."questionId"
      JOIN labels l ON l.id = q."labelId"
      JOIN areas ar ON ar.id = l."areaId"
      JOIN sections sec ON sec.id = ar."sectionId"
      WHERE a."studentId" = ${studentId}
      GROUP BY week
      ORDER BY week DESC
      LIMIT ${weeks}
    `;
    return rows
      .map((r) => ({ weekStart: r.week.toISOString().slice(0, 10), accuracy: r.weightSum > 0 ? r.weightedCorrect / r.weightSum : null }))
      .reverse();
  }

  /** Lightweight composite-index + week-over-week delta lookup — used where the full report would be overkill (supervisor cards, admin list). */
  async getCompositeSummary(studentId: string): Promise<{ compositeIndex: number | null; delta: number | null }> {
    const stats = await this.prisma.studentLabelStat.findMany({
      where: { studentId },
      include: { label: { include: { area: { include: { section: true } } } } },
    });
    const forComposite: LabelStatForComposite[] = stats.map((s) => ({
      nAnswered: s.nAnswered,
      nCorrect: s.nCorrect,
      areaId: s.label.areaId,
      sectionWeight: s.label.area.section.weight,
    }));
    const compositeIndex = computeCompositeIndex(forComposite, MIN_SAMPLE_FOR_REPORTING);
    const trend = await this.weightedWeeklyTrend(studentId, 2);
    return { compositeIndex, delta: compositeDelta(trend) };
  }

  /** Same as getCompositeSummary but for many students in one pass (admin list) — one query instead of N. */
  async getCompositeIndexBulk(studentIds: string[]): Promise<Map<string, number | null>> {
    if (studentIds.length === 0) return new Map();
    const stats = await this.prisma.studentLabelStat.findMany({
      where: { studentId: { in: studentIds } },
      include: { label: { include: { area: { include: { section: true } } } } },
    });
    const byStudent = new Map<string, LabelStatForComposite[]>();
    for (const s of stats) {
      const arr = byStudent.get(s.studentId) ?? [];
      arr.push({ nAnswered: s.nAnswered, nCorrect: s.nCorrect, areaId: s.label.areaId, sectionWeight: s.label.area.section.weight });
      byStudent.set(s.studentId, arr);
    }
    const out = new Map<string, number | null>();
    for (const id of studentIds) out.set(id, computeCompositeIndex(byStudent.get(id) ?? [], MIN_SAMPLE_FOR_REPORTING));
    return out;
  }

  async getStudentReport(studentId: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId: studentId },
      include: { user: true },
    });
    if (!student) throw new NotFoundException('student not found');

    const startOfWeek = new Date();
    startOfWeek.setUTCDate(startOfWeek.getUTCDate() - startOfWeek.getUTCDay());
    startOfWeek.setUTCHours(0, 0, 0, 0);

    const [lifetimeAnswered, lifetimeCorrect, weekAnswered, labelStats, recentMistakes, trend, heatmap] = await Promise.all([
      this.prisma.answer.count({ where: { studentId } }),
      this.prisma.answer.count({ where: { studentId, isCorrect: true } }),
      this.prisma.answer.count({ where: { studentId, answeredAt: { gte: startOfWeek } } }),
      this.prisma.studentLabelStat.findMany({
        where: { studentId },
        include: { label: { include: { area: { include: { section: true } } } } },
      }),
      this.prisma.answer.findMany({
        where: { studentId, isCorrect: false },
        orderBy: { answeredAt: 'desc' },
        take: 3,
        include: { questionVersion: true },
      }),
      this.weightedWeeklyTrend(studentId, HEATMAP_WEEKS),
      this.prisma.wathb.findMany({
        where: {
          studentId,
          status: 'completed',
          completedAt: { gte: new Date(Date.now() - HEATMAP_WEEKS * 7 * 86400000) },
        },
        select: { completedAt: true },
      }),
    ]);

    const byArea = new Map<string, { areaId: string; nameAr: string; nameEn: string; nAnswered: number; nCorrect: number; meanTimeMsSum: number; targetSSum: number; weight: number; labels: any[] }>();
    for (const s of labelStats) {
      const area = s.label.area;
      if (!byArea.has(area.id)) {
        byArea.set(area.id, { areaId: area.id, nameAr: area.nameAr, nameEn: area.nameEn, nAnswered: 0, nCorrect: 0, meanTimeMsSum: 0, targetSSum: 0, weight: area.section.weight, labels: [] });
      }
      const bucket = byArea.get(area.id)!;
      bucket.nAnswered += s.nAnswered;
      bucket.nCorrect += s.nCorrect;
      bucket.meanTimeMsSum += s.meanTimeMs * s.nAnswered;
      bucket.targetSSum += s.label.defaultTimeLimitS * s.nAnswered;
      bucket.labels.push({
        labelId: s.labelId,
        nameAr: s.label.nameAr,
        nameEn: s.label.nameEn,
        ...accuracyOrCollecting(s.nAnswered, s.nCorrect),
        meanTimeS: s.nAnswered > 0 ? Math.round(s.meanTimeMs / 1000) : null,
        targetTimeS: s.label.defaultTimeLimitS,
      });
    }

    const accuracyByArea = [...byArea.values()].map((a) => ({
      areaId: a.areaId,
      nameAr: a.nameAr,
      nameEn: a.nameEn,
      ...accuracyOrCollecting(a.nAnswered, a.nCorrect),
      meanTimeS: a.nAnswered > 0 ? Math.round(a.meanTimeMsSum / a.nAnswered / 1000) : null,
      targetTimeS: a.nAnswered > 0 ? Math.round(a.targetSSum / a.nAnswered) : null,
      labels: a.labels,
    }));

    const compositeIndex = computeCompositeIndex(
      [...byArea.values()].map((a) => ({ nAnswered: a.nAnswered, nCorrect: a.nCorrect, areaId: a.areaId, sectionWeight: a.weight })),
      MIN_SAMPLE_FOR_REPORTING,
    );
    const compositeIndexDelta = compositeDelta(trend);

    const heatmapByDay = new Map<string, number>();
    for (const w of heatmap) {
      if (!w.completedAt) continue;
      const day = w.completedAt.toISOString().slice(0, 10);
      heatmapByDay.set(day, (heatmapByDay.get(day) ?? 0) + 1);
    }

    return {
      student: { id: student.userId, name: student.user.name },
      totals: {
        lifetimeAnswered,
        lifetimeCorrect,
        lifetimeWrong: lifetimeAnswered - lifetimeCorrect,
        weekAnswered,
        dailyTarget: DEFAULT_DAILY_TARGET,
      },
      streak: { current: student.currentStreak, lastCompletedOn: student.lastCompletedOn },
      accuracyByArea,
      compositeIndex,
      compositeIndexDelta,
      trend,
      heatmap: [...heatmapByDay.entries()].map(([day, count]) => ({ day, count })),
      recentMistakes: recentMistakes.map((m) => ({
        stem: m.questionVersion.stem,
        selectedKey: m.selectedKey,
        correctKey: m.questionVersion.correctKey,
        explanation: m.questionVersion.explanation,
        options: m.questionVersion.options,
        answeredAt: m.answeredAt,
      })),
    };
  }

  /**
   * §4.8 — admin-only cohort view. "Reuse, don't rebuild": same aggregation
   * as getStudentReport, key swapped from student_id to a cohort of student
   * ids. Computed on demand rather than a nightly-materialised
   * cohort_label_stats table (documented pragmatic deviation — no real cron
   * in this sandbox, and cohort volumes here are far below where a live
   * aggregation query would be slow).
   */
  async getCohortReport(type: 'school' | 'city' | 'region', id: string) {
    const studentWhere =
      type === 'school'
        ? { schoolId: id }
        : type === 'city'
          ? { school: { cityId: id } }
          : { school: { city: { regionId: id } } };

    const students = await this.prisma.student.findMany({ where: studentWhere, select: { userId: true } });
    const studentIds = students.map((s) => s.userId);

    if (studentIds.length === 0) {
      return { gated: true, studentCount: 0, totalAnswered: 0, cohortType: type, cohortId: id };
    }

    const totalAnswered = await this.prisma.answer.count({ where: { studentId: { in: studentIds } } });

    // Guardrail #1 (§4.8): below the floor, return the roster and raw counts
    // — never a rate. "17 subscribed students at this school", not a %.
    if (studentIds.length < MIN_COHORT_STUDENTS || totalAnswered < MIN_COHORT_ANSWERS) {
      return { gated: true, studentCount: studentIds.length, totalAnswered, cohortType: type, cohortId: id };
    }

    const labelStats = await this.prisma.studentLabelStat.findMany({
      where: { studentId: { in: studentIds } },
      include: { label: { include: { area: true } } },
    });

    const byArea = new Map<string, { areaId: string; nameAr: string; nameEn: string; nAnswered: number; nCorrect: number }>();
    for (const s of labelStats) {
      const area = s.label.area;
      if (!byArea.has(area.id)) byArea.set(area.id, { areaId: area.id, nameAr: area.nameAr, nameEn: area.nameEn, nAnswered: 0, nCorrect: 0 });
      const bucket = byArea.get(area.id)!;
      bucket.nAnswered += s.nAnswered;
      bucket.nCorrect += s.nCorrect;
    }

    const accuracyByArea = [...byArea.values()].map((a) => ({
      areaId: a.areaId,
      nameAr: a.nameAr,
      nameEn: a.nameEn,
      ...accuracyOrCollecting(a.nAnswered, a.nCorrect),
    }));

    return {
      gated: false,
      cohortType: type,
      cohortId: id,
      studentCount: studentIds.length,
      totalAnswered,
      accuracyByArea,
    };
  }
}
