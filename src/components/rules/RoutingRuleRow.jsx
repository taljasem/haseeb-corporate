import { useTranslation } from "react-i18next";
import { UserPlus, ChevronDown, ChevronUp } from "lucide-react";
import { StatusPill } from "./StatusPills";
import RuleDetailExpanded from "./RuleDetailExpanded";
import { formatKWD } from "../../utils/format";
import { formatRelativeTime } from "../../utils/relativeTime";

function buildConditionSummary(trigger, t) {
  const parts = [];
  if (trigger.taskTypes && trigger.taskTypes.length && !trigger.taskTypes.includes("all")) {
    parts.push(t("row.condition_type", { values: trigger.taskTypes.join("/") }));
  }
  const c = trigger.conditions || {};
  if (c.amountMin != null) parts.push(t("row.condition_amount_min", { amount: formatKWD(c.amountMin) }));
  if (c.amountMax != null) parts.push(t("row.condition_amount_max", { amount: formatKWD(c.amountMax) }));
  if (c.merchantPattern)   parts.push(t("row.condition_merchant", { pattern: c.merchantPattern }));
  if (c.accountCategory)   parts.push(t("row.condition_category", { value: c.accountCategory }));
  if (c.costCenter)        parts.push(t("row.condition_cost_center", { value: c.costCenter }));
  return parts.length ? t("row.condition_prefix", { conditions: parts.join(" AND ") }) : "";
}

export default function RoutingRuleRow({ rule, expanded, onToggle, onEdit, onMute, onDelete }) {
  const { t } = useTranslation("rules");
  const cond = buildConditionSummary(rule.trigger || {}, t);
  return (
    <div
      style={{
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: expanded ? "var(--bg-surface)" : "transparent",
      }}
    >
      <div
        onClick={() => onToggle && onToggle(rule)}
        onMouseEnter={(e) => {
          if (!expanded) e.currentTarget.style.background = "var(--bg-surface-sunken)";
        }}
        onMouseLeave={(e) => {
          if (!expanded) e.currentTarget.style.background = "transparent";
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 18px",
          cursor: "pointer",
          transition: "background 0.12s ease",
        }}
      >
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            background: "var(--semantic-info-subtle)",
            border: "1px solid rgba(59,130,246,0.25)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--semantic-info)",
            flexShrink: 0,
          }}
        >
          <UserPlus size={15} strokeWidth={2.2} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500, marginBottom: 3 }}>
            {rule.name}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {t("row.auto_assigns_to")}{" "}
            <span style={{ color: "var(--text-primary)" }}>{rule.action.assignTo?.name || "—"}</span>
            <span style={{ color: "var(--text-tertiary)" }}>
              {" · "}
              {t("row.applied_times", { count: rule.appliedCount, time: formatRelativeTime(rule.createdAt) })}
            </span>
          </div>
          {cond && (
            <div
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                fontStyle: "italic",
                marginTop: 3,
              }}
            >
              {cond}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <StatusPill status={rule.status} />
          {expanded ? <ChevronUp size={14} color="var(--text-tertiary)" /> : <ChevronDown size={14} color="var(--text-tertiary)" />}
        </div>
      </div>
      {expanded && (
        <RuleDetailExpanded rule={rule} kind="routing" onEdit={onEdit} onMute={onMute} onDelete={onDelete} />
      )}
    </div>
  );
}
