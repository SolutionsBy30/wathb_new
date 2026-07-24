import { useState } from 'react';
import { Button } from '../../../design-system/components/Button';

// ONB-013 — optional, skippable prompt shown once right after goal-setup,
// before the student ever reaches Home. Inviting is never required —
// FRE-006's locked-invite gate for free-tier accounts still applies here
// too (server-enforced by SupervisorsService.invite), so a locked account
// only ever sees the skip path.
export default function InviteSupervisorPrompt({ onInvite, onSkip, busy, error, locked, onManageSubscription }) {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('+9665');
  const [type, setType] = useState('parent');

  const submit = () => {
    if (!name.trim() || !mobile.trim()) return;
    onInvite(mobile.trim(), name.trim(), type);
  };

  return (
    <>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '24px', fontWeight: 500, color: 'var(--sand)' }}>
        هل تودّ دعوة متابع؟
      </h1>
      <p style={{ margin: 0, maxWidth: '420px', fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)', lineHeight: 1.8 }}>
        يمكنك دعوة ولي أمر أو معلّم لمتابعة تقدمك أسبوعياً — هذه الخطوة اختيارية ويمكنك القيام بها لاحقاً من ملفك الشخصي.
      </p>

      {locked ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '360px' }}>
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--mist)', lineHeight: 1.8 }}>
            🔒 دعوة المتابعين متاحة في الباقات المدفوعة فقط.
          </p>
          <Button variant="secondary" onClick={onManageSubscription}>ترقية الباقة</Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '360px' }}>
          <input
            placeholder="الاسم"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--on-indigo-subtle)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}
          />
          <input
            placeholder="رقم الجوال"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--on-indigo-subtle)', color: 'var(--sand)', fontFamily: 'var(--font-latin)', fontSize: '13px' }}
          />
          <div style={{ display: 'flex', gap: '6px' }}>
            {[{ id: 'parent', label: 'ولي أمر' }, { id: 'instructor', label: 'معلّم' }].map((o) => (
              <button
                key={o.id}
                onClick={() => setType(o.id)}
                style={{
                  border: 'none', cursor: 'pointer', padding: '8px 14px', borderRadius: '999px',
                  fontFamily: 'var(--font-arabic)', fontSize: '12px',
                  background: type === o.id ? 'var(--lime)' : 'var(--on-indigo-subtle)',
                  color: type === o.id ? 'var(--lime-ink)' : 'var(--sand)',
                }}
              >
                {o.label}
              </button>
            ))}
          </div>
          {error && <p style={{ margin: 0, fontSize: '12px', color: 'var(--coral)' }}>{error}</p>}
          <Button variant="primary" disabled={busy || !name.trim() || !mobile.trim()} onClick={submit}>
            {busy ? 'جاري الإرسال…' : 'إرسال الدعوة'}
          </Button>
        </div>
      )}

      <button
        onClick={onSkip}
        style={{ border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '12px', alignSelf: 'flex-start' }}
      >
        تخطي الآن
      </button>
    </>
  );
}
