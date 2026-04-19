import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, AlertTriangle } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import { upsertCbkRate } from "../../engine";

// Common Kuwait-tenant currencies as dropdown suggestions. Freeform
// 3-letter code input supported (any ISO 4217).
const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "AED", "SAR", "JPY", "CNY", "INR"];

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

function isValidDecimal8(v) {
  if (v === "" || v == null) return false;
  if (typeof v !== "string") v = String(v ?? "");
  return /^\d+(?:\.\d{1,8})?$/.test(v.trim());
}

function isValidCurrency(v) {
  return /^[A-Z]{3}$/.test(String(v ?? "").trim());
}

export default function CbkRateModal({ open, onClose, onSaved, prefill }) {
  const { t } = useTranslation("setup");
  useEscapeKey(onClose, open);

  const [currency, setCurrency] = useState("USD");
  const [rateDate, setRateDate] = useState(today());
  const [rateKwd, setRateKwd] = useState("");
  const [source, setSource] = useState("MANUAL");
  const [notes, setNotes] = useState("");
  const [submitError, setSubmitError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCurrency((prefill?.currency || "USD").toUpperCase());
    setRateDate(prefill?.rateDate || today());
    setRateKwd(prefill?.rateKwd || "");
    setSource("MANUAL");
    setNotes(prefill?.notes || "");
    setSubmitError(null);
  }, [open, prefill]);

  if (!open) return null;

  const handleSave = async () => {
    setSubmitError(null);
    const cur = currency.trim().toUpperCase();
    if (!isValidCurrency(cur)) {
      setSubmitError(t("cbk_modal.error_currency_format"));
      return;
    }
    if (!rateDate) {
      setSubmitError(t("cbk_modal.error_date_required"));
      return;
    }
    if (!isValidDecimal8(rateKwd)) {
      setSubmitError(t("cbk_modal.error_rate_format"));
      return;
    }
    if (Number(rateKwd) <= 0) {
      setSubmitError(t("cbk_modal.error_rate_positive"));
      return;
    }
    setSaving(true);
    try {
      await upsertCbkRate({
        currency: cur,
        rateDate,
        rateKwd: String(rateKwd).trim(),
        source: "MANUAL",
        notes: notes.trim() || null,
      });
      if (onSaved) onSaved();
      if (onClose) onClose();
    } catch (err) {
      setSubmitError(err?.message || t("cbk_modal.error_generic"));
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
          width: 500,
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
              {t("cbk_modal.label")}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22,
                color: "var(--text-primary)",
                marginTop: 2,
              }}
            >
              {t("cbk_modal.title")}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("cbk_modal.close")}
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
            {t("cbk_modal.upsert_hint")}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Field label={t("cbk_modal.field_currency")}>
                <input
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  list="cbk-currency-suggestions"
                  maxLength={3}
                  style={{
                    ...inputStyle,
                    fontFamily: "'DM Mono', monospace",
                    textTransform: "uppercase",
                  }}
                />
                <datalist id="cbk-currency-suggestions">
                  {COMMON_CURRENCIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label={t("cbk_modal.field_rate_date")}>
                <input
                  type="date"
                  value={rateDate}
                  onChange={(e) => setRateDate(e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </div>
          </div>

          <Field label={t("cbk_modal.field_rate_kwd")}>
            <input
              type="text"
              inputMode="decimal"
              value={rateKwd}
              onChange={(e) => setRateKwd(e.target.value)}
              placeholder="0.30600"
              style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }}
            />
            <div
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                marginTop: 4,
              }}
            >
              {t("cbk_modal.rate_hint")}
            </div>
          </Field>

          <Field label={t("cbk_modal.field_source")}>
            <div
              style={{
                ...inputStyle,
                background: "var(--bg-surface)",
                color: "var(--text-secondary)",
                opacity: 0.85,
              }}
            >
              {t("cbk_modal.source_manual_readonly")}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                marginTop: 4,
              }}
            >
              {t("cbk_modal.source_hint")}
            </div>
          </Field>

          <Field label={t("cbk_modal.field_notes")}>
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
            {t("cbk_modal.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={btnPrimary(saving)}
          >
            {saving ? (
              <>
                <Spinner size={13} />
                &nbsp;{t("cbk_modal.saving")}
              </>
            ) : (
              t("cbk_modal.save")
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
