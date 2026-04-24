/**
 * Junior-dashboard composite readers — HASEEB-401 D6 B15 (2026-04-24).
 *
 * Client-side composites for JuniorTodayScreen + MyResponsibilitiesScreen.
 * Per architect Q6 on the 2026-04-24 inventory memo: "compose client-
 * side from already-wired sources, not purpose-built backend endpoints".
 *
 * Four entries:
 *   • getSaraWorkQueue()
 *       Shape: { bankTransactions, reconciliationExceptions,
 *                jeAwaitingApproval, escalationsToRespond }
 *       Sources:
 *         - bankTransactions          → count of
 *           `bankTransactionsApi.getBankTransactionsPending`
 *         - reconciliationExceptions  → 0 (no dedicated exceptions
 *           count endpoint today; the mock's value was hand-crafted).
 *           A future dispatch can wire via the reconciliation module's
 *           unmatched-items count. Honest empty is better than invented.
 *         - jeAwaitingApproval        → count of taskbox entries with
 *           kind APPROVAL_REQUIRED linked to a JE.
 *         - escalationsToRespond      → count of unread non-terminal
 *           taskbox entries of kind REVIEW_REQUIRED assigned to the
 *           Junior lane.
 *
 *   • getSaraActivityLog()
 *       Shape: [{ id, type, icon, description, timestamp }]
 *       Source: `settingsApi.getMyActivity` (audit-log feed for the
 *       current authenticated user). The feed already returns a rich
 *       row shape; we reshape to the legacy mock row shape.
 *
 *   • getSaraAminahNotes()
 *       Shape: [{ id, text }]
 *       Source: `cfoTodayApi.getAminahInsights` — the same surface the
 *       CFO TodayScreen uses. Insights are tenant-scoped, not role-
 *       scoped, so the Junior sees the same insight feed. A future
 *       dispatch can add a role-filter on the backend; until then
 *       showing a shared feed is honest degradation.
 *
 *   • getJuniorDomainStats(juniorId?)
 *       Shape: { tasksHandled, accuracyRate, avgCompletionMinutes,
 *                pendingInQueue }
 *       Sources:
 *         - tasksHandled       → count of the current user's audit-log
 *           activity rows with action='COMPLETED' (via getMyActivity).
 *         - accuracyRate       → 0 (no backend surface today; the mock
 *           generated a plausible number. A follow-up can compute this
 *           from the categorization audit trail).
 *         - avgCompletionMinutes → 0 (no backend surface; same as
 *           accuracyRate).
 *         - pendingInQueue     → count of non-terminal taskbox entries
 *           assigned to the Junior (via taskboxApi.getTaskbox).
 */
import * as taskboxApi from './taskbox';
import * as bankTransactionsApi from './bank-transactions';
import * as settingsApi from './settings';
import * as cfoTodayApi from './cfo-today';

// ─────────────────────────────────────────────────────────────────────
// Public wrappers
// ─────────────────────────────────────────────────────────────────────

export async function getSaraWorkQueue() {
  const [bankTx, juniorTasks] = await Promise.allSettled([
    bankTransactionsApi.getBankTransactionsPending().catch(() => []),
    taskboxApi.getTaskbox('Junior', 'all').catch(() => []),
  ]);

  const bankRows = bankTx.status === 'fulfilled' && Array.isArray(bankTx.value)
    ? bankTx.value
    : [];
  const jrTasks = juniorTasks.status === 'fulfilled' && Array.isArray(juniorTasks.value)
    ? juniorTasks.value
    : [];

  const isOpen = (t) => t && t.status !== 'completed' && t.status !== 'cancelled';
  const jeAwaiting = jrTasks.filter(
    (t) => isOpen(t) && t.type === 'request-approval' && t.linkedItem?.type === 'journal-entry',
  ).length;
  const escalations = jrTasks.filter(
    (t) => isOpen(t) && t.type === 'review' && t.unread,
  ).length;

  return {
    bankTransactions: bankRows.length,
    reconciliationExceptions: 0,
    jeAwaitingApproval: jeAwaiting,
    escalationsToRespond: escalations,
  };
}

/**
 * Reshape a backend activity row into the legacy mock "sara activity
 * log" shape.
 *
 * The settings/getMyActivity endpoint returns entries with
 * { id, actor, action, entityType, entityId, meta, occurredAt, … }.
 * The legacy mock row is { id, type, icon, description, timestamp }.
 * We derive:
 *   - type  → 'completed' if the action string looks like a completion
 *     verb; otherwise 'in-progress' as a safe default.
 *   - icon  → 'check' for completions, 'pencil' for edits, 'eye' for
 *     reads, 'alert' otherwise.
 *   - description → preferred: action + ' · ' + entityType + ' #' +
 *     entityId. Falls back to raw action if the backend doesn't
 *     surface entity fields.
 *   - timestamp → occurredAt (passthrough).
 */
function reshapeActivityRow(row) {
  if (!row) return null;
  const action = String(row.action || row.type || '').toUpperCase();
  const isCompletion = /(COMPLETE|POST|APPROVE|SIGN|FINAL|SUBMIT)/.test(action);
  const isEdit = /(UPDATE|EDIT|MODIFY|PATCH)/.test(action);
  const isRead = /(VIEW|READ|LIST|DOWNLOAD)/.test(action);
  const type = isCompletion ? 'completed' : isEdit ? 'in-progress' : isRead ? 'viewed' : 'info';
  const icon = isCompletion ? 'check' : isEdit ? 'pencil' : isRead ? 'eye' : 'alert';
  const description = row.description
    || [row.action, row.entityType, row.entityId ? `#${row.entityId}` : null].filter(Boolean).join(' · ')
    || 'Activity';
  return {
    id: row.id || `${row.occurredAt || Date.now()}-${action}`,
    type,
    icon,
    description,
    timestamp: row.occurredAt || row.createdAt || new Date().toISOString(),
  };
}

export async function getSaraActivityLog() {
  try {
    const rows = await settingsApi.getMyActivity({ limit: 20 });
    const list = Array.isArray(rows) ? rows : Array.isArray(rows?.items) ? rows.items : [];
    return list.map(reshapeActivityRow).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Reshape an Aminah insight row into the legacy mock's
 * `{ id, text }` note shape. Insight rows carry a richer shape
 * ({ id, severity, title, bodyMd, summaryAr, … }); we prefer the
 * short `summary` / `title` fields for the legacy notes panel.
 */
function reshapeInsightAsNote(insight) {
  if (!insight) return null;
  const text = insight.summary
    || insight.title
    || insight.bodyMd
    || insight.text
    || '';
  if (!text) return null;
  return { id: insight.id || Math.random().toString(36).slice(2, 8), text };
}

export async function getSaraAminahNotes() {
  try {
    const raw = await cfoTodayApi.getAminahInsights();
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.insights) ? raw.insights : [];
    return list.map(reshapeInsightAsNote).filter(Boolean).slice(0, 5);
  } catch {
    return [];
  }
}

export async function getJuniorDomainStats() {
  // juniorId arg from the legacy mock signature is ignored in LIVE —
  // the current-user identity is carried by the auth context on the
  // backend, so the activity feed is always scoped to the caller.
  const [activity, tasks] = await Promise.allSettled([
    settingsApi.getMyActivity({ limit: 100 }).catch(() => []),
    taskboxApi.getTaskbox('Junior', 'all').catch(() => []),
  ]);

  const actRows = activity.status === 'fulfilled'
    ? (Array.isArray(activity.value) ? activity.value : Array.isArray(activity.value?.items) ? activity.value.items : [])
    : [];
  const jrTasks = tasks.status === 'fulfilled' && Array.isArray(tasks.value) ? tasks.value : [];

  const completions = actRows.filter((r) => {
    const a = String(r?.action || '').toUpperCase();
    return /(COMPLETE|POST|APPROVE|SIGN|FINAL|SUBMIT)/.test(a);
  }).length;

  const pendingInQueue = jrTasks.filter(
    (t) => t && t.status !== 'completed' && t.status !== 'cancelled',
  ).length;

  return {
    tasksHandled: completions,
    accuracyRate: 0,
    avgCompletionMinutes: 0,
    pendingInQueue,
  };
}
