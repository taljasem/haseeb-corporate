import { useState } from "react";
import { Paperclip, ArrowLeft, MoreHorizontal, Link2 } from "lucide-react";
import Avatar from "./Avatar";
import TaskTypePill from "./TaskTypePill";
import TaskThread from "./TaskThread";
import { formatRelativeTime } from "../../utils/relativeTime";

const STATUS_STYLE = {
  open:        { bg: "rgba(0,196,140,0.10)", fg: "#00C48C", label: "OPEN" },
  "in-progress":{bg: "rgba(59,130,246,0.10)",fg: "#3B82F6", label: "IN PROGRESS" },
  completed:   { bg: "rgba(91,101,112,0.14)",fg: "#8B98A5", label: "COMPLETED" },
  cancelled:   { bg: "rgba(255,90,95,0.10)", fg: "#FF5A5F", label: "CANCELLED" },
};

function MetaItem({ label, children }) {
  return (
    <div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: "0.15em",
          color: "#5B6570",
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 12, color: "#E6EDF3", display: "flex", alignItems: "center", gap: 6 }}>
        {children}
      </div>
    </div>
  );
}

export default function TaskDetail({ task, onBack, onComplete, onReply }) {
  const [reply, setReply] = useState("");
  if (!task) return null;
  const status = STATUS_STYLE[task.status] || STATUS_STYLE.open;
  const isCompleted = task.status === "completed";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Top strip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 28px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}
      >
        <button
          onClick={onBack}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: "transparent",
            border: "none",
            color: "#00C48C",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.04em",
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <ArrowLeft size={13} strokeWidth={2.4} />
          Back to Taskbox
        </button>
        <div style={{ display: "flex", gap: 8 }}>
          {!isCompleted && (
            <button
              onClick={() => onComplete && onComplete(task)}
              style={{
                background: "#00C48C",
                color: "#fff",
                border: "none",
                padding: "8px 16px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "inherit",
              }}
            >
              Complete task
            </button>
          )}
          <button
            aria-label="More"
            style={{
              background: "transparent",
              color: "#5B6570",
              border: "1px solid rgba(255,255,255,0.10)",
              padding: 7,
              borderRadius: 6,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
            }}
          >
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>

      {/* Body scrolls */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px 24px" }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>
          {/* Subject */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              marginBottom: 18,
            }}
          >
            <h1
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 24,
                color: "#E6EDF3",
                letterSpacing: "-0.2px",
                margin: 0,
                lineHeight: 1.1,
              }}
            >
              {task.subject}
            </h1>
            <TaskTypePill type={task.type} size="md" />
          </div>

          {/* Meta row */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 24,
              padding: "14px 16px",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 8,
              marginBottom: 16,
            }}
          >
            <MetaItem label="FROM">
              <Avatar person={task.sender} size={20} />
              {task.sender.name}
            </MetaItem>
            <MetaItem label="TO">
              <Avatar person={task.recipient} size={20} />
              {task.recipient.name}
            </MetaItem>
            <MetaItem label="STATUS">
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.10em",
                  color: status.fg,
                  background: status.bg,
                  border: `1px solid ${status.fg}40`,
                  padding: "3px 8px",
                  borderRadius: 3,
                }}
              >
                {status.label}
              </span>
            </MetaItem>
            {task.dueDate && (
              <MetaItem label="DUE">
                {new Date(task.dueDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </MetaItem>
            )}
            <MetaItem label="CREATED">{formatRelativeTime(task.createdAt)}</MetaItem>
          </div>

          {/* Linked item */}
          {task.linkedItem && (
            <div
              style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.10)",
                borderLeft: "2px solid #3B82F6",
                borderRadius: 6,
                padding: "12px 14px",
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <Link2 size={14} color="#3B82F6" strokeWidth={2.2} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    letterSpacing: "0.15em",
                    color: "#5B6570",
                    marginBottom: 2,
                  }}
                >
                  {task.linkedItem.type.toUpperCase().replace("-", " ")}
                </div>
                <div style={{ fontSize: 13, color: "#E6EDF3" }}>
                  {task.linkedItem.preview}
                </div>
              </div>
              <a
                style={{
                  fontSize: 11,
                  color: "#00C48C",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Open →
              </a>
            </div>
          )}

          {/* Attachments row */}
          {task.attachments && task.attachments.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
              {task.attachments.map((a, i) => (
                <span
                  key={i}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11,
                    color: "#8B98A5",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    padding: "5px 10px",
                    borderRadius: 4,
                  }}
                >
                  <Paperclip size={11} strokeWidth={2.2} />
                  {a.name}
                  <span style={{ color: "#5B6570", fontFamily: "'DM Mono', monospace" }}>
                    · {a.size}
                  </span>
                </span>
              ))}
            </div>
          )}

          {/* Thread */}
          <div
            style={{
              borderTop: "1px solid rgba(255,255,255,0.06)",
              paddingTop: 4,
            }}
          >
            <TaskThread events={task.thread || []} />
          </div>
        </div>
      </div>

      {/* Reply composer */}
      {!isCompleted && (
        <div
          style={{
            padding: "14px 28px 18px",
            borderTop: "1px solid rgba(255,255,255,0.10)",
            flexShrink: 0,
          }}
        >
          <div style={{ maxWidth: 820, margin: "0 auto" }}>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Write a reply..."
              rows={3}
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 10,
                padding: "12px 14px",
                color: "#E6EDF3",
                fontSize: 13,
                fontFamily: "inherit",
                outline: "none",
                resize: "vertical",
                marginBottom: 10,
              }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                aria-label="Attach"
                style={{
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 6,
                  padding: "8px 10px",
                  color: "#5B6570",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                <Paperclip size={13} />
              </button>
              <button
                onClick={() => {
                  if (reply.trim()) {
                    onReply && onReply(task, reply);
                    setReply("");
                  }
                }}
                style={{
                  background: "#00C48C",
                  color: "#fff",
                  border: "none",
                  padding: "8px 18px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: "inherit",
                }}
              >
                Reply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
