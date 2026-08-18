/**
 * AnswerState — correct: lime hairline + spark, "صح." + reason. Wrong: coral
 * hairline, the correct answer shown immediately, plus one line of why.
 * Never a bare "خطأ".
 *
 * STU-034 — when `yourAnswer` is supplied the verdict is followed by a
 * side-by-side comparison: what the student picked against what was right.
 * By the time the review screen appears the student has answered several
 * questions and genuinely does not remember which option they chose, so
 * "الجواب الصحيح: ب" alone gives them nothing to compare against.
 *
 * With the comparison shown, the verdict line drops to a plain "خطأ" — the
 * "never a bare خطأ" rule above is about never leaving a student with a
 * failure and no answer, and the correct answer now sits directly beneath it
 * in larger type than the old inline version. Omit `yourAnswer` and the
 * original single-line behaviour is unchanged.
 */
export function AnswerState({ status = "correct", correctAnswer, yourAnswer, reason }) {
  const isCorrect = status === "correct";
  const showComparison = yourAnswer !== undefined;

  const rowLabel = {
    margin: 0,
    fontFamily: "var(--font-arabic)",
    fontSize: "11px",
    color: "var(--mist)",
  };
  const rowValue = {
    margin: 0,
    fontFamily: "var(--font-arabic)",
    fontSize: "14px",
    lineHeight: "var(--text-body-ar-leading)",
    fontWeight: "var(--weight-medium)",
  };

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
        {isCorrect ? "صح." : showComparison ? "خطأ." : `الجواب الصحيح: ${correctAnswer}.`}
      </p>

      {showComparison && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            background: "var(--on-indigo-subtle)",
            borderRadius: "var(--radius-sm)",
            padding: "12px 14px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={rowLabel}>إجابتك</span>
            {/* An unanswered question (ran out of time, or skipped) has no
                option to echo back; saying so beats an empty line the student
                would read as a rendering fault. */}
            <p style={{ ...rowValue, color: yourAnswer == null ? "var(--mist)" : isCorrect ? "var(--lime)" : "var(--coral)" }}>
              {yourAnswer == null ? "لم تجب" : yourAnswer}
            </p>
          </div>

          {/* Repeating the correct answer under a correct verdict would just
              restate the line above it, so it appears only when they differ. */}
          {!isCorrect && (
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={rowLabel}>الإجابة الصحيحة</span>
              <p style={{ ...rowValue, color: "var(--lime)" }}>{correctAnswer}</p>
            </div>
          )}
        </div>
      )}

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
