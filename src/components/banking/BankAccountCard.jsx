import { formatMoney } from "../../utils/formatCurrency";
import { formatRelativeTime } from "../../utils/relativeTime";

export default function BankAccountCard({ account, selected = false, onSelect }) {
  if (!account) return null;
  const bankAbbr = account.bankName;

  return (
    <div
      onClick={() => onSelect && onSelect(account)}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.background = "rgba(255,255,255,0.06)";
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
      }}
      style={{
        flex: "1 1 260px",
        minWidth: 260,
        padding: 20,
        background: "rgba(255,255,255,0.04)",
        border: selected ? "1px solid #00C48C" : "1px solid rgba(255,255,255,0.10)",
        borderLeft: `3px solid ${account.accentColor}`,
        borderRadius: 10,
        cursor: "pointer",
        boxShadow: selected ? "0 0 24px rgba(0,196,140,0.15)" : "none",
        transition: "all 0.15s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 5,
            background: `${account.accentColor}22`,
            border: `1px solid ${account.accentColor}55`,
            color: account.accentColor,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.04em",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {bankAbbr}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              color: "#E6EDF3",
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {account.accountName}
          </div>
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              color: "#5B6570",
              marginTop: 2,
            }}
          >
            {account.accountNumberMasked}
          </div>
        </div>
      </div>

      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 24,
          color: "#E6EDF3",
          fontWeight: 500,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.1,
        }}
      >
        {formatMoney(account.currentBalance, account.currency)}
      </div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: "0.15em",
          color: "#5B6570",
          marginTop: 3,
        }}
      >
        CURRENT BALANCE
      </div>

      <div
        style={{
          display: "flex",
          gap: 16,
          marginTop: 14,
          paddingTop: 12,
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.12em", color: "#5B6570" }}>
            MTD INFLOW
          </div>
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 12,
              color: "#00C48C",
              marginTop: 2,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            +{Number(account.mtdInflow).toLocaleString("en-US", { minimumFractionDigits: account.currency === "USD" ? 2 : 3, maximumFractionDigits: account.currency === "USD" ? 2 : 3 })}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.12em", color: "#5B6570" }}>
            MTD OUTFLOW
          </div>
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 12,
              color: "#FF5A5F",
              opacity: 0.85,
              marginTop: 2,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            -{Number(account.mtdOutflow).toLocaleString("en-US", { minimumFractionDigits: account.currency === "USD" ? 2 : 3, maximumFractionDigits: account.currency === "USD" ? 2 : 3 })}
          </div>
        </div>
      </div>

      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 10,
          color: "#5B6570",
          marginTop: 10,
        }}
      >
        Updated {formatRelativeTime(account.lastUpdated)}
      </div>
    </div>
  );
}
