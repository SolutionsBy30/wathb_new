import { useState } from 'react';
import { Button } from '../design-system/components/Button';

export default function Login({ onSubmit, error, busy }) {
  const [mobile, setMobile] = useState('+9665');

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--indigo)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '360px' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '22px', fontWeight: 500, color: 'var(--sand)' }}>دخول ولي الأمر / المعلّم</h1>
        <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)', lineHeight: 1.8 }}>
          في الإنتاج يصلك رابط عبر واتساب. هذا بديل تجريبي لنفس الخطوة.
        </p>
        <input
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          placeholder="+9665xxxxxxxx"
          style={{ padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--on-indigo-subtle)', color: 'var(--sand)', fontFamily: 'var(--font-latin)', fontSize: '14px' }}
        />
        {error && <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--coral)' }}>{error}</p>}
        <Button variant="primary" disabled={busy || !mobile.trim()} onClick={() => onSubmit(mobile.trim())}>
          {busy ? 'جاري الدخول…' : 'دخول (بديل واتساب)'}
        </Button>
      </div>
    </div>
  );
}
