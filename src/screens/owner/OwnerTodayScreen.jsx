import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react";
import SectionHeader from "../../components/SectionHeader";
import { useTenant } from "../../components/shared/TenantContext";
import DirArrow from "../../components/shared/DirArrow";
import EmptyState from "../../components/shared/EmptyState";
import TaskboxSummaryCard from "../../components/taskbox/TaskboxSummaryCard";
import {
  getBusinessPulse,
  getOpenApprovalCount,
  getAuditChecks,
  getCloseStatus,
  getOwnerTopInsightDynamic as getOwnerTopInsight,
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
        background: "var(--bg-surface)",
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
        if (onClick) e.currentTarget.style.background = "var(--bg-surface-sunken)";
      }}
      onMouseLeave={(e) => {
        if (onClick) e.currentTarget.style.background = "transparent";
      }}
      style={{
        flex: "1 1 200px",
        padding: "14px 16px",
        borderInlineEnd: "1px solid rgba(255,255,255,0.06)",
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
          color: accent ? "var(--accent-primary)" : "var(--text-primary)",
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
          color: "var(--text-tertiary)",
          marginTop: 4,
        }}
      >
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
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
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-sunken)")}
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
        textAlign: "start",
        fontFamily: "inherit",
        borderRadius: 4,
      }}
    >
      <span
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 18,
          color: "var(--text-primary)",
          fontWeight: 500,
          minWidth: 32,
          textAlign: "end",
        }}
      >
        {count}
      </span>
      <span style={{ flex: 1, fontSize: 13, color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ color: "var(--text-tertiary)", fontSize: 14 }}><DirArrow /></span>
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
      const color = isPos ? "var(--accent-primary)" : isNeg ? "var(--semantic-danger)" : "var(--text-primary)";
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
  const { t } = useTranslation("owner-today");
  const { t: tc } = useTranslation("common");
  const { tenant } = useTenant();
  const bankAbbr = tenant?.banks?.[0]?.abbreviation || "";
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
      if (ratio <= 1.0) { label = t("variance.on_track"); color = "var(--accent-primary)"; }
      else if (ratio <= 1.05) { label = t("variance.approaching"); color = "var(--semantic-warning)"; }
      else { label = t("variance.over_plan", { pct: Math.round((ratio - 1) * 100) }); color = "var(--semantic-danger)"; }
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
        <SectionCard label={t("sections.business_pulse")}>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              marginTop: 4,
              marginInline: -16,
            }}
          >
            <KpiBlock
              label={t("kpi.revenue")}
              value={pulse ? fmtN(pulse.revenue.current) : "—"}
              sub={
                pulse && (
                  <span style={{ color: revDelta >= 0 ? "var(--accent-primary)" : "var(--semantic-danger)" }}>
                    {revDelta >= 0 ? "▲" : "▼"} {t("kpi.vs_last_month", { delta: Math.abs(revDelta).toFixed(1) })}
                  </span>
                )
              }
              onClick={() => setActiveScreen("financial-statements")}
            />
            <KpiBlock
              label={t("kpi.expenses")}
              value={pulse ? fmtN(pulse.expenses.current) : "—"}
              sub={
                pulse && (
                  <span style={{ color: (pulse.expenses.percentChange || 0) >= 0 ? "var(--semantic-danger)" : "var(--accent-primary)" }}>
                    {(pulse.expenses.percentChange || 0) >= 0 ? "▲" : "▼"}{" "}
                    {t("kpi.vs_last_month", { delta: Math.abs(pulse.expenses.percentChange || 0).toFixed(1) })}
                  </span>
                )
              }
              onClick={() => setActiveScreen("financial-statements")}
            />
            <KpiBlock
              label={t("kpi.net_income")}
              accent
              value={pulse ? fmtN(pulse.netIncome.current) : "—"}
              sub={
                pulse && (
                  <>
                    <span>
                      {t("kpi.gross_op_margin", { gross: pulse.netIncome.grossMargin, op: pulse.netIncome.operatingMargin })}
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
              label={t("kpi.cash_position")}
              accent
              value={pulse ? fmtN(pulse.cash.total) : "—"}
              sub={<span>{pulse ? pulse.cash.subtext : t("kpi.cash_default_sub", { bank: bankAbbr })}</span>}
              onClick={() => setActiveScreen("bank-accounts")}
            />
          </div>
        </SectionCard>

        {/* 2. NEEDS YOUR ATTENTION */}
        <SectionCard
          label={t("sections.needs_attention")}
          extra={<span className="tension-dot tension-dot--warning">{attentionCount}</span>}
        >
          {attentionCount === 0 && (
            <EmptyState icon={CheckCircle2} title={tc("empty_states.today_no_attention_title")} description={tc("empty_states.today_no_attention_desc")} />
          )}
          {approvals > 0 && (
            <AttentionRow
              count={approvals}
              label={t("attention.approvals_pending")}
              onClick={() => setActiveScreen("approvals")}
            />
          )}
          {audit && audit.failing > 0 && (
            <AttentionRow
              count={audit.failing}
              label={t("attention.audit_failing")}
              onClick={() => setActiveScreen("audit-bridge")}
            />
          )}
          <AttentionRow
            count={1}
            label={t("attention.close_for_signoff")}
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
          <SectionCard label={t("sections.close_with_period", { period: close.period.toUpperCase() })}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
              <span
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 22,
                  fontWeight: 500,
                  color: "var(--text-primary)",
                }}
              >
                {close.tasksComplete} / {close.tasksTotal}
              </span>
              <span
                style={{
                  fontSize: 10,
                  color: "var(--text-tertiary)",
                  letterSpacing: "0.12em",
                  fontWeight: 600,
                }}
              >
                {t("close.tasks_complete_label", { pct: close.percentComplete })}
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
                  background: "var(--accent-primary)",
                }}
              />
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
              {t("close.on_track_line")}
              <br />
              {t("close.cfo_request")}
              <br />
              {t("close.last_update")}
            </div>
            <div style={{ marginTop: 12 }}>
              <a
                onClick={() => setActiveScreen("month-end-close")}
                style={{ fontSize: 12, color: "var(--accent-primary)", cursor: "pointer" }}
              >
                {t("close.view_details")}
              </a>
            </div>
          </SectionCard>
        )}

        {/* 5. AMINAH'S TOP INSIGHT */}
        {insight && (
          <SectionCard label={t("sections.top_insight")}>
            <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7 }}>
              {renderHighlighted(insight.text)}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button
                onClick={() => onOpenAminah && onOpenAminah("Marketing variance")}
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
                {t("insight.ask_more")}
              </button>
              <a
                onClick={() => setActiveScreen("overview")}
                style={{
                  fontSize: 12,
                  color: "var(--accent-primary)",
                  cursor: "pointer",
                  alignSelf: "center",
                }}
              >
                {t("insight.see_all")}
              </a>
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
