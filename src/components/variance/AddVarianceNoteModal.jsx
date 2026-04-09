import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import { runValidators, required, minLength, maxLength } from "../../utils/validation";
import { addVarianceNote } from "../../engine/mockEngine";

export default function AddVarianceNoteModal({ open, varianceId, onClose, onSaved }) {
  const { t } = useTranslation("variance");
  const { t: tc } = useTranslation("common");
  useEscapeKey(onClose, open);
  const [note, setNote] = useState("");
  const [visibility, setVisibility] = useState("cfo_owner");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) { setNote(""); setErrors({}); setVisibility("cfo_owner"); } }, [open]);
  if (!open) return null;

  const handleSave = async () => {
    const e = runValidators({ note }, { note: [required(), minLength(3), maxLength(1000)] });
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    const n = await addVarianceNote(varianceId, note, visibility);
    setSaving(false);
    if (onSaved) onSaved(n);
    if (onClose) onClose();
  };

  const err = errors.note
    ? <div style={{ fontSize: 12, color: "var(--semantic-danger)", marginTop: 4 }}>{tc(errors.note.key, errors.note.values || {})}</div>
    : null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 500, background: "var(--bg-surface-raised)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, zIndex: 301, boxShadow: "0 24px 60px rgba(0,0,0,0.7)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>{t("add_note_modal.label")}</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-primary)", marginTop: 2 }}>{t("add_note_modal.title")}</div>
          </div>
          <button onClick={onClose} aria-label={t("add_note_modal.close")} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 6 }}>{t("add_note_modal.field_note")}</div>
            <textarea
              value={note}
              onChange={(e) => { setNote(e.target.value); if (errors.note) setErrors({}); }}
              placeholder={t("add_note_modal.note_placeholder")}
              rows={5} maxLength={1000}
              style={{ width: "100%", background: "var(--bg-surface-sunken)", border: `1px solid ${errors.note ? "var(--semantic-danger)" : "rgba(255,255,255,0.10)"}`, borderRadius: 8, padding: "10px 12px", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical" }}
            />
            {err}
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 6 }}>{t("add_note_modal.field_visibility")}</div>
            <div style={{ display: "flex", gap: 6 }}>
              {["cfo_only", "cfo_owner"].map((v) => {
                const on = visibility === v;
                return (
                  <button key={v} onClick={() => setVisibility(v)} style={{ flex: 1, padding: "9px 12px", background: on ? "var(--accent-primary-subtle)" : "transparent", border: on ? "1px solid rgba(0,196,140,0.30)" : "1px solid rgba(255,255,255,0.10)", color: on ? "var(--accent-primary)" : "var(--text-secondary)", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit" }}>
                    {t(`add_note_modal.visibility_${v}`)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={onClose} style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.15)", padding: "9px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>{t("add_note_modal.cancel")}</button>
          <button onClick={handleSave} disabled={saving} style={{ background: "var(--accent-primary)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 6, cursor: saving ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
            {saving ? <><Spinner size={13} />&nbsp;{t("add_note_modal.saving")}</> : t("add_note_modal.save")}
          </button>
        </div>
      </div>
    </>
  );
}
