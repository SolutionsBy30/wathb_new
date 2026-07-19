import { useState } from 'react';
import { Button } from '../design-system/components/Button';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('admin@wathb.dev');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onLogin(email.trim(), password);
    } catch (e) {
      setError(e.message || 'تعذّر الدخول');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--indigo)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '340px' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '22px', fontWeight: 500, color: 'var(--sand)' }}>دخول لوحة الإدارة</h1>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="البريد الإلكتروني"
          style={{ padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--on-indigo-subtle)', color: 'var(--sand)', fontFamily: 'var(--font-latin)', fontSize: '14px' }}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="كلمة المرور"
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          style={{ padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--on-indigo-subtle)', color: 'var(--sand)', fontFamily: 'var(--font-latin)', fontSize: '14px' }}
        />
        {error && <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--coral)' }}>{error}</p>}
        <Button variant="primary" disabled={busy || !email || !password} onClick={submit}>
          {busy ? 'جاري الدخول…' : 'دخول'}
        </Button>
      </div>
    </div>
  );
}
