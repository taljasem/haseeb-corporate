import { useTranslation } from "react-i18next";
import AminahTag from "../AminahTag";

function renderHighlighted(text) {
  const parts = (text || "").split(/(\[[^\]]+\])/g);
  return parts.map((p, i) => {
    if (p.startsWith("[") && p.endsWith("]")) {
      const inner = p.slice(1, -1);
      const isPos = /^\+/.test(inner) && !/over/i.test(inner);
      const isNeg = /over|overdue/i.test(inner) || (/^\+/.test(inner) && /over/i.test(inner));
      const color = isPos ? "#00C48C" : isNeg ? "#FF5A5F" : "#E6EDF3";
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
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
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
            color: "#5B6570",
          }}
        >
          {t("aminah_card.label")}
        </div>
        <AminahTag />
      </div>
      <div style={{ fontSize: 14, color: "#8B98A5", lineHeight: 1.65 }}>
        {renderHighlighted(text)}
      </div>
      {onAsk && (
        <div style={{ marginTop: 10 }}>
          <a
            onClick={onAsk}
            style={{ fontSize: 12, color: "#00C48C", cursor: "pointer" }}
          >
            {t("aminah_card.ask_about")}
          </a>
        </div>
      )}
    </div>
  );
}
