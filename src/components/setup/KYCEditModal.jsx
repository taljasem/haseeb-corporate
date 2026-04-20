/**
 * KYCEditModal — FN-272 Phase 4 KYC admin UI (2026-04-19).
 *
 * Single shared modal that handles both vendor + customer KYC editing
 * AND minimal create-with-KYC. The KYC field set is identical between
 * the two surfaces (crNumber, crExpiryDate, crIssuedAt, civilIdNumber,
 * kycNotes), and the conditional rendering is limited to the basic
 * fields shown in create mode + the title.
 *
 * Props:
 *   open         boolean           — overlay visibility
 *   mode         'create'|'edit'   — gates required-name-field + button label
 *   kind         'vendor'|'customer' — picks createVendor/Customer +
 *                                       updateVendor/Customer + i18n key
 *   row          object|null       — current vendor/customer (edit mode only)
 *   onClose      () => void
 *   onSaved      (savedRow) => void
 *
 * Field validators mirror the backend Zod (HASEEB-143):
 *   nameEn       — required on create (1..200), optional on edit
 *   nameAr       — optional <=200
 *   email        — optional, valid email
 *   phone        — optional <=30
 *   crNumber     — optional <=50
 *   crIssuedAt   — optional ISO YYYY-MM-DD
 *   crExpiryDate — optional ISO YYYY-MM-DD; soft-warn if <=today (already
 *                  expired) — does NOT block save
 *   civilIdNumber — optional <=50
 *   kycNotes     — optional <=2000
 *
 * Empty-string normalization: any cleared field is sent as `null` so the
 * backend (PATCH semantics: undefined=preserve, null=clear) properly
 * clears the prior value rather than preserving it.
 *
 * Role gate: the SetupScreen `readOnly` prop already prevents the modal
 * from opening for non-CFO/non-Senior viewers — defense-in-depth via
 * disabled affordances at the section level. Backend is authoritative
 * (POST/PATCH require OWNER|ACCOUNTANT) regardless.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, AlertTriangle } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import {
  createVendor,
  updateVendor,
  createCustomer,
  updateCustomer,
} from "../../engine";

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

function _normEmail(s) {
  if (!s) return null;
  const t = String(s).trim();
  return t.length > 0 ? t : null;
}
function _trimOrNull(s) {
  if (s == null) return null;
  const t = String(s).trim();
  return t.length > 0 ? t : null;
}
function _isValidEmail(s) {
  // Loose parity with Zod's z.string().email() — RFC-correct enough for
  // the 80% case without recreating Zod's full regex.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export default function KYCEditModal({
  open,
  mode = "edit",
  kind = "vendor",
  row,
  onClose,
  onSaved,
}) {
  const { t } = useTranslation("setup");
  useEscapeKey(onClose, open);
  const isEdit = mode === "edit";
  const isCustomer = kind === "customer";

  // Basic fields
  const [nameEn, setNameEn] = useState("");
  const [nameAr, setNameAr] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  // KYC fields
  const [crNumber, setCrNumber] = useState("");
  const [crIssuedAt, setCrIssuedAt] = useState("");
  const [crExpiryDate, setCrExpiryDate] = useState("");
  const [civilIdNumber, setCivilIdNumber] = useState("");
  const [kycNotes, setKycNotes] = useState("");
  // UX
  const [submitError, setSubmitError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (isEdit && row) {
      setNameEn(row.nameEn || "");
      setNameAr(row.nameAr || "");
      setEmail(row.email || "");
      setPhone(row.phone || "");
      setCrNumber(row.crNumber || "");
      setCrIssuedAt(row.crIssuedAt || "");
      setCrExpiryDate(row.crExpiryDate || "");
      setCivilIdNumber(row.civilIdNumber || "");
      setKycNotes(row.kycNotes || "");
    } else {
      setNameEn("");
      setNameAr("");
      setEmail("");
      setPhone("");
      setCrNumber("");
      setCrIssuedAt("");
      setCrExpiryDate("");
      setCivilIdNumber("");
      setKycNotes("");
    }
    setSubmitError(null);
  }, [open, isEdit, row]);

  if (!open) return null;

  const today = new Date().toISOString().slice(0, 10);
  const expiryWarning =
    crExpiryDate && crExpiryDate <= today
      ? t("kyc_modal.warn_expiry_in_past")
      : null;

  const handleSave = async () => {
    setSubmitError(null);
    // Required: nameEn on create (1..200).
    if (!isEdit) {
      const n = nameEn.trim();
      if (n.length < 1) {
        setSubmitError(t("kyc_modal.error_name_required"));
        return;
      }
      if (n.length > 200) {
        setSubmitError(t("kyc_modal.error_name_too_long"));
        return;
      }
    }
    // Email validity (only if non-empty).
    if (email.trim() && !_isValidEmail(email.trim())) {
      setSubmitError(t("kyc_modal.error_email_invalid"));
      return;
    }
    // Field length parity with backend Zod.
    if ((nameAr || "").length > 200) {
      setSubmitError(t("kyc_modal.error_name_ar_too_long"));
      return;
    }
    if ((phone || "").length > 30) {
      setSubmitError(t("kyc_modal.error_phone_too_long"));
      return;
    }
    if ((crNumber || "").length > 50) {
      setSubmitError(t("kyc_modal.error_cr_number_too_long"));
      return;
    }
    if ((civilIdNumber || "").length > 50) {
      setSubmitError(t("kyc_modal.error_civil_id_too_long"));
      return;
    }
    if ((kycNotes || "").length > 2000) {
      setSubmitError(t("kyc_modal.error_notes_too_long"));
      return;
    }
    // Date sanity: issuedAt must not be after expiryDate when both set.
    if (crIssuedAt && crExpiryDate && crIssuedAt > crExpiryDate) {
      setSubmitError(t("kyc_modal.error_issued_after_expiry"));
      return;
    }

    // Build payload. On EDIT we send a partial; null clears, undefined
    // preserves. To make the cleared-field case work via single form
    // state, we always send the field — empty-string → null. Required
    // nameEn on create is the only field guaranteed non-null.
    const basePayload = {
      nameAr: _trimOrNull(nameAr),
      email: _normEmail(email),
      phone: _trimOrNull(phone),
      crNumber: _trimOrNull(crNumber),
      crIssuedAt: _trimOrNull(crIssuedAt),
      crExpiryDate: _trimOrNull(crExpiryDate),
      civilIdNumber: _trimOrNull(civilIdNumber),
      kycNotes: _trimOrNull(kycNotes),
    };
    // On CREATE: nameEn is required and cannot be null.
    // On EDIT: include nameEn only if it changed (to avoid sending the
    //          unchanged value back) — easier path is always send it.
    const payload = isEdit
      ? { nameEn: _trimOrNull(nameEn) || row?.nameEn || "", ...basePayload }
      : { nameEn: nameEn.trim(), ...basePayload };

    setSaving(true);
    try {
      let saved;
      if (isCustomer) {
        saved = isEdit
          ? await updateCustomer(row.id, payload)
          : await createCustomer(payload);
      } else {
        saved = isEdit
          ? await updateVendor(row.id, payload)
          : await createVendor(payload);
      }
      if (onSaved) onSaved(saved);
      if (onClose) onClose();
    } catch (err) {
      setSubmitError(err?.message || t("kyc_modal.error_generic"));
    } finally {
      setSaving(false);
    }
  };

  const labelKey = isCustomer ? "customers" : "vendors";

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
          width: 580,
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
                ? t(`kyc_modal.${labelKey}_edit_label`)
                : t(`kyc_modal.${labelKey}_add_label`)}
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
                ? t(`kyc_modal.${labelKey}_edit_title`)
                : t(`kyc_modal.${labelKey}_add_title`)}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("kyc_modal.close")}
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

          {/* Basic fields. nameEn is required on create; nameAr/email/phone are optional. */}
          <Field
            label={
              isEdit
                ? t("kyc_modal.field_name_en")
                : `${t("kyc_modal.field_name_en")} *`
            }
          >
            <input
              type="text"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              maxLength={200}
              placeholder={t("kyc_modal.field_name_en_placeholder")}
              style={inputStyle}
            />
          </Field>

          <Field label={t("kyc_modal.field_name_ar")}>
            <input
              type="text"
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              maxLength={200}
              dir="rtl"
              style={inputStyle}
            />
          </Field>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Field label={t("kyc_modal.field_email")}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label={t("kyc_modal.field_phone")}>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={30}
                  style={inputStyle}
                />
              </Field>
            </div>
          </div>

          {/* KYC section divider */}
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.2em",
              color: "var(--accent-primary)",
              padding: "10px 0 4px",
              borderTop: "1px solid var(--border-subtle)",
              marginTop: 4,
            }}
          >
            {t("kyc_modal.section_kyc")}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-tertiary)",
              marginBottom: 4,
            }}
          >
            {t("kyc_modal.section_kyc_description")}
          </div>

          <Field label={t("kyc_modal.field_cr_number")}>
            <input
              type="text"
              value={crNumber}
              onChange={(e) => setCrNumber(e.target.value)}
              maxLength={50}
              placeholder={t("kyc_modal.field_cr_number_placeholder")}
              style={inputStyle}
            />
          </Field>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Field label={t("kyc_modal.field_cr_issued_at")}>
                <input
                  type="date"
                  value={crIssuedAt}
                  onChange={(e) => setCrIssuedAt(e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label={t("kyc_modal.field_cr_expiry_date")}>
                <input
                  type="date"
                  value={crExpiryDate}
                  onChange={(e) => setCrExpiryDate(e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </div>
          </div>

          {expiryWarning && (
            <div
              role="status"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                background: "var(--semantic-warning-subtle)",
                border: "1px solid var(--semantic-warning)",
                borderRadius: 6,
                color: "var(--semantic-warning)",
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              <AlertTriangle size={12} /> {expiryWarning}
            </div>
          )}

          <Field label={t("kyc_modal.field_civil_id_number")}>
            <input
              type="text"
              value={civilIdNumber}
              onChange={(e) => setCivilIdNumber(e.target.value)}
              maxLength={50}
              style={inputStyle}
            />
          </Field>

          <Field label={t("kyc_modal.field_kyc_notes")}>
            <textarea
              value={kycNotes}
              onChange={(e) => setKycNotes(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder={t("kyc_modal.field_kyc_notes_placeholder")}
              style={{ ...inputStyle, resize: "vertical" }}
            />
            <div
              style={{
                fontSize: 10,
                color: "var(--text-tertiary)",
                marginTop: 4,
                textAlign: "end",
              }}
            >
              {kycNotes.length}/2000
            </div>
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
            {t("kyc_modal.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={btnPrimary(saving)}
          >
            {saving ? (
              <>
                <Spinner size={13} />
                &nbsp;{t("kyc_modal.saving")}
              </>
            ) : (
              t("kyc_modal.save")
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
