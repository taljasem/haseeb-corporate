import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, AlertTriangle } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import { createCitAssessment } from "../../engine";

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

function defaultFiscalYear() {
  return new Date().getFullYear() - 1;
}

function isValidDecimal(value) {
  if (typeof value !== "string") value = String(value ?? "");
  return /^-?\d+(?:\.\d{1,3})?$/.test(value.trim());
}

export default function CitAssessmentCreateModal({ open, onClose, onSaved }) {
  const { t } = useTranslation("setup");
  useEscapeKey(onClose, open);

  const [fiscalYear, setFiscalYear] = useState(defaultFiscalYear());
  const [filedAmount, setFiledAmount] = useState("");
  const [filedOnDate, setFiledOnDate] = useState(today());
  const [authorityCaseNumber, setAuthorityCaseNumber] = useState("");
  const [statuteExpiresOn, setStatuteExpiresOn] = useState("");
  const [notes, setNotes] = useState("");
  const [submitError, setSubmitError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFiscalYear(defaultFiscalYear());
    setFiledAmount("");
    setFiledOnDate(today());
    setAuthorityCaseNumber("");
    setStatuteExpiresOn("");
    setNotes("");
    setSubmitError(null);
  }, [open]);

  if (!open) return null;

  const handleSave = async () => {
    setSubmitError(null);
    const fy = Number(fiscalYear);
    if (!Number.isInteger(fy) || fy < 2000 || fy > 2100) {
      setSubmitError(t("cit_assessment_modal.error_fiscal_year_range"));
      return;
    }
    if (!isValidDecimal(filedAmount)) {
      setSubmitError(t("cit_assessment_modal.error_amount_format"));
      return;
    }
    if (!filedOnDate) {
      setSubmitError(t("cit_assessment_modal.error_filed_on_required"));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        fiscalYear: fy,
        filedAmountKwd: String(filedAmount).trim(),
        filedOnDate,
        authorityCaseNumber: authorityCaseNumber.trim() || null,
        statuteExpiresOn: statuteExpiresOn || undefined,
        notes: notes.trim() || null,
      };
      await createCitAssessment(payload);
      if (onSaved) onSaved();
      if (onClose) onClose();
    } catch (err) {
      setSubmitError(err?.message || t("cit_assessment_modal.error_generic"));
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
          width: 540,
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
              {t("cit_assessment_modal.create_label")}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22,
                color: "var(--text-primary)",
                marginTop: 2,
              }}
            >
              {t("cit_assessment_modal.create_title")}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("cit_assessment_modal.close")}
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

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Field label={t("cit_assessment_modal.field_fiscal_year")}>
                <input
                  type="number"
                  min={2000}
                  max={2100}
                  step={1}
                  value={fiscalYear}
                  onChange={(e) => setFiscalYear(e.target.value)}
                  style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }}
                />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label={t("cit_assessment_modal.field_filed_amount")}>
                <input
                  type="text"
                  inputMode="decimal"
                  value={filedAmount}
                  onChange={(e) => setFiledAmount(e.target.value)}
                  placeholder="0.000"
                  style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }}
                />
              </Field>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Field label={t("cit_assessment_modal.field_filed_on")}>
                <input
                  type="date"
                  value={filedOnDate}
                  onChange={(e) => setFiledOnDate(e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field
                label={t("cit_assessment_modal.field_statute_expires_on")}
              >
                <input
                  type="date"
                  value={statuteExpiresOn}
                  onChange={(e) => setStatuteExpiresOn(e.target.value)}
                  style={inputStyle}
                />
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-tertiary)",
                    marginTop: 4,
                  }}
                >
                  {t("cit_assessment_modal.statute_hint")}
                </div>
              </Field>
            </div>
          </div>

          <Field label={t("cit_assessment_modal.field_authority_case_number")}>
            <input
              value={authorityCaseNumber}
              onChange={(e) => setAuthorityCaseNumber(e.target.value)}
              maxLength={200}
              placeholder={t(
                "cit_assessment_modal.authority_case_placeholder",
              )}
              style={inputStyle}
            />
          </Field>

          <Field label={t("cit_assessment_modal.field_notes")}>
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
            {t("cit_assessment_modal.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={btnPrimary(saving)}
          >
            {saving ? (
              <>
                <Spinner size={13} />
                &nbsp;{t("cit_assessment_modal.saving")}
              </>
            ) : (
              t("cit_assessment_modal.save")
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
