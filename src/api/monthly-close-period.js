/**
 * Monthly-close period adapters — HASEEB-401 D6 B7 (2026-04-24).
 *
 * Translates the legacy period-string-based close surface the
 * MonthEndCloseScreen speaks into the structured
 * `/api/monthly-close-checklist` (instance + items) API.
 *
 * Why this module exists:
 *   MonthEndCloseScreen was authored against a 14-verb mock surface
 *   keyed on a human-readable `period` string ("March 2026"). The
 *   backend ships a structured checklist API keyed on
 *   (fiscalYear, fiscalMonth) and UUID instance / item ids. The
 *   `ChecklistInstancePanel` component was built against the structured
 *   API directly, but the rest of MonthEndCloseScreen — legacy task
 *   rows + legacy status pills + owner approve / reject / reopen
 *   buttons — still calls the legacy verbs. This adapter re-shapes
 *   the structured API into the legacy mock shape so the screen keeps
 *   working in LIVE mode without a full rewrite.
 *
 * Entries exposed (all Fix-A via composition):
 *   - getMonthEndCloseTasks()                  — list+reshape
 *   - getCloseStatusDetail(period?)            — list+reshape
 *   - markCloseItemComplete(itemId, notes, attachments)
 *       → markItemStatus(itemId, { status: COMPLETED, notes })
 *       attachments param is IGNORED in LIVE mode — attachments on
 *       close-check rows are Fix-B (closed entityType enum blocks
 *       `close-check`); screens that call this with an attachments
 *       array still submit the status transition; the attachment list
 *       is dropped silently. The separate `attachCloseCheckFile` /
 *       `getCloseCheckAttachments` entries return the coming-soon
 *       envelope for the attachments sub-surface.
 *   - approveCloseAndSyncTask(period)          — resolves instance →
 *       signOffInstance(id). Returns { status: 'approved', lockedAt,
 *       taskId: null }. taskId is null in LIVE — the legacy flow
 *       mutated the in-memory TASKBOX_DB; the structured API does
 *       this via its own hooks server-side.
 *   - reopenPeriodClose(periodKey, reason, user = 'cfo')
 *       → resolves instance → reopenInstance(id).
 *       NOTE: the legacy mock had a branching semantic — if user !==
 *       'owner' the mock returned { requiresApproval: true, taskId }
 *       to queue an approval in the owner's taskbox. The structured
 *       API requires OWNER role (backend 403 for ACCOUNTANT). In LIVE
 *       we call reopenInstance directly; non-owner callers land in
 *       the backend's 403 error path which surfaces through the
 *       normalised client error envelope ({ok:false, status:403, …}).
 *       The screen handler already branches on `result?.success` /
 *       `result?.error`, so this degrades visibly rather than
 *       silently.
 *
 * Period → (fiscalYear, fiscalMonth) parser:
 *   Accepts "March 2026" / "Mar 2026" / "2026-03" / "03/2026".
 *   Falls back to the current year/month if the input cannot be
 *   parsed. Mirrors the parser in components/month-end/
 *   ChecklistInstancePanel.jsx.
 */
import * as ccl from './monthly-close-checklist';

const MONTH_LABELS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];
const MONTH_SHORT = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

function parsePeriod(period) {
  if (!period || typeof period !== 'string') {
    const d = new Date();
    return { fiscalYear: d.getFullYear(), fiscalMonth: d.getMonth() + 1 };
  }
  const trimmed = period.trim().toLowerCase();
  // "march 2026" / "mar 2026"
  for (let i = 0; i < 12; i++) {
    if (trimmed.startsWith(MONTH_LABELS[i]) || trimmed.startsWith(MONTH_SHORT[i])) {
      const year = parseInt(trimmed.match(/\d{4}/)?.[0] || '', 10);
      if (!Number.isNaN(year)) {
        return { fiscalYear: year, fiscalMonth: i + 1 };
      }
    }
  }
  // "2026-03"
  const iso = trimmed.match(/^(\d{4})-(\d{1,2})/);
  if (iso) {
    const y = parseInt(iso[1], 10);
    const m = parseInt(iso[2], 10);
    if (m >= 1 && m <= 12) return { fiscalYear: y, fiscalMonth: m };
  }
  // "03/2026"
  const slash = trimmed.match(/^(\d{1,2})\/(\d{4})/);
  if (slash) {
    const m = parseInt(slash[1], 10);
    const y = parseInt(slash[2], 10);
    if (m >= 1 && m <= 12) return { fiscalYear: y, fiscalMonth: m };
  }
  const d = new Date();
  return { fiscalYear: d.getFullYear(), fiscalMonth: d.getMonth() + 1 };
}

function periodLabel(fiscalYear, fiscalMonth) {
  const name = MONTH_LABELS[fiscalMonth - 1];
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${fiscalYear}`;
}

// ─────────────────────────────────────────────────────────────────────
// Instance resolver cache
// ─────────────────────────────────────────────────────────────────────
//
// The screen makes multiple calls per render (getMonthEndCloseTasks +
// getCloseStatusDetail + markCloseItemComplete) all keyed on the same
// period. Caching the resolved instance for a short window de-dupes
// the instance-open round trip. TTL is 2s — long enough to de-dupe a
// single render pass; short enough that a status-change from another
// surface (ChecklistInstancePanel itself, or a backend hook) lands on
// the next screen refresh.
const _INSTANCE_TTL_MS = 2000;
const _instanceByPeriod = new Map(); // key: `${y}-${m}` → { at, value }

export function _resetMonthEndCache() {
  _instanceByPeriod.clear();
}

async function resolveInstance(fiscalYear, fiscalMonth, { allowOpen = false } = {}) {
  const key = `${fiscalYear}-${fiscalMonth}`;
  const cached = _instanceByPeriod.get(key);
  const now = Date.now();
  if (cached && now - cached.at < _INSTANCE_TTL_MS) return cached.value;

  let inst = null;
  try {
    const list = await ccl.listInstances({ fiscalYear });
    inst = Array.isArray(list)
      ? list.find((i) => i.fiscalYear === fiscalYear && i.fiscalMonth === fiscalMonth) || null
      : null;
  } catch {
    inst = null;
  }

  // If no instance exists yet AND the caller is OK with auto-open,
  // try to open one. openInstance is idempotent on (fiscalYear,
  // fiscalMonth) so the second caller will receive the same instance.
  if (!inst && allowOpen) {
    try {
      inst = await ccl.openInstance({ fiscalYear, fiscalMonth });
    } catch {
      inst = null;
    }
  }

  // Fetch the hydrated instance (items populated) if we got an id from
  // listInstances — listInstances doesn't hydrate items.
  if (inst && inst.id && (!Array.isArray(inst.items) || inst.items.length === 0)) {
    try {
      const full = await ccl.getInstance(inst.id);
      if (full) inst = full;
    } catch {
      // keep unhydrated instance
    }
  }

  _instanceByPeriod.set(key, { at: Date.now(), value: inst });
  return inst;
}

// ─────────────────────────────────────────────────────────────────────
// Reshape helpers: backend InstanceItem → legacy mock task row
// ─────────────────────────────────────────────────────────────────────

/**
 * Map backend item.status → legacy mock status string.
 *   PENDING       → 'pending'
 *   IN_PROGRESS   → 'in-progress'
 *   COMPLETED     → 'complete'
 *   BLOCKED       → 'blocked'
 */
function mapItemStatus(backend) {
  switch (backend) {
    case 'COMPLETED':
      return 'complete';
    case 'IN_PROGRESS':
      return 'in-progress';
    case 'BLOCKED':
      return 'blocked';
    case 'PENDING':
    default:
      return 'pending';
  }
}

/**
 * Instance.status → legacy mock top-level status.
 *   OPEN / IN_PROGRESS → 'in-progress'
 *   COMPLETED          → 'pending_approval'  (awaiting sign-off)
 *   SIGNED_OFF         → 'approved'
 *   REOPENED           → 'in_progress'
 */
function mapInstanceStatus(backend) {
  switch (backend) {
    case 'SIGNED_OFF':
      return 'approved';
    case 'COMPLETED':
      return 'pending_approval';
    case 'REOPENED':
    case 'IN_PROGRESS':
    case 'OPEN':
    default:
      return 'in_progress';
  }
}

/**
 * Build a legacy-shape assignee from the completedBy of an instance item.
 * The mock used structured Person objects (id, name, role, initials);
 * backend provides completedBy (user id) + completedByName (display
 * name). When the item isn't completed yet, we synthesize a neutral
 * assignee so the UI's Avatar renders without a name crash.
 */
function itemAssignee(item) {
  if (item.completedBy) {
    const name = item.completedByName || 'Completed';
    const initials = name
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join('') || 'U';
    return {
      id: item.completedBy,
      name,
      role: 'team',
      initials,
    };
  }
  // Fallback: show role-gate hint so UI can render Avatar without crash.
  const gate = item.completeRoleGate || 'OWNER_OR_ACCOUNTANT';
  return {
    id: gate.toLowerCase(),
    name: gate === 'OWNER' ? 'Owner' : gate === 'ACCOUNTANT' ? 'Accountant' : 'Team',
    role: gate === 'OWNER' ? 'Owner' : 'CFO',
    initials: gate === 'OWNER' ? 'OW' : gate === 'ACCOUNTANT' ? 'AC' : 'TM',
  };
}

function reshapeItem(item) {
  if (!item) return null;
  return {
    id: item.id,
    name: item.label || '',
    assignee: itemAssignee(item),
    status: mapItemStatus(item.status),
    completedAt: item.completedAt || null,
    dueDate: null,
    // pass-throughs the legacy UI occasionally reads
    notes: item.notes || null,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Public wrappers — match legacy mock signatures
// ─────────────────────────────────────────────────────────────────────

/**
 * getMonthEndCloseTasks() — legacy shape:
 *   { period, status, tasks: [{id,name,assignee,status,completedAt,dueDate}],
 *     validations: [...], aminahSummary: string }
 *
 * Live composition:
 *   - Resolve instance for today's fiscal period (auto-open if missing)
 *   - Reshape instance.items → legacy tasks.
 *   - validations[] is empty (pre-close validations are Fix-B
 *     coming-soon — shipped under HASEEB-399 D4 via
 *     runPreCloseValidations)
 *   - aminahSummary is empty (legacy mock's AI narrative is not
 *     computed on the structured-checklist side). The screen's AminahNarrationCard
 *     renders empty / loading when absent.
 */
export async function getMonthEndCloseTasks() {
  const d = new Date();
  const fiscalYear = d.getFullYear();
  const fiscalMonth = d.getMonth() + 1;
  const inst = await resolveInstance(fiscalYear, fiscalMonth, { allowOpen: true });

  const items = Array.isArray(inst?.items) ? inst.items : [];
  const tasks = items
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map(reshapeItem)
    .filter(Boolean);

  return {
    period: inst ? periodLabel(inst.fiscalYear, inst.fiscalMonth) : periodLabel(fiscalYear, fiscalMonth),
    status: mapInstanceStatus(inst?.status || 'OPEN'),
    tasks,
    validations: [],
    aminahSummary: '',
  };
}

/**
 * getCloseStatusDetail(period?) — legacy shape:
 *   { period, status, day, totalDays, completedItems, totalItems,
 *     lastUpdated, blockers, rejectionReason, submittedAt, approvedAt }
 */
export async function getCloseStatusDetail(period) {
  const parsed = period ? parsePeriod(period) : (() => {
    const d = new Date();
    return { fiscalYear: d.getFullYear(), fiscalMonth: d.getMonth() + 1 };
  })();
  const inst = await resolveInstance(parsed.fiscalYear, parsed.fiscalMonth, { allowOpen: false });

  const items = Array.isArray(inst?.items) ? inst.items : [];
  const completedItems = items.filter((x) => x.status === 'COMPLETED').length;
  const totalItems = items.length;

  return {
    period: inst
      ? periodLabel(inst.fiscalYear, inst.fiscalMonth)
      : periodLabel(parsed.fiscalYear, parsed.fiscalMonth),
    status: mapInstanceStatus(inst?.status || 'OPEN'),
    day: totalItems,
    totalDays: totalItems,
    completedItems,
    totalItems,
    lastUpdated: inst?.updatedAt || null,
    blockers: items
      .filter((x) => x.status === 'BLOCKED')
      .map((x) => ({
        id: x.id,
        label: x.blockedReason || x.label || 'Blocked',
        severity: 'warning',
      })),
    // No rejection / soft-reject surface on the structured API —
    // reopen + owner sign-off are the equivalent mechanics.
    rejectionReason: null,
    submittedAt: inst?.status === 'COMPLETED' ? inst?.updatedAt : null,
    approvedAt: inst?.status === 'SIGNED_OFF' ? (inst?.signedOffAt || null) : null,
  };
}

/**
 * markCloseItemComplete(itemId, notes, attachments) — legacy shape
 * returns { id, completed, notes, attachments, completedAt, completedBy }.
 *
 * Live: markItemStatus(itemId, { status: COMPLETED, notes }).
 * attachments param is silently dropped in LIVE (close-check
 * attachments are Fix-B via the separate attachCloseCheckFile entry).
 *
 * Note: the backend returns { item, instance } — we surface the item
 * fields in the legacy shape.
 */
export async function markCloseItemComplete(itemId, notes /* , attachments */) {
  // Bust the per-period cache so the next status read sees the
  // transition immediately (otherwise the 2s TTL would serve a stale
  // instance).
  _resetMonthEndCache();
  const body = { status: 'COMPLETED' };
  if (notes) body.notes = notes;
  const result = await ccl.markItemStatus(itemId, body);
  const item = result?.item || result || {};
  return {
    id: item.id || itemId,
    completed: true,
    notes: item.notes || notes || '',
    // attachments surface is Fix-B coming-soon; return empty array so
    // the legacy UI renders without a null-crash.
    attachments: [],
    completedAt: item.completedAt || new Date().toISOString(),
    completedBy: item.completedBy || null,
  };
}

/**
 * approveCloseAndSyncTask(period) — legacy shape returns
 *   { status: 'approved', lockedAt, taskId }.
 *
 * Live: resolve instance for period → signOffInstance(id).
 * taskId is null in LIVE — the structured API manages its own
 * taskbox/audit hooks server-side; the legacy mock's explicit
 * taskbox row creation is no longer a frontend concern.
 */
export async function approveCloseAndSyncTask(period) {
  const parsed = period ? parsePeriod(period) : (() => {
    const d = new Date();
    return { fiscalYear: d.getFullYear(), fiscalMonth: d.getMonth() + 1 };
  })();
  const inst = await resolveInstance(parsed.fiscalYear, parsed.fiscalMonth, { allowOpen: false });
  if (!inst || !inst.id) {
    return {
      status: 'in_progress',
      lockedAt: null,
      taskId: null,
      error: 'No open close instance for the requested period.',
    };
  }
  _resetMonthEndCache();
  try {
    const updated = await ccl.signOffInstance(inst.id);
    return {
      status: mapInstanceStatus(updated?.status || 'SIGNED_OFF'),
      lockedAt: updated?.signedOffAt || new Date().toISOString(),
      taskId: null,
    };
  } catch (err) {
    return {
      status: 'in_progress',
      lockedAt: null,
      taskId: null,
      error: err?.message || String(err),
    };
  }
}

/**
 * reopenPeriodClose(periodKey, reason, user) — legacy shape returns one of
 *   { success: true, status: 'open' }
 *   { requiresApproval: true, taskId }
 *   { error: string }
 *
 * Live:
 *   - OWNER caller → reopenInstance(id) directly. Backend permits
 *     reopen only when instance.status in {SIGNED_OFF, COMPLETED}.
 *   - Non-OWNER caller → same call; backend returns 403; we translate
 *     the error into the legacy { error } branch. The mock's
 *     "requiresApproval" taskbox-queuing path does not exist on the
 *     structured API.
 *
 * `reason` is not passed through in the current backend shape (no
 * reopenReason on POST /instances/:id/reopen). The reason is surfaced
 * in the UI's own audit trail (emitTaskboxChange) but not stored
 * server-side in this endpoint.
 */
// eslint-disable-next-line no-unused-vars
export async function reopenPeriodClose(periodKey, _reason, _user) {
  const parsed = periodKey ? parsePeriod(periodKey) : (() => {
    const d = new Date();
    return { fiscalYear: d.getFullYear(), fiscalMonth: d.getMonth() + 1 };
  })();
  const inst = await resolveInstance(parsed.fiscalYear, parsed.fiscalMonth, { allowOpen: false });
  if (!inst || !inst.id) {
    return { error: 'Period not found.' };
  }
  if (inst.status === 'OPEN' || inst.status === 'IN_PROGRESS' || inst.status === 'REOPENED') {
    return { error: 'Period is not closed.' };
  }
  _resetMonthEndCache();
  try {
    await ccl.reopenInstance(inst.id);
    return { success: true, status: 'open' };
  } catch (err) {
    const message = err?.message || String(err);
    return { error: message };
  }
}
