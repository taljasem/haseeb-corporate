import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import { runValidators, required, minLength } from "../../utils/validation";
// AUDIT-ACC-005 (corporate-api 3fdb92c, 2026-04-22): rewired to the new
// /api/invoices/:id/dispute endpoint. Body = {reason, disputedAmount?}.
// Resolution 2.2(a) per Tarek 2026-04-22: dropped `expectedResolution`
// and `assignee` from the UI because the backend schema does not persist
// them — keeping them on the form would be a misleading UX. Re-introduce
// via a schema extension later if operators ask.
import { disputeInvoice } from "../../engine";

const inputStyle = {
  width: "100%", background: "var(--bg-surface-sunken)",
  border: "1px solid var(--border-default)", borderRadius: 8,
  padding: "10px 12px", color: "var(--text-primary)",
  fontSize: 13, fontFamily: "inherit", outline: "none",
};

// KWD 3-decimal-place string or empty.
const KWD_RE = /^\d+(\.\d{1,3})?$/;

export default function DisputeInvoiceModal({ open, invoice, onClose, onSaved }) {
  const { t } = useTranslation("aging");
  const { t: tc } = useTranslation("common");
  useEscapeKey(onClose, open);
  const [reason, setReason] = useState("");
  const [disputedAmount, setDisputedAmount] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    if (open) {
      setReason("");
      setDisputedAmount("");
      setErrors({});
      setSubmitError(null);
    }
  }, [open]);

  if (!open || !invoice) return null;

  const handleSave = async () => {
    const validators = { reason: [required(), minLength(10)] };
    const e = runValidators({ reason }, validators);
    // Local-only validation for disputedAmount: must be a KWD 3dp string
    // or empty. If non-empty and invalid, block submit.
    if (disputedAmount && !KWD_RE.test(String(disputedAmount).trim())) {
      e.disputedAmount = { key: "validation.kwd_3dp_required" };
    }
    setErrors(e);
    if (Object.keys(e).length) return;
    if (saving) return; // guard double-submit
    setSaving(true);
    setSubmitError(null);
    try {
      const trimmed = String(disputedAmount || "").trim();
      const result = await disputeInvoice(invoice.id, {
        reason,
        disputedAmount: trimmed ? trimmed : undefined,
      });
      if (onSaved) onSaved(result);
      if (onClose) onClose();
    } catch (err) {
      const msg = err?.message || err?.error?.message || String(err) || t("dispute_modal.toast_error");
      setSubmitError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 500, background: "var(--panel-bg)", border: "1px solid var(--border-default)", borderRadius: 12, zIndex: 301, boxShadow: "0 24px 60px rgba(0,0,0,0.7)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>{t("dispute_modal.label")}</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-primary)", marginTop: 2 }}>{t("dispute_modal.title")}</div>
          </div>
          <button onClick={onClose} aria-label={t("dispute_modal.close")} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{invoice.invoiceNumber} · {invoice.partyName}</div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 6 }}>{t("dispute_modal.field_reason")}</div>
            <textarea
              value={reason}
              onChange={(e) => { setReason(e.target.value); if (errors.reason) setErrors({ ...errors, reason: undefined }); }}
              placeholder={t("dispute_modal.reason_placeholder")}
              rows={4}
              style={{ ...inputStyle, resize: "vertical", ...(errors.reason ? { borderColor: "var(--semantic-danger)" } : {}) }}
            />
            {errors.reason && <div style={{ fontSize: 12, color: "var(--semantic-danger)", marginTop: 4 }}>{tc(errors.reason.key, errors.reason.values || {})}</div>}
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 6 }}>{t("dispute_modal.disputed_amount_label")}</div>
            <input
              value={disputedAmount}
              onChange={(e) => { setDisputedAmount(e.target.value); if (errors.disputedAmount) setErrors({ ...errors, disputedAmount: undefined }); }}
              inputMode="decimal"
              placeholder={t("dispute_modal.disputed_amount_placeholder")}
              style={{ ...inputStyle, fontFamily: "'DM Mono', monospace", ...(errors.disputedAmount ? { borderColor: "var(--semantic-danger)" } : {}) }}
            />
            {errors.disputedAmount && (
              <div style={{ fontSize: 12, color: "var(--semantic-danger)", marginTop: 4 }}>
                {t("dispute_modal.disputed_amount_invalid")}
              </div>
            )}
          </div>
        </div>
        {submitError && (
          <div
            role="alert"
            style={{
              margin: "0 22px 12px",
              padding: "10px 12px",
              background: "var(--semantic-danger-subtle)",
              border: "1px solid var(--semantic-danger)",
              borderRadius: 6,
              color: "var(--semantic-danger)",
              fontSize: 12,
              lineHeight: 1.4,
            }}
          >
            {submitError}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid var(--border-subtle)" }}>
          <button onClick={onClose} style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-strong)", padding: "9px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>{t("dispute_modal.cancel")}</button>
          <button onClick={handleSave} disabled={saving} style={{ background: "var(--semantic-warning)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 6, cursor: saving ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
            {saving ? <><Spinner size={13} />&nbsp;{t("dispute_modal.saving")}</> : t("dispute_modal.save")}
          </button>
        </div>
      </div>
    </>
  );
}
