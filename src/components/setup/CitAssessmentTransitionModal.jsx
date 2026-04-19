import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, AlertTriangle } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import {
  openCitAssessmentReview,
  recordCitAssessment,
  recordCitAssessmentObjection,
  finalizeCitAssessment,
} from "../../engine";

// The four write-heavy transitions share a modal with different field
// sets. close and mark-statute-expired are plain confirms — handled
// inline in SetupScreen, not here.
const TRANSITION_FIELDS = {
  open_review: ["authorityCaseNumber"],
  record_assessment: [
    "assessedAmountKwd",
    "assessedOnDate",
    "authorityCaseNumber",
    "notes",
  ],
  record_objection: ["objectionFiledOn", "notes"],
  finalize: ["finalAmountKwd", "finalizedOnDate", "notes"],
};

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
  return /^-?\d+(?:\.\d{1,3})?$/.test(value.trim());
}

export default function CitAssessmentTransitionModal({
  open,
  transition,
  assessment,
  onClose,
  onSaved,
}) {
  const { t } = useTranslation("setup");
  useEscapeKey(onClose, open);

  const [authorityCaseNumber, setAuthorityCaseNumber] = useState("");
  const [assessedAmountKwd, setAssessedAmountKwd] = useState("");
  const [assessedOnDate, setAssessedOnDate] = useState(today());
  const [objectionFiledOn, setObjectionFiledOn] = useState(today());
  const [finalAmountKwd, setFinalAmountKwd] = useState("");
  const [finalizedOnDate, setFinalizedOnDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [submitError, setSubmitError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !assessment) return;
    setAuthorityCaseNumber(assessment.authorityCaseNumber || "");
    setAssessedAmountKwd(assessment.assessedAmountKwd || "");
    setAssessedOnDate(assessment.assessedOnDate || today());
    setObjectionFiledOn(today());
    setFinalAmountKwd(
      assessment.finalAmountKwd || assessment.assessedAmountKwd || "",
    );
    setFinalizedOnDate(today());
    setNotes("");
    setSubmitError(null);
  }, [open, assessment, transition]);

  if (!open || !transition || !assessment) return null;

  const fields = TRANSITION_FIELDS[transition] || [];

  const handleSave = async () => {
    setSubmitError(null);
    try {
      if (transition === "open_review") {
        if (!authorityCaseNumber.trim()) {
          setSubmitError(
            t("cit_assessment_modal.error_authority_case_required"),
          );
          return;
        }
        setSaving(true);
        await openCitAssessmentReview(assessment.id, {
          authorityCaseNumber: authorityCaseNumber.trim(),
        });
      } else if (transition === "record_assessment") {
        if (!isValidDecimal(assessedAmountKwd)) {
          setSubmitError(t("cit_assessment_modal.error_amount_format"));
          return;
        }
        if (!assessedOnDate) {
          setSubmitError(
            t("cit_assessment_modal.error_assessed_on_required"),
          );
          return;
        }
        setSaving(true);
        await recordCitAssessment(assessment.id, {
          assessedAmountKwd: String(assessedAmountKwd).trim(),
          assessedOnDate,
          authorityCaseNumber: authorityCaseNumber.trim() || null,
          notes: notes.trim() || null,
        });
      } else if (transition === "record_objection") {
        if (!objectionFiledOn) {
          setSubmitError(
            t("cit_assessment_modal.error_objection_filed_required"),
          );
          return;
        }
        setSaving(true);
        await recordCitAssessmentObjection(assessment.id, {
          objectionFiledOn,
          notes: notes.trim() || null,
        });
      } else if (transition === "finalize") {
        if (!isValidDecimal(finalAmountKwd)) {
          setSubmitError(t("cit_assessment_modal.error_amount_format"));
          return;
        }
        if (!finalizedOnDate) {
          setSubmitError(
            t("cit_assessment_modal.error_finalized_on_required"),
          );
          return;
        }
        setSaving(true);
        await finalizeCitAssessment(assessment.id, {
          finalAmountKwd: String(finalAmountKwd).trim(),
          finalizedOnDate,
          notes: notes.trim() || null,
        });
      }
      if (onSaved) onSaved();
      if (onClose) onClose();
    } catch (err) {
      setSubmitError(err?.message || t("cit_assessment_modal.error_generic"));
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
          width: 520,
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
              {t(`cit_assessment_modal.${transition}_label`)}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22,
                color: "var(--text-primary)",
                marginTop: 2,
              }}
            >
              {t(`cit_assessment_modal.${transition}_title`, {
                fiscalYear: assessment.fiscalYear,
              })}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("cit_assessment_modal.close")}
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

          {fields.includes("authorityCaseNumber") && (
            <Field
              label={t("cit_assessment_modal.field_authority_case_number")}
            >
              <input
                value={authorityCaseNumber}
                onChange={(e) => setAuthorityCaseNumber(e.target.value)}
                maxLength={200}
                placeholder={t(
                  "cit_assessment_modal.authority_case_placeholder",
                )}
                style={inputStyle}
              />
            </Field>
          )}

          {fields.includes("assessedAmountKwd") && (
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <Field
                  label={t("cit_assessment_modal.field_assessed_amount")}
                >
                  <input
                    type="text"
                    inputMode="decimal"
                    value={assessedAmountKwd}
                    onChange={(e) => setAssessedAmountKwd(e.target.value)}
                    placeholder="0.000"
                    style={{
                      ...inputStyle,
                      fontFamily: "'DM Mono', monospace",
                    }}
                  />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label={t("cit_assessment_modal.field_assessed_on")}>
                  <input
                    type="date"
                    value={assessedOnDate}
                    onChange={(e) => setAssessedOnDate(e.target.value)}
                    style={inputStyle}
                  />
                </Field>
              </div>
            </div>
          )}

          {fields.includes("objectionFiledOn") && (
            <Field label={t("cit_assessment_modal.field_objection_filed_on")}>
              <input
                type="date"
                value={objectionFiledOn}
                onChange={(e) => setObjectionFiledOn(e.target.value)}
                style={inputStyle}
              />
            </Field>
          )}

          {fields.includes("finalAmountKwd") && (
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <Field label={t("cit_assessment_modal.field_final_amount")}>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={finalAmountKwd}
                    onChange={(e) => setFinalAmountKwd(e.target.value)}
                    placeholder="0.000"
                    style={{
                      ...inputStyle,
                      fontFamily: "'DM Mono', monospace",
                    }}
                  />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label={t("cit_assessment_modal.field_finalized_on")}>
                  <input
                    type="date"
                    value={finalizedOnDate}
                    onChange={(e) => setFinalizedOnDate(e.target.value)}
                    style={inputStyle}
                  />
                </Field>
              </div>
            </div>
          )}

          {fields.includes("notes") && (
            <Field label={t("cit_assessment_modal.field_notes")}>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                maxLength={2000}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </Field>
          )}
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
            {t("cit_assessment_modal.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={btnPrimary(saving)}
          >
            {saving ? (
              <>
                <Spinner size={13} />
                &nbsp;{t("cit_assessment_modal.saving")}
              </>
            ) : (
              t("cit_assessment_modal.save")
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
