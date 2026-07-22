import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SessionPayload } from '../auth/auth.types';

// Statistical honesty requirement, spec §5.2: never render a percentage for
// an area/label with fewer than this many answers.
export const MIN_SAMPLE_FOR_REPORTING = 20;
const DEFAULT_DAILY_TARGET = 5; // Package.questionsPerDay is a later phase; hardcoded until packages exist.
const HEATMAP_WEEKS = 8;

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
      this.prisma.$queryRaw<{ week: Date; total: bigint; correct: bigint }[]>`
        SELECT date_trunc('week', "answeredAt") as week,
               count(*)::bigint as total,
               count(*) FILTER (WHERE "isCorrect")::bigint as correct
        FROM answers
        WHERE "studentId" = ${studentId}
        GROUP BY week
        ORDER BY week DESC
        LIMIT 8
      `,
      this.prisma.wathb.findMany({
        where: {
          studentId,
          status: 'completed',
          completedAt: { gte: new Date(Date.now() - HEATMAP_WEEKS * 7 * 86400000) },
        },
        select: { completedAt: true },
      }),
    ]);

    const byArea = new Map<string, { areaId: string; nameAr: string; nameEn: string; nAnswered: number; nCorrect: number; meanTimeMsSum: number; targetSSum: number; labels: any[] }>();
    for (const s of labelStats) {
      const area = s.label.area;
      if (!byArea.has(area.id)) {
        byArea.set(area.id, { areaId: area.id, nameAr: area.nameAr, nameEn: area.nameEn, nAnswered: 0, nCorrect: 0, meanTimeMsSum: 0, targetSSum: 0, labels: [] });
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
      trend: trend
        .map((t) => ({
          weekStart: t.week.toISOString().slice(0, 10),
          total: Number(t.total),
          correct: Number(t.correct),
          accuracy: Number(t.total) > 0 ? Number(t.correct) / Number(t.total) : null,
        }))
        .reverse(),
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
}
