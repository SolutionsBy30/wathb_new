import { isStopKeyword } from './stop-keyword.util';

describe('isStopKeyword', () => {
  it('matches the English keyword case-insensitively', () => {
    expect(isStopKeyword('STOP')).toBe(true);
    expect(isStopKeyword('stop')).toBe(true);
    expect(isStopKeyword('Stop')).toBe(true);
  });

  it('matches the Arabic keyword and its common hamza variant', () => {
    expect(isStopKeyword('إيقاف')).toBe(true);
    expect(isStopKeyword('ايقاف')).toBe(true);
    expect(isStopKeyword('وقف')).toBe(true);
  });

  it('tolerates surrounding whitespace', () => {
    expect(isStopKeyword('  stop  ')).toBe(true);
    expect(isStopKeyword('\nإيقاف\n')).toBe(true);
  });

  it('does not match STOP as a substring of a longer message', () => {
    expect(isStopKeyword("I'll stop later")).toBe(false);
    expect(isStopKeyword('من فضلك أوقف الإشعارات')).toBe(false);
  });

  it('does not match unrelated messages', () => {
    expect(isStopKeyword('مرحبا')).toBe(false);
    expect(isStopKeyword('')).toBe(false);
  });
});
