import { useEffect, useState } from 'react';
import { api } from '../api/client';

const selectStyle = {
  padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none',
  background: 'var(--indigo)', color: 'var(--sand)',
  fontFamily: 'var(--font-arabic)', fontSize: '13px',
};
const label = { fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' };

/**
 * ADM-101 — move a selection of questions to a different section.
 *
 * A question has no section column: its section comes from its label, so the
 * destination has to be picked all the way down to a label. The cascade makes
 * that visible rather than presenting a flat list of every label in the bank
 * and hoping the admin reads the prefix.
 *
 * Deliberately a two-step: pick, then confirm against a restated count and
 * destination. This is the one bulk action with no undo in the UI — status can
 * be set back, a move loses where the questions came from — so it should not
 * be reachable by one stray click.
 */
export default function BulkMoveQuestions({ tests, count, onMove, onCancel }) {
  const [testId, setTestId] = useState(tests[0]?.id ?? '');
  const [tree, setTree] = useState(null);
  const [sectionId, setSectionId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [labelId, setLabelId] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!testId) { setTree(null); return undefined; }
    let cancelled = false;
    // Every level below resets: leaving a stale areaId under a new section
    // would submit a destination the admin cannot see on screen.
    setSectionId(''); setAreaId(''); setLabelId(''); setConfirming(false);
    api.tree(testId).then((t) => { if (!cancelled) setTree(t); }).catch(() => { if (!cancelled) setTree(null); });
    return () => { cancelled = true; };
  }, [testId]);

  const sections = tree?.sections ?? [];
  const areas = sections.find((s) => s.id === sectionId)?.areas ?? [];
  const labels = (areas.find((a) => a.id === areaId)?.labels ?? []).filter((l) => !l.isRetired);

  const chosen = labels.find((l) => l.id === labelId);
  const destination = chosen
    ? `${tree.nameAr} · ${sections.find((s) => s.id === sectionId).nameAr} · ${areas.find((a) => a.id === areaId).nameAr} · ${chosen.nameAr}`
    : null;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onMove(labelId);
    } catch (e) {
      setError(e.message);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '16px',
      display: 'flex', flexDirection: 'column', gap: '12px', width: '100%',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '14px', color: 'var(--sand)' }}>
          نقل {count} سؤالًا إلى قسم آخر
        </span>
        <button onClick={onCancel} style={{ ...label, marginInlineStart: 'auto', border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer' }}>
          إلغاء
        </button>
      </div>

      <span style={label}>
        القسم والمجال يتبعان التصنيف، فاختر التصنيف الذي ستنتقل إليه الأسئلة.
      </span>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <select value={testId} onChange={(e) => setTestId(e.target.value)} style={selectStyle}>
          {tests.map((t) => <option key={t.id} value={t.id}>{t.nameAr}</option>)}
        </select>

        <select
          value={sectionId}
          onChange={(e) => { setSectionId(e.target.value); setAreaId(''); setLabelId(''); setConfirming(false); }}
          style={selectStyle}
        >
          <option value="">القسم</option>
          {sections.map((s) => <option key={s.id} value={s.id}>{s.nameAr}</option>)}
        </select>

        <select
          value={areaId}
          onChange={(e) => { setAreaId(e.target.value); setLabelId(''); setConfirming(false); }}
          disabled={!sectionId}
          style={selectStyle}
        >
          <option value="">المجال</option>
          {areas.map((a) => <option key={a.id} value={a.id}>{a.nameAr}</option>)}
        </select>

        <select
          value={labelId}
          onChange={(e) => { setLabelId(e.target.value); setConfirming(false); }}
          disabled={!areaId}
          style={selectStyle}
        >
          <option value="">التصنيف</option>
          {labels.map((l) => <option key={l.id} value={l.id}>{l.nameAr}</option>)}
        </select>
      </div>

      {error && <span style={{ ...label, color: 'var(--coral)' }}>{error}</span>}

      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          disabled={!labelId}
          style={{
            alignSelf: 'flex-start', border: 'none', borderRadius: 'var(--radius-sm)', padding: '9px 16px',
            cursor: labelId ? 'pointer' : 'default', opacity: labelId ? 1 : 0.4,
            background: 'var(--lime)', color: 'var(--lime-ink)',
            fontFamily: 'var(--font-arabic)', fontSize: '13px',
          }}
        >
          نقل…
        </button>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>
            سيُنقل {count} سؤالًا إلى: {destination}
          </span>
          {/* The old classification is not kept anywhere the console can read
              back, so this is honest about what "undo" would cost. */}
          <span style={{ ...label, color: 'var(--coral)' }}>
            لا يمكن التراجع من هنا — تصنيف الأسئلة الحالي سيُستبدل. (يُسجَّل في سجل التدقيق مع تصنيفها السابق.)
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setConfirming(false)}
              style={{ border: 'none', background: 'transparent', boxShadow: 'inset 0 0 0 0.5px var(--on-indigo-line)', color: 'var(--sand)', borderRadius: 'var(--radius-sm)', padding: '9px 16px', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}
            >
              تراجع
            </button>
            <button
              onClick={submit}
              disabled={busy}
              style={{ border: 'none', background: 'var(--lime)', color: 'var(--lime-ink)', borderRadius: 'var(--radius-sm)', padding: '9px 16px', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}
            >
              {busy ? 'جارٍ النقل…' : 'تأكيد النقل'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
