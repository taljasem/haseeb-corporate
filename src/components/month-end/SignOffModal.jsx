/**
 * SignOffModal (FN-227, Phase 4 Wave 1 Item 3).
 *
 * OWNER-only confirmation modal for
 *   POST /api/monthly-close-checklist/instances/:id/sign-off
 *
 * The backend enforces two hard rules:
 *   1. Instance.status must be COMPLETED (all items COMPLETED).
 *   2. Segregation of Duties: the signing user MUST NOT be any item's
 *      completedBy. Server returns a 4xx with a descriptive message.
 *
 * This modal pre-checks #2 client-side so the button can be disabled
 * with a hint; the authoritative enforcement is the server response.
 * If the server rejects, we surface the message verbatim.
 *
 * Styled as a sibling to SubmitCloseConfirmationModal / RejectCloseModal
 * (same structural shape, no new DS primitives).
 */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, ShieldCheck, AlertTriangle } from "lucide-react";
import Spinner from "../shared/Spinner";
import ActionButton from "../ds/ActionButton";
import LtrText from "../shared/LtrText";
import useEscapeKey from "../../hooks/useEscapeKey";
import { signOffInstance } from "../../engine";

export default function SignOffModal({ open, instance, currentUserId, onClose, onSignedOff }) {
  const { t } = useTranslation("close");
  useEscapeKey(onClose, open);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);

  // Pre-check: is the current user a completer? If yes the server will
  // reject, so we disable the button and surface the SoD message.
  const signerIsCompleter = useMemo(() => {
    if (!instance || !currentUserId) return false;
    return (instance.items || []).some((i) => i.completedBy === currentUserId);
  }, [instance, currentUserId]);

  // Unique list of completers for display.
  const completers = useMemo(() => {
    if (!instance) return [];
    const seen = new Map();
    (instance.items || []).forEach((i) => {
      if (i.completedBy && !seen.has(i.completedBy)) {
        seen.set(i.completedBy, i.completedByName || i.completedBy);
      }
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [instance]);

  if (!open || !instance) return null;

  const handleConfirm = async () => {
    if (signerIsCompleter) return;
    setSubmitting(true);
    setServerError(null);
    try {
      const updated = await signOffInstance(instance.id);
      if (onSignedOff) onSignedOff(updated);
      if (onClose) onClose();
    } catch (err) {
      // Surface the backend message verbatim; it will describe the SoD
      // violation or whatever other precondition failed.
      setServerError(err?.message || t("checklist.sign_off.error_generic"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--overlay-backdrop)",
          backdropFilter: "blur(4px)",
          zIndex: 330,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("checklist.sign_off.modal_title")}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 500,
          maxWidth: "calc(100vw - 32px)",
          background: "var(--bg-surface-raised)",
          border: "1px solid var(--border-default)",
          borderRadius: 12,
          zIndex: 331,
          display: "flex",
          flexDirection: "column",
          boxShadow: "var(--shadow-xl)",
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
              {t("checklist.sign_off.modal_label")}
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
              {t("checklist.sign_off.modal_title")}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("checklist.sign_off.close")}
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

        <div style={{ padding: "18px 22px" }}>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              marginBottom: 14,
            }}
          >
            {t("checklist.sign_off.body")}
          </div>

          {/* SoD summary */}
          <div
            style={{
              background: "var(--bg-surface-sunken)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 8,
              padding: "12px 14px",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.12em",
                color: "var(--text-tertiary)",
                marginBottom: 8,
              }}
            >
              {t("checklist.sign_off.completers_label")}
            </div>
            {completers.length === 0 ? (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-tertiary)",
                  fontStyle: "italic",
                }}
              >
                {t("checklist.sign_off.no_completers")}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {completers.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      fontSize: 12,
                      color: "var(--text-primary)",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <LtrText>{c.name}</LtrText>
                    {c.id === currentUserId && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          color: "var(--semantic-danger)",
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: "var(--semantic-danger-subtle)",
                        }}
                      >
                        {t("checklist.sign_off.you_badge")}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Client-side SoD warning */}
          {signerIsCompleter && (
            <div
              role="alert"
              style={{
                background: "var(--semantic-danger-subtle)",
                border: "1px solid var(--semantic-danger)",
                borderRadius: 8,
                padding: "10px 12px",
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                marginBottom: 12,
              }}
            >
              <AlertTriangle
                size={16}
                color="var(--semantic-danger)"
                style={{ flexShrink: 0, marginTop: 1 }}
              />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--semantic-danger)",
                    marginBottom: 2,
                  }}
                >
                  {t("checklist.sign_off.sod_blocked_title")}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
                  {t("checklist.sign_off.sod_blocked_desc")}
                </div>
              </div>
            </div>
          )}

          {/* Server error surfacing */}
          {serverError && (
            <div
              role="alert"
              style={{
                background: "var(--semantic-danger-subtle)",
                border: "1px solid var(--semantic-danger)",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 12,
                color: "var(--semantic-danger)",
                lineHeight: 1.5,
              }}
            >
              {serverError}
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
          <ActionButton
            variant="secondary"
            label={t("checklist.sign_off.cancel")}
            disabled={submitting}
            onClick={onClose}
          />
          <button
            onClick={handleConfirm}
            disabled={submitting || signerIsCompleter}
            style={{
              background: "var(--accent-primary)",
              color: "#fff",
              border: "none",
              padding: "9px 18px",
              borderRadius: 6,
              cursor: submitting || signerIsCompleter ? "not-allowed" : "pointer",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
              opacity: submitting || signerIsCompleter ? 0.45 : 1,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
            title={signerIsCompleter ? t("checklist.sign_off.sod_blocked_hint") : undefined}
          >
            {submitting ? (
              <>
                <Spinner size={13} />
                &nbsp;{t("checklist.sign_off.submitting")}
              </>
            ) : (
              <>
                <ShieldCheck size={13} />
                {t("checklist.sign_off.confirm")}
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
