import { useTranslation } from "react-i18next";

export default function PlaceholderScreen({ title }) {
  const { t } = useTranslation("common");
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        overflow: "auto",
      }}
    >
      <div
        style={{
          maxWidth: 480,
          padding: "32px 36px",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 10,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 28,
            color: "#E6EDF3",
            letterSpacing: "-0.3px",
            marginBottom: 8,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 14, color: "#8B98A5", marginBottom: 10 }}>
          {t("placeholder.coming_next")}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "#5B6570",
            fontStyle: "italic",
            lineHeight: 1.55,
          }}
        >
          {t("placeholder.queued_desc")}
        </div>
      </div>
    </div>
  );
}
