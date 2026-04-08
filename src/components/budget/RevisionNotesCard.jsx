import { useTranslation } from "react-i18next";
import { formatRelativeTime } from "../../utils/relativeTime";

export default function RevisionNotesCard({ notes, timestamp }) {
  const { t } = useTranslation("budget");
  return (
    <div
      style={{
        background: "rgba(212,168,75,0.06)",
        border: "1px solid rgba(212,168,75,0.25)",
        borderInlineStart: "3px solid #D4A84B",
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
          color: "var(--semantic-warning)",
          marginBottom: 6,
        }}
      >
        {t("revision.label")}
      </div>
      <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6 }}>{notes}</div>
      <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 8, fontStyle: "italic" }}>
        {timestamp ? t("revision.requested_at", { time: formatRelativeTime(timestamp) }) : ""}{t("revision.from_cfo")}
      </div>
    </div>
  );
}
