import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, AlertTriangle } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import LtrText from "../shared/LtrText";
import { markIslamicInstallmentPaid } from "../../engine";

const inputStyle = {
  width: "100%",
  background: "var(--bg-surface-sunken)",
  border: "1px solid var(--border-default)",
  borderRadius: 8,
  padding: "10px 12px",
  color: "var(--text-primary)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function isValidDecimal(v) {
  if (v === "" || v == null) return false;
  return /^\d+(?:\.\d{1,3})?$/.test(String(v).trim());
}

export default function IslamicMarkPaidModal({ open, scheduleRow, onClose, onSaved }) {
  const { t } = useTranslation("islamic-finance");
  useEscapeKey(onClose, open);

  const [paidDate, setPaidDate] = useState(today());
  const [paidAmountKwd, setPaidAmountKwd] = useState("");
  const [submitError, setSubmitError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPaidDate(today());
    setPaidAmountKwd(scheduleRow?.totalPortionKwd || "");
    setSubmitError(null);
  }, [open, scheduleRow]);

  if (!open || !scheduleRow) return null;

  const handleSave = async () => {
    setSubmitError(null);
    if (!paidDate) {
      setSubmitError(t("paid_modal.error_date_required"));
      return;
    }
    if (!isValidDecimal(paidAmountKwd) || Number(paidAmountKwd) <= 0) {
      setSubmitError(t("paid_modal.error_amount"));
      return;
    }
    setSaving(true);
    try {
      await markIslamicInstallmentPaid(scheduleRow.id, {
        paidDate,
        paidAmountKwd: String(paidAmountKwd).trim(),
      });
      if (onSaved) onSaved();
      if (onClose) onClose();
    } catch (err) {
      setSubmitError(err?.message || t("paid_modal.error_generic"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
          zIndex: 300,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 460,
          maxHeight: "calc(100vh - 80px)",
          background: "var(--panel-bg)",
          border: "1px solid var(--border-default)",
          borderRadius: 12,
          zIndex: 301,
          display: "flex",
          flexDirection: "column",
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
              {t("paid_modal.label")}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22,
                color: "var(--text-primary)",
                marginTop: 2,
              }}
            >
              {t("paid_modal.title", { n: scheduleRow.installmentNumber })}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("paid_modal.close")}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-tertiary)",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>
        <div
          style={{
            padding: "18px 22px",
            overflowY: "auto",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {submitError && (
            <div
              role="alert"
              style={{
                display: "flex",
                gap: 8,
                padding: "10px 12px",
                background: "var(--semantic-danger-subtle)",
                border: "1px solid var(--semantic-danger)",
                borderRadius: 8,
                color: "var(--semantic-danger)",
                fontSize: 12,
              }}
            >
              <AlertTriangle size={14} /> {submitError}
            </div>
          )}

          <div
            style={{
              fontSize: 12,
              color: "var(--text-secondary)",
              padding: "10px 12px",
              background: "var(--bg-surface-sunken)",
              border: "1px solid var(--border-default)",
              borderRadius: 8,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <LtrText>
              <span style={{ fontFamily: "'DM Mono', monospace" }}>
                {t("paid_modal.due_date")}: {scheduleRow.dueDate}
              </span>
            </LtrText>
            <LtrText>
              <span style={{ fontFamily: "'DM Mono', monospace" }}>
                {t("paid_modal.expected")}: {scheduleRow.totalPortionKwd} KWD
              </span>
            </LtrText>
          </div>

          <Field label={t("paid_modal.field_paid_date")}>
            <input
              type="date"
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label={t("paid_modal.field_amount")}>
            <input
              type="text"
              inputMode="decimal"
              value={paidAmountKwd}
              onChange={(e) => setPaidAmountKwd(e.target.value)}
              placeholder="0.000"
              style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }}
            />
          </Field>
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
          <button onClick={onClose} style={btnSecondary}>
            {t("paid_modal.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={btnPrimary(saving)}
          >
            {saving ? (
              <>
                <Spinner size={13} />
                &nbsp;{t("paid_modal.saving")}
              </>
            ) : (
              t("paid_modal.save")
            )}
          </button>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }) {
  return (
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
        {label}
      </div>
      {children}
    </div>
  );
}

const btnSecondary = {
  background: "transparent",
  color: "var(--text-secondary)",
  border: "1px solid var(--border-strong)",
  padding: "9px 16px",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 12,
  fontFamily: "inherit",
};
const btnPrimary = (l) => ({
  background: "var(--accent-primary)",
  color: "#fff",
  border: "none",
  padding: "9px 18px",
  borderRadius: 6,
  cursor: l ? "not-allowed" : "pointer",
  fontSize: 12,
  fontWeight: 600,
  fontFamily: "inherit",
});
