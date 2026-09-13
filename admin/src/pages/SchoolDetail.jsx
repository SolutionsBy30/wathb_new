import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { DISCLOSURE } from './Schools';
import SchoolAccess from './SchoolAccess';

const card = { background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' };
const label = { fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' };
const h3 = { margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '14px', fontWeight: 600, color: 'var(--sand)' };
const th = { textAlign: 'start', padding: '8px 10px', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)', whiteSpace: 'nowrap' };
const td = { padding: '8px 10px', fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)' };

const BAND = {
  strong: { text: 'متقدّم', color: 'var(--lime)' },
  on_track: { text: 'في المسار', color: 'var(--teal)' },
  needs_support: { text: 'يحتاج دعمًا', color: '#E8C547' },
  at_risk: { text: 'يحتاج تدخّلًا', color: 'var(--coral)' },
  insufficient: { text: 'بيانات غير كافية', color: 'var(--mist)' },
};

const pct = (n) => (n === null || n === undefined ? '—' : `${Math.round(n * 10) / 10}٪`);
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('ar-SA-u-nu-latn', { year: 'numeric', month: 'short', day: 'numeric' }) : '—');

function Stat({ text, value, hint, tone }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '105px' }}>
      <span style={label}>{text}</span>
      <span style={{ fontFamily: 'var(--font-latin)', fontSize: '24px', color: tone ?? 'var(--sand)', lineHeight: 1 }}>{value}</span>
      {hint && <span style={{ ...label, fontSize: '10px' }}>{hint}</span>}
    </div>
  );
}

/**
 * SCH-008 — everything about one school, on one screen.
 *
 * Three tabs matching the three questions asked about a school: how are its
 * students doing, who are they, and who at the school can see any of it.
 */
export default function SchoolDetail({ schoolId, onBack, onOpenStudent }) {
  const [tab, setTab] = useState('report');
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  const load = () => api.schoolReport(schoolId).then((d) => { setReport(d); setError(null); }).catch((e) => setError(e.message));
  useEffect(() => { setReport(null); load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [schoolId]);

  const school = report?.school;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <button
        onClick={onBack}
        style={{ alignSelf: 'flex-start', border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '13px', padding: 0 }}
      >
        ← كل المدارس
      </button>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '20px', fontWeight: 500, color: 'var(--sand)' }}>
          {school?.nameAr ?? 'جارٍ التحميل…'}
        </h1>
        {school && (
          <span style={label}>{school.cityNameAr}، {school.regionNameAr}</span>
        )}
        {school && (
          <span style={{ ...label, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <i style={{ width: '8px', height: '8px', borderRadius: '999px', background: DISCLOSURE[school.disclosure].color, display: 'inline-block' }} />
            {DISCLOSURE[school.disclosure].text}
          </span>
        )}
      </div>

      {error && <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--coral)' }}>{error}</span>}

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {[['report', 'التقرير'], ['students', 'الطلاب'], ['access', 'الصلاحيات والكشف']].map(([id, text]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              border: 'none', cursor: 'pointer', padding: '8px 14px', borderRadius: 'var(--radius-md)',
              fontFamily: 'var(--font-arabic)', fontSize: '13px',
              background: tab === id ? 'var(--on-indigo-subtle)' : 'transparent',
              color: tab === id ? 'var(--sand)' : 'var(--mist)',
            }}
          >
            {text}
          </button>
        ))}
      </div>

      {tab === 'report' && <ReportTab report={report} />}
      {tab === 'students' && <StudentsTab schoolId={schoolId} onOpenStudent={onOpenStudent} />}
      {tab === 'access' && (school
        ? <SchoolAccess schoolId={schoolId} schoolNameAr={school.nameAr} disclosure={school.disclosure} onChanged={load} />
        : <p style={label}>جارٍ التحميل…</p>
      )}
    </div>
  );
}

/**
 * The cohort picture, plus what the school is actually being shown.
 *
 * The second part matters more than it looks: nearly every support question
 * about this dashboard is "the school says they see nothing", and the answer
 * is almost always the cohort floor or the disclosure level rather than a bug.
 */
function ReportTab({ report }) {
  if (!report) return <p style={label}>جارٍ التحميل…</p>;

  const { summary, forecast, areas, attention, schoolSees } = report;
  const bandTotal = Object.values(summary.bands).reduce((a, b) => a + b, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={card}>
        <h3 style={h3}>الحالة العامة</h3>
        <div style={{ display: 'flex', gap: '26px', flexWrap: 'wrap' }}>
          <Stat text="طلاب مسجّلون" value={summary.students} />
          <Stat text="لديهم بيانات كافية" value={summary.measured} hint={`من ${summary.students}`} />
          <Stat text="متوسط الدقة" value={pct(summary.meanAccuracy)} />
          <Stat text="الوسيط" value={pct(summary.medianAccuracy)} />
        </div>
        {bandTotal > 0 && (
          <>
            <div style={{ display: 'flex', height: '12px', borderRadius: '999px', overflow: 'hidden', background: 'var(--indigo)' }}>
              {Object.entries(BAND).map(([k, v]) => summary.bands[k] > 0 && (
                <div key={k} title={`${v.text}: ${summary.bands[k]}`} style={{ width: `${(summary.bands[k] / bandTotal) * 100}%`, background: v.color }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              {Object.entries(BAND).map(([k, v]) => summary.bands[k] > 0 && (
                <span key={k} style={{ ...label, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <i style={{ width: '9px', height: '9px', borderRadius: '3px', background: v.color, display: 'inline-block' }} />
                  {v.text}: {summary.bands[k]}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      <div style={card}>
        <h3 style={h3}>التوقّع من المحاكي</h3>
        {forecast.students === 0 ? (
          <p style={{ margin: 0, ...label }}>لم يُجرِ أي طالب من هذه المدرسة اختبار محاكاة بعد، فلا توجد قاعدة للتوقّع.</p>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '26px', flexWrap: 'wrap' }}>
              <Stat text="لديهم توقّع" value={forecast.students} />
              <Stat text="متوسط المتوقّع" value={pct(forecast.meanLikely)} />
              <Stat text="متوسط الحد الأدنى" value={pct(forecast.meanLow)} tone="#E8C547" hint="أسوأ محاولة" />
              <Stat text="غير مستقرين" value={forecast.volatile} tone={forecast.volatile > 0 ? 'var(--coral)' : undefined} />
            </div>
            <p style={{ margin: 0, ...label, lineHeight: 1.9 }}>{report.forecastDisclaimerAr}</p>
          </>
        )}
      </div>

      <div style={card}>
        <h3 style={h3}>من يحتاج انتباهًا</h3>
        <div style={{ display: 'flex', gap: '26px', flexWrap: 'wrap' }}>
          <Stat text="يحتاجون دعمًا" value={attention.struggling} tone={attention.struggling > 0 ? '#E8C547' : undefined} />
          <Stat text="لم يتدرّبوا بما يكفي" value={attention.inactive} />
          <Stat text="أداؤهم غير مستقر" value={attention.volatile} />
          <Stat text="لم يجرّبوا المحاكي" value={attention.neverSimulated} />
        </div>
      </div>

      <div style={card}>
        <h3 style={h3}>المجالات — الأضعف أولًا</h3>
        {areas.length === 0 ? (
          <p style={{ margin: 0, ...label }}>لا مجال بلغ الحد الأدنى من الطلاب لعرضه.</p>
        ) : areas.map((a) => (
          <div key={a.areaId} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
              <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)' }}>
                {a.areaNameAr} <span style={{ color: 'var(--mist)' }}>· {a.sectionNameAr}</span>
              </span>
              <span style={{ fontFamily: 'var(--font-latin)', fontSize: '12px', color: 'var(--sand)' }}>{pct(a.accuracy)}</span>
            </div>
            <div style={{ height: '6px', borderRadius: '999px', background: 'var(--indigo)', overflow: 'hidden' }}>
              <div style={{ width: `${a.accuracy}%`, height: '100%', background: a.accuracy < 50 ? 'var(--coral)' : a.accuracy < 65 ? '#E8C547' : 'var(--teal)' }} />
            </div>
            <span style={{ ...label, fontSize: '10px' }}>{a.students} طالب · {a.answered} إجابة</span>
          </div>
        ))}
      </div>

      <div style={{ ...card, borderInlineStart: `3px solid ${schoolSees.reportable ? 'var(--teal)' : '#E8C547'}` }}>
        <h3 style={h3}>ما تراه المدرسة الآن</h3>
        <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)', lineHeight: 1.9 }}>
          {schoolSees.reportable
            ? `المدرسة ترى الأرقام التفصيلية (${summary.students} طالبًا، والحد ${schoolSees.minStudents}).`
            : `المدرسة لا ترى أي أرقام تفصيلية: المسجّلون ${summary.students} والحد الأدنى ${schoolSees.minStudents} طالبًا. هذا ليس عطلًا.`}
        </p>
        <div style={{ display: 'flex', gap: '26px', flexWrap: 'wrap' }}>
          <Stat text="أسماء ظاهرة للمدرسة" value={schoolSees.namesVisible} hint={`من ${summary.students}`} />
          <Stat text="وافقوا على المشاركة" value={schoolSees.consented} />
          <Stat text="انسحبوا صراحةً" value={schoolSees.optedOut} tone={schoolSees.optedOut > 0 ? 'var(--coral)' : undefined} />
        </div>
        <p style={{ margin: 0, ...label, lineHeight: 1.9 }}>
          انسحاب الطالب يتقدّم على مستوى الكشف مهما كان، فقد يبقى اسمه مخفيًا حتى مع «كشف كامل».
          الأرقام أعلاه هي الحقيقة الكاملة كما تراها الإدارة، وليست النسخة التي تراها المدرسة.
        </p>
      </div>
    </div>
  );
}

/**
 * The roster, from the existing admin students endpoint.
 *
 * That endpoint is gated by the 'students' permission, not 'geography', and
 * deliberately so: this tab shows real names and mobile numbers. An admin who
 * can manage the school registry does not thereby get every student's contact
 * details, so a 403 here is the system working and says so plainly.
 */
function StudentsTab({ schoolId, onOpenStudent }) {
  const [items, setItems] = useState(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.listStudents({ schoolId })
      .then((r) => { if (!cancelled) { setItems(r.items); setTotal(r.total); setError(null); } })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [schoolId]);

  if (error) {
    return (
      <div style={card}>
        <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--coral)', lineHeight: 1.9 }}>
          تعذّر عرض الطلاب: {error}
        </p>
        <p style={{ margin: 0, ...label, lineHeight: 1.9 }}>
          قائمة الطلاب تتطلّب صلاحية «الطلاب» لأنها تعرض الأسماء وأرقام الجوال. صلاحية «الجغرافيا والمدارس» وحدها تكفي للتقرير والصلاحيات فقط.
        </p>
      </div>
    );
  }
  if (!items) return <p style={label}>جارٍ التحميل…</p>;

  return (
    <div style={{ ...card, padding: '4px 8px' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>الاسم</th>
              <th style={th}>الجوال</th>
              <th style={th}>الأسئلة المكتملة</th>
              <th style={th}>السلسلة</th>
              <th style={th}>المستوى العام</th>
              <th style={th}>نهاية الاشتراك</th>
              <th style={th}>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.userId} style={{ borderTop: '0.5px solid var(--on-indigo-line)' }}>
                <td style={{ ...td, cursor: 'pointer', color: 'var(--lime-print)' }} onClick={() => onOpenStudent(s.userId)}>{s.user.name}</td>
                <td style={{ ...td, fontFamily: 'var(--font-latin)', color: 'var(--mist)', direction: 'ltr', textAlign: 'start' }}>{s.user.mobileE164}</td>
                <td style={{ ...td, fontFamily: 'var(--font-latin)' }}>{s._count?.answers ?? '—'}</td>
                <td style={{ ...td, fontFamily: 'var(--font-latin)', color: 'var(--lime)' }}>{s.currentStreak}</td>
                <td style={{ ...td, fontFamily: 'var(--font-latin)' }}>{s.compositeIndex ?? <span style={{ fontFamily: 'var(--font-arabic)', color: 'var(--mist)' }}>قيد الجمع</span>}</td>
                <td style={{ ...td, fontFamily: 'var(--font-latin)', color: 'var(--mist)' }}>{fmtDate(s.subscriptionEnd)}</td>
                <td style={{ ...td, color: s.user.status === 'suspended' ? 'var(--coral)' : 'var(--teal-ink)' }}>
                  {s.user.status === 'suspended' ? 'معلّق' : 'نشط'}
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td style={{ ...td, color: 'var(--mist)' }} colSpan={7}>لا طلاب مرتبطين بهذه المدرسة.</td></tr>}
          </tbody>
        </table>
      </div>
      {items.length > 0 && <span style={{ ...label, padding: '0 10px 10px' }}>{total} طالب</span>}
    </div>
  );
}
