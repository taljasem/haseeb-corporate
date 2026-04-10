import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import { openPeriod, closePeriod } from "../../engine/mockEngine";

export default function PeriodActionModal({ open, action, month, onClose, onDone }) {
  const { t } = useTranslation("setup");
  useEscapeKey(onClose, open);
  const [running, setRunning] = useState(false);
  if (!open || !month) return null;

  const isOpen = action === "open";

  const handleConfirm = async () => {
    setRunning(true);
    if (isOpen) await openPeriod(month); else await closePeriod(month);
    setRunning(false);
    if (onDone) onDone();
    if (onClose) onClose();
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 420, background: "var(--panel-bg)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, zIndex: 301, boxShadow: "0 24px 60px rgba(0,0,0,0.7)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>{t("period_modal.label")}</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-primary)", marginTop: 2 }}>{isOpen ? t("period_modal.title_open") : t("period_modal.title_close")}</div>
          </div>
          <button onClick={onClose} aria-label={t("period_modal.close")} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: "18px 22px", fontSize: 13, color: "var(--text-secondary)" }}>{month}</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={onClose} style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.15)", padding: "9px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>{t("period_modal.cancel")}</button>
          <button onClick={handleConfirm} disabled={running} style={{ background: "var(--accent-primary)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 6, cursor: running ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
            {running ? <><Spinner size={13} />&nbsp;{t("period_modal.confirming")}</> : t("period_modal.confirm")}
          </button>
        </div>
      </div>
    </>
  );
}
