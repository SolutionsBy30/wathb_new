import { Button } from '../design-system/components/Button';

// STU-030 — a friendly landing for an expired/used/revoked magic link,
// instead of a silent drop onto login with no explanation. "Send me a
// fresh link" resolves to OTP login, which grants the same access.
export default function LinkExpired({ onGoLogin }) {
  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--indigo)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', width: '390px', maxWidth: '100%', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '19px', fontWeight: 600, color: 'var(--sand)' }}>
          انتهت صلاحية الرابط
        </h1>
        <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)', lineHeight: 1.8 }}>
          الرابط الذي فتحته لم يعد صالحاً — إما لأنه استُخدم من قبل أو انتهت صلاحيته (٢٤ ساعة). يمكنك تسجيل الدخول مباشرة برقم جوالك للمتابعة.
        </p>
        <Button variant="primary" fullWidth onClick={onGoLogin}>تسجيل الدخول برمز التحقق</Button>
      </div>
    </div>
  );
}
