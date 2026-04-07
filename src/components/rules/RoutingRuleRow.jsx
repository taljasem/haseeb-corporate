import { UserPlus, ChevronDown, ChevronUp } from "lucide-react";
import { StatusPill } from "./StatusPills";
import RuleDetailExpanded from "./RuleDetailExpanded";
import { formatKWD } from "../../utils/format";
import { formatRelativeTime } from "../../utils/relativeTime";

function conditionSummary(trigger) {
  const parts = [];
  if (trigger.taskTypes && trigger.taskTypes.length && !trigger.taskTypes.includes("all")) {
    parts.push(`type = ${trigger.taskTypes.join("/")}`);
  }
  const c = trigger.conditions || {};
  if (c.amountMin != null) parts.push(`amount ≥ ${formatKWD(c.amountMin)}`);
  if (c.amountMax != null) parts.push(`amount ≤ ${formatKWD(c.amountMax)}`);
  if (c.merchantPattern)   parts.push(`merchant ~ "${c.merchantPattern}"`);
  if (c.accountCategory)   parts.push(`category = ${c.accountCategory}`);
  if (c.costCenter)        parts.push(`cost center = ${c.costCenter}`);
  return parts.length ? `· When ${parts.join(" AND ")}` : "";
}

export default function RoutingRuleRow({ rule, expanded, onToggle, onEdit, onMute, onDelete }) {
  const cond = conditionSummary(rule.trigger || {});
  return (
    <div
      style={{
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        background: expanded ? "rgba(255,255,255,0.02)" : "transparent",
      }}
    >
      <div
        onClick={() => onToggle && onToggle(rule)}
        onMouseEnter={(e) => {
          if (!expanded) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
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
            background: "rgba(59,130,246,0.10)",
            border: "1px solid rgba(59,130,246,0.25)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#3B82F6",
            flexShrink: 0,
          }}
        >
          <UserPlus size={15} strokeWidth={2.2} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: "#E6EDF3", fontWeight: 500, marginBottom: 3 }}>
            {rule.name}
          </div>
          <div style={{ fontSize: 12, color: "#8B98A5" }}>
            Auto-assigns to{" "}
            <span style={{ color: "#E6EDF3" }}>{rule.action.assignTo?.name || "—"}</span>
            <span style={{ color: "#5B6570" }}>
              {" · "}
              {rule.appliedCount} applied · {formatRelativeTime(rule.createdAt)}
            </span>
          </div>
          {cond && (
            <div
              style={{
                fontSize: 11,
                color: "#5B6570",
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
          {expanded ? <ChevronUp size={14} color="#5B6570" /> : <ChevronDown size={14} color="#5B6570" />}
        </div>
      </div>
      {expanded && (
        <RuleDetailExpanded rule={rule} kind="routing" onEdit={onEdit} onMute={onMute} onDelete={onDelete} />
      )}
    </div>
  );
}
