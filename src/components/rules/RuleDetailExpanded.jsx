import { useTranslation } from "react-i18next";
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
      <div style={{ fontSize: 12, color: "#E6EDF3" }}>{children || "\u2014"}</div>
    </div>
  );
}

export default function RuleDetailExpanded({ rule, kind = "categorization", onEdit, onMute, onDelete }) {
  const { t } = useTranslation("rules");
  if (!rule) return null;
  const fields = [];
  const DASH = t("detail.dash");

  if (kind === "categorization") {
    fields.push([t("detail.merchant_pattern"), `${rule.merchantPattern.type}: "${rule.merchantPattern.value}"`]);
    fields.push([t("detail.debit_account"),  `${rule.debitAccount.name} (${rule.debitAccount.code})`]);
    fields.push([t("detail.credit_account"), `${rule.creditAccount.name} (${rule.creditAccount.code})`]);
    fields.push([t("detail.mode"), rule.mode]);
    if (rule.conditions.amountMin != null) fields.push([t("detail.min_amount"), formatKWD(rule.conditions.amountMin)]);
    if (rule.conditions.amountMax != null) fields.push([t("detail.max_amount"), formatKWD(rule.conditions.amountMax)]);
    if (rule.conditions.sourceAccount)     fields.push([t("detail.source_account"), rule.conditions.sourceAccount]);
    if (rule.costCenter)                   fields.push([t("detail.cost_center"), rule.costCenter]);
    if (rule.approvalThreshold != null)    fields.push([t("detail.approval_threshold"), t("detail.approval_threshold_value", { amount: formatKWD(rule.approvalThreshold) })]);
  } else {
    const tg = rule.trigger || {};
    fields.push([t("detail.task_types"), (tg.taskTypes || []).join(", ") || t("detail.all")]);
    if (tg.linkedItemTypes && tg.linkedItemTypes.length) fields.push([t("detail.linked_item_types"), tg.linkedItemTypes.join(", ")]);
    const c = tg.conditions || {};
    if (c.amountMin != null)    fields.push([t("detail.min_amount"), formatKWD(c.amountMin)]);
    if (c.amountMax != null)    fields.push([t("detail.max_amount"), formatKWD(c.amountMax)]);
    if (c.merchantPattern)      fields.push([t("detail.merchant_pattern"), c.merchantPattern]);
    if (c.accountCategory)      fields.push([t("detail.account_category"), c.accountCategory]);
    if (c.costCenter)           fields.push([t("detail.cost_center"), c.costCenter]);
    fields.push([t("detail.assign_to"), rule.action.assignTo?.name || DASH]);
    if (rule.action.alsoNotify) fields.push([t("detail.also_notify"), (rule.action.alsoNotify || []).join(", ")]);
    fields.push([t("detail.priority"), rule.action.priority || "normal"]);
  }

  fields.push([t("detail.applied"), t("detail.applied_times", { count: rule.appliedCount })]);
  fields.push([t("detail.last_applied"), rule.lastAppliedAt ? formatRelativeTime(rule.lastAppliedAt) : t("detail.never")]);
  fields.push([t("detail.created_by"), rule.createdBy?.name || DASH]);
  fields.push([t("detail.created"), formatRelativeTime(rule.createdAt)]);

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
        {t("detail.audit_trail")}
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
          {t("detail.edit")}
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
          {isMuted ? t("detail.unmute") : t("detail.mute")}
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
          {t("detail.delete")}
        </button>
      </div>
    </div>
  );
}
