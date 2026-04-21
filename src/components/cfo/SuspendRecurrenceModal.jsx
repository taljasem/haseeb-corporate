import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import { runValidators, required, minLength } from "../../utils/validation";
import { suspendRecurrencePattern } from "../../engine";

/**
 * SuspendRecurrenceModal — confirmation dialog for the operator-only
 * Suspend action on an Aminah missed-recurrence alert (Tier C-3 FOLLOW-UP;
 * backend HASEEB-183 at `aff0764`, 2026-04-21).
 *
 * Sibling of FlagVarianceModal in shape: fixed overlay + centered card +
 * X close + reason textarea + cancel/confirm footer. The reason textarea
 * requires 10..500 chars (backend accepts 1..500; the UX floor of 10
 * matches FlagVarianceModal and keeps audit trails informative).
 *
 * Props:
 *   open:         boolean — visibility
 *   patternId:    string  — RecurrencePattern id (passed through to engine)
 *   merchantName: string  — for the subtitle copy + screen-reader context
 *   onClose:      () => void
 *   onConfirmed:  (patternId) => void — called after successful suspend
 *                 BEFORE onClose so the parent can patch its local state.
 */
export default function SuspendRecurrenceModal({
  open,
  patternId,
  merchantName,
  onClose,
  onConfirmed,
}) {
  const { t } = useTranslation("aminah");
  const { t: tc } = useTranslation("common");
  useEscapeKey(onClose, open);

  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);

  // Reset all form state when the modal opens so a previous session's
  // reason/error don't bleed into the next invocation.
  useEffect(() => {
    if (!open) return;
    setReason("");
    setErrors({});
    setSubmitting(false);
    setSubmitError(false);
  }, [open]);

  if (!open) return null;

  const handleConfirm = async () => {
    const e = runValidators({ reason }, { reason: [required(), minLength(10)] });
    setErrors(e);
    if (Object.keys(e).length) return;
    setSubmitting(true);
    setSubmitError(false);
    try {
      await suspendRecurrencePattern(patternId, { reason: reason.trim() });
      setSubmitting(false);
      if (onConfirmed) onConfirmed(patternId);
      if (onClose) onClose();
    } catch (err) {
      console.error("[SuspendRecurrenceModal] suspend failed", err);
      setSubmitting(false);
      setSubmitError(true);
    }
  };

  const reasonErr = errors.reason
    ? (
      <div style={{ fontSize: 12, color: "var(--semantic-danger)", marginTop: 4 }}>
        {tc(errors.reason.key, errors.reason.values || {})}
      </div>
    )
    : null;

  return (
    <>
      <div
        onClick={submitting ? undefined : onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
          zIndex: 300,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("suspend_modal.title")}
        style={{
          position: "fixed",
          top: "50%",
          insetInlineStart: "50%",
          transform: "translate(-50%, -50%)",
          width: 500,
          maxWidth: "calc(100vw - 32px)",
          background: "var(--panel-bg)",
          border: "1px solid var(--border-default)",
          borderRadius: 12,
          zIndex: 301,
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
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.15em",
                color: "var(--text-tertiary)",
              }}
            >
              {t("missed_recurrences.title")}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22,
                color: "var(--text-primary)",
                marginTop: 2,
              }}
            >
              {t("suspend_modal.title")}
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            aria-label={t("suspend_modal.close")}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-tertiary)",
              cursor: submitting ? "not-allowed" : "pointer",
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            padding: "18px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              lineHeight: 1.55,
            }}
          >
            {t("suspend_modal.subtitle", { merchant: merchantName || "" })}
          </div>

          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.15em",
                color: "var(--text-tertiary)",
                marginBottom: 6,
              }}
            >
              {t("suspend_modal.reason_label")}
            </div>
            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (errors.reason) setErrors({});
              }}
              placeholder={t("suspend_modal.reason_placeholder")}
              rows={4}
              maxLength={500}
              disabled={submitting}
              style={{
                width: "100%",
                background: "var(--bg-surface-sunken)",
                border: `1px solid ${errors.reason ? "var(--semantic-danger)" : "var(--border-default)"}`,
                borderRadius: 8,
                padding: "10px 12px",
                color: "var(--text-primary)",
                fontSize: 13,
                fontFamily: "inherit",
                outline: "none",
                resize: "vertical",
              }}
            />
            {reasonErr}
            {submitError && (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--semantic-danger)",
                  marginTop: 8,
                }}
              >
                {t("suspend_modal.suspend_failed")}
              </div>
            )}
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
            disabled={submitting}
            style={{
              background: "transparent",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-strong)",
              padding: "9px 16px",
              borderRadius: 6,
              cursor: submitting ? "not-allowed" : "pointer",
              fontSize: 12,
              fontFamily: "inherit",
            }}
          >
            {t("suspend_modal.cancel")}
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting}
            style={{
              background: submitting
                ? "color-mix(in srgb, var(--semantic-warning) 40%, transparent)"
                : "var(--semantic-warning)",
              color: "#fff",
              border: "none",
              padding: "9px 18px",
              borderRadius: 6,
              cursor: submitting ? "not-allowed" : "pointer",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {submitting ? (
              <>
                <Spinner size={13} />
                {t("suspend_modal.suspending")}
              </>
            ) : (
              t("suspend_modal.confirm")
            )}
          </button>
        </div>
      </div>
    </>
  );
}
