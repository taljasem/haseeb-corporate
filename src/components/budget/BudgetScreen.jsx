import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
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
} from "../../engine/mockEngine";
import AminahNarrationCard from "../financial/AminahNarrationCard";
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
        color: "#5B6570",
        textAlign: align,
      }}
    >
      {children}
    </div>
  );
}

export default function BudgetScreen({ role = "CFO", onOpenAminah, juniorOnlyId = null }) {
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
  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };
  const periodRef = useRef(null);
  const refresh = () => setRefreshKey((k) => k + 1);

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
    if (id === "cfo") return "You (CFO)";
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
                color: "#E6EDF3",
                letterSpacing: "-0.3px",
                lineHeight: 1,
              }}
            >
              {role === "Junior" ? "MY BUDGET" : "BUDGET"}
            </div>
            {role === "Junior" ? (
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.15em",
                  color: "#5B6570",
                  marginTop: 6,
                }}
              >
                DEPARTMENTS YOU OWN
              </div>
            ) : (
              <div ref={periodRef} style={{ position: "relative", marginTop: 6 }}>
                <button
                  onClick={() => setPeriodOpen((o) => !o)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 6,
                    padding: "6px 12px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.12em",
                    color: "#E6EDF3",
                  }}
                >
                  {budget ? `${budget.period.label.toUpperCase()} · ${(budget.status || "").toUpperCase()}` : "LOADING"}
                  <ChevronDown size={12} color="#5B6570" />
                </button>
                {periodOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      left: 0,
                      width: 280,
                      background: "#0C0E12",
                      border: "1px solid rgba(255,255,255,0.10)",
                      borderRadius: 10,
                      boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
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
                            if (!on) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
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
                            background: on ? "rgba(0,196,140,0.06)" : "transparent",
                            border: "none",
                            borderBottom: "1px solid rgba(255,255,255,0.04)",
                            cursor: "pointer",
                            fontFamily: "inherit",
                            textAlign: "left",
                          }}
                        >
                          <span style={{ fontSize: 12, color: on ? "#00C48C" : "#E6EDF3", fontWeight: 500 }}>
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
                    background: "#00C48C",
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
                  Approve budget
                </button>
                <button
                  style={{
                    background: "transparent",
                    color: "#D4A84B",
                    border: "1px solid rgba(212,168,75,0.30)",
                    padding: "8px 14px",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 12,
                    fontFamily: "inherit",
                  }}
                >
                  Request changes
                </button>
                <button
                  style={{
                    background: "transparent",
                    color: "#FF5A5F",
                    border: "1px solid rgba(255,90,95,0.30)",
                    padding: "8px 14px",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 12,
                    fontFamily: "inherit",
                  }}
                >
                  Reject
                </button>
              </>
            )}
            {role === "Owner" && budget?.status === "active" && (
              <button
                style={{
                  background: "transparent",
                  color: "#8B98A5",
                  border: "1px solid rgba(255,255,255,0.15)",
                  padding: "8px 14px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "inherit",
                }}
              >
                Lock for FY 2026
              </button>
            )}
            {role !== "Junior" && (
              <button
                style={{
                  background: "transparent",
                  color: "#8B98A5",
                  border: "1px solid rgba(255,255,255,0.15)",
                  padding: "8px 14px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "inherit",
                }}
              >
                Export PDF
              </button>
            )}
            {role === "CFO" && (
              <button
                style={{
                  background: "#00C48C",
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
                Edit budget
              </button>
            )}
          </div>
        </div>

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
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.08)",
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
              background: "rgba(255,255,255,0.03)",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <HeaderCell>DEPARTMENT</HeaderCell>
            <HeaderCell>OWNER</HeaderCell>
            <HeaderCell align="right">ANNUAL</HeaderCell>
            <HeaderCell align="right">YTD BUDGET</HeaderCell>
            <HeaderCell align="right">YTD ACTUAL</HeaderCell>
            <HeaderCell align="right">VARIANCE</HeaderCell>
            <HeaderCell>% USED</HeaderCell>
            <HeaderCell align="center">STATUS</HeaderCell>
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
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 10,
              padding: "14px 18px",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.15em",
                color: "#5B6570",
                marginBottom: 10,
              }}
            >
              OTHER DEPARTMENTS (READ-ONLY SUMMARY)
            </div>
            {otherRows.map((r) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  fontSize: 12,
                }}
              >
                <span style={{ color: "#8B98A5" }}>{r.name}</span>
                <span style={{ color: "#5B6570", flex: 1, textAlign: "right", marginRight: 18 }}>
                  Owner: {ownerName(r.ownerUserId)}
                </span>
                <span
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    color: "#E6EDF3",
                    fontVariantNumeric: "tabular-nums",
                    minWidth: 120,
                    textAlign: "right",
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
            background: "rgba(0,196,140,0.10)",
            border: "1px solid rgba(0,196,140,0.30)",
            color: "#00C48C",
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
          showToast(`Delegated to ${count} team members`);
        }}
      />
    </div>
  );
}
