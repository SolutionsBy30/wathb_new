const letters = ["أ", "ب", "ج", "د"];

/**
 * QuestionCard — the daily question. Options are full-width tap targets
 * (≥48px). No أ/ب/ج decoration unless the question itself needs the letters.
 */
export function QuestionCard({
  question,
  options = [],
  selected,
  onSelect,
  showLetters = false,
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
      <p
        style={{
          fontFamily: "var(--font-arabic)",
          fontSize: "var(--text-body-ar-size)",
          lineHeight: "var(--text-body-ar-leading)",
          fontWeight: "var(--weight-regular)",
          color: "var(--sand)",
          margin: 0,
        }}
      >
        {question}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
        {options.map((opt, i) => {
          const isSelected = selected === i;
          return (
            <button
              key={i}
              onClick={() => onSelect && onSelect(i)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-sm)",
                minHeight: "48px",
                width: "100%",
                textAlign: "start",
                fontFamily: "var(--font-arabic)",
                fontSize: "15px",
                fontWeight: "var(--weight-regular)",
                color: isSelected ? "var(--indigo)" : "var(--sand)",
                background: isSelected ? "var(--sand)" : "var(--on-indigo-subtle)",
                border: "none",
                borderRadius: "var(--radius-md)",
                padding: "12px var(--space-lg)",
                cursor: "pointer",
                transition:
                  "background var(--duration-micro) var(--ease-spring), color var(--duration-micro) var(--ease-spring)",
              }}
            >
              {showLetters && (
                <span style={{ fontFamily: "var(--font-latin)", color: "var(--mist)", fontSize: "13px" }}>
                  {letters[i]}
                </span>
              )}
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
