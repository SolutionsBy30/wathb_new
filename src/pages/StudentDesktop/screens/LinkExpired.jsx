import { Button } from '../../../design-system/components/Button';
import markOnIndigo from '../../../design-system/assets/mark-on-indigo.svg';

// STU-030 — a friendly landing for an expired/used/revoked magic link,
// instead of a silent drop onto the generic landing page. "Send me a
// fresh link" resolves to OTP login, which grants the same access.
export default function LinkExpired({ onGoLogin, onGoLanding }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '390px', maxWidth: '100%', textAlign: 'center' }}>
      <img src={markOnIndigo} alt="وثب" style={{ width: '44px', height: '41px' }} />
      <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '19px', fontWeight: 600, color: 'var(--sand)' }}>
        انتهت صلاحية الرابط
      </h1>
      <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)', lineHeight: 1.8 }}>
        الرابط الذي فتحته لم يعد صالحاً — إما لأنه استُخدم من قبل أو انتهت صلاحيته (٢٤ ساعة). يمكنك تسجيل الدخول مباشرة برقم جوالك للمتابعة.
      </p>
      <Button variant="primary" fullWidth onClick={onGoLogin}>تسجيل الدخول برمز التحقق</Button>
      <button
        onClick={onGoLanding}
        style={{ border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '12px' }}
      >
        ← العودة للصفحة الرئيسية
      </button>
    </div>
  );
}
