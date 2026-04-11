/**
 * ListItem — enforces consistent list row styling.
 */
export default function ListItem({ children, onClick, active, disabled }) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        display: "flex",
        alignItems: "center",
        paddingTop: "var(--space-2)",
        paddingBottom: "var(--space-2)",
        paddingLeft: "var(--space-3)",
        paddingRight: "var(--space-3)",
        borderBottom: "1px solid var(--border-subtle)",
        transition: "background 150ms",
        background: active ? "var(--bg-surface)" : "transparent",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : onClick ? "pointer" : "default",
      }}
      onMouseEnter={onClick && !disabled ? (e) => { if (!active) e.currentTarget.style.background = "var(--bg-surface)"; } : undefined}
      onMouseLeave={onClick && !disabled ? (e) => { if (!active) e.currentTarget.style.background = "transparent"; } : undefined}
    >
      {children}
    </div>
  );
}
