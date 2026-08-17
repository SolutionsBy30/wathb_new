import { useState } from 'react';
import { Button } from '../../../design-system/components/Button';
import { api, decodeSession, getToken, setToken } from '../../../api/client';
import MyTests from './MyTests';
import { NOTIFICATION_SLOTS, slotById, slotIdFromHours, slotTimeRange } from '../../../lib/notification-slots';

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

// STU-026 — the invite fields borrow the login screen's shape (a fixed +966
// badge beside a 9-digit local number) so a student meets the same phone
// control in both places. The metrics stay this card's, not the login
// screen's, since these sit on --on-indigo-subtle rather than the page.
const INVITE_FIELD = {
  padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: 'none',
  background: 'var(--indigo)', color: 'var(--sand)', fontSize: '13px',
};
const DAYS = [
  { id: 0, label: 'الأحد' },
  { id: 1, label: 'الاثنين' },
  { id: 2, label: 'الثلاثاء' },
  { id: 3, label: 'الأربعاء' },
  { id: 4, label: 'الخميس' },
  { id: 5, label: 'الجمعة' },
  { id: 6, label: 'السبت' },
];

export default function Profile({ student, subscription, onManageSubscription, onSubscriptionChanged, onLogout, onTestsChanged, supervisors, onInvite, onRevoke, inviteBusy, inviteError }) {
  // FRE-006 — shown locked with an upgrade prompt, not hidden, when the
  // active package doesn't allow supervisor linking. Server-enforced too
  // (SupervisorsService.invite throws 403) — this is just the honest UI.
  const inviteLocked = subscription?.package?.supervisorLinkingAllowed === false;
  const [name, setName] = useState('');
  // Only the 9 local digits are held in state; the country code is fixed
  // furniture, so it can't be edited into something the API will reject.
  const [local, setLocal] = useState('');
  const [phoneError, setPhoneError] = useState(false);
  const [type, setType] = useState('parent');
  const [sent, setSent] = useState(false);
  const mobile = `+966${local}`;

  // ONB-012 — same named day-parts as the onboarding step, so the choice a
  // student made at signup is the choice they see here.
  const [slotId, setSlotId] = useState(() => slotIdFromHours(student?.notifSlotStartHour, student?.notifSlotEndHour));
  // ONB-012 — skipDays was always in the schema but never actually settable
  // by anyone until now; the same day-chip toggle also seeds the onboarding
  // step (NotificationSlotSetup.jsx).
  const [skipDays, setSkipDays] = useState(new Set(student?.skipDays ?? [5]));
  const [notifBusy, setNotifBusy] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);

  // NOT-012 — the email channel lives on the user record, which /students/me
  // already returns in full, so it seeds from the same payload as the rest.
  const [email, setEmail] = useState(student?.user?.notificationEmail ?? '');
  const [emailEnabled, setEmailEnabled] = useState(student?.user?.emailNotificationsEnabled ?? false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailSaved, setEmailSaved] = useState(false);
  const [emailError, setEmailError] = useState(null);

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
    if (!name.trim()) return;
    // Same rule the login screen applies: a Saudi mobile is 5 followed by 8
    // digits. Caught here rather than at the API so a typo doesn't cost a
    // round trip and an invite addressed to nobody.
    if (!/^5\d{8}$/.test(local)) {
      setPhoneError(true);
      return;
    }
    setPhoneError(false);
    await onInvite(mobile, name.trim(), type);
    setSent(true);
    setName('');
    setLocal('');
  };

  const saveNotifPrefs = async () => {
    setNotifBusy(true);
    setNotifSaved(false);
    try {
      const slot = slotById(slotId);
      await api.setNotificationPrefs({ notifSlotStartHour: slot.startHour, notifSlotEndHour: slot.endHour, skipDays: [...skipDays] });
      setNotifSaved(true);
    } finally {
      setNotifBusy(false);
    }
  };

  const saveEmailPrefs = async () => {
    setEmailBusy(true);
    setEmailSaved(false);
    setEmailError(null);
    try {
      // An empty box means "remove it" — the server clears the address and
      // switches the channel off together, so the two can't disagree.
      const trimmed = email.trim();
      const saved = await api.setEmailPrefs({
        notificationEmail: trimmed === '' ? null : trimmed,
        emailNotificationsEnabled: emailEnabled,
      });
      setEmail(saved.notificationEmail ?? '');
      setEmailEnabled(saved.emailNotificationsEnabled);
      setEmailSaved(true);
    } catch (e) {
      setEmailError(e.message);
    } finally {
      setEmailBusy(false);
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
        {(() => {
          // Renewal nagging only when it's actually relevant: an active
          // subscription shows the renew button solely inside the last 7
          // days before expiry. Inactive/absent subscriptions always get
          // the subscribe button.
          const active = subscription?.status === 'active';
          const daysLeft = active && subscription?.endsAt
            ? Math.ceil((new Date(subscription.endsAt).getTime() - Date.now()) / 86_400_000)
            : null;
          if (active && daysLeft !== null && daysLeft > 7) return null;
          return (
            <Button variant="secondary" onClick={onManageSubscription}>
              {active ? 'تجديد الاشتراك الآن' : 'اشترك الآن'}
            </Button>
          );
        })()}
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

      <h2 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>اختباراتي وأهدافي</h2>
      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '20px', maxWidth: '520px' }}>
        <MyTests onChanged={onTestsChanged} />
      </div>

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
                style={{ ...INVITE_FIELD, fontFamily: 'var(--font-arabic)' }}
              />
              <div style={{ display: 'flex', gap: '6px' }}>
                <span style={{ ...INVITE_FIELD, fontFamily: 'var(--font-latin)', display: 'flex', alignItems: 'center' }}>+966</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="5xxxxxxxx"
                  dir="ltr"
                  value={local}
                  onChange={(e) => {
                    // Non-digits are dropped as they are typed and the length
                    // is capped at 9, so the field cannot hold a number the
                    // submit rule would then reject.
                    setLocal(e.target.value.replace(/\D/g, '').slice(0, 9));
                    setSent(false);
                    setPhoneError(false);
                  }}
                  style={{ ...INVITE_FIELD, flex: 1, fontFamily: 'var(--font-latin)', textAlign: 'right' }}
                />
              </div>
              {phoneError && (
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--coral)', fontFamily: 'var(--font-arabic)' }}>
                  أدخل رقم جوال صحيح — 9 أرقام تبدأ بـ 5.
                </p>
              )}
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
              <Button variant="primary" disabled={inviteBusy || !name.trim() || local.length !== 9} onClick={submit}>
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
          <p style={{ margin: '0 0 8px', fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>وقت إرسال الوثبة اليومية عبر واتساب</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {NOTIFICATION_SLOTS.map((s) => (
              <button
                key={s.id}
                aria-pressed={slotId === s.id}
                onClick={() => { setSlotId(s.id); setNotifSaved(false); }}
                style={{
                  border: 'none', cursor: 'pointer', minHeight: '44px', padding: '7px 16px', borderRadius: '999px',
                  fontFamily: 'var(--font-arabic)', fontSize: '13px',
                  background: slotId === s.id ? 'var(--lime)' : 'var(--indigo)',
                  color: slotId === s.id ? 'var(--lime-ink)' : 'var(--sand)',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p style={{ margin: '8px 0 0', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>
            يصلك التذكير بين <span dir="ltr" style={{ fontFamily: 'var(--font-latin)' }}>{slotTimeRange(slotById(slotId))}</span>
          </p>
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

        {/* NOT-012 — email as a second channel alongside WhatsApp, never a
            replacement: the address is optional and the toggle is separate,
            so adding one doesn't silently start sending. */}
        <div style={{ borderTop: '0.5px solid var(--on-indigo-line)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>
            البريد الإلكتروني (اختياري) — لاستلام نفس التنبيهات بالبريد إضافةً إلى واتساب
          </p>
          <input
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            style={{ padding: '9px 11px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--indigo)', color: 'var(--sand)', fontFamily: 'var(--font-latin)', fontSize: '13px', textAlign: 'left' }}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={emailEnabled}
              onChange={(e) => setEmailEnabled(e.target.checked)}
            />
            تفعيل التنبيهات عبر البريد
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <Button variant="primary" style={{ alignSelf: 'flex-start' }} disabled={emailBusy} onClick={saveEmailPrefs}>
              {emailBusy ? 'جاري الحفظ…' : 'حفظ البريد'}
            </Button>
            {emailSaved && <span style={{ fontSize: '12px', color: 'var(--teal-ink)' }}>تم الحفظ.</span>}
            {emailError && <span style={{ fontSize: '12px', color: 'var(--coral)' }}>{emailError}</span>}
          </div>
        </div>
      </div>

      <button
        onClick={onLogout}
        style={{ alignSelf: 'flex-start', border: 'none', cursor: 'pointer', padding: '10px 18px', borderRadius: '999px', background: 'transparent', boxShadow: 'inset 0 0 0 0.5px var(--coral)', color: 'var(--coral)', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}
      >
        تسجيل الخروج
      </button>
    </>
  );
}
