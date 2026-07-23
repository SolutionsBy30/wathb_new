import { useRef, useState } from 'react';
import { Button } from '../design-system/components/Button';

const fieldStyle = {
  padding: '14px', borderRadius: 'var(--radius-sm)', border: 'none',
  background: 'var(--on-indigo-subtle)', color: 'var(--sand)', fontFamily: 'var(--font-latin)', fontSize: '15px',
};

const otpBoxStyle = {
  width: '48px', height: '56px', textAlign: 'center', borderRadius: 'var(--radius-sm)', border: 'none',
  background: 'var(--on-indigo-subtle)', color: 'var(--sand)', fontFamily: 'var(--font-latin)', fontSize: '22px',
};

function typeBtnStyle(active) {
  return {
    flex: 1, padding: '12px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
    fontFamily: 'var(--font-arabic)', fontSize: '13px',
    background: active ? 'var(--lime)' : 'var(--on-indigo-subtle)',
    color: active ? 'var(--lime-ink)' : 'var(--sand)',
  };
}

// Mirrors Student Login.dc.html (role=supervisor variant): +966 badge + 9-digit
// local number, 4-box OTP. The fallback code when WhatsApp isn't configured
// is always 1928 — see api/src/auth/otp.service.ts.
export default function Login({ onRequestCode, onVerifyCode, onSignup, error, busy }) {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [name, setName] = useState('');
  const [type, setType] = useState('parent');
  const [local, setLocal] = useState('');
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '']);
  const [phoneError, setPhoneError] = useState(false);
  const [devCode, setDevCode] = useState(null);
  const otpRefs = [useRef(), useRef(), useRef(), useRef()];

  const mobile = `+966${local}`;

  const submitPhone = async () => {
    if (!/^5\d{8}$/.test(local) || (mode === 'signup' && (name.trim().length < 2 || !whatsappOptIn))) {
      setPhoneError(true);
      return;
    }
    setPhoneError(false);
    const result = mode === 'signup' ? await onSignup(mobile, name.trim(), type, whatsappOptIn) : await onRequestCode(mobile);
    if (result) {
      setDevCode(result.devCode ?? null);
      setStep('otp');
      setTimeout(() => otpRefs[0].current?.focus(), 0);
    }
  };

  const setDigit = (i, value) => {
    const v = value.replace(/\D/g, '').slice(-1);
    setOtp((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
    if (v && i < 3) otpRefs[i + 1].current?.focus();
  };

  const onOtpKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs[i - 1].current?.focus();
  };

  const code = otp.join('');
  const backToPhone = () => {
    setStep('phone');
    setOtp(['', '', '', '']);
  };

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--indigo)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', width: '390px', maxWidth: '100%' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '22px', fontWeight: 500, color: 'var(--sand)' }}>
          {mode === 'signup' ? 'إنشاء حساب ولي أمر / معلّم' : 'دخول ولي الأمر / المعلّم'}
        </h1>

        {step === 'phone' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
            {mode === 'signup' && (
              <>
                <label style={{ fontSize: '13px', color: 'var(--mist)', fontFamily: 'var(--font-arabic)' }}>الاسم</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسمك الكامل" style={{ ...fieldStyle, fontFamily: 'var(--font-arabic)' }} />
                <label style={{ fontSize: '13px', color: 'var(--mist)', fontFamily: 'var(--font-arabic)' }}>الصفة</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" style={typeBtnStyle(type === 'parent')} onClick={() => setType('parent')}>ولي أمر</button>
                  <button type="button" style={typeBtnStyle(type === 'instructor')} onClick={() => setType('instructor')}>معلّم</button>
                </div>
              </>
            )}
            <label style={{ fontSize: '13px', color: 'var(--mist)', fontFamily: 'var(--font-arabic)' }}>رقم الجوال</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span style={{ padding: '14px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--on-indigo-subtle)', color: 'var(--sand)', fontFamily: 'var(--font-latin)', fontSize: '14px' }}>+966</span>
              <input
                type="tel"
                value={local}
                onChange={(e) => setLocal(e.target.value.replace(/\D/g, '').slice(0, 9))}
                placeholder="5xxxxxxxx"
                dir="ltr"
                style={{ ...fieldStyle, flex: 1, textAlign: 'right' }}
              />
            </div>
            {mode === 'signup' && (
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={whatsappOptIn}
                  onChange={(e) => setWhatsappOptIn(e.target.checked)}
                  style={{ marginTop: '3px' }}
                />
                <span style={{ fontSize: '12px', color: 'var(--mist)', fontFamily: 'var(--font-arabic)', lineHeight: 1.7 }}>
                  أوافق على استلام التقارير والتنبيهات عبر واتساب.
                </span>
              </label>
            )}
            {phoneError && (
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--coral)', fontFamily: 'var(--font-arabic)' }}>
                {mode === 'signup' && !whatsappOptIn ? 'الموافقة على التواصل عبر واتساب مطلوبة للمتابعة.' : `أدخل رقم جوال صحيح${mode === 'signup' ? ' واسمك' : ''}.`}
              </p>
            )}
            {error && <p style={{ margin: 0, fontSize: '12px', color: 'var(--coral)', fontFamily: 'var(--font-arabic)' }}>{error}</p>}
            <Button variant="primary" fullWidth disabled={busy} onClick={submitPhone}>
              {busy ? 'جاري الإرسال…' : 'إرسال رمز التحقق'}
            </Button>
            <button
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setPhoneError(false); }}
              style={{ border: 'none', background: 'transparent', color: 'var(--lime-print)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}
            >
              {mode === 'login' ? 'ليس لديك حساب؟ سجّل الآن' : 'لديك حساب بالفعل؟ سجّل الدخول'}
            </button>
          </div>
        )}

        {step === 'otp' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', alignItems: 'center' }}>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--mist)', fontFamily: 'var(--font-arabic)' }}>أرسلنا رمزاً إلى ‎{mobile}</p>
            {devCode && (
              <p style={{ margin: 0, fontFamily: 'var(--font-latin)', fontSize: '13px', color: 'var(--lime)' }}>(بيئة تجريبية — الرمز: {devCode})</p>
            )}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', direction: 'ltr' }}>
              {otp.map((d, i) => (
                <input
                  key={i}
                  ref={otpRefs[i]}
                  value={d}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => onOtpKeyDown(i, e)}
                  maxLength={1}
                  inputMode="numeric"
                  style={otpBoxStyle}
                />
              ))}
            </div>
            {error && <p style={{ margin: 0, fontSize: '12px', color: 'var(--coral)', fontFamily: 'var(--font-arabic)', textAlign: 'center' }}>{error}</p>}
            <Button variant="primary" fullWidth disabled={busy || code.length !== 4} onClick={() => onVerifyCode(mobile, code)}>
              {busy ? 'جاري التحقق…' : 'تحقق ودخول'}
            </Button>
            <button onClick={backToPhone} style={{ border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '12px' }}>
              تعديل الرقم
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
