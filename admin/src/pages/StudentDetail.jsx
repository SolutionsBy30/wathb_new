import { useEffect, useState } from 'react';
import { api } from '../api/client';

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

// ADM-052 — subscription/payment history, notification-delivery log,
// session-by-session raw answers, and device/link access log, for support
// and abuse investigation. The shared student report (ADM-051) covers
// aggregated performance; this screen is the raw operational trail behind it.
export default function StudentDetail({ studentId, onBack }) {
  const [data, setData] = useState(null);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.studentDetail(studentId).then(setData).catch((e) => setError(e.message));
    api.studentReport(studentId).then(setReport).catch(() => {}); // ADM-051 — non-fatal if not enough data yet
  }, [studentId]);

  if (error) return <p style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--coral)' }}>{error}</p>;
  if (!data) return <p style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>جاري التحميل…</p>;

  const { student, subscriptions, notifications, sessions, magicLinks } = data;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '20px', fontWeight: 500, color: 'var(--sand)' }}>{student.user.name}</h1>
          <span style={{ fontFamily: 'var(--font-latin)', fontSize: '12px', color: 'var(--mist)' }}>
            {student.user.mobileE164} · {student.school?.nameAr ?? 'بدون مدرسة'} {student.school ? `· ${student.school.city?.nameAr}` : ''}
          </span>
        </div>
        <button onClick={onBack} style={{ border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}>→ رجوع للقائمة</button>
      </div>

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
            <thead><tr style={theadRow}><th style={th}>الباقة</th><th style={th}>الحالة</th><th style={th}>المبلغ</th><th style={th}>البداية</th><th style={th}>النهاية</th><th style={th}>مرجع الدفع</th></tr></thead>
            <tbody>
              {subscriptions.map((s) => (
                <tr key={s.id} style={trBorder}>
                  <td style={td}><span style={cellSand}>{s.package?.nameAr ?? '—'}</span></td>
                  <td style={td}><span style={{ ...cellArabic, color: s.status === 'active' ? 'var(--lime)' : 'var(--mist)' }}>{SUB_STATUS_LABEL[s.status] ?? s.status}</span></td>
                  <td style={td}><span style={cellLatin}>{SAR(s.priceSnapshotHalalas)} ر.س</span></td>
                  <td style={td}><span style={cellLatin}>{fmtDate(s.startsAt)}</span></td>
                  <td style={td}><span style={cellLatin}>{fmtDate(s.endsAt)}</span></td>
                  <td style={td}><span style={cellLatin}>{s.paymentRef ?? '—'}</span></td>
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
