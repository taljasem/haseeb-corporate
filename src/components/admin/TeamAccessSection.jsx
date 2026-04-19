import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, X as XIcon } from "lucide-react";
import {
  getTeamAccessMatrix,
  updateTeamMemberPermissions,
} from "../../engine/mockEngine";
import ApplyRoleTemplateModal from "../setup/ApplyRoleTemplateModal";

const PERM_KEYS = [
  "view_financials",
  "post_je",
  "approve_je",
  "edit_budget",
  "close_periods",
  "configure_setup",
  "approve_writeoffs",
];

export default function TeamAccessSection({ readOnly = false }) {
  const { t } = useTranslation("setup");
  const [members, setMembers] = useState([]);
  const [templateFor, setTemplateFor] = useState(null);
  const [toast, setToast] = useState(null);

  const reload = () => getTeamAccessMatrix().then(setMembers);
  useEffect(() => {
    reload();
  }, []);

  const togglePerm = async (memberId, perm) => {
    if (readOnly) return;
    const m = members.find((x) => x.memberId === memberId);
    if (!m) return;
    const newVal = !m.permissions[perm];
    setMembers(
      members.map((x) =>
        x.memberId === memberId
          ? { ...x, permissions: { ...x.permissions, [perm]: newVal } }
          : x,
      ),
    );
    await updateTeamMemberPermissions(memberId, { [perm]: newVal });
    setToast(t("team_access.saved_toast"));
  };

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: 10,
        padding: "20px 22px",
      }}
    >
      <div
        style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 20,
          color: "var(--text-primary)",
          letterSpacing: "-0.2px",
          lineHeight: 1.1,
        }}
      >
        {t("team_access.title")}
      </div>
      <div
        style={{
          fontSize: 12,
          color: "var(--text-tertiary)",
          marginTop: 4,
          marginBottom: 14,
        }}
      >
        {t("team_access.description")}
      </div>
      {toast && (
        <div
          role="status"
          style={{
            marginBottom: 14,
            background: "var(--accent-primary-subtle)",
            border: "1px solid var(--accent-primary-border)",
            color: "var(--accent-primary)",
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          {toast}
        </div>
      )}
      <div
        style={{
          fontSize: 11,
          color: "var(--text-tertiary)",
          marginBottom: 10,
          fontStyle: "italic",
        }}
      >
        {t("team_access.sensitive_note")}
      </div>
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 900 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `180px 120px repeat(${PERM_KEYS.length}, 1fr) 110px`,
              gap: 8,
              padding: "8px 0",
              borderBottom: "1px solid var(--border-default)",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: "var(--text-tertiary)",
            }}
          >
            <div>{t("team_access.col_member")}</div>
            <div>{t("team_access.col_role")}</div>
            {PERM_KEYS.map((p) => (
              <div key={p} style={{ textAlign: "center", fontSize: 9 }}>
                {t(`team_access.permissions.${p}`)}
              </div>
            ))}
            <div>{t("team_access.col_template")}</div>
          </div>
          {members.map((m) => (
            <div
              key={m.memberId}
              style={{
                display: "grid",
                gridTemplateColumns: `180px 120px repeat(${PERM_KEYS.length}, 1fr) 110px`,
                gap: 8,
                padding: "10px 0",
                borderBottom: "1px solid var(--border-subtle)",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-primary)",
                  fontWeight: 500,
                }}
              >
                {m.name}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                {m.role}
              </div>
              {PERM_KEYS.map((p) => (
                <div key={p} style={{ textAlign: "center" }}>
                  <button
                    onClick={() => togglePerm(m.memberId, p)}
                    disabled={readOnly}
                    aria-pressed={!!m.permissions[p]}
                    aria-label={t(`team_access.permissions.${p}`)}
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: readOnly ? "not-allowed" : "pointer",
                      color: m.permissions[p]
                        ? "var(--accent-primary)"
                        : "var(--text-tertiary)",
                      padding: 0,
                      opacity: readOnly ? 0.6 : 1,
                    }}
                  >
                    {m.permissions[p] ? <Check size={16} /> : <XIcon size={14} />}
                  </button>
                </div>
              ))}
              <div>
                <button
                  onClick={() => !readOnly && setTemplateFor(m)}
                  disabled={readOnly}
                  style={{
                    background: "transparent",
                    color: readOnly ? "var(--text-tertiary)" : "var(--text-secondary)",
                    border: "1px solid var(--border-strong)",
                    padding: "5px 10px",
                    borderRadius: 5,
                    cursor: readOnly ? "not-allowed" : "pointer",
                    fontSize: 10,
                    fontFamily: "inherit",
                    fontWeight: 600,
                    opacity: readOnly ? 0.6 : 1,
                  }}
                >
                  {t("team_access.apply_template")}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      {!readOnly && (
        <ApplyRoleTemplateModal
          open={!!templateFor}
          member={templateFor}
          onClose={() => setTemplateFor(null)}
          onApplied={() => {
            reload();
            setToast(t("apply_template_modal.applied_toast"));
          }}
        />
      )}
    </div>
  );
}
