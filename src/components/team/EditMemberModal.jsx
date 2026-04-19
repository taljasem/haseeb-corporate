import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import Avatar from "../taskbox/Avatar";
import { runValidators, required, minLength, maxLength } from "../../utils/validation";
import { updateTeamMember } from "../../engine/mockEngine";

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

const ROLES = ["Owner", "CFO", "Senior Accountant", "Junior Accountant"];

function FieldLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.15em",
        color: "var(--text-tertiary)",
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

export default function EditMemberModal({ open, member, onClose, onSaved }) {
  const { t } = useTranslation("team");
  const { t: tc } = useTranslation("common");
  useEscapeKey(onClose, open);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Senior Accountant");
  const [accessLevel, setAccessLevel] = useState("");
  const [status, setStatus] = useState("active");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !member) return;
    setName(member.name || "");
    setEmail(member.email || "");
    setRole(member.role || "Senior Accountant");
    setAccessLevel(member.accessLevel || "");
    setStatus(member.status || "active");
    setErrors({});
  }, [open, member]);

  if (!open || !member) return null;

  const validate = () => {
    const result = runValidators(
      { name, email, accessLevel },
      {
        name: [required(), minLength(2), maxLength(80)],
        email: [required(), minLength(5), maxLength(120)],
        accessLevel: [required(), minLength(2), maxLength(80)],
      }
    );
    setErrors(result);
    return Object.keys(result).length === 0;
  };

  const fieldError = (key) => {
    const e = errors[key];
    if (!e) return null;
    return (
      <div style={{ fontSize: 12, color: "var(--semantic-danger)", marginTop: 4 }}>
        {tc(e.key, e.values || {})}
      </div>
    );
  };
  const invalidBorder = (key) =>
    errors[key] ? { borderColor: "var(--semantic-danger)" } : null;

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    const updated = await updateTeamMember(member.id, {
      name,
      email,
      role,
      accessLevel,
      status,
    });
    setSaving(false);
    if (onSaved) onSaved(updated);
    if (onClose) onClose();
  };

  const roleLabelKey = {
    Owner: "role_owner",
    CFO: "role_cfo",
    "Senior Accountant": "role_senior",
    "Junior Accountant": "role_junior",
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
          width: 520,
          maxWidth: "calc(100vw - 32px)",
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
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Avatar person={member} size={32} />
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.15em",
                  color: "var(--text-tertiary)",
                }}
              >
                {t("edit_modal.label")}
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
                {t("edit_modal.title")}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("edit_modal.close")}
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
            gap: 14,
          }}
        >
          <div>
            <FieldLabel>{t("edit_modal.field_name")}</FieldLabel>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors({ ...errors, name: null });
              }}
              placeholder={t("edit_modal.field_name_placeholder")}
              style={{ ...inputStyle, ...invalidBorder("name") }}
            />
            {fieldError("name")}
          </div>

          <div>
            <FieldLabel>{t("edit_modal.field_email")}</FieldLabel>
            <input
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (errors.email) setErrors({ ...errors, email: null });
              }}
              placeholder={t("edit_modal.field_email_placeholder")}
              style={{ ...inputStyle, ...invalidBorder("email") }}
            />
            {fieldError("email")}
          </div>

          <div>
            <FieldLabel>{t("edit_modal.field_role")}</FieldLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {ROLES.map((r) => {
                const on = role === r;
                return (
                  <button
                    key={r}
                    onClick={() => setRole(r)}
                    style={{
                      padding: "9px 12px",
                      background: on ? "var(--accent-primary-subtle)" : "var(--bg-surface)",
                      border: on
                        ? "1px solid var(--accent-primary-border)"
                        : "1px solid var(--border-default)",
                      borderRadius: 8,
                      color: on ? "var(--accent-primary)" : "var(--text-secondary)",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 600,
                      fontFamily: "inherit",
                      textAlign: "start",
                    }}
                  >
                    {t(`edit_modal.${roleLabelKey[r]}`)}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <FieldLabel>{t("edit_modal.field_access")}</FieldLabel>
            <input
              value={accessLevel}
              onChange={(e) => {
                setAccessLevel(e.target.value);
                if (errors.accessLevel) setErrors({ ...errors, accessLevel: null });
              }}
              placeholder={t("edit_modal.field_access_placeholder")}
              style={{ ...inputStyle, ...invalidBorder("accessLevel") }}
            />
            {fieldError("accessLevel")}
          </div>

          <div>
            <FieldLabel>{t("edit_modal.field_status")}</FieldLabel>
            <div style={{ display: "flex", gap: 6 }}>
              {["active", "inactive"].map((s) => {
                const on = status === s;
                return (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    style={{
                      flex: 1,
                      padding: "9px 12px",
                      background: on ? "var(--accent-primary-subtle)" : "transparent",
                      border: on
                        ? "1px solid var(--accent-primary-border)"
                        : "1px solid var(--border-default)",
                      color: on ? "var(--accent-primary)" : "var(--text-secondary)",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      fontFamily: "inherit",
                    }}
                  >
                    {t(`edit_modal.status_${s}`)}
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
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-strong)",
              padding: "9px 16px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "inherit",
            }}
          >
            {t("edit_modal.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              background: "var(--accent-primary)",
              color: "#fff",
              border: "none",
              padding: "9px 18px",
              borderRadius: 6,
              cursor: saving ? "not-allowed" : "pointer",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            {saving ? (
              <>
                <Spinner size={13} />
                &nbsp;{t("edit_modal.saving")}
              </>
            ) : (
              t("edit_modal.save")
            )}
          </button>
        </div>
      </div>
    </>
  );
}
