/**
 * ADM-088 — the admin console's permission vocabulary.
 *
 * One key per navigable section, deliberately matching the nav ids in
 * admin/src/App.jsx: the thing an admin is granted is the thing they see, so
 * there is no mapping table to drift. Backend routes carry
 * @RequirePermission with these same keys, because hiding a nav item is a
 * courtesy and the guard is the actual control.
 */
export const ADMIN_PERMISSIONS = [
  // المحتوى
  'taxonomy',
  'bank',
  'reviewQueue',
  'problemReports',
  'dailyTips',
  'import',
  'solutionPerf',
  // المستخدمون
  'students',
  'supervisors',
  'geography',
  // الأعمال
  'subscriptions',
  'packages',
  // النظام
  'notifications',
  'auditLog',
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

/** Arabic labels, so the API can describe a permission without the console. */
export const ADMIN_PERMISSION_LABELS: Record<AdminPermission, string> = {
  taxonomy: 'الاختبارات والتصنيف',
  bank: 'بنك الأسئلة',
  reviewQueue: 'قائمة المراجعة',
  problemReports: 'بلاغات المشاكل',
  dailyTips: 'نصيحة اليوم',
  import: 'استيراد جماعي',
  solutionPerf: 'أداء الأسئلة',
  students: 'الطلاب',
  supervisors: 'المشرفون',
  geography: 'الجغرافيا والمدارس',
  subscriptions: 'الاشتراكات',
  packages: 'الباقات والتسعير',
  notifications: 'الإشعارات',
  auditLog: 'سجل التدقيق',
};

export const ADMIN_PERMISSION_GROUPS: { group: string; keys: AdminPermission[] }[] = [
  { group: 'المحتوى', keys: ['taxonomy', 'bank', 'reviewQueue', 'problemReports', 'dailyTips', 'import', 'solutionPerf'] },
  { group: 'المستخدمون', keys: ['students', 'supervisors', 'geography'] },
  { group: 'الأعمال', keys: ['subscriptions', 'packages'] },
  { group: 'النظام', keys: ['notifications', 'auditLog'] },
];

export function isAdminPermission(value: string): value is AdminPermission {
  return (ADMIN_PERMISSIONS as readonly string[]).includes(value);
}

/**
 * A super-admin implies every permission. Kept here rather than expanded into
 * the stored array so that adding a new section grants it to super-admins
 * automatically — the alternative is a migration every time the console grows
 * a screen, and an admin silently missing it until someone notices.
 */
export function hasAdminPermission(
  user: { isSuperAdmin: boolean; adminPermissions: string[] },
  permission: AdminPermission,
): boolean {
  return user.isSuperAdmin || user.adminPermissions.includes(permission);
}

/**
 * ADM-088a — ANY-of. Several screens share one endpoint (listing questions
 * serves the bank, the review queue and question performance), so requiring
 * a single permission there locked admins out of screens they were granted.
 */
export function hasAnyAdminPermission(
  user: { isSuperAdmin: boolean; adminPermissions: string[] },
  permissions: AdminPermission[],
): boolean {
  return permissions.some((p) => hasAdminPermission(user, p));
}
