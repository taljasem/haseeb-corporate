import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, AlertTriangle } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import { createBulkReclassification } from "../../engine";

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

export default function BulkReclassProposalModal({
  open,
  accounts,
  onClose,
  onSaved,
}) {
  const { t } = useTranslation("bulk-reclass");
  useEscapeKey(onClose, open);

  const [description, setDescription] = useState("");
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [descriptionContains, setDescriptionContains] = useState("");
  const [notes, setNotes] = useState("");
  const [submitError, setSubmitError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDescription("");
    setFromAccountId("");
    setToAccountId("");
    setDateFrom("");
    setDateTo("");
    setDescriptionContains("");
    setNotes("");
    setSubmitError(null);
  }, [open]);

  if (!open) return null;

  const handleSave = async () => {
    setSubmitError(null);
    if (!description.trim()) {
      setSubmitError(t("proposal_modal.error_description_required"));
      return;
    }
    if (!fromAccountId) {
      setSubmitError(t("proposal_modal.error_from_required"));
      return;
    }
    if (!toAccountId) {
      setSubmitError(t("proposal_modal.error_to_required"));
      return;
    }
    if (fromAccountId === toAccountId) {
      setSubmitError(t("proposal_modal.error_same_account"));
      return;
    }
    if (dateFrom && dateTo && dateTo < dateFrom) {
      setSubmitError(t("proposal_modal.error_date_order"));
      return;
    }

    setSaving(true);
    try {
      await createBulkReclassification({
        description: description.trim(),
        fromAccountId,
        toAccountId,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        descriptionContains: descriptionContains.trim() || null,
        notes: notes.trim() || null,
      });
      if (onSaved) onSaved();
      if (onClose) onClose();
    } catch (err) {
      setSubmitError(err?.message || t("proposal_modal.error_generic"));
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
              {t("proposal_modal.label")}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22,
                color: "var(--text-primary)",
                marginTop: 2,
              }}
            >
              {t("proposal_modal.title")}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("proposal_modal.close")}
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
          <div
            style={{
              fontSize: 12,
              color: "var(--text-tertiary)",
              padding: "10px 12px",
              background: "var(--bg-surface-sunken)",
              border: "1px solid var(--border-default)",
              borderRadius: 8,
            }}
          >
            {t("proposal_modal.lifecycle_hint")}
          </div>

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

          <Field label={t("proposal_modal.field_description")}>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              placeholder={t("proposal_modal.description_placeholder")}
              style={inputStyle}
            />
          </Field>

          <Field label={t("proposal_modal.field_from_account")}>
            <select
              value={fromAccountId}
              onChange={(e) => setFromAccountId(e.target.value)}
              style={inputStyle}
            >
              <option value="">{t("proposal_modal.account_placeholder")}</option>
              {(accounts || []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.nameEn || a.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t("proposal_modal.field_to_account")}>
            <select
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
              style={inputStyle}
            >
              <option value="">{t("proposal_modal.account_placeholder")}</option>
              {(accounts || []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.nameEn || a.name}
                </option>
              ))}
            </select>
          </Field>

          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.15em",
              color: "var(--text-tertiary)",
              marginTop: 6,
            }}
          >
            {t("proposal_modal.filters_heading")}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Field label={t("proposal_modal.field_date_from")}>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label={t("proposal_modal.field_date_to")}>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </div>
          </div>

          <Field label={t("proposal_modal.field_description_contains")}>
            <input
              value={descriptionContains}
              onChange={(e) => setDescriptionContains(e.target.value)}
              maxLength={200}
              placeholder={t("proposal_modal.description_contains_placeholder")}
              style={inputStyle}
            />
            <div
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                marginTop: 4,
              }}
            >
              {t("proposal_modal.description_contains_hint")}
            </div>
          </Field>

          <Field label={t("proposal_modal.field_notes")}>
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
            {t("proposal_modal.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={btnPrimary(saving)}
          >
            {saving ? (
              <>
                <Spinner size={13} />
                &nbsp;{t("proposal_modal.saving")}
              </>
            ) : (
              t("proposal_modal.save")
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
