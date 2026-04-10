import { useTranslation } from "react-i18next";
import { FileText, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { StatusPill, ModePill } from "./StatusPills";
import RuleDetailExpanded from "./RuleDetailExpanded";
import { formatRelativeTime } from "../../utils/relativeTime";
import { getAcceptedFromAiTimestamp } from "../../engine/mockEngine";

export default function CategorizationRuleRow({ rule, expanded, onToggle, onEdit, onMute, onDelete }) {
  const { t } = useTranslation("rules");
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
            background: "var(--accent-primary-subtle)",
            border: "1px solid rgba(0,196,140,0.25)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--accent-primary)",
            flexShrink: 0,
          }}
        >
          <FileText size={15} strokeWidth={2.2} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500, marginBottom: 3 }}>
            {rule.name}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            <span style={{ color: "var(--text-tertiary)" }}>→</span>{" "}
            <span style={{ color: "var(--text-primary)" }}>{rule.debitAccount.name}</span>{" "}
            <span style={{ fontFamily: "'DM Mono', monospace", color: "var(--text-tertiary)" }}>
              ({rule.debitAccount.code})
            </span>
            <span style={{ color: "var(--text-tertiary)" }}>
              {" · "}
              {t("row.applied_times", { count: rule.appliedCount, time: formatRelativeTime(rule.createdAt) })}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          {(() => { const ts = getAcceptedFromAiTimestamp(rule.id); return ts && (Date.now() - new Date(ts).getTime() < 7 * 24 * 60 * 60 * 1000) ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9, fontWeight: 600, color: "#3b82f6", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)", padding: "2px 6px", borderRadius: 10 }}><Sparkles size={9} /> AI</span> : null; })()}
          <StatusPill status={rule.status} />
          <ModePill mode={rule.mode} />
          {expanded ? <ChevronUp size={14} color="var(--text-tertiary)" /> : <ChevronDown size={14} color="var(--text-tertiary)" />}
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
