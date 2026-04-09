import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Receipt } from "lucide-react";
import BankTransactionRow from "../../components/cfo/BankTransactionRow";
import EmptyState from "../../components/shared/EmptyState";
import BankTransactionDetail from "../../components/cfo/BankTransactionDetail";
import SuggestionBanner from "../../components/shared/SuggestionBanner";
import NewCategorizationRuleModal from "../../components/rules/NewCategorizationRuleModal";
import { getBankTransactionsPending, getFilteredBankTransactions, getSuggestedCategorizationRules } from "../../engine/mockEngine";

const FILTERS = [
  { id: "All", key: "all" },
  { id: "Today", key: "today" },
  { id: "This week", key: "this_week" },
  { id: "Suggestions", key: "suggestions" },
  { id: "Needs review", key: "needs_review" },
];

export default function BankTransactionsScreen({ onOpenAminah, onOpenBankAccounts, role = "CFO", filterByAssignee = null }) {
  const { t } = useTranslation("bank-transactions");
  const { t: tc } = useTranslation("common");
  const [txs, setTxs] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState("All");
  const [suggestion, setSuggestion] = useState(null);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catModalPrefill, setCatModalPrefill] = useState(null);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    const loader = filterByAssignee
      ? getFilteredBankTransactions(filterByAssignee)
      : getBankTransactionsPending();
    loader.then((rows) => {
      setTxs(rows);
      setSelectedId((prev) => {
        if (prev && rows.some((r) => r.id === prev)) return prev;
        return rows.length > 0 ? rows[0].id : null;
      });
    });
    getSuggestedCategorizationRules().then((s) => setSuggestion(s[0] || null));
  }, [filterByAssignee, version]);

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
    // Re-pull from engine so any server-side derived fields (category label,
    // suggestion state) are fresh on both the list and the detail panel.
    refresh();
  };

  return (
    <div data-split="true" style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      {/* List 60% */}
      <div
        style={{
          flex: "0 0 60%",
          display: "flex",
          flexDirection: "column",
          borderInlineEnd: "1px solid rgba(255,255,255,0.10)",
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
                  color: "var(--text-tertiary)",
                }}
              >
                {txs ? t("header.pending_count", { count: txs.length }) : t("header.pending_unknown")}
              </div>
              {filterByAssignee && (
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4, fontStyle: "italic" }}>
                  {t("header.in_your_domain")}
                </div>
              )}
            </div>
            <a
              onClick={onOpenBankAccounts}
              style={{
                fontSize: 12,
                color: "var(--accent-primary)",
                cursor: "pointer",
                fontWeight: 500,
                letterSpacing: "0.02em",
              }}
            >
              {t("header.view_full_accounts")}
            </a>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {FILTERS.map((f) => {
              const on = f.id === filter;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    padding: "5px 12px",
                    borderRadius: 14,
                    background: on ? "var(--accent-primary-subtle)" : "var(--bg-surface)",
                    border: on ? "1px solid rgba(0,196,140,0.30)" : "1px solid rgba(255,255,255,0.10)",
                    color: on ? "var(--accent-primary)" : "var(--text-tertiary)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {t(`filters.${f.key}`)}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {filtered.length === 0 && (
            <EmptyState icon={Receipt} title={tc("empty_states.bank_tx_title")} description={tc("empty_states.bank_tx_desc")} />
          )}
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
        onCreated={() => {
          setSuggestion(null);
          refresh();
        }}
      />
    </div>
  );
}
