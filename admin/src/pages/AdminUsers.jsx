import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Button } from '../design-system/components/Button';

const field = { padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--indigo)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '13px' };
const chip = { border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: '999px', fontFamily: 'var(--font-arabic)', fontSize: '11px' };

/**
 * ADM-088 — admin accounts and their reach.
 *
 * The permission list is fetched rather than hardcoded, so the console cannot
 * drift from the vocabulary the API actually enforces. Checking a box here is
 * a convenience; the guard on every admin route is the real control.
 */
function PermissionPicker({ groups, selected, onToggle, disabled }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {groups.map((g) => (
        <div key={g.group} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>{g.group}</span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {g.items.map((it) => {
              const on = selected.includes(it.key);
              return (
                <button
                  key={it.key}
                  type="button"
                  disabled={disabled}
                  aria-pressed={on}
                  onClick={() => onToggle(it.key)}
                  style={{
                    ...chip,
                    background: on ? 'var(--lime)' : 'var(--indigo)',
                    color: on ? 'var(--lime-ink)' : 'var(--sand)',
                    opacity: disabled ? 0.5 : 1,
                  }}
                >
                  {it.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function AdminForm({ groups, initial, onSubmit, onCancel, busy }) {
  const isNew = !initial;
  const [name, setName] = useState(initial?.name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [password, setPassword] = useState('');
  const [permissions, setPermissions] = useState(initial?.adminPermissions ?? []);
  const [isSuperAdmin, setIsSuperAdmin] = useState(initial?.isSuperAdmin ?? false);
  const [error, setError] = useState(null);

  const toggle = (key) => setPermissions((p) => (p.includes(key) ? p.filter((x) => x !== key) : [...p, key]));

  const submit = async () => {
    setError(null);
    if (!name.trim() || !email.trim()) return setError('الاسم والبريد مطلوبان.');
    if (isNew && password.length < 8) return setError('كلمة المرور ٨ أحرف على الأقل.');
    if (!isNew && password && password.length < 8) return setError('كلمة المرور ٨ أحرف على الأقل.');
    try {
      await onSubmit({
        name: name.trim(),
        email: email.trim(),
        ...(password ? { password } : {}),
        permissions,
        isSuperAdmin,
      });
      setPassword('');
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '620px' }}>
      <h2 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '14px', color: 'var(--sand)' }}>
        {isNew ? 'مسؤول جديد' : `تعديل: ${initial.name}`}
      </h2>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <input style={{ ...field, flex: 1, minWidth: '180px' }} placeholder="الاسم" value={name} onChange={(e) => setName(e.target.value)} />
        <input style={{ ...field, flex: 1, minWidth: '180px', fontFamily: 'var(--font-latin)' }} dir="ltr" placeholder="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <input
        style={{ ...field, fontFamily: 'var(--font-latin)' }}
        dir="ltr"
        type="password"
        autoComplete="new-password"
        placeholder={isNew ? 'كلمة المرور (٨ أحرف فأكثر)' : 'كلمة مرور جديدة (اتركها فارغة لإبقائها)'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)', cursor: 'pointer', lineHeight: 1.7 }}>
        <input type="checkbox" checked={isSuperAdmin} onChange={(e) => setIsSuperAdmin(e.target.checked)} style={{ marginTop: '3px' }} />
        <span>
          مسؤول عام
          <span style={{ display: 'block', fontSize: '10px', color: 'var(--mist)' }}>
            وصول كامل لكل الأقسام، وهو وحده من يستطيع إدارة حسابات المسؤولين.
          </span>
        </span>
      </label>

      <div style={{ paddingTop: '6px', borderTop: '0.5px solid var(--on-indigo-line)' }}>
        <p style={{ margin: '0 0 8px', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>
          {isSuperAdmin ? 'المسؤول العام يصل لكل الأقسام — لا حاجة للتحديد.' : 'الأقسام المسموح بها'}
        </p>
        <PermissionPicker groups={groups} selected={permissions} onToggle={toggle} disabled={isSuperAdmin} />
        {!isSuperAdmin && permissions.length === 0 && (
          <p style={{ margin: '8px 0 0', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--coral)' }}>
            بدون أي قسم سيتمكن من تسجيل الدخول دون الوصول لأي شاشة.
          </p>
        )}
      </div>

      {error && <p style={{ margin: 0, fontSize: '12px', color: 'var(--coral)' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '10px' }}>
        <Button variant="primary" disabled={busy} onClick={submit}>{busy ? 'جاري الحفظ…' : isNew ? 'إنشاء الحساب' : 'حفظ التعديلات'}</Button>
        {onCancel && <Button variant="secondary" onClick={onCancel}>إلغاء</Button>}
      </div>
    </div>
  );
}

export default function AdminUsers({ me }) {
  const [admins, setAdmins] = useState(null);
  const [groups, setGroups] = useState([]);
  const [editing, setEditing] = useState(undefined); // undefined = none, null = new, object = edit
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = () => api.listAdmins().then(setAdmins).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    api.adminPermissionCatalogue().then((c) => setGroups(c.groups)).catch(() => {});
  }, []);

  const run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
      setEditing(undefined);
    } finally {
      setBusy(false);
    }
  };

  if (!me?.isSuperAdmin) {
    return (
      <p style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>
        هذه الشاشة للمسؤول العام فقط.
      </p>
    );
  }
  if (error && !admins) return <p style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--coral)' }}>{error}</p>;
  if (!admins) return <p style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>جاري التحميل…</p>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '20px', fontWeight: 500, color: 'var(--sand)' }}>المسؤولون</h1>
        {editing === undefined && (
          <Button variant="primary" onClick={() => setEditing(null)}>مسؤول جديد</Button>
        )}
      </div>

      {error && <p style={{ margin: 0, fontSize: '12px', color: 'var(--coral)' }}>{error}</p>}

      {editing === null && (
        <AdminForm
          groups={groups}
          busy={busy}
          onCancel={() => setEditing(undefined)}
          onSubmit={(dto) => run(() => api.createAdmin(dto))}
        />
      )}
      {editing && (
        <AdminForm
          groups={groups}
          initial={editing}
          busy={busy}
          onCancel={() => setEditing(undefined)}
          onSubmit={(dto) => run(() => api.updateAdmin(editing.id, dto))}
        />
      )}

      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'start', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>
              <th style={th}>الاسم</th>
              <th style={th}>البريد</th>
              <th style={th}>الصلاحيات</th>
              <th style={th}>الحالة</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id} style={{ borderTop: '0.5px solid var(--on-indigo-line)' }}>
                <td style={td}>
                  <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>{a.name}</span>
                  {a.id === me.id && <span style={{ marginInlineStart: '6px', fontFamily: 'var(--font-arabic)', fontSize: '10px', color: 'var(--mist)' }}>(أنت)</span>}
                </td>
                <td style={td}><span dir="ltr" style={{ fontFamily: 'var(--font-latin)', fontSize: '12px', color: 'var(--mist)' }}>{a.email}</span></td>
                <td style={td}>
                  {a.isSuperAdmin ? (
                    <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '10px', color: 'var(--lime-ink)', background: 'var(--lime)', borderRadius: '999px', padding: '2px 8px' }}>مسؤول عام</span>
                  ) : (
                    <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>
                      {a.adminPermissions.length === 0 ? 'بدون صلاحيات' : `${a.adminPermissions.length} قسم`}
                    </span>
                  )}
                </td>
                <td style={td}>
                  <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: a.status === 'suspended' ? 'var(--coral)' : 'var(--teal-ink)' }}>
                    {a.status === 'suspended' ? 'موقوف' : 'فعّال'}
                  </span>
                </td>
                <td style={td}>
                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditing(a)} style={{ ...chip, background: 'transparent', boxShadow: 'inset 0 0 0 0.5px var(--on-indigo-line)', color: 'var(--sand)' }}>تعديل</button>
                    {a.id !== me.id && (
                      <button
                        disabled={busy}
                        onClick={() => run(() => api.updateAdmin(a.id, { status: a.status === 'suspended' ? 'active' : 'suspended' }).catch((e) => { setError(e.message); throw e; }))}
                        style={{ ...chip, background: 'transparent', boxShadow: 'inset 0 0 0 0.5px var(--on-indigo-line)', color: a.status === 'suspended' ? 'var(--teal-ink)' : 'var(--coral)' }}
                      >
                        {a.status === 'suspended' ? 'تفعيل' : 'إيقاف'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const th = { padding: '10px 12px' };
const td = { padding: '10px 12px' };
