import { useTranslation } from "react-i18next";
import { formatRelativeTime } from "../../utils/relativeTime";

export default function RuleAuditTrail({ events = [] }) {
  const { t } = useTranslation("rules");
  if (!events || events.length === 0) {
    return (
      <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontStyle: "italic" }}>
        {t("detail.no_audit_events")}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {events.map((ev) => (
        <div
          key={ev.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 0",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
            fontSize: 12,
          }}
        >
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.10em",
              color: "var(--text-tertiary)",
              background: "var(--bg-surface-sunken)",
              border: "1px solid rgba(255,255,255,0.08)",
              padding: "2px 7px",
              borderRadius: 3,
              textTransform: "uppercase",
              minWidth: 64,
              textAlign: "center",
            }}
          >
            {ev.type.replace("-", " ")}
          </span>
          <span style={{ flex: 1, color: "var(--text-secondary)" }}>{ev.detail}</span>
          <span
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              color: "var(--text-tertiary)",
            }}
          >
            {formatRelativeTime(ev.timestamp)}
          </span>
        </div>
      ))}
    </div>
  );
}
