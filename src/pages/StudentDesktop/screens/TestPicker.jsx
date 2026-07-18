export default function TestPicker({ vm, backHome }) {
  return (
    <>
      <button onClick={backHome} style={{ alignSelf: 'flex-start', border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}>→ رجوع</button>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '22px', fontWeight: 500, color: 'var(--sand)' }}>اختر نوع الوثبة</h1>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {vm.testChoices.map((tc) => (
          <button
            key={tc.id}
            onClick={tc.select}
            style={{ width: '280px', textAlign: 'start', border: 'none', cursor: 'pointer', background: 'var(--indigo)', borderRadius: 'var(--radius-md)', padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}
          >
            <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '16px', fontWeight: 500, color: 'var(--sand)' }}>{tc.name}</span>
            <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>{tc.qCount} أسئلة · {tc.composite} المؤشر المركّب</span>
          </button>
        ))}
      </div>
    </>
  );
}
