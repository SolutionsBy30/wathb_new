import {
  pickRandom,
  placeholdersUsed,
  renderMessageBody,
  unknownPlaceholders,
  validateMessageBody,
} from './message-template.util';

describe('placeholdersUsed', () => {
  it('finds each placeholder once, in order of first appearance', () => {
    expect(placeholdersUsed('{student_name} … {magic_link} … {student_name}')).toEqual(['student_name', 'magic_link']);
  });

  it('treats {magic-link} and {magic_link} as the same placeholder', () => {
    expect(placeholdersUsed('{magic-link} {magic_link}')).toEqual(['magic_link']);
  });

  it('is case-insensitive', () => {
    expect(placeholdersUsed('{Student_Name}')).toEqual(['student_name']);
  });

  it('returns nothing for a body with no placeholders', () => {
    expect(placeholdersUsed('صباح الخير')).toEqual([]);
  });
});

describe('unknownPlaceholders', () => {
  it('passes the supported set', () => {
    expect(unknownPlaceholders('{student_name} {magic_link} {test_name}')).toEqual([]);
  });

  it('reports anything else', () => {
    expect(unknownPlaceholders('{student_name} {streak} {magic_link}')).toEqual(['streak']);
  });
});

describe('validateMessageBody', () => {
  it('accepts a well-formed body', () => {
    expect(validateMessageBody('يلا {student_name}! وثبتك جاهزة: {magic_link}')).toBeNull();
  });

  it('rejects an empty body', () => {
    expect(validateMessageBody('   ')).toMatch(/مطلوب/);
  });

  it('rejects a body with no magic link — it would be unopenable', () => {
    expect(validateMessageBody('صباح الخير {student_name}')).toMatch(/magic_link/);
  });

  it('accepts the hyphenated spelling of the link placeholder', () => {
    expect(validateMessageBody('{student_name} {magic-link}')).toBeNull();
  });

  it('names the unknown placeholders it rejects', () => {
    const err = validateMessageBody('{magic_link} {streak} {rank}');
    expect(err).toMatch(/streak/);
    expect(err).toMatch(/rank/);
  });

  it('rejects an over-long body', () => {
    expect(validateMessageBody(`{magic_link} ${'ا'.repeat(1000)}`)).toMatch(/طويل/);
  });
});

describe('renderMessageBody', () => {
  const vars = { student_name: 'سارة', magic_link: 'https://wathb.tech/#magic=abc', test_name: 'قدرات' };

  it('substitutes every supported placeholder', () => {
    expect(renderMessageBody('يلا {student_name}، {test_name} بانتظارك: {magic_link}', vars)).toBe(
      'يلا سارة، قدرات بانتظارك: https://wathb.tech/#magic=abc',
    );
  });

  it('substitutes the hyphenated spelling too', () => {
    expect(renderMessageBody('{magic-link}', vars)).toBe(vars.magic_link);
  });

  it('collapses a placeholder with no value rather than printing braces', () => {
    const out = renderMessageBody('وثبتك في {test_name} جاهزة: {magic_link}', { ...vars, test_name: undefined });
    expect(out).not.toMatch(/[{}]/);
    expect(out).toBe('وثبتك في جاهزة: https://wathb.tech/#magic=abc');
  });

  it('does not leave double spaces behind a collapsed placeholder', () => {
    expect(renderMessageBody('{test_name} {magic_link}', { magic_link: 'X' })).toBe('X');
  });

  it('leaves a body with no placeholders untouched', () => {
    expect(renderMessageBody('صباح الخير', vars)).toBe('صباح الخير');
  });

  it('keeps deliberate paragraph breaks', () => {
    expect(renderMessageBody('{student_name}\n\n{magic_link}', vars)).toBe('سارة\n\nhttps://wathb.tech/#magic=abc');
  });
});

describe('pickRandom', () => {
  it('returns null for an empty pool', () => {
    expect(pickRandom([])).toBeNull();
  });

  it('returns the only item of a single-item pool', () => {
    expect(pickRandom(['a'])).toBe('a');
  });

  it('maps the rng across the whole pool', () => {
    expect(pickRandom(['a', 'b', 'c'], () => 0)).toBe('a');
    expect(pickRandom(['a', 'b', 'c'], () => 0.5)).toBe('b');
    expect(pickRandom(['a', 'b', 'c'], () => 0.99)).toBe('c');
  });

  it('stays in range even if the rng returns exactly 1', () => {
    // Math.random() never returns 1, but a stub or a future rng might, and an
    // out-of-range index here would send an undefined message body.
    expect(pickRandom(['a', 'b', 'c'], () => 1)).toBe('a');
  });

  it('can reach every item over many draws', () => {
    const pool = ['a', 'b', 'c'];
    const seen = new Set(Array.from({ length: 300 }, () => pickRandom(pool)));
    expect(seen).toEqual(new Set(pool));
  });
});
