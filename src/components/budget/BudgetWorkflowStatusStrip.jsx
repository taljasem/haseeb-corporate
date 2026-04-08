import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getBudgetWorkflowSummary } from "../../engine/mockEngine";

const STATE_STYLE = {
  draft:              { key: "draft",             color: "#D4A84B" },
  delegated:          { key: "delegated",         color: "#3B82F6" },
  "in-review":        { key: "in_review",         color: "#D4A84B" },
  "pending-approval": { key: "pending_approval",  color: "#8B5CF6" },
  active:             { key: "active",            color: "#00C48C" },
  closed:             { key: "closed",            color: "#5B6570" },
};

const SEGMENT_COLOR = {
  unassigned:       "rgba(255,255,255,0.08)",
  assigned:         "#3B82F6",
  "in-progress":    "#3B82F666",
  submitted:        "#00C48C99",
  approved:         "#00C48C",
  "needs-revision": "#D4A84B",
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
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.08)",
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
              background: SEGMENT_COLOR[d.workflowStatus] || "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 3,
            }}
          />
        ))}
      </div>

      <div style={{ fontSize: 11, color: "#5B6570", whiteSpace: "nowrap" }}>
        {t("workflow_strip.submitted_count", { done: summary.approved + summary.submitted, total: summary.totalDepartments })}
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 6 }}>
        {role === "CFO" && budget.status === "draft" && (
          <button
            onClick={onDelegate}
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
            {t("actions.delegate_team")}
          </button>
        )}
        {role === "CFO" && budget.status === "delegated" && (
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
            {t("actions.send_reminders")}
          </button>
        )}
        {role === "CFO" && budget.status === "in-review" && (
          <button
            onClick={onSendForApproval}
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
            {t("actions.send_for_approval")}
          </button>
        )}
        {role === "Owner" && budget.status === "pending-approval" && (
          <>
            <button
              onClick={onApprove}
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
              {t("actions.approve_budget")}
            </button>
            <button
              onClick={onRequestChanges}
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
              {t("actions.request_changes")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
