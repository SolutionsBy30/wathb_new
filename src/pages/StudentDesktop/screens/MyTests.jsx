import { useEffect, useState } from 'react';
import { api } from '../../../api/client';

const fieldStyle = { padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--indigo)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '12px', width: '120px' };
const chipStyle = { border: 'none', cursor: 'pointer', padding: '7px 14px', borderRadius: '999px', fontFamily: 'var(--font-arabic)', fontSize: '12px' };

// STU-002/STU-024 — the tests covered by the student's package: switch each
// on or off, set its own target score and exam date, and choose which one a
// new leap defaults to.
export default function MyTests({ onChanged }) {
  const [data, setData] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState({});

  const load = () => api.myTests().then((d) => {
    setData(d);
    setDraft(Object.fromEntries(d.tests.map((t) => [t.testId, {
      targetScore: t.targetScore ?? '',
      testDate: t.testDate ? String(t.testDate).slice(0, 10) : '',
    }])));
  }).catch((e) => setError(e.message));

  useEffect(() => { load(); }, []);

  const update = async (testId, patch) => {
    setBusyId(testId);
    setError(null);
    try {
      const next = await api.updateMyTest(testId, patch);
      setData(next);
      onChanged?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  if (error) return <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--coral)' }}>{error}</p>;
  if (!data) return <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>جاري التحميل…</p>;
  if (data.tests.length === 0) {
    return <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>لا توجد اختبارات في باقتك الحالية.</p>;
  }

  const noneActive = data.tests.every((t) => !t.isActive);

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <p style={{ margin: '0 0 4px', fontFamily: 'var(--font-arabic)', fontSize: '12px', color: noneActive ? 'var(--coral)' : 'var(--mist)', lineHeight: 1.8 }}>
        {noneActive
          ? 'لا يوجد اختبار مفعّل — فعّل اختباراً واحداً على الأقل لتبدأ وثبتك اليومية.'
          : 'يمكنك تفعيل أكثر من اختبار في نفس الوقت، واختيار أيّها تبدأ به كل يوم.'}
      </p>
      {data.tests.map((t) => (
        <div key={t.testId} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 0', borderTop: '0.5px solid var(--on-indigo-line)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '14px', color: t.isActive ? 'var(--sand)' : 'var(--mist)' }}>{t.nameAr}</span>
            {t.isFocused && (
              <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '10px', color: 'var(--lime-ink)', background: 'var(--lime)', borderRadius: '999px', padding: '2px 8px' }}>الاختبار الحالي</span>
            )}
            {/* STU-031 — every live test is listed now, so a row may be one
                the current package doesn't pay for. Say so here rather than
                letting the student switch it on and hit a 403 at start. */}
            {t.isCovered === false && (
              <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '10px', color: 'var(--mist)', boxShadow: 'inset 0 0 0 0.5px var(--on-indigo-line)', borderRadius: '999px', padding: '2px 8px' }}>خارج باقتك</span>
            )}
            <button
              disabled={busyId === t.testId}
              onClick={() => update(t.testId, { isActive: !t.isActive })}
              style={{ ...chipStyle, marginInlineStart: 'auto', background: 'transparent', boxShadow: 'inset 0 0 0 0.5px var(--on-indigo-line)', color: t.isActive ? 'var(--coral)' : 'var(--teal-ink)' }}
            >
              {t.isActive ? 'إيقاف' : 'تفعيل'}
            </button>
            {t.isActive && !t.isFocused && (
              <button
                disabled={busyId === t.testId}
                onClick={() => update(t.testId, { focus: true })}
                style={{ ...chipStyle, background: 'var(--lime)', color: 'var(--lime-ink)' }}
              >
                اجعله الحالي
              </button>
            )}
          </div>
          {t.isActive && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                type="number" min="0" max="100" placeholder="الدرجة المستهدفة"
                value={draft[t.testId]?.targetScore ?? ''}
                onChange={(e) => setDraft((p) => ({ ...p, [t.testId]: { ...p[t.testId], targetScore: e.target.value } }))}
                style={fieldStyle}
              />
              <input
                type="date"
                value={draft[t.testId]?.testDate ?? ''}
                onChange={(e) => setDraft((p) => ({ ...p, [t.testId]: { ...p[t.testId], testDate: e.target.value } }))}
                style={{ ...fieldStyle, fontFamily: 'var(--font-latin)', width: '150px' }}
              />
              <button
                disabled={busyId === t.testId}
                onClick={() => update(t.testId, {
                  targetScore: draft[t.testId]?.targetScore === '' ? null : Number(draft[t.testId].targetScore),
                  testDate: draft[t.testId]?.testDate === '' ? null : draft[t.testId].testDate,
                })}
                style={{ ...chipStyle, background: 'var(--lime)', color: 'var(--lime-ink)' }}
              >
                حفظ الهدف
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
