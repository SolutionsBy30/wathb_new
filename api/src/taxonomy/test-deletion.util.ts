/**
 * ADM-095 — may this test be deleted?
 *
 * Deleting a Test is far more destructive than it looks. Section.test,
 * Area.section and Label.area are all `onDelete: Cascade`, so removing a test
 * takes its entire taxonomy with it; StudentTest.test cascades too, which
 * quietly discards students' enrolments. Question.label is `Restrict`, so a
 * populated tree would abort the cascade halfway with a raw foreign-key error
 * instead of a sentence anyone can act on.
 *
 * So this refuses first and explains, rather than letting the database decide.
 * Every blocker is reported in one pass — fixing them one error at a time,
 * with a destructive operation at the end of each attempt, is the wrong way to
 * learn what a test is attached to.
 *
 * Pure so the rules are tested without a database, and so "what stops a
 * delete" is one readable list rather than a paragraph of `if`s.
 */

export interface PackageUsage {
  nameAr: string;
  subscriptions: number;
}

export interface TestUsage {
  /** Questions anywhere beneath the test's sections/areas/labels. */
  questions: number;
  /** Students who chose this as their target test. */
  targetingStudents: number;
  /** StudentTest rows — a student having activated this test. */
  studentTests: number;
  /** Practice sessions recorded against it. */
  wathbs: number;
  /** Simulation blueprints built on it. */
  blueprints: number;
  /** Packages whose testIds list it, with their live subscription counts. */
  packages: PackageUsage[];
}

export function subscriptionCount(usage: TestUsage): number {
  return usage.packages.reduce((n, p) => n + p.subscriptions, 0);
}

/**
 * Every reason this test cannot be deleted, in Arabic, most consequential
 * first: data that would be destroyed, then commitments that would be broken,
 * then references that would dangle.
 */
export function deletionBlockers(usage: TestUsage): string[] {
  const blockers: string[] = [];

  if (usage.questions > 0) {
    blockers.push(`يحتوي على ${usage.questions} سؤال. انقلها أو احذفها أولاً.`);
  }

  const subs = subscriptionCount(usage);
  if (subs > 0) {
    const names = usage.packages.filter((p) => p.subscriptions > 0).map((p) => `«${p.nameAr}»`).join('، ');
    blockers.push(`مشمول في باقات لها ${subs} اشتراك قائم: ${names}.`);
  }

  // A package listing the test with no subscribers yet still breaks if the
  // test disappears: testIds is a plain string array with no foreign key, so
  // nothing in the database would stop it becoming a dangling id.
  const emptyPackages = usage.packages.filter((p) => p.subscriptions === 0);
  if (emptyPackages.length > 0) {
    blockers.push(
      `مُدرج في ${emptyPackages.length} باقة (${emptyPackages.map((p) => `«${p.nameAr}»`).join('، ')}). أزله من الباقات أولاً.`,
    );
  }

  if (usage.studentTests > 0) {
    blockers.push(`${usage.studentTests} طالب فعّلوا هذا الاختبار.`);
  }

  if (usage.targetingStudents > 0) {
    blockers.push(`${usage.targetingStudents} طالب اختاروه كاختبار مستهدف.`);
  }

  if (usage.wathbs > 0) {
    blockers.push(`له ${usage.wathbs} وثبة مسجّلة في سجل الطلاب.`);
  }

  if (usage.blueprints > 0) {
    blockers.push(`مبني عليه ${usage.blueprints} نموذج محاكاة.`);
  }

  return blockers;
}

export function canDeleteTest(usage: TestUsage): boolean {
  return deletionBlockers(usage).length === 0;
}

/**
 * What to tell an admin who cannot delete.
 *
 * Always ends with deactivation, because that is the thing they actually want
 * in nearly every case: a test nobody should start any more, whose existing
 * students keep working.
 */
export function refusalMessageAr(nameAr: string, blockers: string[]): string {
  return [
    `لا يمكن حذف «${nameAr}»:`,
    ...blockers.map((b) => `• ${b}`),
    'يمكنك تعطيل الاختبار بدلاً من حذفه — لن يظهر لطلاب جدد، ومن يستخدمه الآن لا يتأثر.',
  ].join('\n');
}
