import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LabelState, SectionState } from '../selection/selection-engine.types';
import { selectLabelsForBundle, selectSectionForDay } from '../selection/selection-engine';
import { AuditLogService } from '../admin-ops/audit-log.service';

const PLACEMENT_SIZE = 12;
// SEL-004 — a question answered wrong re-enters the pool after ~21 days,
// flagged as review (WathbService.answer() sets Answer.isReview off a prior
// answer's existence). A question answered correctly never re-enters —
// once mastered, stays excluded for good.
const REVIEW_COOLDOWN_DAYS = 21;

@Injectable()
export class WathbGenerationService {
  private readonly logger = new Logger(WathbGenerationService.name);

  constructor(
    private prisma: PrismaService,
    private auditLog: AuditLogService,
  ) {}

  private async eligibleLabels(testId: string, track: 'scientific' | 'humanities' | null) {
    // Filtered in application code rather than via Prisma's `isEmpty` list
    // filter, which does not reliably match empty Postgres enum-array columns
    // (verified against Prisma 5.22 / pg16 — an empty appliesToTracks[] was
    // silently excluded instead of treated as "applies to every track").
    const all = await this.prisma.label.findMany({
      where: { isRetired: false, area: { section: { testId } } },
      include: { area: { include: { section: true } } },
    });
    return all.filter((l) => l.area.appliesToTracks.length === 0 || (track != null && l.area.appliesToTracks.includes(track)));
  }

  /** Picks one unseen (or spaced-review-eligible) published question near targetDifficulty for a label, expanding the window if needed. */
  private async pickQuestion(labelId: string, targetDifficulty: number, studentId: string, excludeQuestionIds: Set<string>) {
    const answered = await this.prisma.answer.findMany({
      where: { studentId },
      select: { questionId: true, isCorrect: true, answeredAt: true },
      orderBy: { answeredAt: 'desc' },
    });
    // Keep only the most recent answer per question — a question can be
    // answered more than once once it's re-entered the pool as a review item.
    const latestByQuestion = new Map<string, { isCorrect: boolean; answeredAt: Date }>();
    for (const a of answered) {
      if (!latestByQuestion.has(a.questionId)) latestByQuestion.set(a.questionId, a);
    }
    const nowMs = Date.now();
    const seen = new Set<string>();
    for (const [questionId, a] of latestByQuestion) {
      if (a.isCorrect) {
        seen.add(questionId); // mastered — excluded for good
        continue;
      }
      const daysSince = (nowMs - a.answeredAt.getTime()) / 86400_000;
      if (daysSince < REVIEW_COOLDOWN_DAYS) seen.add(questionId); // still cooling down
      // else: cooldown elapsed — eligible again as a spaced-review item
    }

    for (const window of [0, 1, 2, 3, 4]) {
      const lo = Math.max(1, targetDifficulty - window);
      const hi = Math.min(5, targetDifficulty + window);
      const candidates = await this.prisma.question.findMany({
        where: {
          labelId,
          status: 'published',
          difficulty: { gte: lo, lte: hi },
          id: { notIn: [...seen, ...excludeQuestionIds] },
        },
        include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
        take: 20,
      });
      if (candidates.length > 0) {
        return candidates[Math.floor(Math.random() * candidates.length)];
      }
      if (window === 4) break;
    }
    return null;
  }

  async generatePlacement(studentId: string, testId: string, track: 'scientific' | 'humanities' | null, forDate?: Date) {
    const labels = await this.eligibleLabels(testId, track);
    const picks: string[] = [];
    // Uniform coverage — no weakness signal exists yet (spec §6.4 "cold start").
    for (let i = 0; i < PLACEMENT_SIZE && labels.length > 0; i++) {
      picks.push(labels[i % labels.length].id);
    }
    return this.buildWathb(studentId, picks.map((labelId) => ({ labelId, targetDifficulty: 3 })), 'placement', forDate);
  }

  async generateDaily(studentId: string, testId: string, track: 'scientific' | 'humanities' | null, bundleSize: number, forDate?: Date) {
    const labels = await this.eligibleLabels(testId, track);
    if (labels.length === 0) return null;

    const stats = await this.prisma.studentLabelStat.findMany({ where: { studentId, labelId: { in: labels.map((l) => l.id) } } });
    const statByLabel = new Map(stats.map((s) => [s.labelId, s]));
    const now = Date.now();

    const labelStates: LabelState[] = labels.map((l) => {
      const s = statByLabel.get(l.id);
      const nAnswered = s?.nAnswered ?? 0;
      return {
        labelId: l.id,
        sectionId: l.area.sectionId,
        accuracy: nAnswered > 0 ? s!.nCorrect / nAnswered : 0.5,
        nAnswered,
        lastServedDaysAgo: s?.lastServedAt ? Math.floor((now - s.lastServedAt.getTime()) / 86400000) : null,
        curriculumWeight: l.area.section.weight,
        difficultyLevel: s?.difficultyLevel ?? 3,
      };
    });

    // SEL-001 — one section per Wathb. Aggregate the same per-label stats one
    // level up the taxonomy rather than a separate query.
    const sectionAgg = new Map<string, { nAnswered: number; nCorrect: number; lastServedDaysAgo: number | null }>();
    for (const l of labels) {
      const s = statByLabel.get(l.id);
      const nAnswered = s?.nAnswered ?? 0;
      const nCorrect = s?.nCorrect ?? 0;
      const daysAgo = s?.lastServedAt ? Math.floor((now - s.lastServedAt.getTime()) / 86400000) : null;
      const cur = sectionAgg.get(l.area.sectionId) ?? { nAnswered: 0, nCorrect: 0, lastServedDaysAgo: null };
      cur.nAnswered += nAnswered;
      cur.nCorrect += nCorrect;
      if (daysAgo !== null && (cur.lastServedDaysAgo === null || daysAgo < cur.lastServedDaysAgo)) cur.lastServedDaysAgo = daysAgo;
      sectionAgg.set(l.area.sectionId, cur);
    }
    const sectionStates: SectionState[] = [...sectionAgg.entries()].map(([sectionId, a]) => ({
      sectionId,
      accuracy: a.nAnswered > 0 ? a.nCorrect / a.nAnswered : 0.5,
      nAnswered: a.nAnswered,
      lastServedDaysAgo: a.lastServedDaysAgo,
    }));

    const chosenSectionId = selectSectionForDay(sectionStates);
    const scopedLabels = chosenSectionId ? labelStates.filter((l) => l.sectionId === chosenSectionId) : labelStates;

    const picks = selectLabelsForBundle(scopedLabels, { bundleSize });
    return this.buildWathb(studentId, picks, 'standard', forDate);
  }

  private async buildWathb(
    studentId: string,
    picks: { labelId: string; targetDifficulty: number }[],
    bundleType: 'placement' | 'standard',
    forDate?: Date,
  ) {
    const used = new Set<string>();
    const resolved: { labelId: string; question: Awaited<ReturnType<WathbGenerationService['pickQuestion']>> }[] = [];
    for (const pick of picks) {
      const q = await this.pickQuestion(pick.labelId, pick.targetDifficulty, studentId, used);
      if (!q) {
        this.logger.warn(`bank exhaustion: label ${pick.labelId} has no unseen published question for student ${studentId}`);
        // SEL-006 — "fire an admin alert rather than error". No dedicated
        // event/alert table exists, so this reuses AuditLog (already
        // queryable, timestamped, actor-optional) rather than adding a new
        // table for one event kind; OverviewService.alerts() surfaces
        // recent entries of this action.
        await this.auditLog.record({
          actorId: null,
          actorLabel: 'system',
          action: 'selection.bank_exhausted',
          entityType: 'Label',
          entityId: pick.labelId,
          note: `no unseen/review-eligible published question for student ${studentId}`,
        });
        continue;
      }
      used.add(q.id);
      resolved.push({ labelId: pick.labelId, question: q });
    }
    if (resolved.length === 0) return null;

    const scheduledFor = forDate ? new Date(forDate) : new Date();
    scheduledFor.setUTCHours(0, 0, 0, 0);

    // servedAt is always null at creation, even for position 0 — a bundle can
    // be pre-generated by plan_day the night before nobody has opened it yet.
    // WathbService.today() sets servedAt for position 0 the moment the
    // student actually opens the bundle, which is the real "served" moment.
    return this.prisma.wathb.create({
      data: {
        studentId,
        scheduledFor,
        bundleType,
        status: 'pending',
        questions: {
          create: resolved.map((r, i) => ({
            position: i,
            questionId: r.question!.id,
            questionVersionId: r.question!.currentVersionId ?? r.question!.versions[0].id,
          })),
        },
      },
      include: { questions: { orderBy: { position: 'asc' }, include: { questionVersion: true, question: { include: { label: true } } } } },
    });
  }
}
