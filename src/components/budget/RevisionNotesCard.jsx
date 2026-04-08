import { useTranslation } from "react-i18next";
import { formatRelativeTime } from "../../utils/relativeTime";

export default function RevisionNotesCard({ notes, timestamp }) {
  const { t } = useTranslation("budget");
  return (
    <div
      style={{
        background: "rgba(212,168,75,0.06)",
        border: "1px solid rgba(212,168,75,0.25)",
        borderLeft: "3px solid #D4A84B",
        borderRadius: 8,
        padding: "12px 14px",
        marginBottom: 14,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.15em",
          color: "#D4A84B",
          marginBottom: 6,
        }}
      >
        {t("revision.label")}
      </div>
      <div style={{ fontSize: 13, color: "#E6EDF3", lineHeight: 1.6 }}>{notes}</div>
      <div style={{ fontSize: 10, color: "#5B6570", marginTop: 8, fontStyle: "italic" }}>
        {timestamp ? t("revision.requested_at", { time: formatRelativeTime(timestamp) }) : ""}{t("revision.from_cfo")}
      </div>
    </div>
  );
}
