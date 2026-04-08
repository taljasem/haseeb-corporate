// Bar denominator is YTD budget. The percent represents "% of YTD allowance consumed".
// Status colors are category-aware (revenue vs expense flips the logic).

const STATUS_COLOR = {
  // expense
  under:      "#00C48C",
  "on-track": "#00C48C",
  over:       "#D4A84B",
  critical:   "#FF5A5F",
  // revenue
  behind:     "#FF5A5F",
  ahead:      "#00C48C",
};

export default function BudgetVarianceBar({ percent, status, showLabel = true, width = "100%" }) {
  const color = STATUS_COLOR[status] || "#00C48C";
  const fill = Math.min(Math.max(percent, 0), 100);
  const overflow = percent > 100 ? Math.min(percent - 100, 30) : 0; // cap visual overflow
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, width }}>
      <div
        data-progress-bar="true"
        style={{
          flex: 1,
          height: 6,
          background: "rgba(255,255,255,0.05)",
          borderRadius: 3,
          overflow: "visible",
          position: "relative",
          display: "flex",
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            width: `${fill}%`,
            height: "100%",
            background: color,
            transition: "width 0.4s ease",
            borderRadius: overflow > 0 ? "3px 0 0 3px" : 3,
          }}
        />
        {overflow > 0 && (
          <span
            style={{
              display: "inline-block",
              width: 0,
              height: 0,
              borderTop: "4px solid transparent",
              borderBottom: "4px solid transparent",
              borderInlineStart: `6px solid ${color}`,
              alignSelf: "center",
              marginInlineStart: 2,
              filter: `drop-shadow(0 0 3px ${color}80)`,
            }}
          />
        )}
        {/* 100% target tick */}
        <span
          style={{
            position: "absolute",
            right: 0,
            top: -2,
            bottom: -2,
            width: 1,
            background: "rgba(255,255,255,0.18)",
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
            textAlign: "end",
          }}
        >
          {percent.toFixed(0)}%
        </span>
      )}
    </div>
  );
}
