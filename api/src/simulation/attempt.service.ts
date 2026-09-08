import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SimulationAttempt } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EligibilityService } from './eligibility.service';
import { FormService } from './form.service';
import { SimulationNotifyService } from './simulation-notify.service';
import {
  acceptsAnswer,
  closeReasonFor,
  isExpired,
  nextAction,
  remainingMs,
  SectionWindow,
  terminalStatus,
} from './attempt-timing.util';
import { applyScoringProfile, ScoredAnswer, scoreAttempt, SectionMeta } from './scoring.util';

/** §4 — "static forms for the first 3 attempts, dynamic thereafter." */
export const STATIC_ATTEMPT_LIMIT = 3;

@Injectable()
export class AttemptService {
  constructor(
    private prisma: PrismaService,
    private eligibility: EligibilityService,
    private forms: FormService,
    private notify: SimulationNotifyService,
  ) {}

  // ---------------------------------------------------------------- reading

  /** Published blueprints for a test, each with this student's access state. */
  async available(studentId: string, testId?: string) {
    const student = await this.prisma.student.findUnique({
      where: { userId: studentId },
      select: { targetTestId: true },
    });
    const scope = testId ?? student?.targetTestId ?? undefined;

    const blueprints = await this.prisma.simulationBlueprint.findMany({
      where: { status: 'published', ...(scope ? { testId: scope } : {}) },
      select: {
        id: true,
        nameAr: true,
        mode: true,
        totalQuestions: true,
        sectionCount: true,
        sectionDurationS: true,
        calculatorAllowed: true,
        breakBetweenSections: true,
        test: { select: { id: true, nameAr: true } },
      },
    });

    return Promise.all(
      blueprints.map(async (bp) => ({ ...bp, access: await this.eligibility.access(studentId, bp.id) })),
    );
  }

  private async openAttempt(studentId: string) {
    return this.prisma.simulationAttempt.findFirst({
      where: { studentId, status: { in: ['not_started', 'in_progress'] } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---------------------------------------------------------------- starting

  /**
   * §5.5/§5.6 — start an attempt.
   *
   * Both gates and the entitlement are re-checked here regardless of what the
   * client believes (acceptance criteria 7 and 8), and the entitlement is
   * bound to the attempt at creation rather than decremented from a counter,
   * so a failed start costs nothing and a void refunds by clearing one field.
   */
  async start(studentId: string, blueprintId: string, now = new Date()) {
    const existing = await this.openAttempt(studentId);
    if (existing) {
      // §5.4 — one active attempt per student. Abandoning is explicit and
      // costs the old attempt's entitlement, so it is never done implicitly.
      throw new BadRequestException('لديك محاولة محاكٍ مفتوحة — أكملها أو اتركها صراحةً قبل بدء محاولة جديدة.');
    }

    const access = await this.eligibility.access(studentId, blueprintId, now);
    if (!access.canStart) throw new ForbiddenException(access.blockedAr ?? 'المحاكي غير متاح.');

    const bp = await this.prisma.simulationBlueprint.findUniqueOrThrow({
      where: { id: blueprintId },
      select: { id: true, status: true, testId: true },
    });
    if (bp.status !== 'published') throw new BadRequestException('هذا المحاكي غير متاح حاليًا.');

    const form = await this.pickForm(studentId, blueprintId, now);

    // §7.2 — the enrolment snapshot. Cohort analytics never join live to
    // enrolment, so a student who transfers schools does not retroactively
    // move results they earned somewhere else.
    const student = await this.prisma.student.findUnique({
      where: { userId: studentId },
      select: { school: { select: { id: true, nameAr: true, city: { select: { id: true, nameAr: true, regionId: true } } } } },
    });

    const attempt = await this.prisma.$transaction(async (tx) => {
      const created = await tx.simulationAttempt.create({
        data: {
          studentId,
          formId: form.id,
          blueprintId,
          status: 'in_progress',
          startedAt: now,
          entitlementId: access.entitlement.subscriptionId,
          schoolSnapshot: student?.school?.nameAr ?? null,
          citySnapshot: student?.school?.city?.nameAr ?? null,
          regionSnapshot: student?.school?.city?.regionId ?? null,
        },
      });

      // An override is one-off (§5.6): burn it here, on the attempt it
      // actually let through, not when it was granted.
      if (access.eligibility.viaOverride) {
        const override = await tx.simulationOverride.findFirst({
          where: { studentId, blueprintId, usedAt: null },
          orderBy: { grantedAt: 'asc' },
          select: { id: true },
        });
        if (override) await tx.simulationOverride.update({ where: { id: override.id }, data: { usedAt: now } });
      }

      await tx.simulationEventLog.create({
        data: { attemptId: created.id, type: 'attempt_start', detail: form.code, at: now },
      });
      return created;
    });

    return this.state(studentId, now, attempt.id);
  }

  /**
   * §4 — static forms for the first three attempts, dynamic after.
   *
   * A dynamic form is materialised for this student alone and marked
   * non-static, so §7.2's cohort percentile can exclude it: comparing a
   * bespoke form against نموذج ٣ would be comparing two different exams.
   */
  private async pickForm(studentId: string, blueprintId: string, now: Date) {
    const priorAttempts = await this.prisma.simulationAttempt.count({ where: { studentId, blueprintId } });

    const seen = await this.prisma.simulationAttempt.findMany({
      where: { studentId, blueprintId },
      select: { formId: true },
    });
    const seenFormIds = new Set(seen.map((s) => s.formId));

    if (priorAttempts < STATIC_ATTEMPT_LIMIT) {
      const candidate = await this.prisma.simulationForm.findFirst({
        where: { blueprintId, isStatic: true, status: 'published', id: { notIn: [...seenFormIds] } },
        orderBy: { publishedAt: 'asc' },
      });
      if (candidate) return candidate;
    }

    // Either the static forms are exhausted or this is a repeat attempt.
    // §4.4 exposure control is per student here: what matters is that they do
    // not meet an item they have already sat.
    const seenItems = await this.prisma.simulationFormItem.findMany({
      where: { form: { attempts: { some: { studentId, blueprintId } } } },
      select: { questionId: true },
    });

    return this.forms.generate(
      blueprintId,
      {
        code: `نموذج مخصص · ${now.toISOString().slice(0, 10)} · ${studentId.slice(0, 6)}`,
        avoidReuse: false,
        isStatic: false,
        forStudentId: studentId,
        excludeQuestionIds: seenItems.map((i) => i.questionId),
        publish: true,
        note: 'نموذج مخصص وُلِّد تلقائيًا عند بدء المحاولة',
      },
      studentId,
    );
  }

  // ---------------------------------------------------------------- runtime

  /**
   * The one read the exam screen makes, and the only place the clock is
   * interpreted. Every call walks the attempt forward first — locking an
   * elapsed section, finalizing a finished or abandoned one — so a student who
   * closes the tab and returns is handled by the same code path as one who
   * never left. It never *opens* a section: that is beginSection().
   */
  async state(studentId: string, now = new Date(), attemptId?: string) {
    const attempt = attemptId
      ? await this.prisma.simulationAttempt.findUnique({ where: { id: attemptId } })
      : await this.openAttempt(studentId);
    if (!attempt) return { attempt: null as null };
    if (attempt.studentId !== studentId) throw new ForbiddenException('ليست محاولتك.');

    const advanced = await this.advance(attempt, now);
    if (advanced.status !== 'in_progress') {
      return { attempt: { id: advanced.id, status: advanced.status, finalizedAt: advanced.finalizedAt } };
    }

    const [bp, sections] = await Promise.all([
      this.prisma.simulationBlueprint.findUniqueOrThrow({
        where: { id: advanced.blueprintId },
        select: {
          nameAr: true,
          sectionCount: true,
          navigationPolicy: true,
          allowFlagReview: true,
          calculatorAllowed: true,
          scratchpad: true,
          sections: { select: { orderIndex: true, part: true, questionCount: true, durationS: true } },
        },
      }),
      this.prisma.simulationAttemptSection.findMany({ where: { attemptId: advanced.id } }),
    ]);

    const open = sections.find((s) => !s.submittedAt);
    if (!open) {
      // §6.2 — the section intro. The clock has NOT started: advance() never
      // opens a section by itself, because a page load is not a decision to
      // begin. Auto-starting would spend the intro's ten seconds of exam time,
      // and would burn a whole section for a student who loaded the screen and
      // walked away between sections.
      const nextIndex = sections.length;
      const template = bp.sections.find((s) => s.orderIndex === nextIndex);
      return {
        attempt: { id: advanced.id, status: advanced.status },
        blueprint: bp,
        pendingSection: template
          ? {
              index: nextIndex,
              of: bp.sectionCount,
              part: template.part,
              questionCount: template.questionCount,
              durationS: template.durationS,
            }
          : null,
        completedSections: sections.length,
      };
    }

    const template = bp.sections.find((s) => s.orderIndex === open.sectionIndex);
    const items = await this.prisma.simulationFormItem.findMany({
      where: { formId: advanced.formId, sectionIndex: open.sectionIndex },
      orderBy: { position: 'asc' },
      include: {
        question: { select: { type: true, passage: { select: { id: true, body: true } } } },
        questionVersion: { select: { stem: true, stemImageUrl: true, options: true } },
      },
    });

    const answers = await this.prisma.simulationAnswer.findMany({
      where: { attemptId: advanced.id, formItemId: { in: items.map((i) => i.id) } },
      select: { formItemId: true, selectedKey: true, flagged: true },
    });
    const byItem = new Map(answers.map((a) => [a.formItemId, a]));

    return {
      attempt: { id: advanced.id, status: advanced.status },
      blueprint: bp,
      section: {
        index: open.sectionIndex,
        part: template?.part ?? 'mixed',
        of: bp.sectionCount,
        remainingMs: remainingMs(open as SectionWindow, now),
        // The deadline is sent so the client can render a smooth countdown;
        // it is not authority for anything. Every write re-checks it here.
        expiresAt: open.expiresAt,
      },
      questions: items.map((i) => ({
        formItemId: i.id,
        position: i.position,
        type: i.question.type,
        stem: i.questionVersion.stem,
        stemImageUrl: i.questionVersion.stemImageUrl,
        options: i.questionVersion.options,
        passage: i.question.passage ? { id: i.question.passage.id, body: i.question.passage.body } : null,
        selectedKey: byItem.get(i.id)?.selectedKey ?? null,
        flagged: byItem.get(i.id)?.flagged ?? false,
        // §5.3 — no correct answer, no explanation, and no isScored flag
        // during the run. Everything unlocks at submission, and shipping
        // isScored would tell a student which items to skip.
      })),
    };
  }

  /**
   * Apply whatever the clock says has happened since the last request.
   *
   * Loops because one request can cross several boundaries at once — a student
   * gone for an hour has both an elapsed section to lock and the next one to
   * open. Bounded by the section count so a bad state can never spin.
   */
  private async advance(attempt: SimulationAttempt, now: Date): Promise<SimulationAttempt> {
    if (attempt.status !== 'in_progress' && attempt.status !== 'not_started') return attempt;

    const bp = await this.prisma.simulationBlueprint.findUniqueOrThrow({
      where: { id: attempt.blueprintId },
      select: { sectionCount: true, sections: { select: { orderIndex: true, durationS: true } } },
    });

    let current = attempt;
    for (let guard = 0; guard <= bp.sectionCount + 1; guard++) {
      const sections = await this.prisma.simulationAttemptSection.findMany({
        where: { attemptId: current.id },
        orderBy: { sectionIndex: 'asc' },
      });
      const lastEvent = await this.prisma.simulationEventLog.findFirst({
        where: { attemptId: current.id },
        orderBy: { at: 'desc' },
        select: { at: true },
      });

      const action = nextAction(
        {
          sectionCount: bp.sectionCount,
          sections: sections as SectionWindow[],
          lastActivityAt: lastEvent?.at ?? current.startedAt ?? current.createdAt,
        },
        now,
      );

      if (action.kind === 'resume') return current;

      if (action.kind === 'lock_section') {
        await this.prisma.simulationAttemptSection.update({
          where: { attemptId_sectionIndex: { attemptId: current.id, sectionIndex: action.sectionIndex } },
          data: { submittedAt: now, lockReason: 'timeout' },
        });
        await this.log(current.id, 'section_lock', `${action.sectionIndex}:timeout`, now);
        continue;
      }

      // A section waiting to be started is a decision for the student to make
      // on the intro screen (§6.2), not something a page load performs for
      // them. state() renders the intro; beginSection() starts the clock.
      if (action.kind === 'start_section') return current;

      return this.finalize(current, action.reason === 'abandoned' ? 'abandon' : 'walk', now);
    }

    return current;
  }

  private log(attemptId: string, type: string, detail: string | null, at: Date) {
    return this.prisma.simulationEventLog.create({ data: { attemptId, type, detail, at } });
  }

  // ---------------------------------------------------------------- writing

  private async openSection(studentId: string, attemptId: string, now: Date) {
    const attempt = await this.prisma.simulationAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new NotFoundException('المحاولة غير موجودة');
    if (attempt.studentId !== studentId) throw new ForbiddenException('ليست محاولتك.');
    if (attempt.status !== 'in_progress') throw new BadRequestException('انتهت هذه المحاولة.');

    const section = await this.prisma.simulationAttemptSection.findFirst({
      where: { attemptId, submittedAt: null },
      orderBy: { sectionIndex: 'asc' },
    });
    if (!section) throw new BadRequestException('لا يوجد قسم مفتوح.');
    return { attempt, section };
  }

  /**
   * §6.2 — the student begins a section from the intro screen, and only then
   * does its clock start.
   *
   * This is the one place `expiresAt` is ever written, and it is written once
   * from the server's own clock. Nothing recomputes it afterwards: that is
   * what makes closing the tab (acceptance criterion 5) resume with the
   * elapsed time rather than a fresh 25 minutes.
   *
   * Idempotent by the unique (attemptId, sectionIndex) key — a double-tap on
   * "ابدأ القسم", or a retried request, returns the section that already
   * exists instead of restarting its clock.
   */
  async beginSection(studentId: string, attemptId: string, now = new Date()) {
    const attempt = await this.prisma.simulationAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new NotFoundException('المحاولة غير موجودة');
    if (attempt.studentId !== studentId) throw new ForbiddenException('ليست محاولتك.');

    // Walk the clock first: a student who sat on the intro screen past the
    // abandon window must be finalized, not handed a new section.
    const advanced = await this.advance(attempt, now);
    if (advanced.status !== 'in_progress') return this.state(studentId, now, attemptId);

    const sections = await this.prisma.simulationAttemptSection.findMany({
      where: { attemptId },
      orderBy: { sectionIndex: 'asc' },
    });
    if (sections.some((s) => !s.submittedAt)) {
      // A section is already running; starting another would be a second
      // clock on the same attempt.
      return this.state(studentId, now, attemptId);
    }

    const bp = await this.prisma.simulationBlueprint.findUniqueOrThrow({
      where: { id: advanced.blueprintId },
      select: { sectionCount: true, sections: { select: { orderIndex: true, durationS: true } } },
    });
    const nextIndex = sections.length;
    if (nextIndex >= bp.sectionCount) return this.state(studentId, now, attemptId);

    const template = bp.sections.find((s) => s.orderIndex === nextIndex);
    if (!template) throw new BadRequestException('القسم غير معرّف في المخطط.');

    await this.prisma.simulationAttemptSection.create({
      data: {
        attemptId,
        sectionIndex: nextIndex,
        startedAt: now,
        expiresAt: new Date(now.getTime() + template.durationS * 1000),
      },
    });
    await this.log(attemptId, 'section_start', String(nextIndex), now);
    return this.state(studentId, now, attemptId);
  }

  /**
   * §5.1/§10 — record an answer.
   *
   * The deadline check happens against the stored `expiresAt`, so a client
   * clock set back, a queued request replayed later, or a tab reopened after
   * the lock all fail the same way.
   */
  async answer(
    studentId: string,
    attemptId: string,
    formItemId: string,
    selectedKey: string | null,
    timeSpentMs: number,
    now = new Date(),
  ) {
    const { attempt, section } = await this.openSection(studentId, attemptId, now);

    if (!acceptsAnswer(section as SectionWindow, now)) {
      throw new BadRequestException('انتهى وقت هذا القسم.');
    }

    const item = await this.prisma.simulationFormItem.findUnique({
      where: { id: formItemId },
      include: { questionVersion: { select: { correctKey: true } } },
    });
    if (!item) throw new NotFoundException('السؤال غير موجود');
    // A form item id is not a capability: without these two checks any item
    // in the database would be answerable by id, including one from another
    // student's form or from a section of this form that is already locked.
    if (item.formId !== attempt.formId) throw new ForbiddenException('هذا السؤال ليس من نموذجك.');
    if (item.sectionIndex !== section.sectionIndex) throw new BadRequestException('هذا السؤال ليس في القسم الحالي.');

    const existing = await this.prisma.simulationAnswer.findUnique({
      where: { attemptId_formItemId: { attemptId, formItemId } },
    });

    // Time is client-reported: only the browser knows how long a question was
    // on screen under free navigation. Clamped to the section length so it can
    // colour the pacing report without a fabricated value distorting it, and
    // it never touches the score.
    const capMs = section.expiresAt.getTime() - section.startedAt.getTime();
    const clamped = Math.min(Math.max(0, Math.round(timeSpentMs) || 0), capMs);

    const isCorrect = selectedKey === null ? null : selectedKey === item.questionVersion.correctKey;
    // §7.4 — first answer vs final answer, a signal for both guessing and
    // second-guessing. Only a real change counts; re-picking the same option
    // is not a change of mind.
    const changed = existing && existing.selectedKey !== null && existing.selectedKey !== selectedKey;

    await this.prisma.simulationAnswer.upsert({
      where: { attemptId_formItemId: { attemptId, formItemId } },
      create: { attemptId, formItemId, selectedKey, isCorrect, timeSpentMs: clamped, answeredAt: now },
      update: {
        selectedKey,
        isCorrect,
        timeSpentMs: clamped,
        answeredAt: now,
        answerChangesCount: { increment: changed ? 1 : 0 },
      },
    });

    await this.log(attemptId, 'answer', String(item.position), now);
    return { ok: true, remainingMs: remainingMs(section as SectionWindow, now) };
  }

  /** §5.2 — تمييز للمراجعة. Allowed for as long as the section is open. */
  async flag(studentId: string, attemptId: string, formItemId: string, flagged: boolean, now = new Date()) {
    const { attempt, section } = await this.openSection(studentId, attemptId, now);
    if (!acceptsAnswer(section as SectionWindow, now)) throw new BadRequestException('انتهى وقت هذا القسم.');

    // Same ownership check as answer(): an id alone must not reach an item
    // outside this form, or one in a section that is already locked.
    const item = await this.prisma.simulationFormItem.findUnique({
      where: { id: formItemId },
      select: { formId: true, sectionIndex: true },
    });
    if (!item) throw new NotFoundException('السؤال غير موجود');
    if (item.formId !== attempt.formId) throw new ForbiddenException('هذا السؤال ليس من نموذجك.');
    if (item.sectionIndex !== section.sectionIndex) throw new BadRequestException('هذا السؤال ليس في القسم الحالي.');

    await this.prisma.simulationAnswer.upsert({
      where: { attemptId_formItemId: { attemptId, formItemId } },
      create: { attemptId, formItemId, flagged },
      update: { flagged },
    });
    return { ok: true };
  }

  /** §5.2 — "إنهاء القسم". Hard-locks; there is no way back. */
  async submitSection(studentId: string, attemptId: string, now = new Date()) {
    const { section } = await this.openSection(studentId, attemptId, now);
    // Not hard-coded 'manual': if the window already elapsed, the section
    // timed out, whoever pressed the button. The report distinguishes the two
    // and a late tap must not relabel a timeout as a finished section.
    const reason = isExpired(section as SectionWindow, now) ? 'timeout' : 'manual';
    await this.prisma.simulationAttemptSection.update({
      where: { id: section.id },
      data: { submittedAt: now, lockReason: reason },
    });
    await this.log(attemptId, 'section_lock', `${section.sectionIndex}:${reason}`, now);
    return this.state(studentId, now, attemptId);
  }

  /** §5.3 — blur/tab-switch and scratchpad events. Logged, never blocking. */
  async event(studentId: string, attemptId: string, type: string, now = new Date()) {
    const allowed = ['focus_lost', 'focus_regained', 'resume', 'scratchpad_open', 'heartbeat'];
    if (!allowed.includes(type)) throw new BadRequestException('نوع حدث غير معروف');
    const attempt = await this.prisma.simulationAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.studentId !== studentId) throw new ForbiddenException('ليست محاولتك.');
    await this.log(attemptId, type, null, now);
    return { ok: true };
  }

  /** §5.4 — leaving deliberately. Costs the entitlement and starts the cooldown. */
  async abandon(studentId: string, attemptId: string, now = new Date()) {
    const attempt = await this.prisma.simulationAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt) throw new NotFoundException('المحاولة غير موجودة');
    if (attempt.studentId !== studentId) throw new ForbiddenException('ليست محاولتك.');
    if (attempt.status !== 'in_progress') throw new BadRequestException('انتهت هذه المحاولة.');
    const done = await this.finalize(attempt, 'abandon', now);
    return { id: done.id, status: done.status };
  }

  // -------------------------------------------------------------- finalizing

  /**
   * Close the attempt and compute its result.
   *
   * Unanswered items are scored as incorrect (§5.4) but reported separately,
   * because "how many did you get right" and "how many did you never reach"
   * are different findings and the second one explains the first.
   */
  async finalize(attempt: SimulationAttempt, trigger: 'walk' | 'abandon' | 'force', now = new Date()) {
    const [bp, sections, items, answers, exits] = await Promise.all([
      this.prisma.simulationBlueprint.findUniqueOrThrow({
        where: { id: attempt.blueprintId },
        select: {
          sectionCount: true,
          sections: { select: { orderIndex: true, part: true } },
          scoringProfiles: { where: { isActive: true }, orderBy: { version: 'desc' }, take: 1 },
        },
      }),
      this.prisma.simulationAttemptSection.findMany({ where: { attemptId: attempt.id } }),
      this.prisma.simulationFormItem.findMany({
        where: { formId: attempt.formId },
        include: {
          question: { select: { difficulty: true, label: { select: { area: { select: { id: true, nameAr: true } } } } } },
        },
      }),
      this.prisma.simulationAnswer.findMany({ where: { attemptId: attempt.id } }),
      this.prisma.simulationEventLog.count({ where: { attemptId: attempt.id, type: 'focus_lost' } }),
    ]);

    const byItem = new Map(answers.map((a) => [a.formItemId, a]));
    const scored: ScoredAnswer[] = items.map((i) => {
      const a = byItem.get(i.id);
      return {
        sectionIndex: i.sectionIndex,
        position: i.position,
        areaId: i.question.label.area.id,
        areaNameAr: i.question.label.area.nameAr,
        difficulty: i.question.difficulty,
        isScored: i.isScored,
        selectedKey: a?.selectedKey ?? null,
        isCorrect: a?.isCorrect ?? null,
        timeSpentMs: a?.timeSpentMs ?? 0,
        flagged: a?.flagged ?? false,
      };
    });

    const meta: SectionMeta[] = bp.sections.map((s) => ({
      sectionIndex: s.orderIndex,
      part: (s.part === 'verbal' || s.part === 'quantitative' ? s.part : 'mixed') as SectionMeta['part'],
      timedOut: sections.find((x) => x.sectionIndex === s.orderIndex)?.lockReason === 'timeout',
    }));

    const score = scoreAttempt(scored, meta, exits);
    const status = terminalStatus(
      { sectionCount: bp.sectionCount, sections: sections as SectionWindow[], lastActivityAt: now },
      trigger,
    );

    const finalized = await this.prisma.$transaction(async (tx) => {
      for (const s of sections.filter((x) => !x.submittedAt)) {
        await tx.simulationAttemptSection.update({
          where: { id: s.id },
          data: { submittedAt: now, lockReason: closeReasonFor(s as SectionWindow, now) },
        });
      }

      await tx.simulationResult.upsert({
        where: { attemptId: attempt.id },
        create: {
          attemptId: attempt.id,
          rawScore: score.rawScore,
          scoredCount: score.scoredCount,
          // §12.1 — null until an equating table exists. A plausible invented
          // number is worse than none: a student plans a قياس sitting on it.
          scaledEstimate: applyScoringProfile(score.rawScore, bp.scoringProfiles[0]?.rawToScaled),
          verbalEstimate: score.verbalEstimate === null ? null : Math.round(score.verbalEstimate),
          quantEstimate: score.quantEstimate === null ? null : Math.round(score.quantEstimate),
          areaBreakdown: score.areaBreakdown as unknown as Prisma.InputJsonValue,
          sectionBreakdown: score.sectionBreakdown as unknown as Prisma.InputJsonValue,
          pacing: { ...score.pacing, experimental: score.experimental, accuracy: score.accuracy } as unknown as Prisma.InputJsonValue,
        },
        update: {},
      });

      await tx.simulationEventLog.create({
        data: { attemptId: attempt.id, type: 'attempt_finalize', detail: `${status}:${trigger}`, at: now },
      });

      return tx.simulationAttempt.update({
        where: { id: attempt.id },
        data: { status, finalizedAt: now },
      });
    });

    // §7.6 — outside the transaction and deliberately not awaited for its
    // result: the exam is over and the result exists whether or not WhatsApp
    // is reachable. A send failure must never roll back a finalized attempt.
    await this.notify.notifyResult(attempt.id);

    return finalized;
  }
}
