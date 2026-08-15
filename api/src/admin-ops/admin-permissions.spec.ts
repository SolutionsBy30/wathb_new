import { ADMIN_PERMISSIONS, ADMIN_PERMISSION_GROUPS, ADMIN_PERMISSION_LABELS, hasAdminPermission, isAdminPermission } from './admin-permissions';

describe('admin permission vocabulary', () => {
  it('labels every permission', () => {
    for (const p of ADMIN_PERMISSIONS) expect(ADMIN_PERMISSION_LABELS[p]).toBeTruthy();
  });

  // The console renders from the groups; a key missing from them would be
  // enforceable by the API but ungrantable through the UI.
  it('places every permission in exactly one group', () => {
    const grouped = ADMIN_PERMISSION_GROUPS.flatMap((g) => g.keys);
    expect([...grouped].sort()).toEqual([...ADMIN_PERMISSIONS].sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it('rejects unknown keys', () => {
    expect(isAdminPermission('bank')).toBe(true);
    expect(isAdminPermission('bankk')).toBe(false);
    expect(isAdminPermission('admins')).toBe(false); // super-admin flag, never a grantable permission
  });
});

describe('hasAdminPermission', () => {
  it('grants only what is listed', () => {
    const admin = { isSuperAdmin: false, adminPermissions: ['bank', 'reviewQueue'] };
    expect(hasAdminPermission(admin, 'bank')).toBe(true);
    expect(hasAdminPermission(admin, 'reviewQueue')).toBe(true);
    expect(hasAdminPermission(admin, 'packages')).toBe(false);
    expect(hasAdminPermission(admin, 'auditLog')).toBe(false);
  });

  it('grants an empty list nothing', () => {
    const admin = { isSuperAdmin: false, adminPermissions: [] };
    for (const p of ADMIN_PERMISSIONS) expect(hasAdminPermission(admin, p)).toBe(false);
  });

  // Super-admin is computed, not expanded into the stored array, so a section
  // added later is covered without a migration.
  it('gives a super admin every permission, including ones added later', () => {
    const admin = { isSuperAdmin: true, adminPermissions: [] };
    for (const p of ADMIN_PERMISSIONS) expect(hasAdminPermission(admin, p)).toBe(true);
  });
});
