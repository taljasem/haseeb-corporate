import { useEffect, useState } from "react";
import BankTransactionRow from "../../components/cfo/BankTransactionRow";
import BankTransactionDetail from "../../components/cfo/BankTransactionDetail";
import SuggestionBanner from "../../components/shared/SuggestionBanner";
import NewCategorizationRuleModal from "../../components/rules/NewCategorizationRuleModal";
import { getBankTransactionsPending, getFilteredBankTransactions, getSuggestedCategorizationRules } from "../../engine/mockEngine";

const FILTERS = ["All", "Today", "This week", "Suggestions", "Needs review"];

export default function BankTransactionsScreen({ onOpenAminah, onOpenBankAccounts, role = "CFO", filterByAssignee = null }) {
  const [txs, setTxs] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState("All");
  const [suggestion, setSuggestion] = useState(null);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catModalPrefill, setCatModalPrefill] = useState(null);

  useEffect(() => {
    const loader = filterByAssignee
      ? getFilteredBankTransactions(filterByAssignee)
      : getBankTransactionsPending();
    loader.then((rows) => {
      setTxs(rows);
      if (rows.length > 0) setSelectedId(rows[0].id);
    });
    getSuggestedCategorizationRules().then((s) => setSuggestion(s[0] || null));
  }, [filterByAssignee]);

  const filtered = (txs || []).filter((t) => {
    if (filter === "All") return true;
    if (filter === "Today") return t.date === "Apr 7";
    if (filter === "This week") return true;
    if (filter === "Suggestions") return t.engineSuggestion.confidence !== "NONE";
    if (filter === "Needs review") return t.engineSuggestion.confidence === "NONE";
    return true;
  });

  const selected = (txs || []).find((t) => t.id === selectedId);

  const handleConfirmed = (txId) => {
    setTxs((prev) => {
      if (!prev) return prev;
      const idx = prev.findIndex((t) => t.id === txId);
      const next = prev.filter((t) => t.id !== txId);
      // Auto-select next
      if (next.length > 0) {
        const newIdx = Math.min(idx, next.length - 1);
        setSelectedId(next[newIdx].id);
      } else {
        setSelectedId(null);
      }
      return next;
    });
  };

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
        {suggestion && (
          <SuggestionBanner
            suggestion={suggestion}
            onApply={(s) => {
              setCatModalPrefill({ name: `${s.merchant} auto-categorization`, merchant: s.merchant });
              setCatModalOpen(true);
            }}
            onDismiss={() => setSuggestion(null)}
          />
        )}
        <div
          style={{
            padding: "20px 24px 14px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
              gap: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.15em",
                  color: "#5B6570",
                }}
              >
                BANK TRANSACTIONS PENDING REVIEW · {txs ? txs.length : "—"}
              </div>
              {filterByAssignee && (
                <div style={{ fontSize: 11, color: "#5B6570", marginTop: 4, fontStyle: "italic" }}>
                  Showing transactions in your domain
                </div>
              )}
            </div>
            <a
              onClick={onOpenBankAccounts}
              style={{
                fontSize: 12,
                color: "#00C48C",
                cursor: "pointer",
                fontWeight: 500,
                letterSpacing: "0.02em",
              }}
            >
              View full bank accounts →
            </a>
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
          onOpenAminah={(ctx) => onOpenAminah && onOpenAminah(typeof ctx === "string" ? ctx : `Bank tx ${selected.id} — ${selected.merchant}`)}
          onConfirmed={handleConfirmed}
        />
      </div>
      <NewCategorizationRuleModal
        open={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        prefill={catModalPrefill}
        onCreated={() => setSuggestion(null)}
      />
    </div>
  );
}
