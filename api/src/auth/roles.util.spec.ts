import { canAddRole, holdsRole, isSelfServiceRole, ROLE_LABELS_AR, rolesHeldBy, SELF_SERVICE_ROLES } from './roles.util';

const student = { role: 'student' as const, student: {}, supervisor: null };
const supervisor = { role: 'supervisor' as const, student: null, supervisor: {} };
const both = { role: 'student' as const, student: {}, supervisor: {} };
const admin = { role: 'admin' as const, student: null, supervisor: null };
const school = { role: 'school' as const, student: null, supervisor: null };

describe('rolesHeldBy', () => {
  it('reads the profile rows, not the role column', () => {
    // The whole point: this user signed up as a student and later became a
    // supervisor. role still says 'student'.
    expect(rolesHeldBy(both)).toEqual(['student', 'supervisor']);
  });

  it('reports a single role for a single profile', () => {
    expect(rolesHeldBy(student)).toEqual(['student']);
    expect(rolesHeldBy(supervisor)).toEqual(['supervisor']);
  });

  it('returns nothing for an account with no profile rows', () => {
    expect(rolesHeldBy({ role: 'student', student: null, supervisor: null })).toEqual([]);
  });

  it('reports a staff role as itself and nothing more', () => {
    expect(rolesHeldBy(admin)).toEqual(['admin']);
    expect(rolesHeldBy(school)).toEqual(['school']);
  });

  it('never widens a staff account, even if a profile row somehow exists', () => {
    // Defence in depth. If a Student row is ever attached to an admin — by a
    // migration, a fixture, a bug — it must not become a way to hold two
    // roles, one of which reaches every student's record.
    expect(rolesHeldBy({ role: 'admin', student: {}, supervisor: {} })).toEqual(['admin']);
    expect(rolesHeldBy({ role: 'school', student: {}, supervisor: {} })).toEqual(['school']);
  });
});

describe('holdsRole', () => {
  it('is true only for roles actually held', () => {
    expect(holdsRole(both, 'student')).toBe(true);
    expect(holdsRole(both, 'supervisor')).toBe(true);
    expect(holdsRole(student, 'supervisor')).toBe(false);
    expect(holdsRole(student, 'admin')).toBe(false);
  });

  it('refuses a staff role to a self-service account', () => {
    expect(holdsRole(student, 'school')).toBe(false);
    expect(holdsRole(both, 'admin')).toBe(false);
  });
});

describe('canAddRole', () => {
  it('lets a student become a supervisor too', () => {
    expect(canAddRole(student, 'supervisor')).toEqual({ ok: true, alreadyHeld: false });
  });

  it('lets a supervisor become a student too', () => {
    expect(canAddRole(supervisor, 'student')).toEqual({ ok: true, alreadyHeld: false });
  });

  it('treats re-registering an existing role as success, not an error', () => {
    // Signing up again with a number already registered for that role should
    // send a code and log them in, not refuse.
    expect(canAddRole(student, 'student')).toEqual({ ok: true, alreadyHeld: true });
    expect(canAddRole(both, 'supervisor')).toEqual({ ok: true, alreadyHeld: true });
  });

  it('refuses to graft a self-service role onto an admin account', () => {
    const verdict = canAddRole(admin, 'student');
    expect(verdict.ok).toBe(false);
    expect((verdict as { reasonAr: string }).reasonAr).toContain('إداري');
  });

  it('refuses to graft a self-service role onto a school account', () => {
    // A school administrator reaches other people's children's data. If one
    // OTP to this number could also open a student account, the boundary
    // between staff access and a personal account would be one code.
    const verdict = canAddRole(school, 'supervisor');
    expect(verdict.ok).toBe(false);
    expect((verdict as { reasonAr: string }).reasonAr).toContain('مدرسة');
  });
});

describe('the self-service set', () => {
  it('contains exactly student and supervisor', () => {
    // Pinned deliberately: adding 'admin' or 'school' here would make every
    // combinability check in the codebase wrong at once.
    expect([...SELF_SERVICE_ROLES]).toEqual(['student', 'supervisor']);
  });

  it('classifies staff roles as not self-service', () => {
    expect(isSelfServiceRole('student')).toBe(true);
    expect(isSelfServiceRole('supervisor')).toBe(true);
    expect(isSelfServiceRole('admin')).toBe(false);
    expect(isSelfServiceRole('school')).toBe(false);
  });

  it('labels every role, so no client has to invent a word for one', () => {
    for (const role of ['student', 'supervisor', 'admin', 'school'] as const) {
      expect(ROLE_LABELS_AR[role]).toBeTruthy();
    }
  });
});
