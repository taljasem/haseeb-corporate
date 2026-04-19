import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, AlertTriangle } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import {
  createWarrantyPolicy,
  updateWarrantyPolicy,
} from "../../engine";

const BASIS_MODES = ["REVENUE_PERCENT", "PER_UNIT"];

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
  return Math.round(n * 100);
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

function isValidDecimal(v) {
  if (v === "" || v == null) return true;
  if (typeof v !== "string") v = String(v ?? "");
  return /^-?\d+(?:\.\d{1,3})?$/.test(v.trim());
}

export default function WarrantyPolicyModal({ open, mode, policy, onClose, onSaved }) {
  const { t } = useTranslation("setup");
  useEscapeKey(onClose, open);
  const isEdit = mode === "edit";

  const [basis, setBasis] = useState("REVENUE_PERCENT");
  const [ratePercent, setRatePercent] = useState("");
  const [perUnitAmount, setPerUnitAmount] = useState("");
  const [plRoleCode, setPlRoleCode] = useState("WARRANTY_EXPENSE");
  const [liabilityRoleCode, setLiabilityRoleCode] = useState("WARRANTY_LIABILITY");
  const [notes, setNotes] = useState("");
  const [activeFrom, setActiveFrom] = useState(today());
  const [activeUntil, setActiveUntil] = useState("");
  const [submitError, setSubmitError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (isEdit && policy) {
      setBasis(policy.basis || "REVENUE_PERCENT");
      setRatePercent(bpsToPercent(policy.ratePercent));
      setPerUnitAmount(policy.perUnitAmountKwd || "");
      setPlRoleCode(policy.plRoleCode || "WARRANTY_EXPENSE");
      setLiabilityRoleCode(policy.liabilityRoleCode || "WARRANTY_LIABILITY");
      setNotes(policy.notes || "");
      setActiveFrom(policy.activeFrom || today());
      setActiveUntil(policy.activeUntil || "");
    } else {
      setBasis("REVENUE_PERCENT");
      setRatePercent("");
      setPerUnitAmount("");
      setPlRoleCode("WARRANTY_EXPENSE");
      setLiabilityRoleCode("WARRANTY_LIABILITY");
      setNotes("");
      setActiveFrom(today());
      setActiveUntil("");
    }
    setSubmitError(null);
  }, [open, isEdit, policy]);

  if (!open) return null;

  const handleSave = async () => {
    setSubmitError(null);
    if (!isEdit) {
      if (basis === "REVENUE_PERCENT") {
        if (!isValidPercent(ratePercent) || ratePercent === "") {
          setSubmitError(t("warranty_modal.error_rate_required"));
          return;
        }
        if (Number(ratePercent) <= 0) {
          setSubmitError(t("warranty_modal.error_rate_positive"));
          return;
        }
      } else {
        // PER_UNIT
        if (!isValidDecimal(perUnitAmount) || perUnitAmount === "") {
          setSubmitError(t("warranty_modal.error_per_unit_required"));
          return;
        }
        if (Number(perUnitAmount) <= 0) {
          setSubmitError(t("warranty_modal.error_per_unit_positive"));
          return;
        }
      }
    }
    if (!plRoleCode.trim()) {
      setSubmitError(t("warranty_modal.error_pl_role_required"));
      return;
    }
    if (!liabilityRoleCode.trim()) {
      setSubmitError(t("warranty_modal.error_liability_role_required"));
      return;
    }
    if (!activeFrom) {
      setSubmitError(t("warranty_modal.error_active_from_required"));
      return;
    }
    if (activeUntil && activeUntil <= activeFrom) {
      setSubmitError(t("warranty_modal.error_active_until_after_from"));
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await updateWarrantyPolicy(policy.id, {
          notes: notes.trim() || null,
          activeUntil: activeUntil || null,
          plRoleCode: plRoleCode.trim(),
          liabilityRoleCode: liabilityRoleCode.trim(),
        });
      } else {
        const payload = {
          basis,
          ratePercent:
            basis === "REVENUE_PERCENT" ? percentToBps(ratePercent) : null,
          perUnitAmountKwd:
            basis === "PER_UNIT" ? String(perUnitAmount).trim() : null,
          plRoleCode: plRoleCode.trim(),
          liabilityRoleCode: liabilityRoleCode.trim(),
          notes: notes.trim() || null,
          activeFrom,
          activeUntil: activeUntil || null,
        };
        await createWarrantyPolicy(payload);
      }
      if (onSaved) onSaved();
      if (onClose) onClose();
    } catch (err) {
      setSubmitError(err?.message || t("warranty_modal.error_generic"));
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
              {isEdit
                ? t("warranty_modal.edit_label")
                : t("warranty_modal.add_label")}
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
                ? t("warranty_modal.edit_title")
                : t("warranty_modal.add_title")}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("warranty_modal.close")}
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
              {t("warranty_modal.rates_immutable_note")}
            </div>
          )}

          {!isEdit && (
            <Field label={t("warranty_modal.field_basis")}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {BASIS_MODES.map((b) => {
                  const on = basis === b;
                  return (
                    <button
                      key={b}
                      onClick={() => setBasis(b)}
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
                      {t(`warranty_modal.basis_${b}`)}
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
                {t(`warranty_modal.basis_hint_${basis}`)}
              </div>
            </Field>
          )}

          {isEdit && (
            <Field label={t("warranty_modal.field_basis")}>
              <div
                style={{
                  ...inputStyle,
                  background: "var(--bg-surface)",
                  color: "var(--text-secondary)",
                  opacity: 0.85,
                }}
              >
                {t(`warranty_modal.basis_${policy?.basis || "REVENUE_PERCENT"}`)}
              </div>
            </Field>
          )}

          {!isEdit && basis === "REVENUE_PERCENT" && (
            <Field label={t("warranty_modal.field_rate_percent")}>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  inputMode="decimal"
                  value={ratePercent}
                  onChange={(e) => setRatePercent(e.target.value)}
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
            </Field>
          )}

          {!isEdit && basis === "PER_UNIT" && (
            <Field label={t("warranty_modal.field_per_unit_amount")}>
              <input
                type="text"
                inputMode="decimal"
                value={perUnitAmount}
                onChange={(e) => setPerUnitAmount(e.target.value)}
                placeholder="0.000"
                style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }}
              />
            </Field>
          )}

          {isEdit && policy && (
            <Field label={t("warranty_modal.field_rate_readonly")}>
              <div
                style={{
                  ...inputStyle,
                  background: "var(--bg-surface)",
                  color: "var(--text-secondary)",
                  opacity: 0.85,
                  fontFamily: "'DM Mono', monospace",
                }}
              >
                {policy.basis === "REVENUE_PERCENT"
                  ? `${bpsToPercent(policy.ratePercent)}%`
                  : `${policy.perUnitAmountKwd} KWD / unit`}
              </div>
            </Field>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Field label={t("warranty_modal.field_pl_role_code")}>
                <input
                  value={plRoleCode}
                  onChange={(e) => setPlRoleCode(e.target.value)}
                  maxLength={120}
                  placeholder="WARRANTY_EXPENSE"
                  style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }}
                />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label={t("warranty_modal.field_liability_role_code")}>
                <input
                  value={liabilityRoleCode}
                  onChange={(e) => setLiabilityRoleCode(e.target.value)}
                  maxLength={120}
                  placeholder="WARRANTY_LIABILITY"
                  style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }}
                />
              </Field>
            </div>
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-tertiary)",
              marginTop: -6,
            }}
          >
            {t("warranty_modal.role_hint")}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Field label={t("warranty_modal.field_active_from")}>
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
              <Field label={t("warranty_modal.field_active_until")}>
                <input
                  type="date"
                  value={activeUntil}
                  onChange={(e) => setActiveUntil(e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </div>
          </div>

          <Field label={t("warranty_modal.field_notes")}>
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
            {t("warranty_modal.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={btnPrimary(saving)}
          >
            {saving ? (
              <>
                <Spinner size={13} />
                &nbsp;{t("warranty_modal.saving")}
              </>
            ) : (
              t("warranty_modal.save")
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
