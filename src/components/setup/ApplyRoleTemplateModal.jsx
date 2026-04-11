import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, AlertTriangle } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import { getRoleTemplates, applyRoleTemplate } from "../../engine/mockEngine";

export default function ApplyRoleTemplateModal({ open, member, onClose, onApplied }) {
  const { t } = useTranslation("setup");
  useEscapeKey(onClose, open);
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState("");
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!open) return;
    getRoleTemplates().then((list) => {
      setTemplates(list);
      setTemplateId(list[0]?.id || "");
    });
  }, [open]);

  if (!open || !member) return null;

  const handleApply = async () => {
    setApplying(true);
    await applyRoleTemplate(member.memberId, templateId);
    setApplying(false);
    if (onApplied) onApplied();
    if (onClose) onClose();
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 480, background: "var(--panel-bg)", border: "1px solid var(--border-default)", borderRadius: 12, zIndex: 301, boxShadow: "0 24px 60px rgba(0,0,0,0.7)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>{t("apply_template_modal.label")}</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-primary)", marginTop: 2 }}>{t("apply_template_modal.title")}</div>
          </div>
          <button onClick={onClose} aria-label={t("apply_template_modal.close")} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>{member.name}</div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 6 }}>{t("apply_template_modal.field_template")}</div>
            <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} style={{ width: "100%", background: "var(--bg-surface-sunken)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "10px 12px", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none", appearance: "none" }}>
              {templates.map((tpl) => <option key={tpl.id} value={tpl.id}>{tpl.name}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 8, padding: "10px 12px", background: "var(--semantic-warning-subtle)", border: "1px solid rgba(212,168,75,0.30)", borderRadius: 8, color: "var(--semantic-warning)", fontSize: 12 }}>
            <AlertTriangle size={14} /> {t("apply_template_modal.warning")}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid var(--border-subtle)" }}>
          <button onClick={onClose} style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-strong)", padding: "9px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>{t("apply_template_modal.cancel")}</button>
          <button onClick={handleApply} disabled={applying} style={{ background: "var(--accent-primary)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 6, cursor: applying ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
            {applying ? <><Spinner size={13} />&nbsp;{t("apply_template_modal.applying")}</> : t("apply_template_modal.apply")}
          </button>
        </div>
      </div>
    </>
  );
}
