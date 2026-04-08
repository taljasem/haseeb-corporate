import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Paperclip, ArrowLeft, MoreHorizontal, Link2 } from "lucide-react";
import Avatar from "./Avatar";
import TaskTypePill from "./TaskTypePill";
import TaskThread from "./TaskThread";
import { formatRelativeTime } from "../../utils/relativeTime";
import JournalEntryCard from "../cfo/JournalEntryCard";

const STATUS_STYLE = {
  open:             { bg: "rgba(0,196,140,0.10)",  fg: "#00C48C", key: "open" },
  "in-progress":    { bg: "rgba(59,130,246,0.10)", fg: "#3B82F6", key: "in_progress" },
  completed:        { bg: "rgba(91,101,112,0.14)", fg: "#8B98A5", key: "completed" },
  cancelled:        { bg: "rgba(91,101,112,0.14)", fg: "#8B98A5", key: "cancelled" },
  "needs-revision": { bg: "rgba(212,168,75,0.10)", fg: "#D4A84B", key: "needs_revision" },
  rejected:         { bg: "rgba(255,90,95,0.10)",  fg: "#FF5A5F", key: "rejected" },
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

export default function TaskDetail({ task, onBack, onComplete, onReply, onApprovalAction, currentUserId = "cfo" }) {
  const { t } = useTranslation("taskbox");
  const [reply, setReply] = useState("");
  const [approvalMode, setApprovalMode] = useState(null); // "request-changes" | "reject" | null
  const [approvalNote, setApprovalNote] = useState("");
  const [jePosted, setJePosted] = useState(false);
  if (!task) return null;
  const status = STATUS_STYLE[task.status] || STATUS_STYLE.open;
  const isCompleted = task.status === "completed" || task.status === "rejected" || task.status === "cancelled";
  const isApproval = task.type === "request-approval" || task.type === "approve-budget";
  const isSender = isApproval && task.sender.id === currentUserId;
  const hasJELinked = task.linkedItem && task.linkedItem.type === "journal-entry" && task.linkedItem.entry;

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
          <span className="rtl-flip" style={{ display: "inline-flex" }}><ArrowLeft size={13} strokeWidth={2.4} /></span>
          {t("detail.back")}
        </button>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!isCompleted && !isApproval && (
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
              {t("detail.complete")}
            </button>
          )}
          {!isCompleted && isSender && (
            <>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  color: "#D4A84B",
                  background: "rgba(212,168,75,0.08)",
                  border: "1px solid rgba(212,168,75,0.30)",
                  padding: "5px 10px",
                  borderRadius: 4,
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                {t("detail.awaiting_approval")}
              </span>
              <button
                onClick={() => onApprovalAction && onApprovalAction(task, "cancel")}
                style={{
                  background: "transparent",
                  color: "#8B98A5",
                  border: "1px solid rgba(255,255,255,0.15)",
                  padding: "8px 14px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "inherit",
                }}
              >
                {t("detail.cancel_request")}
              </button>
            </>
          )}
          {!isCompleted && isApproval && !isSender && (
            <>
              <button
                onClick={() => {
                  setJePosted(true);
                  onApprovalAction && onApprovalAction(task, "approve");
                  onComplete && onComplete(task);
                }}
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
                {t("detail.approve")}
              </button>
              <button
                onClick={() => setApprovalMode(approvalMode === "request-changes" ? null : "request-changes")}
                style={{
                  background: "transparent",
                  color: "#D4A84B",
                  border: "1px solid rgba(212,168,75,0.30)",
                  padding: "8px 14px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "inherit",
                }}
              >
                {t("detail.request_changes")}
              </button>
              <button
                onClick={() => setApprovalMode(approvalMode === "reject" ? null : "reject")}
                style={{
                  background: "transparent",
                  color: "#FF5A5F",
                  border: "1px solid rgba(255,90,95,0.30)",
                  padding: "8px 14px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "inherit",
                }}
              >
                {t("detail.reject")}
              </button>
              <button
                onClick={() => onApprovalAction && onApprovalAction(task, "escalate")}
                style={{
                  background: "transparent",
                  color: "#8B5CF6",
                  border: "1px solid rgba(139,92,246,0.30)",
                  padding: "8px 14px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  fontFamily: "inherit",
                }}
              >
                {t("detail.escalate")}
              </button>
            </>
          )}
          <button
            aria-label={t("detail.more")}
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
            <MetaItem label={t("detail.meta_from")}>
              <Avatar person={task.sender} size={20} />
              {task.sender.name}
            </MetaItem>
            <MetaItem label={t("detail.meta_to")}>
              <Avatar person={task.recipient} size={20} />
              {task.recipient.name}
            </MetaItem>
            <MetaItem label={t("detail.meta_status")}>
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
                {t(`status.${status.key}`)}
              </span>
            </MetaItem>
            {task.dueDate && (
              <MetaItem label={t("detail.meta_due")}>
                {new Date(task.dueDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </MetaItem>
            )}
            <MetaItem label={t("detail.meta_created")}>{formatRelativeTime(task.createdAt)}</MetaItem>
          </div>

          {isSender && !isCompleted && (
            <div
              style={{
                fontSize: 12,
                color: "#5B6570",
                marginBottom: 14,
                fontStyle: "italic",
              }}
            >
              {t("detail.waiting_for", { name: task.recipient.name })}
            </div>
          )}

          {/* Approval inline reason composer */}
          {isApproval && !isCompleted && approvalMode && (
            <div
              style={{
                background: "rgba(255,255,255,0.02)",
                border: `1px solid ${approvalMode === "reject" ? "rgba(255,90,95,0.30)" : "rgba(212,168,75,0.30)"}`,
                borderRadius: 8,
                padding: "12px 14px",
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.15em",
                  color: approvalMode === "reject" ? "#FF5A5F" : "#D4A84B",
                  marginBottom: 8,
                }}
              >
                {approvalMode === "reject" ? t("detail.reason_rejection") : t("detail.describe_changes")}
              </div>
              <textarea
                value={approvalNote}
                onChange={(e) => setApprovalNote(e.target.value)}
                rows={3}
                placeholder={approvalMode === "reject" ? t("detail.reject_placeholder") : t("detail.changes_placeholder")}
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  borderRadius: 8,
                  padding: "10px 12px",
                  color: "#E6EDF3",
                  fontSize: 13,
                  fontFamily: "inherit",
                  outline: "none",
                  marginBottom: 10,
                  resize: "vertical",
                }}
              />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  onClick={() => { setApprovalMode(null); setApprovalNote(""); }}
                  style={{
                    background: "transparent",
                    color: "#8B98A5",
                    border: "1px solid rgba(255,255,255,0.15)",
                    padding: "7px 14px",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 12,
                    fontFamily: "inherit",
                  }}
                >
                  {t("detail.cancel")}
                </button>
                <button
                  onClick={() => {
                    onApprovalAction && onApprovalAction(task, approvalMode, approvalNote);
                    setApprovalMode(null);
                    setApprovalNote("");
                  }}
                  disabled={!approvalNote.trim()}
                  style={{
                    background: approvalNote.trim() ? "#00C48C" : "rgba(0,196,140,0.25)",
                    color: "#fff",
                    border: "none",
                    padding: "7px 14px",
                    borderRadius: 6,
                    cursor: approvalNote.trim() ? "pointer" : "not-allowed",
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: "inherit",
                  }}
                >
                  {t("detail.submit")}
                </button>
              </div>
            </div>
          )}

          {/* Rich linked item — JE preview for approval tasks */}
          {isApproval && hasJELinked && (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.15em",
                  color: "#5B6570",
                  marginBottom: 6,
                }}
              >
                {t("detail.linked_je")}
              </div>
              <JournalEntryCard
                entry={task.linkedItem.entry}
                state={jePosted ? "posted" : "suggested"}
              />
            </div>
          )}

          {/* Linked item */}
          {task.linkedItem && !(isApproval && hasJELinked) && (
            <div
              style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.10)",
                borderInlineStart: "2px solid #3B82F6",
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
                {t("detail.open_link")}
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
              placeholder={t("detail.reply_placeholder")}
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
                aria-label={t("detail.attach")}
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
                {t("detail.reply")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
