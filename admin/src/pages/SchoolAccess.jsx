import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Button } from '../design-system/components/Button';

const card = { background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' };
const fieldStyle = { padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--indigo)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '13px' };
const label = { fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' };
const h3 = { margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '14px', fontWeight: 600, color: 'var(--sand)' };
const th = { textAlign: 'start', padding: '7px 10px', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)', whiteSpace: 'nowrap' };
const td = { padding: '7px 10px', fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)' };

const DISCLOSURE = {
  none: {
    text: 'مجهول تمامًا',
    hint: 'تُعرض الأسماء كرموز (طالب-4A1F). لا تغادر أي هوية المنصة.',
    color: 'var(--teal)',
  },
  consented: {
    text: 'بموافقة الطالب',
    hint: 'يظهر اسم الطالب فقط إذا وافق هو على مشاركة بياناته مع مدرسته.',
    color: 'var(--lime)',
  },
  full: {
    text: 'كشف كامل',
    hint: 'تظهر أسماء جميع الطلاب عدا من انسحب صراحةً. لا تُفعّل إلا باتفاق موقّع مع المدرسة.',
    color: 'var(--coral)',
  },
};

const ORDER = ['none', 'consented', 'full'];

/**
 * SCH-005 — who may read this school's dashboard, and how much of it.
 *
 * Scoped to one school rather than presenting every school at once: the
 * decision is always about a specific school, and a global table of disclosure
 * dropdowns made it far too easy to widen the wrong row.
 *
 * Disclosure asks for confirmation on the way up and not on the way down.
 * 'none' is the safe end of the scale; making someone confirm a step back
 * toward privacy only trains them to click through dialogs.
 */
export default function SchoolAccess({ schoolId, schoolNameAr, disclosure, onChanged }) {
  const [admins, setAdmins] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setAdmins(await api.listSchoolAdmins(schoolId));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => { setAdmins(null); load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [schoolId]);

  const changeDisclosure = async (next) => {
    if (next === disclosure) return;
    if (ORDER.indexOf(next) > ORDER.indexOf(disclosure)) {
      const ok = window.confirm(
        `سيُسمح لمدرسة "${schoolNameAr}" برؤية: ${DISCLOSURE[next].text}.\n\n${DISCLOSURE[next].hint}\n\nتأكيد؟`,
      );
      if (!ok) return;
    }
    setBusy(true);
    try {
      await api.setSchoolDisclosure(schoolId, next);
      onChanged?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleAdmin = async (link) => {
    if (link.isActive && !window.confirm(`إيقاف وصول ${link.user.name} إلى لوحة ${schoolNameAr}؟`)) return;
    try {
      await api.setSchoolAdminActive(link.id, !link.isActive);
      await load();
      onChanged?.();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ ...card, borderInlineStart: `3px solid ${DISCLOSURE[disclosure]?.color ?? 'var(--mist)'}` }}>
        <h3 style={h3}>مستوى الكشف عن هوية الطلاب</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {ORDER.map((k) => (
            <label key={k} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', cursor: busy ? 'wait' : 'pointer' }}>
              <input
                type="radio"
                name="disclosure"
                checked={disclosure === k}
                disabled={busy}
                onChange={() => changeDisclosure(k)}
                style={{ marginTop: '3px' }}
              />
              <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>{DISCLOSURE[k].text}</span>
                <span style={{ ...label, lineHeight: 1.7 }}>{DISCLOSURE[k].hint}</span>
              </span>
            </label>
          ))}
        </div>
        <p style={{ margin: 0, ...label, lineHeight: 1.9 }}>
          هذا سقف وليس مفتاحًا: انسحاب الطالب من مشاركة بياناته يتقدّم على أي مستوى هنا، بما في ذلك «كشف كامل».
          ولا تُعرض أي أرقام تفصيلية للمدرسة قبل تسجيل ١٥ طالبًا.
        </p>
      </div>

      <GrantForm schoolId={schoolId} schoolNameAr={schoolNameAr} onGranted={() => { load(); onChanged?.(); }} onError={setError} />

      <div style={{ ...card }}>
        <h3 style={h3}>مسؤولو اللوحة</h3>
        {admins === null ? (
          <p style={{ margin: 0, ...label }}>جارٍ التحميل…</p>
        ) : admins.length === 0 ? (
          <p style={{ margin: 0, ...label }}>لا أحد في هذه المدرسة يستطيع فتح اللوحة بعد.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>الاسم</th>
                  <th style={th}>الجوال</th>
                  <th style={th}>الصفة</th>
                  <th style={th}>آخر دخول</th>
                  <th style={th}>الحالة</th>
                  <th style={th} />
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => (
                  <tr key={a.id} style={{ borderTop: '0.5px solid var(--on-indigo-line)', opacity: a.isActive ? 1 : 0.55 }}>
                    <td style={td}>{a.user.name}</td>
                    <td style={{ ...td, fontFamily: 'var(--font-latin)', direction: 'ltr', textAlign: 'start' }}>{a.user.mobileE164}</td>
                    <td style={{ ...td, color: 'var(--mist)' }}>{a.title || '—'}</td>
                    <td style={{ ...td, color: 'var(--mist)', fontFamily: 'var(--font-latin)' }}>
                      {a.lastSeenAt ? new Date(a.lastSeenAt).toLocaleDateString('ar-SA-u-nu-latn', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                    </td>
                    <td style={{ ...td, color: a.isActive ? 'var(--lime)' : 'var(--mist)' }}>{a.isActive ? 'نشط' : 'موقوف'}</td>
                    <td style={td}>
                      <button
                        onClick={() => toggleAdmin(a)}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '12px', color: a.isActive ? 'var(--coral)' : 'var(--lime-print)' }}
                      >
                        {a.isActive ? 'إيقاف الوصول' : 'إعادة التفعيل'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {error && <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--coral)' }}>{error}</span>}
    </div>
  );
}

function GrantForm({ schoolId, schoolNameAr, onGranted, onError }) {
  const [name, setName] = useState('');
  const [local, setLocal] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  const valid = name.trim() && /^5\d{8}$/.test(local);

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    setDone(null);
    try {
      await api.grantSchoolAdmin({ schoolId, mobile: `+966${local}`, name: name.trim(), title: title.trim() || undefined });
      setDone(`تم منح ${name.trim()} صلاحية لوحة ${schoolNameAr}. يدخل عبر school.wathb.tech برقمه.`);
      setName(''); setLocal(''); setTitle('');
      onGranted();
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ ...card, maxWidth: '460px' }}>
      <h3 style={h3}>منح صلاحية اللوحة</h3>
      <input style={fieldStyle} placeholder="اسم المسؤول" value={name} onChange={(e) => setName(e.target.value)} />
      <div style={{ display: 'flex', gap: '8px' }}>
        <span style={{ ...fieldStyle, display: 'flex', alignItems: 'center', color: 'var(--mist)', fontFamily: 'var(--font-latin)' }} dir="ltr">+966</span>
        <input
          style={{ ...fieldStyle, flex: 1, fontFamily: 'var(--font-latin)' }}
          dir="ltr"
          inputMode="numeric"
          placeholder="5XXXXXXXX"
          maxLength={9}
          value={local}
          onChange={(e) => setLocal(e.target.value.replace(/\D/g, '').slice(0, 9))}
        />
      </div>
      <input style={fieldStyle} placeholder="الصفة (اختياري) — مثال: وكيل الشؤون التعليمية" value={title} onChange={(e) => setTitle(e.target.value)} />
      <span style={{ ...label, lineHeight: 1.8 }}>
        يجب أن يكون الرقم غير مستخدم لحساب طالب أو مشرف. الدخول برمز عبر واتساب — لا تُنشأ كلمة مرور.
      </span>
      <Button variant="primary" disabled={busy || !valid} onClick={submit}>{busy ? 'جارٍ المنح…' : 'منح الصلاحية'}</Button>
      {done && <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--lime)' }}>{done}</span>}
    </div>
  );
}
