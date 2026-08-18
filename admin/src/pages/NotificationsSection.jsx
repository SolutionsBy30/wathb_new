import { useState } from 'react';
import DeliveryLog from './DeliveryLog';
import NotificationMessages from './NotificationMessages';

/**
 * ADM-088 — the nav id *is* the permission key (admin-permissions.ts), so a
 * second top-level item would need a second permission, and every admin who
 * already holds "الإشعارات" would silently lose access to half of it. Both
 * screens are the same responsibility and the API gates both on
 * 'notifications', so they live behind one grant as sub-tabs instead.
 */
const TABS = [
  { id: 'log', label: 'سجل الإشعارات' },
  { id: 'messages', label: 'رسائل الوثبة اليومية' },
];

export default function NotificationsSection() {
  const [sub, setSub] = useState('log');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            aria-pressed={sub === t.id}
            style={{
              border: 'none', cursor: 'pointer', padding: '7px 14px', borderRadius: '999px',
              fontFamily: 'var(--font-arabic)', fontSize: '12px',
              background: sub === t.id ? 'var(--lime)' : 'var(--on-indigo-subtle)',
              color: sub === t.id ? 'var(--lime-ink)' : 'var(--sand)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {sub === 'log' ? <DeliveryLog /> : <NotificationMessages />}
    </div>
  );
}
