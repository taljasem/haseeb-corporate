import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Edit3, CheckCircle2 } from "lucide-react";
import DirArrow from "../../components/shared/DirArrow";
import EmptyState from "../../components/shared/EmptyState";
import SectionHeader from "../../components/SectionHeader";
import TaskRow from "../../components/taskbox/TaskRow";
// HASEEB-278 (2026-04-22): migrated to engine router. None of these
// five functions have a dedicated backend today — they mock-fallback
// through the router with a one-shot warn, preserving the dev-mode
// fixture. Future Wave 2 can wire them against /api/taskbox +
// /api/cfo/team-activity + /api/rules once the shape contracts land.
import {
  getTaskbox,
  getSaraWorkQueue,
  getSaraActivityLog,
  getSaraAminahNotes,
  getRoutingRules,
} from "../../engine";
import { formatRelativeTime } from "../../utils/relativeTime";
// HASEEB-179 — "my today" filters by the authenticated Junior's id,
// not the seed user "sara". The engine's getSara* helpers are seed-
// data lookups that stay on the seed id in MOCK mode; the filters
// that operate over real task/rule data are the ones moving to
// `juniorUserId`.
import { useAuth } from "../../contexts/AuthContext";

function SectionCard({ label, extra, aminah = true, children }) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 10,
        padding: "18px 20px",
        marginBottom: 16,
      }}
    >
      <SectionHeader label={label} extra={extra} aminah={aminah} />
      {children}
    </div>
  );
}

function QueueRow({ count, label, onClick }) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-surface-sunken)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        width: "100%",
        padding: "12px 14px",
        margin: "4px -14px",
        background: "transparent",
        border: "none",
        borderBottom: "1px solid var(--border-subtle)",
        cursor: "pointer",
        textAlign: "start",
        fontFamily: "inherit",
        borderRadius: 4,
      }}
    >
      <span
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 18,
          color: "var(--text-primary)",
          fontWeight: 500,
          minWidth: 32,
          textAlign: "end",
        }}
      >
        {count}
      </span>
      <span style={{ flex: 1, fontSize: 13, color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ color: "var(--text-tertiary)", fontSize: 14 }}><DirArrow /></span>
    </button>
  );
}

function renderHighlighted(text) {
  const parts = (text || "").split(/(\[[^\]]+\])/g);
  return parts.map((p, i) => {
    if (p.startsWith("[") && p.endsWith("]")) {
      const inner = p.slice(1, -1);
      const isPos = /^\+|%$|(\d+\s+open|\d+\s+due|\d+\s+transactions|\d+%)/.test(inner) && !/over|due today/i.test(inner);
      const isNeg = /over|overdue|due today/i.test(inner);
      const color = isNeg ? "var(--semantic-danger)" : isPos ? "var(--text-primary)" : "var(--text-primary)";
      return (
        <span
          key={i}
          style={{
            color,
            fontWeight: 500,
            fontFamily: /\d/.test(inner) ? "'DM Mono', monospace" : "inherit",
          }}
        >
          {inner}
        </span>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

export default function JuniorTodayScreen({ setActiveScreen, onOpenTask }) {
  const { t } = useTranslation("junior-today");
  const { t: tc } = useTranslation("common");
  // HASEEB-179 — authenticated Junior's id drives "my tasks" and
  // "my responsibilities" filters.
  const { user: authUser } = useAuth();
  const juniorUserId = authUser?.id ?? null;
  const [myTasks, setMyTasks] = useState(null);
  const [queue, setQueue] = useState(null);
  const [activity, setActivity] = useState(null);
  const [notes, setNotes] = useState(null);
  const [responsibilities, setResponsibilities] = useState(null);

  useEffect(() => {
    getTaskbox("Junior", "received").then((tasks) =>
      setMyTasks(
        tasks
          .filter((t) => juniorUserId && t.recipient.id === juniorUserId && t.status !== "completed")
          .slice(0, 5)
      )
    );
    getSaraWorkQueue().then(setQueue);
    getSaraActivityLog().then(setActivity);
    getSaraAminahNotes().then(setNotes);
    getRoutingRules("active").then((rules) =>
      setResponsibilities(rules.filter((r) => juniorUserId && r.action.assignTo?.id === juniorUserId))
    );
  }, [juniorUserId]);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px 32px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        {/* 1. MY TASKS */}
        <SectionCard
          label={t("sections.my_tasks")}
          extra={myTasks ? <span className="tension-dot tension-dot--info">{myTasks.length}</span> : null}
        >
          <div style={{ marginInline: -10 }}>
            {myTasks === null ? (
              <div style={{ padding: 16, color: "var(--text-tertiary)", fontSize: 12 }}>{t("loading")}</div>
            ) : myTasks.length === 0 ? (
              <div style={{ padding: 16, color: "var(--text-tertiary)", fontSize: 12 }}>{t("inbox_zero")}</div>
            ) : (
              myTasks.map((t) => (
                <TaskRow key={t.id} task={t} compact onClick={(x) => onOpenTask && onOpenTask(x.id)} />
              ))
            )}
          </div>
          <div style={{ marginTop: 10 }}>
            <a
              onClick={() => setActiveScreen("taskbox")}
              style={{ fontSize: 12, color: "var(--accent-primary)", cursor: "pointer" }}
            >
              {t("view_all")}
            </a>
          </div>
        </SectionCard>

        {/* 2. TODAY'S WORK QUEUE */}
        <SectionCard label={t("sections.work_queue")}>
          {queue && (queue.bankTransactions + queue.reconciliationExceptions + queue.jeAwaitingApproval + queue.escalationsToRespond === 0) && (
            <EmptyState icon={CheckCircle2} title={tc("empty_states.today_no_attention_title")} description={tc("empty_states.today_no_attention_desc")} />
          )}
          {queue && (queue.bankTransactions + queue.reconciliationExceptions + queue.jeAwaitingApproval + queue.escalationsToRespond > 0) && (
            <div style={{ marginTop: 4 }}>
              <QueueRow
                count={queue.bankTransactions}
                label={t("queue.bank_tx")}
                onClick={() => setActiveScreen("bank-transactions")}
              />
              <QueueRow
                count={queue.reconciliationExceptions}
                label={t("queue.recon_exceptions")}
                onClick={() => setActiveScreen("reconciliation")}
              />
              <QueueRow
                count={queue.jeAwaitingApproval}
                label={t("queue.je_awaiting")}
                onClick={() => setActiveScreen("taskbox")}
              />
              <QueueRow
                count={queue.escalationsToRespond}
                label={t("queue.escalations")}
                onClick={() => setActiveScreen("taskbox")}
              />
            </div>
          )}
        </SectionCard>

        {/* 3. MY RESPONSIBILITIES (summary) */}
        <SectionCard label={t("sections.my_responsibilities")}>
          {responsibilities && (
            <ul
              style={{
                margin: "6px 0 0",
                padding: 0,
                listStyle: "none",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {responsibilities.map((r) => (
                <li
                  key={r.id}
                  style={{
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    lineHeight: 1.5,
                    paddingInlineStart: 14,
                    position: "relative",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 8,
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: "var(--accent-primary)",
                    }}
                  />
                  {r.name}
                </li>
              ))}
            </ul>
          )}
          <div style={{ marginTop: 12 }}>
            <a
              onClick={() => setActiveScreen("responsibilities")}
              style={{ fontSize: 12, color: "var(--accent-primary)", cursor: "pointer" }}
            >
              {t("view_full")}
            </a>
          </div>
        </SectionCard>

        {/* 4. RECENT ACTIVITY */}
        <SectionCard label={t("sections.todays_activity")} aminah={false}>
          {activity && (
            <div style={{ display: "flex", flexDirection: "column", marginTop: 4 }}>
              {activity.map((a) => (
                <div
                  key={a.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 0",
                    borderBottom: "1px solid var(--border-subtle)",
                    fontSize: 13,
                    color: "var(--text-secondary)",
                  }}
                >
                  {a.type === "completed" ? (
                    <Check size={14} color="var(--accent-primary)" strokeWidth={2.4} />
                  ) : (
                    <Edit3 size={14} color="var(--semantic-warning)" strokeWidth={2.4} />
                  )}
                  <span style={{ flex: 1 }}>{a.description}</span>
                  <span
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 11,
                      color: "var(--text-tertiary)",
                    }}
                  >
                    {formatRelativeTime(a.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* 5. AMINAH'S NOTES */}
        <SectionCard label={t("sections.aminahs_notes")}>
          {notes &&
            notes.map((n) => (
              <div
                key={n.id}
                style={{
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  lineHeight: 1.8,
                  paddingBottom: 8,
                  marginBottom: 8,
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                {renderHighlighted(n.text)}
              </div>
            ))}
        </SectionCard>
      </div>
    </div>
  );
}
