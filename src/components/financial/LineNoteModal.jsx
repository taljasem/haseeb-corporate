import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Trash2 } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import { runValidators, required, minLength, maxLength } from "../../utils/validation";
import { addLineNote, updateLineNote, deleteLineNote } from "../../engine/mockEngine";

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

export default function LineNoteModal({ open, accountCode, accountLabel, period, existing, onClose, onSaved, onDeleted }) {
  const { t } = useTranslation("financial");
  const { t: tc } = useTranslation("common");
  useEscapeKey(onClose, open);
  const [note, setNote] = useState("");
  const [visibility, setVisibility] = useState("cfo_owner");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setNote(existing?.note || "");
    setVisibility(existing?.visibility || "cfo_owner");
    setErrors({});
  }, [open, existing]);

  if (!open) return null;

  const validate = () => {
    const e = runValidators({ note }, { note: [required(), minLength(3), maxLength(1000)] });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    let saved;
    if (existing) {
      saved = await updateLineNote(existing.id, { note, visibility });
    } else {
      saved = await addLineNote(accountCode, period || "march-2026", note, visibility);
    }
    setSaving(false);
    if (onSaved) onSaved(saved);
    if (onClose) onClose();
  };

  const handleDelete = async () => {
    if (!existing) return;
    setSaving(true);
    await deleteLineNote(existing.id);
    setSaving(false);
    if (onDeleted) onDeleted(existing.id);
    if (onClose) onClose();
  };

  const err = (k) =>
    errors[k] ? (
      <div style={{ fontSize: 12, color: "var(--semantic-danger)", marginTop: 4 }}>
        {tc(errors[k].key, errors[k].values || {})}
      </div>
    ) : null;
  const invalid = (k) => (errors[k] ? { borderColor: "var(--semantic-danger)" } : null);

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div
        style={{
          position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          width: 500, maxWidth: "calc(100vw - 32px)",
          background: "var(--panel-bg)", border: "1px solid var(--border-default)",
          borderRadius: 12, zIndex: 301, display: "flex", flexDirection: "column",
          boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>
              {t("notes.label")}
            </div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-primary)", letterSpacing: "-0.2px", marginTop: 2 }}>
              {existing ? t("notes.title_edit") : t("notes.title_add")}
            </div>
          </div>
          <button onClick={onClose} aria-label={t("notes.close")} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <Label>{t("notes.field_account")}</Label>
            <div style={{ ...inputStyle, background: "var(--bg-surface)", color: "var(--text-secondary)", cursor: "default" }}>
              {accountLabel || accountCode || "—"}
            </div>
          </div>
          <div>
            <Label>{t("notes.field_note")}</Label>
            <textarea
              value={note}
              onChange={(e) => { setNote(e.target.value); if (errors.note) setErrors({ ...errors, note: null }); }}
              placeholder={t("notes.note_placeholder")}
              rows={5}
              maxLength={1000}
              style={{ ...inputStyle, ...invalid("note"), resize: "vertical" }}
            />
            {err("note")}
          </div>
          <div>
            <Label>{t("notes.field_visibility")}</Label>
            <div style={{ display: "flex", gap: 6 }}>
              {["cfo_only", "cfo_owner"].map((v) => {
                const on = visibility === v;
                return (
                  <button
                    key={v}
                    onClick={() => setVisibility(v)}
                    style={{
                      flex: 1, padding: "9px 12px",
                      background: on ? "var(--accent-primary-subtle)" : "transparent",
                      border: on ? "1px solid var(--accent-primary-border)" : "1px solid var(--border-default)",
                      color: on ? "var(--accent-primary)" : "var(--text-secondary)",
                      borderRadius: 6, cursor: "pointer",
                      fontSize: 11, fontWeight: 600, fontFamily: "inherit",
                    }}
                  >
                    {t(`notes.visibility_${v}`)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center", padding: "14px 22px", borderTop: "1px solid var(--border-subtle)" }}>
          {existing ? (
            <button onClick={handleDelete} style={{ background: "transparent", color: "var(--semantic-danger)", border: "none", padding: "7px 10px", cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Trash2 size={12} /> {t("notes.delete")}
            </button>
          ) : <span />}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={btnSecondary}>{t("notes.cancel")}</button>
            <button onClick={handleSave} disabled={saving} style={btnPrimary(saving)}>
              {saving ? <><Spinner size={13} />&nbsp;{t("notes.saving")}</> : t("notes.save")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 6 }}>{children}</div>;
}
const btnSecondary = { background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-strong)", padding: "9px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit" };
const btnPrimary = (saving) => ({ background: "var(--accent-primary)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 6, cursor: saving ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" });
