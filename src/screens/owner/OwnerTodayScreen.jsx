import { useEffect, useState } from "react";
import SectionHeader from "../../components/SectionHeader";
import TaskboxSummaryCard from "../../components/taskbox/TaskboxSummaryCard";
import {
  getBusinessPulse,
  getOpenApprovalCount,
  getAuditChecks,
  getCloseStatus,
  getOwnerTopInsight,
  getBudgetVarianceByDepartment,
} from "../../engine/mockEngine";

function fmtN(n) {
  return Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function SectionCard({ label, extra, aminah = true, children }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 10,
        padding: "18px 20px",
        marginBottom: 16,
      }}
    >
      <SectionHeader label={label} extra={extra} aminah={aminah} />
      {children}
    </div>
  );
}

function KpiBlock({ label, value, accent, sub, onClick }) {
  return (
    <div
      onClick={onClick}
      onMouseEnter={(e) => {
        if (onClick) e.currentTarget.style.background = "rgba(255,255,255,0.03)";
      }}
      onMouseLeave={(e) => {
        if (onClick) e.currentTarget.style.background = "transparent";
      }}
      style={{
        flex: "1 1 200px",
        padding: "14px 16px",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        cursor: onClick ? "pointer" : "default",
        borderRadius: 6,
        transition: "background 0.12s ease",
      }}
    >
      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 22,
          fontWeight: 500,
          color: accent ? "#00C48C" : "#E6EDF3",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.12em",
          color: "#5B6570",
          marginTop: 4,
        }}
      >
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: "#8B98A5", marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function AttentionRow({ count, label, onClick }) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        width: "100%",
        padding: "12px 14px",
        margin: "4px -14px",
        background: "transparent",
        border: "none",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "inherit",
        borderRadius: 4,
      }}
    >
      <span
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 18,
          color: "#E6EDF3",
          fontWeight: 500,
          minWidth: 32,
          textAlign: "right",
        }}
      >
        {count}
      </span>
      <span style={{ flex: 1, fontSize: 13, color: "#8B98A5" }}>{label}</span>
      <span style={{ color: "#5B6570", fontSize: 14 }}>→</span>
    </button>
  );
}

function renderHighlighted(text) {
  const parts = (text || "").split(/(\[[^\]]+\])/g);
  return parts.map((p, i) => {
    if (p.startsWith("[") && p.endsWith("]")) {
      const inner = p.slice(1, -1);
      const isPos = /^\+/.test(inner) && !/over/i.test(inner);
      const isNeg = /over|overdue/i.test(inner);
      const color = isPos ? "#00C48C" : isNeg ? "#FF5A5F" : "#E6EDF3";
      const isNum = /KWD|%/.test(inner);
      return (
        <span
          key={i}
          style={{
            color,
            fontWeight: 500,
            fontFamily: isNum ? "'DM Mono', monospace" : "inherit",
          }}
        >
          {inner}
        </span>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

export default function OwnerTodayScreen({ setActiveScreen, onOpenTask, onOpenAminah }) {
  const [pulse, setPulse] = useState(null);
  const [approvals, setApprovals] = useState(0);
  const [audit, setAudit] = useState(null);
  const [close, setClose] = useState(null);
  const [insight, setInsight] = useState(null);
  const [budgetVariance, setBudgetVariance] = useState(null);

  useEffect(() => {
    getBusinessPulse().then(setPulse);
    getOpenApprovalCount("Owner").then(setApprovals);
    getAuditChecks().then(setAudit);
    getCloseStatus().then(setClose);
    getOwnerTopInsight().then(setInsight);
    getBudgetVarianceByDepartment().then((rows) => {
      const expenses = rows.filter((r) => r.category === "expense");
      const totalBudget = expenses.reduce((s, r) => s + r.budgetYtd, 0);
      const totalActual = expenses.reduce((s, r) => s + r.actualYtd, 0);
      const ratio = totalBudget === 0 ? 1 : totalActual / totalBudget;
      let label, color;
      if (ratio <= 1.0) { label = "vs budget: on track"; color = "#00C48C"; }
      else if (ratio <= 1.05) { label = "vs budget: approaching plan"; color = "#D4A84B"; }
      else { label = `vs budget: ${Math.round((ratio - 1) * 100)}% over plan`; color = "#FF5A5F"; }
      setBudgetVariance({ label, color });
    });
  }, []);

  const revDelta = pulse?.revenue?.percentChange ?? 0;
  const attentionCount =
    (approvals || 0) + (audit ? audit.failing : 0) + 1; // +1 for close sign-off

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px 32px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        {/* 1. BUSINESS PULSE */}
        <SectionCard label="BUSINESS PULSE">
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              marginTop: 4,
              marginInline: -16,
            }}
          >
            <KpiBlock
              label="REVENUE THIS MONTH"
              value={pulse ? fmtN(pulse.revenue.current) : "—"}
              sub={
                pulse && (
                  <span style={{ color: revDelta >= 0 ? "#00C48C" : "#FF5A5F" }}>
                    {revDelta >= 0 ? "▲" : "▼"} {Math.abs(revDelta).toFixed(1)}% vs last month
                  </span>
                )
              }
              onClick={() => setActiveScreen("financial-statements")}
            />
            <KpiBlock
              label="EXPENSES THIS MONTH"
              value={pulse ? fmtN(pulse.expenses.current) : "—"}
              sub={
                pulse && (
                  <span style={{ color: (pulse.expenses.percentChange || 0) >= 0 ? "#FF5A5F" : "#00C48C" }}>
                    {(pulse.expenses.percentChange || 0) >= 0 ? "▲" : "▼"}{" "}
                    {Math.abs(pulse.expenses.percentChange || 0).toFixed(1)}% vs last month
                  </span>
                )
              }
              onClick={() => setActiveScreen("financial-statements")}
            />
            <KpiBlock
              label="NET INCOME THIS MONTH"
              accent
              value={pulse ? fmtN(pulse.netIncome.current) : "—"}
              sub={
                pulse && (
                  <>
                    <span>
                      Gross {pulse.netIncome.grossMargin}% · Op {pulse.netIncome.operatingMargin}%
                    </span>
                    {budgetVariance && (
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          letterSpacing: "0.10em",
                          color: budgetVariance.color,
                          marginTop: 3,
                          textTransform: "lowercase",
                        }}
                      >
                        {budgetVariance.label}
                      </div>
                    )}
                  </>
                )
              }
              onClick={() => setActiveScreen("financial-statements")}
            />
            <KpiBlock
              label="CASH POSITION"
              accent
              value={pulse ? fmtN(pulse.cash.total) : "—"}
              sub={<span>{pulse ? pulse.cash.subtext : "across 4 KIB accounts"}</span>}
              onClick={() => setActiveScreen("bank-accounts")}
            />
          </div>
        </SectionCard>

        {/* 2. NEEDS YOUR ATTENTION */}
        <SectionCard
          label="NEEDS YOUR ATTENTION"
          extra={<span className="tension-dot tension-dot--warning">{attentionCount}</span>}
        >
          {approvals > 0 && (
            <AttentionRow
              count={approvals}
              label="approvals pending your decision"
              onClick={() => setActiveScreen("approvals")}
            />
          )}
          {audit && audit.failing > 0 && (
            <AttentionRow
              count={audit.failing}
              label="audit check failing — needs resolution"
              onClick={() => setActiveScreen("audit-bridge")}
            />
          )}
          <AttentionRow
            count={1}
            label="March close tracking for your sign-off"
            onClick={() => setActiveScreen("month-end-close")}
          />
        </SectionCard>

        {/* 3. TASKBOX SUMMARY */}
        <TaskboxSummaryCard
          role="Owner"
          onViewAll={() => setActiveScreen("taskbox")}
          onTaskClick={(t) => onOpenTask && onOpenTask(t.id)}
        />

        {/* 4. MARCH 2026 CLOSE */}
        {close && (
          <SectionCard label={`${close.period.toUpperCase()} CLOSE`}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
              <span
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 22,
                  fontWeight: 500,
                  color: "#E6EDF3",
                }}
              >
                {close.tasksComplete} / {close.tasksTotal}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: "#5B6570",
                  letterSpacing: "0.12em",
                  fontWeight: 600,
                }}
              >
                TASKS COMPLETE · {close.percentComplete}%
              </span>
            </div>
            <div
              style={{
                width: "100%",
                height: 4,
                background: "rgba(255,255,255,0.05)",
                borderRadius: 2,
                overflow: "hidden",
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  width: `${close.percentComplete}%`,
                  height: "100%",
                  background: "#00C48C",
                }}
              />
            </div>
            <div style={{ fontSize: 13, color: "#8B98A5", lineHeight: 1.7 }}>
              On track for April 3 close date.
              <br />
              CFO will request your sign-off when ready.
              <br />
              Last update: 45 min ago · Sara reconciled KIB Reserve.
            </div>
            <div style={{ marginTop: 12 }}>
              <a
                onClick={() => setActiveScreen("month-end-close")}
                style={{ fontSize: 12, color: "#00C48C", cursor: "pointer" }}
              >
                View close details →
              </a>
            </div>
          </SectionCard>
        )}

        {/* 5. AMINAH'S TOP INSIGHT */}
        {insight && (
          <SectionCard label="AMINAH'S TOP INSIGHT">
            <div style={{ fontSize: 14, color: "#8B98A5", lineHeight: 1.7 }}>
              {renderHighlighted(insight.text)}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button
                onClick={() => onOpenAminah && onOpenAminah("Marketing variance")}
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
                Ask Aminah more →
              </button>
              <a
                onClick={() => setActiveScreen("overview")}
                style={{
                  fontSize: 12,
                  color: "#00C48C",
                  cursor: "pointer",
                  alignSelf: "center",
                }}
              >
                See all insights
              </a>
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
