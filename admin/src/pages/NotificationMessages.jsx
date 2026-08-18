import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Button } from '../design-system/components/Button';

const field = { padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--indigo)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '13px', width: '100%' };
const th = { padding: '10px 12px' };
const td = { padding: '10px 12px', verticalAlign: 'top' };

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
}

/**
 * NOT-017 — the pool of daily-leap message variants.
 *
 * One active message is drawn at random per send. With none active the
 * built-in wording goes out, so an empty list is a valid state and says so
 * on screen rather than looking like a failed load.
 */
function MessageForm({ placeholders, initial, onSubmit, onCancel, busy }) {
  const [body, setBody] = useState(initial?.body ?? '');
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);

  // Previewed through the same renderer the sender uses, so what an admin
  // checks here is what a student receives — not a second implementation
  // that could quietly disagree with it.
  useEffect(() => {
    let cancelled = false;
    if (!body.trim()) { setPreview(null); return undefined; }
    const t = setTimeout(() => {
      api.previewNotificationMessage(body).then((r) => { if (!cancelled) setPreview(r); }).catch(() => {});
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [body]);

  const insert = (key) => setBody((b) => `${b}{${key}}`);

  const submit = async () => {
    setError(null);
    try {
      await onSubmit({ body: body.trim(), isActive });
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '620px' }}>
      <h3 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '14px', color: 'var(--sand)' }}>
        {initial ? 'تعديل الرسالة' : 'رسالة جديدة'}
      </h3>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        placeholder="مثال: يلا {student_name}! وثبة {test_name} في انتظارك 🌱 {magic_link}"
        style={{ ...field, resize: 'vertical', lineHeight: 1.8 }}
      />

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>أدرج متغيّراً:</span>
        {placeholders.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => insert(p.key)}
            style={{ border: 'none', cursor: 'pointer', padding: '5px 10px', borderRadius: '999px', background: 'var(--indigo)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '11px' }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preview && (
        preview.ok ? (
          <div style={{ background: 'var(--indigo)', borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
            <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '10px', color: 'var(--mist)' }}>معاينة</span>
            <p style={{ margin: '6px 0 0', fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>{preview.text}</p>
          </div>
        ) : (
          <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--coral)' }}>{preview.message}</p>
        )
      )}

      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)' }}>مفعّلة (تدخل في الاختيار العشوائي)</span>
      </label>

      {error && <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--coral)' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '8px' }}>
        <Button variant="primary" disabled={busy || !body.trim() || (preview && !preview.ok)} onClick={submit}>
          {busy ? 'جاري الحفظ…' : 'حفظ'}
        </Button>
        <Button variant="secondary" onClick={onCancel}>إلغاء</Button>
      </div>
    </div>
  );
}

export default function NotificationMessages() {
  const [rows, setRows] = useState([]);
  const [placeholders, setPlaceholders] = useState([]);
  const [editing, setEditing] = useState(null); // null | 'new' | row
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = () => api.listNotificationMessages().then(setRows).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    api.messagePlaceholders().then(setPlaceholders).catch(() => {});
  }, []);

  const save = async (dto) => {
    setBusy(true);
    try {
      if (editing === 'new') await api.createNotificationMessage(dto);
      else await api.updateNotificationMessage(editing.id, dto);
      setEditing(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (row) => {
    await api.updateNotificationMessage(row.id, { isActive: !row.isActive });
    await load();
  };

  const remove = async (row) => {
    if (!window.confirm('حذف هذه الرسالة نهائياً؟')) return;
    await api.deleteNotificationMessage(row.id);
    await load();
  };

  const activeCount = rows.filter((r) => r.isActive).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '16px', color: 'var(--sand)' }}>رسائل الوثبة اليومية</h2>
        {!editing && <Button variant="primary" onClick={() => setEditing('new')}>رسالة جديدة</Button>}
      </div>

      <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)', lineHeight: 1.9, maxWidth: '620px' }}>
        يُختار عند كل إرسال نصٌّ واحد عشوائياً من الرسائل المفعّلة.
        {activeCount === 0
          ? ' لا توجد رسائل مفعّلة حالياً، لذلك تُرسل الصيغة الافتراضية.'
          : ` عدد الرسائل المفعّلة: ${activeCount}.`}
      </p>

      {error && <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--coral)' }}>{error}</p>}

      {editing && (
        <MessageForm
          placeholders={placeholders}
          initial={editing === 'new' ? null : editing}
          onSubmit={save}
          onCancel={() => setEditing(null)}
          busy={busy}
        />
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>
        <thead>
          <tr style={{ color: 'var(--mist)', fontSize: '11px', textAlign: 'right' }}>
            <th style={th}>النص</th>
            <th style={th}>الحالة</th>
            <th style={th}>أُضيفت</th>
            <th style={th} />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ borderTop: '0.5px solid var(--on-indigo-line)' }}>
              <td style={{ ...td, whiteSpace: 'pre-wrap', lineHeight: 1.9, opacity: r.isActive ? 1 : 0.55 }}>{r.body}</td>
              <td style={td}>
                <span style={{ fontSize: '11px', color: r.isActive ? 'var(--teal)' : 'var(--mist)' }}>
                  {r.isActive ? 'مفعّلة' : 'متوقفة'}
                </span>
              </td>
              <td style={{ ...td, fontSize: '11px', color: 'var(--mist)' }}>{fmtDate(r.createdAt)}</td>
              <td style={td}>
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                  <Button variant="secondary" onClick={() => setEditing(r)}>تعديل</Button>
                  <Button variant="secondary" onClick={() => toggleActive(r)}>{r.isActive ? 'إيقاف' : 'تفعيل'}</Button>
                  <Button variant="secondary" onClick={() => remove(r)}>حذف</Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {rows.length === 0 && !editing && (
        <p style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>
          لا توجد رسائل مخصّصة بعد — تُرسل الصيغة الافتراضية.
        </p>
      )}
    </div>
  );
}
