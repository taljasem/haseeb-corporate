import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, MessageCircle, ArrowUpRight, CheckCircle2, Clock, XCircle, AlertCircle, X } from "lucide-react";
import {
  getActiveBudget,
  getActiveBudgetSummary,
  getBudgetVarianceByDepartment,
  getBudgetById,
  getAllBudgets,
  getTeamMembers,
  submitBudgetForApproval,
  approveBudget,
  delegateBudget,
  approveDepartment,
  requestDepartmentRevision,
  requestBudgetChanges,
  getBudgetForYear,
  updateBudgetLine,
  deleteBudgetLine,
  createBudgetLine,
  addBudgetLineComment,
  getBudgetLineComments,
  deleteBudgetLineComment,
  getBudgetApprovalState,
} from "../../engine/mockEngine";
import AminahNarrationCard from "../financial/AminahNarrationCard";
import ActionButton from "../ds/ActionButton";
import PersistentBanner from "../ds/PersistentBanner";
import BudgetStatusPill from "./BudgetStatusPill";
import BudgetSummaryStrip from "./BudgetSummaryStrip";
import DepartmentRow from "./DepartmentRow";
import BudgetWorkflowStatusStrip from "./BudgetWorkflowStatusStrip";
import DelegateBudgetModal from "./DelegateBudgetModal";

const COLS_HEADER = "minmax(160px, 1.4fr) minmax(140px, 1fr) 130px 130px 130px 130px 180px 110px 18px";

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

  // Approval state handler
  const openApprovalState = async () => {
    if (!budget?.id) return;
    const state = await getBudgetApprovalState(budget.id);
    setApprovalState(state);
    setApprovalOpen(true);
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
                  }}
                >
                  {budget ? t("period_status", { period: budget.period.label.toUpperCase(), status: (budget.status || "").toUpperCase() }) : t("loading")}
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
                  style={{
                    background: "transparent",
                    color: "var(--semantic-warning)",
                    border: "1px solid rgba(212,168,75,0.30)",
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
                  style={{
                    background: "transparent",
                    color: "var(--semantic-danger)",
                    border: "1px solid rgba(255,90,95,0.30)",
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
            {role === "Owner" && budget?.status === "active" && (
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
                {t("actions.lock_fy")}
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
            {role === "CFO" && !readOnly && (
              <ActionButton variant="primary" label={t("actions.edit_budget")} onClick={() => {}} />
            )}
            {/* Approval state pill */}
            {budget && !readOnly && (
              <button onClick={openApprovalState} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", padding: "4px 10px", borderRadius: 12, background: budget.status === "approved" || budget.status === "active" ? "rgba(0,196,140,0.1)" : budget.status === "rejected" ? "rgba(239,68,68,0.1)" : "rgba(245,166,35,0.1)", border: `1px solid ${budget.status === "approved" || budget.status === "active" ? "rgba(0,196,140,0.3)" : budget.status === "rejected" ? "rgba(239,68,68,0.3)" : "rgba(245,166,35,0.3)"}`, color: budget.status === "approved" || budget.status === "active" ? "var(--accent-primary)" : budget.status === "rejected" ? "var(--semantic-danger)" : "var(--semantic-warning)", cursor: "pointer", fontFamily: "inherit" }}>
                {budget.status === "approved" || budget.status === "active" ? <CheckCircle2 size={10} /> : budget.status === "rejected" ? <XCircle size={10} /> : <Clock size={10} />}
                {t(`approval.${budget.status === "active" ? "approved" : budget.status}`)}
              </button>
            )}
            {/* Historical year buttons */}
            {role !== "Junior" && (
              <div style={{ display: "flex", gap: 4 }}>
                {[2024, 2025, 2026].map((yr) => (
                  <button key={yr} onClick={() => switchToYear(yr)} style={{ fontSize: 10, fontWeight: 600, padding: "4px 10px", borderRadius: 12, background: (viewingYear === yr || (viewingYear === null && yr === (budget?.period?.fiscalYear || 2026))) ? "rgba(0,196,140,0.08)" : "transparent", border: (viewingYear === yr || (viewingYear === null && yr === (budget?.period?.fiscalYear || 2026))) ? "1px solid rgba(0,196,140,0.3)" : "1px solid var(--border-default)", color: (viewingYear === yr || (viewingYear === null && yr === (budget?.period?.fiscalYear || 2026))) ? "var(--accent-primary)" : "var(--text-tertiary)", cursor: "pointer", fontFamily: "inherit" }}>
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
              await submitBudgetForApproval(budget.id);
              refresh();
            }}
            onApprove={async () => {
              await approveBudget(budget.id, "owner");
              refresh();
            }}
            onRequestChanges={async () => {
              // Minimal inline prompt for this pass
              const n = window.prompt("Change request notes for CFO:", "");
              if (n != null) {
                await requestBudgetChanges(budget.id, n);
                refresh();
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
            border: "1px solid rgba(0,196,140,0.30)",
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
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                {approvalState.status === "approved" || approvalState.status === "active" ? <CheckCircle2 size={20} color="var(--accent-primary)" /> : <Clock size={20} color="var(--semantic-warning)" />}
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>{t(`approval.${approvalState.status === "active" ? "approved" : approvalState.status}`)}</div>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 16 }}>{t("approval.next_action", { action: approvalState.nextAction })}</div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 8 }}>REVIEWERS</div>
              {(approvalState.reviewers || []).map((r, i) => (
                <div key={i} style={{ padding: "8px 0", borderBottom: "1px solid var(--border-subtle)", fontSize: 12, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-primary)" }}>{r.role}</span>
                  <span style={{ color: r.status === "approved" ? "var(--accent-primary)" : "var(--text-tertiary)", fontWeight: 600, fontSize: 10 }}>{r.status.toUpperCase()}</span>
                </div>
              ))}
              {(approvalState.history || []).length > 0 && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginTop: 16, marginBottom: 8 }}>WORKFLOW HISTORY</div>
                  {approvalState.history.map((h, i) => (
                    <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid var(--border-subtle)", fontSize: 11, color: "var(--text-tertiary)" }}>
                      <span style={{ color: "var(--text-secondary)" }}>{h.fromState || "—"} → {h.toState}</span>
                      {h.byUserId && <span> · {h.byUserId}</span>}
                      {h.note && <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2, fontStyle: "italic" }}>{h.note}</div>}
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
