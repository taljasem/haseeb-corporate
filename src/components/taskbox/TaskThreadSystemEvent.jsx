import { formatRelativeTime } from "../../utils/relativeTime";

export default function TaskThreadSystemEvent({ event }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 0",
      }}
    >
      <span
        style={{
          flex: 1,
          height: 1,
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), rgba(255,255,255,0.06))",
        }}
      />
      <span
        style={{
          fontSize: 11,
          color: "var(--text-tertiary)",
          fontStyle: "italic",
          whiteSpace: "nowrap",
        }}
      >
        {event.systemEventDetail}
      </span>
      <span
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 10,
          color: "var(--text-tertiary)",
          whiteSpace: "nowrap",
        }}
      >
        {formatRelativeTime(event.timestamp)}
      </span>
      <span
        style={{
          flex: 1,
          height: 1,
          background:
            "linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.06), transparent)",
        }}
      />
    </div>
  );
}
