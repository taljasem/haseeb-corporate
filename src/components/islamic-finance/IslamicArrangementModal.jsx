import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, AlertTriangle } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import { createIslamicArrangement } from "../../engine";

const TYPES = ["MURABAHA", "IJARA", "MUDARABA", "MUSHARAKA", "WAKALA", "SUKUK", "CUSTOM"];
const DIRECTIONS = ["FINANCING_RECEIVED", "INVESTMENT_MADE"];
const METHODS = ["FLAT", "DIMINISHING", "STEPPED", "OTHER"];

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
function addYears(iso, years) {
  const d = new Date(iso);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

function isValidDecimal(v) {
  if (v === "" || v == null) return false;
  return /^\d+(?:\.\d{1,3})?$/.test(String(v).trim());
}
function isValidPercent(v) {
  if (v === "" || v == null) return false;
  return /^\d+(?:\.\d{1,2})?$/.test(String(v).trim());
}

export default function IslamicArrangementModal({ open, onClose, onSaved }) {
  const { t } = useTranslation("islamic-finance");
  useEscapeKey(onClose, open);

  const [arrangementNumber, setArrangementNumber] = useState("");
  const [arrangementType, setArrangementType] = useState("MURABAHA");
  const [sourceTermLabel, setSourceTermLabel] = useState("");
  const [counterpartyBank, setCounterpartyBank] = useState("");
  const [counterpartyReference, setCounterpartyReference] = useState("");
  const [direction, setDirection] = useState("FINANCING_RECEIVED");
  const [originalFacilityAmountKwd, setOriginalFacilityAmountKwd] = useState("");
  const [profitRatePercentUi, setProfitRatePercentUi] = useState("");
  const [profitComputationMethod, setProfitComputationMethod] = useState("DIMINISHING");
  const [contractDate, setContractDate] = useState(today());
  const [maturityDate, setMaturityDate] = useState(addYears(today(), 1));
  const [installmentCount, setInstallmentCount] = useState("12");
  const [notes, setNotes] = useState("");
  const [submitError, setSubmitError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setArrangementNumber("");
    setArrangementType("MURABAHA");
    setSourceTermLabel("");
    setCounterpartyBank("");
    setCounterpartyReference("");
    setDirection("FINANCING_RECEIVED");
    setOriginalFacilityAmountKwd("");
    setProfitRatePercentUi("");
    setProfitComputationMethod("DIMINISHING");
    setContractDate(today());
    setMaturityDate(addYears(today(), 1));
    setInstallmentCount("12");
    setNotes("");
    setSubmitError(null);
  }, [open]);

  if (!open) return null;

  const handleSave = async () => {
    setSubmitError(null);
    if (!arrangementNumber.trim()) {
      setSubmitError(t("modal.error_number_required"));
      return;
    }
    if (!sourceTermLabel.trim()) {
      setSubmitError(t("modal.error_source_term_required"));
      return;
    }
    if (!counterpartyBank.trim()) {
      setSubmitError(t("modal.error_counterparty_required"));
      return;
    }
    if (!isValidDecimal(originalFacilityAmountKwd) || Number(originalFacilityAmountKwd) <= 0) {
      setSubmitError(t("modal.error_facility_amount"));
      return;
    }
    if (!isValidPercent(profitRatePercentUi) || Number(profitRatePercentUi) < 0 || Number(profitRatePercentUi) > 100) {
      setSubmitError(t("modal.error_rate_format"));
      return;
    }
    const N = parseInt(installmentCount, 10);
    if (!Number.isInteger(N) || N <= 0 || N > 1000) {
      setSubmitError(t("modal.error_installments"));
      return;
    }
    if (new Date(maturityDate) <= new Date(contractDate)) {
      setSubmitError(t("modal.error_maturity_after_contract"));
      return;
    }

    setSaving(true);
    try {
      const profitRateBps = Math.round(Number(profitRatePercentUi) * 100);
      await createIslamicArrangement({
        arrangementNumber: arrangementNumber.trim(),
        arrangementType,
        sourceTermLabel: sourceTermLabel.trim(),
        counterpartyBank: counterpartyBank.trim(),
        counterpartyReference: counterpartyReference.trim() || null,
        direction,
        originalFacilityAmountKwd: String(originalFacilityAmountKwd).trim(),
        profitRatePercent: profitRateBps,
        profitComputationMethod,
        contractDate,
        maturityDate,
        installmentCount: N,
        notes: notes.trim() || null,
      });
      if (onSaved) onSaved();
      if (onClose) onClose();
    } catch (err) {
      setSubmitError(err?.message || t("modal.error_generic"));
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
          width: 620,
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
              {t("modal.label")}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22,
                color: "var(--text-primary)",
                marginTop: 2,
              }}
            >
              {t("modal.title")}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("modal.close")}
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
              fontSize: 11,
              color: "var(--text-tertiary)",
              padding: "10px 12px",
              background: "var(--bg-surface-sunken)",
              borderRadius: 8,
              border: "1px solid var(--border-default)",
            }}
          >
            {t("modal.hint")}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label={t("modal.field_number")}>
              <input
                value={arrangementNumber}
                onChange={(e) => setArrangementNumber(e.target.value)}
                maxLength={100}
                placeholder="e.g. IF-2026-0001"
                style={inputStyle}
              />
            </Field>
            <Field label={t("modal.field_counterparty_bank")}>
              <input
                value={counterpartyBank}
                onChange={(e) => setCounterpartyBank(e.target.value)}
                maxLength={200}
                placeholder="e.g. Kuwait Finance House"
                style={inputStyle}
              />
            </Field>
          </div>

          <Field label={t("modal.field_type")}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {TYPES.map((c) => {
                const on = arrangementType === c;
                return (
                  <button
                    key={c}
                    onClick={() => setArrangementType(c)}
                    style={pillStyle(on)}
                  >
                    {t(`type_${c}`)}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label={t("modal.field_source_term")}>
            <input
              value={sourceTermLabel}
              onChange={(e) => setSourceTermLabel(e.target.value)}
              maxLength={500}
              placeholder={t("modal.source_term_placeholder")}
              style={inputStyle}
            />
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 6 }}>
              {t("modal.source_term_hint")}
            </div>
          </Field>

          <Field label={t("modal.field_direction")}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {DIRECTIONS.map((c) => {
                const on = direction === c;
                return (
                  <button
                    key={c}
                    onClick={() => setDirection(c)}
                    style={pillStyle(on)}
                  >
                    {t(`direction_${c}`)}
                  </button>
                );
              })}
            </div>
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label={t("modal.field_facility_amount")}>
              <input
                type="text"
                inputMode="decimal"
                value={originalFacilityAmountKwd}
                onChange={(e) => setOriginalFacilityAmountKwd(e.target.value)}
                placeholder="0.000"
                style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }}
              />
            </Field>
            <Field label={t("modal.field_rate")}>
              <input
                type="text"
                inputMode="decimal"
                value={profitRatePercentUi}
                onChange={(e) => setProfitRatePercentUi(e.target.value)}
                placeholder="0.00"
                style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }}
              />
            </Field>
          </div>

          <Field label={t("modal.field_method")}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {METHODS.map((c) => {
                const on = profitComputationMethod === c;
                return (
                  <button
                    key={c}
                    onClick={() => setProfitComputationMethod(c)}
                    style={pillStyle(on)}
                  >
                    {t(`method_${c}`)}
                  </button>
                );
              })}
            </div>
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Field label={t("modal.field_contract_date")}>
              <input
                type="date"
                value={contractDate}
                onChange={(e) => setContractDate(e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label={t("modal.field_maturity_date")}>
              <input
                type="date"
                value={maturityDate}
                onChange={(e) => setMaturityDate(e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label={t("modal.field_installments")}>
              <input
                type="number"
                min={1}
                max={1000}
                value={installmentCount}
                onChange={(e) => setInstallmentCount(e.target.value)}
                style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }}
              />
            </Field>
          </div>

          <Field label={t("modal.field_counterparty_reference")}>
            <input
              value={counterpartyReference}
              onChange={(e) => setCounterpartyReference(e.target.value)}
              maxLength={200}
              placeholder={t("modal.counterparty_reference_placeholder")}
              style={inputStyle}
            />
          </Field>

          <Field label={t("modal.field_notes")}>
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
            {t("modal.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={btnPrimary(saving)}
          >
            {saving ? (
              <>
                <Spinner size={13} />
                &nbsp;{t("modal.saving")}
              </>
            ) : (
              t("modal.save")
            )}
          </button>
        </div>
      </div>
    </>
  );
}

function pillStyle(on) {
  return {
    padding: "7px 14px",
    borderRadius: 14,
    background: on ? "var(--accent-primary-subtle)" : "var(--bg-surface-sunken)",
    border: on
      ? "1px solid var(--accent-primary-border)"
      : "1px solid var(--border-default)",
    color: on ? "var(--accent-primary)" : "var(--text-secondary)",
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  };
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
