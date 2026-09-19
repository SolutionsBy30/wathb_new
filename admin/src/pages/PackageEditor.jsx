import { useEffect, useState } from 'react';
import { api } from '../api/client';

const fieldStyle = { padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--indigo)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '13px' };
const label = { fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' };
const btn = { border: 'none', cursor: 'pointer', padding: '8px 16px', borderRadius: '999px', fontFamily: 'var(--font-arabic)', fontSize: '12px' };

const sar = (h) => (h / 100).toFixed(2);
const toHalalas = (s) => Math.round(Number(s) * 100);

/**
 * PAY-014 — edit a package after it exists: price, the discount shown beside
 * it, and which tests it covers.
 *
 * All three were settable only at creation, so correcting a price meant
 * deactivating the package and rebuilding it — which orphans its subscribers
 * and loses its history.
 *
 * Two things this screen states rather than assumes:
 *
 *  - A price change never touches an active subscription. Subscription
 *    .priceSnapshotHalalas is captured at purchase (§4.5), so this only
 *    affects future purchases. Admins reasonably fear the opposite, and a
 *    pricing screen that does not say so invites a support ticket per edit.
 *
 *  - Removing a test DOES take it away from current subscribers, immediately.
 *    That one is destructive, so it is counted and confirmed.
 */
export default function PackageEditor({ pkg, tests, groups, onSaved, onCancel }) {
  const [nameAr, setNameAr] = useState(pkg.nameAr);
  const [nameEn, setNameEn] = useState(pkg.nameEn);
  const [priceSar, setPriceSar] = useState(sar(pkg.priceHalalas));
  const [compareAtSar, setCompareAtSar] = useState(pkg.compareAtHalalas ? sar(pkg.compareAtHalalas) : '');
  const [durationMonths, setDurationMonths] = useState(pkg.durationMonths);
  const [testIds, setTestIds] = useState([...(pkg.testIds ?? [])]);
  const [questionsPerDay, setQuestionsPerDay] = useState(pkg.questionsPerDay ?? 5);
  const [simulationsIncluded, setSimulationsIncluded] = useState(pkg.simulationsIncluded ?? 0);
  const [dailyWathbLimit, setDailyWathbLimit] = useState(pkg.dailyWathbLimit ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const price = Number(priceSar);
  const compareAt = compareAtSar === '' ? null : Number(compareAtSar);

  // PAY-010 — the API ignores a "was" price that is not strictly greater than
  // the real one, so a stale value renders as nothing at all. Saying so here
  // beats an admin wondering why their discount does not appear.
  const discountPercent = compareAt && compareAt > price
    ? Math.round(((compareAt - price) / compareAt) * 100)
    : null;
  const compareAtUseless = compareAt !== null && compareAt <= price;

  const removedTests = (pkg.testIds ?? []).filter((id) => !testIds.includes(id));
  const addedTests = testIds.filter((id) => !(pkg.testIds ?? []).includes(id));
  const nameOf = (id) => tests.find((t) => t.id === id)?.nameAr ?? id;

  const priceChanged = toHalalas(priceSar) !== pkg.priceHalalas;

  const valid = nameAr.trim() && nameEn.trim() && priceSar !== '' && !Number.isNaN(price) && price >= 0 && testIds.length > 0;

  const save = async () => {
    if (!valid) return;
    // Removing a test is the one edit here that takes something away from
    // people who already paid, so it is confirmed with the count.
    if (removedTests.length > 0 && pkg.activeSubscriptions > 0) {
      const ok = window.confirm(
        `سيفقد ${pkg.activeSubscriptions} مشترك نشط الوصول إلى: ${removedTests.map(nameOf).join('، ')}.\n\n`
        + 'يسري هذا فوراً على الاشتراكات القائمة. تأكيد؟',
      );
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.updatePackage(pkg.id, {
        nameAr: nameAr.trim(),
        nameEn: nameEn.trim(),
        priceHalalas: toHalalas(priceSar),
        compareAtHalalas: compareAtSar === '' ? null : toHalalas(compareAtSar),
        durationMonths: Number(durationMonths),
        testIds,
        questionsPerDay: Number(questionsPerDay),
        simulationsIncluded: Number(simulationsIncluded),
        dailyWathbLimit: dailyWathbLimit === '' ? null : Number(dailyWathbLimit),
      });
      await onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Tests grouped by catalogue segment (ADM-094), so picking coverage for an
  // English package does not mean scanning past every school test.
  const segments = (() => {
    const out = groups
      .map((g) => ({ id: g.id, nameAr: g.nameAr, items: tests.filter((t) => t.groupId === g.id) }))
      .filter((s) => s.items.length > 0);
    const rest = tests.filter((t) => !t.groupId || !out.some((g) => g.id === t.groupId));
    if (rest.length) out.push({ id: 'none', nameAr: 'غير مصنّف', items: rest });
    return out;
  })();

  return (
    <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '15px', fontWeight: 600, color: 'var(--sand)' }}>تعديل «{pkg.nameAr}»</h3>
        <span style={label}>
          {pkg.activeSubscriptions} اشتراك نشط · {pkg.totalSubscriptions} إجمالاً
        </span>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={label}>الاسم (عربي)</span>
          <input style={{ ...fieldStyle, width: '180px' }} value={nameAr} onChange={(e) => setNameAr(e.target.value)} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={label}>Name (EN)</span>
          <input style={{ ...fieldStyle, width: '170px', fontFamily: 'var(--font-latin)' }} dir="ltr" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={label}>المدة (شهور)</span>
          <input style={{ ...fieldStyle, width: '90px', fontFamily: 'var(--font-latin)' }} type="number" min={1} value={durationMonths} onChange={(e) => setDurationMonths(e.target.value)} />
        </label>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '0.5px solid var(--on-indigo-line)', paddingTop: '14px' }}>
        <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>السعر والخصم</span>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={label}>السعر شامل الضريبة (ريال)</span>
            <input style={{ ...fieldStyle, width: '130px', fontFamily: 'var(--font-latin)' }} type="number" min={0} step="0.01" value={priceSar} onChange={(e) => setPriceSar(e.target.value)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={label}>السعر قبل الخصم (اختياري)</span>
            <input style={{ ...fieldStyle, width: '150px', fontFamily: 'var(--font-latin)' }} type="number" min={0} step="0.01" placeholder="بدون خصم" value={compareAtSar} onChange={(e) => setCompareAtSar(e.target.value)} />
          </label>
          {discountPercent !== null && (
            <span style={{ ...btn, background: 'var(--lime)', color: 'var(--lime-ink)', cursor: 'default' }}>
              يظهر كخصم {discountPercent}%
            </span>
          )}
          {compareAtSar !== '' && (
            <button onClick={() => setCompareAtSar('')} style={{ ...btn, background: 'transparent', color: 'var(--mist)' }}>إزالة الخصم</button>
          )}
        </div>
        {compareAtUseless && (
          <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: '#E8C547', lineHeight: 1.8 }}>
            السعر قبل الخصم يجب أن يكون أعلى من السعر الحالي، وإلا فلن يظهر أي خصم للطالب.
          </span>
        )}
        {priceChanged && pkg.activeSubscriptions > 0 && (
          // §4.5 — the charged amount is snapshotted at purchase.
          <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)', lineHeight: 1.8 }}>
            تغيير السعر لا يمسّ الاشتراكات القائمة ({pkg.activeSubscriptions}) — كل اشتراك يحتفظ بالسعر الذي دُفع عند الشراء. يسري السعر الجديد على المشتريات الجديدة فقط.
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '0.5px solid var(--on-indigo-line)', paddingTop: '14px' }}>
        <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>الاختبارات المشمولة</span>
        {segments.map((seg) => (
          <div key={seg.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ ...label, minWidth: '100px' }}>{seg.nameAr}</span>
            {seg.items.map((t) => {
              const on = testIds.includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => setTestIds(on ? testIds.filter((x) => x !== t.id) : [...testIds, t.id])}
                  style={{
                    ...btn, padding: '6px 14px',
                    background: on ? 'var(--lime)' : 'var(--indigo)',
                    color: on ? 'var(--lime-ink)' : 'var(--sand)',
                  }}
                >
                  {t.nameAr}
                </button>
              );
            })}
          </div>
        ))}
        {testIds.length === 0 && (
          <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--coral)' }}>
            يجب اختيار اختبار واحد على الأقل — باقة بلا اختبارات لا تمنح أي وصول.
          </span>
        )}
        {removedTests.length > 0 && (
          <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--coral)', lineHeight: 1.8 }}>
            ستُزال: {removedTests.map(nameOf).join('، ')}
            {pkg.activeSubscriptions > 0 && ` — سيفقدها ${pkg.activeSubscriptions} مشترك نشط فوراً.`}
          </span>
        )}
        {addedTests.length > 0 && (
          <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--teal)', lineHeight: 1.8 }}>
            ستُضاف: {addedTests.map(nameOf).join('، ')} — يحصل عليها المشتركون الحاليون فوراً.
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', borderTop: '0.5px solid var(--on-indigo-line)', paddingTop: '14px' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={label}>أسئلة في كل وثبة</span>
          <input style={{ ...fieldStyle, width: '100px', fontFamily: 'var(--font-latin)' }} type="number" min={1} value={questionsPerDay} onChange={(e) => setQuestionsPerDay(e.target.value)} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={label}>محاكاة مشمولة</span>
          <input style={{ ...fieldStyle, width: '100px', fontFamily: 'var(--font-latin)' }} type="number" min={0} max={50} value={simulationsIncluded} onChange={(e) => setSimulationsIncluded(e.target.value)} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={label}>وثبات في اليوم (فارغ = غير محدود)</span>
          <input style={{ ...fieldStyle, width: '170px', fontFamily: 'var(--font-latin)' }} type="number" min={1} placeholder="غير محدود" value={dailyWathbLimit} onChange={(e) => setDailyWathbLimit(e.target.value)} />
        </label>
      </div>

      {/* PAY-016 — priced against the saved price, not the unsaved draft: a
          promo applies to what the package actually costs today. */}
      <PromoCodes pkg={pkg} priceHalalas={pkg.priceHalalas} />

      {error && <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--coral)' }}>{error}</span>}

      <div style={{ display: 'flex', gap: '8px' }}>
        <button disabled={busy || !valid} onClick={save} style={{ ...btn, background: 'var(--lime)', color: 'var(--lime-ink)', opacity: busy || !valid ? 0.5 : 1 }}>
          {busy ? 'جارٍ الحفظ…' : 'حفظ التعديلات'}
        </button>
        <button onClick={onCancel} style={{ ...btn, background: 'transparent', color: 'var(--mist)' }}>إلغاء</button>
      </div>
    </div>
  );
}

const REJECTION_AR = {
  inactive: 'غير مفعّل',
  not_started: 'لم يبدأ بعد',
  expired: 'منتهي',
  exhausted: 'استُنفد',
};

/**
 * PAY-016 — the promo codes that apply to this package, edited here.
 *
 * They lived on a separate screen keyed by code, so answering "what discounts
 * are running on الباقة الشاملة?" meant opening every code and reading its
 * package list. The question is always asked about a package.
 *
 * An empty packageIds means the code applies to EVERY package. Those are shown
 * but not detachable from here: removing this package from a global code would
 * mean writing every other package's id into it, which is a surprising thing
 * for a button on one package's screen to do. Narrowing a global code stays on
 * the codes screen, where its whole scope is visible.
 */
function PromoCodes({ pkg, priceHalalas }) {
  const [codes, setCodes] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [attachId, setAttachId] = useState('');
  const [creating, setCreating] = useState(false);

  const load = () => api.listDiscountCodes().then(setCodes).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  if (!codes) return <span style={label}>جارٍ تحميل رموز الخصم…</span>;

  const global = codes.filter((c) => (c.packageIds ?? []).length === 0);
  const scoped = codes.filter((c) => (c.packageIds ?? []).includes(pkg.id));
  const attachable = codes.filter((c) => (c.packageIds ?? []).length > 0 && !(c.packageIds ?? []).includes(pkg.id));

  // Mirrors applyPromoCode in pricing.util: percent rounds, and the discount
  // is clamped to the price so an over-large code makes the package free
  // rather than negative.
  const effect = (c) => {
    const raw = c.kind === 'percent' ? Math.round((priceHalalas * c.value) / 100) : c.value;
    const discount = Math.max(0, Math.min(raw, priceHalalas));
    return { discount, total: priceHalalas - discount };
  };

  // Everything applyPromoCode rejects on, minus scope, which is what the
  // sections already express.
  const blockedReason = (c) => {
    if (!c.isActive) return 'inactive';
    if (c.startsAt && new Date() < new Date(c.startsAt)) return 'not_started';
    if (c.expiresAt && new Date() > new Date(c.expiresAt)) return 'expired';
    if (c.maxRedemptions != null && c.timesRedeemed >= c.maxRedemptions) return 'exhausted';
    return null;
  };

  const setScope = async (code, packageIds) => {
    setBusyId(code.id);
    setError(null);
    try {
      await api.updateDiscountCode(code.id, { packageIds });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const Row = ({ c, detachable }) => {
    const { discount, total } = effect(c);
    const blocked = blockedReason(c);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '7px 0', borderTop: '0.5px solid var(--on-indigo-line)' }}>
        <span style={{ fontFamily: 'var(--font-latin)', fontSize: '13px', color: blocked ? 'var(--mist)' : 'var(--sand)' }} dir="ltr">{c.code}</span>
        <span style={label}>
          {c.kind === 'percent' ? `${c.value}%` : `${sar(c.value)} ريال`}
        </span>
        <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: blocked ? 'var(--mist)' : 'var(--teal)' }}>
          {sar(priceHalalas)} ← {sar(total)} ريال (−{sar(discount)})
        </span>
        {c.maxRedemptions != null && (
          <span style={label}>{c.timesRedeemed}/{c.maxRedemptions} استُخدم</span>
        )}
        {blocked && (
          <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: '#E8C547' }}>{REJECTION_AR[blocked]} — لا يعمل الآن</span>
        )}
        {detachable ? (
          <button
            disabled={busyId === c.id}
            onClick={() => setScope(c, (c.packageIds ?? []).filter((id) => id !== pkg.id))}
            style={{ ...btn, marginInlineStart: 'auto', background: 'transparent', color: 'var(--coral)', padding: '5px 12px' }}
          >
            {busyId === c.id ? '…' : 'إزالة من الباقة'}
          </button>
        ) : (
          <span style={{ ...label, marginInlineStart: 'auto' }}>يشمل كل الباقات</span>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '0.5px solid var(--on-indigo-line)', paddingTop: '14px' }}>
      <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>رموز الخصم على هذه الباقة</span>

      {scoped.length === 0 && global.length === 0 && (
        <span style={label}>لا رمز خصم ينطبق على هذه الباقة.</span>
      )}
      {scoped.map((c) => <Row key={c.id} c={c} detachable />)}
      {global.map((c) => <Row key={c.id} c={c} detachable={false} />)}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '6px' }}>
        <select value={attachId} onChange={(e) => setAttachId(e.target.value)} style={{ ...fieldStyle, minWidth: '180px' }}>
          <option value="">أضف رمزاً موجوداً…</option>
          {attachable.map((c) => (
            <option key={c.id} value={c.id}>{c.code} — {c.kind === 'percent' ? `${c.value}%` : `${sar(c.value)} ريال`}</option>
          ))}
        </select>
        <button
          disabled={!attachId || busyId !== null}
          onClick={() => {
            const c = codes.find((x) => x.id === attachId);
            if (c) setScope(c, [...(c.packageIds ?? []), pkg.id]).then(() => setAttachId(''));
          }}
          style={{ ...btn, background: 'var(--lime)', color: 'var(--lime-ink)', opacity: attachId ? 1 : 0.5 }}
        >
          إضافة
        </button>
        <button onClick={() => setCreating((v) => !v)} style={{ ...btn, background: 'transparent', boxShadow: 'inset 0 0 0 0.5px var(--on-indigo-line)', color: 'var(--sand)' }}>
          {creating ? 'إلغاء' : '+ رمز جديد لهذه الباقة'}
        </button>
      </div>

      {creating && (
        <NewPromoCode
          pkg={pkg}
          priceHalalas={priceHalalas}
          onCreated={async () => { setCreating(false); await load(); }}
          onError={setError}
        />
      )}

      {error && <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--coral)' }}>{error}</span>}
    </div>
  );
}

function NewPromoCode({ pkg, priceHalalas, onCreated, onError }) {
  const [code, setCode] = useState('');
  const [kind, setKind] = useState('percent');
  const [value, setValue] = useState('');
  const [maxRedemptions, setMaxRedemptions] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [busy, setBusy] = useState(false);

  const n = Number(value);
  // Same bounds the رموز الخصم screen enforces, so the two entry points cannot
  // accept different things: a 150% code would make the package free and the
  // clamp would hide the typo.
  const valid = code.trim() && value !== '' && !Number.isNaN(n) && n >= 1
    && (kind !== 'percent' || n <= 100);
  const preview = valid
    ? (() => {
        const raw = kind === 'percent' ? Math.round((priceHalalas * n) / 100) : Math.round(n * 100);
        const discount = Math.max(0, Math.min(raw, priceHalalas));
        return `${sar(priceHalalas)} ← ${sar(priceHalalas - discount)} ريال`;
      })()
    : null;

  return (
    <div style={{ background: 'var(--indigo)', borderRadius: 'var(--radius-sm)', padding: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={label}>الرمز</span>
        <input style={{ ...fieldStyle, width: '140px', fontFamily: 'var(--font-latin)', background: 'var(--on-indigo-subtle)' }} dir="ltr" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="SUMMER25" />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={label}>النوع</span>
        <select style={{ ...fieldStyle, background: 'var(--on-indigo-subtle)' }} value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="percent">نسبة %</option>
          <option value="fixed">مبلغ ثابت (ريال)</option>
        </select>
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={label}>{kind === 'percent' ? 'النسبة' : 'المبلغ'}</span>
        <input style={{ ...fieldStyle, width: '90px', fontFamily: 'var(--font-latin)', background: 'var(--on-indigo-subtle)' }} type="number" min={1} value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={label}>حد الاستخدام (اختياري)</span>
        <input style={{ ...fieldStyle, width: '110px', fontFamily: 'var(--font-latin)', background: 'var(--on-indigo-subtle)' }} type="number" min={1} placeholder="بلا حد" value={maxRedemptions} onChange={(e) => setMaxRedemptions(e.target.value)} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={label}>ينتهي في (اختياري)</span>
        <input style={{ ...fieldStyle, width: '150px', fontFamily: 'var(--font-latin)', background: 'var(--on-indigo-subtle)' }} type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
      </label>
      {preview && <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--teal)', paddingBottom: '10px' }}>{preview}</span>}
      <button
        disabled={busy || !valid}
        onClick={async () => {
          setBusy(true);
          try {
            await api.createDiscountCode({
              code: code.trim(),
              kind,
              // Fixed amounts are stored in halalas like every other money
              // field; percent is a plain number.
              value: kind === 'percent' ? n : Math.round(n * 100),
              packageIds: [pkg.id],
              maxRedemptions: maxRedemptions === '' ? null : Number(maxRedemptions),
              expiresAt: expiresAt === '' ? null : new Date(expiresAt).toISOString(),
            });
            await onCreated();
          } catch (e) {
            onError(e.message);
          } finally {
            setBusy(false);
          }
        }}
        style={{ ...btn, background: 'var(--lime)', color: 'var(--lime-ink)', opacity: busy || !valid ? 0.5 : 1 }}
      >
        {busy ? 'جارٍ…' : 'إنشاء'}
      </button>
    </div>
  );
}
