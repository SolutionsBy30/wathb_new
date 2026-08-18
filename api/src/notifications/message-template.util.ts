/**
 * NOT-017 — admin-authored variants of the daily leap message.
 *
 * The same sentence every morning stops being read. Admins write a pool of
 * message bodies with placeholders; one is picked at random per send, and the
 * built-in wording is used when the pool is empty.
 *
 * Placeholder syntax is {snake_case}. Hyphens inside the braces are accepted
 * and normalised, because {magic-link} is the form people reach for first and
 * silently sending a message with a literal "{magic-link}" in it would be a
 * miserable way to find out.
 */

export const DAILY_PLACEHOLDERS = ['student_name', 'magic_link', 'test_name'] as const;
export type DailyPlaceholder = (typeof DAILY_PLACEHOLDERS)[number];

export const PLACEHOLDER_LABELS_AR: Record<DailyPlaceholder, string> = {
  student_name: 'اسم الطالب',
  magic_link: 'رابط الوثبة',
  test_name: 'اسم الاختبار',
};

/** Matches {placeholder}; the body is Arabic, so keep the pattern ASCII-only. */
const PLACEHOLDER_RE = /\{([a-zA-Z0-9_-]+)\}/g;

const normalise = (raw: string) => raw.trim().toLowerCase().replace(/-/g, '_');

/**
 * Every placeholder the body uses, normalised and de-duplicated, in the order
 * they first appear.
 */
export function placeholdersUsed(body: string): string[] {
  const found: string[] = [];
  for (const m of body.matchAll(PLACEHOLDER_RE)) {
    const key = normalise(m[1]);
    if (!found.includes(key)) found.push(key);
  }
  return found;
}

/** Placeholders the body uses that this message kind cannot fill. */
export function unknownPlaceholders(body: string): string[] {
  return placeholdersUsed(body).filter((k) => !DAILY_PLACEHOLDERS.includes(k as DailyPlaceholder));
}

/**
 * Why a body is unfit to send, or null when it is fine.
 *
 * The magic-link rule is the one that matters: a daily nudge with no way to
 * open the leap is just noise arriving on someone's phone, and the failure is
 * invisible from the admin screen. Caught at save time, where a human can fix
 * it, rather than at 7am across every student at once.
 */
export function validateMessageBody(body: string): string | null {
  const trimmed = body.trim();
  if (trimmed.length === 0) return 'نص الرسالة مطلوب.';
  if (trimmed.length > 900) return 'نص الرسالة طويل جداً (الحد ٩٠٠ حرف).';

  const unknown = unknownPlaceholders(trimmed);
  if (unknown.length > 0) {
    return `متغيّرات غير معروفة: ${unknown.map((u) => `{${u}}`).join('، ')}`;
  }
  if (!placeholdersUsed(trimmed).includes('magic_link')) {
    return 'يجب أن تحتوي الرسالة على {magic_link} حتى يتمكن الطالب من فتح وثبته.';
  }
  return null;
}

/**
 * Substitute the placeholders in a body.
 *
 * An unfilled placeholder collapses to an empty string rather than being left
 * in place: validateMessageBody already rejects unknown ones at save time, so
 * anything still unresolved here is a value that happened to be missing for
 * this student (no test set, say) — and a blank reads better than braces.
 * Whitespace left behind by the collapse is tidied so the message never goes
 * out with a stray double space or a dangling blank line.
 */
export function renderMessageBody(body: string, vars: Partial<Record<DailyPlaceholder, string>>): string {
  return body
    .replace(PLACEHOLDER_RE, (_match, raw: string) => vars[normalise(raw) as DailyPlaceholder] ?? '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

/**
 * Uniform pick, or null for an empty pool.
 *
 * rng is injectable purely so the tests can assert the distribution rather
 * than hope; production always uses Math.random.
 */
export function pickRandom<T>(items: readonly T[], rng: () => number = Math.random): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(rng() * items.length) % items.length];
}
