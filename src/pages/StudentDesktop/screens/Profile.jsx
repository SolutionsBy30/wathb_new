import { useState } from 'react';
import { Button } from '../../../design-system/components/Button';
import { api, decodeSession, getToken, setToken } from '../../../api/client';

function formatDate(d) {
  return d ? new Date(d).toLocaleDateString('ar-SA-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
}

function formatSar(halalas) {
  return `${(halalas / 100).toLocaleString('ar-SA-u-nu-latn')} ر.س`;
}

// STU-029 — mirrors STEP_UP_VALIDITY_SECONDS in api/src/auth/session.guard.ts;
// duplicated rather than shared since there's no shared-config module
// between the API and this app (same pattern as DEFAULT_BUNDLE_SIZE
// elsewhere in this codebase).
const STEP_UP_VALIDITY_MS = 10 * 60 * 1000;

const SUB_STATUS_LABEL = { active: 'نشط', pending: 'بانتظار الدفع', expired: 'منتهٍ', cancelled: 'ملغى', refunded: 'مُسترد' };
const SUB_STATUS_COLOR = { active: 'var(--teal-ink)', pending: 'var(--mist)', expired: 'var(--coral)', cancelled: 'var(--coral)', refunded: 'var(--coral)' };
const TRACK_LABEL = { scientific: 'علمي', humanities: 'أدبي' };
const DAYS = [
  { id: 0, label: 'الأحد' },
  { id: 1, label: 'الاثنين' },
  { id: 2, label: 'الثلاثاء' },
  { id: 3, label: 'الأربعاء' },
  { id: 4, label: 'الخميس' },
  { id: 5, label: 'الجمعة' },
  { id: 6, label: 'السبت' },
];

export default function Profile({ student, subscription, onManageSubscription, onSubscriptionChanged, supervisors, onInvite, onRevoke, inviteBusy, inviteError }) {
  // FRE-006 — shown locked with an upgrade prompt, not hidden, when the
  // active package doesn't allow supervisor linking. Server-enforced too
  // (SupervisorsService.invite throws 403) — this is just the honest UI.
  const inviteLocked = subscription?.package?.supervisorLinkingAllowed === false;
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('+9665');
  const [type, setType] = useState('parent');
  const [sent, setSent] = useState(false);

  const [startHour, setStartHour] = useState(student?.notifSlotStartHour ?? 18);
  const [endHour, setEndHour] = useState(student?.notifSlotEndHour ?? 20);
  // ONB-012 — skipDays was always in the schema but never actually settable
  // by anyone until now; the same day-chip toggle also seeds the onboarding
  // step (NotificationSlotSetup.jsx).
  const [skipDays, setSkipDays] = useState(new Set(student?.skipDays ?? [5]));
  const [notifBusy, setNotifBusy] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);

  const toggleSkipDay = (id) => {
    setSkipDays((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setNotifSaved(false);
      return next;
    });
  };

  const submit = async () => {
    if (!name.trim() || !mobile.trim()) return;
    await onInvite(mobile.trim(), name.trim(), type);
    setSent(true);
    setName('');
  };

  const saveNotifPrefs = async () => {
    setNotifBusy(true);
    setNotifSaved(false);
    try {
      await api.setNotificationPrefs({ notifSlotStartHour: Number(startHour), notifSlotEndHour: Number(endHour), skipDays: [...skipDays] });
      setNotifSaved(true);
    } finally {
      setNotifBusy(false);
    }
  };

  // STU-029 — step-up auth via a fresh OTP for sensitive actions (viewing
  // payment history, cancelling a subscription). pendingAction tracks which
  // one triggered the step-up modal, so the same fresh-OTP UI serves both.
  const [pendingAction, setPendingAction] = useState(null); // null | 'history' | 'cancel'
  const [stepUpCode, setStepUpCode] = useState('');
  const [stepUpBusy, setStepUpBusy] = useState(false);
  const [stepUpError, setStepUpError] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState(null);
  const [cancelDone, setCancelDone] = useState(false);

  const hasFreshStepUp = () => {
    const session = decodeSession(getToken());
    return !!session?.stepUpAt && Date.now() - session.stepUpAt <= STEP_UP_VALIDITY_MS;
  };

  const runSensitiveAction = async (action) => {
    if (action === 'history') setPaymentHistory(await api.myPaymentHistory());
    else if (action === 'cancel') {
      await api.cancelSubscription();
      setCancelDone(true);
      onSubscriptionChanged?.();
    }
  };

  const requestSensitiveAction = async (action) => {
    setStepUpError(null);
    if (hasFreshStepUp()) {
      await runSensitiveAction(action);
      return;
    }
    setPendingAction(action);
    setStepUpCode('');
    const mobile = student?.user?.mobileE164 ?? student?.mobileE164;
    if (mobile) await api.requestOtp(mobile).catch(() => {});
  };

  const submitStepUp = async () => {
    if (!pendingAction || !stepUpCode.trim()) return;
    setStepUpBusy(true);
    setStepUpError(null);
    try {
      const { token } = await api.stepUpVerify(stepUpCode.trim());
      setToken(token);
      await runSensitiveAction(pendingAction);
      setPendingAction(null);
    } catch (e) {
      setStepUpError(e.message);
    } finally {
      setStepUpBusy(false);
    }
  };

  return (
    <>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '22px', fontWeight: 500, color: 'var(--sand)' }}>ملفي</h1>

      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '360px' }}>
        <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '15px', fontWeight: 500, color: 'var(--sand)' }}>{student?.user?.name}</span>
        <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>{student?.mobileE164 ?? student?.user?.mobileE164}</span>
        <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>
          {student?.targetTest?.nameAr} · {TRACK_LABEL[student?.track] ?? '—'}
        </span>
      </div>

      <h2 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>الاشتراك</h2>
      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '360px' }}>
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
          {subscription?.status === 'active' ? 'تجديد الاشتراك الآن' : 'اشترك الآن'}
        </Button>
      </div>

      {/* STU-029 — payment history + cancellation are both behind step-up
          auth (a fresh OTP), not just the existing session. */}
      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '360px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => requestSensitiveAction('history')}>عرض سجل المدفوعات</Button>
          {subscription?.status === 'active' && !cancelDone && (
            <button
              onClick={() => requestSensitiveAction('cancel')}
              style={{ border: 'none', cursor: 'pointer', padding: '10px 16px', borderRadius: '999px', background: 'transparent', boxShadow: 'inset 0 0 0 0.5px var(--coral)', color: 'var(--coral)', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}
            >
              إلغاء الاشتراك
            </button>
          )}
        </div>
        {cancelDone && <p style={{ margin: 0, fontSize: '12px', color: 'var(--teal-ink)' }}>تم إلغاء الاشتراك.</p>}
        {paymentHistory && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {paymentHistory.length === 0 && <p style={{ margin: 0, fontSize: '12px', color: 'var(--mist)' }}>لا يوجد سجل مدفوعات بعد.</p>}
            {paymentHistory.map((s) => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', paddingBottom: '6px', borderBottom: '0.5px solid var(--on-indigo-line)' }}>
                <span style={{ fontFamily: 'var(--font-arabic)', color: 'var(--sand)' }}>{s.package?.nameAr}</span>
                <span style={{ color: SUB_STATUS_COLOR[s.status] }}>{SUB_STATUS_LABEL[s.status]}</span>
                <span style={{ fontFamily: 'var(--font-latin)', color: 'var(--mist)' }}>{formatSar(s.priceSnapshotHalalas)}</span>
                <span style={{ fontFamily: 'var(--font-latin)', color: 'var(--mist)' }}>{formatDate(s.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {pendingAction && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'var(--indigo)', borderRadius: 'var(--radius-md)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px', width: '320px', maxWidth: '90%' }}>
            <h3 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '14px', color: 'var(--sand)' }}>
              {pendingAction === 'cancel' ? 'تأكيد إلغاء الاشتراك' : 'تأكيد عرض سجل المدفوعات'}
            </h3>
            <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)', lineHeight: 1.8 }}>
              أرسلنا رمز تحقق جديداً إلى جوالك — أدخله للمتابعة.
            </p>
            <input
              dir="ltr"
              value={stepUpCode}
              onChange={(e) => setStepUpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="0000"
              style={{ padding: '12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--on-indigo-subtle)', color: 'var(--sand)', fontFamily: 'var(--font-latin)', fontSize: '18px', textAlign: 'center', letterSpacing: '4px' }}
            />
            {stepUpError && <p style={{ margin: 0, fontSize: '12px', color: 'var(--coral)' }}>{stepUpError}</p>}
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="primary" disabled={stepUpBusy || !stepUpCode.trim()} onClick={submitStepUp}>
                {stepUpBusy ? 'جاري التحقق…' : 'تأكيد'}
              </Button>
              <button
                onClick={() => setPendingAction(null)}
                style={{ border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      <h2 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>المشرف وولي الأمر</h2>
      <div className="sd-card-grid" style={{ gap: '20px' }}>
        <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h3 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>المتابعون الحاليون</h3>
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

        <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h3 style={{ margin: '0 0 4px', fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>دعوة ولي أمر أو مشرف</h3>
          {inviteLocked ? (
            <>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--mist)', lineHeight: 1.8 }}>
                🔒 دعوة المتابعين متاحة في الباقات المدفوعة فقط.
              </p>
              <Button variant="primary" onClick={onManageSubscription}>ترقية الباقة</Button>
            </>
          ) : (
            <>
              <input
                placeholder="الاسم"
                value={name}
                onChange={(e) => { setName(e.target.value); setSent(false); }}
                style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--indigo)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}
              />
              <input
                placeholder="رقم الجوال"
                value={mobile}
                onChange={(e) => { setMobile(e.target.value); setSent(false); }}
                style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--indigo)', color: 'var(--sand)', fontFamily: 'var(--font-latin)', fontSize: '13px' }}
              />
              <div style={{ display: 'flex', gap: '6px' }}>
                {[{ id: 'parent', label: 'ولي أمر' }, { id: 'instructor', label: 'معلّم' }].map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setType(o.id)}
                    style={{
                      border: 'none', cursor: 'pointer', padding: '8px 14px', borderRadius: '999px',
                      fontFamily: 'var(--font-arabic)', fontSize: '12px',
                      background: type === o.id ? 'var(--lime)' : 'var(--indigo)',
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
            </>
          )}
        </div>
      </div>

      <h2 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>إعدادات الإشعارات</h2>
      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '420px' }}>
        <div>
          <p style={{ margin: '0 0 8px', fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>نافذة إرسال الوثبة اليومية عبر واتساب</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <select value={startHour} onChange={(e) => setStartHour(e.target.value)} style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--indigo)', color: 'var(--sand)', fontFamily: 'var(--font-latin)', fontSize: '13px' }}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h}:00</option>)}
            </select>
            <span style={{ color: 'var(--mist)', fontSize: '12px' }}>إلى</span>
            <select value={endHour} onChange={(e) => setEndHour(e.target.value)} style={{ padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--indigo)', color: 'var(--sand)', fontFamily: 'var(--font-latin)', fontSize: '13px' }}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h}:00</option>)}
            </select>
          </div>
        </div>
        <div>
          <p style={{ margin: '0 0 8px', fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>إيقاف التذكير في أيام معيّنة</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {DAYS.map((d) => (
              <button
                key={d.id}
                onClick={() => toggleSkipDay(d.id)}
                style={{
                  border: 'none', cursor: 'pointer', padding: '7px 12px', borderRadius: '999px',
                  fontFamily: 'var(--font-arabic)', fontSize: '11px',
                  background: skipDays.has(d.id) ? 'var(--coral)' : 'var(--indigo)',
                  color: skipDays.has(d.id) ? 'var(--indigo)' : 'var(--sand)',
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <Button variant="primary" style={{ alignSelf: 'flex-start' }} disabled={notifBusy} onClick={saveNotifPrefs}>
          {notifBusy ? 'جاري الحفظ…' : 'حفظ'}
        </Button>
        {notifSaved && <span style={{ fontSize: '12px', color: 'var(--teal-ink)' }}>تم الحفظ.</span>}
      </div>
    </>
  );
}
