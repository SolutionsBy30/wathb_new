import { useEffect, useState } from 'react';
import { api } from '../api/client';

/**
 * NOT-023 — the red box.
 *
 * A dead WhatsApp session used to be invisible from the console: everything
 * looked normal and the first sign was a student saying nothing arrived. This
 * sits at the top of every admin screen so the state of the one channel the
 * product depends on is never something you have to go looking for.
 *
 * Silent when healthy, and silent when the check itself fails — a console that
 * cries wolf because its own request timed out teaches people to ignore it.
 */
export function IntegrationAlert() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => api.sendersHealth().then((h) => { if (!cancelled) setHealth(h); }).catch(() => {});
    load();
    // Slow poll: this is a background reassurance, not a dashboard.
    const t = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  if (!health || health.ok) return null;

  const disconnected = health.providers.filter((p) => p.status === 'disconnected');
  const misconfigured = health.providers.filter((p) => !p.configured);

  return (
    <div
      role="alert"
      style={{
        background: 'var(--coral)',
        color: 'var(--indigo)',
        borderRadius: 'var(--radius-md)',
        padding: '14px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <strong style={{ fontFamily: 'var(--font-arabic)', fontSize: '14px' }}>
        ⚠ لا يوجد مزوّد واتساب صالح للإرسال — الإشعارات متوقفة الآن
      </strong>
      <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', lineHeight: 1.9 }}>
        {disconnected.length > 0 && `جلسات غير متصلة: ${disconnected.map((p) => p.label || p.role).join('، ')}. `}
        {misconfigured.length > 0 && `بيانات ناقصة: ${misconfigured.map((p) => p.label || p.role).join('، ')}. `}
        افتح «الإشعارات ← مزوّدو واتساب» لإعادة الربط أو تحديث المفاتيح. لن تُفقد الرسائل — تبقى في الطابور وتُرسل تلقائياً بعد عودة الاتصال.
      </span>
    </div>
  );
}
