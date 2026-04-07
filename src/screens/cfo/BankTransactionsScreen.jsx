import { useEffect, useState } from "react";
import BankTransactionRow from "../../components/cfo/BankTransactionRow";
import BankTransactionDetail from "../../components/cfo/BankTransactionDetail";
import { getBankTransactionsPending } from "../../engine/mockEngine";

const FILTERS = ["All", "Today", "This week", "Suggestions", "Needs review"];

export default function BankTransactionsScreen({ onOpenAminah }) {
  const [txs, setTxs] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    getBankTransactionsPending().then((rows) => {
      setTxs(rows);
      if (rows.length > 0) setSelectedId(rows[0].id);
    });
  }, []);

  const filtered = (txs || []).filter((t) => {
    if (filter === "All") return true;
    if (filter === "Today") return t.date === "Apr 7";
    if (filter === "This week") return true;
    if (filter === "Suggestions") return t.engineSuggestion.confidence !== "NONE";
    if (filter === "Needs review") return t.engineSuggestion.confidence === "NONE";
    return true;
  });

  const selected = (txs || []).find((t) => t.id === selectedId);

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      {/* List 60% */}
      <div
        style={{
          flex: "0 0 60%",
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid rgba(255,255,255,0.10)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "20px 24px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.15em",
              color: "#5B6570",
              marginBottom: 12,
            }}
          >
            BANK TRANSACTIONS PENDING REVIEW · {txs ? txs.length : "—"}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {FILTERS.map((f) => {
              const on = f === filter;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    padding: "5px 12px",
                    borderRadius: 14,
                    background: on ? "rgba(0,196,140,0.10)" : "rgba(255,255,255,0.02)",
                    border: on ? "1px solid rgba(0,196,140,0.30)" : "1px solid rgba(255,255,255,0.10)",
                    color: on ? "#00C48C" : "#5B6570",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {f}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {filtered.map((t) => (
            <BankTransactionRow
              key={t.id}
              tx={t}
              selected={t.id === selectedId}
              onSelect={(x) => setSelectedId(x.id)}
            />
          ))}
        </div>
      </div>

      {/* Detail 40% */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <BankTransactionDetail
          tx={selected}
          onOpenAminah={(tx) => onOpenAminah && onOpenAminah(`Bank tx ${tx.id} — ${tx.merchant}`)}
        />
      </div>
    </div>
  );
}
