import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, MessageCircle, ArrowUpRight, CheckCircle2, Clock, XCircle, AlertCircle, X } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
// Track B Dispatch 6 wire 6 (2026-04-20) — imports swapped from
// ../../engine/mockEngine to ../../engine so the screen rides the router.
// MOCK mode preserves legacy behaviour; LIVE mode falls back to mockEngine
// with a one-shot warn for every hook where the DTO shape delta would
// require inventing backend fields (see src/api/budgets.js file header
// for the flagged list). The 16 new Dispatch 6 endpoints are available
// under the canonical `*Live` names (see src/engine/index.js) and are
// called selectively below where the shape aligns without invention.
import {
  // Legacy mock-shaped readers + writers (MOCK: real; LIVE: mock_fallback
  // with one-shot warn because backend DTO is flatter and departments[]
  // with lineItems are not surfaced).
  getActiveBudget,
  getActiveBudgetSummary,
  getBudgetVarianceByDepartment,
  getBudgetById,
  getAllBudgets,
  getTeamMembers,
  approveBudget,
  delegateBudget,
  getBudgetForYear,
  updateBudgetLine,
  deleteBudgetLine,
  createBudgetLine,
  addBudgetLineComment,
  getBudgetLineComments,
  deleteBudgetLineComment,
  // Dispatch 6 canonical live wrappers — live-mode enabled, mock-mode
  // adapter in engine/index.js::buildMockExtras. The per-department
  // action endpoints (approveBudgetDepartmentLive,
  // requestDepartmentRevisionLive) are consumed from DepartmentRow, not
  // from this top-level screen.
  submitBudgetForApprovalLive,
  requestBudgetChangesLive,
  getBudgetApprovalStateLive,
  // OWNER-only status transitions (2026-04-21) that close the previous
  // Reject-prefix / Lock-FY / Edit-Budget workarounds.
  //   lockBudgetLive           APPROVED | CHANGES_REQUESTED → LOCKED
  //   reopenBudgetToDraftLive  LOCKED   | REJECTED          → DRAFT
  //   rejectBudgetLive         PENDING_APPROVAL | CHANGES_REQUESTED → REJECTED
  lockBudgetLive,
  reopenBudgetToDraftLive,
  rejectBudgetLive,
} from "../../engine";
import AminahNarrationCard from "../financial/AminahNarrationCard";
import ActionButton from "../ds/ActionButton";
import PersistentBanner from "../ds/PersistentBanner";
import BudgetStatusPill from "./BudgetStatusPill";
import BudgetSummaryStrip from "./BudgetSummaryStrip";
import DepartmentRow from "./DepartmentRow";
import BudgetWorkflowStatusStrip from "./BudgetWorkflowStatusStrip";
import DelegateBudgetModal from "./DelegateBudgetModal";

const COLS_HEADER = "minmax(160px, 1.4fr) minmax(140px, 1fr) 130px 130px 130px 130px 180px 110px 18px";

// HASEEB-160 / HASEEB-168 — enum → i18n key mappers. Backend emits UPPER_SNAKE
// for budget status, lowercase snake for reviewer status, and a small set of
// action strings for history rows. Unknown values fall back to a human
// "—" rather than crashing so backend enum drift is survivable.
function budgetStatusLabel(t, status) {
  if (!status) return t("status.unknown", { defaultValue: "—" });
  const key = String(status).toLowerCase();
  return t(`status.${key}`, { defaultValue: String(status) });
}
function reviewerStatusLabel(t, status) {
  if (!status) return t("reviewer_status.unknown", { defaultValue: "—" });
  const key = String(status).toLowerCase();
  return t(`reviewer_status.${key}`, {
    // Fallback: UPPER_SNAKE → spaced upper (legacy behaviour) so a brand-new
    // backend status never crashes the surface; it renders readably until a
    // key is added for it.
    defaultValue: String(status).toUpperCase().replace(/_/g, " "),
  });
}
function historyActionLabel(t, action) {
  if (!action) return t("history_action.unknown", { defaultValue: "—" });
  const key = String(action).toLowerCase();
  return t(`history_action.${key}`, { defaultValue: String(action) });
}

function HeaderCell({ children, align = "left" }) {
  return (
    <div
      style={{
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: "0.15em",
        color: "var(--text-tertiary)",
        textAlign: align,
      }}
    >
      {children}
    </div>
  );
}

export default function BudgetScreen({ role = "CFO", onOpenAminah, juniorOnlyId = null, onViewInForecast }) {
  const { t } = useTranslation("budget");
  const [allBudgets, setAllBudgets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [budget, setBudget] = useState(null);
  const [summary, setSummary] = useState(null);
  const [variance, setVariance] = useState(null);
  const [team, setTeam] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [delegateOpen, setDelegateOpen] = useState(false);
  const [toast, setToast] = useState(null);
  // 20D-5 additions
  const [viewingYear, setViewingYear] = useState(null); // null = current budget
  const [historicalBudget, setHistoricalBudget] = useState(null);
  const [editingLineId, setEditingLineId] = useState(null);
  const [editingLineData, setEditingLineData] = useState(null);
  const [commentLineId, setCommentLineId] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [approvalState, setApprovalState] = useState(null);
  const [approvalOpen, setApprovalOpen] = useState(false);
  // HASEEB-153 — Owner approval-flow modals. Replaces window.prompt
  // anti-pattern for Request Changes and provides a proper confirmation
  // surface for Approve + Reject. Backend wiring:
  //   approve  → mockEngine.approveBudget (pre-existing /api/budgets/:id/approve)
  //   request  → requestBudgetChangesLive → POST /api/budgets/:id/request-changes
  //   reject   → rejectBudgetLive         → POST /api/budgets/:id/reject
  //             (REJECTED is a proper terminal state on the backend —
  //              the REJECTED: notes-prefix workaround is gone.)
  //
  // 2026-04-21 added two further OWNER-only modals:
  //   lock             → lockBudgetLive          → POST /api/budgets/:id/lock
  //   reopen to draft  → reopenBudgetToDraftLive → POST /api/budgets/:id/reopen-to-draft
  // The CFO's previous "Edit Budget" affordance on non-DRAFT budgets has
  // been removed because the reopen endpoint is OWNER-only. CFOs must
  // now ask the Owner to reopen; DRAFT-state editing remains inline on
  // the department rows and does not need a top-level button.
  const [requestChangesOpen, setRequestChangesOpen] = useState(false);
  const [requestChangesNotes, setRequestChangesNotes] = useState("");
  const [requestChangesSubmitting, setRequestChangesSubmitting] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNotes, setRejectNotes] = useState("");
  const [rejectSubmitting, setRejectSubmitting] = useState(false);
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false);
  const [approveSubmitting, setApproveSubmitting] = useState(false);
  // Lock + Reopen-to-Draft modal state (2026-04-21).
  const [lockOpen, setLockOpen] = useState(false);
  const [lockReason, setLockReason] = useState("");
  const [lockSubmitting, setLockSubmitting] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [reopenSubmitting, setReopenSubmitting] = useState(false);
  const readOnly = viewingYear !== null;
  const activeBudget = readOnly ? historicalBudget : budget;
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };
  const periodRef = useRef(null);
  const refresh = () => setRefreshKey((k) => k + 1);

  // Historical year handlers
  const switchToYear = async (year) => {
    const currentYear = budget?.period?.fiscalYear || 2026;
    if (year === currentYear) { setViewingYear(null); setHistoricalBudget(null); return; }
    const hist = await getBudgetForYear(year);
    setHistoricalBudget(hist);
    setViewingYear(year);
  };

  // Edit line handlers
  const startEditLine = (line) => { setEditingLineId(line.id || line.code); setEditingLineData({ ...line }); };
  const cancelEditLine = () => { setEditingLineId(null); setEditingLineData(null); };
  const saveEditLine = async () => {
    if (!editingLineData) return;
    await updateBudgetLine(editingLineId, editingLineData);
    setEditingLineId(null); setEditingLineData(null);
    refresh(); showToast(t("edit.save_button"));
  };
  const handleDeleteLine = async (lineId) => {
    if (!window.confirm(t("edit.delete_confirm"))) return;
    await deleteBudgetLine(lineId);
    refresh(); showToast(t("edit.delete_button"));
  };

  // Comment handlers
  const openComments = async (lineId) => {
    if (commentLineId === lineId) { setCommentLineId(null); return; }
    setCommentLineId(lineId);
    const c = await getBudgetLineComments(lineId);
    setComments(c || []);
  };
  const postComment = async () => {
    if (!commentDraft.trim() || !commentLineId) return;
    const author = role === "Owner" ? "owner" : role === "Junior" ? "junior" : "cfo";
    await addBudgetLineComment(commentLineId, commentDraft.trim(), author);
    setCommentDraft("");
    const c = await getBudgetLineComments(commentLineId);
    setComments(c || []);
  };
  const handleDeleteComment = async (commentId) => {
    if (!commentLineId) return;
    await deleteBudgetLineComment(commentLineId, commentId);
    const c = await getBudgetLineComments(commentLineId);
    setComments(c || []);
  };

  // HASEEB-153 — Owner approval-flow handlers.
  const handleApproveBudget = async () => {
    if (!budget?.id) return;
    setApproveSubmitting(true);
    try {
      await approveBudget(budget.id, "owner");
      setApproveConfirmOpen(false);
      refresh();
      showToast(t("toast.approve_budget_success"));
    } catch (err) {
      showToast(err?.message || t("toast.approve_budget_failed"));
    } finally {
      setApproveSubmitting(false);
    }
  };

  const handleRequestChangesSubmit = async () => {
    const notes = (requestChangesNotes || "").trim();
    if (!notes) {
      showToast(t("request_changes_modal.error_notes_required"));
      return;
    }
    if (!budget?.id) return;
    setRequestChangesSubmitting(true);
    try {
      await requestBudgetChangesLive(budget.id, { notes });
      setRequestChangesOpen(false);
      setRequestChangesNotes("");
      refresh();
      showToast(t("toast.request_changes_success"));
    } catch (err) {
      showToast(err?.message || t("toast.request_changes_failed"));
    } finally {
      setRequestChangesSubmitting(false);
    }
  };

  const handleRejectSubmit = async () => {
    // Wired to the dedicated reject endpoint (2026-04-21). Backend has
    // a REJECTED terminal state and a POST /:id/reject route (OWNER-only).
    // The previous "REJECTED: " notes-prefix workaround on
    // request-changes is gone.
    const reason = (rejectNotes || "").trim();
    if (!reason) {
      showToast(t("reject_modal.error_reason_required"));
      return;
    }
    if (!budget?.id) return;
    setRejectSubmitting(true);
    try {
      await rejectBudgetLive(budget.id, { reason });
      setRejectOpen(false);
      setRejectNotes("");
      refresh();
      showToast(t("toast.reject_budget_success"));
    } catch (err) {
      showToast(err?.message || t("toast.reject_budget_failed"));
    } finally {
      setRejectSubmitting(false);
    }
  };

  // Lock FY handler (2026-04-21). OWNER-only; backend transitions
  // APPROVED | CHANGES_REQUESTED → LOCKED.
  const handleLockSubmit = async () => {
    const reason = (lockReason || "").trim();
    if (!reason) {
      showToast(t("lock_modal.error_reason_required"));
      return;
    }
    if (!budget?.id) return;
    setLockSubmitting(true);
    try {
      await lockBudgetLive(budget.id, { reason });
      setLockOpen(false);
      setLockReason("");
      refresh();
      showToast(t("toast.lock_budget_success"));
    } catch (err) {
      showToast(err?.message || t("toast.lock_budget_failed"));
    } finally {
      setLockSubmitting(false);
    }
  };

  // Reopen-to-Draft handler (2026-04-21). OWNER-only; backend transitions
  // LOCKED | REJECTED → DRAFT. Replaces the previous CFO-facing "Edit
  // Budget" affordance which is no longer present because the reopen
  // endpoint is gated to the Owner. CFOs now ask the Owner to reopen
  // when a non-DRAFT budget needs edits.
  const handleReopenSubmit = async () => {
    const reason = (reopenReason || "").trim();
    if (!reason) {
      showToast(t("reopen_to_draft_modal.error_reason_required"));
      return;
    }
    if (!budget?.id) return;
    setReopenSubmitting(true);
    try {
      await reopenBudgetToDraftLive(budget.id, { reason });
      setReopenOpen(false);
      setReopenReason("");
      refresh();
      showToast(t("toast.reopen_to_draft_success"));
    } catch (err) {
      showToast(err?.message || t("toast.reopen_to_draft_failed"));
    } finally {
      setReopenSubmitting(false);
    }
  };

  // Approval state handler — hits live Dispatch 6 endpoint
  //   GET /api/budgets/:id/approval-state
  // which returns the {budgetStatus, nextAction, reviewers, history}
  // shape. `nextAction` is the authoritative "what's next" hint and
  // supersedes the legacy mock.status-derived label.
  const openApprovalState = async () => {
    if (!budget?.id) return;
    try {
      const state = await getBudgetApprovalStateLive(budget.id);
      setApprovalState(state);
      setApprovalOpen(true);
    } catch (err) {
      // Backend uses { ok:false, status, code, message } — forward the
      // message to the existing toast stack so the user sees why it failed.
      showToast(err?.message || t("toast.approval_load_failed"));
    }
  };

  useEffect(() => {
    getAllBudgets().then((list) => {
      setAllBudgets(list);
      // Default: first ACTIVE, else first in list
      const active = list.find((b) => b.status === "active") || list[0];
      if (active) setSelectedId(active.id);
    });
    getTeamMembers().then(setTeam);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    getBudgetById(selectedId).then((b) => {
      setBudget(b);
      if (b && b.status === "active") {
        getActiveBudgetSummary().then(setSummary);
        getBudgetVarianceByDepartment().then(setVariance);
      } else if (b) {
        // Workflow mode: build summary directly from the budget
        setSummary({
          id: b.id,
          label: b.period.label,
          status: b.status,
          totalRevenue: b.totalRevenue,
          totalExpenses: b.totalExpenses,
          netIncome: b.netIncome,
          departmentCount: b.departments.length,
          expenseDepartmentCount: b.departments.filter((d) => d.category === "expense").length,
          margin: b.totalRevenue > 0 ? Number(((b.netIncome / b.totalRevenue) * 100).toFixed(1)) : 0,
        });
        // Fake variance rows from department totals (no actuals yet for future budgets)
        setVariance(
          b.departments.map((d) => ({
            id: d.id,
            name: d.name,
            category: d.category,
            ownerUserId: d.ownerUserId,
            budgetAnnual: d.totalAnnual,
            budgetYtd: 0,
            actualYtd: 0,
            varianceAmount: 0,
            variancePercent: 0,
            status: d.workflowStatus || "on-track",
            workflowStatus: d.workflowStatus,
          }))
        );
      }
    });
  }, [selectedId, refreshKey]);

  // Click outside closes period dropdown
  useEffect(() => {
    if (!periodOpen) return;
    const onClick = (e) => {
      if (periodRef.current && !periodRef.current.contains(e.target)) setPeriodOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [periodOpen]);

  const ownerName = (id) => {
    if (id === "cfo") return t("you_cfo");
    const m = team.find((x) => x.id === id);
    return m ? m.name : id;
  };

  // Filter to junior's owned departments if applicable
  let displayedRows = variance || [];
  let otherRows = [];
  if (juniorOnlyId && variance) {
    displayedRows = variance.filter((r) => r.ownerUserId === juniorOnlyId);
    otherRows = variance.filter((r) => r.ownerUserId !== juniorOnlyId);
  }

  const expenseVarianceTotal = (variance || [])
    .filter((r) => r.category === "expense")
    .reduce((s, r) => s + r.varianceAmount, 0);
  const summaryWithVariance = summary;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px 32px" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 18,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 28,
                color: "var(--text-primary)",
                letterSpacing: "-0.3px",
                lineHeight: 1,
              }}
            >
              {role === "Junior" ? t("my_title") : t("title")}
            </div>
            {role === "Junior" ? (
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.15em",
                  color: "var(--text-tertiary)",
                  marginTop: 6,
                }}
              >
                {t("my_subtitle")}
              </div>
            ) : (
              <div ref={periodRef} style={{ position: "relative", marginTop: 6 }}>
                <button
                  onClick={() => setPeriodOpen((o) => !o)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-default)",
                    borderRadius: 6,
                    padding: "6px 12px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.12em",
                    color: "var(--text-primary)",
                    // HASEEB-168: CSS uppercases in Latin scripts and is a
                    // no-op in Arabic (no casing), which is the semantically
                    // correct behaviour.
                    textTransform: "uppercase",
                  }}
                >
                  {/* HASEEB-168: `toUpperCase()` was an English-centric no-op
                      in Arabic and masked null via `|| ""`. Pass the period
                      label as-is (CSS `textTransform: uppercase` on the
                      button container handles the visual uppercasing in EN,
                      and is a no-op in AR — semantically correct). Status is
                      resolved via the `budget.status.*` i18n mapper
                      introduced for HASEEB-160 so it renders localised
                      rather than as a raw UPPER_SNAKE enum. */}
                  {budget ? t("period_status", { period: budget.period.label, status: budgetStatusLabel(t, budget.status) }) : t("loading")}
                  <ChevronDown size={12} color="var(--text-tertiary)" />
                </button>
                {periodOpen && (
                  <div
                    data-popover-anchor="start"
                    style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      left: 0,
                      width: 280,
                      background: "var(--bg-surface-raised)",
                      border: "1px solid var(--border-default)",
                      borderRadius: 10,
                      boxShadow: "var(--panel-shadow)",
                      zIndex: 200,
                      overflow: "hidden",
                    }}
                  >
                    {allBudgets.map((b) => {
                      const on = b.id === selectedId;
                      return (
                        <button
                          key={b.id}
                          onClick={() => {
                            setSelectedId(b.id);
                            setExpandedId(null);
                            setPeriodOpen(false);
                          }}
                          onMouseEnter={(e) => {
                            if (!on) e.currentTarget.style.background = "var(--bg-surface-sunken)";
                          }}
                          onMouseLeave={(e) => {
                            if (!on) e.currentTarget.style.background = "transparent";
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            width: "100%",
                            padding: "10px 14px",
                            background: on ? "var(--bg-selected)" : "transparent",
                            border: "none",
                            borderBottom: "1px solid var(--border-subtle)",
                            cursor: "pointer",
                            fontFamily: "inherit",
                            textAlign: "start",
                          }}
                        >
                          <span style={{ fontSize: 12, color: on ? "var(--accent-primary)" : "var(--text-primary)", fontWeight: 500 }}>
                            {b.label}
                          </span>
                          <BudgetStatusPill status={b.status} />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {budget && <BudgetStatusPill status={budget.status} />}
            {role === "Owner" && budget?.status === "in-review" && (
              <>
                <button
                  onClick={() => setApproveConfirmOpen(true)}
                  style={{
                    background: "var(--accent-primary)",
                    color: "#fff",
                    border: "none",
                    padding: "8px 14px",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: "inherit",
                  }}
                >
                  {t("actions.approve_budget")}
                </button>
                <button
                  onClick={() => { setRequestChangesNotes(""); setRequestChangesOpen(true); }}
                  style={{
                    background: "transparent",
                    color: "var(--semantic-warning)",
                    border: "1px solid var(--semantic-warning)",
                    padding: "8px 14px",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 12,
                    fontFamily: "inherit",
                  }}
                >
                  {t("actions.request_changes")}
                </button>
                <button
                  onClick={() => { setRejectNotes(""); setRejectOpen(true); }}
                  style={{
                    background: "transparent",
                    color: "var(--semantic-danger)",
                    border: "1px solid var(--semantic-danger-border)",
                    padding: "8px 14px",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 12,
                    fontFamily: "inherit",
                  }}
                >
                  {t("actions.reject")}
                </button>
              </>
            )}
            {role === "Owner" && (budget?.status === "active" || budget?.status === "in-review") && (
              // Wired to POST /api/budgets/:id/lock (2026-04-21). OWNER-only;
              // transitions APPROVED | CHANGES_REQUESTED → LOCKED (mock
              // equivalents: "active" | "in-review"). Opens a
              // LockBudgetModal that collects a required reason (1..1000
              // chars). Replaces the previous placeholder toast.
              <button
                onClick={() => { setLockReason(""); setLockOpen(true); }}
                style={{
                  background: "transparent",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-strong)",
                  padding: "8px 14px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "inherit",
                }}
              >
                {t("actions.lock_fy")}
              </button>
            )}
            {role === "Owner" && (budget?.status === "locked" || budget?.status === "rejected") && (
              // Wired to POST /api/budgets/:id/reopen-to-draft (2026-04-21).
              // OWNER-only; transitions LOCKED | REJECTED → DRAFT. Replaces
              // the previous CFO-facing "Edit Budget" affordance. The P0
              // dispatch envisioned Edit Budget as a CFO action but backend
              // gated reopen to OWNER, so the UX moved: CFO asks Owner to
              // reopen when a non-DRAFT budget needs edits.
              <button
                onClick={() => { setReopenReason(""); setReopenOpen(true); }}
                style={{
                  background: "transparent",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-strong)",
                  padding: "8px 14px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "inherit",
                }}
              >
                {t("actions.reopen_to_draft")}
              </button>
            )}
            {role !== "Junior" && (
              <button
                style={{
                  background: "transparent",
                  color: "var(--text-secondary)",
                  border: "1px solid var(--border-strong)",
                  padding: "8px 14px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "inherit",
                }}
              >
                {t("actions.export_pdf")}
              </button>
            )}
            {/*
              Removed CFO "Edit Budget" button (2026-04-21). Rationale:
              backend reopen-to-draft endpoint is OWNER-only, so the CFO
              cannot transition a non-DRAFT budget back to editable state
              unilaterally. When budget.status === DRAFT, the per-line
              edit affordances on DepartmentRow are already live; when
              non-DRAFT, the CFO must now request the Owner to reopen
              (Owner surfaces the "Reopen to draft" button above when
              status is LOCKED | REJECTED). This eliminates the previous
              placeholder toast dead-end on non-DRAFT state.
            */}
            {/* Approval state pill */}
            {budget && !readOnly && (
              <button onClick={openApprovalState} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", padding: "4px 10px", borderRadius: 12, background: budget.status === "approved" || budget.status === "active" ? "var(--accent-primary-subtle)" : budget.status === "rejected" ? "var(--semantic-danger-subtle)" : "var(--semantic-warning-subtle)", border: `1px solid ${budget.status === "approved" || budget.status === "active" ? "var(--accent-primary-border)" : budget.status === "rejected" ? "var(--semantic-danger-border)" : "var(--semantic-warning)"}`, color: budget.status === "approved" || budget.status === "active" ? "var(--accent-primary)" : budget.status === "rejected" ? "var(--semantic-danger)" : "var(--semantic-warning)", cursor: "pointer", fontFamily: "inherit" }}>
                {budget.status === "approved" || budget.status === "active" ? <CheckCircle2 size={10} /> : budget.status === "rejected" ? <XCircle size={10} /> : <Clock size={10} />}
                {t(`approval.${budget.status === "active" ? "approved" : budget.status}`)}
              </button>
            )}
            {/* Historical year buttons */}
            {role !== "Junior" && (
              <div style={{ display: "flex", gap: 4 }}>
                {[2024, 2025, 2026].map((yr) => (
                  <button key={yr} onClick={() => switchToYear(yr)} style={{ fontSize: 10, fontWeight: 600, padding: "4px 10px", borderRadius: 12, background: (viewingYear === yr || (viewingYear === null && yr === (budget?.period?.fiscalYear || 2026))) ? "var(--accent-primary-subtle)" : "transparent", border: (viewingYear === yr || (viewingYear === null && yr === (budget?.period?.fiscalYear || 2026))) ? "1px solid var(--accent-primary-border)" : "1px solid var(--border-default)", color: (viewingYear === yr || (viewingYear === null && yr === (budget?.period?.fiscalYear || 2026))) ? "var(--accent-primary)" : "var(--text-tertiary)", cursor: "pointer", fontFamily: "inherit" }}>
                    {yr === (budget?.period?.fiscalYear || 2026) ? t("historical.current", { year: yr }) : yr}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Read-only historical banner */}
        {readOnly && (
          <PersistentBanner
            open={true}
            onDismiss={() => { setViewingYear(null); setHistoricalBudget(null); }}
            title={t("historical.read_only_banner", { year: viewingYear })}
            body={<ActionButton variant="tertiary" size="sm" label={t("historical.back")} onClick={() => { setViewingYear(null); setHistoricalBudget(null); }} />}
            variant="info"
            dismissible
          />
        )}

        {/* Workflow status strip — shown for non-active budgets or pending approval */}
        {budget && role !== "Junior" && budget.status !== "active" && budget.status !== "closed" && (
          <BudgetWorkflowStatusStrip
            budget={budget}
            role={role}
            refreshKey={refreshKey}
            onSendForApproval={async () => {
              // Live POST /api/budgets/:id/submit-approval (Dispatch 6).
              // 400 if budget is not DRAFT — error surfaces via client.js
              // normalised rejection; caught and toasted below.
              try {
                await submitBudgetForApprovalLive(budget.id);
                refresh();
              } catch (err) {
                showToast(err?.message || t("toast.submit_failed"));
              }
            }}
            onApprove={async () => {
              // approveBudget remains on the legacy engine path — this is
              // the EXISTING /api/budgets/:id/approve endpoint (Owner
              // finalisation). Dispatch 6 introduced the per-department
              // approval endpoint (see DepartmentRow) but explicitly
              // decided the Owner-finalise call stays the existing
              // /approve. See src/api/budgets.js file header for the
              // nextAction contract.
              await approveBudget(budget.id, "owner");
              refresh();
            }}
            onRequestChanges={async () => {
              // Live POST /api/budgets/:id/request-changes (Dispatch 6).
              // OWNER ONLY; body requires { notes: 1..1000 chars }.
              // 400 on non-PENDING_APPROVAL; 403 to non-Owner callers —
              // forwarded as toast.
              const n = window.prompt(t("prompts.change_request_notes"), "");
              if (n == null || !n.trim()) return;
              try {
                await requestBudgetChangesLive(budget.id, { notes: n.trim() });
                refresh();
              } catch (err) {
                showToast(err?.message || t("toast.request_changes_failed"));
              }
            }}
            onDelegate={() => setDelegateOpen(true)}
          />
        )}

        {/* Aminah narration */}
        {budget && (
          <AminahNarrationCard
            text={budget.aminahNarration}
            onAsk={() => onOpenAminah && onOpenAminah("FY 2026 budget")}
          />
        )}

        {/* Summary strip */}
        {role !== "Junior" && (
          <BudgetSummaryStrip summary={summaryWithVariance} expenseVarianceTotal={expenseVarianceTotal} />
        )}

        {/* Departments table */}
        <div
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-default)",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: COLS_HEADER,
              gap: 12,
              padding: "12px 18px",
              background: "var(--bg-surface-sunken)",
              borderBottom: "1px solid var(--border-default)",
            }}
          >
            <HeaderCell>{t("columns.department")}</HeaderCell>
            <HeaderCell>{t("columns.owner")}</HeaderCell>
            <HeaderCell align="right">{t("columns.annual")}</HeaderCell>
            <HeaderCell align="right">{t("columns.ytd_budget")}</HeaderCell>
            <HeaderCell align="right">{t("columns.ytd_actual")}</HeaderCell>
            <HeaderCell align="right">{t("columns.variance")}</HeaderCell>
            <HeaderCell>{t("columns.pct_used")}</HeaderCell>
            <HeaderCell align="center">{t("columns.status")}</HeaderCell>
            <HeaderCell> </HeaderCell>
          </div>
          {displayedRows.map((row) => {
            const dept = budget?.departments?.find((d) => d.id === row.id);
            const wf = dept?.workflowStatus;
            let rowMode = "view";
            if (role === "Junior" && (wf === "assigned" || wf === "in-progress" || wf === "needs-revision")) {
              rowMode = "edit";
            } else if (role === "CFO" && budget?.status !== "active" && budget?.status !== "closed" && wf === "submitted") {
              rowMode = "review";
            }
            const juniorMap = { Junior: "sara", CFO: "cfo", Owner: "owner" };
            return (
              <DepartmentRow
                key={row.id}
                row={row}
                expanded={expandedId === row.id}
                onToggle={(r) => setExpandedId(expandedId === r.id ? null : r.id)}
                ownerName={ownerName(row.ownerUserId)}
                mode={rowMode}
                budget={budget}
                department={dept}
                currentUserId={juniorMap[role] || "cfo"}
                onRefresh={refresh}
                onToast={showToast}
              />
            );
          })}
        </div>

        {/* Junior: collapsed read-only summary of others */}
        {juniorOnlyId && otherRows.length > 0 && (
          <div
            style={{
              marginTop: 18,
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 10,
              padding: "14px 18px",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.15em",
                color: "var(--text-tertiary)",
                marginBottom: 10,
              }}
            >
              {t("other_depts")}
            </div>
            {otherRows.map((r) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: "1px solid var(--border-subtle)",
                  fontSize: 12,
                }}
              >
                <span style={{ color: "var(--text-secondary)" }}>{r.name}</span>
                <span style={{ color: "var(--text-tertiary)", flex: 1, textAlign: "end", marginInlineEnd: 18 }}>
                  {t("owner_label", { name: ownerName(r.ownerUserId) })}
                </span>
                <span
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    color: "var(--text-primary)",
                    fontVariantNumeric: "tabular-nums",
                    minWidth: 120,
                    textAlign: "end",
                  }}
                >
                  KWD {r.budgetAnnual.toLocaleString("en-US", {
                    minimumFractionDigits: 3,
                    maximumFractionDigits: 3,
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--accent-primary-subtle)",
            border: "1px solid var(--accent-primary-border)",
            color: "var(--accent-primary)",
            padding: "10px 18px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 500,
            zIndex: 400,
          }}
        >
          {toast}
        </div>
      )}
      <DelegateBudgetModal
        open={delegateOpen}
        budgetId={budget?.id}
        onClose={() => setDelegateOpen(false)}
        onDelegated={(count) => {
          refresh();
          showToast(t("toast.delegated", { count }));
        }}
      />

      {/* HASEEB-153 — Owner approval-flow modals. */}
      <ApproveBudgetConfirmModal
        open={approveConfirmOpen}
        onClose={() => { if (!approveSubmitting) setApproveConfirmOpen(false); }}
        onConfirm={handleApproveBudget}
        periodLabel={budget?.period?.label || ""}
        submitting={approveSubmitting}
      />
      <RequestBudgetChangesModal
        open={requestChangesOpen}
        onClose={() => { if (!requestChangesSubmitting) { setRequestChangesOpen(false); setRequestChangesNotes(""); } }}
        notes={requestChangesNotes}
        onNotesChange={setRequestChangesNotes}
        onConfirm={handleRequestChangesSubmit}
        submitting={requestChangesSubmitting}
      />
      <RejectBudgetModal
        open={rejectOpen}
        onClose={() => { if (!rejectSubmitting) { setRejectOpen(false); setRejectNotes(""); } }}
        notes={rejectNotes}
        onNotesChange={setRejectNotes}
        onConfirm={handleRejectSubmit}
        submitting={rejectSubmitting}
      />
      {/* Lock + Reopen-to-Draft modals (2026-04-21). */}
      <LockBudgetModal
        open={lockOpen}
        onClose={() => { if (!lockSubmitting) { setLockOpen(false); setLockReason(""); } }}
        reason={lockReason}
        onReasonChange={setLockReason}
        onConfirm={handleLockSubmit}
        submitting={lockSubmitting}
      />
      <ReopenToDraftBudgetModal
        open={reopenOpen}
        onClose={() => { if (!reopenSubmitting) { setReopenOpen(false); setReopenReason(""); } }}
        reason={reopenReason}
        onReasonChange={setReopenReason}
        onConfirm={handleReopenSubmit}
        submitting={reopenSubmitting}
      />

      {/* Approval workflow slide-over */}
      {approvalOpen && approvalState && (
        <>
          <div onClick={() => setApprovalOpen(false)} style={{ position: "fixed", inset: 0, background: "var(--overlay-backdrop)", zIndex: 300 }} />
          <div style={{ position: "fixed", top: 0, insetInlineEnd: 0, bottom: 0, width: 420, maxWidth: "calc(100vw - 32px)", background: "var(--bg-surface-raised)", borderInlineStart: "1px solid var(--border-default)", zIndex: 301, boxShadow: "-24px 0 60px rgba(0,0,0,0.7)", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: "var(--text-primary)" }}>{t("approval.workflow_title")}</div>
              <button onClick={() => setApprovalOpen(false)} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}><X size={16} /></button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 22px" }}>
              {/*
                Live Dispatch 6 approval-state DTO:
                  { budgetStatus, nextAction, reviewers:[{role, userId,
                    userName, status:'pending'|'approved'|'needs_revision',
                    decidedAt?}], history:[{action, actor, timestamp, notes?}] }
              */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                {approvalState.budgetStatus === "APPROVED" || approvalState.budgetStatus === "LOCKED" ? (
                  <CheckCircle2 size={20} color="var(--accent-primary)" />
                ) : (
                  <Clock size={20} color="var(--semantic-warning)" />
                )}
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
                  {/* HASEEB-160: was rendering raw UPPER_SNAKE enum; now
                      resolved via the budget.status.* i18n mapper. */}
                  {budgetStatusLabel(t, approvalState.budgetStatus)}
                </div>
              </div>
              {/* nextAction is the authoritative "what's next" string from
                  the backend. We look it up in budget.next_action.* when a
                  key exists so it localises cleanly; otherwise we fall
                  through to the backend-authored prose unchanged. Backend
                  drift flagged for future dispatch: once the backend
                  standardises nextAction keys, add them to the locale. */}
              {approvalState.nextAction && (
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.5 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-tertiary)", display: "block", marginBottom: 4 }}>
                    {t("approval.next_action_label")}
                  </span>
                  {t(`next_action.${String(approvalState.nextAction).toLowerCase()}`, { defaultValue: approvalState.nextAction })}
                </div>
              )}
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 8 }}>{t("approval.reviewers_heading")}</div>
              {(approvalState.reviewers || []).map((r, i) => {
                const color = r.status === "approved"
                  ? "var(--accent-primary)"
                  : r.status === "needs_revision"
                    ? "var(--semantic-warning)"
                    : "var(--text-tertiary)";
                return (
                  <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid var(--border-subtle)", fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>{r.userName || r.role}</span>
                      {r.userName && r.role && r.userName !== r.role && (
                        <span style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>{r.role}</span>
                      )}
                    </div>
                    {/* HASEEB-160: was rendering (r.status || "pending").toUpperCase().replace(/_/g, " ")
                        which leaked enum vocabulary and was English-centric. */}
                    <span style={{ color, fontWeight: 600, fontSize: 10, letterSpacing: "0.1em", whiteSpace: "nowrap" }}>
                      {reviewerStatusLabel(t, r.status || "pending")}
                    </span>
                  </div>
                );
              })}
              {(approvalState.history || []).length > 0 && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginTop: 16, marginBottom: 8 }}>{t("approval.history_heading")}</div>
                  {approvalState.history.map((h, i) => (
                    <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid var(--border-subtle)", fontSize: 11, color: "var(--text-tertiary)" }}>
                      {/* HASEEB-160: was rendering {h.action || "—"} raw;
                          now resolved via budget.history_action.* mapper. */}
                      <span style={{ color: "var(--text-secondary)" }}>{historyActionLabel(t, h.action)}</span>
                      {h.actor && <span> · {h.actor}</span>}
                      {h.timestamp && (
                        <span style={{ marginInlineStart: 6 }}>
                          · {new Date(h.timestamp).toLocaleDateString()}
                        </span>
                      )}
                      {h.notes && (
                        <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2, fontStyle: "italic" }}>{h.notes}</div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* Comment thread panel (inline below budget table) */}
      {commentLineId && (
        <div style={{ position: "fixed", bottom: 0, insetInlineEnd: 0, width: 380, maxWidth: "calc(100vw - 32px)", background: "var(--bg-surface-raised)", borderInlineStart: "1px solid var(--border-default)", borderTop: "1px solid var(--border-default)", zIndex: 250, boxShadow: "-8px -8px 24px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", maxHeight: "50vh" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{t("comments.title", { count: comments.length })}</div>
            <button onClick={() => setCommentLineId(null)} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer" }}><X size={14} /></button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "10px 16px" }}>
            {comments.length === 0 ? (
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", textAlign: "center", padding: 16 }}>{t("comments.empty")}</div>
            ) : comments.map((c) => (
              <div key={c.id} style={{ marginBottom: 10, padding: "8px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-tertiary)", marginBottom: 3 }}>
                  <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>{c.authorRole}</span>
                  <span>{new Date(c.createdAt).toLocaleDateString()}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.5 }}>{c.content}</div>
              </div>
            ))}
          </div>
          {!readOnly && (
            <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border-subtle)", display: "flex", gap: 8 }}>
              <input value={commentDraft} onChange={(e) => setCommentDraft(e.target.value)} placeholder={t("comments.placeholder")} onKeyDown={(e) => { if (e.key === "Enter") postComment(); }} style={{ flex: 1, background: "var(--bg-surface-sunken)", border: "1px solid var(--border-default)", borderRadius: 6, padding: "8px 10px", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
              <ActionButton variant="primary" size="sm" label={t("comments.post_button")} onClick={postComment} disabled={!commentDraft.trim()} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// HASEEB-153 — Owner approval modal components. Pattern mirrors the
// LockReconciliationModal in ReconciliationScreen.jsx (Escape-to-close,
// backdrop click, OK/Cancel footer, proper textarea with maxLength).
// All copy is i18n; EN + AR parity preserved.

function ApproveBudgetConfirmModal({ open, onClose, onConfirm, periodLabel, submitting }) {
  const { t } = useTranslation("budget");
  useEscapeKey(onClose, open);
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "var(--overlay-backdrop)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 460, maxWidth: "calc(100vw - 32px)", background: "var(--panel-bg)", border: "1px solid var(--border-default)", borderRadius: 12, zIndex: 301, boxShadow: "var(--shadow-xl)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle2 size={16} color="var(--accent-primary)" />
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--text-primary)" }}>{t("approve_confirm.title")}</div>
          </div>
          <button type="button" onClick={onClose} aria-label={t("request_changes_modal.close")} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ padding: "18px 22px", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          {t("approve_confirm.body_prefix")}
          <strong style={{ color: "var(--text-primary)" }}>{periodLabel}</strong>
          {t("approve_confirm.body_suffix")}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid var(--border-subtle)" }}>
          <button type="button" onClick={onClose} disabled={submitting} style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-strong)", padding: "9px 16px", borderRadius: 6, cursor: submitting ? "not-allowed" : "pointer", fontSize: 12, fontFamily: "inherit" }}>{t("request_changes_modal.cancel")}</button>
          <button type="button" onClick={onConfirm} disabled={submitting} style={{ background: submitting ? "var(--border-subtle)" : "var(--accent-primary)", color: submitting ? "var(--text-tertiary)" : "#fff", border: "none", padding: "9px 18px", borderRadius: 6, cursor: submitting ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
            {submitting ? "…" : t("actions.approve_budget")}
          </button>
        </div>
      </div>
    </>
  );
}

function RequestBudgetChangesModal({ open, onClose, notes, onNotesChange, onConfirm, submitting }) {
  const { t } = useTranslation("budget");
  useEscapeKey(onClose, open);
  if (!open) return null;
  const trimmed = (notes || "").trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= 1000 && !submitting;
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "var(--overlay-backdrop)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 520, maxWidth: "calc(100vw - 32px)", background: "var(--panel-bg)", border: "1px solid var(--border-default)", borderRadius: 12, zIndex: 301, boxShadow: "var(--shadow-xl)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>{t("request_changes_modal.label")}</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--text-primary)", marginTop: 4 }}>{t("request_changes_modal.title")}</div>
          </div>
          <button type="button" onClick={onClose} aria-label={t("request_changes_modal.close")} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ padding: "18px 22px" }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 14 }}>
            {t("request_changes_modal.body")}
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", color: "var(--text-tertiary)", marginBottom: 5 }}>{t("request_changes_modal.notes_label")}</div>
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              maxLength={1000}
              rows={5}
              placeholder={t("request_changes_modal.notes_placeholder")}
              style={{ width: "100%", boxSizing: "border-box", background: "var(--bg-surface-sunken)", border: "1px solid var(--border-default)", borderRadius: 6, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical" }}
            />
            <div style={{ marginTop: 4, fontSize: 10, color: "var(--text-tertiary)", textAlign: "end" }}>
              {t("request_changes_modal.notes_counter", { count: (notes || "").length })}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid var(--border-subtle)" }}>
          <button type="button" onClick={onClose} disabled={submitting} style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-strong)", padding: "9px 16px", borderRadius: 6, cursor: submitting ? "not-allowed" : "pointer", fontSize: 12, fontFamily: "inherit" }}>{t("request_changes_modal.cancel")}</button>
          <button type="button" onClick={onConfirm} disabled={!canSubmit} style={{ background: canSubmit ? "var(--semantic-warning)" : "var(--border-subtle)", color: canSubmit ? "#fff" : "var(--text-tertiary)", border: "none", padding: "9px 18px", borderRadius: 6, cursor: canSubmit ? "pointer" : "not-allowed", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
            {submitting ? t("request_changes_modal.submitting") : t("request_changes_modal.submit")}
          </button>
        </div>
      </div>
    </>
  );
}

function RejectBudgetModal({ open, onClose, notes, onNotesChange, onConfirm, submitting }) {
  const { t } = useTranslation("budget");
  useEscapeKey(onClose, open);
  if (!open) return null;
  const trimmed = (notes || "").trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= 1000 && !submitting;
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "var(--overlay-backdrop)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 520, maxWidth: "calc(100vw - 32px)", background: "var(--panel-bg)", border: "1px solid var(--border-default)", borderRadius: 12, zIndex: 301, boxShadow: "var(--shadow-xl)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--semantic-danger)" }}>{t("reject_modal.label")}</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--text-primary)", marginTop: 4 }}>{t("reject_modal.title")}</div>
          </div>
          <button type="button" onClick={onClose} aria-label={t("reject_modal.close")} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ padding: "18px 22px" }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 14 }}>
            {t("reject_modal.body")}
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", color: "var(--text-tertiary)", marginBottom: 5 }}>{t("reject_modal.reason_label")}</div>
            <textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              maxLength={1000}
              rows={5}
              placeholder={t("reject_modal.reason_placeholder")}
              style={{ width: "100%", boxSizing: "border-box", background: "var(--bg-surface-sunken)", border: "1px solid var(--border-default)", borderRadius: 6, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical" }}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid var(--border-subtle)" }}>
          <button type="button" onClick={onClose} disabled={submitting} style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-strong)", padding: "9px 16px", borderRadius: 6, cursor: submitting ? "not-allowed" : "pointer", fontSize: 12, fontFamily: "inherit" }}>{t("reject_modal.cancel")}</button>
          <button type="button" onClick={onConfirm} disabled={!canSubmit} style={{ background: canSubmit ? "var(--semantic-danger)" : "var(--border-subtle)", color: canSubmit ? "#fff" : "var(--text-tertiary)", border: "none", padding: "9px 18px", borderRadius: 6, cursor: canSubmit ? "pointer" : "not-allowed", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
            {submitting ? t("reject_modal.submitting") : t("reject_modal.submit")}
          </button>
        </div>
      </div>
    </>
  );
}

// Lock modal (2026-04-21). Pattern mirrors RejectBudgetModal
// (reason-required textarea, 1..1000 char validation, Escape-to-close,
// backdrop click, submitting state). OWNER-only; transitions APPROVED |
// CHANGES_REQUESTED → LOCKED on the backend. Copy uses the neutral-slate
// palette (not danger) because locking is a freeze, not an alert.
function LockBudgetModal({ open, onClose, reason, onReasonChange, onConfirm, submitting }) {
  const { t } = useTranslation("budget");
  useEscapeKey(onClose, open);
  if (!open) return null;
  const trimmed = (reason || "").trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= 1000 && !submitting;
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "var(--overlay-backdrop)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 520, maxWidth: "calc(100vw - 32px)", background: "var(--panel-bg)", border: "1px solid var(--border-default)", borderRadius: 12, zIndex: 301, boxShadow: "var(--shadow-xl)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>{t("lock_modal.label")}</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--text-primary)", marginTop: 4 }}>{t("lock_modal.title")}</div>
          </div>
          <button type="button" onClick={onClose} aria-label={t("lock_modal.close")} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ padding: "18px 22px" }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 14 }}>
            {t("lock_modal.body")}
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", color: "var(--text-tertiary)", marginBottom: 5 }}>{t("lock_modal.reason_label")}</div>
            <textarea
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              maxLength={1000}
              rows={5}
              placeholder={t("lock_modal.reason_placeholder")}
              style={{ width: "100%", boxSizing: "border-box", background: "var(--bg-surface-sunken)", border: "1px solid var(--border-default)", borderRadius: 6, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical" }}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid var(--border-subtle)" }}>
          <button type="button" onClick={onClose} disabled={submitting} style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-strong)", padding: "9px 16px", borderRadius: 6, cursor: submitting ? "not-allowed" : "pointer", fontSize: 12, fontFamily: "inherit" }}>{t("lock_modal.cancel")}</button>
          <button type="button" onClick={onConfirm} disabled={!canSubmit} style={{ background: canSubmit ? "var(--text-primary)" : "var(--border-subtle)", color: canSubmit ? "var(--bg-surface)" : "var(--text-tertiary)", border: "none", padding: "9px 18px", borderRadius: 6, cursor: canSubmit ? "pointer" : "not-allowed", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
            {submitting ? t("lock_modal.submitting") : t("lock_modal.submit")}
          </button>
        </div>
      </div>
    </>
  );
}

// Reopen-to-Draft modal (2026-04-21). Same pattern as Lock and Reject
// modals. OWNER-only; transitions LOCKED | REJECTED → DRAFT. Uses the
// accent-primary (teal) palette on submit because this is the
// unblocking action — moving a frozen/rejected budget back into an
// editable state.
function ReopenToDraftBudgetModal({ open, onClose, reason, onReasonChange, onConfirm, submitting }) {
  const { t } = useTranslation("budget");
  useEscapeKey(onClose, open);
  if (!open) return null;
  const trimmed = (reason || "").trim();
  const canSubmit = trimmed.length > 0 && trimmed.length <= 1000 && !submitting;
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "var(--overlay-backdrop)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 520, maxWidth: "calc(100vw - 32px)", background: "var(--panel-bg)", border: "1px solid var(--border-default)", borderRadius: 12, zIndex: 301, boxShadow: "var(--shadow-xl)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--accent-primary)" }}>{t("reopen_to_draft_modal.label")}</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--text-primary)", marginTop: 4 }}>{t("reopen_to_draft_modal.title")}</div>
          </div>
          <button type="button" onClick={onClose} aria-label={t("reopen_to_draft_modal.close")} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}><X size={18} /></button>
        </div>
        <div style={{ padding: "18px 22px" }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 14 }}>
            {t("reopen_to_draft_modal.body")}
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", color: "var(--text-tertiary)", marginBottom: 5 }}>{t("reopen_to_draft_modal.reason_label")}</div>
            <textarea
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              maxLength={1000}
              rows={5}
              placeholder={t("reopen_to_draft_modal.reason_placeholder")}
              style={{ width: "100%", boxSizing: "border-box", background: "var(--bg-surface-sunken)", border: "1px solid var(--border-default)", borderRadius: 6, padding: "9px 12px", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical" }}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid var(--border-subtle)" }}>
          <button type="button" onClick={onClose} disabled={submitting} style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-strong)", padding: "9px 16px", borderRadius: 6, cursor: submitting ? "not-allowed" : "pointer", fontSize: 12, fontFamily: "inherit" }}>{t("reopen_to_draft_modal.cancel")}</button>
          <button type="button" onClick={onConfirm} disabled={!canSubmit} style={{ background: canSubmit ? "var(--accent-primary)" : "var(--border-subtle)", color: canSubmit ? "#fff" : "var(--text-tertiary)", border: "none", padding: "9px 18px", borderRadius: 6, cursor: canSubmit ? "pointer" : "not-allowed", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
            {submitting ? t("reopen_to_draft_modal.submitting") : t("reopen_to_draft_modal.submit")}
          </button>
        </div>
      </div>
    </>
  );
}
