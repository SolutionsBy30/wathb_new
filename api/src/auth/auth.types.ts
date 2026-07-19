export type SessionKind = 'admin' | 'student' | 'supervisor';

export interface SessionPayload {
  sub: string; // user id
  kind: SessionKind;
  /** Present for magic-link-derived sessions — scopes the session to one purpose/target. */
  purpose?: string;
  targetId?: string;
}
