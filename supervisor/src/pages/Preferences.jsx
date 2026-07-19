import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Button } from '../design-system/components/Button';

const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export default function Preferences() {
  const [prefs, setPrefs] = useState(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api.getPreferences().then(setPrefs); }, []);

  if (!prefs) return <p style={{ fontFamily: 'var(--font-arabic)', color: 'var(--mist)' }}>جاري التحميل…</p>;

  const save = async (patch) => {
    setBusy(true);
    setSaved(false);
    try {
      const updated = await api.setPreferences(patch);
      setPrefs(updated);
      setSaved(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '20px', fontWeight: 500, color: 'var(--sand)' }}>إعدادات الإشعارات</h1>

      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '420px' }}>
        <div>
          <p style={{ margin: '0 0 8px', fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>يوم التقرير الأسبوعي</p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {DAYS.map((d, i) => (
              <button
                key={d}
                disabled={busy}
                onClick={() => save({ weeklyReportDay: i })}
                style={{
                  border: 'none', cursor: 'pointer', padding: '7px 13px', borderRadius: '999px', fontFamily: 'var(--font-arabic)', fontSize: '12px',
                  background: prefs.weeklyReportDay === i ? 'var(--lime)' : 'var(--indigo)', color: prefs.weeklyReportDay === i ? 'var(--lime-ink)' : 'var(--sand)',
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p style={{ margin: '0 0 8px', fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>الساعة</p>
          <input
            type="number" min={0} max={23} value={prefs.weeklyReportHour}
            onChange={(e) => setPrefs((p) => ({ ...p, weeklyReportHour: Number(e.target.value) }))}
            onBlur={(e) => save({ weeklyReportHour: Number(e.target.value) })}
            style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--indigo)', color: 'var(--sand)', fontFamily: 'var(--font-latin)', fontSize: '13px', width: '80px' }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>كتم التقرير الأسبوعي</span>
          <Button variant={prefs.weeklyReportMuted ? 'secondary' : 'primary'} disabled={busy} onClick={() => save({ weeklyReportMuted: !prefs.weeklyReportMuted })}>
            {prefs.weeklyReportMuted ? 'مكتوم' : 'مفعّل'}
          </Button>
        </div>

        {saved && <p style={{ margin: 0, fontSize: '12px', color: 'var(--teal-ink)' }}>تم الحفظ.</p>}
      </div>
    </div>
  );
}
