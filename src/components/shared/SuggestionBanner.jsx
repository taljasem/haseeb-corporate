import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Repeat, X } from "lucide-react";

export default function SuggestionBanner({ suggestion, onApply, onDismiss }) {
  const { t } = useTranslation("bank-transactions");
  const [hidden, setHidden] = useState(false);
  if (hidden || !suggestion) return null;

  const title =
    suggestion.kind === "categorization"
      ? `${suggestion.count} similar: ${suggestion.merchant} → ${suggestion.target}`
      : suggestion.description;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 16px",
        background: "var(--semantic-warning-subtle)",
        borderInlineStart: "2px solid #D4A84B",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <Repeat size={14} color="var(--semantic-warning)" strokeWidth={2.2} />
      <div style={{ flex: 1, fontSize: 12, color: "var(--text-primary)" }}>
        {title}
        <span style={{ color: "var(--text-tertiary)", marginInlineStart: 8 }}>· {suggestion.context}</span>
      </div>
      <button
        onClick={() => onApply && onApply(suggestion)}
        style={{
          background: "var(--accent-primary)",
          color: "#fff",
          border: "none",
          padding: "6px 12px",
          borderRadius: 5,
          cursor: "pointer",
          fontSize: 11,
          fontWeight: 600,
          fontFamily: "inherit",
        }}
      >
        {t("suggestion_banner.apply_all")}
      </button>
      <button
        onClick={() => {
          setHidden(true);
          onDismiss && onDismiss(suggestion);
        }}
        aria-label={t("suggestion_banner.dismiss")}
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
    </div>
  );
}
