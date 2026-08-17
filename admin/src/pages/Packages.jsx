import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Button } from '../design-system/components/Button';

const fieldStyle = { padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--on-indigo-subtle)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '13px' };

function halalasToSar(h) {
  return (h / 100).toFixed(2);
}

function FlagBadge({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      title={active ? `${label} — مفعّل` : `${label} — موقوف`}
      style={{
        border: 'none', cursor: 'pointer', padding: '3px 8px', borderRadius: '999px', fontFamily: 'var(--font-arabic)', fontSize: '10px',
        background: active ? 'var(--indigo)' : 'transparent', boxShadow: active ? 'none' : 'inset 0 0 0 0.5px var(--on-indigo-line)',
        color: active ? 'var(--teal-ink)' : 'var(--mist)',
      }}
    >
      {label}
    </button>
  );
}

function Check({ checked, onChange, children, hint }) {
  return (
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)', cursor: 'pointer', lineHeight: 1.7 }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: '3px' }} />
      <span>
        {children}
        {hint && <span style={{ display: 'block', fontSize: '10px', color: 'var(--mist)' }}>{hint}</span>}
      </span>
    </label>
  );
}

/**
 * FRE-010 — what a non-paying account gets.
 *
 * The free tier is a real package flagged `isDefault`: every new signup is
 * enrolled into it, and a lapsed paid plan drops back to it. Nominating it was
 * previously impossible from the console (the flag existed only in the schema),
 * so this panel is the one place that both picks it and edits its
 * entitlements. Same fields as any other package — a free tier is not a
 * special case, it is a package priced at zero.
 */
function FreeAccountPanel({ packages, tests, onSaved }) {
  const current = packages.find((p) => p.isDefault) ?? null;
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  // Re-seed whenever the nominated package changes underneath us, but never
  // while the admin is mid-edit on the same one.
  useEffect(() => {
    if (!current) return setDraft(null);
    setDraft((d) => (d && d.id === current.id ? d : {
      id: current.id,
      testIds: current.testIds ?? [],
      dailyWathbLimit: current.dailyWathbLimit ?? '',
      questionsPerDay: current.questionsPerDay ?? 5,
      dailyNotificationEnabled: current.dailyNotificationEnabled,
      reportVisibility: current.reportVisibility,
      weeklyReportEnabled: current.weeklyReportEnabled,
      supervisorLinkingAllowed: current.supervisorLinkingAllowed,
    }));
  }, [current?.id, packages]);

  const nominate = async (id) => {
    setError(null);
    setBusy(true);
    try {
      if (id === '') {
        if (current) await api.updatePackage(current.id, { isDefault: false });
      } else {
        await api.updatePackage(id, { isDefault: true });
      }
      await onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      await api.updatePackage(draft.id, {
        testIds: draft.testIds,
        dailyWathbLimit: draft.dailyWathbLimit === '' ? null : Number(draft.dailyWathbLimit),
        questionsPerDay: Number(draft.questionsPerDay) || 1,
        dailyNotificationEnabled: draft.dailyNotificationEnabled,
        reportVisibility: draft.reportVisibility,
        weeklyReportEnabled: draft.weeklyReportEnabled,
        supervisorLinkingAllowed: draft.supervisorLinkingAllowed,
      });
      await onSaved();
      setSaved(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const set = (patch) => { setDraft((d) => ({ ...d, ...patch })); setSaved(false); };

  return (
    <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '520px' }}>
      <div>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '14px', color: 'var(--sand)' }}>الحساب المجاني (غير المشتركين)</h2>
        <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)', lineHeight: 1.8 }}>
          الباقة التي يُسجَّل فيها كل حساب جديد تلقائياً، ويعود إليها المشترك عند انتهاء اشتراكه. ما تختاره هنا هو ما يحصل عليه غير المشتركين.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>الباقة الافتراضية</span>
        <select
          value={current?.id ?? ''}
          disabled={busy}
          onChange={(e) => nominate(e.target.value)}
          style={fieldStyle}
        >
          <option value="">— لا يوجد حساب مجاني (يُمنع غير المشتركين تماماً) —</option>
          {packages.map((p) => (
            <option key={p.id} value={p.id}>{p.nameAr} — {halalasToSar(p.priceHalalas)} ريال</option>
          ))}
        </select>
      </div>

      {!current && (
        <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--coral)', lineHeight: 1.8 }}>
          لا توجد باقة افتراضية. الحسابات الجديدة والاشتراكات المنتهية لن تتمكن من بدء أي وثبة حتى تشترك. أنشئ باقة بسعر صفر ثم اخترها هنا.
        </p>
      )}

      {current && draft && (
        <>
          {current.priceHalalas > 0 && (
            <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--coral)', lineHeight: 1.8 }}>
              هذه الباقة بسعر {halalasToSar(current.priceHalalas)} ريال — ستُمنح مجاناً لكل حساب جديد، وستنتهي بعد {current.durationMonths} شهر (الباقة بسعر صفر لا تنتهي).
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>الاختبارات المتاحة مجاناً</span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {tests.map((t) => (
                <button
                  key={t.id}
                  onClick={() => set({ testIds: draft.testIds.includes(t.id) ? draft.testIds.filter((x) => x !== t.id) : [...draft.testIds, t.id] })}
                  style={{
                    border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: '999px', fontFamily: 'var(--font-arabic)', fontSize: '11px',
                    background: draft.testIds.includes(t.id) ? 'var(--lime)' : 'var(--indigo)', color: draft.testIds.includes(t.id) ? 'var(--lime-ink)' : 'var(--sand)',
                  }}
                >
                  {t.nameAr}
                </button>
              ))}
            </div>
            {draft.testIds.length === 0 && (
              <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '10px', color: 'var(--coral)' }}>بدون اختبار واحد على الأقل لن يستطيع المستخدم المجاني بدء أي وثبة.</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <label style={{ flex: 1, minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '4px', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>
              عدد الوثبات في اليوم
              <input
                style={fieldStyle} type="number" min={1} placeholder="فارغ = غير محدود"
                value={draft.dailyWathbLimit}
                onChange={(e) => set({ dailyWathbLimit: e.target.value })}
              />
            </label>
            <label style={{ flex: 1, minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '4px', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>
              عدد الأسئلة في الوثبة
              <input
                style={fieldStyle} type="number" min={1}
                value={draft.questionsPerDay}
                onChange={(e) => set({ questionsPerDay: e.target.value })}
              />
            </label>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: '8px', borderTop: '0.5px solid var(--on-indigo-line)' }}>
            <Check checked={draft.dailyNotificationEnabled} onChange={(v) => set({ dailyNotificationEnabled: v })} hint="تذكير الوثبة اليومية عبر واتساب والبريد">
              الإشعارات اليومية
            </Check>
            <Check checked={draft.reportVisibility === 'full'} onChange={(v) => set({ reportVisibility: v ? 'full' : 'partial' })} hint="عند الإيقاف: يرى الملخّص فقط دون تحليل الأداء بالمجالات">
              تقرير الأداء الكامل
            </Check>
            <Check checked={draft.weeklyReportEnabled} onChange={(v) => set({ weeklyReportEnabled: v })} hint="التقرير المرسل للطالب وللمشرف كل أسبوع">
              التقرير الأسبوعي
            </Check>
            <Check checked={draft.supervisorLinkingAllowed} onChange={(v) => set({ supervisorLinkingAllowed: v })} hint="دعوة ولي أمر أو معلّم لمتابعة التقدم">
              ربط مشرف
            </Check>
          </div>

          {error && <p style={{ margin: 0, fontSize: '12px', color: 'var(--coral)' }}>{error}</p>}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Button variant="primary" disabled={busy} onClick={save}>{busy ? 'جاري الحفظ…' : 'حفظ إعدادات الحساب المجاني'}</Button>
            {saved && <span style={{ fontSize: '12px', color: 'var(--teal-ink)' }}>تم الحفظ.</span>}
          </div>
        </>
      )}
    </div>
  );
}

function NewPackageForm({ tests, onCreated }) {
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [testIds, setTestIds] = useState([]);
  const [durationMonths, setDurationMonths] = useState(1);
  const [priceSar, setPriceSar] = useState('');
  // PAY-010 — the "was" price, shown struck through next to the real one.
  const [compareAtSar, setCompareAtSar] = useState('');
  const [dailyNotificationEnabled, setDailyNotificationEnabled] = useState(true);
  const [dailyWathbLimit, setDailyWathbLimit] = useState('');
  const [questionsPerDay, setQuestionsPerDay] = useState(5);
  const [sort, setSort] = useState(0);
  const [reportVisibility, setReportVisibility] = useState('full');
  const [weeklyReportEnabled, setWeeklyReportEnabled] = useState(true);
  const [supervisorLinkingAllowed, setSupervisorLinkingAllowed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const toggleTest = (id) => setTestIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const submit = async () => {
    setError(null);
    if (!nameAr.trim() || !nameEn.trim() || testIds.length === 0 || !priceSar) return setError('املأ جميع الحقول واختر اختباراً واحداً على الأقل.');
    setBusy(true);
    try {
      await api.createPackage({
        nameAr: nameAr.trim(), nameEn: nameEn.trim(), testIds,
        durationMonths: Number(durationMonths), priceHalalas: Math.round(Number(priceSar) * 100),
        compareAtHalalas: compareAtSar === '' ? null : Math.round(Number(compareAtSar) * 100),
        dailyNotificationEnabled, reportVisibility, weeklyReportEnabled, supervisorLinkingAllowed,
        dailyWathbLimit: dailyWathbLimit === '' ? null : Number(dailyWathbLimit),
        questionsPerDay: Number(questionsPerDay) || 5,
        sort: Number(sort) || 0,
      });
      setNameAr(''); setNameEn(''); setTestIds([]); setDurationMonths(1); setPriceSar(''); setCompareAtSar('');
      setDailyNotificationEnabled(true); setReportVisibility('full'); setWeeklyReportEnabled(true); setSupervisorLinkingAllowed(true);
      onCreated();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '420px' }}>
      <h2 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '14px', color: 'var(--sand)' }}>باقة جديدة</h2>
      <input style={fieldStyle} placeholder="الاسم (عربي)" value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
      <input style={fieldStyle} placeholder="Name (EN)" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {tests.map((t) => (
          <button
            key={t.id}
            onClick={() => toggleTest(t.id)}
            style={{
              border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: '999px', fontFamily: 'var(--font-arabic)', fontSize: '11px',
              background: testIds.includes(t.id) ? 'var(--lime)' : 'var(--indigo)', color: testIds.includes(t.id) ? 'var(--lime-ink)' : 'var(--sand)',
            }}
          >
            {t.nameAr}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <input style={{ ...fieldStyle, flex: 1 }} type="number" min={1} placeholder="المدة (أشهر)" value={durationMonths} onChange={(e) => setDurationMonths(e.target.value)} />
        <input style={{ ...fieldStyle, flex: 1 }} type="number" min={0} step="0.01" placeholder="السعر (ريال، شامل الضريبة)" value={priceSar} onChange={(e) => setPriceSar(e.target.value)} />
      </div>
      <input
        style={fieldStyle}
        type="number" min={0} step="0.01"
        placeholder="السعر قبل الخصم (اختياري)"
        value={compareAtSar}
        onChange={(e) => setCompareAtSar(e.target.value)}
        title="يظهر مشطوباً بجانب السعر مع نسبة الخصم. اتركه فارغاً لإخفاء الخصم — ويُتجاهل إن لم يكن أعلى من السعر."
      />
      <input
        style={fieldStyle}
        type="number"
        min={1}
        placeholder="حد الوثبات اليومية (فارغ = غير محدود)"
        value={dailyWathbLimit}
        onChange={(e) => setDailyWathbLimit(e.target.value)}
        title="كم وثبة يستطيع المشترك إكمالها في اليوم الواحد؛ اتركه فارغاً لعدد غير محدود"
      />
      <input
        style={fieldStyle}
        type="number"
        min={1}
        placeholder="عدد الأسئلة في الوثبة"
        value={questionsPerDay}
        onChange={(e) => setQuestionsPerDay(e.target.value)}
        title="عدد أسئلة الوثبة الواحدة"
      />
      <input
        style={fieldStyle}
        type="number"
        placeholder="ترتيب العرض (الأصغر أولاً)"
        value={sort}
        onChange={(e) => setSort(e.target.value)}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '4px', borderTop: '0.5px solid var(--on-indigo-line)' }}>
        <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>حدود الباقة (لتحديد باقة مجانية محدودة)</span>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)' }}>
          <input type="checkbox" checked={dailyNotificationEnabled} onChange={(e) => setDailyNotificationEnabled(e.target.checked)} />
          إشعار الوثبة اليومية عبر واتساب
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)' }}>
          <input type="checkbox" checked={reportVisibility === 'full'} onChange={(e) => setReportVisibility(e.target.checked ? 'full' : 'partial')} />
          تقرير أداء كامل (غير محجوب)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)' }}>
          <input type="checkbox" checked={weeklyReportEnabled} onChange={(e) => setWeeklyReportEnabled(e.target.checked)} />
          التقرير الأسبوعي
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)' }}>
          <input type="checkbox" checked={supervisorLinkingAllowed} onChange={(e) => setSupervisorLinkingAllowed(e.target.checked)} />
          السماح بدعوة مشرف
        </label>
      </div>
      {error && <p style={{ margin: 0, fontSize: '12px', color: 'var(--coral)' }}>{error}</p>}
      <Button variant="primary" disabled={busy} onClick={submit}>{busy ? 'جاري الحفظ…' : 'إنشاء الباقة'}</Button>
    </div>
  );
}

export default function Packages({ tests }) {
  const [packages, setPackages] = useState([]);

  const load = () => api.listPackages().then(setPackages);
  useEffect(() => { load(); }, []);

  const toggleActive = async (pkg) => {
    await api.updatePackage(pkg.id, { isActive: !pkg.isActive });
    await load();
  };

  const toggleFlag = async (pkg, key, value) => {
    await api.updatePackage(pkg.id, { [key]: value });
    await load();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '20px', fontWeight: 500, color: 'var(--sand)' }}>الباقات والتسعير</h1>

      <FreeAccountPanel packages={packages} tests={tests} onSaved={load} />

      <NewPackageForm tests={tests} onCreated={load} />

      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'start', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>
              <th style={th}>الاسم</th>
              <th style={th}>المدة</th>
              <th style={th}>السعر (شامل الضريبة)</th>
              <th style={th}>الاختبارات</th>
              <th style={th}>الحدود</th>
              <th style={th}>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {packages.map((p) => (
              <tr key={p.id} style={{ borderTop: '0.5px solid var(--on-indigo-line)' }}>
                <td style={td}>
                  <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>{p.nameAr}</span>
                  {p.isDefault && (
                    <span style={{ marginInlineStart: '6px', fontFamily: 'var(--font-arabic)', fontSize: '10px', color: 'var(--lime-ink)', background: 'var(--lime)', borderRadius: '999px', padding: '2px 8px' }}>المجانية</span>
                  )}
                </td>
                <td style={td}><span style={{ fontFamily: 'var(--font-latin)', fontSize: '12px', color: 'var(--sand)' }}>{p.durationMonths} شهر</span></td>
                <td style={td}>
                  <span style={{ fontFamily: 'var(--font-latin)', fontSize: '12px', color: 'var(--sand)' }}>{halalasToSar(p.priceHalalas)} ريال</span>
                  {p.compareAtHalalas && (
                    <span style={{ marginInlineStart: '6px', fontFamily: 'var(--font-latin)', fontSize: '11px', color: 'var(--mist)', textDecoration: 'line-through' }}>
                      {halalasToSar(p.compareAtHalalas)}
                    </span>
                  )}
                </td>
                <td style={td}><span style={{ fontFamily: 'var(--font-latin)', fontSize: '11px', color: 'var(--mist)' }}>{p.testIds.length}</span></td>
                <td style={td}>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', maxWidth: '220px' }}>
                    <FlagBadge active={p.dailyNotificationEnabled} onClick={() => toggleFlag(p, 'dailyNotificationEnabled', !p.dailyNotificationEnabled)} label="إشعار يومي" />
                    <FlagBadge active={p.reportVisibility === 'full'} onClick={() => toggleFlag(p, 'reportVisibility', p.reportVisibility === 'full' ? 'partial' : 'full')} label="تقرير كامل" />
                    <FlagBadge active={p.weeklyReportEnabled} onClick={() => toggleFlag(p, 'weeklyReportEnabled', !p.weeklyReportEnabled)} label="تقرير أسبوعي" />
                    <FlagBadge active={p.supervisorLinkingAllowed} onClick={() => toggleFlag(p, 'supervisorLinkingAllowed', !p.supervisorLinkingAllowed)} label="دعوة مشرف" />
                    <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '10px', color: 'var(--mist)', padding: '3px 8px', borderRadius: '999px', boxShadow: 'inset 0 0 0 0.5px var(--on-indigo-line)' }}>
                      وثبات/يوم: {p.dailyWathbLimit ?? 'غير محدود'}
                    </span>
                    <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '10px', color: 'var(--mist)', padding: '3px 8px', borderRadius: '999px', boxShadow: 'inset 0 0 0 0.5px var(--on-indigo-line)' }}>
                      أسئلة/وثبة: {p.questionsPerDay}
                    </span>
                  </div>
                </td>
                <td style={td}>
                  <div style={{ display: 'flex', gap: '2px', marginBottom: '4px' }}>
                    <button
                      title="نقل لأعلى"
                      onClick={() => api.updatePackage(p.id, { sort: (p.sort ?? 0) - 1 }).then(load)}
                      style={{ border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--mist)', fontSize: '12px' }}
                    >↑</button>
                    <button
                      title="نقل لأسفل"
                      onClick={() => api.updatePackage(p.id, { sort: (p.sort ?? 0) + 1 }).then(load)}
                      style={{ border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--mist)', fontSize: '12px' }}
                    >↓</button>
                  </div>
                  <button
                    onClick={() => toggleActive(p)}
                    style={{ border: 'none', cursor: 'pointer', background: 'transparent', fontFamily: 'var(--font-arabic)', fontSize: '12px', color: p.isActive ? 'var(--teal-ink)' : 'var(--coral)' }}
                  >
                    {p.isActive ? 'فعّالة' : 'موقوفة'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {packages.length === 0 && <p style={{ margin: 0, padding: '20px', fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>لا توجد باقات بعد.</p>}
      </div>
    </div>
  );
}

const th = { padding: '10px 12px' };
const td = { padding: '10px 12px' };
