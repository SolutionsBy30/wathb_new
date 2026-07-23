// NOT-010 — recognized opt-out keywords, English and Arabic, matched
// case/diacritic-insensitively against the whole trimmed message body (not
// a substring match, so "I'll stop later" doesn't trigger it).

const STOP_KEYWORDS = new Set(['stop', 'إيقاف', 'ايقاف', 'وقف']);

export function isStopKeyword(body: string): boolean {
  const normalized = body.trim().toLowerCase();
  return STOP_KEYWORDS.has(normalized);
}
