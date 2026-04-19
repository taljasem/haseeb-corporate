import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, AlertTriangle } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import { recordTaxLodgement } from "../../engine";

const LODGEMENT_TYPES = ["CIT", "WHT", "VAT", "KFAS", "NLST", "ZAKAT", "OTHER"];

// Canonical AccountRole hints for the most common tax-payable tie-out
// targets. The input is still a free-text string per the backend schema,
// but the datalist gives the caller a nudge toward the values the
// four-levy / AP pipeline writes against.
const ROLE_SUGGESTIONS = [
  "CIT_PAYABLE",
  "WHT_PAYABLE",
  "VAT_PAYABLE",
  "KFAS_PAYABLE",
  "NLST_PAYABLE",
  "ZAKAT_PAYABLE",
];

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

function isValidDecimal(value) {
  if (typeof value !== "string") value = String(value ?? "");
  return /^\d+(?:\.\d{1,3})?$/.test(value.trim());
}

export default function TaxLodgementModal({ open, onClose, onSaved }) {
  const { t } = useTranslation("setup");
  useEscapeKey(onClose, open);

  const [lodgementType, setLodgementType] = useState("CIT");
  const [filingReference, setFilingReference] = useState("");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [filedOnDate, setFiledOnDate] = useState(today());
  const [filedAmount, setFiledAmount] = useState("");
  const [glAccountRole, setGlAccountRole] = useState("CIT_PAYABLE");
  const [notes, setNotes] = useState("");
  const [submitError, setSubmitError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLodgementType("CIT");
    setFilingReference("");
    setPeriodFrom("");
    setPeriodTo("");
    setFiledOnDate(today());
    setFiledAmount("");
    setGlAccountRole("CIT_PAYABLE");
    setNotes("");
    setSubmitError(null);
  }, [open]);

  // When the user picks a lodgement type, suggest the matching payable
  // role. The field stays editable — this is a pure convenience nudge.
  useEffect(() => {
    if (!open) return;
    const suggestion = `${lodgementType}_PAYABLE`;
    if (ROLE_SUGGESTIONS.includes(suggestion)) {
      setGlAccountRole(suggestion);
    } else {
      setGlAccountRole("");
    }
  }, [lodgementType, open]);

  if (!open) return null;

  const handleSave = async () => {
    setSubmitError(null);
    if (!filingReference.trim()) {
      setSubmitError(t("tax_lodgement_modal.error_reference_required"));
      return;
    }
    if (!periodFrom || !periodTo) {
      setSubmitError(t("tax_lodgement_modal.error_period_required"));
      return;
    }
    if (periodTo < periodFrom) {
      setSubmitError(t("tax_lodgement_modal.error_period_order"));
      return;
    }
    if (!filedOnDate) {
      setSubmitError(t("tax_lodgement_modal.error_filed_on_required"));
      return;
    }
    if (!isValidDecimal(filedAmount)) {
      setSubmitError(t("tax_lodgement_modal.error_amount_format"));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        lodgementType,
        filingReference: filingReference.trim(),
        periodFrom,
        periodTo,
        filedOnDate,
        filedAmountKwd: String(filedAmount).trim(),
        glAccountRole: glAccountRole.trim() || null,
        notes: notes.trim() || null,
      };
      await recordTaxLodgement(payload);
      if (onSaved) onSaved();
      if (onClose) onClose();
    } catch (err) {
      setSubmitError(err?.message || t("tax_lodgement_modal.error_generic"));
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
          width: 560,
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
              {t("tax_lodgement_modal.add_label")}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22,
                color: "var(--text-primary)",
                marginTop: 2,
              }}
            >
              {t("tax_lodgement_modal.add_title")}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("tax_lodgement_modal.close")}
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

          <Field label={t("tax_lodgement_modal.field_type")}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {LODGEMENT_TYPES.map((tp) => {
                const on = lodgementType === tp;
                return (
                  <button
                    key={tp}
                    onClick={() => setLodgementType(tp)}
                    style={{
                      padding: "7px 14px",
                      borderRadius: 14,
                      background: on
                        ? "var(--accent-primary-subtle)"
                        : "var(--bg-surface-sunken)",
                      border: on
                        ? "1px solid rgba(0,196,140,0.30)"
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
                    {t(`tax_lodgement.type_${tp}`)}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label={t("tax_lodgement_modal.field_filing_reference")}>
            <input
              value={filingReference}
              onChange={(e) => setFilingReference(e.target.value)}
              maxLength={200}
              placeholder={t(
                "tax_lodgement_modal.filing_reference_placeholder",
              )}
              style={inputStyle}
            />
          </Field>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Field label={t("tax_lodgement_modal.field_period_from")}>
                <input
                  type="date"
                  value={periodFrom}
                  onChange={(e) => setPeriodFrom(e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label={t("tax_lodgement_modal.field_period_to")}>
                <input
                  type="date"
                  value={periodTo}
                  onChange={(e) => setPeriodTo(e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Field label={t("tax_lodgement_modal.field_filed_on")}>
                <input
                  type="date"
                  value={filedOnDate}
                  onChange={(e) => setFiledOnDate(e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label={t("tax_lodgement_modal.field_filed_amount")}>
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

          <Field label={t("tax_lodgement_modal.field_gl_account_role")}>
            <input
              value={glAccountRole}
              onChange={(e) => setGlAccountRole(e.target.value)}
              list="gl-role-suggestions"
              maxLength={120}
              placeholder={t("tax_lodgement_modal.gl_role_placeholder")}
              style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }}
            />
            <datalist id="gl-role-suggestions">
              {ROLE_SUGGESTIONS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                marginTop: 6,
              }}
            >
              {t("tax_lodgement_modal.gl_role_hint")}
            </div>
          </Field>

          <Field label={t("tax_lodgement_modal.field_notes")}>
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
            {t("tax_lodgement_modal.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={btnPrimary(saving)}
          >
            {saving ? (
              <>
                <Spinner size={13} />
                &nbsp;{t("tax_lodgement_modal.saving")}
              </>
            ) : (
              t("tax_lodgement_modal.save")
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
