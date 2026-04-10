import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, AlertTriangle } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import { runValidators, required, minLength, maxLength } from "../../utils/validation";
import { createAccount, updateAccount } from "../../engine/mockEngine";

const TYPES = ["Assets", "Liabilities", "Equity", "Revenue", "Expenses"];

const inputStyle = {
  width: "100%", background: "var(--bg-surface-sunken)",
  border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8,
  padding: "10px 12px", color: "var(--text-primary)",
  fontSize: 13, fontFamily: "inherit", outline: "none",
};

export default function AccountModal({ open, mode, account, onClose, onSaved }) {
  const { t } = useTranslation("setup");
  const { t: tc } = useTranslation("common");
  useEscapeKey(onClose, open);
  const isEdit = mode === "edit";
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("Expenses");
  const [subtype, setSubtype] = useState("");
  const [parent, setParent] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (isEdit && account) {
      setCode(account.code);
      setName(account.name);
      setType(account.type);
      setSubtype(account.subtype || "");
      setParent(account.parent || "");
      setDescription(account.description || "");
    } else {
      setCode(""); setName(""); setType("Expenses"); setSubtype(""); setParent(""); setDescription("");
    }
    setErrors({});
  }, [open, isEdit, account]);

  if (!open) return null;

  const validate = () => {
    const schema = isEdit
      ? { name: [required(), minLength(2), maxLength(80)] }
      : { code: [required(), minLength(3), maxLength(8)], name: [required(), minLength(2), maxLength(80)] };
    const e = runValidators({ code, name }, schema);
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    if (isEdit) {
      await updateAccount(code, { name, subtype, description });
    } else {
      await createAccount({ code, name, type, subtype, parent: parent || null, description });
    }
    setSaving(false);
    if (onSaved) onSaved();
    if (onClose) onClose();
  };

  const isTopLevel = !parent;
  const err = (k) => errors[k] ? <div style={{ fontSize: 12, color: "var(--semantic-danger)", marginTop: 4 }}>{tc(errors[k].key, errors[k].values || {})}</div> : null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 520, maxHeight: "calc(100vh - 80px)", background: "var(--panel-bg)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, zIndex: 301, display: "flex", flexDirection: "column", boxShadow: "0 24px 60px rgba(0,0,0,0.7)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>{isEdit ? t("account_modal.edit_label") : t("account_modal.add_label")}</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-primary)", marginTop: 2 }}>{isEdit ? t("account_modal.edit_title") : t("account_modal.add_title")}</div>
          </div>
          <button onClick={onClose} aria-label={t("account_modal.close")} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: "18px 22px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          {!isEdit && isTopLevel && (
            <div style={{ display: "flex", gap: 8, padding: "10px 12px", background: "var(--semantic-warning-subtle)", border: "1px solid rgba(212,168,75,0.30)", borderRadius: 8, color: "var(--semantic-warning)", fontSize: 12 }}>
              <AlertTriangle size={14} /> {t("account_modal.approval_warning")}
            </div>
          )}
          <Field label={t("account_modal.field_code")}>
            <input value={code} onChange={(e) => { setCode(e.target.value); if (errors.code) setErrors({}); }} disabled={isEdit} placeholder={t("account_modal.code_placeholder")} style={{ ...inputStyle, fontFamily: "'DM Mono', monospace", opacity: isEdit ? 0.6 : 1, ...(errors.code ? { borderColor: "var(--semantic-danger)" } : {}) }} />
            {err("code")}
          </Field>
          <Field label={t("account_modal.field_name")}>
            <input value={name} onChange={(e) => { setName(e.target.value); if (errors.name) setErrors({}); }} style={{ ...inputStyle, ...(errors.name ? { borderColor: "var(--semantic-danger)" } : {}) }} />
            {err("name")}
          </Field>
          <Field label={t("account_modal.field_type")}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {TYPES.map((tp) => {
                const on = type === tp;
                return (
                  <button key={tp} onClick={() => !isEdit && setType(tp)} disabled={isEdit} style={{ padding: "7px 14px", borderRadius: 14, background: on ? "var(--accent-primary-subtle)" : "var(--bg-surface-sunken)", border: on ? "1px solid rgba(0,196,140,0.30)" : "1px solid rgba(255,255,255,0.10)", color: on ? "var(--accent-primary)" : "var(--text-secondary)", fontSize: 11, fontWeight: 600, cursor: isEdit ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: isEdit && !on ? 0.5 : 1 }}>
                    {t(`chart.types.${tp}`)}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label={t("account_modal.field_subtype")}>
            <input value={subtype} onChange={(e) => setSubtype(e.target.value)} style={inputStyle} />
          </Field>
          <Field label={t("account_modal.field_parent")}>
            <input value={parent} onChange={(e) => setParent(e.target.value)} disabled={isEdit} style={{ ...inputStyle, fontFamily: "'DM Mono', monospace", opacity: isEdit ? 0.6 : 1 }} />
          </Field>
          <Field label={t("account_modal.field_description")}>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} />
          </Field>
          {isEdit && (
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontStyle: "italic" }}>{t("account_modal.immutable_note")}</div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={onClose} style={btnSecondary}>{t("account_modal.cancel")}</button>
          <button onClick={handleSave} disabled={saving} style={btnPrimary(saving)}>
            {saving ? <><Spinner size={13} />&nbsp;{t("account_modal.saving")}</> : t("account_modal.save")}
          </button>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }) {
  return <div><div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 6 }}>{label}</div>{children}</div>;
}
const btnSecondary = { background: "transparent", color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.15)", padding: "9px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit" };
const btnPrimary = (l) => ({ background: "var(--accent-primary)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 6, cursor: l ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" });
