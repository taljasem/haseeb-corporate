import { AlertTriangle, X } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * ErrorBanner — inline error feedback for failed async operations.
 * Props:
 *   message    – string error to display
 *   onRetry    – optional retry callback
 *   onDismiss  – optional dismiss callback
 */
export default function ErrorBanner({ message, onRetry, onDismiss }) {
  const { t } = useTranslation("common");
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        background: "var(--semantic-danger-subtle)",
        border: "1px solid var(--semantic-danger)",
        borderRadius: 8,
        marginBottom: 12,
      }}
    >
      <AlertTriangle size={16} color="var(--semantic-danger)" strokeWidth={2.2} aria-hidden="true" />
      <div style={{ flex: 1, fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5 }}>
        {message}
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            background: "transparent",
            color: "var(--semantic-danger)",
            border: "1px solid var(--semantic-danger)",
            padding: "6px 12px",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
            fontFamily: "inherit",
          }}
        >
          {t("error_states.retry")}
        </button>
      )}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("aria.close")}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-tertiary)",
            cursor: "pointer",
            padding: 4,
            display: "flex",
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
