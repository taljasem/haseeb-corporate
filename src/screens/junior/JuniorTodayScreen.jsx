import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Edit3 } from "lucide-react";
import DirArrow from "../../components/shared/DirArrow";
import SectionHeader from "../../components/SectionHeader";
import TaskRow from "../../components/taskbox/TaskRow";
import {
  getTaskbox,
  getSaraWorkQueue,
  getSaraActivityLog,
  getSaraAminahNotes,
  getRoutingRules,
} from "../../engine/mockEngine";
import { formatRelativeTime } from "../../utils/relativeTime";

function SectionCard({ label, extra, aminah = true, children }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
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
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
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
        borderBottom: "1px solid rgba(255,255,255,0.04)",
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
          color: "#E6EDF3",
          fontWeight: 500,
          minWidth: 32,
          textAlign: "end",
        }}
      >
        {count}
      </span>
      <span style={{ flex: 1, fontSize: 13, color: "#8B98A5" }}>{label}</span>
      <span style={{ color: "#5B6570", fontSize: 14 }}><DirArrow /></span>
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
      const color = isNeg ? "#FF5A5F" : isPos ? "#E6EDF3" : "#E6EDF3";
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
  const [myTasks, setMyTasks] = useState(null);
  const [queue, setQueue] = useState(null);
  const [activity, setActivity] = useState(null);
  const [notes, setNotes] = useState(null);
  const [responsibilities, setResponsibilities] = useState(null);

  useEffect(() => {
    getTaskbox("Junior", "received").then((tasks) =>
      setMyTasks(
        tasks
          .filter((t) => t.recipient.id === "sara" && t.status !== "completed")
          .slice(0, 5)
      )
    );
    getSaraWorkQueue().then(setQueue);
    getSaraActivityLog().then(setActivity);
    getSaraAminahNotes().then(setNotes);
    getRoutingRules("active").then((rules) =>
      setResponsibilities(rules.filter((r) => r.action.assignTo?.id === "sara"))
    );
  }, []);

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
              <div style={{ padding: 16, color: "#5B6570", fontSize: 12 }}>{t("loading")}</div>
            ) : myTasks.length === 0 ? (
              <div style={{ padding: 16, color: "#5B6570", fontSize: 12 }}>{t("inbox_zero")}</div>
            ) : (
              myTasks.map((t) => (
                <TaskRow key={t.id} task={t} compact onClick={(x) => onOpenTask && onOpenTask(x.id)} />
              ))
            )}
          </div>
          <div style={{ marginTop: 10 }}>
            <a
              onClick={() => setActiveScreen("taskbox")}
              style={{ fontSize: 12, color: "#00C48C", cursor: "pointer" }}
            >
              {t("view_all")}
            </a>
          </div>
        </SectionCard>

        {/* 2. TODAY'S WORK QUEUE */}
        <SectionCard label={t("sections.work_queue")}>
          {queue && (
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
                    color: "#8B98A5",
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
                      background: "#00C48C",
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
              style={{ fontSize: 12, color: "#00C48C", cursor: "pointer" }}
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
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    fontSize: 13,
                    color: "#8B98A5",
                  }}
                >
                  {a.type === "completed" ? (
                    <Check size={14} color="#00C48C" strokeWidth={2.4} />
                  ) : (
                    <Edit3 size={14} color="#D4A84B" strokeWidth={2.4} />
                  )}
                  <span style={{ flex: 1 }}>{a.description}</span>
                  <span
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 11,
                      color: "#5B6570",
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
                  color: "#8B98A5",
                  lineHeight: 1.8,
                  paddingBottom: 8,
                  marginBottom: 8,
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
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
