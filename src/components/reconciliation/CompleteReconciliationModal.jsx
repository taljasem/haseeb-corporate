import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import { formatKWDAmount } from "../../utils/format";

export default function CompleteReconciliationModal({ open, onClose, rec, unresolvedCount, hasDifference, isSoftClosed, onConfirm }) {
  const { t } = useTranslation("reconciliation");
  const [confirming, setConfirming] = useState(false);
  useEscapeKey(onClose, open);

  if (!open || !rec) return null;

  const needsForce = unresolvedCount > 0 || hasDifference;

  const handleConfirm = async () => {
    setConfirming(true);
    await onConfirm(needsForce);
    setConfirming(false);
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 460, background: "var(--bg-surface-raised)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, zIndex: 301, boxShadow: "0 24px 60px rgba(0,0,0,0.7)" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle2 size={16} color={needsForce ? "var(--semantic-warning)" : "var(--accent-primary)"} />
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--text-primary)" }}>{t("complete.title")}</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}><X size={18} /></button>
        </div>

        {/* Body */}
        <div style={{ padding: "18px 22px" }}>
          {!needsForce && (
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>{t("complete.subtitle_clean")}</div>
          )}
          {unresolvedCount > 0 && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 14px", background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.25)", borderRadius: 8, marginBottom: 10 }}>
              <AlertTriangle size={14} color="var(--semantic-warning)" style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.5 }}>{t("complete.subtitle_with_exceptions", { count: unresolvedCount })}</div>
            </div>
          )}
          {hasDifference && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 14px", background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.25)", borderRadius: 8, marginBottom: 10 }}>
              <AlertTriangle size={14} color="var(--semantic-warning)" style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.5 }}>{t("complete.warning_difference", { amount: formatKWDAmount(rec.reconciliationDifference) })}</div>
            </div>
          )}
          {isSoftClosed && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 14px", background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 8, marginTop: 10 }}>
              <AlertTriangle size={14} color="var(--semantic-info, #3b82f6)" style={{ marginTop: 2, flexShrink: 0 }} />
              <div style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.5 }}>{t("complete.warning_soft_closed")}</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={onClose} style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.15)", padding: "9px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>{t("complete.cancel_button")}</button>
          <button onClick={handleConfirm} disabled={confirming} style={{ background: needsForce ? "var(--semantic-warning)" : "var(--accent-primary)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
            {confirming ? "..." : needsForce ? t("complete.force_button") : t("complete.confirm_button")}
          </button>
        </div>
      </div>
    </>
  );
}
