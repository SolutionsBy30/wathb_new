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
