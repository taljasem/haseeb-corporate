import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import { runValidators, required, minLength } from "../../utils/validation";
import { flagVariance } from "../../engine/mockEngine";
import { emitTaskboxChange } from "../../utils/taskboxBus";

export default function FlagVarianceModal({ open, varianceId, onClose, onFlagged }) {
  const { t } = useTranslation("variance");
  const { t: tc } = useTranslation("common");
  useEscapeKey(onClose, open);
  const [reason, setReason] = useState("");
  const [assignee, setAssignee] = useState("sara");
  const [errors, setErrors] = useState({});
  const [flagging, setFlagging] = useState(false);

  useEffect(() => { if (open) { setReason(""); setErrors({}); setAssignee("sara"); } }, [open]);
  if (!open) return null;

  const handleFlag = async () => {
    const e = runValidators({ reason }, { reason: [required(), minLength(10)] });
    setErrors(e);
    if (Object.keys(e).length) return;
    setFlagging(true);
    const r = await flagVariance(varianceId, reason, assignee);
    emitTaskboxChange();
    setFlagging(false);
    if (onFlagged) onFlagged(r);
    if (onClose) onClose();
  };

  const err = errors.reason
    ? <div style={{ fontSize: 12, color: "var(--semantic-danger)", marginTop: 4 }}>{tc(errors.reason.key, errors.reason.values || {})}</div>
    : null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 500, background: "var(--panel-bg)", border: "1px solid var(--border-default)", borderRadius: 12, zIndex: 301, boxShadow: "0 24px 60px rgba(0,0,0,0.7)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>{t("flag_modal.label")}</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-primary)", marginTop: 2 }}>{t("flag_modal.title")}</div>
          </div>
          <button onClick={onClose} aria-label={t("flag_modal.close")} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 6 }}>{t("flag_modal.field_reason")}</div>
            <textarea
              value={reason}
              onChange={(e) => { setReason(e.target.value); if (errors.reason) setErrors({}); }}
              placeholder={t("flag_modal.reason_placeholder")}
              rows={4}
              style={{ width: "100%", background: "var(--bg-surface-sunken)", border: `1px solid ${errors.reason ? "var(--semantic-danger)" : "var(--border-default)"}`, borderRadius: 8, padding: "10px 12px", color: "var(--text-primary)", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical" }}
            />
            {err}
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 6 }}>{t("flag_modal.field_assignee")}</div>
            <div style={{ display: "flex", gap: 6 }}>
              {[{ id: "sara", label: t("flag_modal.assignee_sara") }, { id: "cfo", label: t("flag_modal.assignee_cfo") }].map((a) => {
                const on = assignee === a.id;
                return (
                  <button key={a.id} onClick={() => setAssignee(a.id)} style={{ flex: 1, padding: "9px 12px", background: on ? "var(--accent-primary-subtle)" : "transparent", border: on ? "1px solid rgba(0,196,140,0.30)" : "1px solid var(--border-default)", color: on ? "var(--accent-primary)" : "var(--text-secondary)", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit" }}>
                    {a.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid var(--border-subtle)" }}>
          <button onClick={onClose} style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-strong)", padding: "9px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>{t("flag_modal.cancel")}</button>
          <button onClick={handleFlag} disabled={flagging} style={{ background: "var(--semantic-warning)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 6, cursor: flagging ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
            {flagging ? <><Spinner size={13} />&nbsp;{t("flag_modal.flagging")}</> : t("flag_modal.confirm")}
          </button>
        </div>
      </div>
    </>
  );
}
