// SCH-002 — 'school' is a school administrator: scoped to one school's
// dashboard, never to an individual student's account. Kept out of the
// SubjectType enum on purpose — magic links and OTP subject types address
// people who own data, and a school administrator owns none of it.
export type SessionKind = 'admin' | 'student' | 'supervisor' | 'school';

export interface SessionPayload {
  sub: string; // user id
  kind: SessionKind;
  /** Present for magic-link-derived sessions — scopes the session to one purpose/target. */
  purpose?: string;
  targetId?: string;
  /**
   * STU-029 — epoch-ms timestamp of the last fresh-OTP step-up verification.
   * Sensitive actions (mobile-number change, subscription cancellation,
   * viewing payment history) require this to be recent (see
   * STEP_UP_VALIDITY_SECONDS in session.guard.ts), not just a valid session.
   */
  stepUpAt?: number;
}
