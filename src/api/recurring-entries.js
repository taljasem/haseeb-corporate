/**
 * Recurring Entries API module — AUDIT-ACC-010 (2026-04-22).
 *
 * Wraps the 8 endpoints exposed by corporate-api's
 * /api/recurring-entries router (corporate-api 65ccaf6). Three shipped
 * pre-AUDIT-ACC-010 (list / get / create / update / delete / process) +
 * two new in AUDIT-ACC-010:
 *
 *   GET    /api/recurring-entries                       → listRecurringEntries()
 *   GET    /api/recurring-entries/:id                   → getRecurringEntry(id)
 *   POST   /api/recurring-entries                       → createRecurringEntry(input)
 *   PATCH  /api/recurring-entries/:id                   → updateRecurringEntry(id, patch)
 *   DELETE /api/recurring-entries/:id                   → deleteRecurringEntry(id)
 *   POST   /api/recurring-entries/process               → processRecurringEntries()
 *   POST   /api/recurring-entries/:id/fire-next         → fireRecurringEntryNow(id)    [NEW]
 *   GET    /api/recurring-entries/:id/instances         → listRecurringEntryInstances(id, opts) [NEW]
 *
 * Role gates (enforced backend-side):
 *   - list / get / instances    : all authenticated roles
 *   - create / update / process : OWNER, ACCOUNTANT
 *   - fire-next                 : OWNER, ACCOUNTANT
 *   - delete                    : OWNER only
 *
 * Behavior change vs pre-AUDIT-ACC-010 mocks (HASEEB-200 wall fix):
 *   - process + fire-next now produce **DRAFT** JEs (never POSTED).
 *     The controller reviews the DRAFT + promotes through existing
 *     approval-tier routing. Each fire also emits an
 *     `AminahAdvisorPending` row with `sourceType: 'RECURRING_ENTRY'`
 *     which surfaces automatically via the existing advisor-pending
 *     queue — no special frontend wiring needed.
 *
 * fireRecurringEntryNow response shape:
 *   { recurring, instance: { id }, outcome: FireOutcome }
 *     where FireOutcome is one of:
 *       { kind: 'DRAFT_CREATED',  instance, journalEntryId, advisorPendingId }
 *       { kind: 'ADVISORY_ONLY',  instance, advisoryReason, advisorPendingId }
 *       { kind: 'FIRE_FAILED',    instance, errorMessage }
 *
 *   409 on paused template / past end-date / already-fired-for-this-
 *   scheduled-date (ConflictError). Caller must surface the error
 *   message to the operator; no silent retry.
 *
 * listRecurringEntryInstances response shape:
 *   { entries: Array<{
 *       id, recurringId, firedAt, scheduledFor,
 *       journalEntryId, firedByUserId, firedBy,
 *       status,               // 'DRAFT_CREATED' | 'ADVISORY_ONLY' | 'FIRE_FAILED'
 *       advisoryReason,       // non-null only for ADVISORY_ONLY
 *       journalEntry: { id, status, totalAmount } | null,
 *     }>,
 *     total, page, limit }
 *
 *   Paginated: default page=1 limit=20, limit capped at 100.
 *
 * Errors are normalised by client.js into `{ ok:false, status, code, message }`
 * and surface to callers.
 */
import client from './client';

function unwrap(response) {
  if (response && response.data && typeof response.data === 'object') {
    if ('data' in response.data && 'success' in response.data) {
      return response.data.data;
    }
    return response.data;
  }
  return response?.data;
}

/**
 * List all recurring-entry templates for this tenant. Ordered by
 * `nextDate ASC`. All authenticated roles.
 *
 * @returns {Promise<Array<{
 *   id: string, description: string, frequency: string,
 *   nextDate: string, endDate: string | null,
 *   templateLines: Array<{accountId, debit, credit, description?}>,
 *   isActive: boolean, createdAt: string, updatedAt: string
 * }>>}
 */
export async function listRecurringEntries() {
  const r = await client.get('/api/recurring-entries');
  const data = unwrap(r);
  return Array.isArray(data) ? data : [];
}

/**
 * Fetch a single recurring-entry template by id. 404 on unknown id.
 *
 * @param {string} id Recurring entry id
 */
export async function getRecurringEntry(id) {
  if (!id) throw new Error('getRecurringEntry: id is required');
  const r = await client.get(`/api/recurring-entries/${encodeURIComponent(id)}`);
  return unwrap(r);
}

/**
 * Create a new recurring-entry template. OWNER / ACCOUNTANT only.
 *
 * @param {{
 *   description: string,
 *   frequency: 'DAILY'|'WEEKLY'|'MONTHLY'|'QUARTERLY'|'ANNUAL',
 *   nextDate: string,                 // ISO date
 *   endDate?: string | null,          // ISO date, optional
 *   templateLines: Array<{accountId, debit, credit, description?}>,
 * }} input
 */
export async function createRecurringEntry(input) {
  const r = await client.post('/api/recurring-entries', input);
  return unwrap(r);
}

/**
 * Update a recurring-entry template (partial patch). OWNER / ACCOUNTANT
 * only. Pass `{isActive: false}` to pause, `{isActive: true}` to
 * resume. Other fields follow the create-input shape and are optional.
 *
 * @param {string} id
 * @param {Partial<{description, frequency, nextDate, endDate, templateLines, isActive: boolean}>} patch
 */
export async function updateRecurringEntry(id, patch) {
  if (!id) throw new Error('updateRecurringEntry: id is required');
  const r = await client.patch(
    `/api/recurring-entries/${encodeURIComponent(id)}`,
    patch || {},
  );
  return unwrap(r);
}

/**
 * Delete a recurring-entry template. OWNER only.
 *
 * @param {string} id
 */
export async function deleteRecurringEntry(id) {
  if (!id) throw new Error('deleteRecurringEntry: id is required');
  const r = await client.delete(`/api/recurring-entries/${encodeURIComponent(id)}`);
  return unwrap(r);
}

/**
 * Bulk-fire all recurring templates due today. OWNER / ACCOUNTANT only.
 *
 * Response shape: `{ generated: number, errors: Array<{id, error}> }`.
 * Per AUDIT-ACC-010 + HASEEB-200 fix: fires produce DRAFT JEs (not
 * POSTED) and emit advisor-pending rows.
 */
export async function processRecurringEntries() {
  const r = await client.post('/api/recurring-entries/process');
  return unwrap(r);
}

/**
 * Manually fire a specific recurring template NOW. Regardless of whether
 * `nextDate <= today`. OWNER / ACCOUNTANT only.
 *
 * Returns `{ recurring, instance: {id}, outcome }` — see file-level
 * comment for outcome variants.
 *
 * Throws (via client.js) on:
 *   - 404 — unknown id
 *   - 409 — template is paused / end-date passed / already-fired-today
 *
 * @param {string} id
 */
export async function fireRecurringEntryNow(id) {
  if (!id) throw new Error('fireRecurringEntryNow: id is required');
  const r = await client.post(
    `/api/recurring-entries/${encodeURIComponent(id)}/fire-next`,
  );
  return unwrap(r);
}

/**
 * List the fire-history (instances) for a recurring template. Paginated,
 * ordered by `firedAt DESC`. All authenticated roles.
 *
 * @param {string} id
 * @param {{limit?: number, offset?: number, page?: number}} opts
 *   Accepts either `{page, limit}` (native backend params) or
 *   `{limit, offset}` (derived — offset is converted to page). Default
 *   page=1 limit=20. limit is capped backend-side at 100.
 */
export async function listRecurringEntryInstances(id, opts = {}) {
  if (!id) throw new Error('listRecurringEntryInstances: id is required');
  const params = {};
  const limit = opts.limit != null ? Number(opts.limit) : undefined;
  if (Number.isFinite(limit)) params.limit = limit;
  if (opts.page != null) {
    const page = Number(opts.page);
    if (Number.isFinite(page) && page > 0) params.page = page;
  } else if (opts.offset != null && Number.isFinite(limit) && limit > 0) {
    // Convert (limit, offset) → (limit, page). offset=0 → page=1.
    const off = Number(opts.offset);
    if (Number.isFinite(off)) {
      params.page = Math.max(1, Math.floor(off / limit) + 1);
    }
  }
  const r = await client.get(
    `/api/recurring-entries/${encodeURIComponent(id)}/instances`,
    { params },
  );
  const data = unwrap(r);
  // Shape is {entries, total, page, limit}; hand back as-is.
  if (data && Array.isArray(data.entries)) return data;
  return { entries: [], total: 0, page: 1, limit: 20 };
}
