import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Circle, Clock, AlertTriangle, CheckCircle2, Paperclip, PlayCircle, X, RefreshCw, RotateCcw, Download, ChevronDown, ChevronRight, Shield, Eye } from "lucide-react";
import EmptyState from "../../components/shared/EmptyState";
import Spinner from "../../components/shared/Spinner";
import AminahNarrationCard from "../../components/financial/AminahNarrationCard";
import Avatar from "../../components/taskbox/Avatar";
import LtrText from "../../components/shared/LtrText";
import { useTenant } from "../../components/shared/TenantContext";
import ActionButton from "../../components/ds/ActionButton";
import PersistentBanner from "../../components/ds/PersistentBanner";
import DropZone from "../../components/ds/DropZone";
import SubmitCloseConfirmationModal from "../../components/month-end/SubmitCloseConfirmationModal";
import RejectCloseModal from "../../components/month-end/RejectCloseModal";
import {
  getMonthEndCloseTasks,
  getCloseStatusDetail,
  markCloseItemComplete,
  runPreCloseValidations,
  approveCloseAndSyncTask,
  getCloseSummary,
  exportClosePackage,
  reopenPeriodClose,
  recalculateCloseChecks,
  overrideCloseCheck,
  addCloseCheckNote,
  getCloseCheckNotes,
  attachCloseCheckFile,
  getCloseCheckAttachments,
} from "../../engine/mockEngine";
import { emitTaskboxChange } from "../../utils/taskboxBus";
import { formatRelativeTime } from "../../utils/relativeTime";

const STATUS = {
  complete:      { key: "complete",    color: "var(--text-tertiary)",  Icon: Check,          iconColor: "var(--accent-primary)" },
  "in-progress": { key: "in_progress", color: "var(--semantic-info)",  Icon: Clock,          iconColor: "var(--semantic-info)" },
  pending:       { key: "pending",     color: "var(--text-tertiary)",  Icon: Circle,         iconColor: "var(--text-tertiary)" },
  blocked:       { key: "blocked",     color: "var(--semantic-danger)",Icon: AlertTriangle,  iconColor: "var(--semantic-danger)" },
};

function normalizeRole(r) {
  if (!r) return "Owner";
  const s = String(r).toLowerCase();
  if (s.startsWith("cfo")) return "CFO";
  return "Owner";
}

const CLOSE_STATUS_PILL = {
  not_started:      { key: "status_not_started",      color: "var(--text-tertiary)" },
  in_progress:      { key: "status_in_progress",      color: "var(--semantic-info)" },
  pending_approval: { key: "status_pending_approval", color: "var(--semantic-warning)" },
  approved:         { key: "status_approved",         color: "var(--accent-primary)" },
};

export default function MonthEndCloseScreen({ role: roleRaw = "Owner", onNavigate }) {
  const role = normalizeRole(roleRaw);
  const { t } = useTranslation("close");
  const { t: tc } = useTranslation("common");
  const { tenant } = useTenant();
  const [data, setData] = useState(null);
  const [closeStatus, setCloseStatus] = useState(null);
  const [expandedItemId, setExpandedItemId] = useState(null);
  const [locallyCompleted, setLocallyCompleted] = useState({});
  const [validations, setValidations] = useState(null);
  const [runningValidations, setRunningValidations] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [toast, setToast] = useState(null);
  // 20D-5 additions
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [closeSummary, setCloseSummary] = useState(null);
  const [expandedCheckId, setExpandedCheckId] = useState(null);
  const [checkNotes, setCheckNotes] = useState([]);
  const [checkAttachments, setCheckAttachments] = useState([]);
  const [checkNoteDraft, setCheckNoteDraft] = useState("");
  const [overrideCheckId, setOverrideCheckId] = useState(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [refreshingChecks, setRefreshingChecks] = useState(false);

  const reloadStatus = () => getCloseStatusDetail().then(setCloseStatus);

  // Auto-refresh on window focus
  useEffect(() => {
    const onFocus = () => {
      getMonthEndCloseTasks().then(setData);
      reloadStatus();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    getMonthEndCloseTasks().then(setData);
    reloadStatus();
  }, []);

  const showToast = (text) => {
    setToast(text);
    setTimeout(() => setToast(null), 2500);
  };

  if (!data) return <div style={{ padding: 28, color: "var(--text-tertiary)" }}>{t("loading")}</div>;

  const tasks = (Array.isArray(data?.tasks) ? data.tasks : []).map((task) =>
    locallyCompleted[task.id]
      ? { ...task, status: "complete", completedAt: locallyCompleted[task.id].completedAt }
      : task
  );
  const complete = tasks.filter((x) => x.status === "complete").length;
  const total = tasks.length;
  const pct = total > 0 ? Math.round((complete / total) * 100) : 0;
  const allComplete = total > 0 && complete === total;

  const order = { complete: 0, "in-progress": 1, pending: 2, blocked: 3 };
  const sorted = [...tasks].sort((a, b) => order[a.status] - order[b.status]);

  const statusPillLegacy = {
    "in-progress": { key: "in_progress", color: "var(--accent-primary)" },
    "ready":       { key: "ready", color: "var(--semantic-warning)" },
    "closed":      { key: "closed", color: "var(--text-tertiary)" },
  }[data.status] || { key: "in_progress", color: "var(--accent-primary)" };

  const closePillMeta = CLOSE_STATUS_PILL[closeStatus?.status] || CLOSE_STATUS_PILL.in_progress;
  const isLocked = closeStatus?.status === "approved";
  const isPending = closeStatus?.status === "pending_approval";
  const editable = role === "CFO" && !isLocked && !isPending;

  const handleMarkComplete = async (itemId, notes, attachments) => {
    const r = await markCloseItemComplete(itemId, notes, attachments);
    setLocallyCompleted((prev) => ({ ...prev, [itemId]: r }));
    setExpandedItemId(null);
    reloadStatus();
  };

  const handleRunValidations = async () => {
    setRunningValidations(true);
    const v = await runPreCloseValidations(closeStatus?.period || "March 2026");
    setValidations(v);
    setRunningValidations(false);
  };

  const handleApprove = async () => {
    await approveCloseAndSyncTask(closeStatus?.period || "March 2026");
    emitTaskboxChange();
    reloadStatus();
    showToast(t("owner_approval.approved_toast"));
  };

  // 20D-5 handlers
  const handleRefreshChecks = async () => {
    setRefreshingChecks(true);
    await recalculateCloseChecks(period);
    const freshData = await getMonthEndCloseTasks();
    setData(freshData);
    reloadStatus();
    setRefreshingChecks(false);
    showToast(t("checks.refresh_all"));
  };

  const handleExportClose = async () => {
    const result = await exportClosePackage(period, "csv");
    if (!result?.csvText) return;
    const blob = new Blob(["\uFEFF" + result.csvText], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = result.filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(t("post_close.export_package"));
  };

  const handleReopen = async () => {
    if (!reopenReason.trim()) return;
    const author = role === "CFO" ? "cfo" : "owner";
    const result = await reopenPeriodClose(period, reopenReason.trim(), author);
    setReopenOpen(false); setReopenReason("");
    if (result?.requiresApproval) { showToast(t("reopen.pending_approval_toast")); }
    else if (result?.success) { showToast(t("reopen.reopened_toast")); reloadStatus(); const freshData = await getMonthEndCloseTasks(); setData(freshData); }
    else if (result?.error) { showToast(result.error); }
    emitTaskboxChange();
  };

  const openSummary = async () => {
    const s = await getCloseSummary(period);
    setCloseSummary(s);
    setSummaryOpen(true);
  };

  const expandCheck = async (checkId) => {
    if (expandedCheckId === checkId) { setExpandedCheckId(null); return; }
    setExpandedCheckId(checkId);
    const notes = await getCloseCheckNotes(period, checkId);
    setCheckNotes(notes || []);
    const atts = await getCloseCheckAttachments(period, checkId);
    setCheckAttachments(atts || []);
  };

  const handleAddCheckNote = async () => {
    if (!checkNoteDraft.trim() || !expandedCheckId) return;
    const author = role === "CFO" ? "cfo" : "owner";
    await addCloseCheckNote(period, expandedCheckId, checkNoteDraft.trim(), author);
    setCheckNoteDraft("");
    const notes = await getCloseCheckNotes(period, expandedCheckId);
    setCheckNotes(notes || []);
  };

  const handleAttachCheckFile = async (file) => {
    if (!expandedCheckId) return;
    const author = role === "CFO" ? "cfo" : "owner";
    await attachCloseCheckFile(period, expandedCheckId, file, author);
    const atts = await getCloseCheckAttachments(period, expandedCheckId);
    setCheckAttachments(atts || []);
  };

  const handleOverrideCheck = async () => {
    if (!overrideReason.trim() || !overrideCheckId) return;
    const author = role === "CFO" ? "cfo" : "owner";
    await overrideCloseCheck(period, overrideCheckId, overrideReason.trim(), author);
    setOverrideCheckId(null); setOverrideReason("");
    await handleRefreshChecks();
  };

  const heroAccent = role === "CFO" ? "var(--accent-primary)" : "var(--role-owner)";
  const period = closeStatus?.period || data?.period || "March 2026";
  const day = closeStatus?.day || 5;
  const totalDays = closeStatus?.totalDays || 8;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* CFO hero band */}
      {role === "CFO" && (
        <div
          style={{
            padding: "22px 28px 18px",
            borderBottom: "1px solid var(--border-subtle)",
            background: `linear-gradient(180deg, ${heroAccent}1A 0%, transparent 100%)`,
            flexShrink: 0,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--accent-primary)" }}>
              {t("cfo.view_label")}
            </div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, color: "var(--text-primary)", letterSpacing: "-0.3px", marginTop: 2, lineHeight: 1 }}>
              {t("title")}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginTop: 6 }}>
              {t("cfo.hero_subtitle", { period, day, total: totalDays })}
            </div>
          </div>
          <div
            style={{
              fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
              color: closePillMeta.color,
              background: `${closePillMeta.color}14`,
              border: `1px solid ${closePillMeta.color}55`,
              padding: "6px 12px", borderRadius: 4,
            }}
          >
            {t(`cfo.close_status_label`)} · {t(`cfo.${closePillMeta.key}`)}
          </div>
          {/* 20D-5: Action buttons */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <ActionButton variant="secondary" size="sm" icon={RefreshCw} label={t("checks.refresh_all")} onClick={handleRefreshChecks} disabled={refreshingChecks} />
            <ActionButton variant="secondary" size="sm" icon={Download} label={t("post_close.export_package")} onClick={handleExportClose} />
            {isLocked && <ActionButton variant="secondary" size="sm" icon={Eye} label={t("post_close.view_summary")} onClick={openSummary} />}
            {isLocked && <ActionButton variant="secondary" size="sm" icon={RotateCcw} label={t("post_close.reopen_button")} onClick={() => setReopenOpen(true)} />}
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px 32px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          {/* Owner-style header (Owner role only) */}
          {role === "Owner" && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 18,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: "var(--text-primary)", letterSpacing: "-0.3px", lineHeight: 1 }}>
                  {t("title")}
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginTop: 6 }}>
                  {(data.period || period).toUpperCase()}
                </div>
              </div>
              <span
                style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
                  color: statusPillLegacy.color,
                  background: `${statusPillLegacy.color}14`,
                  border: `1px solid ${statusPillLegacy.color}55`,
                  padding: "5px 10px", borderRadius: 4,
                }}
              >
                {t(`status_pill.${statusPillLegacy.key}`)}
              </span>
            </div>
          )}

          {/* Rejection banner */}
          {closeStatus?.rejectionReason && closeStatus?.status === "in_progress" && (
            <div
              style={{
                marginBottom: 14,
                background: "var(--semantic-danger-subtle)",
                border: "1px solid rgba(255,90,95,0.30)",
                color: "var(--semantic-danger)",
                padding: "12px 16px", borderRadius: 8,
                fontSize: 12, fontWeight: 500, lineHeight: 1.5,
              }}
            >
              {t("cfo.rejected_banner", { reason: closeStatus.rejectionReason })}
            </div>
          )}

          {/* Pending approval banner */}
          {isPending && (
            <div
              style={{
                marginBottom: 14,
                background: "var(--semantic-warning-subtle)",
                border: "1px solid rgba(212,168,75,0.30)",
                color: "var(--semantic-warning)",
                padding: "12px 16px", borderRadius: 8,
                fontSize: 12, fontWeight: 500,
              }}
            >
              {t("cfo.awaiting_approval_banner")}
            </div>
          )}

          {/* Locked banner */}
          {isLocked && (
            <div
              style={{
                marginBottom: 14,
                background: "var(--accent-primary-subtle)",
                border: "1px solid rgba(0,196,140,0.30)",
                color: "var(--accent-primary)",
                padding: "12px 16px", borderRadius: 8,
                fontSize: 12, fontWeight: 500,
              }}
            >
              {t("cfo.locked_banner")}
            </div>
          )}

          {toast && (
            <div
              style={{
                marginBottom: 14,
                background: "var(--accent-primary-subtle)",
                border: "1px solid rgba(0,196,140,0.30)",
                color: "var(--accent-primary)",
                padding: "10px 14px", borderRadius: 8,
                fontSize: 12, fontWeight: 500,
              }}
            >
              {toast}
            </div>
          )}

          <AminahNarrationCard text={data.aminahSummary} />

          {/* Progress bar */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: 10,
              padding: "16px 18px",
              marginBottom: 18,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 22, color: "var(--text-primary)", fontWeight: 500 }}>
                <LtrText>{complete} / {total}</LtrText>
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", color: "var(--text-tertiary)" }}>
                {t("tasks_complete_label", { pct })}
              </div>
            </div>
            <div style={{ width: "100%", height: 4, background: "var(--border-subtle)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: "var(--accent-primary)" }} />
            </div>
          </div>

          {/* Checklist */}
          <div
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderRadius: 10,
              overflow: "hidden",
              marginBottom: 18,
            }}
          >
            <div
              style={{
                padding: "12px 14px",
                fontSize: 10, fontWeight: 600, letterSpacing: "0.15em",
                color: "var(--text-tertiary)",
                borderBottom: "1px solid var(--border-subtle)",
              }}
            >
              {t("close_checklist")}
            </div>
            {tasks.length === 0 && (
              <EmptyState icon={CheckCircle2} title={tc("empty_states.close_no_tasks_title")} description={tc("empty_states.close_no_tasks_desc")} />
            )}
            {sorted.map((task) => (
              <ChecklistRow
                key={task.id}
                task={task}
                editable={editable}
                expanded={expandedItemId === task.id}
                onToggle={() => setExpandedItemId((x) => (x === task.id ? null : task.id))}
                onMarkComplete={handleMarkComplete}
                cfoEditable={role === "CFO"}
                checkExpanded={expandedCheckId === task.id}
                onExpandCheck={() => expandCheck(task.id)}
                checkNotes={expandedCheckId === task.id ? checkNotes : []}
                checkAttachments={expandedCheckId === task.id ? checkAttachments : []}
                onAddNote={handleAddCheckNote}
                noteDraft={expandedCheckId === task.id ? checkNoteDraft : ""}
                onNoteDraftChange={setCheckNoteDraft}
                onAttachFile={handleAttachCheckFile}
                onOverride={(checkId) => { setOverrideCheckId(checkId); }}
              />
            ))}
          </div>

          {/* Role-specific actions */}
          {role === "CFO" && editable && (
            <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
              <button onClick={handleRunValidations} disabled={runningValidations} style={btnPrimary(runningValidations)}>
                {runningValidations ? <><Spinner size={13} />&nbsp;{t("cfo.running")}</> : <><PlayCircle size={13} style={{ verticalAlign: "middle", marginInlineEnd: 6 }} />{t("cfo.run_validations")}</>}
              </button>
              <button
                onClick={() => setSubmitOpen(true)}
                disabled={!allComplete}
                style={{
                  background: allComplete ? "var(--accent-primary)" : "rgba(0,196,140,0.25)",
                  color: "#fff", border: "none",
                  padding: "10px 18px", borderRadius: 6,
                  cursor: allComplete ? "pointer" : "not-allowed",
                  fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                }}
              >
                {t("cfo.submit_approval")}
              </button>
            </div>
          )}

          {/* Owner actions */}
          {role === "Owner" && (
            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              {isPending ? (
                <>
                  <button onClick={handleApprove} style={btnPrimary(false)}>
                    {t("owner_approval.approve")}
                  </button>
                  <button
                    onClick={() => setRejectOpen(true)}
                    style={{
                      background: "transparent", color: "var(--semantic-danger)",
                      border: "1px solid rgba(255,90,95,0.30)", padding: "10px 18px",
                      borderRadius: 6, cursor: "pointer",
                      fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                    }}
                  >
                    {t("owner_approval.reject")}
                  </button>
                </>
              ) : (
                <button
                  disabled={!allComplete}
                  style={{
                    background: allComplete ? "var(--accent-primary)" : "rgba(0,196,140,0.25)",
                    color: "#fff", border: "none",
                    padding: "10px 18px", borderRadius: 6,
                    cursor: allComplete ? "pointer" : "not-allowed",
                    fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                  }}
                >
                  {t("approve_close")}
                </button>
              )}
              <button
                style={{
                  background: "transparent", color: "var(--text-secondary)",
                  border: "1px solid var(--border-strong)", padding: "10px 16px",
                  borderRadius: 6, cursor: "pointer",
                  fontSize: 12, fontFamily: "inherit",
                }}
              >
                {t("request_status_update")}
              </button>
            </div>
          )}

          {/* Pre-close validations panel (CFO only) */}
          {role === "CFO" && (
            <div
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-default)",
                borderRadius: 10,
                overflow: "hidden",
                marginBottom: 18,
              }}
            >
              <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--text-primary)", letterSpacing: "-0.2px", lineHeight: 1 }}>
                  {t("validations_panel.title")}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
                  {t("validations_panel.subtitle")}
                </div>
              </div>
              {!validations ? (
                <div style={{ padding: "20px 16px", color: "var(--text-tertiary)", fontSize: 12, textAlign: "center" }}>
                  {t("validations_panel.empty")}
                </div>
              ) : (
                <>
                  {validations.map((v) => <ValidationRow key={v.checkId} v={v} onFix={onNavigate} />)}
                  <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border-subtle)" }}>
                    <button onClick={handleRunValidations} style={btnSecondary}>
                      {t("validations_panel.rerun")}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Owner pre-close validations (existing behavior) */}
          {role === "Owner" && (
            <div
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-default)",
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              <div style={{ padding: "12px 14px", fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", borderBottom: "1px solid var(--border-subtle)" }}>
                {t("preclose_validations")}
              </div>
              {(data?.validations || []).map((v, i) => (
                <OwnerValidationRow key={i} v={v} onResolve={onNavigate} />
              ))}
            </div>
          )}
        </div>
      </div>

      <SubmitCloseConfirmationModal
        open={submitOpen}
        period={period}
        onClose={() => setSubmitOpen(false)}
        onSubmitted={() => { reloadStatus(); }}
      />
      <RejectCloseModal
        open={rejectOpen}
        period={period}
        onClose={() => setRejectOpen(false)}
        onRejected={() => { reloadStatus(); }}
      />

      {/* Re-open modal */}
      {reopenOpen && (
        <>
          <div onClick={() => setReopenOpen(false)} style={{ position: "fixed", inset: 0, background: "var(--overlay-backdrop)", backdropFilter: "blur(4px)", zIndex: 300 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 460, background: "var(--bg-surface-raised)", border: "1px solid var(--border-default)", borderRadius: 12, zIndex: 301, boxShadow: "var(--shadow-xl)" }}>
            <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--text-primary)" }}>{t("reopen.modal_title")}</div>
              <button onClick={() => setReopenOpen(false)} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}><X size={16} /></button>
            </div>
            <div style={{ padding: "18px 22px" }}>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 14 }}>{t("reopen.modal_body")}</div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", color: "var(--text-tertiary)", marginBottom: 5 }}>{t("reopen.reason_label")}</div>
              <textarea value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} placeholder={t("reopen.reason_placeholder")} rows={3} style={{ width: "100%", background: "var(--bg-surface-sunken)", border: "1px solid var(--border-default)", borderRadius: 6, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical" }} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid var(--border-subtle)" }}>
              <ActionButton variant="secondary" label={t("reopen.cancel_button")} onClick={() => setReopenOpen(false)} />
              <ActionButton variant="primary" label={t("reopen.confirm_button")} onClick={handleReopen} disabled={!reopenReason.trim()} />
            </div>
          </div>
        </>
      )}

      {/* Close summary slide-over */}
      {summaryOpen && closeSummary && (
        <>
          <div onClick={() => setSummaryOpen(false)} style={{ position: "fixed", inset: 0, background: "var(--overlay-backdrop)", zIndex: 300 }} />
          <div style={{ position: "fixed", top: 0, insetInlineEnd: 0, bottom: 0, width: 520, maxWidth: "calc(100vw - 32px)", background: "var(--bg-surface-raised)", borderInlineStart: "1px solid var(--border-default)", zIndex: 301, boxShadow: "-24px 0 60px rgba(0,0,0,0.7)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: "var(--text-primary)" }}>{t("post_close.view_summary")}</div>
              <button onClick={() => setSummaryOpen(false)} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}><X size={16} /></button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 22px" }}>
              <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{closeSummary.period}</div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: closeSummary.status === "approved" ? "var(--accent-primary)" : "var(--semantic-warning)", padding: "2px 8px", borderRadius: 4, background: closeSummary.status === "approved" ? "rgba(0,196,140,0.1)" : "rgba(245,166,35,0.1)" }}>{closeSummary.status.toUpperCase()}</div>
              </div>
              {closeSummary.closedBy && <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 12 }}>{t("post_close.closed_by", { user: closeSummary.closedBy, date: closeSummary.closedAt || "" })}</div>}
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 8 }}>CHECKS</div>
              {(closeSummary.checks || []).map((c, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border-subtle)", fontSize: 12 }}>
                  <span style={{ color: "var(--text-secondary)" }}>{c.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: c.status === "complete" ? "var(--accent-primary)" : "var(--semantic-warning)" }}>{c.status.toUpperCase()}</span>
                </div>
              ))}
              {(closeSummary.forcedItems || []).length > 0 && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--semantic-warning)", marginTop: 16, marginBottom: 8 }}>OVERRIDES</div>
                  {closeSummary.forcedItems.map((f, i) => (
                    <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid var(--border-subtle)", fontSize: 11, color: "var(--text-tertiary)" }}>
                      Check: {f.checkId} · {f.reason} · by {f.overriddenBy}
                    </div>
                  ))}
                </>
              )}
              <div style={{ marginTop: 16 }}>
                <ActionButton variant="secondary" size="sm" icon={Download} label={t("post_close.export_package")} onClick={handleExportClose} />
              </div>
            </div>
          </div>
        </>
      )}

      {/* Override modal */}
      {overrideCheckId && (
        <>
          <div onClick={() => setOverrideCheckId(null)} style={{ position: "fixed", inset: 0, background: "var(--overlay-backdrop)", backdropFilter: "blur(4px)", zIndex: 310 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 420, background: "var(--bg-surface-raised)", border: "1px solid var(--border-default)", borderRadius: 12, zIndex: 311, boxShadow: "var(--shadow-xl)" }}>
            <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border-subtle)" }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: "var(--text-primary)" }}>{t("checks.override_button")}</div>
            </div>
            <div style={{ padding: "16px 22px" }}>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", color: "var(--text-tertiary)", marginBottom: 5 }}>{t("checks.override_reason_label")}</div>
              <textarea value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} rows={3} style={{ width: "100%", background: "var(--bg-surface-sunken)", border: "1px solid var(--border-default)", borderRadius: 6, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical" }} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid var(--border-subtle)" }}>
              <ActionButton variant="secondary" label={t("reopen.cancel_button")} onClick={() => setOverrideCheckId(null)} />
              <ActionButton variant="primary" label={t("checks.override_confirm")} onClick={handleOverrideCheck} disabled={!overrideReason.trim()} />
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      {toast && <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: "var(--accent-primary-subtle)", border: "1px solid rgba(0,196,140,0.30)", color: "var(--accent-primary)", padding: "10px 18px", borderRadius: 8, fontSize: 12, fontWeight: 500, zIndex: 400 }}>{toast}</div>}
    </div>
  );
}

// ── Checklist row with CFO sub-form ───────────────────────────────
function ChecklistRow({ task, editable, expanded, onToggle, onMarkComplete, cfoEditable, checkExpanded, onExpandCheck, checkNotes, checkAttachments, onAddNote, noteDraft, onNoteDraftChange, onAttachFile, onOverride }) {
  const { t } = useTranslation("close");
  const s = STATUS[task.status] || STATUS.pending;
  const Icon = s.Icon;
  const isDone = task.status === "complete";

  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [completing, setCompleting] = useState(false);
  const canEdit = editable && !isDone;

  const handleMark = async () => {
    setCompleting(true);
    await onMarkComplete(task.id, notes, attachments);
    setCompleting(false);
  };

  const handleFilePick = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setAttachments((prev) => [...prev, ...files.map((f) => f.name)]);
    e.target.value = "";
  };

  return (
    <div
      style={{
        borderBottom: "1px solid var(--border-subtle)",
        opacity: isDone ? 0.85 : 1,
      }}
    >
      <div
        onClick={canEdit ? onToggle : undefined}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 14px",
          cursor: canEdit ? "pointer" : "default",
        }}
      >
        <Icon size={16} color={s.iconColor} strokeWidth={2.2} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-primary)",
              textDecoration: isDone ? "line-through" : "none",
            }}
          >
            {task.name}
          </div>
        </div>
        <Avatar person={task.assignee} size={22} />
        <div style={{ minWidth: 120, fontSize: 11, color: "var(--text-tertiary)" }}>
          {task.assignee.name}
        </div>
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.10em",
            color: s.color,
            minWidth: 100,
          }}
        >
          {t(`task_status.${s.key}`)}
        </div>
        <div
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            color: "var(--text-tertiary)",
            minWidth: 80,
            textAlign: "end",
          }}
        >
          {task.completedAt
            ? formatRelativeTime(task.completedAt)
            : task.dueDate
              ? t("due_label", { time: formatRelativeTime(task.dueDate).replace("ago", "") })
              : "—"}
        </div>
      </div>
      {expanded && canEdit && (
        <div
          style={{
            padding: "14px 16px 16px 42px",
            background: "var(--bg-surface-sunken)",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 6 }}>
              {t("cfo.item_notes")}
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("cfo.item_notes_placeholder")}
              rows={3}
              maxLength={500}
              style={{
                width: "100%",
                background: "var(--bg-surface)",
                border: "1px solid var(--border-default)",
                borderRadius: 8,
                padding: "9px 12px",
                color: "var(--text-primary)",
                fontSize: 13, fontFamily: "inherit",
                outline: "none", resize: "vertical",
              }}
            />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 6 }}>
              {t("cfo.item_attachments")}
            </div>
            {attachments.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {attachments.map((name, i) => (
                  <span
                    key={`${name}-${i}`}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      fontSize: 11,
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border-default)",
                      borderRadius: 14,
                      padding: "4px 10px",
                      color: "var(--text-secondary)",
                      fontFamily: "'DM Mono', monospace",
                    }}
                  >
                    <Paperclip size={10} /> {name}
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                      style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 0, display: "inline-flex" }}
                      aria-label="Remove"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <label
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                fontSize: 11, fontWeight: 600, color: "var(--accent-primary)",
                cursor: "pointer",
              }}
            >
              <Paperclip size={11} />
              {t("cfo.item_attachment_add")}
              <input type="file" multiple onChange={handleFilePick} style={{ display: "none" }} />
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onToggle} style={btnSecondary}>{t("cfo.item_cancel")}</button>
            <button onClick={handleMark} disabled={completing} style={btnPrimary(completing)}>
              {completing ? <><Spinner size={13} />&nbsp;{t("cfo.item_completing")}</> : t("cfo.item_mark_complete")}
            </button>
          </div>
        </div>
      )}

      {/* 20D-5: CFO-editable check expand — notes, attachments, override */}
      {cfoEditable && (
        <div style={{ paddingInlineStart: 40 }}>
          <button onClick={onExpandCheck} style={{ fontSize: 10, color: "var(--text-tertiary)", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "4px 0", display: "flex", alignItems: "center", gap: 4 }}>
            {checkExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            {t("checks.notes_header")} · {t("checks.attachments_header")}
          </button>
          {checkExpanded && (
            <div style={{ padding: "8px 0 12px", borderBottom: "1px solid var(--border-subtle)" }}>
              {/* Notes */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-tertiary)", marginBottom: 4 }}>{t("checks.notes_header")}</div>
                {(checkNotes || []).length === 0 ? (
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontStyle: "italic" }}>No notes yet</div>
                ) : (checkNotes || []).map((n) => (
                  <div key={n.id} style={{ fontSize: 11, color: "var(--text-secondary)", padding: "3px 0", borderBottom: "1px solid var(--bg-surface)" }}>
                    <span style={{ fontWeight: 600, fontSize: 10, color: "var(--text-tertiary)" }}>{n.user}</span> · {n.note}
                  </div>
                ))}
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <input value={noteDraft} onChange={(e) => onNoteDraftChange(e.target.value)} placeholder={t("checks.add_note_button")} onKeyDown={(e) => { if (e.key === "Enter") onAddNote(); }} style={{ flex: 1, background: "var(--bg-surface-sunken)", border: "1px solid var(--border-default)", borderRadius: 4, padding: "5px 8px", color: "var(--text-primary)", fontSize: 11, fontFamily: "inherit", outline: "none" }} />
                  <ActionButton variant="secondary" size="sm" label={t("checks.add_note_button")} onClick={onAddNote} disabled={!noteDraft?.trim()} />
                </div>
              </div>
              {/* Attachments */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: "var(--text-tertiary)", marginBottom: 4 }}>{t("checks.attachments_header")}</div>
                {(checkAttachments || []).length > 0 && (checkAttachments || []).map((a) => (
                  <div key={a.id} style={{ fontSize: 11, color: "var(--text-secondary)", padding: "3px 0" }}>📎 {a.name} ({Math.round(a.size / 1024)} KB)</div>
                ))}
                <DropZone variant="compact" height={50} title={t("checks.attach_file_button")} onFile={onAttachFile} accept="application/pdf,image/*" maxSize={5 * 1024 * 1024} />
              </div>
              {/* Override */}
              {!isDone && (
                <ActionButton variant="secondary" size="sm" icon={Shield} label={t("checks.override_button")} onClick={() => onOverride(task.id)} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Pre-close validation row (CFO) ──────────────────────────────
function ValidationRow({ v, onFix }) {
  const { t } = useTranslation("close");
  const color =
    v.status === "pass" ? "var(--accent-primary)" :
    v.status === "fail" ? "var(--semantic-danger)" :
    "var(--semantic-warning)";
  const label = t(`validations_panel.status_${v.status}`);
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 16px",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <span
        style={{
          fontSize: 9, fontWeight: 700, letterSpacing: "0.12em",
          color, background: `${color}14`,
          border: `1px solid ${color}55`,
          padding: "4px 8px", borderRadius: 4,
          minWidth: 60, textAlign: "center",
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{v.name}</div>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{v.details}</div>
      </div>
      {v.actionable && v.fixAction && onFix && (
        <button
          onClick={() => onFix(v.fixAction)}
          style={{
            background: "transparent", color: "var(--accent-primary)",
            border: "1px solid rgba(0,196,140,0.30)", padding: "6px 12px",
            borderRadius: 5, cursor: "pointer",
            fontSize: 11, fontWeight: 600, fontFamily: "inherit",
          }}
        >
          {t("validations_panel.fix")}
        </button>
      )}
    </div>
  );
}

// ── Owner validation row (legacy) ────────────────────────────────
function OwnerValidationRow({ v, onResolve }) {
  const { t } = useTranslation("close");
  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "10px 14px",
        borderBottom: "1px solid var(--border-subtle)",
        fontSize: 13,
      }}
    >
      {v.passing ? (
        <Check size={14} color="var(--accent-primary)" strokeWidth={2.4} />
      ) : (
        <AlertTriangle size={14} color="var(--semantic-danger)" strokeWidth={2.4} />
      )}
      <span style={{ color: v.passing ? "var(--text-secondary)" : "var(--text-primary)", flex: 1 }}>
        {v.name}
      </span>
      <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{v.detail}</span>
      {!v.passing && v.resolveScreen && (
        <a
          onClick={() => onResolve && onResolve(v.resolveScreen)}
          style={{ fontSize: 11, color: "var(--accent-primary)", cursor: "pointer" }}
        >
          {t("resolve")}
        </a>
      )}
    </div>
  );
}

const btnSecondary = {
  background: "transparent",
  color: "var(--text-secondary)",
  border: "1px solid var(--border-strong)",
  padding: "9px 16px",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 12,
  fontFamily: "inherit",
};
const btnPrimary = (loading) => ({
  background: "var(--accent-primary)",
  color: "#fff",
  border: "none",
  padding: "10px 18px",
  borderRadius: 6,
  cursor: loading ? "not-allowed" : "pointer",
  fontSize: 12,
  fontWeight: 600,
  fontFamily: "inherit",
});
