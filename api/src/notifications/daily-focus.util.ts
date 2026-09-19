/**
 * NOT-025 — which exam today's nudge is about.
 *
 * The daily message was generated against Student.targetTestId, a single
 * pointer set at onboarding. A learner preparing for two exams therefore got
 * nudged about one of them forever, and the other existed only if they
 * remembered to open the app and switch. The daily message is the product's
 * retention engine, so the un-nudged exam is the one that gets abandoned.
 *
 * This picks per day instead of per account. Deliberately still ONE exam a
 * day, not one message per exam: the WhatsApp channel is an unofficial bridge
 * that already drops daily under normal load (COM-001..006), and doubling
 * outbound volume to solve a fairness problem would trade a soft failure for a
 * hard one. Fairness comes from rotating the choice, not from sending more.
 *
 * The order of the rules is the product judgement:
 *
 *  1. An exam with a date is more urgent than one without. Someone sitting a
 *     licensing exam in three weeks should not be nudged about قدرات in eight
 *     months because قدرات happened to be their first goal.
 *  2. Among equally-dated exams, rotate by day so neither starves.
 *  3. With no dates at all, rotate. Alternating is fairer than always picking
 *     whichever sorts first, which is the bug in miniature.
 */

export interface NudgeCandidate {
  testId: string;
  /** When they sit the real exam, if they told us. */
  testDate: Date | null;
}

/** Days since epoch — the rotation counter, stable for a whole Riyadh day. */
function dayNumber(today: Date): number {
  return Math.floor(today.getTime() / 86_400_000);
}

/** Stable order, so rotation visits the same list in the same sequence. */
function byId(a: NudgeCandidate, b: NudgeCandidate): number {
  return a.testId.localeCompare(b.testId);
}

/**
 * The exam to nudge about today, or null when there is nothing to nudge.
 *
 * `candidates` must already be filtered to exams the learner has switched on,
 * has not sat, and holds a subscription covering — this function decides
 * between them and does not police eligibility.
 */
export function chooseDailyTest(candidates: NudgeCandidate[], today: Date): string | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].testId;

  const dated = candidates.filter((c) => c.testDate !== null);

  if (dated.length > 0) {
    // A date that has passed with no archive means they have not told us how
    // it went. Treated as maximally urgent rather than ignored: either they
    // are resitting, or they need prompting to close it off.
    const soonest = dated.reduce((best, c) => (c.testDate!.getTime() < best.testDate!.getTime() ? c : best));
    const tied = dated
      .filter((c) => c.testDate!.getTime() === soonest.testDate!.getTime())
      .sort(byId);
    return tied[dayNumber(today) % tied.length].testId;
  }

  const sorted = [...candidates].sort(byId);
  return sorted[dayNumber(today) % sorted.length].testId;
}

/**
 * How many distinct exams a rotation covers before repeating — what a client
 * needs to say "you'll see تحصيلي tomorrow" rather than leaving the learner
 * wondering whether the other exam was forgotten.
 */
export function rotationLength(candidates: NudgeCandidate[]): number {
  if (candidates.length <= 1) return candidates.length;
  const dated = candidates.filter((c) => c.testDate !== null);
  if (dated.length === 0) return candidates.length;
  const soonest = dated.reduce((best, c) => (c.testDate!.getTime() < best.testDate!.getTime() ? c : best));
  return dated.filter((c) => c.testDate!.getTime() === soonest.testDate!.getTime()).length;
}
