import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, AlertTriangle } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import { createWhtConfig, updateWhtConfig } from "../../engine";

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

// Backend rates are basis points 0..10000 (10000 = 100.00%). UI speaks
// percent with up to 2 decimal places.
function percentToBps(input) {
  if (input === "" || input == null) return null;
  const n = Number(input);
  if (!Number.isFinite(n)) return NaN;
  const bps = Math.round(n * 100);
  return bps;
}
function bpsToPercent(bps) {
  if (bps == null) return "";
  return (bps / 100).toString();
}

function isValidPercent(s) {
  if (s === "" || s == null) return true;
  if (!/^\d+(?:\.\d{1,2})?$/.test(String(s).trim())) return false;
  const n = Number(s);
  return n >= 0 && n <= 100;
}

function isValidDecimal(value) {
  if (value === "" || value == null) return true;
  if (typeof value !== "string") value = String(value ?? "");
  return /^\d+(?:\.\d{1,3})?$/.test(value.trim());
}

export default function WhtConfigModal({ open, mode, config, onClose, onSaved }) {
  const { t } = useTranslation("setup");
  useEscapeKey(onClose, open);
  const isEdit = mode === "edit";

  const [rateService, setRateService] = useState("");
  const [rateProfessional, setRateProfessional] = useState("");
  const [rateRental, setRateRental] = useState("");
  const [rateInterest, setRateInterest] = useState("");
  const [rateCustom, setRateCustom] = useState("");
  const [minThreshold, setMinThreshold] = useState("");
  const [activeFrom, setActiveFrom] = useState(today());
  const [activeUntil, setActiveUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [submitError, setSubmitError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (isEdit && config) {
      setRateService(bpsToPercent(config.rateServicePercent));
      setRateProfessional(bpsToPercent(config.rateProfessionalPercent));
      setRateRental(bpsToPercent(config.rateRentalPercent));
      setRateInterest(bpsToPercent(config.rateInterestPercent));
      setRateCustom(bpsToPercent(config.rateCustomPercent));
      setMinThreshold(config.minThresholdKwd || "");
      setActiveFrom(config.activeFrom || today());
      setActiveUntil(config.activeUntil || "");
      setNotes(config.notes || "");
    } else {
      setRateService("");
      setRateProfessional("");
      setRateRental("");
      setRateInterest("");
      setRateCustom("");
      setMinThreshold("");
      setActiveFrom(today());
      setActiveUntil("");
      setNotes("");
    }
    setSubmitError(null);
  }, [open, isEdit, config]);

  if (!open) return null;

  const handleSave = async () => {
    setSubmitError(null);
    const rates = [rateService, rateProfessional, rateRental, rateInterest, rateCustom];
    for (const r of rates) {
      if (!isValidPercent(r)) {
        setSubmitError(t("wht_modal.error_rate_format"));
        return;
      }
    }
    if (!isValidDecimal(minThreshold)) {
      setSubmitError(t("wht_modal.error_threshold_format"));
      return;
    }
    if (!activeFrom) {
      setSubmitError(t("wht_modal.error_active_from_required"));
      return;
    }
    if (activeUntil && activeUntil <= activeFrom) {
      setSubmitError(t("wht_modal.error_active_until_after_from"));
      return;
    }
    if (!isEdit) {
      const allEmpty = rates.every((r) => r === "" || r == null);
      if (allEmpty) {
        setSubmitError(t("wht_modal.error_at_least_one_rate"));
        return;
      }
    }

    setSaving(true);
    try {
      if (isEdit) {
        const patch = {
          notes: notes.trim() || null,
          activeUntil: activeUntil || null,
        };
        await updateWhtConfig(config.id, patch);
      } else {
        const payload = {
          rateServicePercent: rateService === "" ? null : percentToBps(rateService),
          rateProfessionalPercent:
            rateProfessional === "" ? null : percentToBps(rateProfessional),
          rateRentalPercent: rateRental === "" ? null : percentToBps(rateRental),
          rateInterestPercent:
            rateInterest === "" ? null : percentToBps(rateInterest),
          rateCustomPercent: rateCustom === "" ? null : percentToBps(rateCustom),
          minThresholdKwd: minThreshold.trim() || undefined,
          activeFrom,
          activeUntil: activeUntil || null,
          notes: notes.trim() || null,
        };
        await createWhtConfig(payload);
      }
      if (onSaved) onSaved();
      if (onClose) onClose();
    } catch (err) {
      setSubmitError(err?.message || t("wht_modal.error_generic"));
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
              {isEdit ? t("wht_modal.edit_label") : t("wht_modal.add_label")}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22,
                color: "var(--text-primary)",
                marginTop: 2,
              }}
            >
              {isEdit ? t("wht_modal.edit_title") : t("wht_modal.add_title")}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("wht_modal.close")}
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

          {isEdit && (
            <div
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                fontStyle: "italic",
                padding: "10px 12px",
                background: "var(--bg-surface-sunken)",
                borderRadius: 8,
                border: "1px solid var(--border-default)",
              }}
            >
              {t("wht_modal.rates_immutable_note")}
            </div>
          )}

          {!isEdit && (
            <>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.15em",
                  color: "var(--text-tertiary)",
                  marginTop: 4,
                  marginBottom: -4,
                }}
              >
                {t("wht_modal.rates_heading")}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <RateField
                    label={t("wht_modal.field_rate_service")}
                    value={rateService}
                    onChange={setRateService}
                    hint={t("wht_modal.rate_hint_service")}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <RateField
                    label={t("wht_modal.field_rate_professional")}
                    value={rateProfessional}
                    onChange={setRateProfessional}
                    hint={t("wht_modal.rate_hint_professional")}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <RateField
                    label={t("wht_modal.field_rate_rental")}
                    value={rateRental}
                    onChange={setRateRental}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <RateField
                    label={t("wht_modal.field_rate_interest")}
                    value={rateInterest}
                    onChange={setRateInterest}
                  />
                </div>
              </div>
              <RateField
                label={t("wht_modal.field_rate_custom")}
                value={rateCustom}
                onChange={setRateCustom}
              />
              <Field label={t("wht_modal.field_min_threshold")}>
                <input
                  type="text"
                  inputMode="decimal"
                  value={minThreshold}
                  onChange={(e) => setMinThreshold(e.target.value)}
                  placeholder="0.000"
                  style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }}
                />
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--text-tertiary)",
                    marginTop: 4,
                  }}
                >
                  {t("wht_modal.threshold_hint")}
                </div>
              </Field>
            </>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Field label={t("wht_modal.field_active_from")}>
                <input
                  type="date"
                  value={activeFrom}
                  onChange={(e) => setActiveFrom(e.target.value)}
                  disabled={isEdit}
                  style={{ ...inputStyle, opacity: isEdit ? 0.6 : 1 }}
                />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label={t("wht_modal.field_active_until")}>
                <input
                  type="date"
                  value={activeUntil}
                  onChange={(e) => setActiveUntil(e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </div>
          </div>

          <Field label={t("wht_modal.field_notes")}>
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
            {t("wht_modal.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={btnPrimary(saving)}
          >
            {saving ? (
              <>
                <Spinner size={13} />
                &nbsp;{t("wht_modal.saving")}
              </>
            ) : (
              t("wht_modal.save")
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

function RateField({ label, value, onChange, hint }) {
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
      <div style={{ position: "relative" }}>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          style={{
            ...inputStyle,
            fontFamily: "'DM Mono', monospace",
            paddingInlineEnd: 28,
          }}
        />
        <span
          style={{
            position: "absolute",
            insetInlineEnd: 10,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-tertiary)",
            fontSize: 12,
            fontFamily: "'DM Mono', monospace",
            pointerEvents: "none",
          }}
        >
          %
        </span>
      </div>
      {hint && (
        <div
          style={{
            fontSize: 11,
            color: "var(--text-tertiary)",
            marginTop: 4,
          }}
        >
          {hint}
        </div>
      )}
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
