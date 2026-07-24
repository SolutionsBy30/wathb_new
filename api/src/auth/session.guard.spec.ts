import { isStepUpFresh, STEP_UP_VALIDITY_SECONDS } from './session.guard';

describe('isStepUpFresh', () => {
  const now = 1_800_000_000_000;

  it('rejects a session with no step-up at all', () => {
    expect(isStepUpFresh(undefined, now)).toBe(false);
  });

  it('accepts a step-up verified just now', () => {
    expect(isStepUpFresh(now, now)).toBe(true);
  });

  it('accepts a step-up right up to the validity boundary', () => {
    expect(isStepUpFresh(now - STEP_UP_VALIDITY_SECONDS * 1000, now)).toBe(true);
  });

  it('rejects a step-up one second past the validity window', () => {
    expect(isStepUpFresh(now - STEP_UP_VALIDITY_SECONDS * 1000 - 1000, now)).toBe(false);
  });
});
