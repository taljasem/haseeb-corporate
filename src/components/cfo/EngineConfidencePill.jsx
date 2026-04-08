import { useTranslation } from "react-i18next";

const STYLES = {
  RULE:    { bg: "var(--accent-primary)",            fg: "var(--bg-base)", border: "transparent",            key: "rule"    },
  PATTERN: { bg: "var(--semantic-info)",            fg: "#FFFFFF", border: "transparent",            key: "pattern" },
  AI:      { bg: "rgba(212,168,75,0.18)", fg: "var(--semantic-warning)", border: "rgba(212,168,75,0.4)", key: "ai" },
  NONE:    { bg: "transparent",        fg: "var(--semantic-danger)", border: "rgba(255,90,95,0.5)",    key: "none" },
};

export default function EngineConfidencePill({ confidence }) {
  const { t } = useTranslation("bank-transactions");
  const s = STYLES[confidence] || STYLES.NONE;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.10em",
        color: s.fg,
        background: s.bg,
        border: `1px solid ${s.border === "transparent" ? s.bg : s.border}`,
        padding: "3px 8px",
        borderRadius: 3,
        whiteSpace: "nowrap",
      }}
    >
      {t(`confidence.${s.key}`)}
    </span>
  );
}
