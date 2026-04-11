import { useTranslation } from "react-i18next";
import { formatRelativeTime } from "../../utils/relativeTime";
import { formatKWD } from "../../utils/format";

function buildTriggerLines(trigger, t) {
  const parts = [];
  if (trigger.taskTypes && trigger.taskTypes.length && !trigger.taskTypes.includes("all")) {
    parts.push(t("responsibilities.task_types", { types: trigger.taskTypes.join(", ") }));
  } else if (trigger.taskTypes?.includes("all")) {
    parts.push(t("responsibilities.all_task_types"));
  }
  const c = trigger.conditions || {};
  if (c.amountMin != null) parts.push(t("responsibilities.amount_min", { amount: formatKWD(c.amountMin) }));
  if (c.amountMax != null) parts.push(t("responsibilities.amount_max", { amount: formatKWD(c.amountMax) }));
  if (c.merchantPattern) parts.push(t("responsibilities.merchant", { pattern: c.merchantPattern }));
  if (c.accountCategory) parts.push(t("responsibilities.category", { value: c.accountCategory }));
  return parts;
}

export default function RoutingRuleReadOnlyCard({ rule }) {
  const { t } = useTranslation("junior-today");
  const triggerLines = buildTriggerLines(rule.trigger || {}, t);
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderInlineStart: "2px solid #3B82F6",
        borderRadius: 8,
        padding: "16px 18px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>
            {rule.name}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-tertiary)",
              letterSpacing: "0.06em",
              marginTop: 4,
            }}
          >
            {t("responsibilities.you_handle")}
          </div>
        </div>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.10em",
            color: "var(--text-tertiary)",
            background: "var(--bg-surface-sunken)",
            border: "1px solid var(--border-strong)",
            padding: "3px 8px",
            borderRadius: 3,
            whiteSpace: "nowrap",
          }}
        >
          {t("responsibilities.read_only_pill")}
        </span>
      </div>

      {triggerLines.length > 0 && (
        <ul
          style={{
            margin: "8px 0",
            padding: 0,
            listStyle: "none",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {triggerLines.map((t, i) => (
            <li
              key={i}
              style={{
                fontSize: 12,
                color: "var(--text-secondary)",
                paddingInlineStart: 12,
                position: "relative",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  top: 7,
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: "var(--text-tertiary)",
                }}
              />
              {t}
            </li>
          ))}
        </ul>
      )}

      <div
        style={{
          display: "flex",
          gap: 14,
          marginTop: 12,
          paddingTop: 10,
          borderTop: "1px solid var(--border-subtle)",
          fontSize: 11,
          color: "var(--text-tertiary)",
          flexWrap: "wrap",
        }}
      >
        <span>
          {t("responsibilities.applied_times_prefix")}{" "}
          <span style={{ color: "var(--text-primary)", fontFamily: "'DM Mono', monospace", fontWeight: 500 }}>
            {rule.appliedCount}
          </span>{" "}
          {t("responsibilities.applied_times_suffix")}
        </span>
        <span>·</span>
        <span>
          {rule.lastAppliedAt
            ? t("responsibilities.last_applied", { time: formatRelativeTime(rule.lastAppliedAt) })
            : t("responsibilities.last_applied_never")}
        </span>
        <span>·</span>
        <span>{t("responsibilities.created_by", { name: rule.createdBy?.name || "—" })}</span>
      </div>
    </div>
  );
}
