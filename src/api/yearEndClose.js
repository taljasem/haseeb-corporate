/**
 * Year-End Close API module — AUDIT-ACC-003 (2026-04-22).
 *
 * Wraps the 7 endpoints exposed by corporate-api's year-end-close module
 * (FN-271, TASK-WAVE5-YEAR-END-ROLLOVER). This is the ANNUAL fiscal-year
 * close workflow — distinct from the monthly close surface wired under
 * /api/monthly-close-checklist + the CFO today dashboard.
 *
 * Endpoints:
 *   GET    /api/year-end-close/config          — read current Kuwait
 *          year-end config (revenueRoles / expenseRoles /
 *          requireStatutoryReserveBeforeClose). OWNER / ACCOUNTANT /
 *          AUDITOR.
 *   PATCH  /api/year-end-close/config          — patch config. OWNER
 *          only.
 *   POST   /api/year-end-close/prepare         — prepare the close for
 *          a fiscal year; server computes the snapshot (revenue total,
 *          expense total, net income, opening + projected ending RE,
 *          prerequisites gate). OWNER / ACCOUNTANT.
 *   GET    /api/year-end-close/                — list close records
 *          across fiscal years. OWNER / ACCOUNTANT / VIEWER / AUDITOR.
 *   POST   /api/year-end-close/:recordId/approve — approve a PENDING_APPROVAL
 *          close. OWNER only; service-layer SoD rejects when the approving
 *          Owner is the same user who called prepare. Frontend mirrors the
 *          SoD gate by hiding the Approve button on the Owner's own
 *          prepared record.
 *   POST   /api/year-end-close/:recordId/reverse — reverse a CLOSED
 *          close. OWNER only. `reason` required (non-empty, max 2000).
 *   GET    /api/year-end-close/:fiscalYear     — read one close record
 *          by fiscal year. All read roles.
 *
 * Lifecycle statuses (`YearEndCloseStatus` enum — mirror backend):
 *   PENDING_PREP | PENDING_APPROVAL | CLOSING | CLOSED | REVERSED
 *
 * Wire-level record shape (`YearEndCloseRecordDto`, from backend
 * year-end-close.types.ts). All monetary fields are KWD Decimal(18,3)
 * strings at the JSON boundary. Callers MUST NOT parseFloat; use
 * decimal.js for any math / comparison:
 *   {
 *     id: string,
 *     fiscalYear: number,
 *     status: 'PENDING_PREP'|'PENDING_APPROVAL'|'CLOSING'|'CLOSED'|'REVERSED',
 *     revenueCloseJeId: string | null,
 *     expenseCloseJeId: string | null,
 *     incomeSummaryCloseJeId: string | null,
 *     revenueTotalKwd: string | null,
 *     expenseTotalKwd: string | null,
 *     netIncomeKwd: string | null,
 *     openingRetainedEarningsKwd: string | null,
 *     endingRetainedEarningsKwd: string | null,
 *     linkedRestatementIds: string[],
 *     preparedBy: string,
 *     preparedAt: string,
 *     approvedBy: string | null,
 *     approvedAt: string | null,
 *     reversedAt: string | null,
 *     reversedBy: string | null,
 *     reversalReason: string | null,
 *     reversalJournalEntryIds: string[],
 *     notes: string | null,
 *     createdAt: string,
 *     updatedAt: string,
 *   }
 *
 * Response envelope: controller returns `successResponse(...)` which
 * this module unwraps into the narrowed record / list / config shape
 * directly.
 *
 * Errors flow through `src/api/client.js` into
 * `{ ok:false, status, code, message }`. 403 on any write means
 * non-OWNER (or the SoD self-approval violation). 409 on /prepare can
 * indicate an existing prepared record for the fiscal year.
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

// ── Config ────────────────────────────────────────────────────────

/**
 * GET /api/year-end-close/config
 *
 * Read current TenantYearEndConfig. Returns the row directly (not
 * wrapped in { config }); callers destructure as needed.
 *
 * @returns {Promise<{
 *   id: string,
 *   revenueRoles: string[],
 *   expenseRoles: string[],
 *   requireStatutoryReserveBeforeClose: boolean,
 *   configuredBy: string,
 *   configuredAt: string,
 *   updatedBy: string | null,
 *   updatedAt: string,
 * }>}
 */
export async function getYearEndCloseConfig() {
  const r = await client.get('/api/year-end-close/config');
  return unwrap(r);
}

/**
 * PATCH /api/year-end-close/config
 *
 * OWNER-only. At least one of revenueRoles / expenseRoles /
 * requireStatutoryReserveBeforeClose must be supplied (backend refine).
 *
 * @param {{
 *   revenueRoles?: string[],
 *   expenseRoles?: string[],
 *   requireStatutoryReserveBeforeClose?: boolean,
 * }} body
 * @returns {Promise<object>}                        updated config DTO
 */
export async function updateYearEndCloseConfig(body) {
  if (!body || typeof body !== 'object') {
    throw new Error(
      'updateYearEndCloseConfig: body is required and must be an object',
    );
  }
  const hasRev = Array.isArray(body.revenueRoles);
  const hasExp = Array.isArray(body.expenseRoles);
  const hasReserveFlag =
    typeof body.requireStatutoryReserveBeforeClose === 'boolean';
  if (!hasRev && !hasExp && !hasReserveFlag) {
    throw new Error(
      'updateYearEndCloseConfig: at least one of revenueRoles / expenseRoles / requireStatutoryReserveBeforeClose must be provided',
    );
  }
  const payload = {};
  if (hasRev) payload.revenueRoles = body.revenueRoles;
  if (hasExp) payload.expenseRoles = body.expenseRoles;
  if (hasReserveFlag)
    payload.requireStatutoryReserveBeforeClose =
      body.requireStatutoryReserveBeforeClose;
  const r = await client.patch('/api/year-end-close/config', payload);
  return unwrap(r);
}

// ── Prepare / approve / reverse ───────────────────────────────────

/**
 * POST /api/year-end-close/prepare
 *
 * OWNER / ACCOUNTANT. Service computes the snapshot (revenue total,
 * expense total, net income, opening + projected ending RE,
 * prerequisites gate) and persists a PENDING_APPROVAL record. Returns
 * the prepared record DTO.
 *
 * @param {number} fiscalYear                        integer 2000..2100
 * @returns {Promise<object>}                        prepared record
 */
export async function prepareYearEndClose(fiscalYear) {
  if (fiscalYear == null) {
    throw new Error('prepareYearEndClose: fiscalYear is required');
  }
  const fy = Number(fiscalYear);
  if (!Number.isInteger(fy) || fy < 2000 || fy > 2100) {
    throw new Error(
      'prepareYearEndClose: fiscalYear must be an integer in [2000, 2100]',
    );
  }
  const r = await client.post('/api/year-end-close/prepare', {
    fiscalYear: fy,
  });
  return unwrap(r);
}

/**
 * POST /api/year-end-close/:recordId/approve
 *
 * OWNER only. Service enforces SoD — the approving Owner MUST differ
 * from the user who prepared. Frontend mirrors this by hiding the
 * Approve button on the Owner's own prepared record with an inline
 * tooltip explanation; the backend 403 remains as defense in depth.
 *
 * @param {string} recordId                          YearEndCloseRecord.id
 * @returns {Promise<object>}                        CLOSED record
 */
export async function approveYearEndClose(recordId) {
  if (!recordId) {
    throw new Error('approveYearEndClose: recordId is required');
  }
  const r = await client.post(
    `/api/year-end-close/${encodeURIComponent(recordId)}/approve`,
  );
  return unwrap(r);
}

/**
 * POST /api/year-end-close/:recordId/reverse
 *
 * OWNER only. Reverses an approved (CLOSED) fiscal-year close: reopens
 * the period, unlocks subsidiary ledgers, and emits counter-JEs. The
 * `reason` field is persisted to the audit trail and is required;
 * frontend adds governance friction (min-10-char textarea +
 * owner-reconfirm checkbox) on top of the backend's enforcement.
 *
 * @param {string} recordId
 * @param {{ reason: string }} body
 * @returns {Promise<object>}                        REVERSED record
 */
export async function reverseYearEndClose(recordId, body) {
  if (!recordId) {
    throw new Error('reverseYearEndClose: recordId is required');
  }
  if (!body?.reason || typeof body.reason !== 'string') {
    throw new Error('reverseYearEndClose: reason (string) is required');
  }
  const trimmed = body.reason.trim();
  if (trimmed.length === 0) {
    throw new Error('reverseYearEndClose: reason must be non-empty');
  }
  if (trimmed.length > 2000) {
    throw new Error('reverseYearEndClose: reason must be <= 2000 chars');
  }
  const r = await client.post(
    `/api/year-end-close/${encodeURIComponent(recordId)}/reverse`,
    { reason: trimmed },
  );
  return unwrap(r);
}

// ── Reads ─────────────────────────────────────────────────────────

/**
 * GET /api/year-end-close/
 *
 * List all YearEndCloseRecord rows across fiscal years. All read roles
 * (OWNER, ACCOUNTANT, VIEWER, AUDITOR). Screen sorts desc by fiscal
 * year locally.
 *
 * @returns {Promise<Array>}                         YearEndCloseRecordDto[]
 */
export async function listYearEndCloseRecords() {
  const r = await client.get('/api/year-end-close/');
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

/**
 * GET /api/year-end-close/:fiscalYear
 *
 * Read one close record for a fiscal year. Returns the DTO directly;
 * 404 when no record exists. Callers translate 404 into "no close
 * prepared yet" UX.
 *
 * @param {number} fiscalYear
 * @returns {Promise<object>}                        YearEndCloseRecordDto
 */
export async function getYearEndClose(fiscalYear) {
  if (fiscalYear == null) {
    throw new Error('getYearEndClose: fiscalYear is required');
  }
  const fy = Number(fiscalYear);
  if (!Number.isInteger(fy) || fy < 2000 || fy > 2100) {
    throw new Error(
      'getYearEndClose: fiscalYear must be an integer in [2000, 2100]',
    );
  }
  const r = await client.get(
    `/api/year-end-close/${encodeURIComponent(String(fy))}`,
  );
  return unwrap(r);
}
