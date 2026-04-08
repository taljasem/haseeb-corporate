import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import {
  createRoutingRule,
  updateRoutingRule,
  getRecipientsForRole,
  getTaskTypesForDirection,
} from "../../engine/mockEngine";
import Avatar from "../taskbox/Avatar";
import TaskTypePill from "../taskbox/TaskTypePill";

const inputStyle = {
  width: "100%",
  background: "var(--bg-surface-sunken)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 8,
  padding: "10px 12px",
  color: "var(--text-primary)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
};

function FieldDot({ filled }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: filled ? "var(--accent-primary)" : "transparent",
        border: `1px solid ${filled ? "var(--accent-primary)" : "var(--border-strong)"}`,
        marginInlineEnd: 8,
        flexShrink: 0,
      }}
    />
  );
}
function FieldLabel({ filled, children }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.15em",
        color: "var(--text-tertiary)",
        marginBottom: 6,
      }}
    >
      <FieldDot filled={filled} />
      {children}
    </div>
  );
}

const PRIORITIES = ["normal", "high", "urgent"];

export default function NewRoutingRuleModal({ open, onClose, onCreated, editingRule = null }) {
  const { t } = useTranslation("rules");
  const [name, setName] = useState("");
  const [types, setTypes] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState(["all"]);
  const [recipients, setRecipients] = useState([]);
  const [assignee, setAssignee] = useState(null);
  const [priority, setPriority] = useState("normal");
  const [amountMin, setAmountMin] = useState("");
  const [merchantPattern, setMerchantPattern] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    getTaskTypesForDirection("any").then(setTypes);
    getRecipientsForRole("CFO").then(setRecipients);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (editingRule) {
      setName(editingRule.name || "");
      setSelectedTypes(editingRule.trigger?.taskTypes?.length ? editingRule.trigger.taskTypes : ["all"]);
      setAssignee(editingRule.action?.assignTo || null);
      setPriority(editingRule.action?.priority || "normal");
      setAmountMin(editingRule.trigger?.conditions?.amountMin != null ? String(editingRule.trigger.conditions.amountMin) : "");
      setMerchantPattern(editingRule.trigger?.conditions?.merchantPattern || "");
    } else {
      setName("");
      setSelectedTypes(["all"]);
      setAssignee(null);
      setPriority("normal");
      setAmountMin("");
      setMerchantPattern("");
    }
  }, [open, editingRule]);

  if (!open) return null;

  const toggleType = (id) => {
    setSelectedTypes((prev) => {
      if (id === "all") return ["all"];
      const next = prev.includes("all") ? [] : prev.slice();
      if (next.includes(id)) return next.filter((x) => x !== id);
      return [...next, id];
    });
  };

  const canCreate = name.trim() && assignee && selectedTypes.length > 0;

  const handleCreate = async () => {
    setSending(true);
    const params = {
      name,
      trigger: {
        taskTypes: selectedTypes,
        linkedItemTypes: [],
        conditions: {
          amountMin: amountMin ? Number(amountMin) : null,
          merchantPattern: merchantPattern || null,
        },
      },
      action: { assignTo: assignee, alsoNotify: null, priority },
    };
    const rule = editingRule
      ? await updateRoutingRule(editingRule.id, params)
      : await createRoutingRule(params);
    setSending(false);
    onCreated && onCreated(rule);
    onClose && onClose();
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          zIndex: 300,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 560,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "calc(100vh - 80px)",
          background: "var(--bg-surface-raised)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 12,
          zIndex: 301,
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 22px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>
              {editingRule ? t("route_modal.edit_label") : t("route_modal.new_label")}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22,
                color: "var(--text-primary)",
                letterSpacing: "-0.2px",
                marginTop: 2,
              }}
            >
              {editingRule ? t("route_modal.update_title") : t("route_modal.create_title")}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("route_modal.close")}
            style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "18px 22px", overflowY: "auto", flex: 1 }}>
          <div style={{ marginBottom: 14 }}>
            <FieldLabel filled={!!name.trim()}>{t("route_modal.rule_name")}</FieldLabel>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("route_modal.rule_name_placeholder")}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <FieldLabel filled={selectedTypes.length > 0}>{t("route_modal.apply_to_task_types")}</FieldLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <button
                onClick={() => toggleType("all")}
                style={{
                  padding: "6px 12px",
                  borderRadius: 14,
                  background: selectedTypes.includes("all") ? "var(--accent-primary-subtle)" : "var(--bg-surface)",
                  border: selectedTypes.includes("all") ? "1px solid rgba(0,196,140,0.30)" : "1px solid rgba(255,255,255,0.10)",
                  color: selectedTypes.includes("all") ? "var(--accent-primary)" : "var(--text-secondary)",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {t("route_modal.apply_all")}
              </button>
              {types.map((t) => {
                const on = selectedTypes.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleType(t.id)}
                    style={{
                      background: "transparent",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      opacity: on ? 1 : 0.5,
                      outline: on ? "1px solid rgba(0,196,140,0.40)" : "none",
                      borderRadius: 5,
                    }}
                  >
                    <TaskTypePill type={t.id} size="sm" />
                  </button>
                );
              })}
            </div>
          </div>

          <details style={{ marginBottom: 14 }}>
            <summary
              style={{
                fontSize: 11,
                color: "var(--accent-primary)",
                cursor: "pointer",
                padding: "8px 0",
                listStyle: "none",
              }}
            >
              {t("route_modal.conditions_toggle")}
            </summary>
            <div style={{ marginTop: 8 }}>
              <FieldLabel filled={!!amountMin}>{t("route_modal.min_amount_kwd")}</FieldLabel>
              <input
                value={amountMin}
                onChange={(e) => setAmountMin(e.target.value)}
                placeholder={t("route_modal.min_amount_placeholder")}
                style={{ ...inputStyle, marginBottom: 10 }}
              />
              <FieldLabel filled={!!merchantPattern}>{t("route_modal.merchant_pattern")}</FieldLabel>
              <input
                value={merchantPattern}
                onChange={(e) => setMerchantPattern(e.target.value)}
                placeholder={t("route_modal.merchant_placeholder")}
                style={inputStyle}
              />
            </div>
          </details>

          <div style={{ marginBottom: 14 }}>
            <FieldLabel filled={!!assignee}>{t("route_modal.assign_to")}</FieldLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {recipients.map((r) => {
                const on = assignee && assignee.id === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setAssignee(r)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 10px",
                      background: on ? "var(--accent-primary-subtle)" : "var(--bg-surface)",
                      border: on ? "1px solid rgba(0,196,140,0.30)" : "1px solid rgba(255,255,255,0.10)",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      textAlign: "start",
                    }}
                  >
                    <Avatar person={r} size={24} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: "var(--text-primary)" }}>{r.name}</div>
                      <div style={{ fontSize: 10, color: "var(--text-tertiary)" }}>{r.role}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <FieldLabel filled={true}>{t("route_modal.priority")}</FieldLabel>
            <div style={{ display: "flex", gap: 6 }}>
              {PRIORITIES.map((p) => {
                const on = priority === p;
                return (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    style={{
                      flex: 1,
                      padding: "8px 10px",
                      background: on ? "var(--accent-primary-subtle)" : "transparent",
                      border: on ? "1px solid rgba(0,196,140,0.30)" : "1px solid rgba(255,255,255,0.10)",
                      color: on ? "var(--accent-primary)" : "var(--text-secondary)",
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                      borderRadius: 6,
                      fontFamily: "inherit",
                    }}
                  >
                    {t(`route_modal.priority_${p}`)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            padding: "14px 22px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              color: "var(--text-secondary)",
              border: "1px solid rgba(255,255,255,0.15)",
              padding: "9px 16px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "inherit",
            }}
          >
            {t("route_modal.cancel")}
          </button>
          <button
            onClick={handleCreate}
            disabled={!canCreate || sending}
            style={{
              background: canCreate ? "var(--accent-primary)" : "rgba(0,196,140,0.25)",
              color: "#fff",
              border: "none",
              padding: "9px 18px",
              borderRadius: 6,
              cursor: canCreate ? "pointer" : "not-allowed",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            {sending ? t("route_modal.saving") : editingRule ? t("route_modal.save_changes") : t("route_modal.create_rule")}
          </button>
        </div>
      </div>
    </>
  );
}
