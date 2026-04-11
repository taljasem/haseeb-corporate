/**
 * MetricCard — enforces consistent metric display.
 * DM Mono 700 36px for values. No exceptions.
 */
export default function MetricCard({ label, value, subtext, trend, onClick }) {
  const trendColor = trend === "up" ? "#00A684" : trend === "down" ? "#FD361C" : "var(--text-secondary)";
  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--bg-surface-raised)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 12,
        padding: "var(--space-4)",
        boxShadow: "var(--shadow-sm)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-1)",
        cursor: onClick ? "pointer" : "default",
        transition: "background 150ms",
      }}
      onMouseEnter={onClick ? (e) => { e.currentTarget.style.background = "var(--bg-surface)"; } : undefined}
      onMouseLeave={onClick ? (e) => { e.currentTarget.style.background = "var(--bg-surface-raised)"; } : undefined}
    >
      <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--text-secondary)", opacity: 0.6 }}>
        {label}
      </div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 36, color: "var(--text-primary)", lineHeight: 1 }}>
        {value}
      </div>
      {subtext && (
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 400, color: trendColor }}>
          {subtext}
        </div>
      )}
    </div>
  );
}
