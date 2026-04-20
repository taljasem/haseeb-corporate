import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react";
import TodaySection from "../../components/cfo/TodaySection";
import AssignToButton from "../../components/shared/AssignToButton";
import DirArrow from "../../components/shared/DirArrow";
import EmptyState from "../../components/shared/EmptyState";
import TaskboxSummaryCard from "../../components/taskbox/TaskboxSummaryCard";
import SuggestedRuleRow from "../../components/rules/SuggestedRuleRow";
// Track B Dispatch 3a+3b wire (2026-04-20) — live backend composite
// reads. All 7 hooks now route through the engine router (MOCK vs LIVE
// via VITE_USE_MOCKS). See src/api/cfo-today.js + src/api/rules.js for
// the shape adapters and src/engine/index.js for the routing table.
//
// Hook → endpoint:
//   getCFOTodayQueue              → GET /api/cfo/today-queue
//     (returns pendingApprovals, bankTransactionsToReview,
//      reconciliationExceptions, auditFailures, closeStatus)
//   getCFOAminahNotes             → GET /api/cfo/aminah-insights
//   getTeamActivity               → GET /api/cfo/team-activity
//   getEngineStatus               → GET /api/cfo/engine-status
//   getSuggestedCategorizationRules → GET /api/rules/suggestions?type=categorization
//   getSuggestedRoutingRules      → GET /api/rules/suggestions?type=routing
//
// Nullable field handling (per dispatch spec): the today-queue composite
// returns `null` for failed sub-fetches rather than 500ing the whole
// response. We render "—" for null numeric fields and hide the close
// panel entirely when closeStatus is null.
import {
  getCFOTodayQueue,
  getTeamActivity,
  getEngineStatus,
  getSuggestedCategorizationRules,
  getSuggestedRoutingRules,
  getCFOAminahNotes,
} from "../../engine";

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
          color: count == null ? "var(--text-tertiary)" : "var(--text-primary)",
          fontWeight: 500,
          minWidth: 32,
          textAlign: "end",
        }}
      >
        {count == null ? "—" : count}
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
    // Single composite fetch covers both queue counters and the close-
    // status sub-field per Track B Dispatch 3a. The backend returns
    // nullable sub-fields on per-subfetch failure (no 500); preserve
    // the nulls and handle at render time.
    Promise.all([
      getCFOTodayQueue(),
      getCFOAminahNotes({ scope: "today", maxInsights: 8 }),
      getTeamActivity(10),
      getEngineStatus(),
    ])
      .then(([composite, n, t, e]) => {
        setQueue(composite);
        setClose(composite?.closeStatus || null);
        setNotes(n);
        setTeam(t);
        setEngine(e);
      })
      .catch(() => {
        // Silent degradation — each card already guards on null.
        // The shared error-banner pattern from prior wires is not
        // applied here because TodayScreen is the app-landing surface
        // and a partial-failure banner across all five cards would be
        // more confusing than per-card empty states.
      });
    // Rule suggestions are scoped OWNER + ACCOUNTANT on the backend; a
    // 403 for VIEWER / AUDITOR degrades silently to an empty list.
    Promise.all([
      getSuggestedCategorizationRules(5).catch(() => []),
      getSuggestedRoutingRules(5).catch(() => []),
    ]).then(([a, b]) => setSuggestions([...a, ...b].slice(0, 3)));
  }, []);

  // totalQueue helper — treat null sub-fields as 0 for the summary
  // tension-dot only. Individual row rendering below distinguishes
  // null from 0.
  const _q = (v) => (typeof v === "number" ? v : 0);
  const totalQueue = queue
    ? _q(queue.pendingApprovals) +
      _q(queue.bankTransactionsToReview) +
      _q(queue.reconciliationExceptions) +
      _q(queue.auditFailures)
    : 0;
  // Show the rows when there's any real work OR any sub-fetch failed
  // (null marker). Pure all-zero → the EmptyState renders instead.
  const hasAnyNullQueueField = queue
    ? queue.pendingApprovals == null ||
      queue.bankTransactionsToReview == null ||
      queue.reconciliationExceptions == null ||
      queue.auditFailures == null
    : false;
  const showQueueRows = totalQueue > 0 || hasAnyNullQueueField;

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
          {queue && !showQueueRows && (
            <EmptyState icon={CheckCircle2} title={tc("empty_states.today_no_attention_title")} description={tc("empty_states.today_no_attention_desc")} />
          )}
          {queue && showQueueRows && (
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
              {/* Budget-over-plan row removed pending budget-variance endpoint.
                  The hardcoded count={1} from the mock era has no backend
                  source and showing it in LIVE mode would be lying about
                  persisted data (Principle: never silently fake counts).
                  Flagged in the dispatch commit message. */}
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
                      currentAssignee={
                        // Backend closeStatus.nextTasks carries no
                        // assignee column today (ChecklistTemplateItem
                        // has no owner field). Treat empty as
                        // unassigned rather than lie. When the backend
                        // adds an assignee field this will pick it up
                        // automatically via the adapter in cfo-today.js.
                        t.assignee && typeof t.assignee === "string"
                          ? t.assignee.toLowerCase().includes("you")
                            ? "self"
                            : t.assignee.toLowerCase()
                          : undefined
                      }
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
                  // Low-confidence insights (0.5 <= confidence < 0.75
                  // per backend flag) render with muted text per the
                  // dispatch spec's "subtle indicator" guidance. The
                  // SUPPRESSION_THRESHOLD filter already drops
                  // confidence < 0.5 on the backend, so anything
                  // rendered here is at least "possibly meaningful".
                  color: n._lowConfidence
                    ? "var(--text-tertiary)"
                    : "var(--text-secondary)",
                  lineHeight: 1.8,
                  paddingBottom: 8,
                  marginBottom: 8,
                  borderBottom: "1px solid var(--border-subtle)",
                  opacity: n._lowConfidence ? 0.85 : 1,
                }}
              >
                {renderHighlighted(n.text)}
                {n._suggestedAction && n._suggestedAction.label && (
                  <div style={{ marginTop: 4 }}>
                    <a
                      onClick={() => {
                        // suggestedAction.href is a relative app route.
                        // Pure client-side navigation — parse the first
                        // path segment as a screen key so the existing
                        // setActiveScreen() dispatcher picks it up.
                        const href = String(n._suggestedAction.href || "");
                        const screen = href.replace(/^\/+/, "").split(/[\/?#]/)[0];
                        if (screen) setActiveScreen(screen);
                      }}
                      style={{
                        fontSize: 11,
                        color: "var(--accent-primary)",
                        cursor: "pointer",
                      }}
                    >
                      {n._suggestedAction.label} →
                    </a>
                  </div>
                )}
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
                <div
                  title={t("engine.matched_tooltip")}
                >
                  <div
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 26,
                      color: "var(--text-primary)",
                      fontWeight: 500,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {/* Matched-in-period = ruleBased + patternBased +
                        aiSuggested raw counts from the engine-status
                        response. `autoMatched` is always 0 today
                        because the Lane 1 learning-engine schema has
                        no AUTO tier yet (backend flag); we surface the
                        total-matched count instead so this slot
                        communicates real work rather than a
                        misleading zero. */}
                    {(engine._raw?.ruleBased ?? 0) +
                      (engine._raw?.patternBased ?? 0) +
                      (engine._raw?.aiSuggested ?? 0)}
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
                    {t("engine.matched_label")}
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
