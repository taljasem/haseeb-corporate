import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import { runValidators, required, minLength } from "../../utils/validation";
import { changePassword } from "../../engine/mockEngine";

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

export default function ChangePasswordModal({ open, onClose, onSaved }) {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  useEscapeKey(onClose, open);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setOldPw("");
      setNewPw("");
      setConfirmPw("");
      setErrors({});
    }
  }, [open]);

  if (!open) return null;

  const validate = () => {
    const e = runValidators(
      { oldPw, newPw },
      { oldPw: [required("validation.old_password_required")], newPw: [required(), minLength(8, "validation.password_too_short")] }
    );
    if (!e.confirmPw && confirmPw !== newPw) e.confirmPw = { key: "validation.mismatch" };
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    const r = await changePassword(oldPw, newPw);
    setSaving(false);
    if (!r.success) {
      setErrors({ oldPw: { key: r.error || "validation.invalid_format" } });
      return;
    }
    if (onSaved) onSaved();
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
          width: 460, maxWidth: "calc(100vw - 32px)",
          background: "var(--bg-surface-raised)", border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 12, zIndex: 301, display: "flex", flexDirection: "column",
          boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>
              {t("change_password_modal.label")}
            </div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-primary)", letterSpacing: "-0.2px", marginTop: 2 }}>
              {t("change_password_modal.title")}
            </div>
          </div>
          <button onClick={onClose} aria-label={t("change_password_modal.close")} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <Label>{t("change_password_modal.field_old")}</Label>
            <input type="password" value={oldPw} onChange={(e) => { setOldPw(e.target.value); if (errors.oldPw) setErrors({ ...errors, oldPw: null }); }} style={{ ...inputStyle, ...invalid("oldPw") }} />
            {err("oldPw")}
          </div>
          <div>
            <Label>{t("change_password_modal.field_new")}</Label>
            <input type="password" value={newPw} onChange={(e) => { setNewPw(e.target.value); if (errors.newPw) setErrors({ ...errors, newPw: null }); }} style={{ ...inputStyle, ...invalid("newPw") }} />
            {err("newPw")}
          </div>
          <div>
            <Label>{t("change_password_modal.field_confirm")}</Label>
            <input type="password" value={confirmPw} onChange={(e) => { setConfirmPw(e.target.value); if (errors.confirmPw) setErrors({ ...errors, confirmPw: null }); }} style={{ ...inputStyle, ...invalid("confirmPw") }} />
            {err("confirmPw")}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={onClose} style={btnSecondary}>{t("change_password_modal.cancel")}</button>
          <button onClick={handleSave} disabled={saving} style={btnPrimary(saving)}>
            {saving ? <><Spinner size={13} />&nbsp;{t("change_password_modal.saving")}</> : t("change_password_modal.save")}
          </button>
        </div>
      </div>
    </>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 6 }}>{children}</div>;
}

const btnSecondary = {
  background: "transparent", color: "var(--text-secondary)",
  border: "1px solid rgba(255,255,255,0.15)", padding: "9px 16px",
  borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit",
};
const btnPrimary = (saving) => ({
  background: "var(--accent-primary)", color: "#fff", border: "none",
  padding: "9px 18px", borderRadius: 6, cursor: saving ? "not-allowed" : "pointer",
  fontSize: 12, fontWeight: 600, fontFamily: "inherit",
});
