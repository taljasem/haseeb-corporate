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
// Reconciliation — Track B Dispatch 5 wire 5 (2026-04-20).
//
// 11 endpoints / 12 wrappers wired via the engine surface:
//   • reopen, lock (OWNER only), import-statement, export (CSV), resolve-exception,
//     confirm-suggestion, dismiss-suggestion, create-journal-entry (WALL-GATED),
//     parse-statement, fiscal-period status, primary-operating resolver.
//
// STOPPED-AND-FLAGGED on mockEngine (shape mismatch too intrusive for this wire):
//   • getReconciliationDashboard → backend returns {period, rows} with a
//     different `status` vocabulary and NO currentReconciliationId; screen
//     navigates by id so adapter work would be invasive.
//   • getReconciliationById → backend returns {reconciliation, matches,
//     unmatchedStatements, unmatchedBookEntries, difference}; screen consumes
//     a RICH nested shape (pendingSuggestions, matchedItems[] with matchTier,
//     period:{month,year,label}, openingBalance/closingLedgerBalance,
//     exceptions[] with type+suggestedAction, etc.) that the current backend
//     doesn't surface. Follow-up wire scope.
//   • getReconciliationHistory, manualMatch, unmatch, completeReconciliation
//     remain on mockEngine for the same reason (shape-dependent on the mock
//     detail payload).
import {
  getReconciliationDashboard,
  getReconciliationById,
  completeReconciliation,
} from "../../engine/mockEngine";
import {
  reopenReconciliationLive,
  lockReconciliationLive,
  exportReconciliationCsv,
  getPrimaryOperatingAccountLive,
  confirmSuggestionLive,
  dismissSuggestionLive,
  resolveExceptionLive,
  createReconciliationJournalEntry,
  parseStatementLive,
  importStatementLive,
  getFiscalPeriodStatus,
} from "../../engine";
import { formatKWDAmount, formatDate } from "../../utils/format";

const STATUS_META = {
  "completed":        { key: "completed",        color: "var(--accent-primary)",   icon: CheckCircle2 },
  "in-progress":      { key: "in_progress",      color: "var(--semantic-warning)", icon: Circle },
  "not-started":      { key: "not_started",       color: "var(--text-tertiary)",    icon: Circle },
  "locked":           { key: "locked",            color: "var(--text-tertiary)",    icon: Lock },
  "pending-approval": { key: "pending_approval",  color: "var(--semantic-info)", icon: Clock },
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
  "fuzzy-confirmed":  { color: "var(--semantic-info)",    key: "fuzzy_confirmed" },
  "manual":           { color: "var(--text-secondary)",    key: "manual" },
  "bulk-rule":        { color: "var(--role-owner)",        key: "bulk_rule" },
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
  const color = msg.type === "error" ? "var(--semantic-danger)" : msg.type === "info" ? "var(--semantic-info)" : "var(--accent-primary)";
  const bg = msg.type === "error" ? "var(--semantic-danger-subtle)" : msg.type === "info" ? "var(--semantic-info-subtle)" : "var(--accent-primary-subtle)";
  const border = msg.type === "error" ? "var(--semantic-danger-border)" : `color-mix(in srgb, ${color} 35%, transparent)`;
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
      <div style={{ padding: "20px 28px 16px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
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
      style={{ textAlign: "start", background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 10, padding: "16px 18px", cursor: row.currentReconciliationId ? "pointer" : "default", fontFamily: "inherit", color: "var(--text-primary)", transition: "all 0.15s" }}
      onMouseEnter={(e) => { if (row.currentReconciliationId) { e.currentTarget.style.borderColor = "var(--accent-primary-border)"; e.currentTarget.style.background = "var(--accent-primary-subtle)"; } }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-default)"; e.currentTarget.style.background = "var(--bg-surface)"; }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}><LtrText>{row.bankName} · {row.accountNumberMasked}</LtrText></div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)", marginTop: 4 }}>{row.accountName}</div>
        </div>
        <StatusPill status={row.status} />
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ height: 6, background: "var(--border-subtle)", borderRadius: 3, overflow: "hidden" }}>
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
    <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: meta.color, background: `color-mix(in srgb, ${meta.color} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${meta.color} 25%, transparent)`, padding: "4px 8px", borderRadius: 4 }}>
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
  // Lock modal (wire 5) — OWNER-only, requires `reason`.
  const [lockModalOpen, setLockModalOpen] = useState(false);
  const [lockReasonDraft, setLockReasonDraft] = useState("");
  const [locking, setLocking] = useState(false);
  // HASEEB-154 short-term mitigation: live writes land on the backend,
  // but reads (getReconciliationById / completeReconciliation / manual
  // match / unmatch / history) remain on mockEngine pending HASEEB-150
  // backend DTO enrichment. Full adapter-layer swap is STOP-AND-FLAG
  // territory (5+ invented fields — pendingSuggestions, matchedItems
  // with matchTier, unmatched{Bank,Ledger}Items, exceptions with
  // type+suggestedAction, period:{month,year,label}, openingBalance,
  // closingLedgerBalance, reconciliationDifference, total* counters).
  // Until HASEEB-150 ships, warn the user after live writes so the
  // mock-read/live-write inconsistency is visible, not silent.
  const [staleWriteBannerVisible, setStaleWriteBannerVisible] = useState(false);
  const fileInputRef = useRef(null);
  const bannerShownRef = useRef(null);
  const suggestionsRef = useRef(null);
  const exceptionsRef = useRef(null);
  const [matchedExpanded, setMatchedExpanded] = useState({ bank: false, ledger: false });

  // Auto-match banner on first load — PersistentBanner handles dismiss timing
  useEffect(() => {
    if (rec && rec.id !== bannerShownRef.current) {
      bannerShownRef.current = rec.id;
      setBannerVisible(true);
    }
  }, [rec?.id]);

  // Check period status for complete modal.
  // Live wrapper `getFiscalPeriodStatus(year, month)` returns
  // { year, month, status: 'open'|'soft-closed'|'hard-closed'|'locked',
  //   canEditReconciliations, isApprovalRequired }. Status uses the same
  // hyphenated lowercase vocabulary as the legacy mockEngine path.
  useEffect(() => {
    if (rec?.period?.year && rec?.period?.month) {
      getFiscalPeriodStatus(rec.period.year, rec.period.month).then((ps) => {
        setIsSoftClosed(ps?.status === "soft-closed");
      }).catch(() => { /* non-blocking; UI still allows complete attempt */ });
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
  // All four below go through the live wrappers (wire 5). Author arg is
  // dropped — the backend derives identity from JWT. Errors (400 period
  // closed, 403 locked, 404 stale id, etc.) surface via the existing
  // toast pattern.
  const handleResolve = async (excId, resolution) => {
    try {
      await resolveExceptionLive(rec.id, excId, { resolution });
      await onReload();
      setStaleWriteBannerVisible(true); // HASEEB-154 mitigation
      showToast(t("exceptions.resolution_accepted"));
    } catch (err) {
      showToast(err?.message || t("errors.resolve_failed"), "error");
    }
  };
  const handleCreateJE = async (excBankItemId, debit, credit) => {
    const bi = rec.unmatchedBankItems.find((b) => b.id === excBankItemId);
    if (!bi) return;
    // The live endpoint takes AccountRole strings (not freeform labels).
    // The InlineJEComposer currently prefills debit with a localized
    // label and credit from the primary-operating resolver. We pass the
    // composer inputs through as-is; backend `resolveLineAccountRefs`
    // throws a clear ValidationError on unknown roles and we surface
    // that as a toast. Phase 4 UX decision flagged: this keeps the
    // composer's free-text UX; a future wire can switch to a curated
    // role dropdown (e.g. BANK_CHARGES_EXPENSE / BANK_PRIMARY / ...).
    // exceptionId is the currently-open composer's source exception id,
    // if any — the backend resolves the exception with a back-link to
    // the new JE when provided.
    const excId = jeComposerFor?.id;
    try {
      await createReconciliationJournalEntry(rec.id, {
        bankItemId: excBankItemId,
        debitRole: debit,
        creditRole: credit,
        amountKwd: String(Math.abs(Number(bi.amount)).toFixed(3)),
        exceptionId: excId,
      });
      setJeComposerFor(null);
      await onReload();
      setStaleWriteBannerVisible(true); // HASEEB-154 mitigation
      showToast(t("je_composer.confirm"));
    } catch (err) {
      showToast(err?.message || t("errors.create_je_failed"), "error");
    }
  };
  const handleConfirmSuggestion = async (suggId) => {
    try {
      await confirmSuggestionLive(rec.id, suggId);
      await onReload();
      setStaleWriteBannerVisible(true); // HASEEB-154 mitigation
      showToast(t("suggestions.confirm_button"));
    } catch (err) {
      showToast(err?.message || t("errors.confirm_failed"), "error");
    }
  };
  const handleDismissSuggestion = async (suggId) => {
    try {
      await dismissSuggestionLive(rec.id, suggId);
      await onReload();
      setStaleWriteBannerVisible(true); // HASEEB-154 mitigation
    } catch (err) {
      showToast(err?.message || t("errors.dismiss_failed"), "error");
    }
  };

  const handleComplete = async (force) => {
    const result = await completeReconciliation(rec.id, author, force ? { force: true } : {});
    setCompleteModalOpen(false);
    if (result?.error) { showToast(result.error, "error"); return; }
    if (result?.requiresApproval) { showToast(t("complete.pending_approval_toast"), "info"); }
    else { showToast(t("complete.completed_toast")); }
    await onReload();
  };
  const handleReopen = async () => {
    try {
      await reopenReconciliationLive(rec.id);
      await onReload();
      setStaleWriteBannerVisible(true); // HASEEB-154 mitigation
      showToast(t("complete.reopened_toast"));
    } catch (err) {
      showToast(err?.message || t("errors.reopen_failed"), "error");
    }
  };

  // Lock handler (wire 5). OWNER only — we gate the trigger visually on
  // `role === "Owner"` and the backend re-checks at the route layer.
  // `reason` is required (1..500 chars) per the D5 schema.
  const handleLockConfirm = async () => {
    const reason = lockReasonDraft.trim();
    if (!reason) {
      showToast(t("lock_modal.reason_required_toast"), "error");
      return;
    }
    setLocking(true);
    try {
      await lockReconciliationLive(rec.id, { reason });
      setLockModalOpen(false);
      setLockReasonDraft("");
      await onReload();
      setStaleWriteBannerVisible(true); // HASEEB-154 mitigation
      showToast(t("lock_modal.locked_toast"));
    } catch (err) {
      showToast(err?.message || t("errors.lock_failed"), "error");
    } finally {
      setLocking(false);
    }
  };

  const handleExport = async () => {
    try {
      const result = await exportReconciliationCsv(rec.id);
      if (!result?.csvText) { showToast(t("errors.export_failed"), "error"); return; }
      showToast(t("export.downloading", { filename: result.filename }), "info");
      const blob = new Blob(["\uFEFF" + result.csvText], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = result.filename;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast(err?.message || t("errors.export_failed"), "error");
    }
  };

  // Live parse + import flow (wire 5). The backend `parse-statement`
  // endpoint uses the active BankFormatSpec (D5b) to tokenise the CSV;
  // response carries `{items, warnings, errors, formatUsed}`. The
  // subsequent `import-statement` endpoint persists the items and
  // reports `{imported, duplicateSkipped, reconciliation}`.
  //
  // Phase 4 UX decision flagged: warnings from the parser are surfaced
  // as a compact one-liner under the drop zone (existing UI pattern);
  // errors are surfaced as an error toast and abort import. The
  // `formatUsed` object is NOT shown in this wire — the drop zone has
  // no slot for it; a future wire can add a "(NBK format, v1)" chip.
  const handleCSVFile = async (file) => {
    if (file.size > 5 * 1024 * 1024) { showToast(t("upload.error_too_large"), "error"); return; }
    if (!file.name.toLowerCase().endsWith(".csv")) { showToast(t("upload.error_wrong_type"), "error"); return; }
    setUploadState("parsing");
    try {
      const csvText = await file.text();
      const parseResult = await parseStatementLive({ csvText });
      if (parseResult?.errors?.length > 0) {
        showToast(parseResult.errors[0], "error");
        setUploadState("idle");
        return;
      }
      const items = parseResult?.items || [];
      if (items.length === 0) {
        showToast(t("errors.parse_failed"), "error");
        setUploadState("idle");
        return;
      }
      const importResult = await importStatementLive(rec.id, {
        items,
        filename: file.name,
      });
      if (parseResult.warnings?.length > 0) setUploadWarnings(parseResult.warnings);
      const importedCount = importResult?.imported ?? items.length;
      const dupSkipped = importResult?.duplicateSkipped ?? 0;
      const suffix = dupSkipped > 0 ? ` (${dupSkipped} duplicates skipped)` : "";
      showToast(t("upload.success_title") + ` — ${importedCount} items${suffix}`, "success");
      setUploadState("idle");
      await onReload();
      setStaleWriteBannerVisible(true); // HASEEB-154 mitigation
    } catch (err) {
      showToast(err?.message || t("errors.upload_failed"), "error");
      setUploadState("idle");
    }
  };

  const handleBulkRuleApplied = async (result) => {
    showToast(t("bulk_rule.applied_toast", { count: result?.matchedCount || 0 }));
    await onReload();
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Read-only banner */}
      {readOnly && (
        <div style={{ padding: "8px 28px", background: "var(--semantic-info-subtle)", borderBottom: "1px solid var(--semantic-info)", fontSize: 11, fontWeight: 600, color: "var(--semantic-info)", display: "flex", alignItems: "center", gap: 8 }}>
          <History size={12} /> {t("history.title")} — {rec.period.label}
        </div>
      )}

      {/* HASEEB-154 stale-write banner — visible after a live-write action
          lands on the backend, because the read surface
          (getReconciliationById / completeReconciliation / history /
          manualMatch / unmatch) still uses mockEngine pending the
          HASEEB-150 backend DTO enrichment. Dismisses on close. */}
      {!readOnly && staleWriteBannerVisible && (
        <div
          role="status"
          style={{
            padding: "8px 28px",
            background: "var(--semantic-warning-subtle)",
            borderBottom: "1px solid var(--semantic-warning)",
            fontSize: 11,
            fontWeight: 600,
            color: "var(--semantic-warning)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={12} />
            {t("stale_read.banner")}
          </span>
          <button
            type="button"
            onClick={() => setStaleWriteBannerVisible(false)}
            aria-label={t("stale_read.dismiss_aria")}
            style={{ background: "transparent", border: "none", color: "var(--semantic-warning)", cursor: "pointer", padding: 4, lineHeight: 1 }}
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: "16px 28px 12px", borderBottom: "1px solid var(--border-subtle)", flexShrink: 0 }}>
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
            {/* Lock — OWNER only, COMPLETED sessions, not already locked.
                Backend re-enforces OWNER role at the route layer; the UI
                only shows the affordance to OWNER to avoid a guaranteed 403. */}
            {!readOnly && role === "Owner" && rec.status === "completed" && (
              <ActionButton variant="secondary" size="md" icon={Lock} label={t("lock_modal.lock_button_label")} onClick={() => setLockModalOpen(true)} />
            )}
            {/* Complete — in-progress only */}
            {!readOnly && rec.status === "in-progress" && (
              <button onClick={() => setCompleteModalOpen(true)} disabled={false} style={{ background: isClean ? "var(--accent-primary)" : "var(--border-subtle)", color: isClean ? "#fff" : "var(--text-secondary)", border: isClean ? "none" : "1px solid var(--border-strong)", padding: "8px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
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
      <div style={{ display: "grid", gridTemplateColumns: suggestionsCount > 0 ? "repeat(5, 1fr)" : "repeat(4, 1fr)", gap: 1, background: "var(--border-subtle)", margin: "14px 28px 0", border: "1px solid var(--border-default)", borderRadius: 8, overflow: "hidden" }}>
        <SummaryCell label={t("summary.opening_balance")} value={fmtKWD(rec.openingBalance)} />
        <SummaryCell label={t("summary.closing_bank")} value={fmtKWD(rec.closingBalance)} />
        <SummaryCell label={t("summary.closing_ledger")} value={fmtKWD(rec.closingLedgerBalance)} />
        <SummaryCell label={t("summary.difference")} value={fmtKWD(diff)} highlight={Math.abs(diff) < 0.001 ? "var(--accent-primary)" : "var(--semantic-warning)"} onClick={() => exceptionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} clickable={unresolvedCount > 0} />
        {suggestionsCount > 0 && <SummaryCell label="PENDING REVIEW" value={String(suggestionsCount)} highlight="var(--semantic-info)" onClick={() => suggestionsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} clickable />}
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
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", color: "var(--semantic-info)", marginBottom: 10, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Sparkles size={12} />
              {t("suggestions.title")} · {t("suggestions.subtitle", { count: suggestionsCount })}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rec.pendingSuggestions.map((sugg) => {
                const bankItem = rec.unmatchedBankItems.find((b) => b.id === sugg.bankItemId);
                const ledgerItem = rec.unmatchedLedgerItems.find((l) => l.id === sugg.ledgerEntryId);
                const stale = !bankItem || !ledgerItem;
                return (
                  <div key={sugg.id} style={{ padding: "12px 16px", background: stale ? "var(--bg-surface)" : "var(--semantic-info-subtle)", border: `1px solid ${stale ? "var(--border-subtle)" : "var(--semantic-info)"}`, borderRadius: 8 }}>
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
                          <button onClick={() => handleConfirmSuggestion(sugg.id)} style={{ background: "var(--semantic-info)", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t("suggestions.confirm_button")}</button>
                        )}
                        <button onClick={() => handleDismissSuggestion(sugg.id)} style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-strong)", padding: "6px 12px", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t("suggestions.dismiss_button")}</button>
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
          <div style={{ marginBottom: 14, padding: "14px 18px", background: "color-mix(in srgb, var(--role-owner) 6%, transparent)", border: "1px solid color-mix(in srgb, var(--role-owner) 20%, transparent)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 6 }}><Sparkles size={14} color="var(--role-owner)" /> {t("bulk_rule.cta_title")}</div>
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
      <LockReconciliationModal
        open={lockModalOpen}
        onClose={() => { if (!locking) { setLockModalOpen(false); setLockReasonDraft(""); } }}
        reason={lockReasonDraft}
        onReasonChange={setLockReasonDraft}
        onConfirm={handleLockConfirm}
        locking={locking}
      />
      <Toast msg={toast} />
    </div>
  );
}

// Lock Reconciliation Modal (wire 5). OWNER-only — see the role gate on
// the trigger button. Backend enforces role + requires a non-empty
// `reason` (1..500 chars). On success the session transitions to
// `locked` and further writes are refused until explicit unlock.
function LockReconciliationModal({ open, onClose, reason, onReasonChange, onConfirm, locking }) {
  // HASEEB-158: modal was entirely hardcoded English. Wired through
  // `useTranslation` here rather than threading a `t` prop from the parent
  // because the pattern matches every other sub-component in this file
  // (StatusPill, ConfidencePill, TierPill, StatementColumn, ExceptionRow,
  // InlineJEComposer — all call `useTranslation("reconciliation")` directly).
  const { t } = useTranslation("reconciliation");
  useEscapeKey(onClose, open);
  if (!open) return null;
  const trimmed = (reason || "").trim();
  const canConfirm = trimmed.length > 0 && !locking;
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "var(--overlay-backdrop)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 460, background: "var(--panel-bg)", border: "1px solid var(--border-default)", borderRadius: 12, zIndex: 301, boxShadow: "var(--shadow-xl)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Lock size={16} color="var(--semantic-warning)" />
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--text-primary)" }}>{t("lock_modal.title")}</div>
          </div>
          <button type="button" onClick={onClose} aria-label={t("lock_modal.close_aria")} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ padding: "18px 22px" }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 14 }}>
            {t("lock_modal.description")}
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", color: "var(--text-tertiary)", marginBottom: 5 }}>{t("lock_modal.reason_label")}</div>
            <textarea
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder={t("lock_modal.reason_placeholder")}
              style={{ width: "100%", background: "var(--bg-surface-sunken)", border: "1px solid var(--border-default)", borderRadius: 6, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical" }}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid var(--border-subtle)" }}>
          <button type="button" onClick={onClose} disabled={locking} style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-strong)", padding: "9px 16px", borderRadius: 6, cursor: locking ? "not-allowed" : "pointer", fontSize: 12, fontFamily: "inherit" }}>{t("lock_modal.cancel")}</button>
          <button type="button" onClick={onConfirm} disabled={!canConfirm} style={{ background: canConfirm ? "var(--semantic-warning)" : "var(--border-subtle)", color: canConfirm ? "#fff" : "var(--text-tertiary)", border: "none", padding: "9px 18px", borderRadius: 6, cursor: canConfirm ? "pointer" : "not-allowed", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
            {locking ? t("lock_modal.locking") : t("lock_modal.lock")}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Small reusable components ───

// ActionBtn removed — replaced by ds/ActionButton

function ConfidencePill({ confidence }) {
  const { t } = useTranslation("reconciliation");
  const color = confidence >= 90 ? "var(--accent-primary)" : confidence >= 75 ? "var(--semantic-info)" : confidence >= 50 ? "var(--semantic-warning)" : "var(--text-tertiary)";
  const label = confidence >= 90 ? t("confidence.high") : confidence >= 75 ? t("confidence.medium") : t("confidence.low");
  return (
    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color, background: `color-mix(in srgb, ${color} 10%, transparent)`, border: `1px solid color-mix(in srgb, ${color} 25%, transparent)`, padding: "2px 6px", borderRadius: 3 }}>
      {confidence}% · {label}
    </span>
  );
}

function TierPill({ tier }) {
  const { t } = useTranslation("reconciliation");
  const meta = TIER_PILL[tier] || TIER_PILL["manual"];
  return (
    <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.1em", color: meta.color, background: `color-mix(in srgb, ${meta.color} 10%, transparent)`, padding: "2px 5px", borderRadius: 3 }}>
      {t(`confidence.${meta.key}`)}
    </span>
  );
}

function SummaryCell({ label, value, highlight, onClick, clickable }) {
  return (
    <div
      onClick={clickable ? onClick : undefined}
      style={{ background: "var(--bg-surface-raised)", padding: "12px 16px", cursor: clickable ? "pointer" : "default", transition: "background 0.12s" }}
      onMouseEnter={(e) => { if (clickable) e.currentTarget.style.background = "var(--bg-hover)"; }}
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
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-surface)" }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-secondary)" }}>{title}</div>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 3 }}>{sub}</div>
      </div>
      <div style={{ padding: "8px 0" }}>
        {/* Matched items — expandable */}
        <button onClick={() => setExpanded(!expanded)} style={{ width: "100%", padding: "8px 16px", display: "flex", alignItems: "center", gap: 8, color: "var(--text-tertiary)", fontSize: 11, borderBottom: "1px solid var(--border-subtle)", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "start" }}>
          {expanded ? <ChevronDown size={12} color="var(--accent-primary)" /> : <ChevronRight size={12} color="var(--accent-primary)" />}
          <CheckCircle2 size={12} color="var(--accent-primary)" />
          <span style={{ color: "var(--text-secondary)" }}>{t("columns.matched_collapsed", { count: matchedCount })}</span>
        </button>
        {expanded && matchedItems && matchedItems.map((m) => (
          <div key={m.id} style={{ padding: "6px 16px 6px 36px", borderBottom: "1px solid var(--bg-surface)", display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--text-tertiary)" }}>
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
    <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "flex-start", gap: 10 }}>
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
            <span style={{ fontSize: 8, fontWeight: 600, letterSpacing: "0.1em", color: "var(--semantic-info)", background: "var(--semantic-info-subtle)", padding: "1px 4px", borderRadius: 2 }}>{item.source.toUpperCase()}</span>
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
    <div style={{ padding: "12px 16px", background: exc.resolved ? "var(--accent-primary-subtle)" : "var(--bg-surface)", border: `1px solid ${exc.resolved ? "var(--accent-primary-border)" : "var(--border-default)"}`, borderInlineStart: `3px solid ${exc.resolved ? "var(--accent-primary)" : color}`, borderRadius: 6, display: "flex", alignItems: "flex-start", gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color, background: `color-mix(in srgb, ${color} 10%, transparent)`, padding: "2px 6px", borderRadius: 3 }}>{typeLabel}</span>
          <span style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "'DM Mono', monospace" }}><LtrText>{exc.id}</LtrText></span>
          {exc.resolved && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--accent-primary)" }}>{t("exceptions.resolved")}</span>}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.5 }}>{exc.description}</div>
      </div>
      {!exc.resolved && !readOnly && (
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {(exc.suggestedAction === "create-je") && (
            <button onClick={onOpenJE} style={{ background: "var(--accent-primary)", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 4 }}><Plus size={11} /> {t("exceptions.create_and_resolve")}</button>
          )}
          {exc.suggestedAction === "accept" && (
            <button onClick={() => onResolve(exc.id, t("exceptions.resolution_accepted"))} style={{ background: "var(--accent-primary)", color: "#fff", border: "none", padding: "6px 12px", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t("exceptions.accept_match")}</button>
          )}
          {exc.suggestedAction === "investigate" && (
            <button onClick={() => onResolve(exc.id, t("exceptions.resolution_investigated"))} style={{ background: "var(--border-subtle)", color: "var(--text-primary)", border: "1px solid var(--border-strong)", padding: "6px 12px", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{t("exceptions.mark_resolved")}</button>
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

  // Prefill credit side with the tenant's primary operating bank account
  // label via the live wrapper. Live shape is richer than mock; we use
  // `accountName` (mock MOCK-mode adapter mirrors it from the legacy
  // `label` field, see src/engine/index.js buildMockExtras). Failure is
  // non-fatal — user can type the account manually.
  useEffect(() => {
    let cancelled = false;
    getPrimaryOperatingAccountLive()
      .then((acc) => {
        if (cancelled) return;
        const label = acc?.accountName || acc?.label || "";
        if (label) setCredit(label);
      })
      .catch(() => { /* non-fatal */ });
    return () => { cancelled = true; };
  }, []);

  if (!bankItem) return null;

  return (
    <>
      <div onClick={onCancel} style={{ position: "fixed", inset: 0, background: "var(--overlay-backdrop)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 480, background: "var(--panel-bg)", border: "1px solid var(--border-default)", borderRadius: 12, zIndex: 301, boxShadow: "var(--shadow-xl)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid var(--border-subtle)" }}>
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
            <input value={debit} onChange={(e) => setDebit(e.target.value)} style={{ width: "100%", background: "var(--bg-surface-sunken)", border: "1px solid var(--border-default)", borderRadius: 6, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", color: "var(--text-tertiary)", marginBottom: 5 }}>{t("je_composer.credit_account")}</div>
            <input value={credit} onChange={(e) => setCredit(e.target.value)} style={{ width: "100%", background: "var(--bg-surface-sunken)", border: "1px solid var(--border-default)", borderRadius: 6, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none" }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid var(--border-subtle)" }}>
          <button onClick={onCancel} style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-strong)", padding: "9px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>{t("je_composer.cancel")}</button>
          <button onClick={() => onConfirm(exception.bankItemId, debit, credit)} style={{ background: "var(--accent-primary)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>{t("je_composer.confirm")}</button>
        </div>
      </div>
    </>
  );
}
