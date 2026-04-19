/**
 * PublishVersionModal (FN-244, Phase 4 Wave 1).
 *
 * Opens from FinancialStatementsScreen's header. Captures:
 *   • optional `notes`
 *   • optional `supersedesId` (only selectable when a current version exists
 *     for the (reportType, reportKey) we're viewing)
 *
 * On submit it calls `publishReportVersion({ reportType, reportKey,
 * snapshotData, notes?, supersedesId?, asOfDate?, periodFrom?, periodTo? })`
 * and passes the created DTO back via onPublished. The parent screen owns
 * the toast + refresh.
 *
 * This component does NOT make design decisions. It reuses the same modal
 * skeleton (overlay, panel shell, label + title header, footer button row)
 * that LineNoteModal and SubmitCloseConfirmationModal already use.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import LtrText from "../shared/LtrText";
import { publishReportVersion } from "../../engine";

function formatDateShort(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function PublishVersionModal({
  open,
  reportType,
  reportKey,
  snapshotData,
  asOfDate,
  periodFrom,
  periodTo,
  currentVersion,
  onClose,
  onPublished,
  onError,
}) {
  const { t } = useTranslation("financial");
  useEscapeKey(onClose, open);
  const [notes, setNotes] = useState("");
  const [supersedesId, setSupersedesId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errMsg, setErrMsg] = useState(null);

  useEffect(() => {
    if (!open) return;
    setNotes("");
    // Default to superseding the current version if one exists.
    setSupersedesId(currentVersion?.id ? currentVersion.id : "");
    setErrMsg(null);
    setSubmitting(false);
  }, [open, currentVersion]);

  if (!open) return null;

  const handleSubmit = async () => {
    setSubmitting(true);
    setErrMsg(null);
    try {
      const payload = {
        reportType,
        reportKey,
        snapshotData,
      };
      if (notes.trim()) payload.notes = notes.trim();
      if (supersedesId) payload.supersedesId = supersedesId;
      if (asOfDate) payload.asOfDate = asOfDate;
      if (periodFrom) payload.periodFrom = periodFrom;
      if (periodTo) payload.periodTo = periodTo;
      const row = await publishReportVersion(payload);
      setSubmitting(false);
      if (onPublished) onPublished(row);
      if (onClose) onClose();
    } catch (err) {
      setSubmitting(false);
      const message = err?.message || "Unknown error";
      setErrMsg(message);
      if (onError) onError(err);
    }
  };

  return (
    <>
      <div
        onClick={submitting ? undefined : onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
          zIndex: 300,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 520,
          maxWidth: "calc(100vw - 32px)",
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
              {t("versions.publish_modal.label")}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22,
                color: "var(--text-primary)",
                letterSpacing: "-0.2px",
                marginTop: 2,
              }}
            >
              {t("versions.publish_modal.title")}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("versions.close")}
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
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
            {t("versions.publish_modal.body")}
          </div>

          <div>
            <Label>{t("versions.publish_modal.field_notes")}</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("versions.publish_modal.notes_placeholder")}
              rows={4}
              maxLength={2000}
              style={{
                width: "100%",
                background: "var(--bg-surface-sunken)",
                border: "1px solid var(--border-default)",
                borderRadius: 8,
                padding: "10px 12px",
                color: "var(--text-primary)",
                fontSize: 13,
                fontFamily: "inherit",
                outline: "none",
                resize: "vertical",
              }}
            />
          </div>

          {currentVersion && (
            <div>
              <Label>{t("versions.publish_modal.field_supersedes")}</Label>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <SupersedeOption
                  checked={supersedesId === currentVersion.id}
                  onSelect={() => setSupersedesId(currentVersion.id)}
                  label={
                    <>
                      {t("versions.publish_modal.supersedes_label_prefix")}
                      <LtrText>{currentVersion.version}</LtrText>
                      {t("versions.publish_modal.supersedes_label_middle")}
                      <LtrText>{formatDateShort(currentVersion.publishedAt)}</LtrText>
                      {t("versions.publish_modal.supersedes_label_suffix")}
                    </>
                  }
                />
                <SupersedeOption
                  checked={!supersedesId}
                  onSelect={() => setSupersedesId("")}
                  label={t("versions.publish_modal.supersedes_none")}
                />
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-tertiary)",
                  marginTop: 6,
                  lineHeight: 1.5,
                }}
              >
                {t("versions.publish_modal.supersedes_help")}
              </div>
            </div>
          )}

          {errMsg && (
            <div
              role="alert"
              style={{
                background: "rgba(253,54,28,0.08)",
                border: "1px solid rgba(253,54,28,0.3)",
                color: "var(--semantic-danger)",
                padding: "10px 14px",
                borderRadius: 8,
                fontSize: 12,
              }}
            >
              {t("versions.publish_modal.error_toast", { message: errMsg })}
            </div>
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
          <button
            onClick={onClose}
            disabled={submitting}
            style={{
              background: "transparent",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-strong)",
              padding: "9px 16px",
              borderRadius: 6,
              cursor: submitting ? "not-allowed" : "pointer",
              fontSize: 12,
              fontFamily: "inherit",
            }}
          >
            {t("versions.publish_modal.cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              background: "var(--accent-primary)",
              color: "#fff",
              border: "none",
              padding: "9px 18px",
              borderRadius: 6,
              cursor: submitting ? "not-allowed" : "pointer",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {submitting ? (
              <>
                <Spinner size={13} />
                <LtrText>&nbsp;</LtrText>
                {t("versions.publish_modal.publishing")}
              </>
            ) : (
              t("versions.publish_modal.submit")
            )}
          </button>
        </div>
      </div>
    </>
  );
}

function Label({ children }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.15em",
        color: "var(--text-tertiary)",
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

function SupersedeOption({ checked, onSelect, label }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        textAlign: "start",
        background: checked ? "var(--accent-primary-subtle)" : "var(--bg-surface-sunken)",
        border: checked
          ? "1px solid var(--accent-primary-border)"
          : "1px solid var(--border-default)",
        color: checked ? "var(--accent-primary)" : "var(--text-secondary)",
        borderRadius: 8,
        padding: "10px 12px",
        cursor: "pointer",
        fontFamily: "inherit",
        fontSize: 12,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 12,
          height: 12,
          borderRadius: 6,
          border: checked
            ? "3px solid var(--accent-primary)"
            : "1px solid var(--border-strong)",
          background: "transparent",
          flexShrink: 0,
        }}
      />
      <span>{label}</span>
    </button>
  );
}
