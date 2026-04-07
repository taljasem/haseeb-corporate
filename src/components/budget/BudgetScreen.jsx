import { useEffect, useState } from "react";
import {
  getActiveBudget,
  getActiveBudgetSummary,
  getBudgetVarianceByDepartment,
  getTeamMembers,
} from "../../engine/mockEngine";
import AminahNarrationCard from "../financial/AminahNarrationCard";
import BudgetStatusPill from "./BudgetStatusPill";
import BudgetSummaryStrip from "./BudgetSummaryStrip";
import DepartmentRow from "./DepartmentRow";

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
  const [budget, setBudget] = useState(null);
  const [summary, setSummary] = useState(null);
  const [variance, setVariance] = useState(null);
  const [team, setTeam] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    getActiveBudget().then(setBudget);
    getActiveBudgetSummary().then(setSummary);
    getBudgetVarianceByDepartment().then(setVariance);
    getTeamMembers().then(setTeam);
  }, []);

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
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.15em",
                color: "#5B6570",
                marginTop: 6,
              }}
            >
              {role === "Junior"
                ? "DEPARTMENTS YOU OWN"
                : budget
                  ? budget.period.label.toUpperCase()
                  : "LOADING"}
            </div>
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
          {displayedRows.map((row) => (
            <DepartmentRow
              key={row.id}
              row={row}
              expanded={expandedId === row.id}
              onToggle={(r) => setExpandedId(expandedId === r.id ? null : r.id)}
              ownerName={ownerName(row.ownerUserId)}
            />
          ))}
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
    </div>
  );
}
