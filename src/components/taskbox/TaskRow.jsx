import { useTranslation } from "react-i18next";
import { Paperclip, Link2 } from "lucide-react";
import Avatar from "./Avatar";
import LtrText from "../shared/LtrText";
import TaskTypePill from "./TaskTypePill";
import { formatRelativeTime } from "../../utils/relativeTime";

function DueDatePill({ dueIso }) {
  const { t } = useTranslation("taskbox");
  if (!dueIso) return null;
  const due = new Date(dueIso);
  const now = new Date();
  const diffH = (due - now) / (1000 * 60 * 60);
  let color = "var(--text-tertiary)";
  let bg = "rgba(91,101,112,0.12)";
  if (diffH < 0) {
    color = "var(--semantic-danger)";
    bg = "rgba(255,90,95,0.12)";
  } else if (diffH < 24) {
    color = "var(--semantic-warning)";
    bg = "rgba(212,168,75,0.12)";
  }
  const label =
    diffH < 0
      ? t("row.overdue")
      : t("row.due_date", { date: due.toLocaleDateString("en-US", { month: "short", day: "numeric" }) });
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.05em",
        color,
        background: bg,
        border: `1px solid ${color}40`,
        padding: "3px 7px",
        borderRadius: 3,
      }}
    >
      {label}
    </span>
  );
}

export default function TaskRow({ task, onClick, compact = false, selectable = false, selected = false, onToggleSelect }) {
  const hasAttachments = task.attachments && task.attachments.length > 0;
  const attachmentCount = hasAttachments ? task.attachments.length : 0;
  return (
    <div
      onClick={() => onClick && onClick(task)}
      onMouseEnter={(e) => (e.currentTarget.style.background = selected ? "var(--accent-primary-subtle)" : "var(--bg-surface-sunken)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = selected ? "var(--accent-primary-subtle)" : "transparent")}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: compact ? "10px 12px" : "12px 16px",
        borderBottom: "1px solid var(--border-subtle)",
        cursor: "pointer",
        transition: "background 0.12s ease",
        background: selected ? "var(--accent-primary-subtle)" : undefined,
      }}
    >
      {selectable && (
        <input
          type="checkbox"
          checked={selected}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => { e.stopPropagation(); onToggleSelect && onToggleSelect(task); }}
          style={{ cursor: "pointer", flexShrink: 0 }}
        />
      )}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <Avatar person={task.sender} size={compact ? 24 : 28} />
        {task.unread && (
          <span
            style={{
              position: "absolute",
              top: -1,
              right: -1,
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "var(--accent-primary)",
              border: "1.5px solid #05070A",
            }}
          />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 3,
          }}
        >
          <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>
            {task.sender.name}
          </span>
          <TaskTypePill type={task.type} size="sm" />
          {task.linkedItem && !compact && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: "0.05em",
                color: "var(--text-tertiary)",
                background: "var(--bg-surface-sunken)",
                border: "1px solid var(--border-default)",
                padding: "3px 6px",
                borderRadius: 3,
              }}
            >
              <Link2 size={9} strokeWidth={2.4} />
              <LtrText>{task.linkedItem.id}</LtrText>
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--text-primary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {task.subject}
          {!compact && (
            <>
              <span style={{ color: "var(--text-tertiary)", margin: "0 6px" }}>·</span>
              <span style={{ color: "var(--text-secondary)" }}>{task.body}</span>
            </>
          )}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
        }}
      >
        {hasAttachments && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, color: "var(--text-tertiary)", fontFamily: "'DM Mono', monospace" }}>
            <Paperclip size={12} strokeWidth={2.2} />
            <LtrText>{attachmentCount}</LtrText>
          </span>
        )}
        {task.dueDate && task.status !== "completed" && <DueDatePill dueIso={task.dueDate} />}
        <span
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 11,
            color: "var(--text-tertiary)",
            whiteSpace: "nowrap",
          }}
        >
          {formatRelativeTime(task.updatedAt)}
        </span>
      </div>
    </div>
  );
}
