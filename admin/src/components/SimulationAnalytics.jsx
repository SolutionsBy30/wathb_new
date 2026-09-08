import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { Button } from '../design-system/components/Button';
import { downloadCsv } from '../lib/csv';

const field = { padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--indigo)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '13px' };
const card = { background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' };
const label = { fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' };
const h2 = { margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '14px', color: 'var(--sand)' };
const th = { padding: '8px 10px', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)', textAlign: 'start' };
const td = { padding: '8px 10px', fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)' };

const STATUS = {
  not_started: 'لم تبدأ',
  in_progress: 'قيد التنفيذ',
  completed: 'مكتملة',
  expired: 'منتهية',
  abandoned: 'متروكة',
};

const fmt = (d) => (d ? new Date(d).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'short', timeStyle: 'short' }) : '—');

/** A histogram drawn as bars, so the shape of the distribution is visible at a glance. */
function Histogram({ buckets }) {
  const max = Math.max(...buckets.map((b) => b.count), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '90px' }}>
      {buckets.map((b) => (
        <div key={b.from} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <div
            title={`${b.from}–${b.to}٪ · ${b.count}`}
            style={{ width: '100%', height: `${(b.count / max) * 70}px`, minHeight: b.count ? '2px' : 0, background: 'var(--teal)', borderRadius: '2px 2px 0 0' }}
          />
          <span style={{ ...label, fontSize: '9px' }}>{b.from}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * SIM-022 — §7.4 aggregate analytics and the per-attempt inspector.
 *
 * Every cohort cut here comes off the snapshot columns stored on the attempt,
 * not a live join to enrolment, so a student changing school does not
 * retroactively rewrite last term's comparison.
 */
export default function SimulationAnalytics({ blueprint }) {
  const [tab, setTab] = useState('overview');
  const [filter, setFilter] = useState({ blueprintId: blueprint?.id ?? '', from: '', to: '', school: '', city: '' });
  const [overview, setOverview] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [items, setItems] = useState([]);
  const [gates, setGates] = useState(null);
  const [overrides, setOverrides] = useState([]);
  const [openAttempt, setOpenAttempt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { setFilter((f) => ({ ...f, blueprintId: blueprint?.id ?? '' })); }, [blueprint?.id]);

  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      if (tab === 'overview') setOverview(await api.simOverview(filter));
      if (tab === 'attempts') setAttempts(await api.simAttempts(filter));
      if (tab === 'items') setItems(await api.simItemStats(filter));
      if (tab === 'gates' && filter.blueprintId) setGates(await api.simGateDiagnostics(filter.blueprintId));
      if (tab === 'overrides' && filter.blueprintId) setOverrides(await api.simListOverrides(filter.blueprintId));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tab, filter.blueprintId]);

  const suspectCount = useMemo(() => items.filter((i) => i.suspect).length, [items]);

  if (openAttempt) {
    return <AttemptInspector attemptId={openAttempt} onBack={() => { setOpenAttempt(null); load(); }} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {[
          ['overview', 'نظرة عامة'],
          ['attempts', 'المحاولات'],
          ['items', 'إحصاءات الأسئلة'],
          ['gates', 'تشخيص الشروط'],
          ['overrides', 'الاستثناءات'],
        ].map(([id, text]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              border: 'none', cursor: 'pointer', padding: '7px 14px', borderRadius: '999px',
              fontFamily: 'var(--font-arabic)', fontSize: '12px',
              background: tab === id ? 'var(--lime)' : 'transparent',
              color: tab === id ? 'var(--lime-ink)' : 'var(--mist)',
              boxShadow: tab === id ? 'none' : 'inset 0 0 0 0.5px var(--on-indigo-line)',
            }}
          >
            {text}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <input type="date" style={field} value={filter.from} onChange={(e) => setFilter({ ...filter, from: e.target.value })} />
        <input type="date" style={field} value={filter.to} onChange={(e) => setFilter({ ...filter, to: e.target.value })} />
        <input style={field} placeholder="المدرسة" value={filter.school} onChange={(e) => setFilter({ ...filter, school: e.target.value })} />
        <input style={field} placeholder="المدينة" value={filter.city} onChange={(e) => setFilter({ ...filter, city: e.target.value })} />
        <Button variant="secondary" onClick={load} disabled={busy}>{busy ? '…' : 'تطبيق'}</Button>
      </div>

      {error && <p style={{ ...label, color: 'var(--coral)', margin: 0 }}>{error}</p>}

      {tab === 'overview' && overview && (
        <>
          <div style={card}>
            <h2 style={h2}>المحاولات</h2>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <Stat text="الإجمالي" value={overview.totalAttempts} />
              {Object.entries(overview.byStatus).map(([k, v]) => <Stat key={k} text={STATUS[k] ?? k} value={v} />)}
            </div>
          </div>

          <div style={card}>
            <h2 style={h2}>مسار الإكمال</h2>
            {/* §7.4 — the drop-off point distribution. "Completed N sections"
                is the honest unit: it is what a student actually finished. */}
            {overview.funnel.map((f) => (
              <div key={f.sectionsCompleted} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ ...label, width: '110px' }}>{f.sectionsCompleted} أقسام مكتملة</span>
                <div style={{ flex: 1, height: '8px', background: 'var(--indigo)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ width: `${overview.totalAttempts ? (f.attempts / overview.totalAttempts) * 100 : 0}%`, height: '100%', background: 'var(--teal)' }} />
                </div>
                <span style={{ ...label, width: '40px', textAlign: 'end' }}>{f.attempts}</span>
              </div>
            ))}
          </div>

          <div style={card}>
            <h2 style={h2}>توزيع الدرجات</h2>
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
              <Stat text="المتوسط" value={`${overview.meanAccuracy}٪`} />
              <Stat text="الوسيط" value={`${overview.medianAccuracy}٪`} />
              {overview.meanVerbal !== null && <Stat text="لفظي (متوسط)" value={`${overview.meanVerbal}٪`} />}
              {overview.meanQuant !== null && <Stat text="كمي (متوسط)" value={`${overview.meanQuant}٪`} />}
            </div>
            <Histogram buckets={overview.histogram} />
          </div>

          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h2 style={h2}>خريطة المجالات</h2>
              <button
                onClick={() => downloadCsv('simulation-areas.csv', overview.areas)}
                style={{ ...label, marginInlineStart: 'auto', border: 'none', background: 'transparent', color: 'var(--lime)', cursor: 'pointer' }}
              >
                تصدير CSV
              </button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>المجال</th>
                  <th style={th}>مرات العرض</th>
                  <th style={th}>الدقة</th>
                  <th style={th}>نسبة بدون إجابة</th>
                  <th style={th}>متوسط الزمن</th>
                </tr>
              </thead>
              <tbody>
                {overview.areas.map((a) => (
                  <tr key={a.areaId} style={{ borderTop: '0.5px solid var(--on-indigo-line)' }}>
                    <td style={td}>{a.areaNameAr}</td>
                    <td style={td}>{a.served}</td>
                    <td style={{ ...td, color: a.accuracy < 40 ? 'var(--coral)' : 'var(--sand)' }}>{a.accuracy}٪</td>
                    <td style={td}>{a.unansweredRate}٪</td>
                    <td style={td}>{Math.round(a.meanTimeMs / 1000)} ث</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'attempts' && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 style={h2}>المحاولات ({attempts.length})</h2>
            <button
              onClick={() => downloadCsv('simulation-attempts.csv', attempts)}
              style={{ ...label, marginInlineStart: 'auto', border: 'none', background: 'transparent', color: 'var(--lime)', cursor: 'pointer' }}
            >
              تصدير CSV
            </button>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>الطالب</th>
                <th style={th}>النموذج</th>
                <th style={th}>الحالة</th>
                <th style={th}>الدرجة</th>
                <th style={th}>المدرسة</th>
                <th style={th}>البدء</th>
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => (
                <tr key={a.id} style={{ borderTop: '0.5px solid var(--on-indigo-line)' }}>
                  <td style={td}>{a.studentName}</td>
                  <td style={td}>{a.formCode}{a.isStatic ? '' : ' · مخصص'}</td>
                  <td style={td}>{STATUS[a.status] ?? a.status}</td>
                  <td style={td}>{a.accuracy === null ? '—' : `${a.accuracy}٪`}</td>
                  <td style={td}>{a.school ?? '—'}</td>
                  <td style={td}>{fmt(a.startedAt)}</td>
                  <td style={td}>
                    <button onClick={() => setOpenAttempt(a.id)} style={{ ...label, border: 'none', background: 'transparent', color: 'var(--lime)', cursor: 'pointer' }}>
                      فحص
                    </button>
                  </td>
                </tr>
              ))}
              {attempts.length === 0 && <tr><td style={{ ...td, color: 'var(--mist)' }} colSpan={7}>لا توجد محاولات.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'items' && (
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h2 style={h2}>إحصاءات الأسئلة</h2>
            {suspectCount > 0 && (
              <span style={{ ...label, color: 'var(--coral)' }}>{suspectCount} سؤالًا يحتاج مراجعة</span>
            )}
            <button
              onClick={() => downloadCsv('simulation-items.csv', items.map(({ distractors, ...r }) => ({ ...r, distractors: JSON.stringify(distractors) })))}
              style={{ ...label, marginInlineStart: 'auto', border: 'none', background: 'transparent', color: 'var(--lime)', cursor: 'pointer' }}
            >
              تصدير CSV
            </button>
          </div>
          {/* Plain-language column names, matching the vocabulary already used
              on أداء الأسئلة: the audience is high-school students' teachers,
              not psychometricians. */}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>السؤال</th>
                <th style={th}>المجال</th>
                <th style={th}>عُرض</th>
                <th style={th}>نسبة الإجابة الصحيحة</th>
                <th style={th}>قدرة التمييز</th>
                <th style={th}>توزّع الاختيارات</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.questionId} style={{ borderTop: '0.5px solid var(--on-indigo-line)', background: i.suspect ? 'color-mix(in srgb, var(--coral) 10%, transparent)' : 'transparent' }}>
                  <td style={{ ...td, maxWidth: '280px' }}>{i.stem}{i.isScored ? '' : ' · تجريبي'}</td>
                  <td style={td}>{i.areaNameAr}</td>
                  <td style={td}>{i.served}</td>
                  <td style={td}>{Math.round(i.pValue * 100)}٪</td>
                  <td style={{ ...td, color: (i.discrimination ?? 0) < 0 ? 'var(--coral)' : 'var(--sand)' }}>
                    {i.discrimination === null ? '—' : i.discrimination.toFixed(2)}
                  </td>
                  <td style={{ ...td, fontFamily: 'var(--font-latin)', fontSize: '11px' }} dir="ltr">
                    {Object.entries(i.distractors).map(([k, v]) => `${k}:${v}${k === i.correctKey ? '✓' : ''}`).join('  ')}
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td style={{ ...td, color: 'var(--mist)' }} colSpan={6}>لا توجد بيانات كافية بعد.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'overrides' && (
        <OverridesPanel
          blueprintId={filter.blueprintId}
          overrides={overrides}
          onGranted={load}
        />
      )}

      {tab === 'gates' && (
        <div style={card}>
          <h2 style={h2}>تشخيص شروط الأهلية</h2>
          {!filter.blueprintId && <span style={label}>اختر مخططًا أولاً.</span>}
          {gates && (
            <>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <Stat text="طلاب الاختبار" value={gates.total} />
                <Stat text="مؤهلون الآن" value={gates.eligible} />
                <Stat text="محجوبون بشرط التدريب" value={gates.gateA} />
                <Stat text="في فترة التهدئة" value={gates.cooldown} />
                <Stat text="بلا تحديد مستوى" value={gates.noPlacement} />
              </div>
              {/* §12.3 — the threshold of 20 was a guess, and this is the
                  evidence for keeping or lowering it. */}
              <span style={label}>
                إذا كانت نسبة المحجوبين بشرط التدريب مرتفعة، فالحد الأدنى للوثبات أعلى مما يحتمله الطلاب حاليًا.
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ text, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span style={label}>{text}</span>
      <span style={{ fontFamily: 'var(--font-latin)', fontSize: '22px', fontWeight: 500, color: 'var(--sand)' }}>{value}</span>
    </div>
  );
}

/**
 * §7.4 — the per-attempt inspector: everything the supervisor sees, plus the
 * event timeline, answer changes, experimental performance and the two logged
 * actions.
 */
function AttemptInspector({ attemptId, onBack }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(null);

  const load = () => api.simAttemptReport(attemptId).then(setReport).catch((e) => setError(e.message));
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [attemptId]);

  const run = async (fn) => {
    if (!reason.trim()) return setError('اذكر السبب — كل إجراء هنا يُسجَّل.');
    setBusy(true);
    setError(null);
    try {
      await fn(reason.trim());
      setReason('');
      setConfirming(null);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (error && !report) return <p style={{ ...label, color: 'var(--coral)' }}>{error}</p>;
  if (!report) return <p style={label}>جارٍ التحميل…</p>;

  const a = report.admin ?? {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ ...label, border: 'none', background: 'transparent', color: 'var(--lime)', cursor: 'pointer' }}>← رجوع</button>
        <h2 style={h2}>{report.attempt.studentName} · {report.attempt.formCode}</h2>
        <span style={label}>{STATUS[report.attempt.status] ?? report.attempt.status}</span>
      </div>

      <div style={card}>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <Stat text="الدرجة" value={`${Math.round(report.totals.accuracy)}٪`} />
          <Stat text="الخام" value={`${report.totals.rawScore}/${report.totals.scoredCount}`} />
          {report.totals.scaledEstimate !== null && <Stat text="التقديرية" value={report.totals.scaledEstimate} />}
          <Stat text="الخروج من الشاشة" value={report.pacing?.screenExits ?? 0} />
        </div>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
          <span style={{ ...label, fontFamily: 'var(--font-latin)' }} dir="ltr">seed {a.seed?.slice(0, 8)}</span>
          <span style={label}>المدرسة (لحظة المحاولة): {a.schoolSnapshot ?? '—'}</span>
          <span style={label}>الاشتراك: {a.entitlementId ? a.entitlementId.slice(0, 8) : 'مُلغى/غير محتسب'}</span>
        </div>
      </div>

      {a.answerChanges?.length > 0 && (
        <div style={card}>
          <h2 style={h2}>تغيير الإجابات</h2>
          <span style={label}>
            {a.answerChanges.length} سؤالًا غيّر الطالب إجابته فيه — مؤشر على التخمين أو التردّد.
          </span>
        </div>
      )}

      {a.experimental?.length > 0 && (
        <div style={card}>
          <h2 style={h2}>الأسئلة التجريبية (غير محتسبة)</h2>
          {a.experimental.map((e) => (
            <span key={e.formItemId} style={label}>
              {e.areaNameAr} — {e.isCorrect === null ? 'بدون إجابة' : e.isCorrect ? 'صحيحة' : 'خاطئة'}
            </span>
          ))}
        </div>
      )}

      <div style={card}>
        <h2 style={h2}>سجل الأحداث</h2>
        <div style={{ maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {(a.events ?? []).map((e, i) => (
            <span key={i} style={{ ...label, fontFamily: 'var(--font-latin)' }} dir="ltr">
              {new Date(e.at).toISOString().slice(11, 19)} · {e.type}{e.detail ? ` · ${e.detail}` : ''}
            </span>
          ))}
        </div>
      </div>

      <div style={card}>
        <h2 style={h2}>إجراءات</h2>
        {/* §7.4 — every action is logged with actor, timestamp and reason, so
            the reason is required rather than optional. */}
        <input
          style={{ ...field, background: 'var(--indigo)' }}
          placeholder="السبب (مطلوب — يُسجَّل في سجل التدقيق)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {error && <span style={{ ...label, color: 'var(--coral)' }}>{error}</span>}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {!report.attempt.finalizedAt && (
            <Button variant="secondary" onClick={() => run((r) => api.simForceFinalize(attemptId, r))} disabled={busy}>
              إنهاء قسري
            </Button>
          )}
          {confirming !== 'void' ? (
            <Button variant="secondary" onClick={() => setConfirming('void')} disabled={busy}>إلغاء المحاولة وإعادة المحاولة للطالب</Button>
          ) : (
            <>
              <span style={{ ...label, color: 'var(--coral)' }}>
                ستُعاد المحاولة إلى رصيد الطالب. تبقى الإجابات محفوظة للإحصاءات، ولا تتغيّر فترة التهدئة.
              </span>
              <Button variant="secondary" onClick={() => setConfirming(null)}>تراجع</Button>
              <Button onClick={() => run((r) => api.simVoidAttempt(attemptId, r))} disabled={busy}>تأكيد الإلغاء</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * §5.6 — the admin exemption.
 *
 * Deliberately awkward: a student must be searched for by name, a reason is
 * required, and only one unused exemption may exist at a time. This is the
 * only route past the gates, there is no self-service version of it, and
 * buying a bigger package never produces one — so it should feel like a
 * decision rather than a button.
 */
function OverridesPanel({ blueprintId, overrides, onGranted }) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [chosen, setChosen] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const find = async () => {
    setError(null);
    try {
      setResults(await api.listStudents({ search }));
    } catch (e) {
      setError(e.message);
    }
  };

  const grant = async () => {
    if (!chosen || !reason.trim()) return setError('اختر الطالب واذكر السبب.');
    setBusy(true);
    setError(null);
    try {
      await api.simGrantOverride({ studentId: chosen.userId ?? chosen.id, blueprintId, reason: reason.trim() });
      setChosen(null);
      setReason('');
      setResults([]);
      setSearch('');
      await onGranted();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!blueprintId) {
    return <div style={card}><span style={label}>اختر مخططًا أولاً.</span></div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={card}>
        <h2 style={h2}>منح استثناء</h2>
        <span style={label}>
          يتخطّى شروط الأهلية مرة واحدة فقط، ويُستهلك عند بدء المحاولة. لا يُلغي احتساب المحاولة من رصيد الطالب.
        </span>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input
            style={{ ...field, minWidth: '200px' }}
            placeholder="ابحث باسم الطالب أو رقمه"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') find(); }}
          />
          <Button variant="secondary" onClick={find}>بحث</Button>
        </div>

        {results.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '180px', overflowY: 'auto' }}>
            {results.slice(0, 20).map((r) => {
              const id = r.userId ?? r.id;
              const active = (chosen?.userId ?? chosen?.id) === id;
              return (
                <button
                  key={id}
                  onClick={() => setChosen(r)}
                  style={{
                    border: 'none', cursor: 'pointer', textAlign: 'start', padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-arabic)', fontSize: '12px',
                    background: active ? 'var(--indigo)' : 'transparent',
                    color: active ? 'var(--sand)' : 'var(--mist)',
                  }}
                >
                  {r.name ?? r.user?.name ?? id}
                </button>
              );
            })}
          </div>
        )}

        {chosen && (
          <>
            <input
              style={field}
              placeholder="السبب (مطلوب — يُسجَّل مع اسمك في سجل التدقيق)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <Button onClick={grant} disabled={busy}>{busy ? 'جارٍ المنح…' : `منح استثناء لـ ${chosen.name ?? ''}`}</Button>
          </>
        )}
        {error && <span style={{ ...label, color: 'var(--coral)' }}>{error}</span>}
      </div>

      <div style={card}>
        <h2 style={h2}>الاستثناءات الممنوحة</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>الطالب</th>
              <th style={th}>السبب</th>
              <th style={th}>مُنح</th>
              <th style={th}>استُخدم</th>
            </tr>
          </thead>
          <tbody>
            {overrides.map((o) => (
              <tr key={o.id} style={{ borderTop: '0.5px solid var(--on-indigo-line)' }}>
                <td style={td}>{o.student?.user?.name ?? o.studentId}</td>
                <td style={td}>{o.reason}</td>
                <td style={td}>{fmt(o.grantedAt)}</td>
                <td style={{ ...td, color: o.usedAt ? 'var(--mist)' : 'var(--lime)' }}>{o.usedAt ? fmt(o.usedAt) : 'غير مستخدم'}</td>
              </tr>
            ))}
            {overrides.length === 0 && <tr><td style={{ ...td, color: 'var(--mist)' }} colSpan={4}>لا توجد استثناءات.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
