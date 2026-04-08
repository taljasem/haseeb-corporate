import { useTranslation } from "react-i18next";
import { FileText, ChevronDown, ChevronUp } from "lucide-react";
import { StatusPill, ModePill } from "./StatusPills";
import RuleDetailExpanded from "./RuleDetailExpanded";
import { formatRelativeTime } from "../../utils/relativeTime";

export default function CategorizationRuleRow({ rule, expanded, onToggle, onEdit, onMute, onDelete }) {
  const { t } = useTranslation("rules");
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
            background: "rgba(0,196,140,0.10)",
            border: "1px solid rgba(0,196,140,0.25)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#00C48C",
            flexShrink: 0,
          }}
        >
          <FileText size={15} strokeWidth={2.2} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: "#E6EDF3", fontWeight: 500, marginBottom: 3 }}>
            {rule.name}
          </div>
          <div style={{ fontSize: 12, color: "#8B98A5" }}>
            <span style={{ color: "#5B6570" }}>→</span>{" "}
            <span style={{ color: "#E6EDF3" }}>{rule.debitAccount.name}</span>{" "}
            <span style={{ fontFamily: "'DM Mono', monospace", color: "#5B6570" }}>
              ({rule.debitAccount.code})
            </span>
            <span style={{ color: "#5B6570" }}>
              {" · "}
              {t("row.applied_times", { count: rule.appliedCount, time: formatRelativeTime(rule.createdAt) })}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <StatusPill status={rule.status} />
          <ModePill mode={rule.mode} />
          {expanded ? <ChevronUp size={14} color="#5B6570" /> : <ChevronDown size={14} color="#5B6570" />}
        </div>
      </div>
      {expanded && (
        <RuleDetailExpanded
          rule={rule}
          kind="categorization"
          onEdit={onEdit}
          onMute={onMute}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}
