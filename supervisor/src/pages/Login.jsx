import { useState } from 'react';
import { Button } from '../design-system/components/Button';

const inputStyle = {
  padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: 'none',
  background: 'var(--on-indigo-subtle)', color: 'var(--sand)', fontFamily: 'var(--font-latin)', fontSize: '14px',
};

export default function Login({ onRequestCode, onVerifyCode, error, busy }) {
  const [step, setStep] = useState('mobile');
  const [mobile, setMobile] = useState('+9665');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState(null);

  const sendCode = async () => {
    const result = await onRequestCode(mobile.trim());
    if (result) {
      setDevCode(result.devCode ?? null);
      setStep('code');
    }
  };

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--indigo)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '360px' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '22px', fontWeight: 500, color: 'var(--sand)' }}>دخول ولي الأمر / المعلّم</h1>

        {step === 'mobile' && (
          <>
            <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)', lineHeight: 1.8 }}>
              أدخل رقم جوالك وسنرسل لك رمز تحقق عبر واتساب.
            </p>
            <input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+9665xxxxxxxx" style={inputStyle} />
            {error && <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--coral)' }}>{error}</p>}
            <Button variant="primary" disabled={busy || !mobile.trim()} onClick={sendCode}>
              {busy ? 'جاري الإرسال…' : 'إرسال رمز التحقق'}
            </Button>
          </>
        )}

        {step === 'code' && (
          <>
            <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)', lineHeight: 1.8 }}>
              أدخل رمز التحقق المرسل إلى {mobile}.
            </p>
            {devCode && (
              <p style={{ margin: 0, fontFamily: 'var(--font-latin)', fontSize: '13px', color: 'var(--lime)' }}>(بيئة تجريبية — الرمز: {devCode})</p>
            )}
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              inputMode="numeric"
              style={{ ...inputStyle, letterSpacing: '4px', textAlign: 'center' }}
            />
            {error && <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--coral)' }}>{error}</p>}
            <div style={{ display: 'flex', gap: '10px' }}>
              <Button variant="primary" disabled={busy || code.length !== 6} onClick={() => onVerifyCode(mobile.trim(), code)}>
                {busy ? 'جاري التحقق…' : 'تحقق ودخول'}
              </Button>
              <button
                onClick={() => { setStep('mobile'); setCode(''); }}
                style={{ border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}
              >
                تغيير الرقم
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
