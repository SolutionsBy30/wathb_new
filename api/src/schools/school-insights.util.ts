import { createHash } from 'crypto';

/**
 * SCH — what a school may see about its own students, as pure functions.
 *
 * Two things make this worth isolating and testing rather than inlining.
 *
 * First, it is minors' performance data going to a third party. The school is
 * not the student's guardian and did not collect this; we did. So identity is
 * off unless someone explicitly turned it on, and the student can always veto.
 * A privacy rule that fails open fails silently — nothing errors, a name just
 * appears where it should not have.
 *
 * Second, small cohorts leak. "متوسط الهندسة ٢٠٪" over three students, next to
 * a list of three aliases, identifies all three to anyone who knows the class.
 * Suppression below a floor is the only thing standing between a pseudonymous
 * dashboard and a de-anonymising one.
 */

// ------------------------------------------------------------- disclosure

export type Disclosure = 'none' | 'consented' | 'full';

export interface StudentPrivacy {
  studentId: string;
  /** Set when the student refused to be named to their school. */
  optedOutAt: Date | null;
  /** Set when the student explicitly agreed to be named to their school. */
  consentedAt: Date | null;
}

/**
 * May this school see this student's real name?
 *
 * The student's refusal wins over every school-level setting, including
 * 'full'. A school being granted disclosure is an administrative decision;
 * a student saying no is about them, and the narrower one has to win or the
 * opt-out is decorative.
 */
export function canRevealIdentity(disclosure: Disclosure, student: StudentPrivacy): boolean {
  if (student.optedOutAt) return false;
  if (disclosure === 'full') return true;
  if (disclosure === 'consented') return student.consentedAt !== null;
  return false;
}

/**
 * A stable pseudonym for one student within one school.
 *
 * Salted with the school id so the same student carries different aliases at
 * different schools — otherwise two schools comparing notes could re-identify
 * by matching codes. Stable across sessions so a teacher can say "طالب ٧٣ has
 * improved" week to week, which is the entire point of an alias over a
 * random id.
 */
export function aliasFor(studentId: string, schoolId: string): string {
  const digest = createHash('sha256').update(`${schoolId}:${studentId}`).digest('hex');
  // Four hex characters: 65k space, enough that collisions inside one school
  // are vanishingly unlikely, short enough to say out loud.
  return `طالب-${digest.slice(0, 4).toUpperCase()}`;
}

// --------------------------------------------------------- small cohorts

/**
 * Below this many students, a breakdown is not reported at all.
 *
 * Matches MIN_COHORT_STUDENTS in the existing cohort report. The number is a
 * judgement, not a standard, and it is deliberately the same one so a school
 * cannot learn from our dashboard something the cohort report refuses to say.
 */
export const MIN_COHORT_STUDENTS = 15;

/** Per-area rows need their own floor: an area only three students touched. */
export const MIN_STUDENTS_PER_AREA = 5;

export function isReportable(studentCount: number, min = MIN_COHORT_STUDENTS): boolean {
  return studentCount >= min;
}

// ---------------------------------------------------------- readiness

export type ReadinessBand = 'strong' | 'on_track' | 'needs_support' | 'at_risk' | 'insufficient';

/**
 * Minimum answers before we will band a student at all.
 *
 * A student who answered nine questions is not "at risk"; they are unmeasured,
 * and telling a school otherwise would put them in a support class on noise.
 */
export const MIN_ANSWERS_FOR_BAND = 40;

export interface BandThresholds {
  strong: number;
  onTrack: number;
  needsSupport: number;
}

/**
 * Where the bands sit, in accuracy percent on our own bank.
 *
 * Not calibrated against قياس and not presented as if it were — see
 * `READINESS_DISCLAIMER_AR`. These are working thresholds a school can act on,
 * and they are configurable because a school aiming at a 90 has a different
 * idea of "on track" than one aiming at a 70.
 */
export const DEFAULT_BANDS: BandThresholds = { strong: 80, onTrack: 65, needsSupport: 50 };

export function readinessBand(
  accuracy: number | null,
  answered: number,
  bands: BandThresholds = DEFAULT_BANDS,
): ReadinessBand {
  if (accuracy === null || answered < MIN_ANSWERS_FOR_BAND) return 'insufficient';
  if (accuracy >= bands.strong) return 'strong';
  if (accuracy >= bands.onTrack) return 'on_track';
  if (accuracy >= bands.needsSupport) return 'needs_support';
  return 'at_risk';
}

export const BAND_AR: Record<ReadinessBand, string> = {
  strong: 'متقدّم',
  on_track: 'في المسار',
  needs_support: 'يحتاج دعمًا',
  at_risk: 'يحتاج تدخّلًا',
  insufficient: 'بيانات غير كافية',
};

/**
 * Shown wherever a band or an average appears.
 *
 * We have no equating table to قياس — the same reason SimulationResult's
 * scaledEstimate stays null. A "predicted score" here would be a number a
 * school plans around and a student is judged by, invented from our own
 * question bank. The band says what it actually knows: how this student is
 * doing on our material.
 */
export const READINESS_DISCLAIMER_AR =
  'هذه المؤشرات تصف أداء الطالب على بنك أسئلة وثب، وليست تنبؤًا بدرجة قياس الرسمية.';

// ------------------------------------------------------- aggregation

export interface StudentRow {
  studentId: string;
  accuracy: number | null;
  answered: number;
  completedLeaps: number;
  lastActiveAt: Date | null;
  /** Latest simulation percentage, when they have sat one. */
  simulationAccuracy: number | null;
}

export interface CohortSummary {
  students: number;
  measured: number;
  meanAccuracy: number | null;
  medianAccuracy: number | null;
  bands: Record<ReadinessBand, number>;
}

/**
 * Roll a school's students up into one summary.
 *
 * Unmeasured students are counted in `students` but excluded from the mean:
 * folding a null into an average as zero would drag the whole school down and
 * make a participation problem look like an ability problem. They are their
 * own band instead, which is the actionable reading — chase them to practise.
 */
export function summarise(rows: StudentRow[], bands: BandThresholds = DEFAULT_BANDS): CohortSummary {
  const counted: Record<ReadinessBand, number> = {
    strong: 0, on_track: 0, needs_support: 0, at_risk: 0, insufficient: 0,
  };
  for (const r of rows) counted[readinessBand(r.accuracy, r.answered, bands)]++;

  const measured = rows.filter((r) => r.accuracy !== null && r.answered >= MIN_ANSWERS_FOR_BAND);
  const values = measured.map((r) => r.accuracy!).sort((a, b) => a - b);

  const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const median = values.length
    ? values.length % 2
      ? values[(values.length - 1) / 2]
      : (values[values.length / 2 - 1] + values[values.length / 2]) / 2
    : null;

  return {
    students: rows.length,
    measured: measured.length,
    meanAccuracy: mean === null ? null : Math.round(mean * 10) / 10,
    medianAccuracy: median === null ? null : Math.round(median * 10) / 10,
    bands: counted,
  };
}
