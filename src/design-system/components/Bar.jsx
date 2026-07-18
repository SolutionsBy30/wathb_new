const tones = {
  teal: "var(--teal)",
  coral: "var(--coral)",
};

/**
 * Bar — a progress track that fills from the reading-direction origin (right
 * edge in RTL). Track is a faint indigo tint; fill is teal (growth) or coral
 * (stumble).
 */
export function Bar({ value = 0, tone = "teal", height = 8, style }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      style={{
        width: "100%",
        height,
        borderRadius: "var(--radius-pill)",
        background: "var(--track-bar)",
        overflow: "hidden",
        ...style,
      }}
    >
      <div
        style={{
          height: "100%",
          width: pct + "%",
          marginInlineStart: "auto",
          borderRadius: "var(--radius-pill)",
          background: tones[tone] || tones.teal,
          transition: "width var(--duration-report-reveal) var(--ease-spring)",
        }}
      />
    </div>
  );
}
