import RuleAuditTrail from "./RuleAuditTrail";
import { formatKWD } from "../../utils/format";
import { formatRelativeTime } from "../../utils/relativeTime";

function Field({ label, children }) {
  return (
    <div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: "0.15em",
          color: "#5B6570",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 12, color: "#E6EDF3" }}>{children || "—"}</div>
    </div>
  );
}

export default function RuleDetailExpanded({ rule, kind = "categorization", onEdit, onMute, onDelete }) {
  if (!rule) return null;
  const fields = [];

  if (kind === "categorization") {
    fields.push(["MERCHANT PATTERN", `${rule.merchantPattern.type}: "${rule.merchantPattern.value}"`]);
    fields.push(["DEBIT ACCOUNT",  `${rule.debitAccount.name} (${rule.debitAccount.code})`]);
    fields.push(["CREDIT ACCOUNT", `${rule.creditAccount.name} (${rule.creditAccount.code})`]);
    fields.push(["MODE", rule.mode]);
    if (rule.conditions.amountMin != null) fields.push(["MIN AMOUNT", formatKWD(rule.conditions.amountMin)]);
    if (rule.conditions.amountMax != null) fields.push(["MAX AMOUNT", formatKWD(rule.conditions.amountMax)]);
    if (rule.conditions.sourceAccount)     fields.push(["SOURCE ACCOUNT", rule.conditions.sourceAccount]);
    if (rule.costCenter)                   fields.push(["COST CENTER", rule.costCenter]);
    if (rule.approvalThreshold != null)    fields.push(["APPROVAL THRESHOLD", `> ${formatKWD(rule.approvalThreshold)}`]);
  } else {
    const t = rule.trigger || {};
    fields.push(["TASK TYPES", (t.taskTypes || []).join(", ") || "all"]);
    if (t.linkedItemTypes && t.linkedItemTypes.length) fields.push(["LINKED ITEM TYPES", t.linkedItemTypes.join(", ")]);
    const c = t.conditions || {};
    if (c.amountMin != null)    fields.push(["MIN AMOUNT", formatKWD(c.amountMin)]);
    if (c.amountMax != null)    fields.push(["MAX AMOUNT", formatKWD(c.amountMax)]);
    if (c.merchantPattern)      fields.push(["MERCHANT PATTERN", c.merchantPattern]);
    if (c.accountCategory)      fields.push(["ACCOUNT CATEGORY", c.accountCategory]);
    if (c.costCenter)           fields.push(["COST CENTER", c.costCenter]);
    fields.push(["ASSIGN TO", rule.action.assignTo?.name || "—"]);
    if (rule.action.alsoNotify) fields.push(["ALSO NOTIFY", (rule.action.alsoNotify || []).join(", ")]);
    fields.push(["PRIORITY", rule.action.priority || "normal"]);
  }

  fields.push(["APPLIED", `${rule.appliedCount} times`]);
  fields.push(["LAST APPLIED", rule.lastAppliedAt ? formatRelativeTime(rule.lastAppliedAt) : "never"]);
  fields.push(["CREATED BY", rule.createdBy?.name || "—"]);
  fields.push(["CREATED", formatRelativeTime(rule.createdAt)]);

  const isMuted = rule.status === "muted";

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "16px 18px 18px",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 14,
          marginBottom: 18,
        }}
      >
        {fields.map(([label, value]) => (
          <Field key={label} label={label}>
            {value}
          </Field>
        ))}
      </div>

      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.15em",
          color: "#5B6570",
          marginBottom: 8,
        }}
      >
        AUDIT TRAIL
      </div>
      <RuleAuditTrail events={rule.auditTrail} />

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button
          onClick={() => onEdit && onEdit(rule)}
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
          Edit
        </button>
        <button
          onClick={() => onMute && onMute(rule)}
          style={{
            background: "transparent",
            color: isMuted ? "#00C48C" : "#D4A84B",
            border: `1px solid ${isMuted ? "rgba(0,196,140,0.30)" : "rgba(212,168,75,0.30)"}`,
            padding: "8px 14px",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 12,
            fontFamily: "inherit",
          }}
        >
          {isMuted ? "Unmute" : "Mute"}
        </button>
        <button
          onClick={() => onDelete && onDelete(rule)}
          style={{
            background: "transparent",
            color: "#FF5A5F",
            border: "1px solid rgba(255,90,95,0.30)",
            padding: "8px 14px",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 12,
            fontFamily: "inherit",
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
