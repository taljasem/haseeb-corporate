import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import { runValidators, required, minLength, maxLength, email } from "../../utils/validation";
import { updateUserProfile } from "../../engine/mockEngine";

const COLORS = ["#00C48C", "#3B82F6", "#8B5CF6", "#D4A84B", "#FF5A5F", "#10B981"];

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

export default function EditProfileModal({ open, profile, onClose, onSaved }) {
  const { t } = useTranslation("profile");
  const { t: tc } = useTranslation("common");
  useEscapeKey(onClose, open);
  const [name, setName] = useState("");
  const [emailValue, setEmailValue] = useState("");
  const [bio, setBio] = useState("");
  const [avatarColor, setAvatarColor] = useState(COLORS[0]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && profile) {
      setName(profile.name || "");
      setEmailValue(profile.email || "");
      setBio(profile.bio || "");
      setAvatarColor(profile.avatarColor || COLORS[0]);
      setErrors({});
    }
  }, [open, profile]);

  if (!open || !profile) return null;

  const validate = () => {
    const e = runValidators(
      { name, emailValue, bio },
      {
        name: [required(), minLength(2), maxLength(80)],
        emailValue: [required(), email()],
        bio: [maxLength(500)],
      }
    );
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    const updated = await updateUserProfile({ name, email: emailValue, bio, avatarColor });
    setSaving(false);
    if (onSaved) onSaved(updated);
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
          width: 520, maxWidth: "calc(100vw - 32px)", maxHeight: "calc(100vh - 80px)",
          background: "var(--panel-bg)", border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 12, zIndex: 301, display: "flex", flexDirection: "column",
          boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>
              {t("edit_modal.label")}
            </div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-primary)", letterSpacing: "-0.2px", marginTop: 2 }}>
              {t("edit_modal.title")}
            </div>
          </div>
          <button onClick={onClose} aria-label={t("edit_modal.close")} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "18px 22px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <Label>{t("edit_modal.field_name")}</Label>
            <input value={name} onChange={(e) => { setName(e.target.value); if (errors.name) setErrors({ ...errors, name: null }); }} style={{ ...inputStyle, ...invalid("name") }} />
            {err("name")}
          </div>
          <div>
            <Label>{t("edit_modal.field_email")}</Label>
            <input value={emailValue} onChange={(e) => { setEmailValue(e.target.value); if (errors.emailValue) setErrors({ ...errors, emailValue: null }); }} style={{ ...inputStyle, ...invalid("emailValue") }} />
            {err("emailValue")}
          </div>
          <div>
            <Label>{t("edit_modal.field_bio")}</Label>
            <textarea
              value={bio}
              onChange={(e) => { setBio(e.target.value); if (errors.bio) setErrors({ ...errors, bio: null }); }}
              placeholder={t("edit_modal.bio_placeholder")}
              rows={3}
              style={{ ...inputStyle, ...invalid("bio"), resize: "vertical" }}
            />
            {err("bio")}
          </div>
          <div>
            <Label>{t("edit_modal.field_avatar_color")}</Label>
            <div style={{ display: "flex", gap: 8 }}>
              {COLORS.map((c) => {
                const on = avatarColor === c;
                return (
                  <button
                    key={c}
                    onClick={() => setAvatarColor(c)}
                    aria-label={c}
                    style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: c,
                      border: on ? "2px solid var(--text-primary)" : "2px solid transparent",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={onClose} style={btnSecondary}>{t("edit_modal.cancel")}</button>
          <button onClick={handleSave} disabled={saving} style={btnPrimary(saving)}>
            {saving ? <><Spinner size={13} />&nbsp;{t("edit_modal.saving")}</> : t("edit_modal.save")}
          </button>
        </div>
      </div>
    </>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 6 }}>{children}</div>;
}
const btnSecondary = { background: "transparent", color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.15)", padding: "9px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit" };
const btnPrimary = (saving) => ({ background: "var(--accent-primary)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 6, cursor: saving ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" });
