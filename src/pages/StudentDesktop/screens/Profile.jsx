import { Button } from '../../../design-system/components/Button';

export default function Profile({
  vm,
  renewSubscription,
  setInviteName,
  setInvitePhone,
  sendInvite,
  setDailyWathbTime,
  setWeeklyReportTime,
  saveSettings,
}) {
  return (
    <>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '22px', fontWeight: 500, color: 'var(--sand)' }}>ملفي</h1>

      <div className="sd-grid-2" style={{ gap: '20px' }}>
        <div style={{ background: 'var(--indigo)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h2 style={{ margin: '0 0 4px', fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>الاشتراك</h2>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: 'var(--mist)' }}>الباقة</span><span style={{ color: 'var(--sand)' }}>{vm.subPackage}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: 'var(--mist)' }}>السعر</span><span style={{ color: 'var(--sand)', fontFamily: 'var(--font-latin)' }}>{vm.subPrice} ريال</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: 'var(--mist)' }}>التجديد</span><span style={{ color: 'var(--sand)', fontFamily: 'var(--font-latin)' }}>{vm.subRenewsOn}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: 'var(--mist)' }}>الحالة</span><span style={{ color: 'var(--teal-ink)' }}>{vm.subStatus}</span>
          </div>
          {vm.subRenewed && (
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--teal-ink)' }}>تم تجديد الاشتراك بنجاح.</p>
          )}
          <Button variant="secondary" onClick={renewSubscription} style={vm.noWrapStyle}>تجديد الاشتراك الآن</Button>
        </div>

        <div style={{ background: 'var(--indigo)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>تفعيل الاختبارات</h2>
          {vm.testEnableRows.map((te) => (
            <div key={te.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>{te.name}</span>
              <button onClick={te.toggle} style={te.toggleStyle}><div style={te.knobStyle} /></button>
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--indigo)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h2 style={{ margin: '0 0 4px', fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>دعوة ولي أمر أو مشرف</h2>
          <input
            placeholder="الاسم"
            value={vm.inviteName}
            onChange={setInviteName}
            style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--on-indigo-subtle)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}
          />
          <input
            placeholder="رقم الجوال"
            value={vm.invitePhone}
            onChange={setInvitePhone}
            style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--on-indigo-subtle)', color: 'var(--sand)', fontFamily: 'var(--font-latin)', fontSize: '13px' }}
          />
          <Button variant="primary" onClick={sendInvite}>إرسال الدعوة</Button>
          {vm.inviteSent && (
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--teal-ink)' }}>أُرسلت الدعوة. سيتمكن من متابعة تقدمك عند القبول.</p>
          )}
        </div>
      </div>

      <div style={{ background: 'var(--indigo)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>المشرف وولي الأمر</h2>
        {vm.noLinkedSupervisors && (
          <p style={{ margin: 0, fontSize: '12px', color: 'var(--mist)' }}>لا يوجد أحد يتابع تقدمك حالياً.</p>
        )}
        {vm.linkedSupervisorRows.map((sp) => (
          <div key={sp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '0.5px solid var(--on-indigo-line)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>{sp.name}</span>
              <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--mist)' }}>{sp.type} · منذ {sp.linkedOn}</span>
            </div>
            <button onClick={sp.revoke} style={{ border: 'none', background: 'transparent', color: 'var(--coral)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '12px' }}>إلغاء الوصول</button>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--indigo)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>إعدادات الإشعارات</h2>
        <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--mist)', marginBottom: '8px' }}>وقت إرسال الوثبة اليومية</div>
            <input
              type="time"
              value={vm.dailyWathbTime}
              onChange={setDailyWathbTime}
              style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--on-indigo-subtle)', color: 'var(--sand)', fontFamily: 'var(--font-latin)', fontSize: '13px' }}
            />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--mist)', marginBottom: '8px' }}>وقت التقرير الأسبوعي</div>
            <input
              type="time"
              value={vm.weeklyReportTime}
              onChange={setWeeklyReportTime}
              style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--on-indigo-subtle)', color: 'var(--sand)', fontFamily: 'var(--font-latin)', fontSize: '13px' }}
            />
          </div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: 'var(--mist)', marginBottom: '8px' }}>يوم التقرير الأسبوعي</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {vm.weeklyReportDayOptions.map((dopt) => (
              <button key={dopt.name} onClick={dopt.select} style={dopt.style}>{dopt.name}</button>
            ))}
          </div>
        </div>
        <Button variant="primary" onClick={saveSettings}>حفظ</Button>
        {vm.settingsSaved && (
          <span style={{ fontSize: '12px', color: 'var(--teal-ink)' }}>تم الحفظ.</span>
        )}
      </div>
    </>
  );
}
