import { useEffect, useState, useCallback } from "react";
import { Search, Plus, Inbox } from "lucide-react";
import {
  getTaskbox,
  getTaskboxCounts,
  completeTask as engineCompleteTask,
  replyToTask as engineReplyToTask,
  cancelTask as engineCancelTask,
} from "../../engine/mockEngine";

const ROLE_TO_USER_ID = { CFO: "cfo", Owner: "owner", Junior: "sara" };
import TaskRow from "./TaskRow";
import TaskDetail from "./TaskDetail";
import NewTaskModal from "./NewTaskModal";

const FILTERS = [
  { id: "all",          label: "All" },
  { id: "unread",       label: "Unread" },
  { id: "approvals",    label: "Approvals" },
  { id: "received",     label: "Received" },
  { id: "sent",         label: "Sent" },
  { id: "needs-action", label: "Needs action" },
  { id: "completed",    label: "Completed" },
];

export default function TaskboxScreen({ role = "CFO", initialTaskId = null, initialFilter = null }) {
  const [tasks, setTasks] = useState(null);
  const [filter, setFilter] = useState(initialFilter || "all");
  useEffect(() => {
    if (initialFilter) setFilter(initialFilter);
  }, [initialFilter]);
  const [query, setQuery] = useState("");
  const [openTaskId, setOpenTaskId] = useState(initialTaskId);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const refresh = useCallback(() => setRefreshTick((t) => t + 1), []);
  const [counts, setCounts] = useState({});

  useEffect(() => {
    getTaskbox(role, filter).then(setTasks);
    getTaskboxCounts(role).then(setCounts);
  }, [role, filter, refreshTick]);

  useEffect(() => {
    if (initialTaskId) setOpenTaskId(initialTaskId);
  }, [initialTaskId]);

  const filtered = (tasks || []).filter((t) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      t.subject.toLowerCase().includes(q) ||
      t.body.toLowerCase().includes(q) ||
      t.sender.name.toLowerCase().includes(q) ||
      t.recipient.name.toLowerCase().includes(q)
    );
  });

  const openTask = tasks && openTaskId ? tasks.find((t) => t.id === openTaskId) : null;

  const openCount = (tasks || []).filter((t) => t.status !== "completed").length;

  if (openTask) {
    return (
      <TaskDetail
        task={openTask}
        currentUserId={ROLE_TO_USER_ID[role] || "cfo"}
        onBack={() => setOpenTaskId(null)}
        onComplete={async (t) => {
          await engineCompleteTask(t.id, null, role === "CFO" ? "cfo" : role === "Owner" ? "owner" : "sara");
          refresh();
        }}
        onReply={async (t, body) => {
          await engineReplyToTask(t.id, body, role === "CFO" ? "cfo" : role === "Owner" ? "owner" : "sara");
          refresh();
        }}
        onApprovalAction={async (t, action, note) => {
          const author = role === "CFO" ? "cfo" : role === "Owner" ? "owner" : "sara";
          if (action === "approve") {
            await engineCompleteTask(t.id, "Approved.", author);
          } else if (action === "request-changes") {
            await engineReplyToTask(t.id, `[Requested changes] ${note}`, author);
          } else if (action === "reject") {
            await engineReplyToTask(t.id, `[Rejected] ${note}`, author);
          } else if (action === "escalate") {
            await engineReplyToTask(t.id, "[Escalated]", author);
          } else if (action === "cancel") {
            await engineCancelTask(t.id, author);
            setOpenTaskId(null);
            setToast("Request cancelled");
            setTimeout(() => setToast(null), 2000);
          }
          refresh();
        }}
      />
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div
        style={{
          padding: "20px 28px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 28,
                color: "#E6EDF3",
                letterSpacing: "-0.3px",
                lineHeight: 1,
              }}
            >
              TASKBOX
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.15em",
                color: "#5B6570",
                marginTop: 6,
              }}
            >
              {openCount} OPEN
            </div>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "#00C48C",
              color: "#fff",
              border: "none",
              padding: "9px 16px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            <Plus size={14} strokeWidth={2.4} />
            New task
          </button>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", gap: 4 }}>
            {FILTERS.map((f) => {
              const on = filter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: on ? "#00C48C" : "#5B6570",
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    padding: "8px 12px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    boxShadow: on ? "inset 0 -2px 0 #00C48C" : "none",
                    transition: "all 0.12s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!on) e.currentTarget.style.color = "#8B98A5";
                  }}
                  onMouseLeave={(e) => {
                    if (!on) e.currentTarget.style.color = "#5B6570";
                  }}
                >
                  {f.label}
                  {counts[f.id] != null && (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 10,
                        color: on ? "#00C48C" : "#5B6570",
                        fontFamily: "'DM Mono', monospace",
                        letterSpacing: "0.05em",
                      }}
                    >
                      · {counts[f.id]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div style={{ position: "relative", width: 260 }}>
            <Search
              size={13}
              color="#5B6570"
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
              }}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks..."
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: 8,
                padding: "8px 12px 8px 30px",
                color: "#E6EDF3",
                fontSize: 12,
                fontFamily: "inherit",
                outline: "none",
              }}
            />
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          style={{
            margin: "12px 28px 0",
            background: "rgba(0,196,140,0.10)",
            border: "1px solid rgba(0,196,140,0.30)",
            color: "#00C48C",
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          {toast}
        </div>
      )}

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <div
            style={{
              padding: "60px 28px",
              textAlign: "center",
              color: "#5B6570",
            }}
          >
            <Inbox size={28} strokeWidth={1.6} style={{ opacity: 0.5, marginBottom: 10 }} />
            <div style={{ fontSize: 13 }}>No tasks in {filter}</div>
          </div>
        ) : (
          filtered.map((t) => (
            <TaskRow key={t.id} task={t} onClick={(task) => setOpenTaskId(task.id)} />
          ))
        )}
      </div>

      <NewTaskModal
        open={modalOpen}
        role={role}
        onClose={() => setModalOpen(false)}
        onSent={(t) => {
          setToast(`Task sent to ${t.recipient.name}`);
          refresh();
          setTimeout(() => setToast(null), 3000);
        }}
      />
    </div>
  );
}
