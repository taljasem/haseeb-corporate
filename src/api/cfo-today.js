/**
 * CFO TodayScreen API module — Track B Dispatch 3a + 3b wire
 * (2026-04-20). Four composite read endpoints backing the CFO
 * TodayScreen:
 *
 *   GET /api/cfo/today-queue       — audit-readiness composite
 *   GET /api/cfo/team-activity     — last-24h activity feed
 *   GET /api/cfo/engine-status     — deterministic-engine metrics
 *   GET /api/cfo/aminah-insights   — narrated insights composite
 *
 * Each wrapper:
 *   1. Calls the endpoint via the shared axios client (adds bearer,
 *      normalizes errors into { ok:false, status, code, message }).
 *   2. Unwraps the successResponse envelope (`.data.data`).
 *   3. Shape-adapts the backend DTO to the mock shape the TodayScreen
 *      already consumes, so the screen swap is import-level only.
 *
 * Shape adaptations:
 *   - today-queue: integer sub-fields are nullable (backend returns null
 *     on sub-fetch failure per dispatch spec). The mock-compatible shape
 *     flattens `null` to 0 for the summary counts and preserves the
 *     embedded closeStatus as a separate-surface structure compatible
 *     with the mock getCloseStatus shape.
 *   - team-activity: backend returns {actorName, actorRole, action,
 *     target, targetType, timestamp, actorInitials}. Mock shape is
 *     {id, initials, name, action, detail, timeAgo}. We map
 *     actorName→name, action+targetType→action/detail prose, and
 *     timestamp→timeAgo via a relative-time formatter.
 *   - engine-status: backend returns {coverageRate, transactionCounts}.
 *     Mock shape is {coverage, autoToday, ruleBased, patternBased,
 *     aiSuggested} as percent values. We compute percents from the raw
 *     counts. `autoMatched` is always 0 today (Lane 1 learning-engine
 *     schema has no AUTO tier); we surface it on the shape but the
 *     TodayScreen UX layer suppresses the misleading counter.
 *   - aminah-insights: backend returns {insights: [{id, kind, severity,
 *     headline, detail, confidence, supportingData, suggestedAction?,
 *     lowConfidence}], totalAvailable, suppressedCount, generatedAt}.
 *     Mock notes shape is {id, text}. We adapt headline+detail into a
 *     single text string preserving the mock's [bracket-highlight]
 *     convention where supportingData carries numeric anchors.
 */
import client from './client';

function unwrap(response) {
  if (response && response.data && typeof response.data === 'object') {
    if ('data' in response.data) return response.data.data;
    return response.data;
  }
  return response?.data;
}

/** Relative-time formatter matching the mock's "2h ago" / "45min ago" shape. */
function relativeTime(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diffMs = Date.now() - then;
  const mins = Math.max(0, Math.round(diffMs / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/** Compose an activity-row action+detail prose pair from the raw row. */
function adaptActivityRow(r) {
  const action = r.action || '';
  const targetType = r.targetType || '';
  const target = r.target || '';
  // "APPROVE" on "JournalEntry" → "Approved JournalEntry"
  // Keep it terse — the UI renders name + action on line 1 and detail
  // below. Human-readable casing + target-type/target id as detail.
  const verb = action
    ? action.charAt(0).toUpperCase() + action.slice(1).toLowerCase() + 'd'
    : 'Action';
  const detail = target ? `${targetType} ${target}` : targetType;
  return {
    id: r.id,
    initials: r.actorInitials || '??',
    name: r.actorName || 'Unknown',
    action: `${verb} ${targetType}`.trim(),
    detail,
    timeAgo: relativeTime(r.timestamp),
  };
}

// ── today-queue composite ───────────────────────────────────────────
/**
 * Fetch the today-queue composite. Backend returns nullable sub-fields
 * when individual sub-fetches fail; we preserve nulls so the UI can
 * render a dash rather than treating a failure as a real zero.
 *
 * Also returns the embedded closeStatus sub-field in a mock-compatible
 * shape so TodayScreen can derive close-panel data from the same call.
 */
export async function getCFOTodayQueue(period) {
  const params = period ? { period } : {};
  const r = await client.get('/api/cfo/today-queue', { params });
  const data = unwrap(r) || {};

  // Map the close-status sub-field into the mock getCloseStatus shape.
  // Backend: {currentPeriod, taskProgress:{done,total,percent}, nextTasks:[{id,title,due}]}
  // Mock:    {period, tasksComplete, tasksTotal, percentComplete, nextTasks:[{task,assignee,complete}]}
  let closeStatus = null;
  if (data.closeStatus) {
    const cs = data.closeStatus;
    const nextTasks = Array.isArray(cs.nextTasks)
      ? cs.nextTasks.map((nt) => ({
          task: nt.title || '',
          // assignee is not carried on the backend model today — the
          // ChecklistTemplateItem doesn't track an owner. Render empty
          // so the UI falls through its own assignee-handling path
          // rather than lying with a fabricated name.
          assignee: '',
          complete: false,
          _id: nt.id,
          _due: nt.due,
        }))
      : [];
    closeStatus = {
      period: cs.currentPeriod || '',
      tasksTotal: cs.taskProgress?.total ?? 0,
      tasksComplete: cs.taskProgress?.done ?? 0,
      percentComplete: cs.taskProgress?.percent ?? 0,
      nextTasks,
    };
  }

  return {
    pendingApprovals: data.pendingApprovals, // may be null
    bankTransactionsToReview: data.bankTransactionsToReview,
    reconciliationExceptions: data.reconciliationExceptions,
    auditFailures: data.auditFailures,
    closeStatus,
  };
}

/**
 * Thin projection over getCFOTodayQueue that returns only the close-
 * status sub-field in the mock-compatible shape. Kept so callers that
 * only need close data don't have to peel the wrapper themselves.
 * TodayScreen uses getCFOTodayQueue directly (single-fetch); this
 * remains available for other callers (OwnerToday, Juniortoday) that
 * may rewire separately.
 */
export async function getCloseStatus(period) {
  const composite = await getCFOTodayQueue(period);
  return composite.closeStatus;
}

// ── team-activity ───────────────────────────────────────────────────
export async function getTeamActivity(limit = 10) {
  const r = await client.get('/api/cfo/team-activity', { params: { limit } });
  const data = unwrap(r);
  const rows = Array.isArray(data) ? data : [];
  return rows.map(adaptActivityRow);
}

// ── engine-status ───────────────────────────────────────────────────
/**
 * Backend shape:
 *   { period, coverageRate, transactionCounts: {autoMatched, ruleBased,
 *     patternBased, aiSuggested, unmatched} }
 * Mock shape (consumed by TodayScreen engine panel):
 *   { coverage, autoToday, ruleBased, patternBased, aiSuggested }
 *
 * Backend carries raw counts per-tier; the TodayScreen's engine panel
 * displays `coverage` (already a 0-100 number) plus percent-of-matched
 * for rule/pattern/ai. `autoToday` in the mock was a raw count of
 * auto-categorized transactions today. The backend's autoMatched is
 * always 0 today (Lane 1 schema gap — flagged in backend docs) so we
 * map it through but the consumer suppresses it.
 */
export async function getEngineStatus(period) {
  const params = period ? { period } : {};
  const r = await client.get('/api/cfo/engine-status', { params });
  const data = unwrap(r) || {};
  const counts = data.transactionCounts || {};
  const rule = Number(counts.ruleBased || 0);
  const pattern = Number(counts.patternBased || 0);
  const ai = Number(counts.aiSuggested || 0);
  const matchedTotal = rule + pattern + ai;
  const pct = (n) =>
    matchedTotal === 0 ? 0 : Math.round((n / matchedTotal) * 100);
  return {
    coverage: Number(data.coverageRate || 0),
    autoToday: Number(counts.autoMatched || 0), // always 0 today — UX suppresses
    ruleBased: pct(rule),
    patternBased: pct(pattern),
    aiSuggested: pct(ai),
    // Pass-through raw counts for callers that need the underlying numbers.
    _raw: counts,
    _period: data.period,
  };
}

// ── aminah-insights ─────────────────────────────────────────────────
/**
 * Adapt backend Insight → TodayScreen note row. The existing
 * `renderHighlighted(text)` parser looks for `[bracketed-numbers]` and
 * renders them in teal/red/mono. We preserve that convention by
 * lifting `headline` (short) and appending `detail` (fuller prose).
 *
 * Callers that want the full structured insight (for the
 * suggestedAction button, supportingData tooltip, etc.) read the
 * second return value below via getAminahInsightsFull().
 */
function insightToNote(ins) {
  const headline = ins.headline || '';
  const detail = ins.detail || '';
  // Compose the single text line. If detail duplicates headline, only
  // show one; otherwise headline—detail.
  const text = detail && detail !== headline
    ? `${headline} — ${detail}`
    : headline;
  return {
    id: ins.id,
    text,
    // Retain structured fields for callers that want the richer render.
    _kind: ins.kind,
    _severity: ins.severity,
    _confidence: ins.confidence,
    _lowConfidence: ins.lowConfidence === true,
    _suggestedAction: ins.suggestedAction || null,
    _supportingData: ins.supportingData || null,
  };
}

/**
 * Return the adapted notes array — mock-compatible shape.
 * Matches the old mockEngine.getCFOAminahNotes() signature.
 */
export async function getCFOAminahNotes(opts = {}) {
  const { scope = 'today', period, maxInsights = 8 } = opts;
  const params = { scope, maxInsights };
  if (period) params.period = period;
  const r = await client.get('/api/cfo/aminah-insights', { params });
  const data = unwrap(r) || {};
  const insights = Array.isArray(data.insights) ? data.insights : [];
  return insights.map(insightToNote);
}

/**
 * Full insights payload for callers that want the structured
 * suggestedAction / supportingData / totalAvailable / suppressedCount.
 * Kept as a separate export so TodayScreen can opt-in without breaking
 * the simpler notes-shape callers.
 */
export async function getAminahInsights(opts = {}) {
  const { scope = 'today', period, maxInsights = 8 } = opts;
  const params = { scope, maxInsights };
  if (period) params.period = period;
  const r = await client.get('/api/cfo/aminah-insights', { params });
  return unwrap(r) || { insights: [], totalAvailable: 0, suppressedCount: 0, generatedAt: null };
}
