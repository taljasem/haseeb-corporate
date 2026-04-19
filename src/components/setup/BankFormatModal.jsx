import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, AlertTriangle } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import { createBankFormat, updateBankFormat } from "../../engine";

const FORMAT_TYPES = ["CSV", "OFX", "MT940", "CAMT053", "QIF", "CUSTOM"];

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

function prettyJson(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return "{}";
  }
}

export default function BankFormatModal({ open, mode, spec, onClose, onSaved }) {
  const { t } = useTranslation("setup");
  useEscapeKey(onClose, open);
  const isEdit = mode === "edit";

  const [bankCode, setBankCode] = useState("");
  const [formatVersion, setFormatVersion] = useState("v1");
  const [formatType, setFormatType] = useState("CSV");
  const [specText, setSpecText] = useState("{\n  \n}");
  const [effectiveFrom, setEffectiveFrom] = useState(today());
  const [effectiveUntil, setEffectiveUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [submitError, setSubmitError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (isEdit && spec) {
      setBankCode(spec.bankCode || "");
      setFormatVersion(spec.formatVersion || "v1");
      setFormatType(spec.formatType || "CSV");
      setSpecText(prettyJson(spec.spec || {}));
      setEffectiveFrom(spec.effectiveFrom || today());
      setEffectiveUntil(spec.effectiveUntil || "");
      setNotes(spec.notes || "");
    } else {
      setBankCode("");
      setFormatVersion("v1");
      setFormatType("CSV");
      setSpecText("{\n  \n}");
      setEffectiveFrom(today());
      setEffectiveUntil("");
      setNotes("");
    }
    setSubmitError(null);
  }, [open, isEdit, spec]);

  if (!open) return null;

  const handleSave = async () => {
    setSubmitError(null);
    if (!isEdit) {
      if (!bankCode.trim()) {
        setSubmitError(t("bank_format_modal.error_bank_code_required"));
        return;
      }
      if (!formatVersion.trim()) {
        setSubmitError(t("bank_format_modal.error_version_required"));
        return;
      }
      let parsedSpec;
      try {
        parsedSpec = JSON.parse(specText);
      } catch {
        setSubmitError(t("bank_format_modal.error_spec_invalid_json"));
        return;
      }
      if (!parsedSpec || typeof parsedSpec !== "object" || Array.isArray(parsedSpec)) {
        setSubmitError(t("bank_format_modal.error_spec_not_object"));
        return;
      }
      if (!effectiveFrom) {
        setSubmitError(t("bank_format_modal.error_effective_from_required"));
        return;
      }
      if (effectiveUntil && effectiveUntil <= effectiveFrom) {
        setSubmitError(t("bank_format_modal.error_until_after_from"));
        return;
      }

      setSaving(true);
      try {
        await createBankFormat({
          bankCode: bankCode.trim(),
          formatVersion: formatVersion.trim(),
          formatType,
          spec: parsedSpec,
          effectiveFrom,
          effectiveUntil: effectiveUntil || null,
          notes: notes.trim() || null,
        });
        if (onSaved) onSaved();
        if (onClose) onClose();
      } catch (err) {
        setSubmitError(err?.message || t("bank_format_modal.error_generic"));
      } finally {
        setSaving(false);
      }
    } else {
      // Edit: only effectiveUntil + notes allowed.
      if (effectiveUntil && effectiveUntil <= effectiveFrom) {
        setSubmitError(t("bank_format_modal.error_until_after_from"));
        return;
      }
      setSaving(true);
      try {
        await updateBankFormat(spec.id, {
          effectiveUntil: effectiveUntil || null,
          notes: notes.trim() || null,
        });
        if (onSaved) onSaved();
        if (onClose) onClose();
      } catch (err) {
        setSubmitError(err?.message || t("bank_format_modal.error_generic"));
      } finally {
        setSaving(false);
      }
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
              {isEdit
                ? t("bank_format_modal.edit_label")
                : t("bank_format_modal.add_label")}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22,
                color: "var(--text-primary)",
                marginTop: 2,
              }}
            >
              {isEdit
                ? t("bank_format_modal.edit_title")
                : t("bank_format_modal.add_title")}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("bank_format_modal.close")}
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
              {t("bank_format_modal.spec_immutable_note")}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Field label={t("bank_format_modal.field_bank_code")}>
                <input
                  value={bankCode}
                  onChange={(e) => setBankCode(e.target.value)}
                  maxLength={50}
                  disabled={isEdit}
                  placeholder={t("bank_format_modal.bank_code_placeholder")}
                  style={{
                    ...inputStyle,
                    fontFamily: "'DM Mono', monospace",
                    opacity: isEdit ? 0.6 : 1,
                  }}
                />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label={t("bank_format_modal.field_format_version")}>
                <input
                  value={formatVersion}
                  onChange={(e) => setFormatVersion(e.target.value)}
                  maxLength={50}
                  disabled={isEdit}
                  placeholder="v1"
                  style={{
                    ...inputStyle,
                    fontFamily: "'DM Mono', monospace",
                    opacity: isEdit ? 0.6 : 1,
                  }}
                />
              </Field>
            </div>
          </div>

          <Field label={t("bank_format_modal.field_format_type")}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {FORMAT_TYPES.map((ft) => {
                const on = formatType === ft;
                return (
                  <button
                    key={ft}
                    onClick={() => !isEdit && setFormatType(ft)}
                    disabled={isEdit}
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
                      cursor: isEdit ? "not-allowed" : "pointer",
                      fontFamily: "inherit",
                      opacity: isEdit && !on ? 0.5 : 1,
                    }}
                  >
                    {ft}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label={t("bank_format_modal.field_spec")}>
            <textarea
              value={specText}
              onChange={(e) => setSpecText(e.target.value)}
              rows={8}
              disabled={isEdit}
              placeholder='{\n  "columns": {"date": 0, "amount": 2}\n}'
              style={{
                ...inputStyle,
                fontFamily: "'DM Mono', monospace",
                fontSize: 12,
                resize: "vertical",
                opacity: isEdit ? 0.6 : 1,
              }}
              dir="ltr"
            />
            <div
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                marginTop: 4,
              }}
            >
              {t("bank_format_modal.spec_hint")}
            </div>
          </Field>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Field label={t("bank_format_modal.field_effective_from")}>
                <input
                  type="date"
                  value={effectiveFrom}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  disabled={isEdit}
                  style={{ ...inputStyle, opacity: isEdit ? 0.6 : 1 }}
                />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label={t("bank_format_modal.field_effective_until")}>
                <input
                  type="date"
                  value={effectiveUntil}
                  onChange={(e) => setEffectiveUntil(e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </div>
          </div>

          <Field label={t("bank_format_modal.field_notes")}>
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
            {t("bank_format_modal.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={btnPrimary(saving)}
          >
            {saving ? (
              <>
                <Spinner size={13} />
                &nbsp;{t("bank_format_modal.saving")}
              </>
            ) : (
              t("bank_format_modal.save")
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
