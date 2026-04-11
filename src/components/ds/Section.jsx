/**
 * Section — enforces consistent vertical spacing between blocks.
 */
const SPACING = {
  tight: "var(--space-3)",
  normal: "var(--space-4)",
  loose: "calc(var(--space-4) * 2)",
};

export default function Section({ children, title, spacing = "normal" }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", marginBottom: SPACING[spacing] || SPACING.normal }}>
      {title && (
        <h2 style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--text-secondary)",
          opacity: 0.6,
          marginBottom: "var(--space-2)",
          margin: 0,
          marginBlockEnd: "var(--space-2)",
        }}>
          {title}
        </h2>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        {children}
      </div>
    </section>
  );
}
