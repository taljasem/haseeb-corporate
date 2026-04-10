/**
 * PersistentBanner — auto-dismiss banner with hover pause and parent-controlled recall.
 *
 * Usage:
 *   <PersistentBanner open={show} onDismiss={() => setShow(false)}
 *     title="Auto-match complete" body="Matched 25 items" icon={Sparkles}
 *     variant="info" autoDismissAfterMs={15000} />
 */
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

const VARIANT_STYLES = {
  info:    { bg: "rgba(0,196,140,0.06)", border: "rgba(0,196,140,0.2)",  color: "var(--accent-primary)" },
  success: { bg: "rgba(0,196,140,0.08)", border: "rgba(0,196,140,0.3)",  color: "var(--accent-primary)" },
  warning: { bg: "rgba(245,166,35,0.08)", border: "rgba(245,166,35,0.25)", color: "var(--semantic-warning)" },
  error:   { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.25)", color: "var(--semantic-danger)" },
};

export default function PersistentBanner({
  open,
  onDismiss,
  title,
  body,
  icon: Icon,
  variant = "info",
  autoDismissAfterMs = null,
  dismissible = true,
}) {
  const timerRef = useRef(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!open || !autoDismissAfterMs || hovered) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }
    timerRef.current = setTimeout(() => {
      onDismiss && onDismiss();
    }, autoDismissAfterMs);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [open, autoDismissAfterMs, hovered, onDismiss]);

  if (!open) return null;

  const v = VARIANT_STYLES[variant] || VARIANT_STYLES.info;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        margin: "14px 28px 0",
        padding: "12px 16px",
        background: v.bg,
        border: `1px solid ${v.border}`,
        borderRadius: 8,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      {Icon && <Icon size={16} color={v.color} style={{ marginTop: 1, flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <div style={{ fontSize: 12, fontWeight: 600, color: v.color }}>{title}</div>}
        {body && <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: title ? 2 : 0, lineHeight: 1.5 }}>{typeof body === "string" ? body : body}</div>}
      </div>
      {dismissible && (
        <button
          onClick={() => onDismiss && onDismiss()}
          style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 2, flexShrink: 0 }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
