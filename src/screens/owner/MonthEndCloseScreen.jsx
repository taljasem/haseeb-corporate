import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Circle, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import EmptyState from "../../components/shared/EmptyState";
import AminahNarrationCard from "../../components/financial/AminahNarrationCard";
import Avatar from "../../components/taskbox/Avatar";
import { getMonthEndCloseTasks } from "../../engine/mockEngine";
import { formatRelativeTime } from "../../utils/relativeTime";

const STATUS = {
  complete:    { key: "complete",    color: "var(--text-tertiary)",  Icon: Check,          iconColor: "var(--accent-primary)" },
  "in-progress": { key: "in_progress", color: "var(--semantic-info)", Icon: Clock,          iconColor: "var(--semantic-info)" },
  pending:     { key: "pending",     color: "var(--text-tertiary)",  Icon: Circle,         iconColor: "var(--text-tertiary)" },
  blocked:     { key: "blocked",     color: "var(--semantic-danger)",  Icon: AlertTriangle,  iconColor: "var(--semantic-danger)" },
};

function ChecklistRow({ task, allTasksComplete }) {
  const { t } = useTranslation("close");
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
            color: "var(--text-primary)",
            textDecoration: isDone ? "line-through" : "none",
          }}
        >
          {task.name}
        </div>
      </div>
      <Avatar person={task.assignee} size={22} />
      <div style={{ minWidth: 120, fontSize: 11, color: "var(--text-tertiary)" }}>
        {task.assignee.name.replace("You (CFO)", t("you_cfo_self"))}
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
        {t(`task_status.${s.key}`)}
      </div>
      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 10,
          color: "var(--text-tertiary)",
          minWidth: 80,
          textAlign: "end",
        }}
      >
        {task.completedAt
          ? formatRelativeTime(task.completedAt)
          : task.dueDate
            ? t("due_label", { time: formatRelativeTime(task.dueDate).replace("ago", "") })
            : "—"}
      </div>
    </div>
  );
}

function Validation({ v, onResolve }) {
  const { t } = useTranslation("close");
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
        <Check size={14} color="var(--accent-primary)" strokeWidth={2.4} />
      ) : (
        <AlertTriangle size={14} color="var(--semantic-danger)" strokeWidth={2.4} />
      )}
      <span style={{ color: v.passing ? "var(--text-secondary)" : "var(--text-primary)", flex: 1 }}>
        {v.name}
      </span>
      <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{v.detail}</span>
      {!v.passing && v.resolveScreen && (
        <a
          onClick={() => onResolve && onResolve(v.resolveScreen)}
          style={{ fontSize: 11, color: "var(--accent-primary)", cursor: "pointer" }}
        >
          {t("resolve")}
        </a>
      )}
    </div>
  );
}

export default function MonthEndCloseScreen({ onNavigate }) {
  const { t } = useTranslation("close");
  const { t: tc } = useTranslation("common");
  const [data, setData] = useState(null);
  useEffect(() => {
    getMonthEndCloseTasks().then(setData);
  }, []);

  if (!data) return <div style={{ padding: 28, color: "var(--text-tertiary)" }}>{t("loading")}</div>;

  const complete = data.tasks.filter((t) => t.status === "complete").length;
  const total = data.tasks.length;
  const pct = Math.round((complete / total) * 100);
  const allComplete = complete === total;

  // Sort: complete first, in-progress next, pending last
  const order = { complete: 0, "in-progress": 1, pending: 2, blocked: 3 };
  const sorted = [...data.tasks].sort((a, b) => order[a.status] - order[b.status]);

  const statusPill = {
    "in-progress": { key: "in_progress", color: "var(--accent-primary)" },
    "ready":       { key: "ready", color: "var(--semantic-warning)" },
    "closed":      { key: "closed", color: "var(--text-tertiary)" },
  }[data.status] || { key: "in_progress", color: "var(--accent-primary)" };

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
                color: "var(--text-primary)",
                letterSpacing: "-0.3px",
                lineHeight: 1,
              }}
            >
              {t("title")}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.15em",
                color: "var(--text-tertiary)",
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
            {t(`status_pill.${statusPill.key}`)}
          </span>
        </div>

        <AminahNarrationCard text={data.aminahSummary} />

        {/* Progress */}
        <div
          style={{
            background: "var(--bg-surface)",
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
                color: "var(--text-primary)",
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
                color: "var(--text-tertiary)",
              }}
            >
              {t("tasks_complete_label", { pct })}
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
            <div style={{ width: `${pct}%`, height: "100%", background: "var(--accent-primary)" }} />
          </div>
        </div>

        {/* Checklist */}
        <div
          style={{
            background: "var(--bg-surface)",
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
              color: "var(--text-tertiary)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {t("close_checklist")}
          </div>
          {data.tasks.length === 0 && (
            <EmptyState
              icon={CheckCircle2}
              title={tc("empty_states.close_no_tasks_title")}
              description={tc("empty_states.close_no_tasks_desc")}
            />
          )}
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
              background: allComplete ? "var(--accent-primary)" : "rgba(0,196,140,0.25)",
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
            {t("approve_close")}
          </button>
          <button
            style={{
              background: "transparent",
              color: "var(--text-secondary)",
              border: "1px solid rgba(255,255,255,0.15)",
              padding: "10px 16px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "inherit",
            }}
          >
            {t("request_status_update")}
          </button>
          <button
            disabled
            style={{
              background: "transparent",
              color: "var(--text-tertiary)",
              border: "1px solid rgba(255,255,255,0.10)",
              padding: "10px 16px",
              borderRadius: 6,
              cursor: "not-allowed",
              fontSize: 12,
              fontFamily: "inherit",
              opacity: 0.6,
            }}
          >
            {t("lock_period")}
          </button>
        </div>

        {/* Validations */}
        <div
          style={{
            background: "var(--bg-surface)",
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
              color: "var(--text-tertiary)",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {t("preclose_validations")}
          </div>
          {data.validations.map((v, i) => (
            <Validation key={i} v={v} onResolve={onNavigate} />
          ))}
        </div>
      </div>
    </div>
  );
}
