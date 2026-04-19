import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, AlertTriangle } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import { createLeavePolicy, updateLeavePolicy } from "../../engine";

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

function isValidDecimal4(v) {
  if (v === "" || v == null) return false;
  if (typeof v !== "string") v = String(v ?? "");
  return /^\d+(?:\.\d{1,4})?$/.test(v.trim());
}

export default function LeavePolicyModal({ open, mode, policy, onClose, onSaved }) {
  const { t } = useTranslation("setup");
  useEscapeKey(onClose, open);
  const isEdit = mode === "edit";

  const [accrualDaysPerMonth, setAccrualDaysPerMonth] = useState("");
  const [qualifyingMonths, setQualifyingMonths] = useState("3");
  const [maxCarryForward, setMaxCarryForward] = useState("30");
  const [plRoleCode, setPlRoleCode] = useState("LEAVE_EXPENSE");
  const [liabilityRoleCode, setLiabilityRoleCode] = useState("LEAVE_LIABILITY");
  const [notes, setNotes] = useState("");
  const [activeFrom, setActiveFrom] = useState(today());
  const [activeUntil, setActiveUntil] = useState("");
  const [submitError, setSubmitError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (isEdit && policy) {
      setAccrualDaysPerMonth(policy.accrualDaysPerMonth || "");
      setQualifyingMonths(
        policy.qualifyingMonthsBeforeAccrual != null
          ? String(policy.qualifyingMonthsBeforeAccrual)
          : "3",
      );
      setMaxCarryForward(
        policy.maxCarryForwardDays != null
          ? String(policy.maxCarryForwardDays)
          : "30",
      );
      setPlRoleCode(policy.plRoleCode || "LEAVE_EXPENSE");
      setLiabilityRoleCode(policy.liabilityRoleCode || "LEAVE_LIABILITY");
      setNotes(policy.notes || "");
      setActiveFrom(policy.activeFrom || today());
      setActiveUntil(policy.activeUntil || "");
    } else {
      setAccrualDaysPerMonth("");
      setQualifyingMonths("3");
      setMaxCarryForward("30");
      setPlRoleCode("LEAVE_EXPENSE");
      setLiabilityRoleCode("LEAVE_LIABILITY");
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
      if (!isValidDecimal4(accrualDaysPerMonth) || Number(accrualDaysPerMonth) <= 0) {
        setSubmitError(t("leave_modal.error_accrual_positive"));
        return;
      }
      if (qualifyingMonths !== "" && !/^\d+$/.test(qualifyingMonths.trim())) {
        setSubmitError(t("leave_modal.error_qualifying_integer"));
        return;
      }
      if (maxCarryForward !== "" && !/^\d+$/.test(maxCarryForward.trim())) {
        setSubmitError(t("leave_modal.error_carry_integer"));
        return;
      }
      if (!plRoleCode.trim() || !liabilityRoleCode.trim()) {
        setSubmitError(t("leave_modal.error_role_required"));
        return;
      }
    }
    if (!activeFrom) {
      setSubmitError(t("leave_modal.error_active_from_required"));
      return;
    }
    if (activeUntil && activeUntil <= activeFrom) {
      setSubmitError(t("leave_modal.error_active_until_after_from"));
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await updateLeavePolicy(policy.id, {
          notes: notes.trim() || null,
          activeUntil: activeUntil || null,
        });
      } else {
        await createLeavePolicy({
          accrualDaysPerMonth: String(accrualDaysPerMonth).trim(),
          qualifyingMonthsBeforeAccrual:
            qualifyingMonths === "" ? undefined : Number(qualifyingMonths),
          maxCarryForwardDays:
            maxCarryForward === "" ? undefined : Number(maxCarryForward),
          plRoleCode: plRoleCode.trim(),
          liabilityRoleCode: liabilityRoleCode.trim(),
          notes: notes.trim() || null,
          activeFrom,
          activeUntil: activeUntil || null,
        });
      }
      if (onSaved) onSaved();
      if (onClose) onClose();
    } catch (err) {
      setSubmitError(err?.message || t("leave_modal.error_generic"));
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
                ? t("leave_modal.edit_label")
                : t("leave_modal.add_label")}
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
                ? t("leave_modal.edit_title")
                : t("leave_modal.add_title")}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("leave_modal.close")}
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
              {t("leave_modal.rates_immutable_note")}
            </div>
          )}

          <Field label={t("leave_modal.field_accrual_days_per_month")}>
            <input
              type="text"
              inputMode="decimal"
              value={accrualDaysPerMonth}
              onChange={(e) => setAccrualDaysPerMonth(e.target.value)}
              disabled={isEdit}
              placeholder="2.5"
              style={{
                ...inputStyle,
                fontFamily: "'DM Mono', monospace",
                opacity: isEdit ? 0.6 : 1,
              }}
            />
            <div
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                marginTop: 4,
              }}
            >
              {t("leave_modal.accrual_hint")}
            </div>
          </Field>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Field label={t("leave_modal.field_qualifying_months")}>
                <input
                  type="text"
                  inputMode="numeric"
                  value={qualifyingMonths}
                  onChange={(e) => setQualifyingMonths(e.target.value)}
                  disabled={isEdit}
                  placeholder="3"
                  style={{
                    ...inputStyle,
                    fontFamily: "'DM Mono', monospace",
                    opacity: isEdit ? 0.6 : 1,
                  }}
                />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label={t("leave_modal.field_max_carry_forward")}>
                <input
                  type="text"
                  inputMode="numeric"
                  value={maxCarryForward}
                  onChange={(e) => setMaxCarryForward(e.target.value)}
                  disabled={isEdit}
                  placeholder="30"
                  style={{
                    ...inputStyle,
                    fontFamily: "'DM Mono', monospace",
                    opacity: isEdit ? 0.6 : 1,
                  }}
                />
              </Field>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Field label={t("leave_modal.field_pl_role_code")}>
                <input
                  value={plRoleCode}
                  onChange={(e) => setPlRoleCode(e.target.value)}
                  maxLength={120}
                  disabled={isEdit}
                  placeholder="LEAVE_EXPENSE"
                  style={{
                    ...inputStyle,
                    fontFamily: "'DM Mono', monospace",
                    opacity: isEdit ? 0.6 : 1,
                  }}
                />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label={t("leave_modal.field_liability_role_code")}>
                <input
                  value={liabilityRoleCode}
                  onChange={(e) => setLiabilityRoleCode(e.target.value)}
                  maxLength={120}
                  disabled={isEdit}
                  placeholder="LEAVE_LIABILITY"
                  style={{
                    ...inputStyle,
                    fontFamily: "'DM Mono', monospace",
                    opacity: isEdit ? 0.6 : 1,
                  }}
                />
              </Field>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Field label={t("leave_modal.field_active_from")}>
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
              <Field label={t("leave_modal.field_active_until")}>
                <input
                  type="date"
                  value={activeUntil}
                  onChange={(e) => setActiveUntil(e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </div>
          </div>

          <Field label={t("leave_modal.field_notes")}>
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
            {t("leave_modal.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={btnPrimary(saving)}
          >
            {saving ? (
              <>
                <Spinner size={13} />
                &nbsp;{t("leave_modal.saving")}
              </>
            ) : (
              t("leave_modal.save")
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
