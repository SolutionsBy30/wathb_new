import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../admin-ops/audit-log.service';
import { BlueprintService } from './blueprint.service';
import { assembleForm, CandidateItem, checkBankReadiness, SectionPlan } from './form-assembly.util';

/** Student-facing codes are written in Arabic-Indic digits, like the rest of the app. */
const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
export function toArabicDigits(n: number): string {
  return String(n).replace(/\d/g, (d) => AR_DIGITS[Number(d)]);
}

export interface AreaReadiness {
  areaId: string;
  areaNameAr: string;
  required: number;
  available: number;
  /** How many candidates sit in each authored difficulty level, 1..5. */
  difficultySpread: Record<number, number>;
}

/**
 * SIM-005 — §4 form generation and §9 bank readiness.
 *
 * The pure rules live in form-assembly.util; this service is the part that
 * needs a database: which questions are even candidates, what a form is
 * numbered, and what publishing does.
 */
@Injectable()
export class FormService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditLogService,
    private blueprints: BlueprintService,
  ) {}

  /**
   * Candidate pool for a set of areas.
   *
   * Only published questions with a current version: a draft or retired item
   * has no business in an exam-condition form, and a question without a
   * current version has nothing to pin (§10 — a form keeps the snapshot
   * version, so edits never reach a live form).
   */
  private async candidates(areaIds: string[], excludeQuestionIds: Set<string>): Promise<CandidateItem[]> {
    if (areaIds.length === 0) return [];

    const questions = await this.prisma.question.findMany({
      where: {
        status: 'published',
        currentVersionId: { not: null },
        label: { areaId: { in: areaIds }, isRetired: false },
      },
      select: { id: true, currentVersionId: true, difficulty: true, passageId: true, label: { select: { areaId: true } } },
    });

    const usable = questions.filter((q) => !excludeQuestionIds.has(q.id));
    const versionIds = usable.map((q) => q.currentVersionId!).filter(Boolean);

    // p-value is empirical difficulty and beats the authored guess wherever it
    // exists — the whole point of §9's item statistics loop is that the ramp
    // gets truer as the bank is sat. Items with no statistics keep their
    // authored 1..5 so the two are on one scale and sort together.
    const stats = await this.prisma.questionStats.findMany({
      where: { questionVersionId: { in: versionIds }, pValue: { not: null } },
      select: { questionVersionId: true, pValue: true, nServed: true },
    });
    const calibrated = new Map<string, number>();
    for (const s of stats) {
      // A handful of sittings is noise, not calibration.
      if (s.nServed < 30 || s.pValue === null) continue;
      // p-value is the proportion answered correctly: high p = easy. Map onto
      // the authored 1..5 scale, where 5 is hardest.
      calibrated.set(s.questionVersionId, 1 + 4 * (1 - s.pValue));
    }

    return usable.map((q) => ({
      questionId: q.id,
      questionVersionId: q.currentVersionId!,
      areaId: q.label.areaId,
      difficulty: calibrated.get(q.currentVersionId!) ?? q.difficulty,
      passageId: q.passageId,
    }));
  }

  /** Audit rows carry a human label, not just a uuid — same as the other admin services. */
  private async label(adminUserId: string): Promise<string> {
    const admin = await this.prisma.user.findUnique({ where: { id: adminUserId }, select: { name: true, email: true } });
    return admin?.email ?? admin?.name ?? adminUserId;
  }

  private plans(bp: Awaited<ReturnType<BlueprintService['get']>>): SectionPlan[] {
    return bp.sections.map((s) => ({
      orderIndex: s.orderIndex,
      questionCount: s.questionCount,
      experimentalSlots: s.experimentalSlots,
      quotas: s.quotas.map((q) => ({
        areaId: q.areaId,
        count: q.count,
        difficultyCurve: (q.difficultyCurve === 'ascending' ? 'ascending' : 'none') as 'ascending' | 'none',
      })),
    }));
  }

  /**
   * Questions already committed to a published static form of this blueprint.
   *
   * §4.4 exposure control: a student who sits نموذج ١ and later نموذج ٢ should
   * not meet the same item twice, and a leaked form should not leak the next
   * one with it.
   */
  private async alreadyExposed(blueprintId: string): Promise<Set<string>> {
    const items = await this.prisma.simulationFormItem.findMany({
      where: { form: { blueprintId, isStatic: true, status: 'published' } },
      select: { questionId: true },
    });
    return new Set(items.map((i) => i.questionId));
  }

  /**
   * §9 — "can this blueprint be published?", per area, before anything is
   * generated.
   *
   * A necessary condition, not a sufficient one: it counts items per area and
   * does not model passage atomicity, so an area can hold enough questions and
   * still fail assembly because its passage blocks do not fit the quota. The
   * generator is the real test; this is what an admin reads before running it.
   */
  async readiness(blueprintId: string, avoidReuse = true) {
    const bp = await this.blueprints.get(blueprintId);
    const areaIds = [...new Set(bp.sections.flatMap((s) => s.quotas.map((q) => q.areaId)))];
    const exclude = avoidReuse ? await this.alreadyExposed(blueprintId) : new Set<string>();
    const pool = await this.candidates(areaIds, exclude);

    const { ready, shortfalls } = checkBankReadiness(this.plans(bp), pool);

    const names = new Map(bp.sections.flatMap((s) => s.quotas.map((q) => [q.areaId, q.area.nameAr] as const)));
    const byArea = new Map<string, AreaReadiness>();
    for (const areaId of areaIds) {
      const inArea = pool.filter((c) => c.areaId === areaId);
      const spread: Record<number, number> = {};
      for (const c of inArea) {
        const band = Math.min(5, Math.max(1, Math.round(c.difficulty)));
        spread[band] = (spread[band] ?? 0) + 1;
      }
      const required = bp.sections
        .flatMap((s) => s.quotas)
        .filter((q) => q.areaId === areaId)
        .reduce((sum, q) => sum + q.count, 0);
      byArea.set(areaId, {
        areaId,
        areaNameAr: names.get(areaId) ?? areaId,
        required,
        available: inArea.length,
        difficultySpread: spread,
      });
    }

    return {
      ready,
      areas: [...byArea.values()].sort((a, b) => a.available - a.required - (b.available - b.required)),
      shortfalls: shortfalls.map((s) => ({ ...s, areaNameAr: names.get(s.areaId) ?? s.areaId })),
      poolSize: pool.length,
      avoidReuse,
    };
  }

  list(blueprintId: string) {
    return this.prisma.simulationForm.findMany({
      where: { blueprintId },
      include: { _count: { select: { items: true, attempts: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async get(formId: string) {
    const form = await this.prisma.simulationForm.findUnique({
      where: { id: formId },
      include: {
        blueprint: { select: { id: true, nameAr: true, status: true, sectionCount: true } },
        _count: { select: { attempts: true } },
        items: {
          orderBy: [{ sectionIndex: 'asc' }, { position: 'asc' }],
          include: {
            question: { select: { id: true, difficulty: true, passageId: true, label: { select: { nameAr: true, area: { select: { id: true, nameAr: true } } } } } },
            questionVersion: { select: { id: true, version: true, stem: true, correctKey: true } },
          },
        },
      },
    });
    if (!form) throw new NotFoundException('النموذج غير موجود');
    return form;
  }

  /** Next free `نموذج N` for this blueprint. */
  private async nextCode(blueprintId: string): Promise<string> {
    const taken = new Set((await this.prisma.simulationForm.findMany({ where: { blueprintId }, select: { code: true } })).map((f) => f.code));
    for (let n = 1; n < 1000; n++) {
      const code = `نموذج ${toArabicDigits(n)}`;
      if (!taken.has(code)) return code;
    }
    throw new BadRequestException('تعذّر ترقيم النموذج');
  }

  /**
   * §4 — assemble and persist one form.
   *
   * The seed is generated here and stored, never derived from the blueprint or
   * the clock: a form must be reproducible from its own row, and a
   * clock-derived seed is not reproducible at all.
   */
  async generate(
    blueprintId: string,
    opts: {
      code?: string;
      seed?: string;
      avoidReuse?: boolean;
      isStatic?: boolean;
      forStudentId?: string;
      /**
       * Extra questions to keep out of this form, beyond the blueprint-wide
       * exposure set. A dynamic form uses this for §4.4's per-student rule:
       * what matters for a repeat attempt is that the student does not meet an
       * item they have already sat.
       */
      excludeQuestionIds?: string[];
      /** Dynamic forms are born published — nobody reviews a form of one. */
      publish?: boolean;
      note?: string;
    },
    actorUserId: string,
  ) {
    const bp = await this.blueprints.get(blueprintId);

    const issues = await this.blueprints.validate(blueprintId);
    if (issues.length > 0) {
      throw new BadRequestException(`المخطط غير صالح: ${issues.map((i) => i.messageAr).join(' — ')}`);
    }

    const avoidReuse = opts.avoidReuse ?? true;
    const areaIds = [...new Set(bp.sections.flatMap((s) => s.quotas.map((q) => q.areaId)))];
    const exclude = avoidReuse ? await this.alreadyExposed(blueprintId) : new Set<string>();
    for (const id of opts.excludeQuestionIds ?? []) exclude.add(id);
    const pool = await this.candidates(areaIds, exclude);

    const seed = opts.seed ?? randomUUID();
    const result = assembleForm(this.plans(bp), pool, seed);
    if (!result.ok) {
      const names = new Map(bp.sections.flatMap((s) => s.quotas.map((q) => [q.areaId, q.area.nameAr] as const)));
      const detail = result.shortfalls
        .map((s) => `${names.get(s.areaId) ?? s.areaId}: مطلوب ${s.required}، متوفر ${s.available}`)
        .join(' — ');
      throw new BadRequestException(`بنك الأسئلة لا يكفي — ${detail}`);
    }

    const code = opts.code?.trim() || (await this.nextCode(blueprintId));

    const form = await this.prisma.simulationForm.create({
      data: {
        blueprintId,
        code,
        isStatic: opts.isStatic ?? true,
        seed,
        status: opts.publish ? 'published' : 'draft',
        publishedAt: opts.publish ? new Date() : null,
        forStudentId: opts.forStudentId ?? null,
        items: {
          create: result.items.map((i) => ({
            sectionIndex: i.sectionIndex,
            position: i.position,
            questionId: i.questionId,
            questionVersionId: i.questionVersionId,
            isScored: i.isScored,
          })),
        },
      },
    });

    await this.audit.record({
      actorId: actorUserId,
      actorLabel: await this.label(actorUserId),
      action: 'simulation_form_generate',
      entityType: 'simulation_form',
      entityId: form.id,
      after: { code, seed, items: result.items.length, avoidReuse, isStatic: opts.isStatic ?? true },
      note: opts.note,
    });
    return this.get(form.id);
  }

  /**
   * §9 — swap one slot without regenerating the form.
   *
   * The replacement is drawn from the same area so the quota still holds, and
   * a passage-bearing item is refused: swapping one question out of a passage
   * block would leave the remaining items asking about a text the student can
   * still see, but break the block's integrity as a unit.
   */
  async regenerateItem(formItemId: string, adminUserId: string) {
    const item = await this.prisma.simulationFormItem.findUnique({
      where: { id: formItemId },
      include: {
        form: { select: { id: true, blueprintId: true, status: true } },
        question: { select: { passageId: true, label: { select: { areaId: true } } } },
      },
    });
    if (!item) throw new NotFoundException('السؤال غير موجود في النموذج');
    if (item.form.status !== 'draft') throw new BadRequestException('النموذج منشور — لا يمكن استبدال أسئلته.');
    if (item.question.passageId) {
      throw new BadRequestException('هذا السؤال تابع لقطعة قراءة — أعد تكوين النموذج بدل استبدال سؤال واحد.');
    }

    const inForm = new Set(
      (await this.prisma.simulationFormItem.findMany({ where: { formId: item.formId }, select: { questionId: true } })).map((i) => i.questionId),
    );
    const exposed = await this.alreadyExposed(item.form.blueprintId);
    for (const id of inForm) exposed.add(id);

    const pool = (await this.candidates([item.question.label.areaId], exposed))
      // A replacement that drags a passage in would need the whole block.
      .filter((c) => !c.passageId);
    if (pool.length === 0) throw new BadRequestException('لا يوجد سؤال بديل متاح في هذا المجال.');

    // Closest difficulty to the item being replaced, so the ramp survives the swap.
    const target = await this.prisma.question.findUnique({ where: { id: item.questionId }, select: { difficulty: true } });
    const pick = pool.reduce((best, c) =>
      Math.abs(c.difficulty - (target?.difficulty ?? 3)) < Math.abs(best.difficulty - (target?.difficulty ?? 3)) ? c : best,
    );

    const updated = await this.prisma.simulationFormItem.update({
      where: { id: formItemId },
      data: { questionId: pick.questionId, questionVersionId: pick.questionVersionId },
    });
    await this.audit.record({
      actorId: adminUserId,
      actorLabel: await this.label(adminUserId),
      action: 'simulation_form_item_swap',
      entityType: 'simulation_form',
      entityId: item.formId,
      before: { questionId: item.questionId },
      after: { questionId: pick.questionId },
    });
    return updated;
  }

  async setStatus(formId: string, status: 'draft' | 'published' | 'archived', adminUserId: string) {
    const form = await this.get(formId);

    if (status === 'published') {
      const bp = await this.blueprints.get(form.blueprintId);
      if (bp.status !== 'published') throw new BadRequestException('انشر المخطط أولاً.');
      if (form.items.length !== bp.totalQuestions) {
        throw new BadRequestException(`النموذج يحوي ${form.items.length} سؤالًا بينما المخطط يعلن ${bp.totalQuestions}.`);
      }
    }

    // §9 — "publishing is irreversible for forms already attempted". Pulling a
    // form back to draft under a student who has sat it would let its items be
    // swapped and silently restate a score already reported.
    if (form.status === 'published' && status !== 'published' && form._count.attempts > 0) {
      throw new BadRequestException(`النموذج جرى استخدامه في ${form._count.attempts} محاولة — لا يمكن سحبه.`);
    }

    const updated = await this.prisma.simulationForm.update({
      where: { id: formId },
      data: { status, publishedAt: status === 'published' ? (form.publishedAt ?? new Date()) : form.publishedAt },
    });
    await this.audit.record({
      actorId: adminUserId,
      actorLabel: await this.label(adminUserId),
      action: 'simulation_form_status',
      entityType: 'simulation_form',
      entityId: formId,
      before: { status: form.status },
      after: { status },
    });
    return updated;
  }

  async remove(formId: string, adminUserId: string) {
    const form = await this.get(formId);
    if (form._count.attempts > 0) throw new BadRequestException('النموذج جرى استخدامه في محاولات — أرشفه بدل حذفه.');
    await this.prisma.simulationForm.delete({ where: { id: formId } });
    await this.audit.record({
      actorId: adminUserId,
      actorLabel: await this.label(adminUserId),
      action: 'simulation_form_delete',
      entityType: 'simulation_form',
      entityId: formId,
      before: { code: form.code, status: form.status },
    });
    return { ok: true };
  }
}
