import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft, ChevronDown, ChevronRight, CheckCircle2, AlertCircle, Circle, Lock, FileWarning,
  Plus, X, Download, History, Sparkles, RotateCcw, Upload, Clock,
} from "lucide-react";
import LtrText from "../shared/LtrText";
import useEscapeKey from "../../hooks/useEscapeKey";
import EmptyState from "../shared/EmptyState";
import ActionButton from "../ds/ActionButton";
import PersistentBanner from "../ds/PersistentBanner";
import DropZone from "../ds/DropZone";
import BulkMatchRuleModal from "./BulkMatchRuleModal";
import CompleteReconciliationModal from "./CompleteReconciliationModal";
import ReconciliationHistorySlideOver from "./ReconciliationHistorySlideOver";
import {
  getReconciliationDashboard,
  getReconciliationById,
  resolveException,
  createMissingJournalEntry,
  manualMatch,
  completeReconciliation,
  getPrimaryOperatingAccount,
  confirmSuggestion,
  dismissSuggestion,
  reopenReconciliation,
  exportReconciliationCSV,
  parseBankStatementCSV,
  importUploadedStatement,
  getReconciliationHistory,
  unmatch,
  lockReconciliation,
  checkPeriodStatus,
} from "../../engine/mockEngine";
import { formatKWDAmount, formatDate } from "../../utils/format";

const STATUS_META = {
  "completed":        { key: "completed",        color: "var(--accent-primary)",   icon: CheckCircle2 },
  "in-progress":      { key: "in_progress",      color: "var(--semantic-warning)", icon: Circle },
  "not-started":      { key: "not_started",       color: "var(--text-tertiary)",    icon: Circle },
  "locked":           { key: "locked",            color: "var(--text-tertiary)",    icon: Lock },
  "pending-approval": { key: "pending_approval",  color: "var(--semantic-info, #3b82f6)", icon: Clock },
};

const EXC_TYPE_KEY = {
  "unidentified":        "type_unidentified",
  "amount-mismatch":     "type_amount_mismatch",
  "missing-ledger-entry":"type_missing_ledger",
  "date-mismatch":       "type_date_mismatch",
  "bank-only":           "type_bank_only",
  "ledger-only":         "type_ledger_only",
  "duplicate":           "type_duplicate",
};

const TIER_PILL = {
  "exact":            { color: "var(--accent-primary)",   key: "exact" },
  "fuzzy-confirmed":  { color: "#3b82f6",                 key: "fuzzy_confirmed" },
  "manual":           { color: "var(--text-secondary)",    key: "manual" },
  "bulk-rule":        { color: "#a855f7",                  key: "bulk_rule" },
};

const fmtKWD = formatKWDAmount;
const fmtDate = (iso) => formatDate(iso);

// ─── Toast helper (local, no global system in codebase) ───
function useToast() {
  const [msg, setMsg] = useState(null);
  const show = useCallback((text, type = "success") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 2500);
  }, []);
  return [msg, show];
}
function Toast({ msg }) {
  if (!msg) return null;
  const bg = msg.type === "error" ? "rgba(239,68,68,0.15)" : msg.type === "info" ? "rgba(59,130,246,0.15)" : "rgba(0,196,140,0.15)";
  const border = msg.type === "error" ? "rgba(239,68,68,0.35)" : msg.type === "info" ? "rgba(59,130,246,0.35)" : "rgba(0,196,140,0.35)";
  const color = msg.type === "error" ? "#ef4444" : msg.type === "info" ? "#3b82f6" : "var(--accent-primary)";
  return (
    <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: bg, border: `1px solid ${border}`, color, padding: "10px 20px", borderRadius: 8, fontSize: 12, fontWeight: 600, zIndex: 400, pointerEvents: "none" }}>
      {msg.text}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ROOT COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function ReconciliationScreen({ role = "CFO" }) {
  const { t } = useTranslation("reconciliation");
  const { t: tc } = useTranslation("common");
  const [view, setView] = useState("dashboard");
  const [dashboard, setDashboard] = useState(null);
  const [activeRecId, setActiveRecId] = useState(null);
  const [recDetail, setRecDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [historicalRec, setHistoricalRec] = useState(null);

  const refreshDashboard = useCallback(() => {
    getReconciliationDashboard().then(setDashboard);
  }, []);

  useEffect(() => { refreshDashboard(); }, [refreshDashboard]);

  useEffect(() => {
    if (view === "detail" && activeRecId) {
      setLoading(true);
      getReconciliationById(activeRecId).then((r) => { setRecDetail(r); setLoading(false); });
    }
  }, [view, activeRecId]);

  const openDetail = (recId) => { setActiveRecId(recId); setView("detail"); setHistoricalRec(null); };
  const backToDashboard = () => { setView("dashboard"); setActiveRecId(null); setRecDetail(null); setHistoricalRec(null); refreshDashboard(); };
  const reloadRec = async () => { if (!activeRecId) return; const r = await getReconciliationById(activeRecId); setRecDetail(r); };

  const handleSelectHistorical = async (histRec) => {
    const full = await getReconciliationById(histRec.id);
    if (full) { setHistoricalRec(full); }
  };

  if (view === "detail") {
    return (
      <ReconciliationDetail
        rec={historicalRec || recDetail}
        loading={loading}
        role={role}
        readOnly={!!historicalRec}
        onBack={historicalRec ? () => setHistoricalRec(null) : backToDashboard}
        onReload={reloadRec}
        onSelectHistorical={handleSelectHistorical}
      />
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "20px 28px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: "var(--text-primary)", letterSpacing: "-0.3px", lineHeight: 1 }}>{t("title")}</div>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginTop: 6 }}>{t("period_label")}</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
        {!dashboard ? (
          <div style={{ color: "var(--text-tertiary)", fontSize: 13 }}>{t("loading")}</div>
        ) : dashboard.length === 0 ? (
          <EmptyState icon={CheckCircle2} title={tc("empty_states.recon_dashboard_title")} description={tc("empty_states.recon_dashboard_desc")} />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
            {dashboard.map((row) => <ReconciliationAccountCard key={row.accountId} row={row} onOpen={openDetail} />)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Dashboard account card (unchanged) ───
function ReconciliationAccountCard({ row, onOpen }) {
  const { t } = useTranslation("reconciliation");
  const meta = STATUS_META[row.status] || STATUS_META["not-started"];
  const Icon = meta.icon;
  const pct = row.totalCount > 0 ? Math.round((row.matchedCount / row.totalCount) * 100) : 0;
  return (
    <button onClick={() => row.currentReconciliationId && onOpen(row.currentReconciliationId)} disabled={!row.currentReconciliationId}
      style={{ textAlign: "start", background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 10, padding: "16px 18px", cursor: row.currentReconciliationId ? "pointer" : "default", fontFamily: "inherit", color: "var(--text-primary)", transition: "all 0.15s" }}
      onMouseEnter={(e) => { if (row.currentReconciliationId) { e.currentTarget.style.borderColor = "rgba(0,196,140,0.35)"; e.currentTarget.style.background = "rgba(0,196,140,0.04)"; } }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; e.currentTarget.style.background = "var(--bg-surface)"; }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}><LtrText>{row.bankName} · {row.accountNumberMasked}</LtrText></div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginTop: 4 }}>{row.accountName}</div>
        </div>
        <StatusPill status={row.status} />
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ height: 6, background: "rgba(255,255,255,0.05)", borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: meta.color, transition: "width 0.3s" }} />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
        <div style={{ color: "var(--text-secondary)" }}>
          <span style={{ color: "var(--text-primary)", fontWeight: 600, fontFamily: "'DM Mono', monospace" }}>{row.matchedCount}/{row.totalCount}</span>{" "}{t("card.matched")}
        </div>
        {row.exceptionCount > 0 ? (
          <div style={{ color: "var(--semantic-warning)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}><AlertCircle size={11} />{row.exceptionCount === 1 ? t("card.exception_one", { count: 1 }) : t("card.exception_other", { count: row.exceptionCount })}</div>
        ) : row.status === "completed" ? (
          <div style={{ color: "var(--accent-primary)", fontWeight: 600 }}>{t("card.clean")}</div>
        ) : row.status === "not-started" ? (
          <div style={{ color: "var(--text-tertiary)" }}>{t("card.not_started")}</div>
        ) : null}
      </div>
    </button>
  );
}

function StatusPill({ status }) {
  const { t } = useTranslation("reconciliation");
  const meta = STATUS_META[status] || STATUS_META["not-started"];
  const Icon = meta.icon;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: meta.color, background: `${meta.color}1A`, border: `1px solid ${meta.color}40`, padding: "4px 8px", borderRadius: 4 }}>
      <Icon size={10} />{t(`status.${meta.key}`)}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DETAIL VIEW
// ═══════════════════════════════════════════════════════════════
function ReconciliationDetail({ rec, loading, role, readOnly, onBack, onReload, onSelectHistorical }) {
  const { t } = useTranslation("reconciliation");
  const [toast, showToast] = useToast();
  const [jeComposerFor, setJeComposerFor] = useState(null);
  const [bannerVisible, setBannerVisible] = useState(false);
  const [bulkRuleOpen, setBulkRuleOpen] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [uploadState, setUploadState] = useState("idle");
  const [uploadWarnings, setUploadWarnings] = useState([]);
  const [isSoftClosed, setIsSoftClosed] = useState(false);
  const fileInputRef = useRef(null);
  const bannerShownRef = useRef(null);
  const suggestionsRef = useRef(null);
  const exceptionsRef = useRef(null);
  const [matchedExpanded, setMatchedExpanded] = useState({ bank: false, ledger: false });

  // Auto-match banner on first load
  useEffect(() => {
    if (rec && rec.id !== bannerShownRef.current) {
      bannerShownRef.current = rec.id;
      setBannerVisible(true);
      const t = setTimeout(() => setBannerVisible(false), 5000);
      return () => clearTimeout(t);
    }
  }, [rec?.id]);

  // Check period status for complete modal
  useEffect(() => {
    if (rec) {
      checkPeriodStatus(new Date(rec.period.year, rec.period.month - 1, 15)).then((ps) => {
        setIsSoftClosed(ps.status === "soft-closed");
      });
    }
  }, [rec?.id, rec?.period?.year, rec?.period?.month]);

  if (loading || !rec) {
    return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)" }}>{t("loading_detail")}</div>;
  }

  const meta = STATUS_META[rec.status] || STATUS_META["in-progress"];
  const diff = rec.reconciliationDifference;
  const unresolvedCount = (rec.exceptions || []).filter((e) => !e.resolved).length;
  const isClean = Math.abs(diff) < 0.001 && unresolvedCount === 0;
  const author = role === "CFO" ? "cfo" : role === "Owner" ? "owner" : "sara";
  const suggestionsCount = (rec.pendingSuggestions || []).length;

  // Tier breakdown
  const tierCounts = { exact: 0, "fuzzy-confirmed": 0, manual: 0, "bulk-rule": 0 };
  (rec.matchedItems || []).forEach((m) => { const k = m.matchTier || "exact"; if (tierCounts[k] !== undefined) tierCounts[k]++; else tierCounts.manual++; });

  // ─── Handlers ───
  const handleResolve = async (excId, resolution) => { await resolveException(rec.id, excId, resolution, author); await onReload(); showToast(t("exceptions.resolution_accepted")); };
  const handleCreateJE = async (excBankItemId, debit, credit) => {
    const bi = rec.unmatchedBankItems.find((b) => b.id === excBankItemId);
    if (!bi) return;
    await createMissingJournalEntry(rec.id, excBankItemId, debit, credit, bi.amount, author);
    setJeComposerFor(null);
    await onReload();
    showToast(t("je_composer.confirm"));
  };
  const handleConfirmSuggestion = async (suggId) => { await confirmSuggestion(rec.id, suggId, author); await onReload(); showToast(t("suggestions.confirm_button")); };
  const handleDismissSuggestion = async (suggId) => { await dismissSuggestion(rec.id, suggId, author); await onReload(); };

  const handleComplete = async (force) => {
    const result = await completeReconciliation(rec.id, author, force ? { force: true } : {});
    setCompleteModalOpen(false);
    if (result?.error) { showToast(result.error, "error"); return; }
    if (result?.requiresApproval) { showToast(t("complete.pending_approval_toast"), "info"); }
    else { showToast(t("complete.completed_toast")); }
    await onReload();
  };
  const handleReopen = async () => { await reopenReconciliation(rec.id, author); await onReload(); showToast(t("complete.reopened_toast")); };

  const handleExport = async () => {
    const result = await exportReconciliationCSV(rec.id);
    if (!result?.csvText) { showToast("Export failed", "error"); return; }
    showToast(t("export.downloading", { filename: result.filename }), "info");
    const blob = new Blob(["\uFEFF" + result.csvText], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = result.filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCSVFile = async (file) => {
    if (file.size > 5 * 1024 * 1024) { showToast(t("upload.error_too_large"), "error"); return; }
    if (!file.name.toLowerCase().endsWith(".csv")) { showToast(t("upload.error_wrong_type"), "error"); return; }
    setUploadState("parsing");
    const csvText = await file.text();
    const parseResult = await parseBankStatementCSV(csvText);
    if (parseResult.errors?.length > 0) { showToast(parseResult.errors[0], "error"); setUploadState("idle"); return; }
    await importUploadedStatement(rec.id, parseResult.items, file.name, author);
    if (parseResult.warnings?.length > 0) setUploadWarnings(parseResult.warnings);
    showToast(t("upload.success_title") + ` — ${parseResult.items.length} items`, "success");
    setUploadState("idle");
    await onReload();
  };

  const handleBulkRuleApplied = async (result) => {
    showToast(t("bulk_rule.applied_toast", { count: result?.matchedCount || 0 }));
    await onReload();
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Read-only banner */}
      {readOnly && (
        <div style={{ padding: "8px 28px", background: "rgba(59,130,246,0.08)", borderBottom: "1px solid rgba(59,130,246,0.2)", fontSize: 11, fontWeight: 600, color: "#3b82f6", display: "flex", alignItems: "center", gap: 8 }}>
          <History size={12} /> {t("history.title")} — {rec.period.label}
        </div>
      )}

      {/* Header */}
      <div style={{ padding: "16px 28px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "transparent", border: "none", color: "var(--text-secondary)", fontSize: 12, cursor: "pointer", padding: "4px 0", fontFamily: "inherit", marginBottom: 8 }}>
          <span className="rtl-flip" style={{ display: "inline-flex" }}><ChevronLeft size={14} /></span>
          {readOnly ? t("detail.back") : t("detail.back")}
        </button>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, color: "var(--text-primary)", letterSpacing: "-0.3px", lineHeight: 1 }}>
              <LtrText>{rec.id}</LtrText> · {rec.period.label}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginTop: 6 }}>
              {t("detail.sub", { accountId: rec.accountId, matched: rec.matchedCount, total: rec.totalBankItems })}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <StatusPill status={rec.status} />
            {/* Recall match summary */}
            {!readOnly && !bannerVisible && <ActionButton variant="tertiary" size="sm" icon={Sparkles} label={t("auto_match.recall_link")} onClick={() => setBannerVisible(true)} />}
            {/* Export — always available */}
            <ActionButton variant="secondary" size="md" icon={Download} label={t("export.button")} onClick={handleExport} />
            {/* History */}
            {!readOnly && <ActionButton variant="secondary" size="md" icon={History} label={t("history.title")} onClick={() => setHistoryOpen(true)} />}
            {/* Reopen — completed or locked only */}
            {!readOnly && (rec.status === "completed" || rec.status === "locked") && (
              <ActionButton variant="secondary" size="md" icon={RotateCcw} label={t("complete.reopen_button")} onClick={handleReopen} />
            )}
            {/* Complete — in-progress only */}
            {!readOnly && rec.status === "in-progress" && (
              <button onClick={() => setCompleteModalOpen(true)} disabled={false} style={{ background: isClean ? "var(--accent-primary)" : "rgba(255,255,255,0.05)", color: isClean ? "#fff" : "var(--text-secondary)", border: isClean ? "none" : "1px solid rgba(255,255,255,0.15)", padding: "8px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                {t("detail.complete")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Auto-match banner — uses PersistentBanner with 15s auto-dismiss and hover pause */}
      {!readOnly && (
        <PersistentBanner
          open={bannerVisible}
          onDismiss={() => setBannerVisible(false)}
          title={t("auto_match.banner_title")}
          body={<>{t("auto_match.banner_body", { matched: rec.matchedCount, exceptions: unresolvedCount })}{suggestionsCount > 0 && <> · {t("auto_match.suggestions_body", { suggestions: suggestionsCount })}</>}</>}
          icon={Sparkles}
          variant="info"
          autoDismissAfterMs={15000}
        />
      )}

      {/* Summary strip */}
      <div style={{ display: "grid", gridTemplateColumns: suggestionsCount > 0 ? "repeat(5, 1fr)" : "repeat(4, 1fr)", gap: 1, background: "var(--border-subtle)", margin: "14px 28px 0", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, overflow: "hidden" }}>
        <SummaryCell label={t("summary.opening_balance")} value={fmtKWD(rec.openingBalance)} />
        <SummaryCell label={t("summary.closing_bank")} value={fmtKWD(rec.closingBalance)} />
        <SummaryCell label={t("summary.closing_ledger")} value={fmtKWD(rec.closingLedgerBalance)} />
        <SummaryCell label={t("summary.difference")} value={fmtKWD(diff)} highlight={Math.abs(diff) < 0.001 ? "var(--accent-primary)" : "var(--semantic-warning)"} onClick={() => exceptionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} clickable={unresolvedCount > 0} />
        {suggestionsCount > 0 && <SummaryCell label="PENDING REVIEW" value={String(suggestionsCount)} highlight="#3b82f6" onClick={() => suggestionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} clickable />}
      </div>

      {/* Tier breakdown */}
      <div style={{ margin: "6px 28px 0", fontSize: 10, color: "var(--text-tertiary)", display: "flex", gap: 10 }}>
        {tierCounts.exact > 0 && <span>{tierCounts.exact} {t("confidence.exact")}</span>}
        {tierCounts["fuzzy-confirmed"] > 0 && <span>{tierCounts["fuzzy-confirmed"]} {t("confidence.fuzzy_confirmed")}</span>}
        {tierCounts.manual > 0 && <span>{tierCounts.manual} {t("confidence.manual")}</span>}
        {tierCounts["bulk-rule"] > 0 && <span>{tierCounts["bulk-rule"]} {t("confidence.bulk_rule")}</span>}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 28px 24px" }}>
        {/* CSV Upload — real DropZone */}
        {!readOnly && rec.status === "in-progress" && (
          <div style={{ marginBottom: 14 }}>
            <DropZone
              onFile={handleCSVFile}
              accept=".csv,text/csv"
              maxSize={5 * 1024 * 1024}
              title={t("upload.drop_zone_title")}
              subtitle={t("upload.drop_zone_body")}
              icon={Upload}
              height={80}
              loading={uploadState === "parsing"}
            />
            {uploadWarnings.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 10, color: "var(--semantic-warning)" }}>
                {t("upload.warnings_header", { count: uploadWarnings.length })}: {uploadWarnings.slice(0, 3).join("; ")}
              </div>
            )}
          </div>
        )}

        {/* Side-by-side columns */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
          <StatementColumn title={t("columns.bank_statement")} sub={t("columns.bank_sub", { total: rec.totalBankItems, unmatched: rec.unmatchedBankItems.length })} matchedCount={rec.matchedCount} matchedItems={rec.matchedItems} unmatched={rec.unmatchedBankItems} exceptions={rec.exceptions} isBank />
          <StatementColumn title={t("columns.general_ledger")} sub={t("columns.ledger_sub", { total: rec.totalLedgerItems, unmatched: rec.unmatchedLedgerItems.length })} matchedCount={rec.matchedCount} matchedItems={rec.matchedItems} unmatched={rec.unmatchedLedgerItems} exceptions={rec.exceptions} isBank={false} />
        </div>

        {/* Pending Suggestions */}
        {suggestionsCount > 0 && !readOnly && (
          <div ref={suggestionsRef} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", color: "#3b82f6", marginBottom: 10, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Sparkles size={12} />
              {t("suggestions.title")} · {t("suggestions.subtitle", { count: suggestionsCount })}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rec.pendingSuggestions.map((sugg) => {
                const bankItem = rec.unmatchedBankItems.find((b) => b.id === sugg.bankItemId);
                const ledgerItem = rec.unmatchedLedgerItems.find((l) => l.id === sugg.ledgerEntryId);
                const stale = !bankItem || !ledgerItem;
                return (
                  <div key={sugg.id} style={{ padding: "12px 16px", background: stale ? "rgba(255,255,255,0.02)" : "rgba(59,130,246,0.04)", border: `1px solid ${stale ? "rgba(255,255,255,0.06)" : "rgba(59,130,246,0.2)"}`, borderRadius: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <ConfidencePill confidence={sugg.confidence} />
                          <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{t("suggestions.day_diff_label", { days: sugg.dayDiff })}</span>
                        </div>
                        {bankItem && (
                          <div style={{ fontSize: 12, color: "var(--text-primary)", marginBottom: 2 }}>
                            <span style={{ fontWeight: 500 }}>{bankItem.description}</span>
                            <span style={{ fontFamily: "'DM Mono', monospace", marginInlineStart: 8, color: bankItem.amount < 0 ? "var(--semantic-danger)" : "var(--text-primary)" }}><LtrText>{fmtKWD(bankItem.amount)}</LtrText></span>
                          </div>
                        )}
                        {ledgerItem && (
                          <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>↔ {ledgerItem.description} · <LtrText>{ledgerItem.journalEntryId}</LtrText></div>
                        )}
                        {stale && <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontStyle: "italic" }}>Suggestion stale — item no longer available</div>}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        {!stale && (
                          <button onClick={() => handleConfirmSuggestion(sugg.id)} style={{ background: "#3b82f6", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t("suggestions.confirm_button")}</button>
                        )}
                        <button onClick={() => handleDismissSuggestion(sugg.id)} style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.15)", padding: "6px 12px", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t("suggestions.dismiss_button")}</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bulk match CTA row — visible when enough unmatched items remain */}
        {!readOnly && rec.status === "in-progress" && (rec.unmatchedBankItems.length + rec.unmatchedLedgerItems.length) >= 3 && (
          <div style={{ marginBottom: 14, padding: "14px 18px", background: "rgba(168,85,247,0.04)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}><Sparkles size={14} color="#a855f7" /> {t("bulk_rule.cta_title")}</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{t("bulk_rule.cta_subtitle")}</div>
            </div>
            <ActionButton variant="secondary" size="sm" icon={Sparkles} label={t("bulk_rule.title")} onClick={() => setBulkRuleOpen(true)} />
          </div>
        )}

        {/* Exceptions */}
        {rec.exceptions.length > 0 && (
          <div ref={exceptionsRef}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", color: "var(--semantic-warning)", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <FileWarning size={12} />
                {t("exceptions.header", { open: unresolvedCount })}
              </div>
              {!readOnly && rec.status === "in-progress" && (
                <ActionButton variant="secondary" size="sm" icon={Sparkles} label={t("bulk_rule.title")} onClick={() => setBulkRuleOpen(true)} />
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rec.exceptions.map((exc) => (
                <ExceptionRow key={exc.id} exc={exc} readOnly={readOnly} onResolve={handleResolve} onOpenJE={() => setJeComposerFor(exc)} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Inline JE composer */}
      {jeComposerFor && !readOnly && (
        <InlineJEComposer exception={jeComposerFor} bankItem={rec.unmatchedBankItems.find((b) => b.id === jeComposerFor.bankItemId)} onCancel={() => setJeComposerFor(null)} onConfirm={handleCreateJE} />
      )}

      {/* Modals */}
      <BulkMatchRuleModal open={bulkRuleOpen} onClose={() => setBulkRuleOpen(false)} reconciliationId={rec.id} onApplied={handleBulkRuleApplied} />
      <CompleteReconciliationModal open={completeModalOpen} onClose={() => setCompleteModalOpen(false)} rec={rec} unresolvedCount={unresolvedCount} hasDifference={Math.abs(diff) > 0.001} isSoftClosed={isSoftClosed} onConfirm={handleComplete} />
      <ReconciliationHistorySlideOver open={historyOpen} onClose={() => setHistoryOpen(false)} accountId={rec.accountId} accountName={rec.accountId} onSelectHistorical={onSelectHistorical} />
      <Toast msg={toast} />
    </div>
  );
}

// ─── Small reusable components ───

// ActionBtn removed — replaced by ds/ActionButton

function ConfidencePill({ confidence }) {
  const { t } = useTranslation("reconciliation");
  const color = confidence >= 90 ? "var(--accent-primary)" : confidence >= 75 ? "#3b82f6" : confidence >= 50 ? "var(--semantic-warning)" : "var(--text-tertiary)";
  const label = confidence >= 90 ? t("confidence.high") : confidence >= 75 ? t("confidence.medium") : t("confidence.low");
  return (
    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color, background: `${color}1A`, border: `1px solid ${color}40`, padding: "2px 6px", borderRadius: 3 }}>
      {confidence}% · {label}
    </span>
  );
}

function TierPill({ tier }) {
  const { t } = useTranslation("reconciliation");
  const meta = TIER_PILL[tier] || TIER_PILL["manual"];
  return (
    <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", color: meta.color, background: `${meta.color}1A`, padding: "2px 5px", borderRadius: 3 }}>
      {t(`confidence.${meta.key}`)}
    </span>
  );
}

function SummaryCell({ label, value, highlight, onClick, clickable }) {
  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{ background: "var(--bg-surface-raised)", padding: "12px 16px", cursor: clickable ? "pointer" : "default", transition: "background 0.12s" }}
      onMouseEnter={(e) => { if (clickable) e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-surface-raised)"; }}
    >
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 16, color: highlight || "var(--text-primary)", fontWeight: 600, letterSpacing: "-0.5px" }}>{value}</div>
    </div>
  );
}

function StatementColumn({ title, sub, matchedCount, matchedItems, unmatched, exceptions, isBank }) {
  const { t } = useTranslation("reconciliation");
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "var(--bg-surface)" }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-secondary)" }}>{title}</div>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 3 }}>{sub}</div>
      </div>
      <div style={{ padding: "8px 0" }}>
        {/* Matched items — expandable */}
        <button onClick={() => setExpanded(!expanded)} style={{ width: "100%", padding: "8px 16px", display: "flex", alignItems: "center", gap: 8, color: "var(--text-tertiary)", fontSize: 11, borderBottom: "1px solid rgba(255,255,255,0.04)", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "start" }}>
          {expanded ? <ChevronDown size={12} color="var(--accent-primary)" /> : <ChevronRight size={12} color="var(--accent-primary)" />}
          <CheckCircle2 size={12} color="var(--accent-primary)" />
          <span style={{ color: "var(--text-secondary)" }}>{t("columns.matched_collapsed", { count: matchedCount })}</span>
        </button>
        {expanded && matchedItems && matchedItems.map((m) => (
          <div key={m.id} style={{ padding: "6px 16px 6px 36px", borderBottom: "1px solid rgba(255,255,255,0.02)", display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-tertiary)" }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10 }}>{m.bankItemId} ↔ {m.ledgerEntryId}</span>
            <TierPill tier={m.matchTier || "exact"} />
          </div>
        ))}
        {unmatched.length === 0 && !expanded ? (
          <div style={{ padding: "16px", textAlign: "center", color: "var(--text-tertiary)", fontSize: 12 }}>{t("columns.no_unmatched")}</div>
        ) : (
          unmatched.map((item) => {
            const exc = exceptions.find((e) => (isBank ? e.bankItemId : e.ledgerEntryId) === item.id);
            return <StatementRow key={item.id} item={item} exception={exc} isBank={isBank} />;
          })
        )}
      </div>
    </div>
  );
}

function StatementRow({ item, exception, isBank }) {
  const sev = exception
    ? exception.type === "amount-mismatch" || exception.type === "unidentified" || exception.type === "duplicate" ? "var(--semantic-warning)"
      : exception.type === "missing-ledger-entry" || exception.type === "bank-only" || exception.type === "ledger-only" ? "var(--semantic-danger)"
      : "var(--semantic-info)"
    : "var(--text-tertiary)";
  return (
    <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "flex-start", gap: 10 }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: sev, marginTop: 7, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <div style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.description}</div>
          <div style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: item.amount < 0 ? "var(--semantic-danger)" : "var(--text-primary)", fontWeight: 600, flexShrink: 0 }}>{fmtKWD(item.amount)}</div>
        </div>
        <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 3, display: "flex", gap: 8 }}>
          <span>{fmtDate(item.date)}</span>
          <span>·</span>
          <span style={{ fontFamily: "'DM Mono', monospace" }}><LtrText>{isBank ? item.reference : item.journalEntryId}</LtrText></span>
          {item.source && item.source !== "embedded" && (
            <span style={{ fontSize: 8, fontWeight: 600, letterSpacing: "0.1em", color: "#3b82f6", background: "rgba(59,130,246,0.1)", padding: "1px 4px", borderRadius: 2 }}>{item.source.toUpperCase()}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function ExceptionRow({ exc, readOnly, onResolve, onOpenJE }) {
  const { t } = useTranslation("reconciliation");
  const typeColors = {
    "unidentified": "var(--semantic-warning)",
    "amount-mismatch": "var(--semantic-warning)",
    "missing-ledger-entry": "var(--semantic-danger)",
    "date-mismatch": "var(--semantic-info)",
    "bank-only": "var(--semantic-danger)",
    "ledger-only": "var(--semantic-danger)",
    "duplicate": "var(--semantic-warning)",
  };
  const color = typeColors[exc.type] || "var(--text-secondary)";
  const typeKey = EXC_TYPE_KEY[exc.type];
  const typeLabel = typeKey ? t(`exceptions.${typeKey}`) : exc.type.replace(/-/g, " ").toUpperCase();

  return (
    <div style={{ padding: "12px 16px", background: exc.resolved ? "rgba(0,196,140,0.04)" : "var(--bg-surface)", border: `1px solid ${exc.resolved ? "rgba(0,196,140,0.2)" : "var(--border-default)"}`, borderInlineStart: `3px solid ${exc.resolved ? "var(--accent-primary)" : color}`, borderRadius: 6, display: "flex", alignItems: "flex-start", gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color, background: `${color}1A`, padding: "2px 6px", borderRadius: 3 }}>{typeLabel}</span>
          <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "'DM Mono', monospace" }}><LtrText>{exc.id}</LtrText></span>
          {exc.resolved && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--accent-primary)" }}>{t("exceptions.resolved")}</span>}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.5 }}>{exc.description}</div>
      </div>
      {!exc.resolved && !readOnly && (
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {(exc.suggestedAction === "create-je") && (
            <button onClick={onOpenJE} style={{ background: "var(--accent-primary)", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4 }}><Plus size={11} /> {t("exceptions.create_je")}</button>
          )}
          {exc.suggestedAction === "accept" && (
            <button onClick={() => onResolve(exc.id, t("exceptions.resolution_accepted"))} style={{ background: "var(--accent-primary)", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t("exceptions.accept_match")}</button>
          )}
          {exc.suggestedAction === "investigate" && (
            <button onClick={() => onResolve(exc.id, t("exceptions.resolution_investigated"))} style={{ background: "var(--border-subtle)", color: "var(--text-primary)", border: "1px solid rgba(255,255,255,0.15)", padding: "6px 12px", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t("exceptions.mark_resolved")}</button>
          )}
        </div>
      )}
    </div>
  );
}

function InlineJEComposer({ exception, bankItem, onCancel, onConfirm }) {
  const { t } = useTranslation("reconciliation");
  useEscapeKey(onCancel);
  const [debit, setDebit] = useState("6800 — Bank Charges");
  const [credit, setCredit] = useState("");

  useEffect(() => {
    let cancelled = false;
    getPrimaryOperatingAccount().then((acc) => { if (!cancelled && acc?.label) setCredit(acc.label); });
    return () => { cancelled = true; };
  }, []);

  if (!bankItem) return null;

  return (
    <>
      <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 480, background: "var(--bg-surface-raised)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, zIndex: 301, boxShadow: "0 24px 60px rgba(0,0,0,0.7)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>{t("je_composer.label")}</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--text-primary)", marginTop: 4 }}>{t("je_composer.title")}</div>
          </div>
          <button type="button" onClick={onCancel} aria-label={t("je_composer.close")} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ padding: "18px 22px" }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 14, lineHeight: 1.5 }}>{bankItem.description} · {fmtKWD(bankItem.amount)} · {fmtDate(bankItem.date)}</div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", color: "var(--text-tertiary)", marginBottom: 5 }}>{t("je_composer.debit_account")}</div>
            <input value={debit} onChange={(e) => setDebit(e.target.value)} style={{ width: "100%", background: "var(--bg-surface-sunken)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 6, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", color: "var(--text-tertiary)", marginBottom: 5 }}>{t("je_composer.credit_account")}</div>
            <input value={credit} onChange={(e) => setCredit(e.target.value)} style={{ width: "100%", background: "var(--bg-surface-sunken)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 6, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={onCancel} style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.15)", padding: "9px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>{t("je_composer.cancel")}</button>
          <button onClick={() => onConfirm(exception.bankItemId, debit, credit)} style={{ background: "var(--accent-primary)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>{t("je_composer.confirm")}</button>
        </div>
      </div>
    </>
  );
}
