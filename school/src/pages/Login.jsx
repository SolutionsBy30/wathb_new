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

/**
 * SCH-006 — school administrator login.
 *
 * No signup path, deliberately. A school administrator account is created by
 * a وثب admin who has verified that the person works at the school; letting
 * anyone self-register would make "which school do you administer?" a question
 * the applicant answers about themselves.
 */
export default function Login({ onRequestCode, onVerifyCode, error, busy }) {
  const [step, setStep] = useState('phone');
  const [local, setLocal] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [phoneError, setPhoneError] = useState(false);
  const [devCode, setDevCode] = useState(null);
  const otpRefs = [useRef(), useRef(), useRef(), useRef()];

  const mobile = `+966${local}`;

  const submitPhone = async () => {
    if (!/^5\d{8}$/.test(local)) {
      setPhoneError(true);
      return;
    }
    setPhoneError(false);
    const result = await onRequestCode(mobile);
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

  const code = otp.join('');

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--indigo)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '22px', fontWeight: 600, color: 'var(--sand)' }}>
            وثب · لوحة المدرسة
          </h1>
          <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>
            متابعة مستوى طلاب مدرستك والتخطيط للدعم قبل الاختبار.
          </span>
        </div>

        {step === 'phone' ? (
          <>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch' }}>
              <span style={{ ...fieldStyle, display: 'flex', alignItems: 'center', color: 'var(--mist)' }} dir="ltr">+966</span>
              <input
                style={{ ...fieldStyle, flex: 1 }}
                dir="ltr"
                inputMode="numeric"
                placeholder="5XXXXXXXX"
                maxLength={9}
                value={local}
                onChange={(e) => setLocal(e.target.value.replace(/\D/g, '').slice(0, 9))}
                onKeyDown={(e) => e.key === 'Enter' && submitPhone()}
              />
            </div>
            {phoneError && (
              <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--coral)' }}>
                أدخل رقم جوال سعودي صحيح يبدأ بـ ٥.
              </span>
            )}
            <Button variant="primary" fullWidth onClick={submitPhone} disabled={busy}>
              {busy ? 'جارٍ الإرسال…' : 'إرسال رمز الدخول'}
            </Button>
            <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)', lineHeight: 1.7 }}>
              حسابات لوحة المدرسة يُنشئها فريق وثب. إن لم يصلك رمز، تواصل معنا لتفعيل حسابك.
            </span>
          </>
        ) : (
          <>
            <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>
              أرسلنا رمزًا إلى <span dir="ltr" style={{ fontFamily: 'var(--font-latin)' }}>{mobile}</span>
            </span>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', direction: 'ltr' }}>
              {otp.map((d, i) => (
                <input
                  key={i}
                  ref={otpRefs[i]}
                  style={otpBoxStyle}
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs[i - 1].current?.focus();
                    if (e.key === 'Enter' && code.length === 4) onVerifyCode(mobile, code);
                  }}
                />
              ))}
            </div>
            {devCode && (
              <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>
                رمز التطوير: <span dir="ltr" style={{ fontFamily: 'var(--font-latin)' }}>{devCode}</span>
              </span>
            )}
            <Button variant="primary" fullWidth onClick={() => onVerifyCode(mobile, code)} disabled={busy || code.length < 4}>
              {busy ? 'جارٍ التحقق…' : 'دخول'}
            </Button>
            <button
              onClick={() => { setStep('phone'); setOtp(['', '', '', '']); }}
              style={{ border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '12px' }}
            >
              تغيير الرقم
            </button>
          </>
        )}

        {error && <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--coral)' }}>{error}</span>}
      </div>
    </div>
  );
}
