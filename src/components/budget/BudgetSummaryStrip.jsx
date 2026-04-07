import { formatKWD } from "../../utils/format";

function Stat({ label, value, sub, accent = false, varianceColor = null }) {
  return (
    <div
      style={{
        flex: "1 1 240px",
        minWidth: 240,
        padding: "16px 18px",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10,
      }}
    >
      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 22,
          fontWeight: 500,
          color: varianceColor || (accent ? "#00C48C" : "#E6EDF3"),
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.12em",
          color: "#5B6570",
          marginTop: 6,
        }}
      >
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: "#8B98A5", marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export default function BudgetSummaryStrip({ summary, varianceTotal = null }) {
  if (!summary) return null;
  const varianceColor =
    varianceTotal == null
      ? null
      : varianceTotal > 0
        ? "#FF5A5F"
        : "#00C48C";
  const varianceLabel =
    varianceTotal == null
      ? "—"
      : (varianceTotal > 0 ? "+" : "") + formatKWD(varianceTotal).replace("KWD ", "");
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
      <Stat label="TOTAL REVENUE BUDGET" value={formatKWD(summary.totalRevenue)} sub={summary.label} />
      <Stat
        label="TOTAL EXPENSE BUDGET"
        value={formatKWD(summary.totalExpenses)}
        sub={`across ${summary.expenseDepartmentCount} departments`}
      />
      <Stat
        label="PROJECTED NET INCOME"
        value={formatKWD(summary.netIncome)}
        sub={`${summary.margin}% margin`}
        accent
      />
      <Stat
        label="YTD VARIANCE"
        value={varianceLabel === "—" ? "—" : `KWD ${varianceLabel}`}
        sub="vs YTD budget"
        varianceColor={varianceColor}
      />
    </div>
  );
}
