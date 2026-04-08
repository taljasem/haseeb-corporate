import { useTranslation } from "react-i18next";
import { Repeat } from "lucide-react";

export default function SuggestedRuleRow({ suggestion, onCreate, onDismiss, compact = false }) {
  const { t } = useTranslation("rules");
  const title =
    suggestion.kind === "categorization"
      ? t("suggested.count_similar", { count: suggestion.count, merchant: suggestion.merchant, target: suggestion.target })
      : suggestion.description;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: compact ? "10px 12px" : "14px 18px",
        background: "rgba(212,168,75,0.04)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        borderLeft: "2px solid #D4A84B",
      }}
    >
      <span
        style={{
          width: 30,
          height: 30,
          borderRadius: 6,
          background: "rgba(212,168,75,0.12)",
          border: "1px solid rgba(212,168,75,0.30)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#D4A84B",
          flexShrink: 0,
        }}
      >
        <Repeat size={14} strokeWidth={2.2} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "#E6EDF3", fontWeight: 500 }}>{title}</div>
        <div style={{ fontSize: 11, color: "#5B6570", marginTop: 2 }}>{suggestion.context}</div>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button
          onClick={() => onCreate && onCreate(suggestion)}
          style={{
            background: "#00C48C",
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
          {t("suggested.create_rule")}
        </button>
        <button
          onClick={() => onDismiss && onDismiss(suggestion)}
          style={{
            background: "transparent",
            color: "#5B6570",
            border: "1px solid rgba(255,255,255,0.10)",
            padding: "6px 12px",
            borderRadius: 5,
            cursor: "pointer",
            fontSize: 11,
            fontFamily: "inherit",
          }}
        >
          {t("suggested.dismiss")}
        </button>
      </div>
    </div>
  );
}
