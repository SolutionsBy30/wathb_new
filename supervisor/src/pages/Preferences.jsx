import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Button } from '../design-system/components/Button';

const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export default function Preferences() {
  const [prefs, setPrefs] = useState(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  // NOT-012 — getPreferences joins the email fields off the user record, so
  // both halves of this screen come from one fetch.
  const [email, setEmail] = useState('');
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);
  const [emailError, setEmailError] = useState(null);

  useEffect(() => {
    api.getPreferences().then((p) => {
      setPrefs(p);
      setEmail(p.notificationEmail ?? '');
      setEmailEnabled(p.emailNotificationsEnabled ?? false);
    });
  }, []);

  const saveEmail = async () => {
    setEmailBusy(true);
    setEmailSaved(false);
    setEmailError(null);
    try {
      const trimmed = email.trim();
      const savedPrefs = await api.setEmailPrefs({
        notificationEmail: trimmed === '' ? null : trimmed,
        emailNotificationsEnabled: emailEnabled,
      });
      setEmail(savedPrefs.notificationEmail ?? '');
      setEmailEnabled(savedPrefs.emailNotificationsEnabled);
      setEmailSaved(true);
    } catch (e) {
      setEmailError(e.message);
    } finally {
      setEmailBusy(false);
    }
  };

  if (!prefs) return <p style={{ fontFamily: 'var(--font-arabic)', color: 'var(--mist)' }}>جاري التحميل…</p>;

  const save = async (patch) => {
    setBusy(true);
    setSaved(false);
    try {
      const updated = await api.setPreferences(patch);
      setPrefs(updated);
      setSaved(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '20px', fontWeight: 500, color: 'var(--sand)' }}>إعدادات الإشعارات</h1>

      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '420px' }}>
        <div>
          <p style={{ margin: '0 0 8px', fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>يوم التقرير الأسبوعي</p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {DAYS.map((d, i) => (
              <button
                key={d}
                disabled={busy}
                onClick={() => save({ weeklyReportDay: i })}
                style={{
                  border: 'none', cursor: 'pointer', padding: '7px 13px', borderRadius: '999px', fontFamily: 'var(--font-arabic)', fontSize: '12px',
                  background: prefs.weeklyReportDay === i ? 'var(--lime)' : 'var(--indigo)', color: prefs.weeklyReportDay === i ? 'var(--lime-ink)' : 'var(--sand)',
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p style={{ margin: '0 0 8px', fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>الساعة</p>
          <input
            type="number" min={0} max={23} value={prefs.weeklyReportHour}
            onChange={(e) => setPrefs((p) => ({ ...p, weeklyReportHour: Number(e.target.value) }))}
            onBlur={(e) => save({ weeklyReportHour: Number(e.target.value) })}
            style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--indigo)', color: 'var(--sand)', fontFamily: 'var(--font-latin)', fontSize: '13px', width: '80px' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>كتم التقرير الأسبوعي</span>
          <Button variant={prefs.weeklyReportMuted ? 'secondary' : 'primary'} disabled={busy} onClick={() => save({ weeklyReportMuted: !prefs.weeklyReportMuted })}>
            {prefs.weeklyReportMuted ? 'مكتوم' : 'مفعّل'}
          </Button>
        </div>

        {saved && <p style={{ margin: 0, fontSize: '12px', color: 'var(--teal-ink)' }}>تم الحفظ.</p>}

        {/* NOT-012 — email as a second channel alongside WhatsApp. Saved with
            an explicit button rather than on blur like the fields above: an
            address half-typed when focus moves is worth not sending to. */}
        <div style={{ borderTop: '0.5px solid var(--on-indigo-line)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>
            البريد الإلكتروني (اختياري) — لاستلام نفس التنبيهات بالبريد إضافةً إلى واتساب
          </p>
          <input
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            style={{ padding: '9px 11px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--indigo)', color: 'var(--sand)', fontFamily: 'var(--font-latin)', fontSize: '13px', textAlign: 'left' }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)', cursor: 'pointer' }}>
            <input type="checkbox" checked={emailEnabled} onChange={(e) => setEmailEnabled(e.target.checked)} />
            تفعيل التنبيهات عبر البريد
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <Button variant="primary" disabled={emailBusy} onClick={saveEmail}>
              {emailBusy ? 'جاري الحفظ…' : 'حفظ البريد'}
            </Button>
            {emailSaved && <span style={{ fontSize: '12px', color: 'var(--teal-ink)' }}>تم الحفظ.</span>}
            {emailError && <span style={{ fontSize: '12px', color: 'var(--coral)' }}>{emailError}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
