import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Button } from '../design-system/components/Button';

const field = {
  padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none',
  background: 'var(--indigo)', color: 'var(--sand)', fontFamily: 'var(--font-latin)', fontSize: '13px', width: '100%',
};

const STATUS = {
  connected: { label: 'متصل', color: 'var(--teal)' },
  disconnected: { label: 'غير متصل', color: 'var(--coral)' },
  unknown: { label: 'غير معروف', color: 'var(--mist)' },
};

const ROLE_LABEL = { primary: 'الرقم الأساسي', backup: 'الرقم الاحتياطي' };

function fmt(d) {
  return d ? new Date(d).toLocaleString('ar-SA-u-nu-latn', { dateStyle: 'short', timeStyle: 'short' }) : '—';
}

/**
 * NOT-023 — one sender: which provider, its credentials, and its health.
 *
 * Credentials are write-only. The API returns a masked hint, never the value,
 * so this form can set a token but can never show one — leaving the box empty
 * keeps whatever is stored.
 */
function SenderCard({ row, onSaved }) {
  const [draft, setDraft] = useState({
    provider: row.provider,
    label: row.label ?? '',
    baseUrl: row.baseUrl ?? '',
    statusPath: row.statusPath ?? '',
    phoneNumberId: row.phoneNumberId ?? '',
    apiKey: '',
    accessToken: '',
    isActive: row.isActive,
    // COM-004 — empty means uncapped / not warming, which is how every
    // existing sender behaves today.
    dailyCap: row.dailyCap ?? '',
    warmupStartedAt: row.warmupStartedAt ? String(row.warmupStartedAt).slice(0, 10) : '',
  });
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState(null);
  const [error, setError] = useState(null);

  const set = (k, v) => { setDraft((d) => ({ ...d, [k]: v })); setNote(null); };

  const save = async () => {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      await api.updateSender(row.role, {
        ...draft,
        dailyCap: draft.dailyCap === '' ? null : Number(draft.dailyCap),
        warmupStartedAt: draft.warmupStartedAt === '' ? null : draft.warmupStartedAt,
      });
      setDraft((d) => ({ ...d, apiKey: '', accessToken: '' })); // never keep a secret in component state
      setNote('تم الحفظ.');
      await onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const check = async () => {
    setChecking(true);
    setError(null);
    try {
      const res = await api.checkSender(row.role);
      setNote(res.detail);
      await onSaved();
    } catch (e) {
      setError(e.message);
    } finally {
      setChecking(false);
    }
  };

  const status = STATUS[row.status] ?? STATUS.unknown;

  return (
    <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '560px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '14px', color: 'var(--sand)' }}>
          {ROLE_LABEL[row.role] ?? row.role}
        </h3>
        <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: status.color }}>
          ● {status.label}
          {!row.configured && <span style={{ color: 'var(--coral)' }}> · بيانات ناقصة</span>}
          {!row.isActive && <span style={{ color: 'var(--mist)' }}> · معطّل</span>}
        </span>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
        <input type="checkbox" checked={draft.isActive} onChange={(e) => set('isActive', e.target.checked)} />
        <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)' }}>مُفعّل (يدخل في الإرسال)</span>
      </label>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <select value={draft.provider} onChange={(e) => set('provider', e.target.value)} style={{ ...field, width: 'auto', fontFamily: 'var(--font-arabic)' }}>
          <option value="wasender">Wasender</option>
          <option value="meta">Meta Cloud API</option>
        </select>
        <input
          value={draft.label}
          onChange={(e) => set('label', e.target.value)}
          placeholder="رقم الجوال (للعرض فقط)"
          style={{ ...field, width: 'auto', flex: 1, minWidth: '180px' }}
        />
      </div>

      {draft.provider === 'wasender' ? (
        <>
          <input
            value={draft.apiKey}
            onChange={(e) => set('apiKey', e.target.value)}
            placeholder={row.apiKeyHint ? `مفتاح API (المخزّن: ${row.apiKeyHint}) — اتركه فارغاً لإبقائه` : 'مفتاح API'}
            style={field}
            autoComplete="off"
          />
          <input value={draft.baseUrl} onChange={(e) => set('baseUrl', e.target.value)} placeholder="Base URL (اختياري)" style={field} />
          <input value={draft.statusPath} onChange={(e) => set('statusPath', e.target.value)} placeholder="مسار فحص الاتصال (افتراضي /status)" style={field} />
        </>
      ) : (
        <>
          <input
            value={draft.accessToken}
            onChange={(e) => set('accessToken', e.target.value)}
            placeholder={row.accessTokenHint ? `Access token (المخزّن: ${row.accessTokenHint}) — اتركه فارغاً لإبقائه` : 'Access token'}
            style={field}
            autoComplete="off"
          />
          <input value={draft.phoneNumberId} onChange={(e) => set('phoneNumberId', e.target.value)} placeholder="Phone number ID" style={field} />
        </>
      )}

      {/* COM-004 — the two knobs that keep a number from looking like a
          broadcaster: a ceiling, and a ramp for a freshly linked number. */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>
          الحد اليومي للرسائل (فارغ = بلا حد)
          <input
            type="number" min={1}
            value={draft.dailyCap}
            onChange={(e) => set('dailyCap', e.target.value)}
            style={{ ...field, width: '160px' }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>
          بداية التسخين (رقم جديد يتدرّج خلال ١٤ يوماً)
          <input
            type="date"
            value={draft.warmupStartedAt}
            onChange={(e) => set('warmupStartedAt', e.target.value)}
            style={{ ...field, width: '180px' }}
          />
        </label>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <Button variant="primary" disabled={busy} onClick={save}>{busy ? 'جاري الحفظ…' : 'حفظ'}</Button>
        <Button variant="secondary" disabled={checking} onClick={check}>{checking ? 'جاري الفحص…' : 'فحص الاتصال'}</Button>
      </div>

      {note && <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)' }}>{note}</p>}
      {error && <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--coral)' }}>{error}</p>}
      {row.lastError && (
        <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--coral)', lineHeight: 1.8 }}>
          آخر خطأ: {row.lastError}
        </p>
      )}
      <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>
        آخر فحص: {fmt(row.lastCheckedAt)} · آخر نجاح: {fmt(row.lastOkAt)}
      </p>
    </div>
  );
}

export default function NotificationSenders() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState(null);
  const [recovering, setRecovering] = useState(false);
  const [recovered, setRecovered] = useState(null);

  const load = () => api.listSenders().then(setRows).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const addBackup = async () => {
    await api.updateSender('backup', { provider: 'wasender', isActive: true });
    await load();
  };

  const runRecover = async () => {
    setRecovering(true);
    try {
      const res = await api.recoverMissed();
      setRecovered(
        res.skipped
          ? 'لا يوجد مزوّد صالح للإرسال حالياً.'
          : `أُعيد إلى الطابور ${res.requeued ?? 0} إشعاراً.`,
      );
    } finally {
      setRecovering(false);
    }
  };

  const hasBackup = rows.some((r) => r.role === 'backup');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h2 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '16px', color: 'var(--sand)' }}>مزوّدو واتساب</h2>
      <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)', lineHeight: 1.9, maxWidth: '560px' }}>
        يُرسل النظام عبر الرقم الأساسي، وعند تعذّره ينتقل تلقائياً إلى الاحتياطي.
        لا تُعرض المفاتيح المخزّنة أبداً — اترك الحقل فارغاً للإبقاء على المفتاح الحالي.
      </p>

      {error && <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--coral)' }}>{error}</p>}

      {rows.map((r) => <SenderCard key={r.role} row={r} onSaved={load} />)}

      {!hasBackup && (
        <Button variant="secondary" style={{ alignSelf: 'flex-start' }} onClick={addBackup}>+ إضافة رقم احتياطي</Button>
      )}

      <div style={{ borderTop: '0.5px solid var(--on-indigo-line)', paddingTop: '14px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <Button variant="secondary" disabled={recovering} onClick={runRecover}>
          {recovering ? 'جاري المعالجة…' : 'إعادة إرسال ما فات بسبب الانقطاع'}
        </Button>
        <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)', maxWidth: '420px', lineHeight: 1.8 }}>
          وثبات اليوم فقط، والتقارير الأسبوعية خلال آخر ٧ أيام. يعمل تلقائياً كل ١٥ دقيقة أيضاً.
        </span>
        {recovered && <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)' }}>{recovered}</span>}
      </div>
    </div>
  );
}
