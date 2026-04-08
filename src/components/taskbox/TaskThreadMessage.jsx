import { Paperclip } from "lucide-react";
import Avatar from "./Avatar";
import { formatRelativeTime } from "../../utils/relativeTime";

function renderBold(text) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      const inner = p.slice(2, -2);
      const isNum = /\d/.test(inner);
      return (
        <span
          key={i}
          style={{
            color: "var(--text-primary)",
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

export default function TaskThreadMessage({ event }) {
  return (
    <div style={{ display: "flex", gap: 12, padding: "14px 0" }}>
      <Avatar person={event.author} size={28} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            marginBottom: 4,
          }}
        >
          <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>
            {event.author.name}
          </span>
          <span
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              color: "var(--text-tertiary)",
              marginInlineStart: "auto",
            }}
          >
            {formatRelativeTime(event.timestamp)}
          </span>
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
          }}
        >
          {renderBold(event.body)}
        </div>
        {event.attachments && event.attachments.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {event.attachments.map((a, i) => (
              <span
                key={i}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  background: "var(--bg-surface-sunken)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  padding: "5px 9px",
                  borderRadius: 4,
                }}
              >
                <Paperclip size={11} strokeWidth={2.2} />
                {a.name}
                <span style={{ color: "var(--text-tertiary)", fontFamily: "'DM Mono', monospace" }}>
                  · {a.size}
                </span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
