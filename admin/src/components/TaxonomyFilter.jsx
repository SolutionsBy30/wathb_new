import { useEffect, useState } from 'react';
import { api } from '../api/client';

const selectStyle = {
  padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none',
  background: 'var(--on-indigo-subtle)', color: 'var(--sand)',
  fontFamily: 'var(--font-arabic)', fontSize: '13px',
};

/**
 * ADM-091 — test → section → area filter, shared by the question bank and
 * question performance.
 *
 * The API has accepted sectionId/areaId on /admin/questions all along; only
 * the test dropdown was ever wired up, so a bank of thousands could be
 * narrowed to one test and no further.
 *
 * Sections and areas are read from the taxonomy tree of the selected test,
 * which is why picking a test is a precondition for the other two. Changing a
 * level clears the ones below it — leaving a stale areaId under a new section
 * would filter against a branch that is no longer on screen and return
 * nothing, which reads as "no questions" rather than as a stale filter.
 */
export default function TaxonomyFilter({ tests, value, onChange, includeAllTests = false }) {
  const { testId = '', sectionId = '', areaId = '' } = value;
  const [tree, setTree] = useState(null);

  useEffect(() => {
    if (!testId) { setTree(null); return undefined; }
    let cancelled = false;
    api.tree(testId).then((t) => { if (!cancelled) setTree(t); }).catch(() => { if (!cancelled) setTree(null); });
    return () => { cancelled = true; };
  }, [testId]);

  const sections = tree?.sections ?? [];
  const areas = sections.find((s) => s.id === sectionId)?.areas ?? [];

  return (
    <>
      <select
        value={testId}
        onChange={(e) => onChange({ testId: e.target.value, sectionId: '', areaId: '' })}
        style={selectStyle}
      >
        {includeAllTests && <option value="">كل الاختبارات</option>}
        {tests.map((t) => <option key={t.id} value={t.id}>{t.nameAr}</option>)}
      </select>

      <select
        value={sectionId}
        onChange={(e) => onChange({ testId, sectionId: e.target.value, areaId: '' })}
        disabled={!testId || sections.length === 0}
        style={selectStyle}
      >
        <option value="">كل الأقسام</option>
        {sections.map((s) => <option key={s.id} value={s.id}>{s.nameAr}</option>)}
      </select>

      <select
        value={areaId}
        onChange={(e) => onChange({ testId, sectionId, areaId: e.target.value })}
        disabled={!sectionId || areas.length === 0}
        style={selectStyle}
      >
        <option value="">كل المجالات</option>
        {areas.map((a) => <option key={a.id} value={a.id}>{a.nameAr}</option>)}
      </select>
    </>
  );
}
