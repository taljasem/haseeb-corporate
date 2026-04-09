import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, AlertTriangle } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import { deactivateAccount } from "../../engine/mockEngine";

export default function DeactivateAccountModal({ open, account, onClose, onSaved }) {
  const { t } = useTranslation("setup");
  useEscapeKey(onClose, open);
  const [running, setRunning] = useState(false);
  if (!open || !account) return null;
  const hasBalance = Math.abs(account.balance || 0) > 0;

  const handleConfirm = async () => {
    setRunning(true);
    await deactivateAccount(account.code);
    setRunning(false);
    if (onSaved) onSaved();
    if (onClose) onClose();
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 460, background: "var(--bg-surface-raised)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, zIndex: 301, boxShadow: "0 24px 60px rgba(0,0,0,0.7)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>{t("deactivate_modal.label")}</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-primary)", marginTop: 2 }}>{t("deactivate_modal.title")}</div>
          </div>
          <button onClick={onClose} aria-label={t("deactivate_modal.close")} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: "18px 22px" }}>
          <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600, marginBottom: 4 }}>{account.code} — {account.name}</div>
          {hasBalance && (
            <div style={{ display: "flex", gap: 8, padding: "10px 12px", background: "var(--semantic-warning-subtle)", border: "1px solid rgba(212,168,75,0.30)", borderRadius: 8, color: "var(--semantic-warning)", fontSize: 12, marginTop: 12 }}>
              <AlertTriangle size={14} /> {t("deactivate_modal.warning_balance")}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={onClose} style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.15)", padding: "9px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>{t("deactivate_modal.cancel")}</button>
          <button onClick={handleConfirm} disabled={running} style={{ background: "var(--semantic-danger)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 6, cursor: running ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
            {running ? <><Spinner size={13} />&nbsp;{t("deactivate_modal.confirming")}</> : t("deactivate_modal.confirm")}
          </button>
        </div>
      </div>
    </>
  );
}
