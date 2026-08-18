import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Button } from '../design-system/components/Button';
import { Pager } from '../components/Pager';
import TaxonomyFilter from '../components/TaxonomyFilter';

// ADM-092 — the item-analysis floor lives in the API
// (question-stats.service.ts). Mirrored here only to label a row "قيد الجمع";
// if it moves there, move it here too.
const MIN_SERVED_FOR_STATS = 5;

export default function SolutionPerformance({ tests }) {
  // ADM-091 — section/area narrowing, same control as the question bank.
  const [scope, setScope] = useState({ testId: tests[0]?.id ?? '', sectionId: '', areaId: '' });
  const testId = scope.testId;
  const [questions, setQuestions] = useState([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [refreshed, setRefreshed] = useState(null);
  // ADM-089 — same cap as the bank: only the first 100 were ever fetched, so
  // the weakest questions in a large test could not be reached at all.
  const [page, setPage] = useState({ offset: 0, limit: 50 });

  const load = () => {
    if (!testId) return;
    api.listQuestions({ ...scope, offset: page.offset, limit: page.limit }).then((r) => {
      setQuestions(r.items);
      setTotal(r.total);
    });
  };
  useEffect(() => { setPage((p) => ({ ...p, offset: 0 })); }, [scope.testId, scope.sectionId, scope.areaId]);
  useEffect(() => { load(); }, [scope.testId, scope.sectionId, scope.areaId, page.offset, page.limit]); // eslint-disable-line react-hooks/exhaustive-deps

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
      {/* ADM-090 — the numbers refresh on their own now; the button is for
          seeing today's answers reflected before tomorrow's run. */}
      <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)', lineHeight: 1.8 }}>
        تُحدَّث هذه الإحصاءات تلقائياً كل ليلة الساعة ٣:٠٠ بتوقيت الرياض. استخدم الزر أعلاه لتضمين إجابات اليوم قبل التحديث التالي.
      </p>
      {refreshed && (
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--mist)', fontFamily: 'var(--font-arabic)' }}>
          تمت معالجة {refreshed.versionsProcessed} سؤال · {refreshed.studentsRanked} طالباً في العينة
          {!refreshed.discriminationEnabled && ' — مقياس التفريق بين المستويات غير متاح بعد (يحتاج ٢٠ طالباً على الأقل)'}
        </p>
      )}

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <TaxonomyFilter tests={tests} value={scope} onChange={setScope} />
      </div>

      {/* ADM-092 — the columns used to be headed "p-value" and "مؤشر التمييز",
          which mean nothing without an item-analysis background. The numbers
          are unchanged; only the words are. */}
      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)', lineHeight: 1.9 }}>
          <strong style={{ color: 'var(--sand)' }}>نسبة من أجابوا صحيحاً</strong> — كم طالباً من كل ١٠٠ أجاب عن السؤال صحيحاً. المرتفع جداً يعني سؤالاً سهلاً على الجميع، والمنخفض جداً يعني سؤالاً صعباً على الجميع؛ وكلاهما لا يكشف الفرق بين الطلاب.
        </span>
        <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)', lineHeight: 1.9 }}>
          <strong style={{ color: 'var(--sand)' }}>يفرّق بين المستويات</strong> — هل يجيب عنه الطلاب الأقوى أكثر من الأضعف. الرقم الموجب جيّد، والقريب من الصفر يعني سؤالاً لا يفرّق، والسالب يعني أن الأضعف أجابوا عنه أكثر — وغالباً سببه خطأ في مفتاح الإجابة.
        </span>
      </div>

      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'start', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>
              <th style={th}>نص السؤال</th>
              <th style={th}>التصنيف</th>
              <th style={th}>مرات العرض</th>
              <th style={th}>نسبة من أجابوا صحيحاً</th>
              <th style={th}>يفرّق بين المستويات</th>
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
                    {!badKey && !nonDiscriminating && stats?.nServed >= MIN_SERVED_FOR_STATS && <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--teal-ink)' }}>سليم</span>}
                    {(!stats || stats.nServed < MIN_SERVED_FOR_STATS) && <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>قيد الجمع</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pager total={total} offset={page.offset} limit={page.limit} onChange={setPage} />
        {questions.length === 0 && <p style={{ margin: 0, padding: '20px', fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>لا توجد أسئلة لهذا الاختبار.</p>}
      </div>
    </div>
  );
}

const th = { padding: '10px 12px' };
const td = { padding: '10px 12px' };
