import { formatRelativeTime } from "../../utils/relativeTime";
import { formatKWD } from "../../utils/format";

function summarizeTrigger(t) {
  const parts = [];
  if (t.taskTypes && t.taskTypes.length && !t.taskTypes.includes("all")) {
    parts.push(`Task types: ${t.taskTypes.join(", ")}`);
  } else if (t.taskTypes?.includes("all")) {
    parts.push("All task types");
  }
  const c = t.conditions || {};
  if (c.amountMin != null) parts.push(`Amount ≥ ${formatKWD(c.amountMin)}`);
  if (c.amountMax != null) parts.push(`Amount ≤ ${formatKWD(c.amountMax)}`);
  if (c.merchantPattern) parts.push(`Merchant ~ "${c.merchantPattern}"`);
  if (c.accountCategory) parts.push(`Category: ${c.accountCategory}`);
  return parts;
}

export default function RoutingRuleReadOnlyCard({ rule }) {
  const triggerLines = summarizeTrigger(rule.trigger || {});
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderLeft: "2px solid #3B82F6",
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
          <div style={{ fontSize: 14, color: "#E6EDF3", fontWeight: 500 }}>
            {rule.name}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "#5B6570",
              letterSpacing: "0.06em",
              marginTop: 4,
            }}
          >
            → YOU HANDLE
          </div>
        </div>
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.10em",
            color: "#5B6570",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.15)",
            padding: "3px 8px",
            borderRadius: 3,
            whiteSpace: "nowrap",
          }}
        >
          READ-ONLY · MANAGED BY CFO
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
                color: "#8B98A5",
                paddingLeft: 12,
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
                  background: "#5B6570",
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
          borderTop: "1px solid rgba(255,255,255,0.06)",
          fontSize: 11,
          color: "#5B6570",
          flexWrap: "wrap",
        }}
      >
        <span>
          Applied{" "}
          <span style={{ color: "#E6EDF3", fontFamily: "'DM Mono', monospace", fontWeight: 500 }}>
            {rule.appliedCount}
          </span>{" "}
          times this period
        </span>
        <span>·</span>
        <span>
          Last applied {rule.lastAppliedAt ? formatRelativeTime(rule.lastAppliedAt) : "never"}
        </span>
        <span>·</span>
        <span>Created by {rule.createdBy?.name || "—"}</span>
      </div>
    </div>
  );
}
