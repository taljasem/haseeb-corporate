import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import { runValidators, required, minLength, maxLength } from "../../utils/validation";
import { rejectCloseAndSyncTask } from "../../engine/mockEngine";
import { emitTaskboxChange } from "../../utils/taskboxBus";

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

export default function RejectCloseModal({ open, period, onClose, onRejected }) {
  const { t } = useTranslation("close");
  const { t: tc } = useTranslation("common");
  useEscapeKey(onClose, open);
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState({});
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    if (open) {
      setReason("");
      setErrors({});
    }
  }, [open]);

  if (!open) return null;

  const validate = () => {
    const e = runValidators({ reason }, { reason: [required(), minLength(10), maxLength(500)] });
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleReject = async () => {
    if (!validate()) return;
    setRejecting(true);
    const r = await rejectCloseAndSyncTask(period, reason);
    emitTaskboxChange();
    setRejecting(false);
    if (onRejected) onRejected(r);
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
          width: 500, maxWidth: "calc(100vw - 32px)",
          background: "var(--bg-surface-raised)", border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 12, zIndex: 301, display: "flex", flexDirection: "column",
          boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>
              {t("reject_modal.label")}
            </div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-primary)", letterSpacing: "-0.2px", marginTop: 2 }}>
              {t("reject_modal.title")}
            </div>
          </div>
          <button onClick={onClose} aria-label={t("reject_modal.close")} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: "18px 22px" }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 6 }}>
            {t("reject_modal.field_reason")}
          </div>
          <textarea
            value={reason}
            onChange={(e) => { setReason(e.target.value); if (errors.reason) setErrors({ ...errors, reason: null }); }}
            placeholder={t("reject_modal.reason_placeholder")}
            rows={5}
            maxLength={500}
            style={{ ...inputStyle, ...invalid("reason"), resize: "vertical" }}
          />
          {err("reason")}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={onClose} style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.15)", padding: "9px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
            {t("reject_modal.cancel")}
          </button>
          <button
            onClick={handleReject}
            disabled={rejecting}
            style={{ background: "var(--semantic-danger)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 6, cursor: rejecting ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}
          >
            {rejecting ? <><Spinner size={13} />&nbsp;{t("reject_modal.rejecting")}</> : t("reject_modal.confirm")}
          </button>
        </div>
      </div>
    </>
  );
}
