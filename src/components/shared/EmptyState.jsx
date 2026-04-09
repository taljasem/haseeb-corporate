/**
 * EmptyState — shown when a list/grid has no items.
 * Props:
 *   icon          – optional Lucide icon component
 *   title         – short heading (string)
 *   description   – one-sentence helper (string, optional)
 *   action        – optional ReactNode rendered below the description
 */
export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div
      role="status"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "48px 24px",
        gap: 12,
      }}
    >
      {Icon && (
        <Icon
          size={48}
          strokeWidth={1.6}
          color="var(--text-tertiary)"
          aria-hidden="true"
        />
      )}
      <div
        style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 16,
          fontWeight: 500,
          color: "var(--text-primary)",
          lineHeight: 1.4,
        }}
      >
        {title}
      </div>
      {description && (
        <div
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 14,
            color: "var(--text-secondary)",
            lineHeight: 1.5,
            maxWidth: 320,
          }}
        >
          {description}
        </div>
      )}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}
