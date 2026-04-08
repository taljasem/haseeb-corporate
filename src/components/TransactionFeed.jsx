import { useEffect, useState } from "react";
import { getRecentTransactions } from "../engine/mockEngine";

function fmtSigned(amount, direction) {
  const sign = direction > 0 ? "+" : "-";
  const n = Number(amount).toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
  return `${sign}${n}`;
}

export default function TransactionFeed() {
  const [txs, setTxs] = useState(null);

  useEffect(() => {
    getRecentTransactions(8).then(setTxs);
  }, []);

  return (
    <div
      style={{
        width: 300,
        flexShrink: 0,
        padding: 20,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        className="section-label"
        style={{ marginBottom: 16, animation: "fadeUp 0.4s ease 0.3s both" }}
      >
        RECENT TRANSACTIONS
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {txs
          ? txs.map((t, idx) => (
              <div
                key={t.id}
                className={`tx-row ${t.isToday ? "today" : ""}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  borderBottom:
                    idx === txs.length - 1
                      ? "none"
                      : "1px solid rgba(255,255,255,0.03)",
                }}
              >
                <div>
                  <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                    {t.merchant}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--text-tertiary)",
                      marginTop: 3,
                    }}
                  >
                    {t.timestamp}
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 15,
                    fontWeight: 500,
                    fontVariantNumeric: "tabular-nums",
                    color: t.direction > 0 ? "var(--accent-primary)" : "var(--semantic-danger)",
                    opacity: t.direction > 0 ? 1 : 0.7,
                  }}
                >
                  {fmtSigned(t.amount, t.direction)}
                </div>
              </div>
            ))
          : Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: 40,
                  margin: "6px 0",
                  background: "var(--bg-surface-sunken)",
                  borderRadius: 4,
                }}
              />
            ))}
      </div>

      <div
        style={{
          marginTop: 14,
          paddingTop: 14,
          borderTop: "1px solid rgba(255,255,255,0.10)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 11,
            color: "var(--text-tertiary)",
            letterSpacing: "0.05em",
          }}
        >
          <span style={{ cursor: "pointer" }}>VIEW ALL</span>
          <span
            style={{
              fontFamily: "'DM Mono', monospace",
              color: "var(--text-secondary)",
            }}
          >
            {txs ? `${txs.length} entries` : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}
