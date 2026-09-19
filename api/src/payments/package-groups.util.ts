/**
 * PAY-015 — which catalogue segment a package belongs to.
 *
 * Derived from the tests it covers rather than stored on the package. A
 * package IS its coverage: one that includes قدرات and تحصيلي is a school
 * package because those tests are, and a stored group could disagree with the
 * tests the moment either is edited. Derivation cannot drift.
 *
 * A package spanning several segments is reported as spanning them, not
 * forced into one. That is a real product — "everything we offer" — and
 * picking its first group arbitrarily would file it somewhere misleading.
 */

export interface TestWithGroup {
  id: string;
  groupId: string | null;
}

export interface GroupRef {
  id: string;
  nameAr: string;
  sort?: number;
}

export interface PackageGrouping {
  /** Every segment this package touches, in catalogue order. */
  groups: GroupRef[];
  /** The single segment to file it under, or null when it spans more than one. */
  primaryGroupId: string | null;
  /** True when the package covers tests from more than one segment. */
  spansGroups: boolean;
  /** True when it covers at least one test belonging to no segment. */
  hasUngrouped: boolean;
}

export function groupsForPackage(
  testIds: string[],
  tests: TestWithGroup[],
  groups: GroupRef[],
): PackageGrouping {
  const covered = tests.filter((t) => (testIds ?? []).includes(t.id));
  const groupIds = new Set(covered.map((t) => t.groupId).filter((g): g is string => !!g));
  const hasUngrouped = covered.some((t) => !t.groupId);

  // Catalogue order, so the console lists segments the same way everywhere.
  const ordered = groups
    .filter((g) => groupIds.has(g.id))
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.nameAr.localeCompare(b.nameAr, 'ar'))
    .map((g) => ({ id: g.id, nameAr: g.nameAr }));

  // A package with one segment and no stray ungrouped test files cleanly.
  // Anything else spans, including "one segment plus an unfiled test", because
  // that unfiled test is exactly the thing someone needs to notice.
  const spansGroups = ordered.length > 1 || (ordered.length >= 1 && hasUngrouped);

  return {
    groups: ordered,
    primaryGroupId: !spansGroups && ordered.length === 1 ? ordered[0].id : null,
    spansGroups,
    hasUngrouped,
  };
}
