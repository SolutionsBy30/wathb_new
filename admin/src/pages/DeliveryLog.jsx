import { useEffect, useState } from 'react';
import { api } from '../api/client';

const STATUS_COLOR = { scheduled: 'var(--mist)', sent: 'var(--lime)', delivered: 'var(--teal-ink)', read: 'var(--teal-ink)', failed: 'var(--coral)' };
const STATUS_LABEL = { scheduled: 'مجدول', sent: 'أُرسل', delivered: 'تم التسليم', read: 'قُرئ', failed: 'فشل' };
const CHANNEL_LABEL = { whatsapp_template: 'قالب (مدفوع محتمل)', whatsapp_freeform: 'رسالة مفتوحة (مجاني)', console: 'وحدة تحكم (تجريبي)' };

function todayPlusOne() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function DeliveryLog() {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const load = () => api.deliveryLog().then(setRows);
  useEffect(() => { load(); }, []);

  const runPlanDay = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await api.planDayAll();
      setMessage(`تم التخطيط لـ ${res.length} طالب (${res.filter((r) => r.planned).length} مجدول فعلياً).`);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const runSendDue = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await api.sendDueAll(todayPlusOne());
      const sent = res.filter((r) => r.sent).length;
      setMessage(`تم إرسال ${sent} من ${res.length}.`);
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '20px', fontWeight: 500, color: 'var(--sand)' }}>سجل الإشعارات</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={runPlanDay} disabled={busy} style={btnStyle}>تشغيل plan_day (غداً)</button>
          <button onClick={runSendDue} disabled={busy} style={btnStyle}>تشغيل send_notification (غداً)</button>
        </div>
      </div>
      <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>
        هذان الزران بديل يدوي عن الجدولة الليلية الحقيقية (BullMQ cron) — لا توجد ساعة تشغيل حقيقية في هذه البيئة التجريبية.
        بدون بيانات اعتماد واتساب حقيقية، الإرسال يُسجَّل في الطرفية فقط (ConsoleChannel).
      </p>
      {message && <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--teal-ink)' }}>{message}</p>}

      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'start', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>
              <th style={th}>الطالب</th>
              <th style={th}>النوع</th>
              <th style={th}>القناة</th>
              <th style={th}>الحالة</th>
              <th style={th}>مدفوعة؟</th>
              <th style={th}>التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((n) => (
              <tr key={n.id} style={{ borderTop: '0.5px solid var(--on-indigo-line)' }}>
                <td style={td}><span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>{n.user?.name}</span></td>
                <td style={td}><span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>{n.kind}</span></td>
                <td style={td}><span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)' }}>{CHANNEL_LABEL[n.channel] ?? n.channel}</span></td>
                <td style={td}><span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: STATUS_COLOR[n.status] }}>{STATUS_LABEL[n.status] ?? n.status}</span></td>
                <td style={td}><span style={{ fontFamily: 'var(--font-latin)', fontSize: '12px', color: n.wasBillable ? 'var(--coral)' : 'var(--teal-ink)' }}>{n.wasBillable ? 'نعم' : 'لا'}</span></td>
                <td style={td}><span style={{ fontFamily: 'var(--font-latin)', fontSize: '11px', color: 'var(--mist)' }}>{new Date(n.scheduledFor).toISOString().slice(0, 10)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p style={{ margin: 0, padding: '20px', fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>لا توجد إشعارات بعد.</p>
        )}
      </div>
    </div>
  );
}

const btnStyle = { border: 'none', background: 'var(--on-indigo-subtle)', color: 'var(--sand)', borderRadius: 'var(--radius-sm)', padding: '9px 14px', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '12px' };
const th = { padding: '10px 12px' };
const td = { padding: '10px 12px' };
