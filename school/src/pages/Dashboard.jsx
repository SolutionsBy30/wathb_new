import { useEffect, useState } from 'react';

const card = { background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' };
const label = { fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' };
const body = { fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)', margin: 0, lineHeight: 1.8 };
const h2 = { margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '15px', fontWeight: 600, color: 'var(--sand)' };
const th = { padding: '9px 10px', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)', textAlign: 'start', whiteSpace: 'nowrap' };
const td = { padding: '9px 10px', fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)' };

const BAND = {
  strong: { text: 'متقدّم', color: 'var(--lime)' },
  on_track: { text: 'في المسار', color: 'var(--teal)' },
  needs_support: { text: 'يحتاج دعمًا', color: '#E8C547' },
  at_risk: { text: 'يحتاج تدخّلًا', color: 'var(--coral)' },
  insufficient: { text: 'بيانات غير كافية', color: 'var(--mist)' },
};

const TREND = { improving: '▲ في تحسّن', declining: '▼ في تراجع', steady: '— مستقر', unknown: 'يحتاج محاولة أخرى' };

const pct = (n) => (n === null || n === undefined ? '—' : `${Math.round(n * 10) / 10}٪`);
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('ar-SA-u-nu-latn', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

function Stat({ text, value, hint, tone }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '110px' }}>
      <span style={label}>{text}</span>
      <span style={{ fontFamily: 'var(--font-latin)', fontSize: '26px', fontWeight: 500, color: tone ?? 'var(--sand)', lineHeight: 1 }}>{value}</span>
      {hint && <span style={{ ...label, fontSize: '10px' }}>{hint}</span>}
    </div>
  );
}

/** The band mix, as one bar. Shows the shape of a cohort faster than five numbers. */
function BandBar({ bands, total }) {
  const order = ['strong', 'on_track', 'needs_support', 'at_risk', 'insufficient'];
  if (!total) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', height: '12px', borderRadius: '999px', overflow: 'hidden', background: 'var(--indigo)' }}>
        {order.map((b) => (
          bands[b] > 0 && (
            <div
              key={b}
              title={`${BAND[b].text}: ${bands[b]}`}
              style={{ width: `${(bands[b] / total) * 100}%`, background: BAND[b].color }}
            />
          )
        ))}
      </div>
      <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
        {order.map((b) => bands[b] > 0 && (
          <span key={b} style={{ ...label, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <i style={{ width: '9px', height: '9px', borderRadius: '3px', background: BAND[b].color, display: 'inline-block' }} />
            {BAND[b].text}: {bands[b]}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The forecast range, drawn so the floor reads as clearly as the latest score. */
function ForecastCell({ f }) {
  if (!f) return <span style={{ ...label }}>لم يجرِ المحاكي</span>;
  if (f.attempts === 1) {
    return (
      <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>
        {pct(f.likely)} · محاولة واحدة
      </span>
    );
  }
  return (
    <span style={{ display: 'inline-flex', gap: '8px', alignItems: 'baseline', flexWrap: 'wrap' }}>
      <span style={{ fontFamily: 'var(--font-latin)', fontSize: '13px', color: 'var(--sand)' }} dir="ltr">
        {f.low}–{f.high}٪
      </span>
      <span style={{ ...label }}>آخر {pct(f.likely)}</span>
      <span style={{ ...label, color: f.trend === 'declining' ? 'var(--coral)' : f.trend === 'improving' ? 'var(--lime)' : 'var(--mist)' }}>
        {TREND[f.trend]}
      </span>
      {f.volatile && <span style={{ ...label, color: '#E8C547' }}>غير مستقر</span>}
    </span>
  );
}

function StudentTable({ rows, emptyAr }) {
  if (rows.length === 0) return <span style={label}>{emptyAr}</span>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '620px' }}>
        <thead>
          <tr>
            <th style={th}>الطالب</th>
            <th style={th}>المستوى</th>
            <th style={th}>دقة التدريب</th>
            <th style={th}>توقّع المحاكي</th>
            <th style={th}>الوثبات</th>
            <th style={th}>آخر نشاط</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.ref} style={{ borderTop: '0.5px solid var(--on-indigo-line)' }}>
              <td style={td}>
                {/* A name only appears when the school is permitted AND the
                    student has not refused. Otherwise the alias, which is
                    stable so a teacher can track the same student week to
                    week without ever learning who they are. */}
                {s.name ?? <span style={{ fontFamily: 'var(--font-latin)' }} dir="ltr">{s.ref}</span>}
              </td>
              <td style={{ ...td, color: BAND[s.band].color }}>{BAND[s.band].text}</td>
              <td style={td}>{pct(s.accuracy)}</td>
              <td style={td}><ForecastCell f={s.forecast} /></td>
              <td style={td}>{s.completedLeaps}</td>
              <td style={td}>{fmtDate(s.lastActiveAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * SCH-006 — the school dashboard.
 *
 * Built around the two decisions a school actually makes with it: which
 * students need a support class, and roughly where the cohort will land. So
 * the attention lists come before the full roster, and the forecast floor is
 * given at least as much weight as the latest score — a school that plans for
 * its students' best days is planning for the wrong day.
 */
export default function Dashboard({ api, school, onLogout, schools, onSwitchSchool }) {
  const [tab, setTab] = useState('overview');
  const [overview, setOverview] = useState(null);
  const [areas, setAreas] = useState(null);
  const [attention, setAttention] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setError(null);
    const load = async () => {
      try {
        if (tab === 'overview' && !overview) {
          const d = await api.overview(school.schoolId);
          if (!cancelled) setOverview(d);
        }
        if (tab === 'areas' && !areas) {
          const d = await api.areas(school.schoolId);
          if (!cancelled) setAreas(d);
        }
        if (tab === 'attention' && !attention) {
          const d = await api.attention(school.schoolId);
          if (!cancelled) setAttention(d);
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setBusy(false);
      }
    };
    load();
    return () => { cancelled = true; };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [tab, school.schoolId]);

  // Switching school must not show the previous one's numbers.
  useEffect(() => { setOverview(null); setAreas(null); setAttention(null); }, [school.schoolId]);

  const suppressed = overview?.suppressed ?? areas?.suppressed ?? attention?.suppressed;
  // STU-036 — students who have sat their exam leave the cohort. Named, not
  // hidden: a roster that shrinks with no explanation reads as lost data.
  const finishedNote = overview?.finishedNoteAr;

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--indigo)' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px 24px', borderBottom: '0.5px solid var(--on-indigo-line)', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--font-arabic)', fontWeight: 600, fontSize: '17px', color: 'var(--sand)' }}>وثب · لوحة المدرسة</span>
        {schools.length > 1 ? (
          <select
            value={school.schoolId}
            onChange={(e) => onSwitchSchool(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--on-indigo-subtle)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}
          >
            {schools.map((s) => <option key={s.schoolId} value={s.schoolId}>{s.nameAr}</option>)}
          </select>
        ) : (
          <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>{school.nameAr}</span>
        )}
        <button
          onClick={onLogout}
          style={{ marginInlineStart: 'auto', border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}
        >
          خروج
        </button>
      </header>

      {finishedNote && (
        <div style={{ margin: '14px 24px 0', padding: '12px 16px', background: 'var(--on-indigo-subtle)', borderInlineStart: '3px solid var(--teal)', borderRadius: 'var(--radius-sm)' }}>
          <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)', lineHeight: 1.8 }}>{finishedNote}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: '6px', padding: '14px 24px 0', flexWrap: 'wrap' }}>
        {[['overview', 'نظرة عامة'], ['attention', 'من يحتاج دعمًا'], ['areas', 'المجالات']].map(([id, text]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
            style={{
              border: 'none', cursor: 'pointer', padding: '8px 16px', borderRadius: '999px',
              fontFamily: 'var(--font-arabic)', fontSize: '13px',
              background: tab === id ? 'var(--lime)' : 'var(--on-indigo-subtle)',
              color: tab === id ? 'var(--lime-ink)' : 'var(--sand)',
            }}
          >
            {text}
          </button>
        ))}
      </div>

      <main style={{ padding: '18px 24px 48px', maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && <p style={{ ...body, color: 'var(--coral)' }}>{error}</p>}
        {busy && <p style={label}>جارٍ التحميل…</p>}

        {/* The floor exists so a handful of students cannot be identified from
            their own averages. Said plainly rather than shown as an empty
            screen that reads as a broken dashboard. */}
        {suppressed && (
          <div style={{ ...card, background: 'color-mix(in srgb, var(--coral) 12%, transparent)' }}>
            <h2 style={h2}>النتائج التفصيلية غير متاحة بعد</h2>
            <p style={body}>
              {suppressed.messageAr ?? 'عدد الطلاب المسجّلين أقل من الحد الذي تظهر عنده النتائج.'}
            </p>
            <span style={label}>
              هذا الحد يحمي خصوصية الطلاب: مع عدد قليل، المتوسطات وحدها تكفي للتعرّف على أفرادهم.
            </span>
          </div>
        )}

        {tab === 'overview' && overview && !overview.suppressed && (
          <>
            <div style={card}>
              <h2 style={h2}>حالة الطلاب</h2>
              <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap' }}>
                <Stat text="الطلاب المسجّلون" value={overview.summary.students} />
                <Stat text="متوسط دقة التدريب" value={pct(overview.summary.meanAccuracy)} hint={`${overview.summary.measured} طالبًا لديهم بيانات كافية`} />
                <Stat text="الوسيط" value={pct(overview.summary.medianAccuracy)} />
              </div>
              <BandBar bands={overview.summary.bands} total={overview.summary.students} />
            </div>

            <div style={card}>
              <h2 style={h2}>توقّع نتائج المحاكي</h2>
              <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap' }}>
                <Stat text="آخر نتيجة (متوسط)" value={pct(overview.forecast.meanLikely)} hint={`${overview.forecast.forecasted} طالبًا أجروا المحاكي`} />
                {/* Given equal weight on purpose: this is the number to staff for. */}
                <Stat text="الحد الأدنى (متوسط)" value={pct(overview.forecast.meanLow)} hint="ما ينتجه الطلاب في يوم سيّئ" tone="#E8C547" />
                <Stat text="في تحسّن" value={overview.forecast.improving} tone="var(--lime)" />
                <Stat text="في تراجع" value={overview.forecast.declining} tone="var(--coral)" />
                <Stat text="أداء غير مستقر" value={overview.forecast.volatile} />
              </div>
              {overview.forecast.unforecasted > 0 && (
                <span style={label}>
                  {overview.forecast.unforecasted} طالبًا لم يجروا المحاكي بعد — لا يمكن تقدير نتائجهم.
                </span>
              )}
              <span style={{ ...label, lineHeight: 1.8 }}>{overview.forecastDisclaimerAr}</span>
            </div>

            <div style={card}>
              <h2 style={h2}>جميع الطلاب</h2>
              <span style={label}>مرتّبون بالحد الأدنى المتوقّع تصاعديًا.</span>
              <StudentTable rows={overview.students} emptyAr="لا يوجد طلاب مسجّلون من هذه المدرسة بعد." />
              <span style={{ ...label, lineHeight: 1.8 }}>{overview.disclaimerAr}</span>
            </div>
          </>
        )}

        {tab === 'attention' && attention && !attention.suppressed && (
          <>
            <div style={card}>
              <h2 style={h2}>يحتاجون حصص دعم</h2>
              <span style={label}>مستواهم في المادة أقل من المطلوب — الحل محتوى وتدريب إضافي.</span>
              <StudentTable rows={attention.struggling} emptyAr="لا يوجد طالب في هذه الفئة." />
            </div>

            <div style={card}>
              <h2 style={h2}>أداؤهم غير مستقر</h2>
              {/* The distinction that makes this dashboard worth having: these
                  students do not need more content. */}
              <span style={label}>
                الفارق بين أفضل وأسوأ محاولة كبير. غالبًا مسألة إدارة وقت وثبات تحت الضغط، لا نقص في المعرفة — التدريب على اختبار كامل أنفع لهم من حصة محتوى.
              </span>
              <StudentTable rows={attention.volatile} emptyAr="لا يوجد طالب في هذه الفئة." />
            </div>

            <div style={card}>
              <h2 style={h2}>لم يتدرّبوا بما يكفي</h2>
              <span style={label}>لا يمكن تقييمهم بعد — يحتاجون متابعة لبدء التدريب، لا حصة دعم.</span>
              <StudentTable rows={attention.inactive} emptyAr="جميع الطلاب لديهم تدريب كافٍ." />
            </div>
          </>
        )}

        {tab === 'areas' && areas && !areas.suppressed && (
          <div style={card}>
            <h2 style={h2}>المجالات الأضعف في المدرسة</h2>
            <span style={label}>مرتّبة من الأضعف. هذه هي المجالات التي تستحق حصص دعم جماعية.</span>
            {areas.areas.length === 0 ? (
              <span style={label}>لا توجد بيانات كافية في أي مجال بعد.</span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {areas.areas.map((a) => (
                  <div key={a.areaId} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span style={{ ...body, width: '170px', flexShrink: 0 }}>{a.areaNameAr}</span>
                    <div style={{ flex: 1, height: '10px', background: 'var(--indigo)', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{ width: `${a.accuracy}%`, height: '100%', background: a.accuracy < 50 ? 'var(--coral)' : a.accuracy < 65 ? '#E8C547' : 'var(--teal)' }} />
                    </div>
                    <span style={{ fontFamily: 'var(--font-latin)', fontSize: '13px', color: 'var(--sand)', width: '52px', textAlign: 'end' }}>{pct(a.accuracy)}</span>
                    <span style={{ ...label, width: '90px', textAlign: 'end' }}>{a.students} طالبًا</span>
                  </div>
                ))}
              </div>
            )}
            <span style={{ ...label, lineHeight: 1.8 }}>{areas.disclaimerAr}</span>
          </div>
        )}

        {/* Standing note, not a footnote: a school administrator should never
            be unclear about whether they are looking at named students. */}
        <div style={{ ...card, gap: '8px' }}>
          <span style={label}>الخصوصية</span>
          <p style={body}>
            {school.disclosure === 'full'
              ? 'أسماء الطلاب ظاهرة لك بموافقة إدارة وثب. الطلاب الذين اختاروا عدم مشاركة أسمائهم يظهرون برمز فقط.'
              : school.disclosure === 'consented'
                ? 'تظهر أسماء الطلاب الذين وافقوا على مشاركتها مع مدرستهم فقط. البقية يظهرون برمز ثابت.'
                : 'يظهر الطلاب برموز ثابتة دون أسماء. الرمز نفسه يبقى للطالب نفسه، فيمكنك متابعة تقدّمه دون معرفة هويته.'}
          </p>
          <span style={label}>لا تُعرض أرقام الجوال ولا بيانات التواصل في هذه اللوحة بأي حال.</span>
        </div>
      </main>
    </div>
  );
}
