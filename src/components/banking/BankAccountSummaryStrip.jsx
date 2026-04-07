import { formatMoney } from "../../utils/formatCurrency";

function Stat({ label, value, color = "#E6EDF3" }) {
  return (
    <div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: "0.15em",
          color: "#5B6570",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 16,
          fontWeight: 500,
          color,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function BankAccountSummaryStrip({ summary, currency = "KWD" }) {
  if (!summary) return null;
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 32,
        padding: "14px 18px",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 8,
      }}
    >
      <Stat label="OPENING BALANCE" value={formatMoney(summary.openingBalance, currency)} />
      <Stat label="CLOSING BALANCE" value={formatMoney(summary.closingBalance, currency)} />
      <Stat label="TOTAL INFLOW"    value={`+${formatMoney(summary.totalInflow,  currency).replace(/^(KWD|USD) /, "")}`} color="#00C48C" />
      <Stat label="TOTAL OUTFLOW"   value={`-${formatMoney(summary.totalOutflow, currency).replace(/^(KWD|USD) /, "")}`} color="#FF5A5F" />
      <Stat label="TRANSACTIONS"    value={String(summary.transactionCount)} />
    </div>
  );
}
