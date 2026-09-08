import { useEffect, useMemo, useState } from 'react';
import { api, mediaUrl } from '../../../api/client';
import { toArabicDigits } from './useSectionClock';

const label = { fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' };
const body = { fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)', margin: 0, lineHeight: 1.7 };
const card = { background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' };
const th = { padding: '8px 10px', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)', textAlign: 'start' };
const td = { padding: '8px 10px', fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)' };

const BANDS = { easy: 'سهل', medium: 'متوسط', hard: 'صعب' };
const PARTS = { verbal: 'لفظي', quantitative: 'كمي', mixed: 'مختلط' };

const pct = (n) => `${toArabicDigits(Math.round(n * 10) / 10)}٪`;
const secs = (ms) => `${toArabicDigits(Math.round(ms / 1000))} ث`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('ar-SA-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' }) : '—');

const FILTERS = [
  { id: 'all', text: 'الكل' },
  { id: 'wrong', text: 'خاطئة' },
  { id: 'correct', text: 'صحيحة' },
  { id: 'blank', text: 'بدون إجابة' },
  { id: 'flagged', text: 'متروكة للمراجعة' },
];

/**
 * SIM-018 — §7.2 the student report, and §6.7 answer review.
 *
 * Percentage first, and a scaled estimate only where the server actually has
 * one. §12.1 is unresolved, so most of the time `scaledEstimate` is null; the
 * screen shows nothing rather than a placeholder, because a greyed-out box
 * labelled "درجتك التقديرية" reads as a number that failed to load rather
 * than as a number that does not exist yet.
 */
export default function SimulationReport({ attemptId, onBack }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('wrong');
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    setReport(null);
    api.simulationReport(attemptId).then(setReport).catch((e) => setError(e.message));
  }, [attemptId]);

  const questions = useMemo(() => {
    const all = report?.questions ?? [];
    if (filter === 'wrong') return all.filter((q) => q.selectedKey !== null && q.isCorrect === false);
    if (filter === 'correct') return all.filter((q) => q.isCorrect === true);
    if (filter === 'blank') return all.filter((q) => q.selectedKey === null);
    if (filter === 'flagged') return all.filter((q) => q.flagged);
    return all;
  }, [report, filter]);

  if (error) return <p style={{ ...body, color: 'var(--coral)' }}>{error}</p>;
  if (!report) return <p style={body}>جارٍ التحميل…</p>;

  const t = report.totals;
  const p = report.pacing ?? {};
  const areas = report.areaBreakdown ?? [];
  const sections = report.sectionBreakdown ?? [];
  const platform = report.percentiles?.platform;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '760px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '20px', fontWeight: 600, color: 'var(--sand)' }}>
          تقرير المحاكي
        </h1>
        <span style={label}>{report.attempt.blueprintNameAr} · {report.attempt.formCode}</span>
        <span style={label}>{fmtDate(report.attempt.finalizedAt)}</span>
        {onBack && (
          <button onClick={onBack} style={{ ...label, marginInlineStart: 'auto', border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer' }}>
            رجوع
          </button>
        )}
      </div>

      {report.attempt.status !== 'completed' && (
        <p style={{ ...body, color: 'var(--coral)' }}>
          هذه المحاولة غير مكتملة — الأسئلة التي لم تُعرض عليك تُحتسب بدون إجابة.
        </p>
      )}

      {/* ------------------------------------------------------------ totals */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-latin)', fontSize: '44px', fontWeight: 600, color: 'var(--sand)', lineHeight: 1 }}>
            {toArabicDigits(Math.round(t.accuracy))}٪
          </span>
          <span style={{ ...label, fontSize: '13px', color: 'var(--sand)' }}>{t.bandAr}</span>
          <span style={label}>{toArabicDigits(t.rawScore)} من {toArabicDigits(t.scoredCount)} سؤالًا محتسبًا</span>
          {report.previous?.delta !== null && report.previous?.delta !== undefined && (
            <span style={{ ...label, color: report.previous.delta >= 0 ? 'var(--lime)' : 'var(--coral)' }}>
              {report.previous.delta >= 0 ? '▲' : '▼'} {toArabicDigits(Math.abs(report.previous.delta))} عن المحاكي السابق
            </span>
          )}
        </div>

        {/* §7.1 — only ever shown when the server has a real equating table,
            and always labelled تقديرية. */}
        {t.scaledEstimate !== null && (
          <span style={{ ...label, color: 'var(--sand)' }}>
            الدرجة التقديرية: {toArabicDigits(t.scaledEstimate)} — تقديرية وليست درجة قياس رسمية.
          </span>
        )}

        <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
          {t.verbalEstimate !== null && (
            <span style={label}>لفظي: <b style={{ color: 'var(--sand)' }}>{pct(t.verbalEstimate)}</b> · {t.verbalBandAr}</span>
          )}
          {t.quantEstimate !== null && (
            <span style={label}>كمي: <b style={{ color: 'var(--sand)' }}>{pct(t.quantEstimate)}</b> · {t.quantBandAr}</span>
          )}
        </div>

        {/* §7.2 — percentile only for static forms, and only once the cohort
            can carry one. Both refusals say why rather than leaving a blank. */}
        <span style={label}>
          {platform?.reason === 'ok'
            ? `أنت في المئين ${toArabicDigits(platform.percentile)} بين ${toArabicDigits(platform.cohortSize)} طالبًا سجّلوا هذا النموذج.`
            : platform?.reason === 'not_comparable'
              ? 'هذا نموذج مخصص لك، فلا تُحسب المقارنة مع بقية الطلاب.'
              : 'لم يسجّل هذا النموذج عدد كافٍ من الطلاب بعد لحساب ترتيبك.'}
        </span>

        <span style={label}>المحاكي التالي متاح في {fmtDate(report.nextEligibleAt)}</span>
      </div>

      {/* ------------------------------------------------------------- areas */}
      <div style={card}>
        <span style={{ ...body, fontWeight: 600 }}>التفصيل حسب المجال</span>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '520px' }}>
            <thead>
              <tr>
                <th style={th}>المجال</th>
                <th style={th}>الأسئلة</th>
                <th style={th}>صحيحة</th>
                <th style={th}>خاطئة</th>
                <th style={th}>بدون إجابة</th>
                <th style={th}>النسبة</th>
                <th style={th}>متوسط الزمن</th>
              </tr>
            </thead>
            <tbody>
              {areas.map((a) => (
                <tr key={a.areaId} style={{ borderTop: '0.5px solid var(--on-indigo-line)' }}>
                  <td style={td}>{a.areaNameAr}</td>
                  <td style={td}>{toArabicDigits(a.total)}</td>
                  <td style={td}>{toArabicDigits(a.correct)}</td>
                  <td style={td}>{toArabicDigits(a.wrong)}</td>
                  <td style={td}>{toArabicDigits(a.unanswered)}</td>
                  <td style={{ ...td, color: a.accuracy < 50 ? 'var(--coral)' : 'var(--sand)' }}>{pct(a.accuracy)}</td>
                  <td style={td}>{secs(a.meanTimeMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ----------------------------------------------------------- sections */}
      <div style={card}>
        <span style={{ ...body, fontWeight: 600 }}>التفصيل حسب القسم</span>
        {sections.map((s) => (
          <div key={s.sectionIndex} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'baseline' }}>
            <span style={{ ...label, color: 'var(--sand)' }}>القسم {toArabicDigits(s.sectionIndex + 1)}</span>
            <span style={label}>{PARTS[s.part] ?? s.part}</span>
            <span style={label}>{pct(s.accuracy)}</span>
            <span style={label}>{toArabicDigits(s.unanswered)} بدون إجابة</span>
            {s.timedOut && <span style={{ ...label, color: 'var(--coral)' }}>انتهى الوقت</span>}
          </div>
        ))}
      </div>

      {/* ------------------------------------------------------------ pacing */}
      <div style={card}>
        <span style={{ ...body, fontWeight: 600 }}>قراءة الأداء</span>
        <span style={body}>
          متوسط زمن السؤال {secs(p.meanTimeMs ?? 0)} · {toArabicDigits(p.rushedCount ?? 0)} سؤالًا أجبت عنه في أقل من ١٠ ثوانٍ ·{' '}
          {toArabicDigits(p.timeSinkCount ?? 0)} سؤالًا استغرق أكثر من ٩٠ ثانية · {toArabicDigits(p.unansweredCount ?? 0)} بدون إجابة
        </span>
        {p.collapseSectionIndex !== null && p.collapseSectionIndex !== undefined && (
          <span style={{ ...body, color: 'var(--coral)' }}>
            انخفض أداؤك بوضوح بدءًا من القسم {toArabicDigits(p.collapseSectionIndex + 1)} — غالبًا مسألة تحمّل وتوزيع وقت أكثر منها مسألة معرفة.
          </span>
        )}
        {Array.isArray(p.difficultyBands) && (
          <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
            {p.difficultyBands.map((b) => (
              <span key={b.band} style={label}>
                {BANDS[b.band]}: <b style={{ color: 'var(--sand)' }}>{pct(b.accuracy)}</b> ({toArabicDigits(b.correct)}/{toArabicDigits(b.total)})
              </span>
            ))}
          </div>
        )}
        {(p.screenExits ?? 0) > 0 && (
          <span style={label}>خرجت من الشاشة {toArabicDigits(p.screenExits)} مرة أثناء الاختبار.</span>
        )}
      </div>

      {/* ------------------------------------------------------------- focus */}
      {report.focusAreas?.length > 0 && (
        <div style={card}>
          <span style={{ ...body, fontWeight: 600 }}>ابدأ من هنا</span>
          {report.focusAreas.map((a, i) => (
            <span key={a.areaId} style={body}>
              {toArabicDigits(i + 1)}. {a.areaNameAr} — {pct(a.accuracy)}
            </span>
          ))}
        </div>
      )}

      {/* --------------------------------------------------------- questions */}
      <div style={card}>
        <span style={{ ...body, fontWeight: 600 }}>الأسئلة</span>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: '999px',
                fontFamily: 'var(--font-arabic)', fontSize: '11px',
                background: filter === f.id ? 'var(--lime)' : 'transparent',
                color: filter === f.id ? 'var(--lime-ink)' : 'var(--mist)',
                boxShadow: filter === f.id ? 'none' : 'inset 0 0 0 0.5px var(--on-indigo-line)',
              }}
            >
              {f.text}
            </button>
          ))}
        </div>

        {questions.length === 0 && <span style={label}>لا توجد أسئلة في هذا التصنيف.</span>}

        {questions.map((q) => {
          const options = Array.isArray(q.options) ? q.options : [];
          const open = openId === q.formItemId;
          return (
            <div key={q.formItemId} style={{ borderTop: '0.5px solid var(--on-indigo-line)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => setOpenId(open ? null : q.formItemId)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'start', padding: 0, display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'baseline' }}
              >
                <span style={{ ...label, color: 'var(--sand)' }}>
                  القسم {toArabicDigits(q.sectionIndex + 1)} · سؤال {toArabicDigits(q.position + 1)}
                </span>
                <span style={{ ...label, color: q.selectedKey === null ? 'var(--mist)' : q.isCorrect ? 'var(--lime)' : 'var(--coral)' }}>
                  {q.selectedKey === null ? 'بدون إجابة' : q.isCorrect ? 'صحيحة' : 'خاطئة'}
                </span>
                <span style={label}>{q.areaNameAr}</span>
                <span style={label}>{BANDS[q.difficultyBand]}</span>
                <span style={label}>{secs(q.timeSpentMs)}</span>
                {q.flagged && <span style={{ ...label, color: '#E8C547' }}>مميّز</span>}
                {/* §7.1 — an experimental item is shown because the student
                    answered it, and labelled because it is not in the score. */}
                {!q.isScored && <span style={{ ...label, color: 'var(--teal)' }}>تجريبي · غير محتسب</span>}
              </button>

              {open && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {q.passage && (
                    <div style={{ ...body, color: 'var(--mist)', maxHeight: '200px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>{q.passage}</div>
                  )}
                  <p style={{ ...body, fontSize: '14px' }} dir="auto">{q.stem}</p>
                  {q.stemImageUrl && <img src={mediaUrl(q.stemImageUrl)} alt="صورة السؤال" style={{ maxWidth: '100%', borderRadius: 'var(--radius-md)', background: 'var(--sand)' }} />}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {options.map((o) => {
                      const chosen = o.key === q.selectedKey;
                      const right = o.key === q.correctKey;
                      return (
                        <div
                          key={o.key}
                          dir="auto"
                          style={{
                            padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                            fontFamily: 'var(--font-arabic)', fontSize: '13px',
                            background: right ? 'color-mix(in srgb, var(--lime) 22%, transparent)' : chosen ? 'color-mix(in srgb, var(--coral) 22%, transparent)' : 'transparent',
                            boxShadow: 'inset 0 0 0 0.5px var(--on-indigo-line)',
                            color: 'var(--sand)',
                            display: 'flex', gap: '8px', alignItems: 'center',
                          }}
                        >
                          {o.imageUrl && <img src={mediaUrl(o.imageUrl)} alt="" style={{ maxHeight: '48px', borderRadius: '4px', background: 'var(--sand)' }} />}
                          <span>{o.text}</span>
                          {/* Both labels can land on one option — that is the
                              case worth seeing, and it reads as "you got it". */}
                          {chosen && <span style={{ ...label, marginInlineStart: 'auto' }}>إجابتك</span>}
                          {right && <span style={{ ...label, color: 'var(--lime)' }}>الصحيحة</span>}
                        </div>
                      );
                    })}
                  </div>

                  {q.explanation && (
                    <p style={{ ...body, color: 'var(--mist)' }} dir="auto">{q.explanation}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
