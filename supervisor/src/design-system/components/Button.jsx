const base = {
  fontFamily: "var(--font-arabic)",
  fontWeight: "var(--weight-medium)",
  fontSize: "15px",
  lineHeight: 1,
  border: "none",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--space-sm)",
  padding: "14px 24px",
  borderRadius: "var(--radius-pill)",
  transition:
    "transform var(--duration-micro) var(--ease-spring), opacity var(--duration-micro) var(--ease-spring)",
};

const variants = {
  primary: {
    background: "var(--lime)",
    color: "var(--lime-ink)",
  },
  secondary: {
    background: "transparent",
    color: "var(--sand)",
    boxShadow: "inset 0 0 0 var(--stroke-hairline) var(--on-indigo-line)",
  },
  ghost: {
    background: "transparent",
    color: "var(--mist)",
    padding: "14px 12px",
  },
};

/**
 * Button — one primary per screen, always. Primary is the only place lime
 * appears as a fill. Secondary is a hairline on indigo; ghost is text-only.
 */
export function Button({
  variant = "primary",
  disabled = false,
  children,
  icon,
  style,
  fullWidth,
  ...rest
}) {
  const v = variants[variant] || variants.primary;
  return (
    <button
      {...rest}
      disabled={disabled}
      style={{
        ...base,
        ...v,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        width: fullWidth ? "100%" : undefined,
        ...style,
      }}
      onMouseDown={(e) => {
        if (!disabled) e.currentTarget.style.transform = "scale(0.97)";
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      {icon}
      {children}
    </button>
  );
}
