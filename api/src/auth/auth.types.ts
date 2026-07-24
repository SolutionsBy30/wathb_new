export type SessionKind = 'admin' | 'student' | 'supervisor';

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
