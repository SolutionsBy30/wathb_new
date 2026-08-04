const letters = ["أ", "ب", "ج", "د"];

/**
 * QuestionCard — the daily question. Options are full-width tap targets
 * (≥48px). No أ/ب/ج decoration unless the question itself needs the letters.
 *
 * ADM-032 — a question may carry artwork (a graph, a geometry figure, a
 * shape sequence) on the stem, on individual options, or both. Text stays
 * optional on an option that *is* a picture, so the option row still has to
 * meet the 48px target on its own.
 */
export function QuestionCard({
  question,
  questionImage,
  options = [],
  optionImages = [],
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
      {questionImage && (
        <img
          src={questionImage}
          alt=""
          style={{
            maxWidth: "100%",
            borderRadius: "var(--radius-md)",
            background: "var(--sand)",
            alignSelf: "center",
          }}
        />
      )}
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
              {optionImages[i] && (
                <img
                  src={optionImages[i]}
                  alt=""
                  style={{
                    maxHeight: "96px",
                    maxWidth: "40%",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--sand)",
                  }}
                />
              )}
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
