import { useEffect, useState } from 'react';
import { api } from '../api/client';

const ACTION_LABEL = {
  'user.suspend': 'تعليق مستخدم',
  'user.unsuspend': 'إلغاء تعليق مستخدم',
  'subscription.activate_wire_transfer': 'تفعيل اشتراك (حوالة بنكية)',
  'otp.fallback_used': 'استخدام رمز احتياطي',
};

function fmtDateTime(d) {
  return new Date(d).toLocaleString('ar-SA-u-nu-latn', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ADM-085 — full audit trail: actor, action, entity, before/after, timestamp.
export default function AuditLog() {
  const [entries, setEntries] = useState([]);

  useEffect(() => { api.auditLog().then(setEntries); }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '20px', fontWeight: 500, color: 'var(--sand)' }}>سجل التدقيق</h1>
      <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>
        كل إجراء إداري حساس — التعليقات، التفعيل اليدوي للاشتراكات، واستخدام الرمز الاحتياطي — مسجّل هنا بالفاعل والوقت والتغيير.
      </p>

      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'start', fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>
              <th style={th}>الوقت</th>
              <th style={th}>الفاعل</th>
              <th style={th}>الإجراء</th>
              <th style={th}>الكيان</th>
              <th style={th}>التفاصيل</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} style={{ borderTop: '0.5px solid var(--on-indigo-line)' }}>
                <td style={td}><span style={{ fontFamily: 'var(--font-latin)', fontSize: '12px', color: 'var(--mist)' }}>{fmtDateTime(e.createdAt)}</span></td>
                <td style={td}><span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)' }}>{e.actorLabel}</span></td>
                <td style={td}><span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)' }}>{ACTION_LABEL[e.action] ?? e.action}</span></td>
                <td style={td}><span style={{ fontFamily: 'var(--font-latin)', fontSize: '11px', color: 'var(--mist)' }}>{e.entityType} · {e.entityId.slice(0, 8)}</span></td>
                <td style={{ ...td, maxWidth: '320px' }}>
                  {e.note && <p style={{ margin: '0 0 4px', fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--sand)' }}>{e.note}</p>}
                  {e.before && <p style={{ margin: 0, fontFamily: 'var(--font-latin)', fontSize: '10px', color: 'var(--coral)' }}>قبل: {JSON.stringify(e.before)}</p>}
                  {e.after && <p style={{ margin: 0, fontFamily: 'var(--font-latin)', fontSize: '10px', color: 'var(--teal-ink)' }}>بعد: {JSON.stringify(e.after)}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {entries.length === 0 && <p style={{ margin: 0, padding: '20px', fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>لا توجد سجلات بعد.</p>}
      </div>
    </div>
  );
}

const th = { padding: '10px 12px' };
const td = { padding: '10px 12px', verticalAlign: 'top' };
