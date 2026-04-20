/**
 * DisableTwoFactorModal — HASEEB-157 replacement for the legacy
 * `window.prompt()` TOTP collection. Mirrors the confirmation pattern of
 * EnableTwoFactorModal (verification-code input + submit/cancel). The
 * parent owns the submit logic so this component stays purely
 * presentational; that keeps error / toast plumbing identical to the
 * previous prompt-based flow in SettingsScreen.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, ShieldOff } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";

export default function DisableTwoFactorModal({ open, onClose, onSubmit, submitting }) {
  const { t } = useTranslation("settings");
  useEscapeKey(onClose, open);
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setCode("");
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async () => {
    if (code.length !== 6) {
      setError(t("disable_2fa_modal.validation_invalid_code"));
      return;
    }
    setError(null);
    await onSubmit(code);
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
        role="dialog"
        aria-modal="true"
        aria-label={t("disable_2fa_modal.title")}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 460,
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
              {t("disable_2fa_modal.label")}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22,
                color: "var(--text-primary)",
                letterSpacing: "-0.2px",
                marginTop: 2,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <ShieldOff size={18} color="var(--semantic-danger)" />
              {t("disable_2fa_modal.title")}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("disable_2fa_modal.close")}
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
              marginBottom: 14,
              lineHeight: 1.5,
            }}
          >
            {t("disable_2fa_modal.body")}
          </div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.12em",
              color: "var(--text-tertiary)",
              marginBottom: 6,
            }}
          >
            {t("disable_2fa_modal.field_code")}
          </div>
          <input
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
              setError(null);
            }}
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            autoFocus
            style={{
              width: "100%",
              background: "var(--bg-surface-sunken)",
              border: `1px solid ${error ? "var(--semantic-danger)" : "var(--border-default)"}`,
              borderRadius: 8,
              padding: "10px 12px",
              color: "var(--text-primary)",
              fontSize: 18,
              fontFamily: "'DM Mono', monospace",
              letterSpacing: "0.3em",
              outline: "none",
              textAlign: "center",
            }}
          />
          {error && (
            <div style={{ fontSize: 12, color: "var(--semantic-danger)", marginTop: 6 }}>
              {error}
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
            {t("disable_2fa_modal.cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || code.length !== 6}
            aria-busy={submitting}
            style={{
              background: "var(--semantic-danger)",
              color: "#fff",
              border: "none",
              padding: "9px 18px",
              borderRadius: 6,
              cursor: submitting || code.length !== 6 ? "not-allowed" : "pointer",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
              opacity: submitting || code.length !== 6 ? 0.6 : 1,
            }}
          >
            {submitting ? (
              <>
                <Spinner size={13} />
                &nbsp;{t("disable_2fa_modal.disabling")}
              </>
            ) : (
              t("disable_2fa_modal.disable")
            )}
          </button>
        </div>
      </div>
    </>
  );
}
