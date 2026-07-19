import { createHash } from 'crypto';

// Strip Arabic diacritics (harakat) and tatweel, collapse whitespace, so two
// questions that differ only by typos in vowel marks still hash identically.
const DIACRITICS = /[ً-ٰٟـ]/g;

export function normalizeStem(stem: string): string {
  return stem
    .replace(DIACRITICS, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function stemHash(stem: string): string {
  return createHash('sha256').update(normalizeStem(stem)).digest('hex');
}
