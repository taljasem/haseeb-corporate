import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Receipt, ArrowUpDown, ArrowUp, ArrowDown, X, CheckSquare, Download, Tag, UserPlus, Sparkles, CheckCircle2 } from "lucide-react";
import BankTransactionRow from "../../components/cfo/BankTransactionRow";
import EmptyState from "../../components/shared/EmptyState";
import BankTransactionDetail from "../../components/cfo/BankTransactionDetail";
import SuggestionBanner from "../../components/shared/SuggestionBanner";
import NewCategorizationRuleModal from "../../components/rules/NewCategorizationRuleModal";
import {
  getBankTransactionsPending,
  getFilteredBankTransactions,
  getSuggestedCategorizationRules,
  getBankTransactionsSorted,
  bulkCategorizeTransactions,
  bulkAssignTransactions,
  bulkMarkTransactionsReviewed,
  exportBankTransactionsCSV,
  createRuleFromTransactions,
  getChartOfAccounts,
  getTeamMembers,
} from "../../engine/mockEngine";

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

  // Bulk selection
  const [checkedIds, setCheckedIds] = useState(new Set());
  const bulkMode = checkedIds.size > 0;

  // Sort
  const [sortField, setSortField] = useState("date");
  const [sortDir, setSortDir] = useState("desc");

  // Filters
  const [categoryFilter, setCategoryFilter] = useState([]);
  const [assigneeFilter, setAssigneeFilter] = useState([]);
  const [categories, setCategories] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);

  // Toast
  const [toast, setToast] = useState(null);
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  useEffect(() => {
    getChartOfAccounts().then(setCategories);
    getTeamMembers().then(setTeamMembers);
  }, []);

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

  // Apply local filters + sort
  const filtered = (txs || []).filter((tx) => {
    if (filter === "Today") return (tx.date || "").includes("04-07") || (tx.date || "").includes("Apr 7");
    if (filter === "This week") return true;
    if (filter === "Suggestions") return tx.engineSuggestion?.confidence !== "NONE";
    if (filter === "Needs review") return tx.engineSuggestion?.confidence === "NONE";
    return true;
  }).filter((tx) => {
    if (categoryFilter.length > 0) {
      const code = tx.categoryCode || tx.engineSuggestion?.accountCode || "";
      if (!categoryFilter.includes(code)) return false;
    }
    if (assigneeFilter.length > 0) {
      if (assigneeFilter.includes("unassigned") && !tx.assigneeId) return true;
      if (!assigneeFilter.includes(tx.assigneeId)) return false;
    }
    return true;
  }).sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortField) {
      case "date": return ((a.date || "").localeCompare(b.date || "")) * dir;
      case "amount": return (Math.abs(a.amount || 0) - Math.abs(b.amount || 0)) * dir;
      case "merchant": return ((a.merchant || "").localeCompare(b.merchant || "")) * dir;
      default: return 0;
    }
  });

  const selected = (txs || []).find((tx) => tx.id === selectedId);
  const toggleCheck = (txId) => { setCheckedIds((prev) => { const next = new Set(prev); if (next.has(txId)) next.delete(txId); else next.add(txId); return next; }); };
  const selectAllVisible = () => { setCheckedIds(new Set(filtered.map((tx) => tx.id))); };
  const clearSelection = () => { setCheckedIds(new Set()); };
  const handleSort = (field) => { if (sortField === field) setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortField(field); setSortDir("desc"); } };

  const handleConfirmed = (txId) => {
    setTxs((prev) => {
      if (!prev) return prev;
      const idx = prev.findIndex((t) => t.id === txId);
      const next = prev.filter((t) => t.id !== txId);
      if (next.length > 0) { setSelectedId(next[Math.min(idx, next.length - 1)].id); } else { setSelectedId(null); }
      return next;
    });
    refresh();
  };

  // Bulk actions
  const handleBulkCategorize = async (code) => {
    const result = await bulkCategorizeTransactions([...checkedIds], code, "cfo");
    showToast(t("bulk.applied_toast", { count: result.updated }));
    clearSelection(); refresh();
  };
  const handleBulkAssign = async (assigneeId) => {
    const result = await bulkAssignTransactions([...checkedIds], assigneeId, "cfo");
    showToast(t("bulk.applied_toast", { count: result.updated }));
    clearSelection(); refresh();
  };
  const handleBulkMarkReviewed = async () => {
    const result = await bulkMarkTransactionsReviewed([...checkedIds], "cfo");
    showToast(t("bulk.applied_toast", { count: result.updated }));
    clearSelection(); refresh();
  };
  const handleBulkExport = async () => {
    const result = await exportBankTransactionsCSV([...checkedIds]);
    if (!result?.csvText) return;
    const blob = new Blob(["\uFEFF" + result.csvText], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = result.filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(t("bulk.applied_toast", { count: result.rowCount }));
    clearSelection();
  };
  const handleBulkCreateRule = async () => {
    const result = await createRuleFromTransactions([...checkedIds]);
    if (result?.proposedRule) {
      setCatModalPrefill({ name: result.proposedRule.name, merchant: result.proposedRule.matchValue });
      setCatModalOpen(true);
    }
    clearSelection();
  };

  // Active filter pills
  const activeFilters = [];
  if (categoryFilter.length > 0) activeFilters.push({ key: "category", label: `${t("filters.category_label")}: ${categoryFilter.length}`, onRemove: () => setCategoryFilter([]) });
  if (assigneeFilter.length > 0) activeFilters.push({ key: "assignee", label: `${t("filters.assignee_label")}: ${assigneeFilter.length}`, onRemove: () => setAssigneeFilter([]) });

  return (
    <div data-split="true" style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      {/* List 60% */}
      <div style={{ flex: "0 0 60%", display: "flex", flexDirection: "column", borderInlineEnd: "1px solid rgba(255,255,255,0.10)", overflow: "hidden" }}>
        {suggestion && (
          <SuggestionBanner suggestion={suggestion} onApply={(s) => { setCatModalPrefill({ name: `${s.merchant} auto-categorization`, merchant: s.merchant }); setCatModalOpen(true); }} onDismiss={() => setSuggestion(null)} />
        )}

        <div style={{ padding: "20px 24px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>
                {txs ? t("header.pending_count", { count: txs.length }) : t("header.pending_unknown")}
              </div>
              {filterByAssignee && <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4, fontStyle: "italic" }}>{t("header.in_your_domain")}</div>}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {!bulkMode && <button onClick={() => selectAllVisible()} style={{ fontSize: 11, color: "var(--accent-primary)", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>{t("bulk.enter_mode")}</button>}
              <a onClick={onOpenBankAccounts} style={{ fontSize: 12, color: "var(--accent-primary)", cursor: "pointer", fontWeight: 500, letterSpacing: "0.02em" }}>{t("header.view_full_accounts")}</a>
            </div>
          </div>

          {/* Bulk action bar */}
          {bulkMode && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", marginBottom: 8, borderBottom: "1px solid rgba(255,255,255,0.06)", flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-primary)" }}>{t("bulk.selected_count", { count: checkedIds.size })}</span>
              <BulkBtn icon={Tag} label={t("bulk.actions.categorize_all")} onClick={() => { const first = categories[0]; if (first) handleBulkCategorize(first.code); }} />
              <BulkBtn icon={UserPlus} label={t("bulk.actions.assign_to")} onClick={() => { const first = teamMembers[0]; if (first) handleBulkAssign(first.id || "sara"); }} />
              <BulkBtn icon={Sparkles} label={t("bulk.actions.create_rule")} onClick={handleBulkCreateRule} />
              <BulkBtn icon={Download} label={t("bulk.actions.export")} onClick={handleBulkExport} />
              <BulkBtn icon={CheckCircle2} label={t("bulk.actions.mark_reviewed")} onClick={handleBulkMarkReviewed} />
              <button onClick={clearSelection} style={{ fontSize: 11, color: "var(--text-tertiary)", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", marginInlineStart: "auto" }}>{t("bulk.exit_mode")}</button>
            </div>
          )}

          {/* Filter pills + sort headers */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {FILTERS.map((f) => {
              const on = f.id === filter;
              return <button key={f.id} onClick={() => setFilter(f.id)} style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", padding: "5px 12px", borderRadius: 14, background: on ? "var(--accent-primary-subtle)" : "var(--bg-surface)", border: on ? "1px solid rgba(0,196,140,0.30)" : "1px solid rgba(255,255,255,0.10)", color: on ? "var(--accent-primary)" : "var(--text-tertiary)", cursor: "pointer", fontFamily: "inherit" }}>{t(`filters.${f.key}`)}</button>;
            })}
            <span style={{ width: 1, height: 16, background: "rgba(255,255,255,0.08)", margin: "0 4px" }} />
            {/* Category filter */}
            <FilterDropdown label={t("filters.category_label")} options={categories.map((c) => ({ id: c.code, label: `${c.code} ${c.name}` }))} selected={categoryFilter} onChange={setCategoryFilter} />
            {/* Assignee filter */}
            <FilterDropdown label={t("filters.assignee_label")} options={[{ id: "unassigned", label: t("filters.assignee_unassigned") }, ...teamMembers.map((m) => ({ id: m.id || m.userId, label: m.name }))]} selected={assigneeFilter} onChange={setAssigneeFilter} />
          </div>

          {/* Active filter pills */}
          {activeFilters.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {activeFilters.map((f) => (
                <span key={f.key} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 10, background: "rgba(0,196,140,0.08)", border: "1px solid rgba(0,196,140,0.2)", color: "var(--accent-primary)" }}>
                  {f.label}
                  <button onClick={f.onRemove} style={{ background: "transparent", border: "none", color: "var(--accent-primary)", cursor: "pointer", padding: 0, display: "inline-flex" }}><X size={10} /></button>
                </span>
              ))}
              <button onClick={() => { setCategoryFilter([]); setAssigneeFilter([]); }} style={{ fontSize: 10, color: "var(--text-tertiary)", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit" }}>{t("filters.clear_all")}</button>
            </div>
          )}

          {/* Sort headers */}
          <div style={{ display: "grid", gridTemplateColumns: bulkMode ? "28px 46px 1fr auto auto" : "46px 1fr auto auto", gap: 12, padding: "8px 14px 0", marginTop: 6 }}>
            {bulkMode && <div />}
            <SortHeader label={t("sort.by_date")} field="date" active={sortField} dir={sortDir} onSort={handleSort} />
            <SortHeader label={t("sort.by_merchant")} field="merchant" active={sortField} dir={sortDir} onSort={handleSort} />
            <SortHeader label={t("sort.by_amount")} field="amount" active={sortField} dir={sortDir} onSort={handleSort} />
            <div style={{ width: 60 }} />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {filtered.length === 0 && <EmptyState icon={Receipt} title={tc("empty_states.bank_tx_title")} description={tc("empty_states.bank_tx_desc")} />}
          {filtered.map((tx) => (
            <BankTransactionRow key={tx.id} tx={tx} selected={tx.id === selectedId} onSelect={(x) => setSelectedId(x.id)} selectable={bulkMode} isChecked={checkedIds.has(tx.id)} onToggleCheck={toggleCheck} />
          ))}
        </div>
      </div>

      {/* Detail 40% */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <BankTransactionDetail tx={selected} onOpenAminah={(ctx) => onOpenAminah && onOpenAminah(typeof ctx === "string" ? ctx : `Bank tx ${selected.id} — ${selected.merchant}`)} onConfirmed={handleConfirmed} />
      </div>

      <NewCategorizationRuleModal open={catModalOpen} onClose={() => setCatModalOpen(false)} prefill={catModalPrefill} onCreated={() => { setSuggestion(null); refresh(); }} />

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "rgba(0,196,140,0.15)", border: "1px solid rgba(0,196,140,0.35)", color: "var(--accent-primary)", padding: "10px 20px", borderRadius: 8, fontSize: 12, fontWeight: 600, zIndex: 400, pointerEvents: "none" }}>{toast}</div>
      )}
    </div>
  );
}

function BulkBtn({ icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, padding: "4px 8px", borderRadius: 4, background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: "var(--text-secondary)", cursor: "pointer", fontFamily: "inherit" }}>
      <Icon size={11} /> {label}
    </button>
  );
}

function SortHeader({ label, field, active, dir, onSort }) {
  const isActive = active === field;
  return (
    <button onClick={() => onSort(field)} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: isActive ? "var(--accent-primary)" : "var(--text-tertiary)", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
      {label}
      {isActive ? (dir === "asc" ? <ArrowUp size={9} /> : <ArrowDown size={9} />) : <ArrowUpDown size={9} style={{ opacity: 0.3 }} />}
    </button>
  );
}

function FilterDropdown({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const active = selected.length > 0;
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{ fontSize: 11, fontWeight: 600, padding: "5px 10px", borderRadius: 14, background: active ? "rgba(59,130,246,0.1)" : "var(--bg-surface)", border: active ? "1px solid rgba(59,130,246,0.3)" : "1px solid rgba(255,255,255,0.10)", color: active ? "#3b82f6" : "var(--text-tertiary)", cursor: "pointer", fontFamily: "inherit" }}>
        {label}{active ? ` (${selected.length})` : ""}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 200 }} />
          <div style={{ position: "absolute", top: "100%", insetInlineStart: 0, marginTop: 4, width: 220, maxHeight: 240, overflowY: "auto", background: "var(--bg-surface-raised)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.5)", zIndex: 201, padding: "6px 0" }}>
            {options.map((opt) => {
              const isSelected = selected.includes(opt.id);
              return (
                <button key={opt.id} onClick={() => { const next = isSelected ? selected.filter((s) => s !== opt.id) : [...selected, opt.id]; onChange(next); }} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "7px 12px", background: isSelected ? "rgba(0,196,140,0.06)" : "transparent", border: "none", color: "var(--text-primary)", fontSize: 11, cursor: "pointer", fontFamily: "inherit", textAlign: "start" }}>
                  <input type="checkbox" checked={isSelected} readOnly style={{ width: 13, height: 13, accentColor: "var(--accent-primary)", pointerEvents: "none" }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
