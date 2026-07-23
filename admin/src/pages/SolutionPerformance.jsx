import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Button } from '../design-system/components/Button';

export default function SolutionPerformance({ tests }) {
  const [testId, setTestId] = useState(tests[0]?.id);
  const [questions, setQuestions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [refreshed, setRefreshed] = useState(null);

  const load = () => {
    if (!testId) return;
    api.listQuestions({ testId, limit: 100 }).then((r) => setQuestions(r.items));
  };
  useEffect(() => { load(); }, [testId]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = async () => {
    setBusy(true);
    try {
      const result = await api.refreshQuestionStats();
      setRefreshed(result);
      load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '20px', fontWeight: 500, color: 'var(--sand)' }}>أداء الأسئلة</h1>
        <Button variant="primary" disabled={busy} onClick={refresh}>{busy ? 'جاري التحديث…' : 'تحديث الإحصاءات'}</Button>
      </div>
      {refreshed && (
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--mist)', fontFamily: 'var(--font-arabic)' }}>
          تمت معالجة {refreshed.versionsProcessed} سؤال · {refreshed.studentsRanked} طالباً في العينة
          {!refreshed.discriminationEnabled && ' — مؤشر التمييز غير متاح بعد (يحتاج 20 طالباً على الأقل)'}
        </p>
      )}

      <div style={{ display: 'flex', gap: '8px' }}>
        {tests.map((t) => (
          <button
            key={t.id}
            onClick={() => setTestId(t.id)}
            style={{
              border: 'none', cursor: 'pointer', padding: '8px 16px', borderRadius: '999px', fontFamily: 'var(--font-arabic)', fontSize: '13px',
              background: testId === t.id ? 'var(--lime)' : 'var(--on-indigo-subtle)', color: testId === t.id ? 'var(--lime-ink)' : 'var(--sand)',
            }}
          >
            {t.nameAr}
          </button>
        ))}
      </div>

      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'start', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>
              <th style={th}>نص السؤال</th>
              <th style={th}>التصنيف</th>
              <th style={th}>مرات العرض</th>
              <th style={th}>p-value</th>
              <th style={th}>مؤشر التمييز</th>
              <th style={th}>تقييم الشرح</th>
              <th style={th}>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q) => {
              const stats = q.versions[0]?.stats;
              const pValue = stats?.pValue;
              const disc = stats?.discrimination;
              const nonDiscriminating = pValue != null && (pValue < 0.15 || pValue > 0.95);
              const badKey = disc != null && disc < 0;
              return (
                <tr key={q.id} style={{ borderTop: '0.5px solid var(--on-indigo-line)' }}>
                  <td style={{ ...td, maxWidth: '360px' }}>
                    <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>
                      {q.versions[0]?.stem?.slice(0, 80)}
                    </span>
                  </td>
                  <td style={td}><span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>{q.label?.nameAr}</span></td>
                  <td style={td}><span style={{ fontFamily: 'var(--font-latin)', fontSize: '12px', color: 'var(--sand)' }}>{stats?.nServed ?? 0}</span></td>
                  <td style={td}><span style={{ fontFamily: 'var(--font-latin)', fontSize: '12px', color: nonDiscriminating ? 'var(--coral)' : 'var(--sand)' }}>{pValue != null ? `${Math.round(pValue * 100)}%` : '—'}</span></td>
                  <td style={td}><span style={{ fontFamily: 'var(--font-latin)', fontSize: '12px', color: badKey ? 'var(--coral)' : 'var(--sand)' }}>{disc != null ? disc.toFixed(2) : '—'}</span></td>
                  <td style={td}>
                    <span style={{ fontFamily: 'var(--font-latin)', fontSize: '12px', color: 'var(--sand)' }}>
                      👍{stats?.explanationUpvotes ?? 0} · 👎{stats?.explanationDownvotes ?? 0}
                    </span>
                  </td>
                  <td style={td}>
                    {badKey && <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--coral)', fontWeight: 500 }}>⚠ تحقق من مفتاح الإجابة</span>}
                    {!badKey && nonDiscriminating && <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--coral)' }}>غير مميّز</span>}
                    {!badKey && !nonDiscriminating && stats?.nServed >= 20 && <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--teal-ink)' }}>سليم</span>}
                    {(!stats || stats.nServed < 20) && <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>قيد الجمع</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {questions.length === 0 && <p style={{ margin: 0, padding: '20px', fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>لا توجد أسئلة لهذا الاختبار.</p>}
      </div>
    </div>
  );
}

const th = { padding: '10px 12px' };
const td = { padding: '10px 12px' };
