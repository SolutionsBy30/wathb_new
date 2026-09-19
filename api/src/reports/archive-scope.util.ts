/**
 * STU-036 — which of a learner's exams still count toward a blended number.
 *
 * Once someone has sat the real exam, that preparation is history. It must
 * stay readable to them — every answer and leap is kept — but it must stop
 * feeding anything that blends exams together:
 *
 *  - the composite index, which would otherwise average a finished قدرات
 *    against a licensing exam started last month and describe neither;
 *  - the school dashboard, where a graduate's professional-exam numbers are
 *    not the school's business and drag its cohort mean somewhere meaningless;
 *  - cohort reporting for the same reason.
 *
 * The rule is deliberately one function rather than a `where` clause repeated
 * at each call site: "which exams count" must have exactly one answer, or the
 * student's own report and the school's view of the same student diverge and
 * nobody can say which is right.
 *
 * Archiving is reversible — resitting قدرات is ordinary — so nothing here is
 * destructive and un-archiving simply returns the exam to the set.
 */

export interface StudentTestRow {
  testId: string;
  isActive: boolean;
  archivedAt: Date | null;
}

/** A label stat, reduced to the one thing this file needs to know about it. */
export interface Scoped {
  testId: string;
}

export function isArchived(row: { archivedAt: Date | null }): boolean {
  return row.archivedAt !== null;
}

/**
 * Exams a learner has sat. These keep their history and lose their vote.
 *
 * Archived wins over `isActive`: a row can be both switched off and archived,
 * and the two mean different things — switched off is "not practising this
 * right now", archived is "this is over".
 */
export function archivedTestIds(rows: StudentTestRow[]): Set<string> {
  return new Set(rows.filter(isArchived).map((r) => r.testId));
}

/**
 * Exams still being prepared for: switched on and not yet sat. This is what
 * the daily loop and the nudge should work from.
 */
export function preparingTestIds(rows: StudentTestRow[]): Set<string> {
  return new Set(rows.filter((r) => r.isActive && !isArchived(r)).map((r) => r.testId));
}

/**
 * Drop anything belonging to an exam the learner has already sat.
 *
 * A stat whose test is unknown to the caller is KEPT. Being unable to resolve
 * a test is not evidence that the exam is finished, and silently dropping
 * those would make a student's totals fall for no visible reason.
 */
export function withoutArchived<T extends Scoped>(items: T[], archived: Set<string>): T[] {
  if (archived.size === 0) return items;
  return items.filter((i) => !archived.has(i.testId));
}

/**
 * Has this learner finished everything they were preparing for?
 *
 * The school dashboard drops these students entirely rather than showing a row
 * with no numbers behind it: after the exam, a cohort's readiness is not a
 * question about them any more.
 *
 * A learner with no exams at all is NOT "done" — they have not started, which
 * is a different state and one a school should still see.
 */
export function hasFinishedEverything(rows: StudentTestRow[]): boolean {
  const enrolled = rows.filter((r) => r.isActive || isArchived(r));
  if (enrolled.length === 0) return false;
  return enrolled.every(isArchived);
}
