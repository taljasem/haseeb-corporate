import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getBudgetWorkflowSummary } from "../../engine/mockEngine";

const STATE_STYLE = {
  draft:              { key: "draft",             color: "var(--semantic-warning)" },
  delegated:          { key: "delegated",         color: "var(--semantic-info)" },
  "in-review":        { key: "in_review",         color: "var(--semantic-warning)" },
  "pending-approval": { key: "pending_approval",  color: "var(--role-owner)" },
  active:             { key: "active",            color: "var(--accent-primary)" },
  closed:             { key: "closed",            color: "var(--text-tertiary)" },
};

const SEGMENT_COLOR = {
  unassigned:       "var(--border-default)",
  assigned:         "var(--semantic-info)",
  "in-progress":    "#3B82F666",
  submitted:        "#00C48C99",
  approved:         "var(--accent-primary)",
  "needs-revision": "var(--semantic-warning)",
};

export default function BudgetWorkflowStatusStrip({ budget, role = "CFO", onDelegate, onSendForApproval, onApprove, onRequestChanges, refreshKey = 0 }) {
  const { t } = useTranslation("budget");
  const [summary, setSummary] = useState(null);
  useEffect(() => {
    if (!budget) return;
    getBudgetWorkflowSummary(budget.id).then(setSummary);
  }, [budget, refreshKey]);

  if (!budget || !summary) return null;

  const state = STATE_STYLE[budget.status] || STATE_STYLE.draft;

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: 10,
        padding: "14px 18px",
        marginBottom: 16,
        display: "flex",
        alignItems: "center",
        gap: 18,
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.15em",
          color: state.color,
          background: `${state.color}14`,
          border: `1px solid ${state.color}55`,
          padding: "5px 10px",
          borderRadius: 4,
          whiteSpace: "nowrap",
        }}
      >
        {t(`status_pill.${state.key}`)}
      </span>

      {/* Segmented progress */}
      <div style={{ flex: 1, minWidth: 220, display: "flex", gap: 3 }}>
        {summary.expenseDepartments.map((d) => (
          <span
            key={d.id}
            title={`${d.name} — ${d.workflowStatus}`}
            style={{
              flex: 1,
              height: 10,
              background: SEGMENT_COLOR[d.workflowStatus] || "var(--border-default)",
              border: "1px solid var(--border-default)",
              borderRadius: 3,
            }}
          />
        ))}
      </div>

      <div style={{ fontSize: 11, color: "var(--text-tertiary)", whiteSpace: "nowrap" }}>
        {t("workflow_strip.submitted_count", { done: summary.approved + summary.submitted, total: summary.totalDepartments })}
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 6 }}>
        {role === "CFO" && budget.status === "draft" && (
          <button
            onClick={onDelegate}
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
            {t("actions.delegate_team")}
          </button>
        )}
        {role === "CFO" && budget.status === "delegated" && (
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
            {t("actions.send_reminders")}
          </button>
        )}
        {role === "CFO" && budget.status === "in-review" && (
          <button
            onClick={onSendForApproval}
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
            {t("actions.send_for_approval")}
          </button>
        )}
        {role === "Owner" && budget.status === "pending-approval" && (
          <>
            <button
              onClick={onApprove}
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
              onClick={onRequestChanges}
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
          </>
        )}
      </div>
    </div>
  );
}
