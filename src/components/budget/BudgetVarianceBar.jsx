const STATUS_COLOR = {
  under:    "#00C48C",
  "on-track": "#00C48C",
  over:     "#D4A84B",
  critical: "#FF5A5F",
};

export default function BudgetVarianceBar({ percent, status, showLabel = true, width = "100%" }) {
  const color = STATUS_COLOR[status] || "#00C48C";
  const fill = Math.min(Math.max(percent, 0), 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, width }}>
      <div
        style={{
          flex: 1,
          height: 5,
          background: "rgba(255,255,255,0.05)",
          borderRadius: 3,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${fill}%`,
            height: "100%",
            background: color,
            transition: "width 0.4s ease",
          }}
        />
      </div>
      {showLabel && (
        <span
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 12,
            fontWeight: 500,
            color,
            fontVariantNumeric: "tabular-nums",
            minWidth: 56,
            textAlign: "right",
          }}
        >
          {percent.toFixed(0)}%
        </span>
      )}
    </div>
  );
}
