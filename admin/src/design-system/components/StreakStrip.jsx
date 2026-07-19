/**
 * StreakStrip — 7 day-blocks. Filled = lime (completed وثبة), empty = faint
 * indigo tint. In RTL, today is the rightmost block (array index 6 = today).
 */
export function StreakStrip({
  days = [true, true, true, false, false, false, false],
  style,
}) {
  return (
    <div style={{ display: "flex", gap: "6px", ...style }}>
      {days.map((filled, i) => (
        <div
          key={i}
          style={{
            width: "26px",
            height: "26px",
            borderRadius: "var(--radius-sm)",
            background: filled ? "var(--lime)" : "var(--on-indigo-subtle)",
            transition:
              "background var(--duration-standard) var(--ease-spring), transform var(--duration-standard) var(--ease-spring)",
          }}
        />
      ))}
    </div>
  );
}
