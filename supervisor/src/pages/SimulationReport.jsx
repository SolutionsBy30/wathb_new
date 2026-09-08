import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';

const label = { fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' };
const body = { fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)', margin: 0, lineHeight: 1.7 };
const card = { background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' };
const th = { padding: '8px 10px', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)', textAlign: 'start' };
const td = { padding: '8px 10px', fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)' };

const AR = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
const ar = (v) => String(v).replace(/\d/g, (d) => AR[Number(d)]);
const pct = (n) => `${ar(Math.round(n * 10) / 10)}٪`;
const secs = (ms) => `${ar(Math.round(ms / 1000))} ث`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('ar-SA-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' }) : '—');

const BANDS = { easy: 'سهل', medium: 'متوسط', hard: 'صعب' };
const PARTS = { verbal: 'لفظي', quantitative: 'كمي', mixed: 'مختلط' };

const FILTERS = [
  { id: 'all', text: 'الكل' },
  { id: 'wrong', text: 'خاطئة' },
  { id: 'correct', text: 'صحيحة' },
  { id: 'blank', text: 'بدون إجابة' },
  { id: 'flagged', text: 'متروكة للمراجعة' },
];

/**
 * SIM-019 — §7.3 the supervisor's view of a simulation.
 *
 * Same result object as the student's report, deliberately: §7.3 says the
 * supervisor gets the *full* analysis, because this is the report that
 * justifies the subscription. What changes is the framing — the order is the
 * one §7.3 lays out top to bottom, and the wording addresses someone who did
 * not sit the test and needs to be told what the numbers mean.
 *
 * The question list is the part an instructor supervisor actually teaches
 * from, so it carries the stem, the student's answer, the correct answer and
 * the explanation rather than a score summary.
 */
export default function SimulationReport({ attemptId, studentName, onBack }) {
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
  const platform = report.percentiles?.platform;
  const school = report.percentiles?.school;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '820px', margin: '0 auto', padding: '28px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '20px', fontWeight: 600, color: 'var(--sand)' }}>
          تقرير المحاكي — {studentName ?? report.attempt.studentName}
        </h1>
        <span style={label}>{report.attempt.blueprintNameAr} · {report.attempt.formCode}</span>
        <span style={label}>{fmtDate(report.attempt.finalizedAt)}</span>
        {onBack && (
          <button onClick={onBack} style={{ ...label, marginInlineStart: 'auto', border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer' }}>
            رجوع
          </button>
        )}
      </div>

      <p style={{ ...body, color: 'var(--mist)' }}>
        المحاكي اختبار كامل بظروف القياس نفسها. النِّسب أدناه تقديرية وتصف الأداء في هذا النموذج، وليست درجة قياس رسمية.
      </p>

      {report.attempt.status !== 'completed' && (
        <p style={{ ...body, color: 'var(--coral)' }}>
          المحاولة غير مكتملة — لم يُنهِ الطالب جميع الأقسام، والأسئلة التي لم يصل إليها محسوبة بدون إجابة.
        </p>
      )}

      {/* 1 — الدرجة الكلية */}
      <div style={card}>
        <span style={{ ...body, fontWeight: 600 }}>الدرجة الكلية</span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '16px', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-latin)', fontSize: '48px', fontWeight: 600, color: 'var(--sand)', lineHeight: 1 }}>
            {ar(Math.round(t.accuracy))}٪
          </span>
          <span style={{ ...label, fontSize: '14px', color: 'var(--sand)' }}>{t.bandAr}</span>
          <span style={label}>{ar(t.rawScore)} من {ar(t.scoredCount)}</span>
          {report.previous && (
            <span style={{ ...label, color: (report.previous.delta ?? 0) >= 0 ? 'var(--lime)' : 'var(--coral)' }}>
              {(report.previous.delta ?? 0) >= 0 ? '▲' : '▼'} {ar(Math.abs(report.previous.delta ?? 0))} عن المحاكي السابق ({pct(report.previous.accuracy ?? 0)})
            </span>
          )}
        </div>
        {t.scaledEstimate !== null && (
          <span style={{ ...label, color: 'var(--sand)' }}>الدرجة التقديرية: {ar(t.scaledEstimate)} — تقديرية وليست درجة قياس رسمية.</span>
        )}
        <span style={label}>
          {platform?.reason === 'ok'
            ? `المئين على مستوى المنصة: ${ar(platform.percentile)} بين ${ar(platform.cohortSize)} طالبًا سجّلوا هذا النموذج.`
            : platform?.reason === 'not_comparable'
              ? 'نموذج مخصص لهذا الطالب، فلا تُحسب المقارنة مع بقية الطلاب.'
              : 'لم يسجّل هذا النموذج عدد كافٍ من الطلاب بعد لحساب المئين.'}
        </span>
        {school?.reason === 'ok' && (
          <span style={label}>المئين داخل المدرسة: {ar(school.percentile)} بين {ar(school.cohortSize)} طالبًا.</span>
        )}
      </div>

      {/* 2 — التوزيع العام */}
      <div style={card}>
        <span style={{ ...body, fontWeight: 600 }}>التوزيع العام</span>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          {t.verbalEstimate !== null && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={label}>لفظي</span>
              <span style={{ fontFamily: 'var(--font-latin)', fontSize: '26px', color: 'var(--sand)' }}>{ar(Math.round(t.verbalEstimate))}٪</span>
              <span style={label}>{t.verbalBandAr}</span>
            </div>
          )}
          {t.quantEstimate !== null && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={label}>كمي</span>
              <span style={{ fontFamily: 'var(--font-latin)', fontSize: '26px', color: 'var(--sand)' }}>{ar(Math.round(t.quantEstimate))}٪</span>
              <span style={label}>{t.quantBandAr}</span>
            </div>
          )}
        </div>
      </div>

      {/* 3 — التفصيل حسب المجال */}
      <div style={card}>
        <span style={{ ...body, fontWeight: 600 }}>التفصيل حسب المجال</span>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
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
              {(report.areaBreakdown ?? []).map((a) => (
                <tr key={a.areaId} style={{ borderTop: '0.5px solid var(--on-indigo-line)' }}>
                  <td style={td}>{a.areaNameAr}</td>
                  <td style={td}>{ar(a.total)}</td>
                  <td style={td}>{ar(a.correct)}</td>
                  <td style={td}>{ar(a.wrong)}</td>
                  <td style={td}>{ar(a.unanswered)}</td>
                  <td style={{ ...td, color: a.accuracy < 50 ? 'var(--coral)' : 'var(--sand)' }}>{pct(a.accuracy)}</td>
                  <td style={td}>{secs(a.meanTimeMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4 — التفصيل حسب القسم */}
      <div style={card}>
        <span style={{ ...body, fontWeight: 600 }}>التفصيل حسب القسم</span>
        {(report.sectionBreakdown ?? []).map((s) => (
          <div key={s.sectionIndex} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'baseline' }}>
            <span style={{ ...label, color: 'var(--sand)' }}>القسم {ar(s.sectionIndex + 1)}</span>
            <span style={label}>{PARTS[s.part] ?? s.part}</span>
            <span style={{ ...label, color: 'var(--sand)' }}>{pct(s.accuracy)}</span>
            <span style={label}>{ar(s.unanswered)} بدون إجابة</span>
            <span style={{ ...label, color: s.timedOut ? 'var(--coral)' : 'var(--mist)' }}>
              {s.timedOut ? 'انتهى الوقت قبل إكماله' : 'أنهاه بنفسه'}
            </span>
          </div>
        ))}
      </div>

      {/* 6 — قراءة الأداء (before the long question list, so it is read) */}
      <div style={card}>
        <span style={{ ...body, fontWeight: 600 }}>قراءة الأداء</span>
        <span style={body}>
          متوسط زمن السؤال {secs(p.meanTimeMs ?? 0)}. أجاب عن {ar(p.rushedCount ?? 0)} سؤالًا في أقل من ١٠ ثوانٍ
          {(p.rushedCount ?? 0) > 0 ? ' — وهذا عادةً تخمين وليس سرعة' : ''}، واستغرق أكثر من ٩٠ ثانية في {ar(p.timeSinkCount ?? 0)} سؤالًا.
          ترك {ar(p.unansweredCount ?? 0)} سؤالًا بدون إجابة.
        </span>
        {p.collapseSectionIndex !== null && p.collapseSectionIndex !== undefined && (
          <span style={{ ...body, color: 'var(--coral)' }}>
            انخفض أداؤه بوضوح ابتداءً من القسم {ar(p.collapseSectionIndex + 1)}. هذا مؤشر تحمّل وتوزيع وقت أكثر منه مؤشر معرفة — التدريب على اختبار كامل يعالجه أسرع من مراجعة المحتوى.
          </span>
        )}
        {Array.isArray(p.difficultyBands) && (
          <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
            {p.difficultyBands.map((b) => (
              <span key={b.band} style={label}>
                {BANDS[b.band]}: <b style={{ color: 'var(--sand)' }}>{pct(b.accuracy)}</b> ({ar(b.correct)}/{ar(b.total)})
              </span>
            ))}
          </div>
        )}
        {(p.screenExits ?? 0) > 0 && (
          <span style={label}>عدد مرات الخروج من الشاشة أثناء الاختبار: {ar(p.screenExits)}.</span>
        )}
      </div>

      {/* 7 — التوصيات */}
      <div style={card}>
        <span style={{ ...body, fontWeight: 600 }}>التوصيات</span>
        {(report.focusAreas ?? []).map((a, i) => (
          <span key={a.areaId} style={body}>
            {ar(i + 1)}. {a.areaNameAr} — {pct(a.accuracy)} · {ar(a.wrong)} خاطئة و{ar(a.unanswered)} بدون إجابة
          </span>
        ))}
        <span style={label}>وثبات الأيام القادمة ستركّز على هذه المجالات. المحاكي التالي متاح في {fmtDate(report.nextEligibleAt)}.</span>
      </div>

      {/* 5 — الأسئلة (last: it is the longest section, and the one to dig into) */}
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
                <span style={{ ...label, color: 'var(--sand)' }}>القسم {ar(q.sectionIndex + 1)} · سؤال {ar(q.position + 1)}</span>
                <span style={{ ...label, color: q.selectedKey === null ? 'var(--mist)' : q.isCorrect ? 'var(--lime)' : 'var(--coral)' }}>
                  {q.selectedKey === null ? 'بدون إجابة' : q.isCorrect ? 'صحيحة' : 'خاطئة'}
                </span>
                <span style={label}>{q.areaNameAr}</span>
                <span style={label}>{BANDS[q.difficultyBand]}</span>
                <span style={label}>{secs(q.timeSpentMs)}</span>
                {q.flagged && <span style={{ ...label, color: '#E8C547' }}>مميّز</span>}
                {!q.isScored && <span style={{ ...label, color: 'var(--teal-ink)' }}>تجريبي · غير محتسب</span>}
              </button>

              {open && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {q.passage && (
                    <div style={{ ...body, color: 'var(--mist)', maxHeight: '200px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>{q.passage}</div>
                  )}
                  <p style={{ ...body, fontSize: '14px' }} dir="auto">{q.stem}</p>
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
                            fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)',
                            background: right ? 'color-mix(in srgb, var(--lime) 22%, transparent)' : chosen ? 'color-mix(in srgb, var(--coral) 22%, transparent)' : 'transparent',
                            boxShadow: 'inset 0 0 0 0.5px var(--on-indigo-line)',
                            display: 'flex', gap: '8px', alignItems: 'center',
                          }}
                        >
                          <span>{o.text}</span>
                          {chosen && <span style={{ ...label, marginInlineStart: 'auto' }}>إجابة الطالب</span>}
                          {right && <span style={{ ...label, color: 'var(--lime)' }}>الصحيحة</span>}
                        </div>
                      );
                    })}
                  </div>
                  {q.explanation && <p style={{ ...body, color: 'var(--mist)' }} dir="auto">{q.explanation}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
