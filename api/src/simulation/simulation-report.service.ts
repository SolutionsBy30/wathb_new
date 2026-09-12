import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SessionPayload } from '../auth/auth.types';
import { bandFor, BAND_AR, cohortPercentile } from './percentile.util';
import { difficultyBand } from './scoring.util';
import { AttemptScore, describeForecastAr, forecast, FORECAST_DISCLAIMER_AR } from './score-forecast.util';

/**
 * SIM-016 — §7.2/§7.3 the report, built once and framed per reader.
 *
 * Student, supervisor and admin read the same result object. §7.3 is explicit
 * that the supervisor gets the *full* analysis — this is the report that
 * justifies the subscription — so nothing is withheld from them; only the
 * wording of the header changes, which is the client's job.
 *
 * Admin-only material (seed, blueprint version, answer-change counts, event
 * timeline) is added on top for an admin session rather than being filtered
 * out of a shared payload, so a bug in the filter cannot leak it downward.
 */
@Injectable()
export class SimulationReportService {
  constructor(private prisma: PrismaService) {}

  /**
   * Same scoping rule as the weekly report: a student sees only their own, a
   * supervisor only students actively linked to them, an admin everything.
   */
  private async assertAccess(session: SessionPayload, studentId: string) {
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

  /** Finalized attempts for one student, newest first — the report index. */
  async list(session: SessionPayload, studentId: string) {
    await this.assertAccess(session, studentId);
    const attempts = await this.prisma.simulationAttempt.findMany({
      where: { studentId, finalizedAt: { not: null } },
      orderBy: { finalizedAt: 'desc' },
      select: {
        id: true,
        status: true,
        startedAt: true,
        finalizedAt: true,
        form: { select: { code: true, isStatic: true } },
        blueprint: { select: { nameAr: true, test: { select: { nameAr: true } } } },
        result: { select: { rawScore: true, scoredCount: true, scaledEstimate: true } },
      },
    });
    return attempts.map((a) => ({
      id: a.id,
      status: a.status,
      startedAt: a.startedAt,
      finalizedAt: a.finalizedAt,
      formCode: a.form.code,
      isStatic: a.form.isStatic,
      blueprintNameAr: a.blueprint.nameAr,
      testNameAr: a.blueprint.test.nameAr,
      accuracy: a.result && a.result.scoredCount > 0
        ? Math.round((a.result.rawScore / a.result.scoredCount) * 1000) / 10
        : null,
      scaledEstimate: a.result?.scaledEstimate ?? null,
    }));
  }

  async report(session: SessionPayload, attemptId: string) {
    const attempt = await this.prisma.simulationAttempt.findUnique({
      where: { id: attemptId },
      include: {
        form: { select: { id: true, code: true, isStatic: true, seed: true } },
        blueprint: { select: { id: true, nameAr: true, sectionCount: true, test: { select: { nameAr: true } }, minDaysBetweenAttempts: true } },
        result: true,
        student: { select: { userId: true, user: { select: { name: true } } } },
      },
    });
    if (!attempt) throw new NotFoundException('المحاولة غير موجودة');
    await this.assertAccess(session, attempt.studentId);

    // §5.3 — nothing unlocks during the run. A report request for a live
    // attempt would hand the student every correct answer mid-exam.
    if (!attempt.finalizedAt || !attempt.result) {
      throw new ForbiddenException('لم تُسلَّم هذه المحاولة بعد.');
    }

    const [items, answers, sections, exits] = await Promise.all([
      this.prisma.simulationFormItem.findMany({
        where: { formId: attempt.formId },
        orderBy: [{ sectionIndex: 'asc' }, { position: 'asc' }],
        include: {
          question: {
            select: {
              id: true,
              difficulty: true,
              passage: { select: { body: true } },
              label: { select: { nameAr: true, area: { select: { id: true, nameAr: true } } } },
            },
          },
          questionVersion: { select: { stem: true, stemImageUrl: true, options: true, correctKey: true, explanation: true } },
        },
      }),
      this.prisma.simulationAnswer.findMany({ where: { attemptId } }),
      this.prisma.simulationAttemptSection.findMany({ where: { attemptId }, orderBy: { sectionIndex: 'asc' } }),
      this.prisma.simulationEventLog.count({ where: { attemptId, type: 'focus_lost' } }),
    ]);

    const byItem = new Map(answers.map((a) => [a.formItemId, a]));
    const scoredCount = attempt.result.scoredCount;
    const accuracy = scoredCount > 0 ? Math.round((attempt.result.rawScore / scoredCount) * 1000) / 10 : 0;

    // §7.2 — "vs the student's own previous attempts". Previous means the one
    // before this attempt, not the latest overall: opening an old report
    // should show the comparison that report was about.
    const previous = await this.prisma.simulationAttempt.findFirst({
      where: {
        studentId: attempt.studentId,
        blueprintId: attempt.blueprintId,
        finalizedAt: { not: null, lt: attempt.finalizedAt },
      },
      orderBy: { finalizedAt: 'desc' },
      select: { id: true, finalizedAt: true, result: { select: { rawScore: true, scoredCount: true } } },
    });
    const previousAccuracy =
      previous?.result && previous.result.scoredCount > 0
        ? Math.round((previous.result.rawScore / previous.result.scoredCount) * 1000) / 10
        : null;

    const percentiles = await this.percentiles(attempt.formId, attempt.form.isStatic, attempt.result.rawScore, attempt.schoolSnapshot);

    // SIM-023 — the forecast over this student's whole simulation history, on
    // the report they and their supervisor actually read. The school sees the
    // same figures; it would be strange for them to have a projection the
    // student does not.
    const history = await this.prisma.simulationAttempt.findMany({
      where: { studentId: attempt.studentId, blueprintId: attempt.blueprintId, finalizedAt: { not: null } },
      orderBy: { finalizedAt: 'asc' },
      select: { finalizedAt: true, result: { select: { rawScore: true, scoredCount: true } } },
    });
    const scores: AttemptScore[] = history
      .filter((h) => h.result && h.result.scoredCount > 0 && h.finalizedAt)
      .map((h) => ({
        accuracy: Math.round((h.result!.rawScore / h.result!.scoredCount) * 1000) / 10,
        finalizedAt: h.finalizedAt!,
      }));
    const scoreForecast = forecast(scores);

    const questions = items.map((i) => {
      const a = byItem.get(i.id);
      return {
        formItemId: i.id,
        sectionIndex: i.sectionIndex,
        position: i.position,
        areaId: i.question.label.area.id,
        areaNameAr: i.question.label.area.nameAr,
        labelNameAr: i.question.label.nameAr,
        difficultyBand: difficultyBand(i.question.difficulty),
        // §7.1 — an experimental item is still shown: the student answered it
        // and hiding it would read as a missing question. It is labelled so
        // nobody counts it toward the score.
        isScored: i.isScored,
        stem: i.questionVersion.stem,
        stemImageUrl: i.questionVersion.stemImageUrl,
        options: i.questionVersion.options,
        passage: i.question.passage?.body ?? null,
        selectedKey: a?.selectedKey ?? null,
        correctKey: i.questionVersion.correctKey,
        isCorrect: a?.isCorrect ?? null,
        explanation: i.questionVersion.explanation,
        timeSpentMs: a?.timeSpentMs ?? 0,
        flagged: a?.flagged ?? false,
      };
    });

    const areaBreakdown = (attempt.result.areaBreakdown as unknown as { areaId: string; accuracy: number }[]) ?? [];
    const pacing = (attempt.result.pacing as unknown as Record<string, unknown>) ?? {};

    const base = {
      attempt: {
        id: attempt.id,
        status: attempt.status,
        startedAt: attempt.startedAt,
        finalizedAt: attempt.finalizedAt,
        formCode: attempt.form.code,
        isStatic: attempt.form.isStatic,
        blueprintNameAr: attempt.blueprint.nameAr,
        testNameAr: attempt.blueprint.test.nameAr,
        studentName: attempt.student.user.name,
      },
      totals: {
        rawScore: attempt.result.rawScore,
        scoredCount,
        accuracy,
        band: bandFor(accuracy),
        bandAr: BAND_AR[bandFor(accuracy)],
        // §7.1 — null until an equating table exists (§12.1). The client shows
        // nothing rather than a placeholder, and it is always labelled
        // "درجة تقديرية" where it does appear.
        scaledEstimate: attempt.result.scaledEstimate,
        verbalEstimate: attempt.result.verbalEstimate,
        quantEstimate: attempt.result.quantEstimate,
        verbalBandAr: attempt.result.verbalEstimate === null ? null : BAND_AR[bandFor(attempt.result.verbalEstimate)],
        quantBandAr: attempt.result.quantEstimate === null ? null : BAND_AR[bandFor(attempt.result.quantEstimate)],
      },
      previous: previous
        ? { id: previous.id, finalizedAt: previous.finalizedAt, accuracy: previousAccuracy, delta: previousAccuracy === null ? null : Math.round((accuracy - previousAccuracy) * 10) / 10 }
        : null,
      percentiles,
      areaBreakdown: attempt.result.areaBreakdown,
      sectionBreakdown: attempt.result.sectionBreakdown,
      pacing: { ...pacing, screenExits: exits },
      // §7.2 — the same three areas that feed the post-simulation plan. The
      // breakdown is already sorted weakest first by the scorer.
      focusAreas: areaBreakdown.slice(0, 3),
      nextEligibleAt: new Date(attempt.finalizedAt.getTime() + attempt.blueprint.minDaysBetweenAttempts * 86_400_000),
      forecast: scoreForecast,
      forecastNoteAr: scoreForecast ? describeForecastAr(scoreForecast) : null,
      forecastDisclaimerAr: FORECAST_DISCLAIMER_AR,
      questions,
    };

    if (session.kind !== 'admin') return base;

    // §7.4 — the per-attempt inspector's extras, added for an admin rather
    // than stripped for everyone else.
    const events = await this.prisma.simulationEventLog.findMany({
      where: { attemptId },
      orderBy: { at: 'asc' },
      select: { type: true, detail: true, at: true },
    });
    return {
      ...base,
      admin: {
        formId: attempt.form.id,
        seed: attempt.form.seed,
        blueprintId: attempt.blueprint.id,
        entitlementId: attempt.entitlementId,
        schoolSnapshot: attempt.schoolSnapshot,
        citySnapshot: attempt.citySnapshot,
        regionSnapshot: attempt.regionSnapshot,
        events,
        answerChanges: answers
          .filter((a) => a.answerChangesCount > 0)
          .map((a) => ({ formItemId: a.formItemId, changes: a.answerChangesCount })),
        experimental: questions
          .filter((q) => !q.isScored)
          .map((q) => ({ formItemId: q.formItemId, areaNameAr: q.areaNameAr, isCorrect: q.isCorrect })),
      },
    };
  }

  /**
   * §7.2 — platform and school percentile, both against the same form.
   *
   * Raw score rather than accuracy: everyone sitting one static form answered
   * the same number of scored items, so the two rank identically, and the raw
   * score avoids a rounding tie that accuracy would invent.
   */
  private async percentiles(formId: string, isStatic: boolean, rawScore: number, schoolSnapshot: string | null) {
    const rows = await this.prisma.simulationResult.findMany({
      where: { attempt: { formId, finalizedAt: { not: null } } },
      select: { rawScore: true, attempt: { select: { schoolSnapshot: true } } },
    });

    const all = rows.map((r) => r.rawScore);
    const platform = cohortPercentile(rawScore, all, isStatic);

    const school = schoolSnapshot
      ? cohortPercentile(rawScore, rows.filter((r) => r.attempt.schoolSnapshot === schoolSnapshot).map((r) => r.rawScore), isStatic)
      : { percentile: null, cohortSize: 0, reason: 'cohort_too_small' as const };

    return { platform, school };
  }
}
