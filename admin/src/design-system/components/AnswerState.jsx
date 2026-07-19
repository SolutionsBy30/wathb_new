/**
 * AnswerState — correct: lime hairline + spark, "صح." + reason. Wrong: coral
 * hairline, the correct answer shown immediately, plus one line of why.
 * Never a bare "خطأ".
 */
export function AnswerState({ status = "correct", correctAnswer, reason }) {
  const isCorrect = status === "correct";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
      <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
        <div
          style={{
            flex: 1,
            height: "var(--stroke-hairline)",
            background: isCorrect ? "var(--lime)" : "var(--coral)",
          }}
        />
        {isCorrect && (
          <div
            style={{
              width: "26px",
              height: "var(--stroke-spark)",
              background: "var(--lime)",
              marginInlineStart: "-1px",
            }}
          />
        )}
      </div>
      <p
        style={{
          margin: 0,
          fontFamily: "var(--font-arabic)",
          fontSize: "15px",
          lineHeight: "var(--text-body-ar-leading)",
          color: isCorrect ? "var(--sand)" : "var(--coral)",
          fontWeight: "var(--weight-medium)",
        }}
      >
        {isCorrect ? "صح." : `الجواب الصحيح: ${correctAnswer}.`}
      </p>
      {reason && (
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-arabic)",
            fontSize: "var(--text-label-ar-size)",
            lineHeight: "var(--text-body-ar-leading)",
            color: "var(--mist)",
          }}
        >
          {reason}
        </p>
      )}
    </div>
  );
}
