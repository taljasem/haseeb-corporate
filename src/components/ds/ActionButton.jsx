/**
 * ActionButton — consistent button hierarchy.
 *
 * Usage:
 *   import { CheckSquare } from "lucide-react";
 *   <ActionButton variant="secondary" icon={CheckSquare} label="Select multiple" onClick={fn} />
 *
 * Variants: primary (solid accent), secondary (outlined), tertiary (text-only)
 * Sizes: sm (11px), md (13px), lg (15px)
 */

const SIZES = {
  sm: { font: 11, px: 10, py: 6, icon: 13, gap: 5 },
  md: { font: 12, px: 14, py: 8, icon: 15, gap: 6 },
  lg: { font: 14, px: 18, py: 10, icon: 17, gap: 7 },
};

const VARIANTS = {
  primary: {
    background: "var(--accent-primary)",
    color: "#fff",
    border: "none",
    hoverBg: "var(--accent-primary)",
    hoverOpacity: 0.9,
  },
  secondary: {
    background: "transparent",
    color: "var(--text-primary)",
    border: "1px solid var(--border-strong)",
    hoverBg: "var(--border-subtle)",
  },
  tertiary: {
    background: "transparent",
    color: "var(--text-secondary)",
    border: "none",
    hoverBg: "transparent",
    hoverDecoration: "underline",
  },
};

export default function ActionButton({
  variant = "secondary",
  icon: Icon,
  label,
  onClick,
  disabled = false,
  size = "md",
  title,
  className,
}) {
  const s = SIZES[size] || SIZES.md;
  const v = VARIANTS[variant] || VARIANTS.secondary;

  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      title={title}
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: s.gap,
        fontSize: s.font,
        fontWeight: 600,
        fontFamily: "inherit",
        padding: `${s.py}px ${s.px}px`,
        borderRadius: 6,
        background: v.background,
        color: v.color,
        border: v.border,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: "all 0.15s",
        outline: "none",
        letterSpacing: "0.02em",
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        if (v.hoverBg) e.currentTarget.style.background = v.hoverBg;
        if (v.hoverOpacity) e.currentTarget.style.opacity = String(v.hoverOpacity);
        if (v.hoverDecoration) e.currentTarget.style.textDecoration = v.hoverDecoration;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = v.background;
        e.currentTarget.style.opacity = disabled ? "0.4" : "1";
        e.currentTarget.style.textDecoration = "none";
      }}
      onFocus={(e) => { e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-primary)"; }}
      onBlur={(e) => { e.currentTarget.style.boxShadow = "none"; }}
    >
      {Icon && <Icon size={s.icon} />}
      {label}
    </button>
  );
}
