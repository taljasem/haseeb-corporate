import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, AlertTriangle } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import { addSpinoffTransfer } from "../../engine";

const CLASSIFICATIONS = ["ASSET", "LIABILITY", "EQUITY"];

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

function isValidDecimal(v) {
  if (v === "" || v == null) return false;
  if (typeof v !== "string") v = String(v ?? "");
  return /^\d+(?:\.\d{1,3})?$/.test(v.trim());
}

export default function SpinoffTransferModal({
  open,
  eventId,
  accounts,
  onClose,
  onSaved,
}) {
  const { t } = useTranslation("spinoff");
  useEscapeKey(onClose, open);

  const [sourceAccountId, setSourceAccountId] = useState("");
  const [amountKwd, setAmountKwd] = useState("");
  const [classification, setClassification] = useState("ASSET");
  const [notes, setNotes] = useState("");
  const [submitError, setSubmitError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSourceAccountId("");
    setAmountKwd("");
    setClassification("ASSET");
    setNotes("");
    setSubmitError(null);
  }, [open]);

  if (!open) return null;

  const handleSave = async () => {
    setSubmitError(null);
    if (!sourceAccountId) {
      setSubmitError(t("transfer_modal.error_account_required"));
      return;
    }
    if (!isValidDecimal(amountKwd)) {
      setSubmitError(t("transfer_modal.error_amount_format"));
      return;
    }
    if (Number(amountKwd) <= 0) {
      setSubmitError(t("transfer_modal.error_amount_positive"));
      return;
    }

    setSaving(true);
    try {
      await addSpinoffTransfer(eventId, {
        sourceAccountId,
        amountKwd: String(amountKwd).trim(),
        classification,
        notes: notes.trim() || null,
      });
      if (onSaved) onSaved();
      if (onClose) onClose();
    } catch (err) {
      setSubmitError(err?.message || t("transfer_modal.error_generic"));
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
          width: 520,
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
              {t("transfer_modal.label")}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22,
                color: "var(--text-primary)",
                marginTop: 2,
              }}
            >
              {t("transfer_modal.title")}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("transfer_modal.close")}
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

          <Field label={t("transfer_modal.field_classification")}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {CLASSIFICATIONS.map((c) => {
                const on = classification === c;
                return (
                  <button
                    key={c}
                    onClick={() => setClassification(c)}
                    style={{
                      padding: "7px 14px",
                      borderRadius: 14,
                      background: on
                        ? "var(--accent-primary-subtle)"
                        : "var(--bg-surface-sunken)",
                      border: on
                        ? "1px solid var(--accent-primary-border)"
                        : "1px solid var(--border-default)",
                      color: on
                        ? "var(--accent-primary)"
                        : "var(--text-secondary)",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {t(`transfer_modal.class_${c}`)}
                  </button>
                );
              })}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                marginTop: 6,
              }}
            >
              {t("transfer_modal.classification_hint")}
            </div>
          </Field>

          <Field label={t("transfer_modal.field_source_account")}>
            <select
              value={sourceAccountId}
              onChange={(e) => setSourceAccountId(e.target.value)}
              style={inputStyle}
            >
              <option value="">
                {t("transfer_modal.source_placeholder")}
              </option>
              {(accounts || []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.nameEn || a.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t("transfer_modal.field_amount")}>
            <input
              type="text"
              inputMode="decimal"
              value={amountKwd}
              onChange={(e) => setAmountKwd(e.target.value)}
              placeholder="0.000"
              style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }}
            />
          </Field>

          <Field label={t("transfer_modal.field_notes")}>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={2000}
              style={{ ...inputStyle, resize: "vertical" }}
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
            {t("transfer_modal.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={btnPrimary(saving)}
          >
            {saving ? (
              <>
                <Spinner size={13} />
                &nbsp;{t("transfer_modal.saving")}
              </>
            ) : (
              t("transfer_modal.save")
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
