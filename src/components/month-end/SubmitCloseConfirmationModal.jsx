import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import { submitCloseForApproval } from "../../engine/mockEngine";

export default function SubmitCloseConfirmationModal({ open, period, onClose, onSubmitted }) {
  const { t } = useTranslation("close");
  useEscapeKey(onClose, open);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  const handleConfirm = async () => {
    setSubmitting(true);
    const r = await submitCloseForApproval(period);
    setSubmitting(false);
    if (onSubmitted) onSubmitted(r);
    if (onClose) onClose();
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div
        style={{
          position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          width: 460, maxWidth: "calc(100vw - 32px)",
          background: "var(--panel-bg)", border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 12, zIndex: 301, display: "flex", flexDirection: "column",
          boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>
              {t("submit_modal.label")}
            </div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-primary)", letterSpacing: "-0.2px", marginTop: 2 }}>
              {t("submit_modal.title")}
            </div>
          </div>
          <button onClick={onClose} aria-label={t("submit_modal.close")} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: "18px 22px", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          {t("submit_modal.body", { period })}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={onClose} style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.15)", padding: "9px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
            {t("submit_modal.cancel")}
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            style={{ background: "var(--accent-primary)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 6, cursor: submitting ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}
          >
            {submitting ? <><Spinner size={13} />&nbsp;{t("submit_modal.submitting")}</> : t("submit_modal.confirm")}
          </button>
        </div>
      </div>
    </>
  );
}
