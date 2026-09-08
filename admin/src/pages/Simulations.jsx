import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Button } from '../design-system/components/Button';
import SimulationAnalytics from '../components/SimulationAnalytics';

const field = { padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--indigo)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '13px' };
const card = { background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' };
const label = { fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' };
const h2 = { margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '14px', color: 'var(--sand)' };
const th = { padding: '8px 10px', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)', textAlign: 'start' };
const td = { padding: '8px 10px', fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)' };

const PARTS = { verbal: 'لفظي', quantitative: 'كمي', mixed: 'مختلط' };
const STATUS = { draft: 'مسودة', published: 'منشور', archived: 'مؤرشف' };
const STATUS_COLOR = { draft: 'var(--mist)', published: 'var(--lime)', archived: 'var(--mist)' };

const mins = (s) => `${Math.round(s / 60)} دقيقة`;

function Labelled({ text, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span style={label}>{text}</span>
      {children}
    </div>
  );
}

/**
 * The blueprint's own settings — everything in §2.1 except the sections.
 *
 * Gates sit in the same form rather than a separate screen: they are what
 * decides whether a student can open the thing at all, and hiding them behind
 * another click is how a blueprint ends up published with defaults nobody
 * looked at.
 */
function BlueprintForm({ tests, initial, onSubmit, onCancel }) {
  const [v, setV] = useState(() => ({
    testId: initial?.testId ?? tests[0]?.id ?? '',
    nameAr: initial?.nameAr ?? '',
    nameEn: initial?.nameEn ?? '',
    mode: initial?.mode ?? 'computerized',
    totalQuestions: initial?.totalQuestions ?? 96,
    sectionCount: initial?.sectionCount ?? 4,
    sectionDurationS: initial?.sectionDurationS ?? 1500,
    breakBetweenSections: initial?.breakBetweenSections ?? false,
    breakDurationS: initial?.breakDurationS ?? 0,
    navigationPolicy: initial?.navigationPolicy ?? 'free_within_section',
    allowFlagReview: initial?.allowFlagReview ?? true,
    calculatorAllowed: initial?.calculatorAllowed ?? false,
    scratchpad: initial?.scratchpad ?? 'digital',
    difficultyOrdering: initial?.difficultyOrdering ?? 'ascending',
    experimentalCount: initial?.experimentalCount ?? 4,
    minCompletedLeaps: initial?.minCompletedLeaps ?? 20,
    minAnsweredQuestions: initial?.minAnsweredQuestions ?? 100,
    minCoverageAreas: initial?.minCoverageAreas ?? false,
    minDaysBetweenAttempts: initial?.minDaysBetweenAttempts ?? 7,
    minLeapsBetweenAttempts: initial?.minLeapsBetweenAttempts ?? 7,
    requirePlacement: initial?.requirePlacement ?? true,
  }));
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => {
    const el = e.target;
    setV((s) => ({ ...s, [k]: el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value }));
  };

  const submit = async () => {
    setError(null);
    if (!v.testId) return setError('اختر الاختبار.');
    if (!v.nameAr.trim() || !v.nameEn.trim()) return setError('أدخل اسم المخطط بالعربية والإنجليزية.');
    setBusy(true);
    try {
      await onSubmit(v);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const num = (k, text, extra = {}) => (
    <Labelled text={text}>
      <input type="number" style={{ ...field, width: '110px' }} value={v[k]} onChange={set(k)} {...extra} />
    </Labelled>
  );
  const check = (k, text) => (
    <label style={{ ...label, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
      <input type="checkbox" checked={v[k]} onChange={set(k)} />
      {text}
    </label>
  );

  return (
    <div style={{ ...card, maxWidth: '760px' }}>
      <h2 style={h2}>{initial ? `تعديل: ${initial.nameAr}` : 'مخطط محاكٍ جديد'}</h2>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <Labelled text="الاختبار">
          <select style={{ ...field, minWidth: '160px' }} value={v.testId} onChange={set('testId')} disabled={!!initial}>
            {tests.map((t) => <option key={t.id} value={t.id}>{t.nameAr}</option>)}
          </select>
        </Labelled>
        <Labelled text="الاسم بالعربية">
          <input style={{ ...field, minWidth: '180px' }} value={v.nameAr} onChange={set('nameAr')} placeholder="القدرات — محوسب" />
        </Labelled>
        <Labelled text="Name (EN)">
          <input style={{ ...field, minWidth: '180px', fontFamily: 'var(--font-latin)' }} dir="ltr" value={v.nameEn} onChange={set('nameEn')} placeholder="GAT — computerized" />
        </Labelled>
        <Labelled text="النمط">
          <select style={{ ...field, minWidth: '120px' }} value={v.mode} onChange={set('mode')}>
            <option value="computerized">محوسب</option>
            <option value="paper">ورقي</option>
          </select>
        </Labelled>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {num('totalQuestions', 'إجمالي الأسئلة', { min: 1 })}
        {num('sectionCount', 'عدد الأقسام', { min: 1 })}
        {num('sectionDurationS', 'مدة القسم (ثانية)', { min: 30 })}
        {num('experimentalCount', 'أسئلة تجريبية', { min: 0 })}
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Labelled text="التنقل">
          <select style={{ ...field, minWidth: '170px' }} value={v.navigationPolicy} onChange={set('navigationPolicy')}>
            <option value="free_within_section">حر داخل القسم</option>
            <option value="linear_only">تسلسلي فقط</option>
          </select>
        </Labelled>
        <Labelled text="ترتيب الصعوبة">
          <select style={{ ...field, minWidth: '140px' }} value={v.difficultyOrdering} onChange={set('difficultyOrdering')}>
            <option value="ascending">من الأسهل إلى الأصعب</option>
            <option value="none">بلا ترتيب</option>
          </select>
        </Labelled>
        <Labelled text="لوحة المسودة">
          <select style={{ ...field, minWidth: '120px' }} value={v.scratchpad} onChange={set('scratchpad')}>
            <option value="digital">رقمية</option>
            <option value="none">بدون</option>
          </select>
        </Labelled>
        {v.breakBetweenSections && num('breakDurationS', 'مدة الاستراحة (ثانية)', { min: 0 })}
      </div>

      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {check('allowFlagReview', 'تمييز للمراجعة')}
        {check('calculatorAllowed', 'السماح بالآلة الحاسبة')}
        {check('breakBetweenSections', 'استراحة بين الأقسام')}
      </div>

      <div style={{ height: '0.5px', background: 'var(--on-indigo-line)' }} />

      {/* §5.6 — the two gates. Both are enforced server-side at start; these
          numbers are the only place they are configured. */}
      <span style={{ ...label, color: 'var(--sand)' }}>شروط الأهلية</span>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {num('minCompletedLeaps', 'وثبات مكتملة', { min: 0 })}
        {num('minAnsweredQuestions', 'أسئلة مُجابة', { min: 0 })}
        {num('minDaysBetweenAttempts', 'أيام بين المحاولات', { min: 0 })}
        {num('minLeapsBetweenAttempts', 'وثبات بين المحاولات', { min: 0 })}
      </div>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {check('requirePlacement', 'يشترط وثبة تحديد المستوى')}
        {check('minCoverageAreas', 'يشترط تغطية كل المجالات')}
      </div>

      {error && <span style={{ ...label, color: 'var(--coral)' }}>{error}</span>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <Button onClick={submit} disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'حفظ'}</Button>
        <Button variant="ghost" onClick={onCancel}>إلغاء</Button>
      </div>
    </div>
  );
}

/**
 * Section templates and their area quotas.
 *
 * Edited as one unit and saved as one unit, because the whole thing is a set
 * of sums that have to balance: a quota is only correct relative to its
 * section's question count, and a section only relative to the blueprint
 * total. The running totals are shown beside every input so the admin sees
 * the imbalance while typing rather than in a validation error afterwards.
 */
function SectionsEditor({ blueprint, areas, onSave }) {
  const [sections, setSections] = useState(() =>
    blueprint.sections.map((s) => ({
      orderIndex: s.orderIndex,
      part: s.part,
      questionCount: s.questionCount,
      durationS: s.durationS,
      experimentalSlots: s.experimentalSlots ?? [],
      quotas: s.quotas.map((q) => ({ areaId: q.areaId, count: q.count, difficultyCurve: q.difficultyCurve })),
    })),
  );
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const patch = (i, changes) => setSections((ss) => ss.map((s, j) => (j === i ? { ...s, ...changes } : s)));

  const addSection = () =>
    setSections((ss) => [
      ...ss,
      { orderIndex: ss.length, part: ss.length % 2 === 0 ? 'verbal' : 'quantitative', questionCount: 24, durationS: blueprint.sectionDurationS, experimentalSlots: [], quotas: [] },
    ]);

  const removeSection = (i) =>
    setSections((ss) => ss.filter((_, j) => j !== i).map((s, j) => ({ ...s, orderIndex: j })));

  const addQuota = (i) => {
    const used = new Set(sections[i].quotas.map((q) => q.areaId));
    const next = areas.find((a) => !used.has(a.id));
    if (!next) return;
    patch(i, { quotas: [...sections[i].quotas, { areaId: next.id, count: 1, difficultyCurve: 'ascending' }] });
  };

  const patchQuota = (i, qi, changes) =>
    patch(i, { quotas: sections[i].quotas.map((q, j) => (j === qi ? { ...q, ...changes } : q)) });

  const removeQuota = (i, qi) => patch(i, { quotas: sections[i].quotas.filter((_, j) => j !== qi) });

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      await onSave(sections);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const grandTotal = sections.reduce((n, s) => n + s.questionCount, 0);
  const experimentalTotal = sections.reduce((n, s) => n + new Set(s.experimentalSlots).size, 0);

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <h2 style={h2}>الأقسام والحصص</h2>
        <span style={{ ...label, color: grandTotal === blueprint.totalQuestions ? 'var(--mist)' : 'var(--coral)' }}>
          المجموع {grandTotal} / {blueprint.totalQuestions}
        </span>
        <span style={{ ...label, color: experimentalTotal === blueprint.experimentalCount ? 'var(--mist)' : 'var(--coral)' }}>
          تجريبية {experimentalTotal} / {blueprint.experimentalCount}
        </span>
      </div>

      {sections.map((s, i) => {
        const quotaSum = s.quotas.reduce((n, q) => n + q.count, 0);
        const balanced = quotaSum === s.questionCount;
        return (
          <div key={i} style={{ background: 'var(--indigo)', borderRadius: 'var(--radius-sm)', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <span style={{ ...label, color: 'var(--sand)', alignSelf: 'center' }}>القسم {i + 1}</span>
              <Labelled text="النوع">
                <select style={{ ...field, background: 'var(--on-indigo-subtle)', minWidth: '110px' }} value={s.part} onChange={(e) => patch(i, { part: e.target.value })}>
                  {Object.entries(PARTS).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
                </select>
              </Labelled>
              <Labelled text="عدد الأسئلة">
                <input type="number" min="1" style={{ ...field, background: 'var(--on-indigo-subtle)', width: '90px' }} value={s.questionCount} onChange={(e) => patch(i, { questionCount: Number(e.target.value) })} />
              </Labelled>
              <Labelled text="المدة (ثانية)">
                <input type="number" min="30" style={{ ...field, background: 'var(--on-indigo-subtle)', width: '100px' }} value={s.durationS} onChange={(e) => patch(i, { durationS: Number(e.target.value) })} />
              </Labelled>
              <Labelled text="مواضع التجريبية">
                <input
                  style={{ ...field, background: 'var(--on-indigo-subtle)', width: '130px', fontFamily: 'var(--font-latin)' }}
                  dir="ltr"
                  placeholder="0, 12, 23"
                  value={s.experimentalSlots.join(', ')}
                  // Free text rather than a picker: the positions are a short
                  // list of numbers and typing "23" beats 24 checkboxes.
                  onChange={(e) => patch(i, {
                    experimentalSlots: e.target.value.split(',').map((x) => Number(x.trim())).filter((n) => Number.isInteger(n)),
                  })}
                />
              </Labelled>
              <button onClick={() => removeSection(i)} style={{ ...label, border: 'none', background: 'transparent', color: 'var(--coral)', cursor: 'pointer', alignSelf: 'center' }}>
                حذف القسم
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {s.quotas.map((q, qi) => (
                <div key={qi} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    style={{ ...field, background: 'var(--on-indigo-subtle)', minWidth: '190px' }}
                    value={q.areaId}
                    onChange={(e) => patchQuota(i, qi, { areaId: e.target.value })}
                  >
                    {areas.map((a) => <option key={a.id} value={a.id}>{a.sectionName} ← {a.nameAr}</option>)}
                  </select>
                  <input
                    type="number"
                    min="1"
                    style={{ ...field, background: 'var(--on-indigo-subtle)', width: '80px' }}
                    value={q.count}
                    onChange={(e) => patchQuota(i, qi, { count: Number(e.target.value) })}
                  />
                  <select
                    style={{ ...field, background: 'var(--on-indigo-subtle)', minWidth: '150px' }}
                    value={q.difficultyCurve}
                    onChange={(e) => patchQuota(i, qi, { difficultyCurve: e.target.value })}
                  >
                    <option value="ascending">تدرّج بالصعوبة</option>
                    <option value="none">بلا تدرّج</option>
                  </select>
                  <button onClick={() => removeQuota(i, qi)} style={{ ...label, border: 'none', background: 'transparent', color: 'var(--coral)', cursor: 'pointer' }}>
                    إزالة
                  </button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button onClick={() => addQuota(i)} style={{ ...label, border: 'none', background: 'transparent', color: 'var(--lime)', cursor: 'pointer' }}>
                  + مجال
                </button>
                <span style={{ ...label, color: balanced ? 'var(--mist)' : 'var(--coral)' }}>
                  مجموع الحصص {quotaSum} / {s.questionCount}
                </span>
              </div>
            </div>
          </div>
        );
      })}

      {error && <span style={{ ...label, color: 'var(--coral)' }}>{error}</span>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <Button onClick={save} disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'حفظ الأقسام'}</Button>
        <Button variant="secondary" onClick={addSection}>+ قسم</Button>
      </div>
    </div>
  );
}

/**
 * §9 bank readiness.
 *
 * Shows every area, not only the failing ones: an area that clears its quota
 * by two questions is not "ready", it is one retirement away from blocking
 * the next form, and the admin should see that before it happens.
 */
function Readiness({ data, onRefresh, busy }) {
  if (!data) return null;
  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <h2 style={h2}>جاهزية بنك الأسئلة</h2>
        {/* Deliberately not "the bank is ready": this counts items per area
            and does not know that a passage block moves as a unit, so it is a
            necessary condition, not a sufficient one. Generation is the real
            test, and it reports the exact shortfall when it fails. */}
        <span style={{ ...label, color: data.ready ? 'var(--lime)' : 'var(--coral)' }}>
          {data.ready ? 'الأعداد كافية في كل مجال' : 'نقص في أحد المجالات'}
        </span>
        <span style={label}>المتاح إجمالًا: {data.poolSize}</span>
        {data.avoidReuse && <span style={label}>(باستثناء أسئلة النماذج المنشورة)</span>}
        <button onClick={onRefresh} disabled={busy} style={{ ...label, marginInlineStart: 'auto', border: 'none', background: 'transparent', color: 'var(--lime)', cursor: 'pointer' }}>
          {busy ? '…' : 'تحديث'}
        </button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>المجال</th>
            <th style={th}>مطلوب</th>
            <th style={th}>متوفر</th>
            <th style={th}>الفائض</th>
            <th style={th}>توزّع الصعوبة (١ سهل ← ٥ صعب)</th>
          </tr>
        </thead>
        <tbody>
          {data.areas.map((a) => {
            const slack = a.available - a.required;
            return (
              <tr key={a.areaId} style={{ borderTop: '0.5px solid var(--on-indigo-line)' }}>
                <td style={td}>{a.areaNameAr}</td>
                <td style={td}>{a.required}</td>
                <td style={td}>{a.available}</td>
                <td style={{ ...td, color: slack < 0 ? 'var(--coral)' : slack < 5 ? 'var(--sand)' : 'var(--mist)' }}>
                  {slack >= 0 ? `+${slack}` : slack}
                </td>
                <td style={{ ...td, fontFamily: 'var(--font-latin)' }} dir="ltr">
                  {[1, 2, 3, 4, 5].map((b) => `${b}:${a.difficultySpread[b] ?? 0}`).join('  ')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** The generated form, section by section, with the experimental slots marked. */
function FormPreview({ form, onBack, onRegenerate, onStatus, busy }) {
  const sections = [...new Set(form.items.map((i) => i.sectionIndex))].sort((a, b) => a - b);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ ...label, border: 'none', background: 'transparent', color: 'var(--lime)', cursor: 'pointer' }}>← رجوع</button>
        <h2 style={h2}>{form.code}</h2>
        <span style={{ ...label, color: STATUS_COLOR[form.status] }}>{STATUS[form.status]}</span>
        <span style={label}>{form.items.length} سؤالًا</span>
        <span style={label}>{form._count.attempts} محاولة</span>
        <span style={{ ...label, fontFamily: 'var(--font-latin)' }} dir="ltr">seed {form.seed.slice(0, 8)}</span>
        <div style={{ marginInlineStart: 'auto', display: 'flex', gap: '8px' }}>
          {form.status === 'draft' && <Button onClick={() => onStatus('published')} disabled={busy}>نشر النموذج</Button>}
          {form.status === 'published' && form._count.attempts === 0 && (
            <Button variant="secondary" onClick={() => onStatus('draft')} disabled={busy}>سحب إلى مسودة</Button>
          )}
        </div>
      </div>

      {sections.map((si) => {
        const items = form.items.filter((i) => i.sectionIndex === si);
        return (
          <div key={si} style={card}>
            <h2 style={h2}>القسم {si + 1} — {items.length} سؤالًا</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>#</th>
                  <th style={th}>المجال / التصنيف</th>
                  <th style={th}>الصعوبة</th>
                  <th style={th}>نص السؤال</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} style={{ borderTop: '0.5px solid var(--on-indigo-line)', opacity: i.isScored ? 1 : 0.6 }}>
                    <td style={td}>
                      {i.position + 1}
                      {/* §7.1 — experimental items are excluded from every
                          score surface, so they are marked wherever a human
                          reads the form. */}
                      {!i.isScored && <span style={{ ...label, color: 'var(--lime)' }}> تجريبي</span>}
                    </td>
                    <td style={td}>{i.question.label.area.nameAr} ← {i.question.label.nameAr}</td>
                    <td style={td}>{i.question.difficulty}</td>
                    <td style={{ ...td, maxWidth: '380px' }}>
                      {i.questionVersion.stem.slice(0, 90)}{i.questionVersion.stem.length > 90 ? '…' : ''}
                      {i.question.passageId && <span style={{ ...label, color: 'var(--mist)' }}> · قطعة</span>}
                    </td>
                    <td style={td}>
                      {form.status === 'draft' && !i.question.passageId && (
                        <button onClick={() => onRegenerate(i.id)} disabled={busy} style={{ ...label, border: 'none', background: 'transparent', color: 'var(--lime)', cursor: 'pointer' }}>
                          استبدال
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

/**
 * SIM-006 — المحاكي admin console (§9).
 *
 * Three things live here and they are ordered by how often they are touched:
 * the blueprint (rarely, and never once published), bank readiness (before
 * every generation), and the forms themselves (repeatedly).
 */
export default function Simulations({ tests }) {
  const [view, setView] = useState('blueprints');
  const [blueprints, setBlueprints] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [blueprint, setBlueprint] = useState(null);
  const [areas, setAreas] = useState([]);
  const [issues, setIssues] = useState([]);
  const [readiness, setReadiness] = useState(null);
  const [forms, setForms] = useState([]);
  const [openForm, setOpenForm] = useState(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const refreshList = () => api.listBlueprints().then(setBlueprints).catch((e) => setError(e.message));
  useEffect(() => { refreshList(); }, []);

  // Loading a blueprint pulls everything the screen shows about it in one
  // place, so a save anywhere can just call this again.
  const loadBlueprint = async (id) => {
    setError(null);
    try {
      const bp = await api.getBlueprint(id);
      setBlueprint(bp);
      const tree = await api.tree(bp.testId);
      setAreas((tree.sections ?? []).flatMap((s) => (s.areas ?? []).map((a) => ({ ...a, sectionName: s.nameAr }))));
      setIssues(await api.validateBlueprint(id));
      setForms(await api.listSimulationForms(id));
      // Readiness is a bank-wide scan; it is refreshed on demand rather than
      // on every render.
      setReadiness(await api.blueprintReadiness(id));
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => {
    if (!selectedId) { setBlueprint(null); return; }
    loadBlueprint(selectedId);
  }, [selectedId]);

  const act = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (openForm) {
    return (
      <>
        {error && <p style={{ ...label, color: 'var(--coral)' }}>{error}</p>}
        <FormPreview
          form={openForm}
          busy={busy}
          onBack={() => { setOpenForm(null); loadBlueprint(selectedId); }}
          onRegenerate={(itemId) => act(async () => {
            await api.regenerateFormItem(itemId);
            setOpenForm(await api.getSimulationForm(openForm.id));
          })}
          onStatus={(status) => act(async () => {
            await api.setSimulationFormStatus(openForm.id, status);
            setOpenForm(await api.getSimulationForm(openForm.id));
          })}
        />
      </>
    );
  }

  if (creating) {
    return (
      <BlueprintForm
        tests={tests}
        onCancel={() => setCreating(false)}
        onSubmit={async (dto) => {
          const bp = await api.createBlueprint(dto);
          setCreating(false);
          await refreshList();
          setSelectedId(bp.id);
        }}
      />
    );
  }

  if (editing && blueprint) {
    return (
      <BlueprintForm
        tests={tests}
        initial={blueprint}
        onCancel={() => setEditing(false)}
        onSubmit={async (dto) => {
          await api.updateBlueprint(blueprint.id, dto);
          setEditing(false);
          await refreshList();
          await loadBlueprint(blueprint.id);
        }}
      />
    );
  }

  if (view === 'analytics') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <h2 style={h2}>المحاكي — التحليلات</h2>
          <span style={label}>{blueprint ? blueprint.nameAr : 'كل المخططات'}</span>
          <div style={{ marginInlineStart: 'auto' }}>
            <Button variant="secondary" onClick={() => setView('blueprints')}>المخططات</Button>
          </div>
        </div>
        <SimulationAnalytics blueprint={blueprint} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <h2 style={h2}>المحاكي — المخططات</h2>
        <div style={{ marginInlineStart: 'auto', display: 'flex', gap: '8px' }}>
          <Button variant="secondary" onClick={() => setView('analytics')}>التحليلات</Button>
          <Button onClick={() => setCreating(true)}>مخطط جديد</Button>
        </div>
      </div>

      {error && <p style={{ ...label, color: 'var(--coral)', margin: 0 }}>{error}</p>}

      <div style={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>المخطط</th>
              <th style={th}>الاختبار</th>
              <th style={th}>الشكل</th>
              <th style={th}>الحالة</th>
              <th style={th}>النماذج</th>
              <th style={th}>المحاولات</th>
            </tr>
          </thead>
          <tbody>
            {blueprints.map((b) => (
              <tr
                key={b.id}
                onClick={() => setSelectedId(b.id)}
                style={{ borderTop: '0.5px solid var(--on-indigo-line)', cursor: 'pointer', background: b.id === selectedId ? 'var(--indigo)' : 'transparent' }}
              >
                <td style={td}>{b.nameAr}</td>
                <td style={td}>{b.test.nameAr}</td>
                <td style={td}>{b.sectionCount} × {mins(b.sectionDurationS)} — {b.totalQuestions} سؤالًا</td>
                <td style={{ ...td, color: STATUS_COLOR[b.status] }}>{STATUS[b.status]}</td>
                <td style={td}>{b._count.forms}</td>
                <td style={td}>{b._count.attempts}</td>
              </tr>
            ))}
            {blueprints.length === 0 && (
              <tr><td style={{ ...td, color: 'var(--mist)' }} colSpan={6}>لا توجد مخططات بعد.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {blueprint && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 style={h2}>{blueprint.nameAr}</h2>
            <span style={{ ...label, color: STATUS_COLOR[blueprint.status] }}>{STATUS[blueprint.status]}</span>
            <div style={{ marginInlineStart: 'auto', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {blueprint.status === 'draft' && <Button variant="secondary" onClick={() => setEditing(true)}>تعديل الإعدادات</Button>}
              <Button variant="secondary" onClick={() => act(async () => { const c = await api.cloneBlueprint(blueprint.id); await refreshList(); setSelectedId(c.id); })} disabled={busy}>
                نسخ
              </Button>
              {blueprint.status === 'draft' && (
                <Button onClick={() => act(async () => { await api.setBlueprintStatus(blueprint.id, 'published'); await refreshList(); await loadBlueprint(blueprint.id); })} disabled={busy || issues.length > 0}>
                  نشر المخطط
                </Button>
              )}
              {blueprint.status === 'published' && (
                <Button variant="secondary" onClick={() => act(async () => { await api.setBlueprintStatus(blueprint.id, 'archived'); await refreshList(); await loadBlueprint(blueprint.id); })} disabled={busy}>
                  أرشفة
                </Button>
              )}
            </div>
          </div>

          {/* §9 — the arithmetic check, shown before anything can be published. */}
          {issues.length > 0 && (
            <div style={{ ...card, background: 'color-mix(in srgb, var(--coral) 12%, transparent)', gap: '6px' }}>
              <span style={{ ...label, color: 'var(--coral)' }}>المخطط غير صالح للنشر:</span>
              {issues.map((i, n) => <span key={n} style={{ ...label, color: 'var(--sand)' }}>• {i.messageAr}</span>)}
            </div>
          )}

          {blueprint.status === 'draft' ? (
            <SectionsEditor
              blueprint={blueprint}
              areas={areas}
              onSave={async (sections) => {
                await api.saveBlueprintSections(blueprint.id, sections);
                await loadBlueprint(blueprint.id);
              }}
            />
          ) : (
            <div style={card}>
              <h2 style={h2}>الأقسام والحصص</h2>
              <span style={label}>المخطط منشور — انسخه إلى مسودة لتعديل الأقسام.</span>
              {blueprint.sections.map((s) => (
                <div key={s.id} style={{ ...label, color: 'var(--sand)' }}>
                  القسم {s.orderIndex + 1} — {PARTS[s.part]} — {s.questionCount} سؤالًا — {mins(s.durationS)}
                  {' · '}
                  {s.quotas.map((q) => `${q.area.nameAr} (${q.count})`).join('، ')}
                </div>
              ))}
            </div>
          )}

          <Readiness
            data={readiness}
            busy={busy}
            onRefresh={() => act(async () => setReadiness(await api.blueprintReadiness(blueprint.id)))}
          />

          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h2 style={h2}>النماذج</h2>
              <div style={{ marginInlineStart: 'auto' }}>
                <Button
                  onClick={() => act(async () => {
                    const form = await api.generateSimulationForm(blueprint.id, {});
                    setForms(await api.listSimulationForms(blueprint.id));
                    setOpenForm(form);
                  })}
                  disabled={busy || issues.length > 0}
                >
                  {busy ? 'جارٍ التكوين…' : 'تكوين نموذج'}
                </Button>
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>الرمز</th>
                  <th style={th}>الحالة</th>
                  <th style={th}>الأسئلة</th>
                  <th style={th}>المحاولات</th>
                  <th style={th}>النوع</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {forms.map((f) => (
                  <tr key={f.id} style={{ borderTop: '0.5px solid var(--on-indigo-line)' }}>
                    <td style={td}>{f.code}</td>
                    <td style={{ ...td, color: STATUS_COLOR[f.status] }}>{STATUS[f.status]}</td>
                    <td style={td}>{f._count.items}</td>
                    <td style={td}>{f._count.attempts}</td>
                    <td style={td}>{f.isStatic ? 'معياري' : 'غير معياري'}</td>
                    <td style={{ ...td, display: 'flex', gap: '10px' }}>
                      <button onClick={() => act(async () => setOpenForm(await api.getSimulationForm(f.id)))} style={{ ...label, border: 'none', background: 'transparent', color: 'var(--lime)', cursor: 'pointer' }}>
                        معاينة
                      </button>
                      {f._count.attempts === 0 && (
                        <button
                          onClick={() => act(async () => { await api.deleteSimulationForm(f.id); setForms(await api.listSimulationForms(blueprint.id)); })}
                          style={{ ...label, border: 'none', background: 'transparent', color: 'var(--coral)', cursor: 'pointer' }}
                        >
                          حذف
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {forms.length === 0 && (
                  <tr><td style={{ ...td, color: 'var(--mist)' }} colSpan={6}>لا توجد نماذج بعد.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
