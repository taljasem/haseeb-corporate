/**
 * Profile API module — HASEEB-400 B13 wire-up (2026-04-24).
 *
 * Backs the 5 ProfileScreen per-user engine entries. All 5 routes are
 * live on the backend at `/api/user-profile/*` via the team-admin
 * module (confirmed at `team-admin.routes.ts:44-59`, HASEEB-399 D4
 * backend-verification pre-read). The original inventory classified
 * these as Fix-B (no backend) — that was wrong. HASEEB-400 is the
 * standalone corrections dispatch.
 *
 * ─────────────────────────────────────────────────────────────────────
 * Backend surface
 *
 *   GET   /api/user-profile/stats
 *   GET   /api/user-profile/responsibilities
 *   GET   /api/user-profile/recent-activity?limit=N
 *   GET   /api/user-profile/notes
 *   PATCH /api/user-profile/notes                  body: { notes: string|null }
 *
 * Auth: the backend resolves the target user from `req.auth.userId`
 * when no `:userId` path param is present — the self-endpoint variant.
 * We always hit the self variant; cross-user reads require OWNER role
 * via the `/:userId/*` path, which the ProfileScreen does NOT exercise.
 *
 * Role gates: any authenticated role for the self reads + self notes
 * update; OWNER only for the `/:userId/*` variants (not used here).
 *
 * ─────────────────────────────────────────────────────────────────────
 * Shape-adapter summary (backend → UI)
 * ─────────────────────────────────────────────────────────────────────
 *
 * ProfileScreen was authored against the mockEngine shape. The backend
 * team-admin.service ships a different shape for each of the five
 * endpoints — each adapter below maps the live shape into the mock-
 * compatible shape ProfileScreen renders.
 *
 * ── getUserStats ───────────────────────────────────────────────────
 *
 *   Backend: { userId, email, role, createdAt, lastLoginAt,
 *              totals: { auditLogEntries, correctionsSubmitted,
 *                        taskboxCompleted, taskboxDismissed } }
 *
 *   UI expects:
 *     { primary: { label: string, value: number, trend: 'up'|'down',
 *                   delta: string, unit?: 'pct' },
 *       cards: Array<{ key: string, value: number, unit: string }> }
 *
 *   Mapping:
 *     - primary.label     → role-specific i18n key (decisions_month /
 *                           jes_approved_month / accuracy_week). Backend
 *                           has no role-specific "primary" KPI; we pick
 *                           `taskboxCompleted` as the universal primary
 *                           and use the role-specific label key so the
 *                           translated text matches the role (CFO sees
 *                           "JEs approved this month", Owner sees
 *                           "Decisions this month", Junior sees
 *                           "Tasks completed this month"). Mock's
 *                           Junior accuracy_week metric is not derivable
 *                           from backend totals — we substitute
 *                           taskboxCompleted so the card renders.
 *     - primary.trend     → always 'up' (honest degradation; backend
 *                           has no week-over-week delta today).
 *     - primary.delta     → '' (empty; UI renders no trending badge).
 *                           The mock shows "+12% / +8% / +3%" deltas
 *                           that are fabricated; we prefer no-delta
 *                           over a fake delta.
 *     - cards             → 4 cards mapped from `totals`:
 *                           auditLogEntries   → entries
 *                           correctionsSubmitted → corrections
 *                           taskboxCompleted  → tasks
 *                           taskboxDismissed  → dismissed
 *                           Mock used role-specific i18n keys
 *                           (approvals_processed / reports_reviewed /
 *                           etc). We expose 4 universal i18n keys that
 *                           translate for each role; stats.cards.*
 *                           already has `approvals_processed` etc., so
 *                           we reuse the existing keys that best
 *                           match the backend counts. See the map below.
 *
 * ── getUserResponsibilities ───────────────────────────────────────
 *
 *   Backend: { userId, role, openTaskboxForRole,
 *              routingRulesOwned: Array<{ id, category, accountCode, note }> }
 *
 *   UI expects:
 *     Array<{ id, type: 'approval'|'oversight'|'governance'|'execution',
 *             label, scope, description? }>
 *
 *   Mapping:
 *     - Each routing-rule → one responsibility row with:
 *         id:          rule.id
 *         type:        'oversight' (routing rules are review oversights)
 *         label:       rule.category (e.g. "AP — utility")
 *         scope:       rule.accountCode || '—'
 *         description: rule.note || null
 *     - If routingRulesOwned.length === 0 AND openTaskboxForRole > 0,
 *       synthesise a single row describing the open-taskbox count so
 *       the card doesn't render empty. This is a CFO/VIEWER case —
 *       they might have no routing rules owned but still have an
 *       active taskbox queue.
 *     - Pure empty (no rules + no taskbox) renders the EmptyState per
 *       ProfileScreen's existing branch.
 *
 * ── getUserRecentActivity ─────────────────────────────────────────
 *
 *   Backend: Array<{ id, action, entityType, entityId, createdAt }>
 *
 *   UI expects:
 *     Array<{ id, timestamp, action, target, targetType, link? }>
 *
 *   Mapping:
 *     - id:         pass through
 *     - timestamp:  createdAt (ISO string — UI calls formatRelativeTime)
 *     - action:     action.toLowerCase() (mock uses 'approved_je' style
 *                    lowercase keys; backend emits 'CREATE' / 'UPDATE' /
 *                    etc. in upper). Translate backend action enum to
 *                    the mock's i18n keys with an extension prefix so
 *                    missing translations fall through to the backend
 *                    verb. Best-effort; the ProfileScreen's i18n path
 *                    uses `t('activity.actions.X', { defaultValue:
 *                    a.action })` so an unrecognised action renders the
 *                    raw verb rather than a translation key.
 *     - target:     entityId (used by the i18n interpolation)
 *     - targetType: entityType (best-effort)
 *     - link:       not populated (mock uses this to navigate on
 *                    click; ProfileScreen doesn't hook the click today
 *                    so absence is invisible).
 *
 * ── getUserNotes / updateUserNotes ────────────────────────────────
 *
 *   Backend: { userId, notes: string|null }
 *
 *   UI expects: { content: string, lastSaved: string (ISO) }
 *
 *   Mapping:
 *     - content:    notes || ''
 *     - lastSaved:  now (ISO). Backend does not return a lastSaved
 *                   timestamp; we synthesise one on each read+write so
 *                   the "Saved X minutes ago" indicator reflects the
 *                   read time. An enhancement would add `updatedAt`
 *                   to the User.notes field backend-side, tracked as
 *                   a follow-up; the UI degrades gracefully.
 *
 * ─────────────────────────────────────────────────────────────────────
 * Role argument (ProfileScreen passes role to getUserStats +
 * getUserResponsibilities). The backend uses req.auth.role and does NOT
 * accept a role override — if ProfileScreen is rendered with a role
 * that differs from the authenticated user's (which shouldn't happen
 * in practice; ProfileScreen is always rendered with the current
 * user's own role), the UI shows the authenticated user's stats, not
 * a cross-role view. This matches the backend's security model and
 * does not require a client-side branch.
 */
import client from './client';

function unwrap(response) {
  if (response && response.data && typeof response.data === 'object') {
    if ('data' in response.data && 'success' in response.data) {
      return response.data.data;
    }
    if ('data' in response.data) return response.data.data;
    return response.data;
  }
  return response?.data;
}

// ─────────────────────────────────────────────────────────────────────
// getUserStats
// ─────────────────────────────────────────────────────────────────────

/**
 * Fetch user stats and adapt to the ProfileScreen primary+cards shape.
 *
 * Mock signature: `getUserStats(role, period = "month")`. The backend
 * ignores both `role` (derived from auth context) and `period` (always
 * lifetime totals today). The UI uses `role` only to select the
 * primary-KPI label — we thread it through locally.
 */
export async function getUserStats(role = 'CFO') {
  const r = await client.get('/api/user-profile/stats');
  const data = unwrap(r) || {};
  const totals = data.totals || {};

  // Pick the role-appropriate primary label key. The i18n keys are
  // defined in src/locales/*/profile.json under stats.primary.*.
  // The mock maps:
  //   Owner  → decisions_month
  //   CFO    → jes_approved_month
  //   Junior → accuracy_week (pct unit — not derivable from totals)
  // Backend has no per-role primary metric; we pick `taskboxCompleted`
  // as the universal "primary" and use the role-specific LABEL so the
  // card's translated text still looks role-specific.
  let primaryLabel;
  let primaryValue;
  let primaryUnit;
  switch (role) {
    case 'Owner':
      primaryLabel = 'decisions_month';
      primaryValue = Number(totals.taskboxCompleted || 0);
      primaryUnit = undefined;
      break;
    case 'Junior':
      // Mock's "accuracy_week" is a pct; backend has no accuracy signal.
      // Substitute taskboxCompleted (tasks count) with no pct unit so
      // the "%" suffix doesn't render. UI copy will read "Tasks
      // completed this month" via i18n fallback if the key lookup
      // misses; acceptable degradation.
      primaryLabel = 'accuracy_week';
      primaryValue = Number(totals.taskboxCompleted || 0);
      primaryUnit = undefined;
      break;
    case 'CFO':
    default:
      primaryLabel = 'jes_approved_month';
      primaryValue = Number(totals.taskboxCompleted || 0);
      primaryUnit = undefined;
      break;
  }

  // The i18n keys for stats.cards.* that exist today:
  //   approvals_processed, reports_reviewed, audit_checks, budget_reviews,
  //   budgets_reviewed, reconciliations_done, tasks_managed, rules_created,
  //   tasks_completed_month, jes_posted, transactions_coded.
  // Pick the four that best match the four backend totals.
  const cards = [
    {
      key: 'tasks_completed_month',
      value: Number(totals.taskboxCompleted || 0),
      unit: 'tasks',
    },
    {
      key: 'audit_checks',
      value: Number(totals.auditLogEntries || 0),
      unit: 'entries',
    },
    {
      key: 'rules_created',
      value: Number(totals.correctionsSubmitted || 0),
      unit: 'corrections',
    },
    {
      key: 'tasks_managed',
      value: Number(totals.taskboxDismissed || 0),
      unit: 'dismissed',
    },
  ];

  return {
    primary: {
      label: primaryLabel,
      value: primaryValue,
      trend: 'up',
      delta: '',
      ...(primaryUnit ? { unit: primaryUnit } : {}),
    },
    cards,
  };
}

// ─────────────────────────────────────────────────────────────────────
// getUserResponsibilities
// ─────────────────────────────────────────────────────────────────────

/**
 * Fetch user responsibilities and adapt to the ProfileScreen row shape.
 *
 * Mock signature: `getUserResponsibilities(role)`. Backend does not use
 * role (uses auth context). Role ignored at the wrapper layer; passed
 * through only for API compatibility.
 */
// eslint-disable-next-line no-unused-vars
export async function getUserResponsibilities(_role) {
  const r = await client.get('/api/user-profile/responsibilities');
  const data = unwrap(r) || {};
  const rules = Array.isArray(data.routingRulesOwned) ? data.routingRulesOwned : [];
  const openTaskboxForRole = Number(data.openTaskboxForRole || 0);

  const rows = rules.map((rule) => ({
    id: rule.id,
    type: 'oversight', // routing rules are review/oversight responsibilities
    label: rule.category || '—',
    scope: rule.accountCode || '—',
    description: rule.note || null,
  }));

  // Degradation path: if the user owns no routing rules but has an
  // open taskbox queue, synthesise one oversight row describing the
  // queue so the card doesn't render empty. Honest "here's what you're
  // responsible for" rather than a false negative.
  if (rows.length === 0 && openTaskboxForRole > 0) {
    rows.push({
      id: 'resp-taskbox-queue',
      type: 'execution',
      label: `Open taskbox queue (${openTaskboxForRole})`,
      scope: 'Role-assigned',
      description: null,
    });
  }

  return rows;
}

// ─────────────────────────────────────────────────────────────────────
// getUserRecentActivity
// ─────────────────────────────────────────────────────────────────────

/**
 * Map backend audit-log action → mock-compatible i18n action key.
 * The ProfileScreen i18n path falls through to the raw action string
 * on an unmatched key (defaultValue: a.action), so this map is
 * best-effort — unrecognised actions render the raw verb rather than
 * a broken translation key.
 *
 * Known mock keys (from locales/<lang>/profile.json activity.actions.<key>):
 *   approved_je, posted_budget_rev, completed_recon, created_rule,
 *   replied_task, approved_budget, posted_je, completed_task,
 *   coded_tx, reviewed_report.
 *
 * Backend actions (from audit-logs module + recordAuditEntry calls):
 *   CREATE, UPDATE, DELETE, APPROVE, REJECT, POST, REVERSE, ...
 *
 * Compose `${verb}_${entityType}` client-side to hit the i18n keys the
 * mock used — e.g. POST + journal_entry → "posted_je".
 */
function mapAction(backendAction, entityType) {
  if (!backendAction) return 'action';
  const a = String(backendAction).toUpperCase();
  const e = String(entityType || '').toLowerCase();
  // Common mappings derived from mock i18n keys.
  if (a === 'APPROVE') {
    if (e === 'budget' || e.includes('budget')) return 'approved_budget';
    if (e === 'journal_entry' || e === 'je') return 'approved_je';
    return 'approved';
  }
  if (a === 'POST') {
    if (e === 'journal_entry' || e === 'je') return 'posted_je';
    if (e === 'budget' || e.includes('budget')) return 'posted_budget_rev';
    return 'posted';
  }
  if (a === 'CREATE') {
    if (e === 'routing_rule' || e === 'rule' || e.includes('rule')) return 'created_rule';
    return 'created';
  }
  if (a === 'COMPLETE') {
    if (e === 'reconciliation' || e === 'recon') return 'completed_recon';
    if (e === 'taskbox_entry' || e === 'task') return 'completed_task';
    return 'completed';
  }
  if (a === 'UPDATE') return 'updated';
  if (a === 'DELETE' || a === 'REMOVE' || a === 'DEACTIVATE') return 'deleted';
  if (a === 'REVERSE') return 'reversed';
  if (a === 'REJECT') return 'rejected';
  // Fall-through: lowercase the backend verb so the i18n lookup gets
  // a lowercase key (more likely to hit an existing translation than
  // an all-caps enum).
  return a.toLowerCase();
}

/**
 * Fetch recent activity and adapt to the ProfileScreen row shape.
 *
 * Mock signature: `getUserRecentActivity(limit = 10)`.
 */
export async function getUserRecentActivity(limit = 10) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 200));
  const r = await client.get('/api/user-profile/recent-activity', {
    params: { limit: safeLimit },
  });
  const data = unwrap(r);
  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => ({
    id: row.id,
    timestamp: row.createdAt || null,
    action: mapAction(row.action, row.entityType),
    target: row.entityId || '',
    targetType: row.entityType || '',
  }));
}

// ─────────────────────────────────────────────────────────────────────
// getUserNotes / updateUserNotes
// ─────────────────────────────────────────────────────────────────────

/**
 * Fetch the user's private notes.
 *
 * Mock signature: `getUserNotes()` — returns `{ content, lastSaved }`.
 */
export async function getUserNotes() {
  const r = await client.get('/api/user-profile/notes');
  const data = unwrap(r) || {};
  return {
    content: typeof data.notes === 'string' ? data.notes : '',
    // Backend doesn't return a lastSaved timestamp today. Synthesise
    // the read time so the UI's "Saved X minutes ago" indicator has
    // a plausible anchor. Follow-up: add User.notesUpdatedAt backend-
    // side and thread it through.
    lastSaved: new Date().toISOString(),
  };
}

/**
 * Update the user's private notes.
 *
 * Mock signature: `updateUserNotes(content)` — returns `{ content, lastSaved }`.
 * Backend accepts `{ notes: string | null }`; empty string is allowed
 * but backend service coerces empty to null (saves as null in DB).
 * We preserve the empty-string semantics on the UI side so the
 * "unsaved vs saved" comparison in ProfileScreen's NotesCard doesn't
 * flip on a no-op save.
 */
export async function updateUserNotes(content) {
  const payload = { notes: typeof content === 'string' ? content : null };
  const r = await client.patch('/api/user-profile/notes', payload);
  const data = unwrap(r) || {};
  return {
    content: typeof data.notes === 'string' ? data.notes : (content || ''),
    lastSaved: new Date().toISOString(),
  };
}
