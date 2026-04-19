import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react";
import TodaySection from "../../components/cfo/TodaySection";
import AssignToButton from "../../components/shared/AssignToButton";
import DirArrow from "../../components/shared/DirArrow";
import EmptyState from "../../components/shared/EmptyState";
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
      const color = isPos ? "var(--accent-primary)" : isNeg ? "var(--semantic-danger)" : "var(--text-primary)";
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
        e.currentTarget.style.background = "var(--bg-surface-sunken)";
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
        borderBottom: "1px solid var(--border-subtle)",
        cursor: "pointer",
        textAlign: "start",
        fontFamily: "inherit",
        transition: "background 0.12s ease",
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
      <span style={{ color: "var(--text-tertiary)", fontSize: 14, opacity: hover ? 1 : 0.5, transition: "opacity 0.15s, transform 0.15s", transform: hover ? "translateX(2px)" : "none" }}><DirArrow /></span>
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
        background: "var(--accent-primary-subtle)",
        border: "1px solid var(--accent-primary-border)",
        color: "var(--accent-primary)",
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
  const { t } = useTranslation("cfo-today");
  const { t: tc } = useTranslation("common");
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
          label={t("sections.needs_review")}
          extra={totalQueue > 0 ? <span className="tension-dot tension-dot--warning">{totalQueue}</span> : null}
          aminah
        >
          {queue && totalQueue === 0 && (
            <EmptyState icon={CheckCircle2} title={tc("empty_states.today_no_attention_title")} description={tc("empty_states.today_no_attention_desc")} />
          )}
          {queue && totalQueue > 0 && (
            <div style={{ marginTop: 4 }}>
              <QueueRow
                count={queue.pendingApprovals}
                label={t("queue.pending_approvals")}
                onClick={() => setActiveScreen("approvals")}
                itemId="approvals"
              />
              <QueueRow
                count={queue.bankTransactionsToReview}
                label={t("queue.bank_tx_review")}
                onClick={() => setActiveScreen("bank-transactions")}
                itemId="bank-tx"
              />
              <QueueRow
                count={queue.reconciliationExceptions}
                label={t("queue.reconciliation_exceptions")}
                onClick={() => setActiveScreen("reconciliation")}
                itemId="recon"
              />
              <QueueRow
                count={queue.auditFailures}
                label={t("queue.audit_failing")}
                onClick={() => setActiveScreen("audit-bridge")}
                itemId="audit"
              />
              <QueueRow
                count={1}
                label={t("queue.budget_over_plan")}
                onClick={() => setActiveScreen("budget")}
                itemId="budget"
              />
            </div>
          )}
        </TodaySection>

        {/* 1.5 SUGGESTED RULES */}
        {suggestions.length > 0 && (
          <TodaySection label={t("sections.suggested_rules")} aminah>
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
                style={{ fontSize: 12, color: "var(--accent-primary)", cursor: "pointer" }}
              >
                {t("suggestions.view_all")}
              </a>
            </div>
          </TodaySection>
        )}

        {/* 2. CLOSE PROGRESS */}
        <TodaySection label={close ? t("sections.close_with_period", { period: close.period.toUpperCase() }) : t("sections.month_end_close_fallback")}>
          {close && (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
                <span
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 22,
                    fontWeight: 500,
                    color: "var(--text-primary)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {close.tasksComplete} / {close.tasksTotal}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--text-tertiary)",
                    letterSpacing: "0.12em",
                    fontWeight: 600,
                  }}
                >
                  {t("close.tasks_complete_label", { pct: close.percentComplete })}
                </span>
              </div>
              <div
                style={{
                  width: "100%",
                  height: 4,
                  background: "var(--border-subtle)",
                  borderRadius: 2,
                  overflow: "hidden",
                  marginBottom: 14,
                }}
              >
                <div
                  style={{
                    width: `${close.percentComplete}%`,
                    height: "100%",
                    background: "var(--accent-primary)",
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
                      borderBottom: i < close.nextTasks.length - 1 ? "1px solid var(--border-subtle)" : "none",
                      fontSize: 13,
                      color: "var(--text-secondary)",
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        border: "1px solid var(--border-strong)",
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
          label={t("sections.aminahs_notes")}
          extra={notes ? <span className="tension-dot tension-dot--info">{notes.length}</span> : null}
          aminah
        >
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
        </TodaySection>

        {/* 4. TEAM ACTIVITY */}
        <TodaySection label={t("sections.team_activity")}>
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
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  <Avatar initials={t.initials} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "var(--text-primary)" }}>
                      <span style={{ fontWeight: 500 }}>{t.name}</span>{" "}
                      <span style={{ color: "var(--text-secondary)" }}>· {t.action}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                      {t.detail}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{t.timeAgo}</span>
                </div>
              ))}
            </div>
          )}
        </TodaySection>

        {/* 5. ENGINE STATUS */}
        <TodaySection label={t("sections.deterministic_engine")}>
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
                      color: "var(--accent-primary)",
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
                      color: "var(--text-tertiary)",
                      fontWeight: 600,
                      marginTop: 2,
                    }}
                  >
                    {t("engine.coverage_label")}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 26,
                      color: "var(--text-primary)",
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
                      color: "var(--text-tertiary)",
                      fontWeight: 600,
                      marginTop: 2,
                    }}
                  >
                    {t("engine.auto_today_label")}
                  </div>
                </div>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  paddingTop: 12,
                  borderTop: "1px solid var(--border-subtle)",
                }}
              >
                {t("engine.rule_based")}:{" "}
                <span style={{ color: "var(--accent-primary)", fontWeight: 500, fontFamily: "'DM Mono', monospace" }}>
                  {engine.ruleBased}%
                </span>
                {"  ·  "}
                {t("engine.pattern")}:{" "}
                <span style={{ color: "var(--semantic-info)", fontWeight: 500, fontFamily: "'DM Mono', monospace" }}>
                  {engine.patternBased}%
                </span>
                {"  ·  "}
                {t("engine.ai")}:{" "}
                <span style={{ color: "var(--semantic-warning)", fontWeight: 500, fontFamily: "'DM Mono', monospace" }}>
                  {engine.aiSuggested}%
                </span>
              </div>
              <div style={{ marginTop: 12 }}>
                <a style={{ fontSize: 12, color: "var(--accent-primary)", cursor: "pointer" }}>
                  {t("engine.view_performance")}
                </a>
              </div>
            </>
          )}
        </TodaySection>
      </div>
    </div>
  );
}
