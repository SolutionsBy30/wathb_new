/**
 * SIM-004 — §9 blueprint validation, as a pure function.
 *
 * "Validate that quotas sum to question_count" sounds like a formality until
 * you consider what a wrong blueprint does: it does not throw. It produces a
 * form with 23 questions where the report claims 24, or a section whose
 * experimental slot sits at position 30 of a 24-item section and therefore
 * silently scores an item that was meant to be unscored. Nothing errors; the
 * numbers are just quietly wrong for every student who sits it.
 *
 * So every arithmetic relationship in §2.1/§2.2 is checked explicitly, and all
 * failures are returned together — an admin fixing a blueprint should see the
 * whole list, not discover a second error after fixing the first.
 */

export interface QuotaInput {
  areaId: string;
  count: number;
  difficultyCurve: string;
}

export interface SectionInput {
  orderIndex: number;
  part: string;
  questionCount: number;
  durationS: number;
  experimentalSlots: number[];
  quotas: QuotaInput[];
}

export interface BlueprintInput {
  totalQuestions: number;
  sectionCount: number;
  experimentalCount: number;
  sections: SectionInput[];
}

export type IssueCode =
  | 'no_sections'
  | 'section_count_mismatch'
  | 'order_index_invalid'
  | 'total_questions_mismatch'
  | 'quota_sum_mismatch'
  | 'quota_not_positive'
  | 'duplicate_area'
  | 'no_quotas'
  | 'slot_out_of_range'
  | 'duplicate_slot'
  | 'experimental_count_mismatch'
  | 'duration_not_positive'
  | 'part_invalid';

export interface ValidationIssue {
  code: IssueCode;
  messageAr: string;
  /** orderIndex of the offending section, when the issue is sectional. */
  sectionIndex?: number;
}

const VALID_PARTS = ['verbal', 'quantitative', 'mixed'];

/** Arabic numerals stay Latin-digit: the console shows ids and counts, not prose. */
export function validateBlueprint(bp: BlueprintInput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (bp.sections.length === 0) {
    issues.push({ code: 'no_sections', messageAr: 'المخطط بلا أقسام — أضف قسمًا واحدًا على الأقل.' });
    // Everything below is per-section or a sum over sections; with none, the
    // remaining messages would just restate this one.
    return issues;
  }

  if (bp.sections.length !== bp.sectionCount) {
    issues.push({
      code: 'section_count_mismatch',
      messageAr: `عدد الأقسام المُعرّفة ${bp.sections.length} بينما المخطط يعلن ${bp.sectionCount}.`,
    });
  }

  // Order indexes must be exactly 0..n-1: the runtime walks sections by index,
  // so a gap means a section that is never reached and a duplicate means one
  // that overwrites another.
  const expected = bp.sections.map((_, i) => i).join(',');
  const actual = [...bp.sections.map((s) => s.orderIndex)].sort((a, b) => a - b).join(',');
  if (expected !== actual) {
    issues.push({
      code: 'order_index_invalid',
      messageAr: `ترتيب الأقسام يجب أن يكون 0 حتى ${bp.sections.length - 1} دون تكرار أو فجوات.`,
    });
  }

  const totalFromSections = bp.sections.reduce((sum, s) => sum + s.questionCount, 0);
  if (totalFromSections !== bp.totalQuestions) {
    issues.push({
      code: 'total_questions_mismatch',
      messageAr: `مجموع أسئلة الأقسام ${totalFromSections} بينما المخطط يعلن ${bp.totalQuestions} سؤالًا.`,
    });
  }

  let experimentalTotal = 0;

  for (const section of bp.sections) {
    const at = section.orderIndex;

    if (!VALID_PARTS.includes(section.part)) {
      issues.push({
        code: 'part_invalid',
        sectionIndex: at,
        messageAr: `القسم ${at + 1}: النوع "${section.part}" غير معروف (المتاح: لفظي، كمي، مختلط).`,
      });
    }

    if (section.durationS <= 0) {
      issues.push({
        code: 'duration_not_positive',
        sectionIndex: at,
        messageAr: `القسم ${at + 1}: مدة القسم يجب أن تكون أكبر من صفر.`,
      });
    }

    if (section.quotas.length === 0) {
      issues.push({
        code: 'no_quotas',
        sectionIndex: at,
        messageAr: `القسم ${at + 1}: لا توجد حصص مجالات — لا يمكن تكوين أسئلته.`,
      });
    }

    const seenAreas = new Set<string>();
    let quotaSum = 0;
    for (const quota of section.quotas) {
      if (quota.count <= 0) {
        issues.push({
          code: 'quota_not_positive',
          sectionIndex: at,
          messageAr: `القسم ${at + 1}: حصة أحد المجالات صفر أو أقل — احذف الحصة بدل تركها فارغة.`,
        });
      }
      if (seenAreas.has(quota.areaId)) {
        issues.push({
          code: 'duplicate_area',
          sectionIndex: at,
          messageAr: `القسم ${at + 1}: المجال مكرّر — ادمج الحصتين في واحدة.`,
        });
      }
      seenAreas.add(quota.areaId);
      quotaSum += quota.count;
    }

    if (section.quotas.length > 0 && quotaSum !== section.questionCount) {
      issues.push({
        code: 'quota_sum_mismatch',
        sectionIndex: at,
        messageAr: `القسم ${at + 1}: مجموع الحصص ${quotaSum} بينما عدد أسئلة القسم ${section.questionCount}.`,
      });
    }

    const seenSlots = new Set<number>();
    for (const slot of section.experimentalSlots) {
      if (slot < 0 || slot >= section.questionCount) {
        issues.push({
          code: 'slot_out_of_range',
          sectionIndex: at,
          messageAr: `القسم ${at + 1}: موضع السؤال التجريبي ${slot} خارج نطاق القسم (0 حتى ${section.questionCount - 1}).`,
        });
      }
      if (seenSlots.has(slot)) {
        issues.push({
          code: 'duplicate_slot',
          sectionIndex: at,
          messageAr: `القسم ${at + 1}: موضع السؤال التجريبي ${slot} مكرّر.`,
        });
      }
      seenSlots.add(slot);
    }

    experimentalTotal += seenSlots.size;
  }

  if (experimentalTotal !== bp.experimentalCount) {
    issues.push({
      code: 'experimental_count_mismatch',
      messageAr: `مواضع الأسئلة التجريبية ${experimentalTotal} بينما المخطط يعلن ${bp.experimentalCount}.`,
    });
  }

  return issues;
}
