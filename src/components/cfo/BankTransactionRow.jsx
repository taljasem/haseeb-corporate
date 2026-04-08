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
      data-selected-indicator={selected ? "start" : undefined}
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
        if (!selected) e.currentTarget.style.background = "var(--bg-surface-sunken)";
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = "transparent";
      }}
    >
      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 11,
          color: "var(--text-tertiary)",
        }}
      >
        {tx.date}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-primary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {tx.merchant}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
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
          color: tx.amount < 0 ? "var(--semantic-danger)" : "var(--accent-primary)",
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
