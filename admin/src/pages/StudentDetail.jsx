import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { LeapHistoryTable } from '../components/LeapHistoryTable';
import { LeapDetail } from '../components/LeapDetail';

const SUB_STATUS_LABEL = { pending: 'قيد الانتظار', active: 'فعّال', expired: 'منتهٍ', cancelled: 'ملغى', refunded: 'مُسترد' };
const NOTIF_STATUS_LABEL = { scheduled: 'مجدول', sent: 'أُرسل', delivered: 'تم التسليم', read: 'قُرئ', failed: 'فشل' };
const SAR = (halalas) => (halalas / 100).toFixed(2);

function fmtDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' });
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function Stat({ label, value, color = 'var(--sand)' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <span style={{ fontSize: '11px', color: 'var(--mist)', fontFamily: 'var(--font-arabic)' }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-latin)', fontSize: '20px', fontWeight: 500, color }}>{value}</span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <h2 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '15px', fontWeight: 500, color: 'var(--sand)' }}>{title}</h2>
      {children}
    </div>
  );
}

const sendBtn = {
  border: 'none', cursor: 'pointer', padding: '8px 14px', borderRadius: '999px', background: 'transparent',
  boxShadow: 'inset 0 0 0 0.5px var(--on-indigo-line)', color: 'var(--lime)',
  fontFamily: 'var(--font-arabic)', fontSize: '12px',
};

// ADM-087 — every reason a send can decline, in the admin's language. The
// API returns a machine reason; mapping it here keeps the console honest
// about *why* nothing was sent rather than showing a bare "skipped".
const SEND_REASONS = {
  no_goal: 'الطالب لم يحدد اختباره المستهدف بعد.',
  free_tier: 'باقة الطالب الحالية لا تشمل الإشعارات اليومية — عدّلها من شاشة الباقات.',
  skip_day: 'اليوم من الأيام التي أوقف الطالب التذكير فيها.',
  bank_exhausted: 'لا توجد أسئلة كافية لتوليد وثبة اليوم — راجع تنبيهات نفاد الأقسام.',
  not_scheduled: 'أُرسلت وثبة اليوم بالفعل (أو لم تعد بحالة انتظار).',
  frequency_cap: 'بلغ الطالب الحد الأقصى للرسائل اليومية.',
  opted_out: 'الطالب أوقف الرسائل عبر واتساب (STOP).',
  suspended: 'الحساب موقوف.',
  already_completed: 'الطالب أنهى وثبة اليوم بالفعل، فلا حاجة للتذكير.',
};

function describeSendResult(r) {
  if (!r) return { ok: false, text: 'لا توجد استجابة من الخادم.' };
  if (r.sent) return { ok: true, text: 'تم الإرسال.' };
  if (r.skipped) return { ok: false, text: SEND_REASONS[r.skipped] ?? `لم يُرسل: ${r.skipped}` };
  if (r.failed) return { ok: false, text: `فشل الإرسال${r.error ? `: ${r.error}` : ''} — راجع سجل الإرسال أدناه.` };
  // sendSupervisorWeeklyReport returns per-link counts rather than a verdict.
  if (typeof r.sent === 'number' || Array.isArray(r)) return { ok: true, text: 'تم تنفيذ الإرسال — راجع السجل أدناه.' };
  return { ok: true, text: 'تم التنفيذ — راجع السجل أدناه.' };
}

// ADM-052 — subscription/payment history, notification-delivery log,
// session-by-session raw answers, and device/link access log, for support
// and abuse investigation. The shared student report (ADM-051) covers
// aggregated performance; this screen is the raw operational trail behind it.
export default function StudentDetail({ studentId, onBack }) {
  const [data, setData] = useState(null);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [leaps, setLeaps] = useState(null);
  // ADM-097 — which leap is expanded, if any.
  const [openLeapId, setOpenLeapId] = useState(null);
  const [loginLink, setLoginLink] = useState(null);
  const [linkBusy, setLinkBusy] = useState(false);

  const mintLoginLink = async () => {
    setLinkBusy(true);
    try {
      setLoginLink(await api.mintStudentLoginLink(studentId));
    } catch (e) {
      setError(e.message);
    } finally {
      setLinkBusy(false);
    }
  };

  // ADM-087 — manual sends. The result is reported rather than assumed:
  // entitlement and preference rules (free tier, skip-day, opt-out,
  // suspension, already-done) still stop a send, and an admin pressing a
  // button deserves to see which one fired instead of silence.
  const [sendBusy, setSendBusy] = useState(null); // which button is in flight
  const [sendResult, setSendResult] = useState(null);

  const runSend = async (key, fn) => {
    setSendBusy(key);
    setSendResult(null);
    try {
      setSendResult(describeSendResult(await fn()));
    } catch (e) {
      setSendResult({ ok: false, text: e.message });
    } finally {
      setSendBusy(null);
      // The delivery log below is the record of what happened; refresh it so
      // the new row is visible without a page reload.
      api.studentDetail(studentId).then(setData).catch(() => {});
    }
  };

  useEffect(() => {
    api.studentDetail(studentId).then(setData).catch((e) => setError(e.message));
    api.studentReport(studentId).then(setReport).catch(() => {}); // ADM-051 — non-fatal if not enough data yet
    api.studentLeaps(studentId).then(setLeaps).catch(() => {});
  }, [studentId]);

  if (error) return <p style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--coral)' }}>{error}</p>;
  if (!data) return <p style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>جاري التحميل…</p>;

  const { student, subscriptions, notifications, sessions, magicLinks, supervisors = [] } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '20px', fontWeight: 500, color: 'var(--sand)' }}>{student.user.name}</h1>
          <span style={{ fontFamily: 'var(--font-latin)', fontSize: '12px', color: 'var(--mist)' }}>
            {student.user.mobileE164} · {student.school?.nameAr ?? 'بدون مدرسة'} {student.school ? `· ${student.school.city?.nameAr}` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => runSend('leap', () => api.sendLeapNow(studentId))}
            disabled={sendBusy !== null}
            title="يولّد وثبة اليوم إن لم تكن جاهزة ثم يرسل رابطها للطالب عبر واتساب — تظل قواعد الباقة وتفضيلات الطالب سارية"
            style={sendBtn}
          >
            {sendBusy === 'leap' ? 'جاري الإرسال…' : 'إرسال الوثبة الآن'}
          </button>
          {/* NOT-019 — the ordinary send only acts on a day still awaiting
              delivery, so once a row is 'failed' (a provider outage) or
              'sent' it refuses. This one puts the day back in the queue
              first. Separate button, confirmed, because it will also send a
              second copy of a message that genuinely arrived. */}
          <button
            onClick={() => {
              if (!window.confirm('سيُعاد إرسال وثبة اليوم لهذا الطالب حتى لو سبق إرسالها أو فشلت. متابعة؟')) return;
              runSend('resend', () => api.sendLeapNow(studentId, true));
            }}
            disabled={sendBusy !== null}
            title="يعيد وثبة اليوم إلى الطابور ثم يرسلها — استخدمه بعد فشل الإرسال (انقطاع واتساب مثلاً)"
            style={sendBtn}
          >
            {sendBusy === 'resend' ? 'جاري الإرسال…' : 'إعادة إرسال الوثبة'}
          </button>
          <button
            onClick={() => runSend('weekly', () => api.sendStudentWeeklyReport(studentId))}
            disabled={sendBusy !== null}
            title="يرسل التقرير الأسبوعي لهذا الطالب فوراً بدل انتظار موعده"
            style={sendBtn}
          >
            {sendBusy === 'weekly' ? 'جاري الإرسال…' : 'إرسال التقرير الأسبوعي'}
          </button>
          <button
            onClick={mintLoginLink}
            disabled={linkBusy}
            title="ينشئ رابط دخول صالحاً لمدة 24 ساعة يمكن إرساله للطالب — كل إنشاء يُسجَّل في سجل التدقيق"
            style={sendBtn}
          >
            {linkBusy ? 'جاري الإنشاء…' : 'إنشاء رابط دخول'}
          </button>
          <button onClick={onBack} style={{ border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}>→ رجوع للقائمة</button>
        </div>
      </div>

      {sendResult && (
        <p
          role="status"
          style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: sendResult.ok ? 'var(--teal-ink)' : 'var(--coral)' }}
        >
          {sendResult.text}
        </p>
      )}

      {/* ADM-087 — the weekly report goes to the supervisor's own number, so
          the send is per-supervisor rather than one button on the student. */}
      {supervisors.length > 0 && (
        <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '14px 18px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>إرسال التقرير الأسبوعي للمشرف:</span>
          {supervisors.map((s) => (
            <button
              key={s.supervisorId}
              onClick={() => runSend(`sup-${s.supervisorId}`, () => api.sendSupervisorWeeklyReport(s.supervisorId))}
              disabled={sendBusy !== null}
              style={sendBtn}
            >
              {sendBusy === `sup-${s.supervisorId}` ? 'جاري الإرسال…' : s.supervisor.user.name}
            </button>
          ))}
        </div>
      )}

      {loginLink && (
        <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '14px 18px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            readOnly
            value={loginLink.url}
            dir="ltr"
            onFocus={(e) => e.target.select()}
            style={{ flex: 1, minWidth: '260px', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--indigo)', color: 'var(--sand)', fontFamily: 'var(--font-latin)', fontSize: '11px' }}
          />
          <button
            onClick={() => navigator.clipboard?.writeText(loginLink.url)}
            style={{ border: 'none', cursor: 'pointer', padding: '8px 14px', borderRadius: '999px', background: 'var(--lime)', color: 'var(--lime-ink)', fontFamily: 'var(--font-arabic)', fontSize: '12px' }}
          >
            نسخ
          </button>
          <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>صالح 24 ساعة، يُستخدم مرة واحدة.</span>
        </div>
      )}

      <Section title="سجل الوثبات">
        {leaps ? (
          <>
            <LeapHistoryTable rows={leaps} onSelect={setOpenLeapId} selectedId={openLeapId} />
            {openLeapId && <LeapDetail studentId={studentId} wathbId={openLeapId} />}
          </>
        ) : (
          <p style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>جاري التحميل…</p>
        )}
      </Section>

      {report && (
        <Section title="ملخص التقرير">
          <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap' }}>
            <Stat label="الإجمالي (مدى الحياة)" value={report.totals.lifetimeAnswered} />
            <Stat label="أسئلة فريدة" value={report.totals.uniqueQuestionsAnswered} />
            <Stat label="هذا الأسبوع" value={report.totals.weekAnswered} />
            <Stat label="السلسلة" value={report.streak.current} color="var(--lime)" />
          </div>
          {report.accuracyByArea.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {report.accuracyByArea.map((a) => (
                <div key={a.areaId} style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={cellSand}>{a.nameAr}</span>
                  <span style={{ ...cellLatin, color: a.collecting ? 'var(--mist)' : a.accuracy < 0.6 ? 'var(--coral)' : 'var(--teal-ink)' }}>
                    {a.collecting ? `قيد الجمع — ${a.nAnswered}/${a.needed}` : `${Math.round(a.accuracy * 100)}%`}
                  </span>
                </div>
              ))}
            </div>
          )}
          {report.recentMistakes.length > 0 && (
            <span style={cellMist}>{report.recentMistakes.length} خطأ حديث — التفاصيل في تقرير الطالب/المشرف الكامل.</span>
          )}
        </Section>
      )}

      <Section title={`الاشتراكات والمدفوعات (${subscriptions.length})`}>
        {subscriptions.length === 0 ? (
          <p style={{ margin: 0, ...muted }}>لا يوجد اشتراكات.</p>
        ) : (
          <table style={tableStyle}>
            <thead><tr style={theadRow}><th style={th}>الباقة</th><th style={th}>الحالة</th><th style={th}>المبلغ</th><th style={th}>البداية</th><th style={th}>النهاية</th><th style={th}>مرجع الدفع</th><th style={th}>الدافع</th></tr></thead>
            <tbody>
              {subscriptions.map((s) => (
                <tr key={s.id} style={trBorder}>
                  <td style={td}><span style={cellSand}>{s.package?.nameAr ?? '—'}</span></td>
                  <td style={td}><span style={{ ...cellArabic, color: s.status === 'active' ? 'var(--lime)' : 'var(--mist)' }}>{SUB_STATUS_LABEL[s.status] ?? s.status}</span></td>
                  <td style={td}><span style={cellLatin}>{SAR(s.priceSnapshotHalalas)} ر.س</span></td>
                  <td style={td}><span style={cellLatin}>{fmtDate(s.startsAt)}</span></td>
                  <td style={td}><span style={cellLatin}>{fmtDate(s.endsAt)}</span></td>
                  <td style={td}><span style={cellLatin}>{s.paymentRef ?? '—'}</span></td>
                  {/* SUP-008 — who actually paid, when it wasn't the student themself. */}
                  <td style={td}><span style={cellArabic}>{s.payerType === 'supervisor' ? 'مشرف' : 'الطالب'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title={`سجل الإشعارات (${notifications.length})`}>
        {notifications.length === 0 ? (
          <p style={{ margin: 0, ...muted }}>لا توجد إشعارات.</p>
        ) : (
          <table style={tableStyle}>
            <thead><tr style={theadRow}><th style={th}>النوع</th><th style={th}>القناة</th><th style={th}>الحالة</th><th style={th}>مدفوعة؟</th><th style={th}>التاريخ</th></tr></thead>
            <tbody>
              {notifications.map((n) => (
                <tr key={n.id} style={trBorder}>
                  <td style={td}><span style={cellMist}>{n.kind}</span></td>
                  <td style={td}><span style={cellSand}>{n.channel}</span></td>
                  <td style={td}><span style={{ ...cellArabic, color: n.status === 'failed' ? 'var(--coral)' : 'var(--sand)' }}>{NOTIF_STATUS_LABEL[n.status] ?? n.status}</span></td>
                  <td style={td}><span style={{ ...cellLatin, color: n.wasBillable ? 'var(--coral)' : 'var(--teal-ink)' }}>{n.wasBillable ? 'نعم' : 'لا'}</span></td>
                  <td style={td}><span style={cellLatin}>{fmtDateTime(n.sentAt ?? n.createdAt)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title={`الجلسات (وثبات) والإجابات الخام (${sessions.length})`}>
        {sessions.length === 0 ? (
          <p style={{ margin: 0, ...muted }}>لا توجد جلسات.</p>
        ) : (
          <table style={tableStyle}>
            <thead><tr style={theadRow}><th style={th}>التاريخ</th><th style={th}>الحالة</th><th style={th}>الإجابات</th><th style={th}>الصحيحة</th><th style={th}>مراجعة</th></tr></thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} style={trBorder}>
                  <td style={td}><span style={cellLatin}>{fmtDate(s.scheduledFor)}</span></td>
                  <td style={td}><span style={cellSand}>{s.status}</span></td>
                  <td style={td}><span style={cellLatin}>{s.answers.length}</span></td>
                  <td style={td}><span style={cellLatin}>{s.answers.filter((a) => a.isCorrect).length}</span></td>
                  <td style={td}><span style={cellLatin}>{s.answers.filter((a) => a.isReview).length}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title={`سجل الوصول (روابط الدخول والأجهزة) (${magicLinks.length})`}>
        {magicLinks.length === 0 ? (
          <p style={{ margin: 0, ...muted }}>لا توجد روابط.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {magicLinks.map((l) => (
              <div key={l.id} style={{ borderTop: '0.5px solid var(--on-indigo-line)', paddingTop: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                  <span style={cellSand}>{l.purpose} {l.revokedAt ? '(ملغى)' : ''}</span>
                  <span style={cellMist}>أُنشئ {fmtDateTime(l.createdAt)} · استُخدم {l.uses} مرة</span>
                </div>
                {l.accessLog.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                    {l.accessLog.map((a) => (
                      <span key={a.id} style={{ ...cellMist, fontSize: '11px' }}>
                        {fmtDateTime(a.accessedAt)} — {a.ip ?? 'IP غير معروف'} — {a.userAgent ?? 'جهاز غير معروف'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

const muted = { fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' };
const tableStyle = { width: '100%', borderCollapse: 'collapse' };
const theadRow = { textAlign: 'start', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' };
const trBorder = { borderTop: '0.5px solid var(--on-indigo-line)' };
const th = { padding: '8px 10px' };
const td = { padding: '8px 10px' };
const cellSand = { fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)' };
const cellMist = { fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' };
const cellArabic = { fontFamily: 'var(--font-arabic)', fontSize: '12px' };
const cellLatin = { fontFamily: 'var(--font-latin)', fontSize: '12px', color: 'var(--sand)' };
