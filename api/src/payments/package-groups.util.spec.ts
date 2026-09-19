import { groupsForPackage } from './package-groups.util';

const GROUPS = [
  { id: 'school', nameAr: 'اختبارات القياس للثانوية', sort: 0 },
  { id: 'english', nameAr: 'اختبارات اللغة الإنجليزية', sort: 1 },
  { id: 'pro', nameAr: 'الشهادات المهنية', sort: 2 },
];

const TESTS = [
  { id: 'qudurat', groupId: 'school' },
  { id: 'tahsili', groupId: 'school' },
  { id: 'step', groupId: 'english' },
  { id: 'ielts', groupId: 'english' },
  { id: 'pmp', groupId: 'pro' },
  { id: 'loose', groupId: null },
];

const group = (testIds: string[]) => groupsForPackage(testIds, TESTS, GROUPS);

describe('groupsForPackage', () => {
  it('files a single-segment package under that segment', () => {
    const g = group(['qudurat', 'tahsili']);
    expect(g.groups.map((x) => x.id)).toEqual(['school']);
    expect(g.primaryGroupId).toBe('school');
    expect(g.spansGroups).toBe(false);
  });

  it('reports a package spanning segments rather than picking one', () => {
    // "Everything we offer" is a real product; filing it under whichever
    // segment sorted first would put it somewhere misleading.
    const g = group(['qudurat', 'step']);
    expect(g.groups.map((x) => x.id)).toEqual(['school', 'english']);
    expect(g.primaryGroupId).toBeNull();
    expect(g.spansGroups).toBe(true);
  });

  it('lists segments in catalogue order, not the order of the test ids', () => {
    const g = group(['pmp', 'step', 'qudurat']);
    expect(g.groups.map((x) => x.id)).toEqual(['school', 'english', 'pro']);
  });

  it('flags a package carrying an unfiled test', () => {
    // The unfiled test is exactly the thing someone needs to notice, so one
    // segment plus a stray test counts as spanning rather than filing cleanly.
    const g = group(['qudurat', 'loose']);
    expect(g.hasUngrouped).toBe(true);
    expect(g.spansGroups).toBe(true);
    expect(g.primaryGroupId).toBeNull();
  });

  it('handles a package of only unfiled tests', () => {
    const g = group(['loose']);
    expect(g.groups).toEqual([]);
    expect(g.hasUngrouped).toBe(true);
    // Nothing to span between, so it does not claim to span.
    expect(g.spansGroups).toBe(false);
    expect(g.primaryGroupId).toBeNull();
  });

  it('handles a package covering nothing', () => {
    const g = group([]);
    expect(g.groups).toEqual([]);
    expect(g.primaryGroupId).toBeNull();
    expect(g.spansGroups).toBe(false);
    expect(g.hasUngrouped).toBe(false);
  });

  it('ignores a test id that is not in the catalogue', () => {
    // A package can list a test that was later deleted; naming a segment from
    // an id nobody can resolve would invent a grouping.
    const g = group(['qudurat', 'deleted-test']);
    expect(g.groups.map((x) => x.id)).toEqual(['school']);
    expect(g.hasUngrouped).toBe(false);
  });

  it('survives a package with no testIds array at all', () => {
    expect(groupsForPackage(undefined as unknown as string[], TESTS, GROUPS).groups).toEqual([]);
  });

  it('ignores groups that no covered test belongs to', () => {
    const g = group(['step']);
    expect(g.groups.map((x) => x.id)).toEqual(['english']);
  });
});
