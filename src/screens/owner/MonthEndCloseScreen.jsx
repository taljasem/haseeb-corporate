import { useEffect, useState } from "react";
import { Check, Circle, Clock, AlertTriangle } from "lucide-react";
import AminahNarrationCard from "../../components/financial/AminahNarrationCard";
import Avatar from "../../components/taskbox/Avatar";
import { getMonthEndCloseTasks } from "../../engine/mockEngine";
import { formatRelativeTime } from "../../utils/relativeTime";

const STATUS = {
  complete:    { label: "COMPLETE",    color: "#5B6570",  Icon: Check,          iconColor: "#00C48C" },
  "in-progress": { label: "IN PROGRESS", color: "#3B82F6", Icon: Clock,          iconColor: "#3B82F6" },
  pending:     { label: "PENDING",     color: "#5B6570",  Icon: Circle,         iconColor: "#5B6570" },
  blocked:     { label: "BLOCKED",     color: "#FF5A5F",  Icon: AlertTriangle,  iconColor: "#FF5A5F" },
};

function ChecklistRow({ task, allTasksComplete }) {
  const s = STATUS[task.status] || STATUS.pending;
  const Icon = s.Icon;
  const isDone = task.status === "complete";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        opacity: isDone ? 0.7 : 1,
      }}
    >
      <Icon size={16} color={s.iconColor} strokeWidth={2.2} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            color: "#E6EDF3",
            textDecoration: isDone ? "line-through" : "none",
          }}
        >
          {task.name}
        </div>
      </div>
      <Avatar person={task.assignee} size={22} />
      <div style={{ minWidth: 120, fontSize: 11, color: "#5B6570" }}>
        {task.assignee.name.replace("You (CFO)", "You")}
      </div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.10em",
          color: s.color,
          minWidth: 100,
        }}
      >
        {s.label}
      </div>
      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 10,
          color: "#5B6570",
          minWidth: 80,
          textAlign: "right",
        }}
      >
        {task.completedAt
          ? formatRelativeTime(task.completedAt)
          : task.dueDate
            ? `Due ${formatRelativeTime(task.dueDate).replace("ago", "")}`
            : "—"}
      </div>
    </div>
  );
}

function Validation({ v, onResolve }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        fontSize: 13,
      }}
    >
      {v.passing ? (
        <Check size={14} color="#00C48C" strokeWidth={2.4} />
      ) : (
        <AlertTriangle size={14} color="#FF5A5F" strokeWidth={2.4} />
      )}
      <span style={{ color: v.passing ? "#8B98A5" : "#E6EDF3", flex: 1 }}>
        {v.name}
      </span>
      <span style={{ fontSize: 11, color: "#5B6570" }}>{v.detail}</span>
      {!v.passing && v.resolveScreen && (
        <a
          onClick={() => onResolve && onResolve(v.resolveScreen)}
          style={{ fontSize: 11, color: "#00C48C", cursor: "pointer" }}
        >
          Resolve →
        </a>
      )}
    </div>
  );
}

export default function MonthEndCloseScreen({ onNavigate }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    getMonthEndCloseTasks().then(setData);
  }, []);

  if (!data) return <div style={{ padding: 28, color: "#5B6570" }}>Loading…</div>;

  const complete = data.tasks.filter((t) => t.status === "complete").length;
  const total = data.tasks.length;
  const pct = Math.round((complete / total) * 100);
  const allComplete = complete === total;

  // Sort: complete first, in-progress next, pending last
  const order = { complete: 0, "in-progress": 1, pending: 2, blocked: 3 };
  const sorted = [...data.tasks].sort((a, b) => order[a.status] - order[b.status]);

  const statusPill = {
    "in-progress": { label: "IN PROGRESS", color: "#00C48C" },
    "ready":       { label: "READY FOR REVIEW", color: "#D4A84B" },
    "closed":      { label: "CLOSED", color: "#5B6570" },
  }[data.status] || { label: "IN PROGRESS", color: "#00C48C" };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px 32px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 18,
            flexWrap: "wrap",
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
              MONTH-END CLOSE
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
              {data.period.toUpperCase()}
            </div>
          </div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: statusPill.color,
              background: `${statusPill.color}14`,
              border: `1px solid ${statusPill.color}55`,
              padding: "5px 10px",
              borderRadius: 4,
            }}
          >
            {statusPill.label}
          </span>
        </div>

        <AminahNarrationCard text={data.aminahSummary} />

        {/* Progress */}
        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            padding: "16px 18px",
            marginBottom: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 22,
                color: "#E6EDF3",
                fontWeight: 500,
              }}
            >
              {complete} / {total}
            </div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.12em",
                color: "#5B6570",
              }}
            >
              TASKS COMPLETE · {pct}%
            </div>
          </div>
          <div
            style={{
              width: "100%",
              height: 4,
              background: "rgba(255,255,255,0.05)",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div style={{ width: `${pct}%`, height: "100%", background: "#00C48C" }} />
          </div>
        </div>

        {/* Checklist */}
        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            overflow: "hidden",
            marginBottom: 18,
          }}
        >
          <div
            style={{
              padding: "12px 14px",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.15em",
              color: "#5B6570",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            CLOSE CHECKLIST
          </div>
          {sorted.map((t) => (
            <ChecklistRow key={t.id} task={t} allTasksComplete={allComplete} />
          ))}
        </div>

        {/* Owner actions */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 20,
            flexWrap: "wrap",
          }}
        >
          <button
            disabled={!allComplete}
            style={{
              background: allComplete ? "#00C48C" : "rgba(0,196,140,0.25)",
              color: "#fff",
              border: "none",
              padding: "10px 18px",
              borderRadius: 6,
              cursor: allComplete ? "pointer" : "not-allowed",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            Approve March close
          </button>
          <button
            style={{
              background: "transparent",
              color: "#8B98A5",
              border: "1px solid rgba(255,255,255,0.15)",
              padding: "10px 16px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "inherit",
            }}
          >
            Request status update
          </button>
          <button
            disabled
            style={{
              background: "transparent",
              color: "#5B6570",
              border: "1px solid rgba(255,255,255,0.10)",
              padding: "10px 16px",
              borderRadius: 6,
              cursor: "not-allowed",
              fontSize: 12,
              fontFamily: "inherit",
              opacity: 0.6,
            }}
          >
            Lock period
          </button>
        </div>

        {/* Validations */}
        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 14px",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.15em",
              color: "#5B6570",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            PRE-CLOSE VALIDATIONS
          </div>
          {data.validations.map((v, i) => (
            <Validation key={i} v={v} onResolve={onNavigate} />
          ))}
        </div>
      </div>
    </div>
  );
}
