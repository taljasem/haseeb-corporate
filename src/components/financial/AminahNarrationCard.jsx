import { useTranslation } from "react-i18next";
import AminahTag from "../AminahTag";

function renderHighlighted(text) {
  const parts = (text || "").split(/(\[[^\]]+\])/g);
  return parts.map((p, i) => {
    if (p.startsWith("[") && p.endsWith("]")) {
      const inner = p.slice(1, -1);
      const isPos = /^\+/.test(inner) && !/over/i.test(inner);
      const isNeg = /over|overdue/i.test(inner) || (/^\+/.test(inner) && /over/i.test(inner));
      const color = isPos ? "var(--accent-primary)" : isNeg ? "var(--semantic-danger)" : "var(--text-primary)";
      const isNum = /KWD|%/.test(inner);
      return (
        <span
          key={i}
          style={{
            color,
            fontWeight: 500,
            fontFamily: isNum ? "'DM Mono', monospace" : "inherit",
          }}
        >
          {inner}
        </span>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

export default function AminahNarrationCard({ text, onAsk }) {
  const { t } = useTranslation("financial");
  return (
    <div
      style={{
        background: "var(--bg-surface-sunken)",
        border: "1px solid var(--border-default)",
        borderInlineStart: "2px solid #00C48C",
        borderRadius: 8,
        padding: "16px 18px",
        marginBottom: 18,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.15em",
            color: "var(--text-tertiary)",
          }}
        >
          {t("aminah_card.label")}
        </div>
        <AminahTag />
      </div>
      <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.65 }}>
        {renderHighlighted(text)}
      </div>
      {onAsk && (
        <div style={{ marginTop: 10 }}>
          <a
            onClick={onAsk}
            style={{ fontSize: 12, color: "var(--accent-primary)", cursor: "pointer" }}
          >
            {t("aminah_card.ask_about")}
          </a>
        </div>
      )}
    </div>
  );
}
