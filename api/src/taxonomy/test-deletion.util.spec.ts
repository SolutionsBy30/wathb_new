import { canDeleteTest, deletionBlockers, refusalMessageAr, subscriptionCount, TestUsage } from './test-deletion.util';

const clean: TestUsage = {
  questions: 0,
  targetingStudents: 0,
  studentTests: 0,
  wathbs: 0,
  blueprints: 0,
  packages: [],
};

describe('canDeleteTest', () => {
  it('allows deleting a test nothing is attached to', () => {
    expect(canDeleteTest(clean)).toBe(true);
    expect(deletionBlockers(clean)).toEqual([]);
  });

  it('refuses a test that holds questions', () => {
    // Section.test cascades, so this would take the whole taxonomy with it,
    // and Question.label restricts, so the cascade would abort halfway with a
    // foreign-key error rather than a sentence.
    expect(canDeleteTest({ ...clean, questions: 1 })).toBe(false);
  });

  it('refuses a test carried by a package with live subscriptions', () => {
    const usage = { ...clean, packages: [{ nameAr: 'الشاملة', subscriptions: 12 }] };
    expect(canDeleteTest(usage)).toBe(false);
    expect(deletionBlockers(usage)[0]).toContain('12 اشتراك');
    expect(deletionBlockers(usage)[0]).toContain('الشاملة');
  });

  it('refuses a test listed by a package even with no subscribers', () => {
    // Package.testIds is a plain string array with no foreign key, so nothing
    // in the database would stop the id becoming a dangling reference.
    const usage = { ...clean, packages: [{ nameAr: 'تجريبية', subscriptions: 0 }] };
    expect(canDeleteTest(usage)).toBe(false);
    expect(deletionBlockers(usage)[0]).toContain('أزله من الباقات');
  });

  it('refuses a test students have activated', () => {
    // StudentTest.test cascades — deleting would silently discard enrolments.
    expect(canDeleteTest({ ...clean, studentTests: 3 })).toBe(false);
  });

  it('refuses a test students are targeting', () => {
    expect(canDeleteTest({ ...clean, targetingStudents: 40 })).toBe(false);
  });

  it('refuses a test with practice history', () => {
    expect(canDeleteTest({ ...clean, wathbs: 900 })).toBe(false);
  });

  it('refuses a test a simulation blueprint is built on', () => {
    expect(canDeleteTest({ ...clean, blueprints: 1 })).toBe(false);
  });
});

describe('deletionBlockers', () => {
  it('reports every reason in one pass, not the first one it finds', () => {
    // Fixing blockers one at a time, with a destructive operation at the end
    // of each attempt, is the wrong way to learn what a test is attached to.
    const usage: TestUsage = {
      questions: 220,
      targetingStudents: 15,
      studentTests: 9,
      wathbs: 1200,
      blueprints: 2,
      packages: [{ nameAr: 'الشاملة', subscriptions: 30 }],
    };
    expect(deletionBlockers(usage)).toHaveLength(6);
  });

  it('leads with the questions, which is the destructive one', () => {
    const usage = { ...clean, questions: 5, wathbs: 3 };
    expect(deletionBlockers(usage)[0]).toContain('سؤال');
  });

  it('separates packages that have subscribers from those that do not', () => {
    const usage = {
      ...clean,
      packages: [
        { nameAr: 'الشاملة', subscriptions: 4 },
        { nameAr: 'المجانية', subscriptions: 0 },
      ],
    };
    const blockers = deletionBlockers(usage);
    // Two distinct problems with two distinct fixes: cancel/migrate the
    // subscribers, versus just edit the other package's test list.
    expect(blockers).toHaveLength(2);
    expect(blockers[0]).toContain('الشاملة');
    expect(blockers[0]).not.toContain('المجانية');
    expect(blockers[1]).toContain('المجانية');
  });
});

describe('subscriptionCount', () => {
  it('sums across every package carrying the test', () => {
    expect(subscriptionCount({ ...clean, packages: [
      { nameAr: 'أ', subscriptions: 3 },
      { nameAr: 'ب', subscriptions: 4 },
    ] })).toBe(7);
  });

  it('is zero with no packages', () => {
    expect(subscriptionCount(clean)).toBe(0);
  });
});

describe('refusalMessageAr', () => {
  it('names the test, lists the blockers, and offers deactivation', () => {
    // Deactivation is what the admin actually wants in nearly every case, so
    // the refusal should not leave them hunting for it.
    const msg = refusalMessageAr('قدرات', ['يحتوي على 5 سؤال.']);
    expect(msg).toContain('قدرات');
    expect(msg).toContain('يحتوي على 5 سؤال.');
    expect(msg).toContain('تعطيل');
  });
});
