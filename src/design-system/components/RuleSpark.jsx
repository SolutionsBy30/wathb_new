// A thin divider with a small lime "spark" mark — used between sections on
// indigo surfaces throughout the design (Student.dc.html's RuleSpark import).
export function RuleSpark({ surface = 'dark', style }) {
  const line = surface === 'dark' ? 'var(--on-indigo-line)' : 'var(--on-sand-line)';
  return (
    <div style={{ position: 'relative', height: '4px', ...style }}>
      <div style={{ position: 'absolute', top: '1.5px', left: 0, right: 0, height: '1px', background: line }} />
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: '4px', height: '4px', borderRadius: '50%', background: 'var(--lime)' }} />
    </div>
  );
}
