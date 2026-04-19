import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import { runValidators, required, minLength, maxLength } from "../../utils/validation";
import { createTaskTemplate } from "../../engine/mockEngine";

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

export default function SaveTaskTemplateModal({ open, taskDraft, onClose, onSaved }) {
  const { t } = useTranslation("taskbox");
  const { t: tc } = useTranslation("common");
  useEscapeKey(onClose, open);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState("my");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setName(""); setDescription(""); setVisibility("my"); setErrors({}); }
  }, [open]);

  if (!open) return null;

  const handleSave = async () => {
    const e = runValidators({ name }, { name: [required(), minLength(2), maxLength(80)] });
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    await createTaskTemplate({
      name,
      description,
      visibility,
      type: taskDraft?.type || "request-work",
      recipientId: taskDraft?.recipientId || "sara",
      priority: taskDraft?.priority || "normal",
      subject: taskDraft?.subject || "",
      body: taskDraft?.body || "",
    });
    setSaving(false);
    if (onSaved) onSaved();
    if (onClose) onClose();
  };

  const err = (k) =>
    errors[k] ? (
      <div style={{ fontSize: 12, color: "var(--semantic-danger)", marginTop: 4 }}>
        {tc(errors[k].key, errors[k].values || {})}
      </div>
    ) : null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 310 }} />
      <div
        style={{
          position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          width: 480, maxWidth: "calc(100vw - 32px)",
          background: "var(--panel-bg)", border: "1px solid var(--border-default)",
          borderRadius: 12, zIndex: 311, display: "flex", flexDirection: "column",
          boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>
              {t("templates.save_modal_label")}
            </div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-primary)", marginTop: 2 }}>
              {t("templates.save_modal_title")}
            </div>
          </div>
          <button onClick={onClose} aria-label={t("templates.close")} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 6 }}>
              {t("templates.field_name")}
            </div>
            <input value={name} onChange={(e) => { setName(e.target.value); if (errors.name) setErrors({}); }} placeholder={t("templates.name_placeholder")} style={{ ...inputStyle, ...(errors.name ? { borderColor: "var(--semantic-danger)" } : {}) }} />
            {err("name")}
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 6 }}>
              {t("templates.field_description")}
            </div>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 6 }}>
              {t("templates.field_visibility")}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {[{ id: "my", label: t("templates.visibility_my") }, { id: "role", label: t("templates.visibility_role") }].map((v) => {
                const on = visibility === v.id;
                return (
                  <button key={v.id} onClick={() => setVisibility(v.id)} style={{ flex: 1, padding: "9px 12px", background: on ? "var(--accent-primary-subtle)" : "transparent", border: on ? "1px solid var(--accent-primary-border)" : "1px solid var(--border-default)", color: on ? "var(--accent-primary)" : "var(--text-secondary)", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit" }}>
                    {v.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid var(--border-subtle)" }}>
          <button onClick={onClose} style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-strong)", padding: "9px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>{t("templates.cancel")}</button>
          <button onClick={handleSave} disabled={saving} style={{ background: "var(--accent-primary)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 6, cursor: saving ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
            {saving ? <><Spinner size={13} />&nbsp;{t("templates.saving")}</> : t("templates.save")}
          </button>
        </div>
      </div>
    </>
  );
}
