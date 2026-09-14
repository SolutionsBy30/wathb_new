import { Role } from '@prisma/client';

/**
 * AUTH-030 — one mobile number, more than one role.
 *
 * A parent who invites their own child is often a student here too; an
 * instructor preparing for the same exam they coach for is the same person
 * with the same phone. Until now the second registration was refused with
 * "this mobile number is already registered", which is true and useless.
 *
 * The split that matters is not student-vs-supervisor, it is *self-service*
 * versus *staff*:
 *
 *  - student and supervisor are accounts a private individual creates for
 *    themselves, both proven by an OTP to their own phone. Holding both is a
 *    fact about one person, and nothing one grants reaches the other.
 *
 *  - admin and school are granted by us, to reach other people's data. An
 *    admin signs in with an email and password; a school administrator's
 *    access follows employment. Neither may be picked up by proving control
 *    of a phone number, so neither joins this set — a single OTP must never
 *    be able to hop from a personal account into a staff one.
 *
 * That asymmetry is the whole security content of this file, which is why it
 * is here as data rather than spread across three services as `if` statements.
 */
export const SELF_SERVICE_ROLES = ['student', 'supervisor'] as const;
export type SelfServiceRole = (typeof SELF_SERVICE_ROLES)[number];

/** Staff roles are never combinable with anything, in either direction. */
export const STAFF_ROLES = ['admin', 'school'] as const;

export function isSelfServiceRole(role: string): role is SelfServiceRole {
  return (SELF_SERVICE_ROLES as readonly string[]).includes(role);
}

/**
 * The minimum a caller must load to reason about roles. Deliberately a
 * structural type rather than Prisma's User: every call site selects a
 * different set of columns, and this one names exactly what is required.
 */
export interface RoleBearer {
  role: Role;
  student?: unknown | null;
  supervisor?: unknown | null;
}

/**
 * Every role this user actually holds.
 *
 * Read from the profile rows rather than the `role` column, because `role`
 * records only what they signed up as first. A student who later became a
 * supervisor still has role 'student'; the Supervisor row is the truth.
 */
export function rolesHeldBy(user: RoleBearer): Role[] {
  const held: Role[] = [];
  // A staff account is its role and nothing else, even if a stray profile row
  // exists: whatever produced that row, it must not widen staff access.
  if (user.role === 'admin' || user.role === 'school') return [user.role];
  if (user.student) held.push('student');
  if (user.supervisor) held.push('supervisor');
  return held;
}

export function holdsRole(user: RoleBearer, role: Role): boolean {
  return rolesHeldBy(user).includes(role);
}

export type AddRoleVerdict =
  | { ok: true; alreadyHeld: boolean }
  | { ok: false; reasonAr: string };

/**
 * May this existing account take on `role`?
 *
 * `alreadyHeld` is a success, not a failure: signing up again with a number
 * that is already registered for that same role should log you in, not tell
 * you off. The caller sends an OTP either way.
 */
export function canAddRole(user: RoleBearer, role: SelfServiceRole): AddRoleVerdict {
  if (user.role === 'admin') {
    return { ok: false, reasonAr: 'هذا الرقم مسجّل بحساب إداري. استخدم رقمًا مختلفًا.' };
  }
  if (user.role === 'school') {
    return { ok: false, reasonAr: 'هذا الرقم مسجّل بحساب مسؤول مدرسة. استخدم رقمًا مختلفًا.' };
  }
  return { ok: true, alreadyHeld: holdsRole(user, role) };
}

/** Arabic labels, for a client that has to say which account it logged into. */
export const ROLE_LABELS_AR: Record<Role, string> = {
  student: 'طالب',
  supervisor: 'مشرف',
  admin: 'مسؤول',
  school: 'مسؤول مدرسة',
};
