import { useState } from 'react';
import { Button } from '../../../design-system/components/Button';

function formatDate(d) {
  return d ? new Date(d).toLocaleDateString('ar-SA-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
}

const SUB_STATUS_LABEL = { active: 'نشط', pending: 'بانتظار الدفع', expired: 'منتهٍ', cancelled: 'ملغى', refunded: 'مُسترد' };
const SUB_STATUS_COLOR = { active: 'var(--teal-ink)', pending: 'var(--mist)', expired: 'var(--coral)', cancelled: 'var(--coral)', refunded: 'var(--coral)' };

export default function Profile({ student, subscription, onManageSubscription, supervisors, onInvite, onRevoke, inviteBusy, inviteError }) {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('+9665');
  const [type, setType] = useState('parent');
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!name.trim() || !mobile.trim()) return;
    await onInvite(mobile.trim(), name.trim(), type);
    setSent(true);
    setName('');
  };

  return (
    <>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '22px', fontWeight: 500, color: 'var(--sand)' }}>ملفي</h1>

      <div style={{ background: 'var(--indigo)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '360px' }}>
        <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '15px', fontWeight: 500, color: 'var(--sand)' }}>{student?.user?.name}</span>
        <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>{student?.mobileE164 ?? student?.user?.mobileE164}</span>
        <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>
          {student?.targetTest?.nameAr} · {student?.track === 'scientific' ? 'علمي' : 'أدبي'}
        </span>
      </div>

      <div style={{ background: 'var(--indigo)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '360px' }}>
        <h2 style={{ margin: '0 0 4px', fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>الاشتراك</h2>
        {subscription ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--mist)' }}>الباقة</span>
              <span style={{ color: 'var(--sand)', fontFamily: 'var(--font-arabic)' }}>{subscription.package?.nameAr}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--mist)' }}>الحالة</span>
              <span style={{ color: SUB_STATUS_COLOR[subscription.status] }}>{SUB_STATUS_LABEL[subscription.status]}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
              <span style={{ color: 'var(--mist)' }}>ينتهي في</span>
              <span style={{ color: 'var(--sand)', fontFamily: 'var(--font-latin)' }}>{formatDate(subscription.endsAt)}</span>
            </div>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--mist)' }}>لا يوجد اشتراك حالياً.</p>
        )}
        <Button variant="secondary" onClick={onManageSubscription}>
          {subscription?.status === 'active' ? 'إدارة الاشتراك' : 'اشترك الآن'}
        </Button>
      </div>

      <div className="sd-grid-2" style={{ gap: '20px' }}>
        <div style={{ background: 'var(--indigo)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h2 style={{ margin: '0 0 4px', fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>دعوة ولي أمر أو مشرف</h2>
          <input
            placeholder="الاسم"
            value={name}
            onChange={(e) => { setName(e.target.value); setSent(false); }}
            style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--on-indigo-subtle)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}
          />
          <input
            placeholder="رقم الجوال"
            value={mobile}
            onChange={(e) => { setMobile(e.target.value); setSent(false); }}
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
          <Button variant="primary" disabled={inviteBusy || !name.trim() || !mobile.trim()} onClick={submit}>
            {inviteBusy ? 'جاري الإرسال…' : 'إرسال الدعوة'}
          </Button>
          {inviteError && <p style={{ margin: 0, fontSize: '12px', color: 'var(--coral)' }}>{inviteError}</p>}
          {sent && !inviteError && (
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--teal-ink)' }}>أُرسلت الدعوة. سيتمكن من متابعة تقدمك عند القبول.</p>
          )}
        </div>

        <div style={{ background: 'var(--indigo)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>المشرف وولي الأمر</h2>
          {supervisors.length === 0 && (
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--mist)' }}>لا يوجد أحد يتابع تقدمك حالياً.</p>
          )}
          {supervisors.map((sp) => (
            <div key={sp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '0.5px solid var(--on-indigo-line)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>{sp.supervisor?.user?.name}</span>
                <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>
                  {sp.supervisor?.type === 'parent' ? 'ولي أمر' : 'معلّم'} · {sp.acceptedAt ? 'مقبول' : 'بانتظار القبول'}
                </span>
              </div>
              <button onClick={() => onRevoke(sp.id)} style={{ border: 'none', background: 'transparent', color: 'var(--coral)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '12px' }}>
                إلغاء الوصول
              </button>
            </div>
          ))}
        </div>
      </div>

      <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>
        تخصيص موعد إشعار واتساب اليومي (الآن ثابت على {student?.notifSlotStartHour ?? 18}–{student?.notifSlotEndHour ?? 20}) لم يُبنَ كواجهة بعد.
      </p>
    </>
  );
}
