import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, AlertTriangle } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import { createDisallowanceRule, updateDisallowanceRule } from "../../engine";

const RULE_TYPES = [
  "ENTERTAINMENT_CAP_PERCENT",
  "PERSONAL_USE",
  "RELATED_PARTY",
  "CUSTOM",
];

const TARGET_MODES = ["role", "account"];

const inputStyle = {
  width: "100%",
  background: "var(--bg-surface-sunken)",
  border: "1px solid var(--border-default)",
  borderRadius: 8,
  padding: "10px 12px",
  color: "var(--text-primary)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function DisallowanceRuleModal({ open, mode, rule, accounts, onClose, onSaved }) {
  const { t } = useTranslation("setup");
  useEscapeKey(onClose, open);
  const isEdit = mode === "edit";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ruleType, setRuleType] = useState("ENTERTAINMENT_CAP_PERCENT");
  const [disallowedPercent, setDisallowedPercent] = useState(50);
  const [targetMode, setTargetMode] = useState("role");
  const [targetRole, setTargetRole] = useState("");
  const [targetAccountId, setTargetAccountId] = useState("");
  const [activeFrom, setActiveFrom] = useState(today());
  const [activeUntil, setActiveUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [submitError, setSubmitError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (isEdit && rule) {
      setName(rule.name || "");
      setDescription(rule.description || "");
      setRuleType(rule.ruleType || "ENTERTAINMENT_CAP_PERCENT");
      setDisallowedPercent(
        rule.disallowedPercent != null ? rule.disallowedPercent : 50,
      );
      setTargetMode(rule.targetAccountId ? "account" : "role");
      setTargetRole(rule.targetRole || "");
      setTargetAccountId(rule.targetAccountId || "");
      setActiveFrom(rule.activeFrom || today());
      setActiveUntil(rule.activeUntil || "");
      setNotes(rule.notes || "");
    } else {
      setName("");
      setDescription("");
      setRuleType("ENTERTAINMENT_CAP_PERCENT");
      setDisallowedPercent(50);
      setTargetMode("role");
      setTargetRole("");
      setTargetAccountId("");
      setActiveFrom(today());
      setActiveUntil("");
      setNotes("");
    }
    setSubmitError(null);
  }, [open, isEdit, rule]);

  if (!open) return null;

  const handleSave = async () => {
    setSubmitError(null);
    if (!name.trim()) {
      setSubmitError(t("disallowance_modal.error_name_required"));
      return;
    }
    const pct = Number(disallowedPercent);
    if (!Number.isInteger(pct) || pct < 0 || pct > 100) {
      setSubmitError(t("disallowance_modal.error_percent_range"));
      return;
    }
    if (targetMode === "role" && !targetRole.trim()) {
      setSubmitError(t("disallowance_modal.error_target_role_required"));
      return;
    }
    if (targetMode === "account" && !targetAccountId) {
      setSubmitError(t("disallowance_modal.error_target_account_required"));
      return;
    }
    if (activeUntil && activeUntil < activeFrom) {
      setSubmitError(t("disallowance_modal.error_active_until_before_from"));
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        const patch = {
          name: name.trim(),
          description: description.trim() || null,
          disallowedPercent: pct,
          activeFrom,
          activeUntil: activeUntil || null,
          notes: notes.trim() || null,
        };
        await updateDisallowanceRule(rule.id, patch);
      } else {
        const payload = {
          name: name.trim(),
          description: description.trim() || null,
          ruleType,
          disallowedPercent: pct,
          targetRole: targetMode === "role" ? targetRole.trim() : null,
          targetAccountId: targetMode === "account" ? targetAccountId : null,
          activeFrom,
          activeUntil: activeUntil || null,
          notes: notes.trim() || null,
        };
        await createDisallowanceRule(payload);
      }
      if (onSaved) onSaved();
      if (onClose) onClose();
    } catch (err) {
      setSubmitError(err?.message || t("disallowance_modal.error_generic"));
    } finally {
      setSaving(false);
    }
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
          maxHeight: "calc(100vh - 80px)",
          background: "var(--panel-bg)",
          border: "1px solid var(--border-default)",
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
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.15em",
                color: "var(--text-tertiary)",
              }}
            >
              {isEdit
                ? t("disallowance_modal.edit_label")
                : t("disallowance_modal.add_label")}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22,
                color: "var(--text-primary)",
                marginTop: 2,
              }}
            >
              {isEdit
                ? t("disallowance_modal.edit_title")
                : t("disallowance_modal.add_title")}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("disallowance_modal.close")}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-tertiary)",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>
        <div
          style={{
            padding: "18px 22px",
            overflowY: "auto",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {submitError && (
            <div
              role="alert"
              style={{
                display: "flex",
                gap: 8,
                padding: "10px 12px",
                background: "var(--semantic-danger-subtle)",
                border: "1px solid var(--semantic-danger)",
                borderRadius: 8,
                color: "var(--semantic-danger)",
                fontSize: 12,
              }}
            >
              <AlertTriangle size={14} /> {submitError}
            </div>
          )}

          <Field label={t("disallowance_modal.field_name")}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              style={inputStyle}
            />
          </Field>

          <Field label={t("disallowance_modal.field_description")}>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={2000}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </Field>

          <Field label={t("disallowance_modal.field_rule_type")}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {RULE_TYPES.map((rt) => {
                const on = ruleType === rt;
                return (
                  <button
                    key={rt}
                    onClick={() => !isEdit && setRuleType(rt)}
                    disabled={isEdit}
                    style={{
                      padding: "7px 14px",
                      borderRadius: 14,
                      background: on
                        ? "var(--accent-primary-subtle)"
                        : "var(--bg-surface-sunken)",
                      border: on
                        ? "1px solid var(--accent-primary-border)"
                        : "1px solid var(--border-default)",
                      color: on
                        ? "var(--accent-primary)"
                        : "var(--text-secondary)",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: isEdit ? "not-allowed" : "pointer",
                      fontFamily: "inherit",
                      opacity: isEdit && !on ? 0.5 : 1,
                    }}
                  >
                    {t(`disallowance_modal.rule_type_${rt}`)}
                  </button>
                );
              })}
            </div>
            {isEdit && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-tertiary)",
                  fontStyle: "italic",
                  marginTop: 6,
                }}
              >
                {t("disallowance_modal.rule_type_immutable_note")}
              </div>
            )}
          </Field>

          <Field label={t("disallowance_modal.field_disallowed_percent")}>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={disallowedPercent}
              onChange={(e) => setDisallowedPercent(e.target.value)}
              style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }}
            />
          </Field>

          {!isEdit && (
            <Field label={t("disallowance_modal.field_target")}>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                {TARGET_MODES.map((m) => {
                  const on = targetMode === m;
                  return (
                    <button
                      key={m}
                      onClick={() => setTargetMode(m)}
                      style={{
                        padding: "7px 14px",
                        borderRadius: 14,
                        background: on
                          ? "var(--accent-primary-subtle)"
                          : "var(--bg-surface-sunken)",
                        border: on
                          ? "1px solid var(--accent-primary-border)"
                          : "1px solid var(--border-default)",
                        color: on
                          ? "var(--accent-primary)"
                          : "var(--text-secondary)",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {t(`disallowance_modal.target_mode_${m}`)}
                    </button>
                  );
                })}
              </div>
              {targetMode === "role" ? (
                <input
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder={t("disallowance_modal.target_role_placeholder")}
                  maxLength={120}
                  style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }}
                />
              ) : (
                <select
                  value={targetAccountId}
                  onChange={(e) => setTargetAccountId(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">
                    {t("disallowance_modal.target_account_placeholder")}
                  </option>
                  {(accounts || []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.nameEn || a.name || a.nameAr}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}

          {isEdit && (
            <Field label={t("disallowance_modal.field_target")}>
              <div
                style={{
                  ...inputStyle,
                  background: "var(--bg-surface)",
                  color: "var(--text-secondary)",
                  opacity: 0.8,
                }}
              >
                {rule?.targetRole
                  ? t("disallowance_modal.target_display_role", {
                      role: rule.targetRole,
                    })
                  : t("disallowance_modal.target_display_account", {
                      accountId: rule?.targetAccountId || "",
                    })}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-tertiary)",
                  fontStyle: "italic",
                  marginTop: 6,
                }}
              >
                {t("disallowance_modal.target_immutable_note")}
              </div>
            </Field>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Field label={t("disallowance_modal.field_active_from")}>
                <input
                  type="date"
                  value={activeFrom}
                  onChange={(e) => setActiveFrom(e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label={t("disallowance_modal.field_active_until")}>
                <input
                  type="date"
                  value={activeUntil}
                  onChange={(e) => setActiveUntil(e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </div>
          </div>

          <Field label={t("disallowance_modal.field_notes")}>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={2000}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </Field>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            padding: "14px 22px",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          <button onClick={onClose} style={btnSecondary}>
            {t("disallowance_modal.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={btnPrimary(saving)}
          >
            {saving ? (
              <>
                <Spinner size={13} />
                &nbsp;{t("disallowance_modal.saving")}
              </>
            ) : (
              t("disallowance_modal.save")
            )}
          </button>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.15em",
          color: "var(--text-tertiary)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

const btnSecondary = {
  background: "transparent",
  color: "var(--text-secondary)",
  border: "1px solid var(--border-strong)",
  padding: "9px 16px",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 12,
  fontFamily: "inherit",
};
const btnPrimary = (l) => ({
  background: "var(--accent-primary)",
  color: "#fff",
  border: "none",
  padding: "9px 18px",
  borderRadius: 6,
  cursor: l ? "not-allowed" : "pointer",
  fontSize: 12,
  fontWeight: 600,
  fontFamily: "inherit",
});
