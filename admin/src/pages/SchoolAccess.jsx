import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Button } from '../design-system/components/Button';

const fieldStyle = { padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--indigo)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '13px' };
const label = { fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' };
const h3 = { margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' };
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

/**
 * SCH-005 — granting and revoking school-dashboard access.
 *
 * Lives inside الجغرافيا والمدارس rather than as its own tab: it is governed by
 * the same 'geography' permission, and the question "who reads this school's
 * numbers?" belongs next to the school record itself.
 *
 * Disclosure gets a confirmation on the way up and none on the way down —
 * widening what a third party can see about minors is the direction that
 * deserves friction.
 */
export default function SchoolAccess() {
  const [schools, setSchools] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      const [s, a] = await Promise.all([api.schoolsWithAccess(), api.listSchoolAdmins()]);
      setSchools(s);
      setAdmins(a);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => { load(); }, []);

  const changeDisclosure = async (school, next) => {
    if (next === school.disclosure) return;
    // Only widening asks. 'none' is the safe end of the scale; making someone
    // confirm a step back toward privacy would train them to click through.
    const order = ['none', 'consented', 'full'];
    if (order.indexOf(next) > order.indexOf(school.disclosure)) {
      const ok = window.confirm(
        `سيُسمح لمدرسة "${school.nameAr}" برؤية: ${DISCLOSURE[next].text}.\n\n${DISCLOSURE[next].hint}\n\nتأكيد؟`,
      );
      if (!ok) return;
    }
    try {
      await api.setSchoolDisclosure(school.id, next);
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  const toggleAdmin = async (link) => {
    if (link.isActive && !window.confirm(`إيقاف وصول ${link.user.name} إلى لوحة ${link.school.nameAr}؟`)) return;
    try {
      await api.setSchoolAdminActive(link.id, !link.isActive);
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h3 style={h3}>لوحات المدارس · مستوى الكشف</h3>
          <button onClick={load} disabled={busy} style={{ border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', ...label }}>
            {busy ? 'جارٍ التحميل…' : 'تحديث'}
          </button>
        </div>
        <p style={{ margin: 0, ...label, lineHeight: 1.9 }}>
          مستوى الكشف سقف وليس مفتاحًا: انسحاب الطالب من مشاركة بياناته يتقدّم على أي إعداد هنا، بما في ذلك «كشف كامل».
          وتحت ١٥ طالبًا لا تُعرض أي أرقام للمدرسة أصلًا.
        </p>

        {schools.length === 0 ? (
          <p style={{ margin: 0, ...label }}>لا توجد مدرسة لديها مسؤول لوحة بعد.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>المدرسة</th>
                  <th style={th}>المدينة</th>
                  <th style={th}>الطلاب</th>
                  <th style={th}>المسؤولون</th>
                  <th style={th}>مستوى الكشف</th>
                </tr>
              </thead>
              <tbody>
                {schools.map((s) => (
                  <tr key={s.id} style={{ borderTop: '0.5px solid var(--on-indigo-line)' }}>
                    <td style={td}>{s.nameAr}</td>
                    <td style={{ ...td, color: 'var(--mist)' }}>{s.cityNameAr}</td>
                    <td style={{ ...td, fontFamily: 'var(--font-latin)' }}>{s.students}</td>
                    <td style={{ ...td, fontFamily: 'var(--font-latin)' }}>{s.admins}</td>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i style={{ width: '8px', height: '8px', borderRadius: '999px', background: DISCLOSURE[s.disclosure].color, display: 'inline-block', flexShrink: 0 }} />
                        <select
                          value={s.disclosure}
                          onChange={(e) => changeDisclosure(s, e.target.value)}
                          style={{ ...fieldStyle, padding: '6px 10px', fontSize: '12px' }}
                        >
                          {Object.entries(DISCLOSURE).map(([k, v]) => <option key={k} value={k}>{v.text}</option>)}
                        </select>
                      </div>
                      <span style={{ ...label, fontSize: '10px', display: 'block', marginTop: '4px' }}>{DISCLOSURE[s.disclosure].hint}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <GrantForm onGranted={load} onError={setError} />

      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h3 style={h3}>مسؤولو لوحات المدارس ({admins.length})</h3>
        {admins.length === 0 ? (
          <p style={{ margin: 0, ...label }}>لا أحد بعد.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>الاسم</th>
                  <th style={th}>الجوال</th>
                  <th style={th}>المدرسة</th>
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
                    <td style={td}>{a.school.nameAr}</td>
                    <td style={{ ...td, color: 'var(--mist)' }}>{a.title || '—'}</td>
                    <td style={{ ...td, color: 'var(--mist)', fontFamily: 'var(--font-latin)' }}>
                      {a.lastSeenAt ? new Date(a.lastSeenAt).toLocaleDateString('ar-SA-u-nu-latn', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                    </td>
                    <td style={td}>
                      <span style={{ color: a.isActive ? 'var(--lime)' : 'var(--mist)' }}>{a.isActive ? 'نشط' : 'موقوف'}</span>
                    </td>
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

function GrantForm({ onGranted, onError }) {
  const [regionId, setRegionId] = useState('');
  const [cityId, setCityId] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [regions, setRegions] = useState([]);
  const [cities, setCities] = useState([]);
  const [schools, setSchools] = useState([]);
  const [name, setName] = useState('');
  const [local, setLocal] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => { api.listRegions().then(setRegions).catch(() => {}); }, []);

  const pickRegion = async (id) => {
    setRegionId(id); setCityId(''); setSchoolId(''); setSchools([]);
    setCities(id ? await api.listCities(id) : []);
  };
  const pickCity = async (id) => {
    setCityId(id); setSchoolId('');
    setSchools(id ? await api.listSchools(id) : []);
  };

  const valid = schoolId && name.trim() && /^5\d{8}$/.test(local);

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    setDone(null);
    try {
      await api.grantSchoolAdmin({ schoolId, mobile: `+966${local}`, name: name.trim(), title: title.trim() || undefined });
      setDone(`تم منح ${name.trim()} صلاحية الدخول. يدخل عبر school.wathb.tech برقمه.`);
      setName(''); setLocal(''); setTitle('');
      onGranted();
    } catch (e) {
      onError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '460px' }}>
      <h3 style={h3}>منح صلاحية لوحة مدرسة</h3>
      <select value={regionId} onChange={(e) => pickRegion(e.target.value)} style={fieldStyle}>
        <option value="">اختر المنطقة</option>
        {regions.map((r) => <option key={r.id} value={r.id}>{r.nameAr}</option>)}
      </select>
      <select value={cityId} onChange={(e) => pickCity(e.target.value)} style={fieldStyle} disabled={!regionId}>
        <option value="">اختر المدينة</option>
        {cities.map((c) => <option key={c.id} value={c.id}>{c.nameAr}</option>)}
      </select>
      <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} style={fieldStyle} disabled={!cityId}>
        <option value="">اختر المدرسة</option>
        {schools.map((s) => <option key={s.id} value={s.id}>{s.nameAr}</option>)}
      </select>
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
        يجب أن يكون الرقم غير مستخدم لحساب طالب أو مشرف. الدخول بالرمز عبر واتساب — لا تُنشأ كلمة مرور.
      </span>
      <Button variant="primary" disabled={busy || !valid} onClick={submit}>{busy ? 'جارٍ المنح…' : 'منح الصلاحية'}</Button>
      {done && <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--lime)' }}>{done}</span>}
    </div>
  );
}
