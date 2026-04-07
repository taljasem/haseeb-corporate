import EngineConfidencePill from "./EngineConfidencePill";

function fmtAmount(n) {
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
  return n < 0 ? `-${abs}` : `+${abs}`;
}

export default function BankTransactionRow({ tx, selected, onSelect }) {
  return (
    <div
      onClick={() => onSelect(tx)}
      style={{
        display: "grid",
        gridTemplateColumns: "46px 1fr auto auto",
        gap: 12,
        alignItems: "center",
        padding: "12px 14px",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        cursor: "pointer",
        background: selected ? "rgba(0,196,140,0.04)" : "transparent",
        boxShadow: selected ? "inset 3px 0 0 #00C48C" : "none",
        transition: "all 0.12s ease",
      }}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.background = "rgba(255,255,255,0.03)";
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = "transparent";
      }}
    >
      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 11,
          color: "#5B6570",
        }}
      >
        {tx.date}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            color: "#E6EDF3",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {tx.merchant}
        </div>
        <div style={{ fontSize: 11, color: "#5B6570", marginTop: 2 }}>
          {tx.engineSuggestion.account
            ? `${tx.engineSuggestion.account} (${tx.engineSuggestion.accountCode})`
            : "—"}
        </div>
      </div>
      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 13,
          fontWeight: 500,
          color: tx.amount < 0 ? "#FF5A5F" : "#00C48C",
          opacity: tx.amount < 0 ? 0.85 : 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {fmtAmount(tx.amount)}
      </div>
      <EngineConfidencePill confidence={tx.engineSuggestion.confidence} />
    </div>
  );
}
