import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, AlertTriangle } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import {
  createRelatedParty,
  updateRelatedParty,
} from "../../engine";

// IAS 24 §9 standard buckets + OTHER catch-alls.
const NATURES = [
  "PARENT",
  "SUBSIDIARY",
  "ASSOCIATE",
  "JOINT_VENTURE",
  "KEY_MANAGEMENT_PERSONNEL",
  "CLOSE_FAMILY_MEMBER",
  "OTHER_RELATED_ENTITY",
  "OTHER",
];

const COUNTERPARTY_TYPES = ["VENDOR", "CUSTOMER"];

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

export default function RelatedPartyModal({
  open,
  mode,
  entry,
  vendors,
  customers,
  onClose,
  onSaved,
}) {
  const { t } = useTranslation("setup");
  useEscapeKey(onClose, open);
  const isEdit = mode === "edit";

  const [counterpartyType, setCounterpartyType] = useState("VENDOR");
  const [counterpartyVendorId, setCounterpartyVendorId] = useState("");
  const [counterpartyCustomerId, setCounterpartyCustomerId] = useState("");
  const [natureOfRelationship, setNatureOfRelationship] = useState("OTHER");
  const [disclosureNote, setDisclosureNote] = useState("");
  const [activeFrom, setActiveFrom] = useState(today());
  const [activeUntil, setActiveUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [submitError, setSubmitError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (isEdit && entry) {
      setCounterpartyType(entry.counterpartyType || "VENDOR");
      setCounterpartyVendorId(entry.counterpartyVendorId || "");
      setCounterpartyCustomerId(entry.counterpartyCustomerId || "");
      setNatureOfRelationship(entry.natureOfRelationship || "OTHER");
      setDisclosureNote(entry.disclosureNote || "");
      setActiveFrom(entry.activeFrom || today());
      setActiveUntil(entry.activeUntil || "");
      setNotes(entry.notes || "");
    } else {
      setCounterpartyType("VENDOR");
      setCounterpartyVendorId("");
      setCounterpartyCustomerId("");
      setNatureOfRelationship("OTHER");
      setDisclosureNote("");
      setActiveFrom(today());
      setActiveUntil("");
      setNotes("");
    }
    setSubmitError(null);
  }, [open, isEdit, entry]);

  if (!open) return null;

  const handleSave = async () => {
    setSubmitError(null);
    if (!isEdit) {
      if (counterpartyType === "VENDOR" && !counterpartyVendorId) {
        setSubmitError(t("rp_modal.error_vendor_required"));
        return;
      }
      if (counterpartyType === "CUSTOMER" && !counterpartyCustomerId) {
        setSubmitError(t("rp_modal.error_customer_required"));
        return;
      }
    }
    if (!activeFrom) {
      setSubmitError(t("rp_modal.error_active_from_required"));
      return;
    }
    if (activeUntil && activeUntil <= activeFrom) {
      setSubmitError(t("rp_modal.error_active_until_after_from"));
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await updateRelatedParty(entry.id, {
          natureOfRelationship,
          disclosureNote: disclosureNote.trim() || null,
          activeUntil: activeUntil || null,
          notes: notes.trim() || null,
        });
      } else {
        await createRelatedParty({
          counterpartyType,
          counterpartyVendorId:
            counterpartyType === "VENDOR" ? counterpartyVendorId : null,
          counterpartyCustomerId:
            counterpartyType === "CUSTOMER" ? counterpartyCustomerId : null,
          natureOfRelationship,
          disclosureNote: disclosureNote.trim() || null,
          activeFrom,
          activeUntil: activeUntil || null,
          notes: notes.trim() || null,
        });
      }
      if (onSaved) onSaved();
      if (onClose) onClose();
    } catch (err) {
      setSubmitError(err?.message || t("rp_modal.error_generic"));
    } finally {
      setSaving(false);
    }
  };

  const currentCounterpartyLabel = (() => {
    if (!isEdit || !entry) return "";
    if (entry.counterpartyType === "VENDOR") {
      const v = (vendors || []).find(
        (x) => x.id === entry.counterpartyVendorId,
      );
      return v
        ? v.nameEn || v.name || v.nameAr || v.id
        : entry.counterpartyVendorId;
    }
    const c = (customers || []).find(
      (x) => x.id === entry.counterpartyCustomerId,
    );
    return c
      ? c.nameEn || c.name || c.nameAr || c.id
      : entry.counterpartyCustomerId;
  })();

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
              {isEdit ? t("rp_modal.edit_label") : t("rp_modal.add_label")}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22,
                color: "var(--text-primary)",
                marginTop: 2,
              }}
            >
              {isEdit ? t("rp_modal.edit_title") : t("rp_modal.add_title")}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("rp_modal.close")}
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

          {/* Counterparty type — create-only */}
          {!isEdit && (
            <Field label={t("rp_modal.field_counterparty_type")}>
              <div style={{ display: "flex", gap: 6 }}>
                {COUNTERPARTY_TYPES.map((ct) => {
                  const on = counterpartyType === ct;
                  return (
                    <button
                      key={ct}
                      onClick={() => setCounterpartyType(ct)}
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
                      {t(`rp_modal.type_${ct}`)}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          {!isEdit && counterpartyType === "VENDOR" && (
            <Field label={t("rp_modal.field_vendor")}>
              <select
                value={counterpartyVendorId}
                onChange={(e) => setCounterpartyVendorId(e.target.value)}
                style={inputStyle}
              >
                <option value="">{t("rp_modal.vendor_placeholder")}</option>
                {(vendors || []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nameEn || v.name || v.nameAr || v.id}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {!isEdit && counterpartyType === "CUSTOMER" && (
            <Field label={t("rp_modal.field_customer")}>
              <select
                value={counterpartyCustomerId}
                onChange={(e) => setCounterpartyCustomerId(e.target.value)}
                style={inputStyle}
              >
                <option value="">{t("rp_modal.customer_placeholder")}</option>
                {(customers || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nameEn || c.name || c.nameAr || c.id}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {/* In edit mode: show current counterparty as readonly */}
          {isEdit && (
            <Field label={t("rp_modal.field_counterparty_readonly")}>
              <div
                style={{
                  ...inputStyle,
                  background: "var(--bg-surface)",
                  color: "var(--text-secondary)",
                  opacity: 0.85,
                }}
              >
                {t(`rp_modal.type_${entry?.counterpartyType || "VENDOR"}`)} ·{" "}
                {currentCounterpartyLabel}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-tertiary)",
                  fontStyle: "italic",
                  marginTop: 6,
                }}
              >
                {t("rp_modal.counterparty_immutable_note")}
              </div>
            </Field>
          )}

          <Field label={t("rp_modal.field_nature")}>
            <select
              value={natureOfRelationship}
              onChange={(e) => setNatureOfRelationship(e.target.value)}
              style={inputStyle}
            >
              {NATURES.map((n) => (
                <option key={n} value={n}>
                  {t(`rp_modal.nature_${n}`)}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t("rp_modal.field_disclosure_note")}>
            <textarea
              value={disclosureNote}
              onChange={(e) => setDisclosureNote(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder={t("rp_modal.disclosure_placeholder")}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </Field>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Field label={t("rp_modal.field_active_from")}>
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
              <Field label={t("rp_modal.field_active_until")}>
                <input
                  type="date"
                  value={activeUntil}
                  onChange={(e) => setActiveUntil(e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </div>
          </div>

          <Field label={t("rp_modal.field_notes")}>
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
            {t("rp_modal.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={btnPrimary(saving)}
          >
            {saving ? (
              <>
                <Spinner size={13} />
                &nbsp;{t("rp_modal.saving")}
              </>
            ) : (
              t("rp_modal.save")
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
