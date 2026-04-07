import { useEffect, useState } from "react";
import TodaySection from "../../components/cfo/TodaySection";
import AssignToButton from "../../components/shared/AssignToButton";
import TaskboxSummaryCard from "../../components/taskbox/TaskboxSummaryCard";
import SuggestedRuleRow from "../../components/rules/SuggestedRuleRow";
import { getSuggestedCategorizationRules, getSuggestedRoutingRules } from "../../engine/mockEngine";
import {
  getCFOTodayQueue,
  getCFOAminahNotes,
  getTeamActivity,
  getEngineStatus,
  getCloseStatus,
} from "../../engine/mockEngine";

function renderHighlighted(text) {
  const parts = text.split(/(\[[^\]]+\])/g);
  return parts.map((part, i) => {
    if (part.startsWith("[") && part.endsWith("]")) {
      const inner = part.slice(1, -1);
      const isPos = /^\+/.test(inner) && !/over/i.test(inner);
      const isNeg = /over|overdue/i.test(inner) || (/^\+/.test(inner) && /over/i.test(inner));
      const color = isPos ? "#00C48C" : isNeg ? "#FF5A5F" : "#E6EDF3";
      const isNum = /KWD/.test(inner);
      return (
        <span
          key={i}
          style={{
            color,
            fontWeight: 500,
            fontFamily: isNum ? "'DM Mono', monospace" : "inherit",
          }}
        >
          {inner}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function QueueRow({ count, label, onClick, itemId }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.04)";
        setHover(true);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        setHover(false);
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        width: "100%",
        padding: "12px 14px",
        margin: "4px -14px",
        background: "transparent",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "inherit",
        transition: "background 0.12s ease",
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
          textAlign: "right",
        }}
      >
        {count}
      </span>
      <span style={{ flex: 1, fontSize: 13, color: "#8B98A5" }}>{label}</span>
      <span
        style={{
          opacity: hover ? 1 : 0,
          transition: "opacity 0.15s ease",
          pointerEvents: hover ? "auto" : "none",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <AssignToButton itemType="review-queue" itemId={itemId} compact onAssign={() => {}} />
      </span>
      <span style={{ color: "#5B6570", fontSize: 14 }}>→</span>
    </div>
  );
}

function Avatar({ initials }) {
  return (
    <span
      style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: "rgba(0,196,140,0.10)",
        border: "1px solid rgba(0,196,140,0.30)",
        color: "#00C48C",
        fontSize: 11,
        fontWeight: 600,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      {initials}
    </span>
  );
}

export default function TodayScreen({ setActiveScreen, onOpenTask, onCreateTask }) {
  const [suggestions, setSuggestions] = useState([]);
  const [queue, setQueue] = useState(null);
  const [notes, setNotes] = useState(null);
  const [team, setTeam] = useState(null);
  const [engine, setEngine] = useState(null);
  const [close, setClose] = useState(null);

  useEffect(() => {
    Promise.all([
      getCFOTodayQueue(),
      getCFOAminahNotes(),
      getTeamActivity(),
      getEngineStatus(),
      getCloseStatus(),
    ]).then(([q, n, t, e, c]) => {
      setQueue(q);
      setNotes(n);
      setTeam(t);
      setEngine(e);
      setClose(c);
    });
    Promise.all([getSuggestedCategorizationRules(), getSuggestedRoutingRules()]).then(
      ([a, b]) => setSuggestions([...a, ...b].slice(0, 3))
    );
  }, []);

  const totalQueue = queue
    ? queue.pendingApprovals + queue.bankTransactionsToReview + queue.reconciliationExceptions + queue.auditFailures
    : 0;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        {/* 0. TASKBOX SUMMARY */}
        <TaskboxSummaryCard
          role="CFO"
          onViewAll={() => setActiveScreen("taskbox")}
          onTaskClick={(t) => onOpenTask && onOpenTask(t.id)}
        />

        {/* 1. NEEDS YOUR REVIEW */}
        <TodaySection
          label="NEEDS YOUR REVIEW"
          extra={totalQueue > 0 ? <span className="tension-dot tension-dot--warning">{totalQueue}</span> : null}
          aminah
        >
          {queue && (
            <div style={{ marginTop: 4 }}>
              <QueueRow
                count={queue.pendingApprovals}
                label="pending approvals"
                onClick={() => setActiveScreen("approvals")}
                itemId="approvals"
              />
              <QueueRow
                count={queue.bankTransactionsToReview}
                label="bank transactions awaiting review"
                onClick={() => setActiveScreen("bank-transactions")}
                itemId="bank-tx"
              />
              <QueueRow
                count={queue.reconciliationExceptions}
                label="reconciliation exceptions"
                onClick={() => setActiveScreen("reconciliation")}
                itemId="recon"
              />
              <QueueRow
                count={queue.auditFailures}
                label="audit check failing"
                onClick={() => setActiveScreen("audit-bridge")}
                itemId="audit"
              />
              <QueueRow
                count={1}
                label="budget department over plan"
                onClick={() => setActiveScreen("budget")}
                itemId="budget"
              />
            </div>
          )}
        </TodaySection>

        {/* 1.5 SUGGESTED RULES */}
        {suggestions.length > 0 && (
          <TodaySection label="SUGGESTED RULES" aminah>
            <div style={{ marginInline: -20 }}>
              {suggestions.map((s) => (
                <SuggestedRuleRow
                  key={s.id}
                  suggestion={s}
                  compact
                  onCreate={() => setActiveScreen("rules")}
                  onDismiss={() => setSuggestions((prev) => prev.filter((x) => x.id !== s.id))}
                />
              ))}
            </div>
            <div style={{ marginTop: 10 }}>
              <a
                onClick={() => setActiveScreen("rules")}
                style={{ fontSize: 12, color: "#00C48C", cursor: "pointer" }}
              >
                View all suggestions →
              </a>
            </div>
          </TodaySection>
        )}

        {/* 2. CLOSE PROGRESS */}
        <TodaySection label={close ? `${close.period.toUpperCase()} CLOSE` : "MONTH-END CLOSE"}>
          {close && (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
                <span
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 22,
                    fontWeight: 500,
                    color: "#E6EDF3",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {close.tasksComplete} / {close.tasksTotal}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: "#5B6570",
                    letterSpacing: "0.12em",
                    fontWeight: 600,
                  }}
                >
                  TASKS COMPLETE · {close.percentComplete}%
                </span>
              </div>
              <div
                style={{
                  width: "100%",
                  height: 4,
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 2,
                  overflow: "hidden",
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    width: `${close.percentComplete}%`,
                    height: "100%",
                    background: "#00C48C",
                  }}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {close.nextTasks.map((t, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 0",
                      borderBottom: i < close.nextTasks.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                      fontSize: 13,
                      color: "#8B98A5",
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        border: "1px solid rgba(255,255,255,0.20)",
                      }}
                    />
                    <span style={{ flex: 1 }}>{t.task}</span>
                    <AssignToButton
                      itemType="close-task"
                      itemId={`close-${i}`}
                      currentAssignee={t.assignee.toLowerCase().includes("you") ? "self" : t.assignee.toLowerCase()}
                      compact
                      onAssign={() => {}}
                      onClickOverride={() =>
                        onCreateTask &&
                        onCreateTask({
                          linkedItem: {
                            type: "close-task",
                            id: `CT-${i}`,
                            preview: `${t.task} · March 2026 close`,
                          },
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </TodaySection>

        {/* 3. AMINAH'S NOTES */}
        <TodaySection
          label="AMINAH'S NOTES"
          extra={notes ? <span className="tension-dot tension-dot--info">{notes.length}</span> : null}
          aminah
        >
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
        </TodaySection>

        {/* 4. TEAM ACTIVITY */}
        <TodaySection label="TEAM ACTIVITY TODAY">
          {team && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {team.map((t) => (
                <div
                  key={t.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 0",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  <Avatar initials={t.initials} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "#E6EDF3" }}>
                      <span style={{ fontWeight: 500 }}>{t.name}</span>{" "}
                      <span style={{ color: "#8B98A5" }}>· {t.action}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "#5B6570", marginTop: 2 }}>
                      {t.detail}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: "#5B6570" }}>{t.timeAgo}</span>
                </div>
              ))}
            </div>
          )}
        </TodaySection>

        {/* 5. ENGINE STATUS */}
        <TodaySection label="DETERMINISTIC ENGINE">
          {engine && (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 16,
                  marginBottom: 14,
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 26,
                      color: "#00C48C",
                      fontWeight: 500,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {engine.coverage}%
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.12em",
                      color: "#5B6570",
                      fontWeight: 600,
                      marginTop: 2,
                    }}
                  >
                    COVERAGE THIS PERIOD
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 26,
                      color: "#E6EDF3",
                      fontWeight: 500,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {engine.autoToday}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.12em",
                      color: "#5B6570",
                      fontWeight: 600,
                      marginTop: 2,
                    }}
                  >
                    TRANSACTIONS AUTO-CATEGORIZED TODAY
                  </div>
                </div>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "#8B98A5",
                  paddingTop: 12,
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                Rule-based:{" "}
                <span style={{ color: "#00C48C", fontWeight: 500, fontFamily: "'DM Mono', monospace" }}>
                  {engine.ruleBased}%
                </span>
                {"  ·  "}
                Pattern:{" "}
                <span style={{ color: "#3B82F6", fontWeight: 500, fontFamily: "'DM Mono', monospace" }}>
                  {engine.patternBased}%
                </span>
                {"  ·  "}
                AI:{" "}
                <span style={{ color: "#D4A84B", fontWeight: 500, fontFamily: "'DM Mono', monospace" }}>
                  {engine.aiSuggested}%
                </span>
              </div>
              <div style={{ marginTop: 12 }}>
                <a style={{ fontSize: 12, color: "#00C48C", cursor: "pointer" }}>
                  View engine performance →
                </a>
              </div>
            </>
          )}
        </TodaySection>
      </div>
    </div>
  );
}
