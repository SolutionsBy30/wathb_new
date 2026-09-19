import { describe, it, expect } from 'vitest';
import { coversTest, coveredTestNames, packageFeatures } from './package-features';

const TESTS = [
  { id: 't1', nameAr: 'قدرات' },
  { id: 't2', nameAr: 'تحصيلي' },
  { id: 't3', nameAr: 'STEP' },
];

/** A fully-featured paid tier, which each test below varies one field of. */
const paid = {
  testIds: ['t1', 't2'],
  questionsPerDay: 5,
  dailyWathbLimit: null,
  simulationsIncluded: 2,
  weeklyReportEnabled: true,
  supervisorLinkingAllowed: true,
  reportVisibility: 'full',
};

const textsOf = (pkg, tests = TESTS) => packageFeatures(pkg, tests).map((f) => f.text);
const find = (pkg, fragment, tests = TESTS) =>
  packageFeatures(pkg, tests).find((f) => f.text.includes(fragment));

describe('coversTest', () => {
  it('is true only for a listed test', () => {
    expect(coversTest(paid, 't1')).toBe(true);
    expect(coversTest(paid, 't3')).toBe(false);
  });

  it('treats an empty list as covering nothing', () => {
    // Matches the server: subscription.util does testIds.includes(testId), so
    // an empty list entitles a student to nothing. The pricing page must not
    // read it as "everything" and advertise a package that grants no access.
    expect(coversTest({ testIds: [] }, 't1')).toBe(false);
  });

  it('survives a package with no testIds field at all', () => {
    expect(coversTest({}, 't1')).toBe(false);
  });
});

describe('coveredTestNames', () => {
  it('returns names in catalogue order, not the order of the ids', () => {
    expect(coveredTestNames({ testIds: ['t2', 't1'] }, TESTS)).toEqual(['قدرات', 'تحصيلي']);
  });

  it('ignores an id whose test is not in the catalogue', () => {
    // A test can be deactivated while a package still lists it; naming a test
    // the visitor cannot see would be worse than omitting it.
    expect(coveredTestNames({ testIds: ['t1', 'gone'] }, TESTS)).toEqual(['قدرات']);
  });
});

describe('packageFeatures', () => {
  it('names the single test a package covers', () => {
    expect(textsOf({ ...paid, testIds: ['t3'] })).toContain('اختبار STEP');
  });

  it('joins several covered tests', () => {
    expect(textsOf(paid)).toContain('قدرات وتحصيلي');
  });

  it('says plainly when a package covers nothing', () => {
    // A misconfigured package renders as a complete-looking card otherwise.
    expect(find({ ...paid, testIds: [] }, 'لا يشمل أي اختبار')).toMatchObject({ included: false });
  });

  it('states a daily cap as the cap it is, never as a feature', () => {
    expect(find({ ...paid, dailyWathbLimit: 1 }, 'وثبة واحدة في اليوم')).toMatchObject({ included: true });
    expect(find({ ...paid, dailyWathbLimit: 3 }, 'حتى 3 وثبات')).toBeTruthy();
  });

  it('reports an absent cap as unlimited', () => {
    expect(find(paid, 'غير محدودة')).toMatchObject({ included: true });
  });

  it('marks the simulator as missing when none are included', () => {
    // §5.5 — zero is the default, and its absence is exactly what someone
    // comparing tiers needs to see, so it is an explicit line not an omission.
    expect(find({ ...paid, simulationsIncluded: 0 }, 'لا يشمل المحاكي')).toMatchObject({ included: false });
  });

  it('counts included simulations, singular and plural', () => {
    expect(textsOf({ ...paid, simulationsIncluded: 1 })).toContain('محاكاة اختبار كاملة واحدة');
    expect(textsOf({ ...paid, simulationsIncluded: 4 })).toContain('4 محاكاة اختبار كاملة');
  });

  it('follows the package when the weekly report is switched off', () => {
    expect(find(paid, 'تقرير أسبوعي')).toMatchObject({ included: true });
    expect(find({ ...paid, weeklyReportEnabled: false }, 'بدون التقرير الأسبوعي')).toMatchObject({ included: false });
  });

  it('follows the package when supervisor linking is switched off', () => {
    expect(find({ ...paid, supervisorLinkingAllowed: false }, 'بدون ربط ولي الأمر')).toMatchObject({ included: false });
  });

  it('treats partial report visibility as a real product difference', () => {
    // FRE-004 — the student sees bands instead of per-area detail, which is a
    // tier difference a buyer should be able to see before paying.
    expect(find(paid, 'مفصّل')).toMatchObject({ included: true });
    expect(find({ ...paid, reportVisibility: 'partial' }, 'مختصر')).toMatchObject({ included: false });
  });

  it('never renders an empty or duplicate line', () => {
    const texts = textsOf(paid);
    expect(texts.every((t) => t && t.trim().length > 0)).toBe(true);
    expect(new Set(texts).size).toBe(texts.length);
  });

  it('works with no catalogue loaded yet', () => {
    // The pricing grid renders before /tests resolves; it must not throw and
    // must not claim coverage it cannot name.
    const texts = textsOf(paid, []);
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.some((t) => t.includes('قدرات'))).toBe(false);
  });
});
