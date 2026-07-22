import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MIN_SAMPLE_FOR_REPORTING } from '../reports/reports.service';

// §4.5.2 "solution performance" / §9 open question #9 — item statistics need
// volume; below this many distinct students, a top/bottom split is noise.
const MIN_STUDENTS_FOR_DISCRIMINATION = 20;
const DISCRIMINATION_SPLIT = 0.27; // classic top/bottom 27% item-analysis split

@Injectable()
export class QuestionStatsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Admin-triggered recompute (POST /api/admin/questions/refresh-stats) —
   * same manual-trigger pattern as plan_day/send_notification, standing in
   * for the spec's nightly refresh_question_stats job (no real cron in this
   * sandbox). p_value/discrimination stay null below MIN_SAMPLE_FOR_REPORTING
   * / MIN_STUDENTS_FOR_DISCRIMINATION — same statistical-honesty discipline
   * as student-facing reports, never a flattering fake number on low volume.
   */
  async refreshAll() {
    const allAnswers = await this.prisma.answer.findMany({ select: { studentId: true, isCorrect: true } });
    const byStudent = new Map<string, { correct: number; total: number }>();
    for (const a of allAnswers) {
      const s = byStudent.get(a.studentId) ?? { correct: 0, total: 0 };
      s.total += 1;
      if (a.isCorrect) s.correct += 1;
      byStudent.set(a.studentId, s);
    }
    const ranked = [...byStudent.entries()]
      .map(([studentId, s]) => ({ studentId, accuracy: s.correct / s.total }))
      .sort((a, b) => b.accuracy - a.accuracy);

    const groupSize = Math.floor(ranked.length * DISCRIMINATION_SPLIT);
    const canDiscriminate = ranked.length >= MIN_STUDENTS_FOR_DISCRIMINATION && groupSize >= 1;
    const topIds = new Set(canDiscriminate ? ranked.slice(0, groupSize).map((r) => r.studentId) : []);
    const bottomIds = new Set(canDiscriminate ? ranked.slice(-groupSize).map((r) => r.studentId) : []);

    const versions = await this.prisma.questionVersion.findMany({ select: { id: true } });
    let processed = 0;

    for (const v of versions) {
      const answers = await this.prisma.answer.findMany({
        where: { questionVersionId: v.id },
        select: { studentId: true, isCorrect: true, selectedKey: true, timeTakenMs: true, timedOut: true },
      });
      const nServed = answers.length;
      if (nServed === 0) continue;

      const nCorrect = answers.filter((a) => a.isCorrect).length;
      const meanTimeMs = Math.round(answers.reduce((sum, a) => sum + a.timeTakenMs, 0) / nServed);
      const timeoutRate = answers.filter((a) => a.timedOut).length / nServed;
      const distractorDist: Record<string, number> = {};
      for (const a of answers) {
        if (a.selectedKey) distractorDist[a.selectedKey] = (distractorDist[a.selectedKey] ?? 0) + 1;
      }

      let pValue: number | null = null;
      let discrimination: number | null = null;
      if (nServed >= MIN_SAMPLE_FOR_REPORTING) {
        pValue = nCorrect / nServed;
        if (canDiscriminate) {
          const topAnswers = answers.filter((a) => topIds.has(a.studentId));
          const bottomAnswers = answers.filter((a) => bottomIds.has(a.studentId));
          if (topAnswers.length > 0 && bottomAnswers.length > 0) {
            const topRate = topAnswers.filter((a) => a.isCorrect).length / topAnswers.length;
            const bottomRate = bottomAnswers.filter((a) => a.isCorrect).length / bottomAnswers.length;
            discrimination = topRate - bottomRate;
          }
        }
      }

      await this.prisma.questionStats.upsert({
        where: { questionVersionId: v.id },
        create: { questionVersionId: v.id, nServed, nCorrect, pValue, discrimination, meanTimeMs, timeoutRate, distractorDist },
        update: { nServed, nCorrect, pValue, discrimination, meanTimeMs, timeoutRate, distractorDist },
      });
      processed += 1;
    }

    return { versionsProcessed: processed, studentsRanked: ranked.length, discriminationEnabled: canDiscriminate };
  }
}
