import { Button } from '../design-system/components/Button';

export default function AcceptInvite({ onAccept, busy, error }) {
  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: 'var(--indigo)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '380px', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '22px', fontWeight: 500, color: 'var(--sand)' }}>دعوة متابعة طالب</h1>
        <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '14px', color: 'var(--mist)', lineHeight: 1.8 }}>
          دعاك طالب لمتابعة تقدمه على وثب. القبول يمنحك حق عرض تقرير الأداء فقط — قابل للإلغاء من الطالب في أي وقت.
        </p>
        {error && <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--coral)' }}>{error}</p>}
        <Button variant="primary" disabled={busy} onClick={onAccept}>{busy ? 'جاري القبول…' : 'قبول المتابعة'}</Button>
      </div>
    </div>
  );
}
