/**
 * Taskbox API module — HASEEB-398 B4 wire-up (2026-04-24).
 *
 * Backs the taskbox list + 3 client-side-derived counter surfaces the
 * Owner / CFO / Junior dashboards read. 1 backend endpoint wraps 4
 * engine entries; three of them are client-side aggregates over the
 * same live list payload (per architect Q3 ruling on the 2026-04-24
 * inventory memo — "wire as client-side aggregators on the single live
 * list, not per-count endpoints").
 *
 * Backend endpoint (from `src/modules/taskbox/`):
 *   GET /api/taskbox  — filtered list (OWNER + ACCOUNTANT)
 *     query: status, kind, assignedRole, sourceModule, limit, offset
 *     returns: TaskboxEntry[]
 *
 * Backend TaskboxEntry (from `src/modules/taskbox/taskbox.repository.ts`):
 *   { id, kind, title, description, sourceModule, sourceEntityType,
 *     sourceEntityId, linkedJournalEntryId, assignedRole,
 *     priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT',
 *     status:   'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'DISMISSED',
 *     kindEnum: 'APPROVAL_REQUIRED' | 'REVIEW_REQUIRED' | 'ACTION_REQUIRED' | ...,
 *     createdAt, updatedAt, completedAt, dismissedAt, ... }
 *
 * Role gate (backend): OWNER + ACCOUNTANT. Frontend does not apply
 * secondary role gates — server enforces. The mock `getTaskbox(role,
 * filter)` carries a `role` argument; the backend derives effective
 * role from the auth context, so the frontend's `role` argument is
 * used only for *client-side tab filters* (see below), not for a
 * backend query-param.
 *
 * ─────────────────────────────────────────────────────────────────────
 * Shape-adapter summary (backend → UI)
 * ─────────────────────────────────────────────────────────────────────
 *
 * The existing UI (TaskboxScreen + TaskboxSummaryCard + PendingApprovals +
 * JuniorTodayScreen) was authored against the mockEngine shape, which is
 * richer than the backend Taskbox primitive:
 *
 *   Mock TaskboxEntry shape (per `mockEngine.TASKBOX_DB` row):
 *     { id, subject, body, type, direction, status ('open' | 'completed' |
 *       'cancelled' | 'rejected'), sender: {id, role, name}, recipient:
 *       {id, role, name}, createdAt, updatedAt, dueDate, linkedItem,
 *       attachments, unread, visibleTo }
 *
 *   Backend TaskboxEntry shape (simpler, no sender/recipient or free-
 *   form subject/body — it's a work-queue primitive, not a messaging
 *   surface).
 *
 * mapEntry() below translates backend → a shape the existing UI can
 * render. Missing fields (sender/recipient identity, unread flag, free-
 * form body) resolve to sensible defaults. A future backend dispatch
 * can enrich the taskbox shape to carry the messaging-level fields the
 * UI actually wants; until then the UI renders a terse work-queue view
 * with `title` in place of `subject` and `description` in place of
 * `body`, and sender/recipient default to the assigned-role identity
 * so the filter tabs function.
 *
 * Filter-tab mapping (mock `filter` param → client-side aggregate):
 *   'all'          → no filter (drop DISMISSED only)
 *   'approvals'    → kind === 'APPROVAL_REQUIRED' && status !== COMPLETED
 *   'needs-action' → status IN (OPEN, IN_PROGRESS) — derived
 *   'received'     → assignedRole === current-user-role (approx)
 *   'sent'         → always empty (backend has no sender concept)
 *   'unread'       → status === OPEN && !dismissedAt (approx)
 *   'completed'    → status === COMPLETED
 *
 * The role argument is used only for the 'received' / 'sent' tabs;
 * for 'all' / 'approvals' / etc. it is a no-op. This matches the
 * mock's dispatch behaviour closely enough that the UI toggles work.
 *
 * ─────────────────────────────────────────────────────────────────────
 * P0 context (dispatch HASEEB-398)
 * ─────────────────────────────────────────────────────────────────────
 *
 * The three counter functions (`getOpenApprovalCount`, `getOpenTaskCount`,
 * `getSaraTaskStats`) are called on every Owner/CFO/Junior landing-
 * screen render and previously routed to `mockEngine.*` via mock-
 * fallback. Wiring them to live aggregates over `/api/taskbox`
 * eliminates fake counts in LIVE mode. Client-side aggregation avoids
 * requiring three new backend endpoints — per architect Q3 on the
 * 2026-04-24 inventory, the per-count backend path is rejected.
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
// Status/kind enum bridges
// ─────────────────────────────────────────────────────────────────────

/**
 * Backend enum → mock-compatible lowercase status.
 *   OPEN / IN_PROGRESS → 'open'
 *   COMPLETED          → 'completed'
 *   DISMISSED          → 'cancelled'
 *
 * UI components render `status === 'completed'` and `status ===
 * 'cancelled'` as terminal states (sorted last). The mock's 'open' /
 * 'in-progress' distinction collapses because the UI did not
 * differentiate them visually.
 */
function mapStatus(backendStatus) {
  switch (backendStatus) {
    case 'COMPLETED':
      return 'completed';
    case 'DISMISSED':
      return 'cancelled';
    case 'OPEN':
    case 'IN_PROGRESS':
    default:
      return 'open';
  }
}

/**
 * Backend kind → UI `type` string. The mock UI expects strings like
 * 'request-approval' / 'general-question'; backend has a smaller
 * controlled enum. We map the approval-adjacent kinds onto
 * 'request-approval' (so they land in the approvals tab) and leave
 * the rest as a generic type that still renders.
 */
function mapKind(backendKind) {
  if (!backendKind) return 'general-question';
  switch (backendKind) {
    case 'APPROVAL_REQUIRED':
      return 'request-approval';
    case 'REVIEW_REQUIRED':
      return 'review';
    case 'ACTION_REQUIRED':
      return 'action';
    default:
      return String(backendKind).toLowerCase().replace(/_/g, '-');
  }
}

/**
 * Build a minimal person stub from an assigned-role string. The
 * backend taskbox doesn't carry a user id at the queue level — it
 * carries `assignedRole`, and the user who eventually completes the
 * task is known only at completion time (via `completedBy`). UI
 * components read `sender.id` / `recipient.id` to check ownership;
 * we surface the role as the id so `recipient.id === 'cfo'` works
 * when the taskbox is assigned to the CFO role.
 */
function rolePerson(roleString, fallbackRole = 'CFO') {
  const role = String(roleString || fallbackRole).toUpperCase();
  const normalisedId = role === 'OWNER'
    ? 'owner'
    : role === 'ACCOUNTANT'
      ? 'cfo'
      : role === 'VIEWER'
        ? 'junior'
        : 'cfo';
  return {
    id: normalisedId,
    role: normalisedId === 'owner' ? 'Owner' : normalisedId === 'cfo' ? 'CFO' : 'Junior',
    name: normalisedId === 'owner' ? 'Owner' : normalisedId === 'cfo' ? 'You (CFO)' : 'Team Member',
    initials: normalisedId === 'owner' ? 'OW' : normalisedId === 'cfo' ? 'CF' : 'TM',
  };
}

/**
 * Map a backend TaskboxEntry → UI-compatible row.
 * Missing messaging fields (sender/recipient/subject/body/unread)
 * default to stable values so the existing components render.
 */
function mapEntry(row) {
  if (!row) return null;
  const status = mapStatus(row.status);
  const type = mapKind(row.kind);
  const assignee = rolePerson(row.assignedRole);
  return {
    id: row.id,
    subject: row.title || '',
    body: row.description || '',
    type,
    direction: 'inbound', // backend rows are work queued TO the assignee
    status,
    sender: rolePerson('OWNER'), // backend has no sender; default to Owner identity
    recipient: assignee,
    // UI displays formatRelativeTime on updatedAt; backend provides
    // both createdAt and updatedAt.
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || row.createdAt || null,
    dueDate: null, // backend has no dueDate on taskbox rows
    // Any linked journal entry shows up on the row via id-only; the
    // UI's linkedItem.preview is best-effort (empty until the screen
    // does a follow-up JE fetch, which the mock never required).
    linkedItem: row.linkedJournalEntryId
      ? { type: 'journal-entry', id: row.linkedJournalEntryId, preview: '' }
      : null,
    attachments: [],
    unread: row.status === 'OPEN',
    visibleTo: [assignee.role],
    // Pass-through for future adapters / debugging.
    _raw: row,
  };
}

// ─────────────────────────────────────────────────────────────────────
// HTTP wrapper — GET (list)
// ─────────────────────────────────────────────────────────────────────

// Module-local cache so the three counters don't each re-fetch the
// list on every render. The fetched list is valid for a short window
// (800ms) — long enough to de-dupe the three counter calls that fire
// on a single render; short enough that a user-triggered refresh on
// another screen doesn't render stale counts.
const _LIST_TTL_MS = 800;
let _listCache = null;
let _listCacheAt = 0;
let _listCachePromise = null;

async function getLiveTaskboxEntries() {
  const now = Date.now();
  if (_listCache && now - _listCacheAt < _LIST_TTL_MS) {
    return _listCache;
  }
  // Request de-dupe: if a fetch is already in flight, await it.
  if (_listCachePromise) return _listCachePromise;
  _listCachePromise = (async () => {
    try {
      const r = await client.get('/api/taskbox', { params: { limit: 500 } });
      const data = unwrap(r);
      const rows = Array.isArray(data?.rows)
        ? data.rows
        : Array.isArray(data)
          ? data
          : [];
      _listCache = rows.map(mapEntry).filter(Boolean);
      _listCacheAt = Date.now();
      return _listCache;
    } finally {
      _listCachePromise = null;
    }
  })();
  return _listCachePromise;
}

/**
 * Clear the local taskbox cache. Useful for tests + for consumers that
 * want a guaranteed-fresh read (currently no screen exercises this;
 * exposed for symmetry with the rules-module dismissed-set helper).
 */
export function _resetTaskboxCache() {
  _listCache = null;
  _listCacheAt = 0;
  _listCachePromise = null;
}

// ─────────────────────────────────────────────────────────────────────
// Public API — list
// ─────────────────────────────────────────────────────────────────────

/**
 * Fetch the taskbox list and apply the mock-compatible role + filter
 * client-side.
 *
 * Mock signature: `getTaskbox(role = "CFO", filter = "all")`
 * The mock's role gate is a UI-level partition (Owner sees subset,
 * Junior sees subset); the backend gates by auth and returns whatever
 * the caller is authorised for. We preserve the mock's filter tab
 * semantics so Tab switching on TaskboxScreen still renders plausible
 * subsets without requiring a backend query-param expansion.
 */
export async function getTaskbox(role = 'CFO', filter = 'all') {
  const all = await getLiveTaskboxEntries();
  // Role filter — best-effort against `recipient.id` since the backend
  // carries no sender. The mock's Junior filter included "sara, noor,
  // jasem, layla"; we approximate with any row whose assigned role is
  // not OWNER (junior lanes).
  let visible;
  if (role === 'CFO') {
    visible = all;
  } else if (role === 'Owner') {
    visible = all.filter((t) => t.recipient.id === 'owner');
  } else if (role === 'Junior') {
    visible = all.filter(
      (t) => t.recipient.id !== 'owner' && t.recipient.id !== 'cfo',
    );
  } else {
    visible = [];
  }

  const isCancelled = (t) => t.status === 'cancelled';
  switch (filter) {
    case 'unread':
      visible = visible.filter(
        (t) => t.unread && t.status !== 'completed' && !isCancelled(t),
      );
      break;
    case 'approvals':
      visible = visible.filter(
        (t) =>
          t.type === 'request-approval' &&
          !isCancelled(t) &&
          t.status !== 'completed',
      );
      break;
    case 'received':
      visible = visible.filter((t) => !isCancelled(t));
      break;
    case 'sent':
      // Backend has no sender concept — sent tab is always empty.
      visible = [];
      break;
    case 'needs-action':
      visible = visible.filter(
        (t) => t.status !== 'completed' && !isCancelled(t),
      );
      break;
    case 'completed':
      visible = visible.filter((t) => t.status === 'completed');
      break;
    default:
      break;
  }

  // Sort: open first (most-recent updatedAt first), then completed,
  // then cancelled.
  return visible.slice().sort((a, b) => {
    const rank = (s) => (s === 'cancelled' ? 2 : s === 'completed' ? 1 : 0);
    const r = rank(a.status) - rank(b.status);
    if (r !== 0) return r;
    return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
  });
}

// ─────────────────────────────────────────────────────────────────────
// Public API — client-side counters
// ─────────────────────────────────────────────────────────────────────

/**
 * Count open approval-kind taskbox entries for the role.
 *
 * Mock signature: `getOpenApprovalCount(role = "CFO")` — returns a
 * number.
 *
 * Derivation: fetch live list, filter to `request-approval` kind with
 * non-terminal status, count. Matches the mock's
 *   `t.type === "request-approval" && t.status !== "completed" &&
 *    t.status !== "rejected"` predicate (backend has no 'rejected'
 *   terminal state, so the predicate reduces to non-completed +
 *   non-cancelled non-completed).
 */
export async function getOpenApprovalCount(role = 'CFO') {
  const rows = await getTaskbox(role, 'all');
  return rows.filter(
    (t) =>
      t.type === 'request-approval' &&
      t.status !== 'completed' &&
      t.status !== 'cancelled',
  ).length;
}

/**
 * Count all non-completed taskbox entries for the role.
 *
 * Mock signature: `getOpenTaskCount(role = "CFO")` — returns a number.
 */
export async function getOpenTaskCount(role = 'CFO') {
  const rows = await getTaskbox(role, 'all');
  return rows.filter(
    (t) => t.status !== 'completed' && t.status !== 'cancelled',
  ).length;
}

/**
 * Aggregate stats used by the Junior landing screen.
 *
 * Mock shape: `{ open, overdue, dueSoon }`.
 *
 * Derivation over live list:
 *   - open:     all non-terminal entries assigned to junior-lane roles
 *   - overdue:  0 (backend taskbox has no dueDate — the mock fabricated
 *               due dates from createdAt + arbitrary offsets; we do
 *               not fabricate in LIVE mode)
 *   - dueSoon:  0 (same reason)
 *
 * The UI renders the three numbers in a compact stat card; rendering
 * `overdue=0 / dueSoon=0` is honest degradation rather than invented
 * urgency. A future backend enhancement can add dueDate to the taskbox
 * schema and these counts will populate automatically.
 */
export async function getSaraTaskStats() {
  const rows = await getTaskbox('Junior', 'all');
  const open = rows.filter(
    (t) => t.status !== 'completed' && t.status !== 'cancelled',
  ).length;
  return { open, overdue: 0, dueSoon: 0 };
}
