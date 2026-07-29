import { useEffect, useState } from 'react';
import { api } from '../api/client';

const fieldStyle = { padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--indigo)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '13px', width: '100%' };
const btnStyle = { border: 'none', cursor: 'pointer', padding: '7px 14px', borderRadius: '999px', fontFamily: 'var(--font-arabic)', fontSize: '12px' };

// The "معلومة تساعدك في وثبة اليوم" tip on the student Home — admin-curated
// here. All active tips rotate one per calendar day (same tip for everyone on
// a given day); with none active, the student app falls back to its
// generated weakest-area tip.
export default function DailyTips() {
  const [tips, setTips] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = () => api.listDailyTips().then(setTips).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (draft.trim().length < 3) return;
    setBusy(true);
    setError(null);
    try {
      await api.createDailyTip(draft.trim());
      setDraft('');
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const activeCount = tips.filter((t) => t.isActive).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '640px' }}>
      <h2 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '15px', color: 'var(--sand)' }}>نصيحة اليوم</h2>
      <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)', lineHeight: 1.8 }}>
        تظهر هذه النصائح للطلاب في الصفحة الرئيسية تحت «معلومة تساعدك في وثبة اليوم» — نصيحة واحدة لكل يوم بالتناوب على جميع النصائح المفعّلة.
        {activeCount === 0 && ' لا توجد نصائح مفعّلة حالياً، لذا يعرض التطبيق نصيحة مولّدة تلقائياً من أضعف مجال لكل طالب.'}
      </p>

      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <textarea
          rows={3}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="اكتب نصيحة جديدة…"
          style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.8 }}
        />
        {error && <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--coral)' }}>{error}</p>}
        <button onClick={add} disabled={busy || draft.trim().length < 3} style={{ ...btnStyle, alignSelf: 'flex-start', background: 'var(--lime)', color: 'var(--lime-ink)' }}>
          إضافة
        </button>
      </div>

      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column' }}>
        {tips.length === 0 && <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>لا توجد نصائح بعد.</p>}
        {tips.map((t) => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderTop: '0.5px solid var(--on-indigo-line)' }}>
            <p style={{ margin: 0, flex: 1, fontFamily: 'var(--font-arabic)', fontSize: '13px', lineHeight: 1.8, color: t.isActive ? 'var(--sand)' : 'var(--mist)', textDecoration: t.isActive ? 'none' : 'line-through' }}>
              {t.textAr}
            </p>
            <button
              onClick={async () => { await api.updateDailyTip(t.id, { isActive: !t.isActive }); load(); }}
              style={{ ...btnStyle, background: 'transparent', boxShadow: 'inset 0 0 0 0.5px var(--on-indigo-line)', color: t.isActive ? 'var(--coral)' : 'var(--teal-ink)' }}
            >
              {t.isActive ? 'تعطيل' : 'تفعيل'}
            </button>
            <button
              onClick={async () => { await api.deleteDailyTip(t.id); load(); }}
              style={{ ...btnStyle, background: 'transparent', color: 'var(--coral)' }}
            >
              حذف
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
