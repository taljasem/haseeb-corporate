/**
 * Tax Lodgements API module (FN-268, Phase 4 Track A Wave 2 — 2026-04-19).
 *
 * Wraps the generic tax-lodgement register. Covers CIT, WHT, VAT (pre-),
 * KFAS, NLST, Zakat, OTHER. Memo-only surface — no JE posting; the
 * underlying JEs are posted by upstream modules (four-levy, bill-
 * payment, etc.) long before a lodgement is recorded.
 *
 *   POST   /api/tax-lodgements           — record a filing. Role: OWNER.
 *   PATCH  /api/tax-lodgements/:id/status — transition status. Role:
 *                                           OWNER.
 *   GET    /api/tax-lodgements           — list + filters. Reads:
 *                                           OWNER/ACCOUNTANT/VIEWER/AUDITOR.
 *   GET    /api/tax-lodgements/:id       — read one. Same roles.
 *   GET    /api/tax-lodgements/:id/tie-out — compute GL tie-out for the
 *                                           lodgement's period. Reads:
 *                                           OWNER/ACCOUNTANT/AUDITOR (no
 *                                           VIEWER — tie-out reveals GL
 *                                           balances).
 *
 * Lodgement DTO (JSDoc):
 *   {
 *     id: string
 *     lodgementType: 'CIT'|'WHT'|'VAT'|'KFAS'|'NLST'|'ZAKAT'|'OTHER'
 *     filingReference: string
 *     periodFrom: string            // ISO8601 date-only
 *     periodTo: string              // ISO8601 date-only
 *     filedOnDate: string           // ISO8601 date-only
 *     filedAmountKwd: string        // decimal with up to 3 dp
 *     glAccountRole?: string|null   // AccountRole name for tie-out
 *     upstreamEntityType?: string|null
 *     upstreamEntityId?: string|null
 *     notes?: string|null
 *     status: 'SUBMITTED'|'ACKNOWLEDGED'|'AMENDED'|'VOIDED'
 *     createdAt: string
 *     updatedAt: string
 *   }
 *
 * TieOut DTO:
 *   {
 *     lodgementId: string
 *     lodgementType: string
 *     filingReference: string
 *     periodFrom: string
 *     periodTo: string
 *     filedAmountKwd: string        // decimal
 *     glBalanceKwd: string          // decimal (credit − debit on role)
 *     varianceKwd: string           // decimal (filed − glBalance)
 *     status: 'TIE_OK'|'VARIANCE'|'NO_GL_ACCOUNT'|'SKIPPED'
 *     note: string
 *   }
 *
 * Errors normalised by src/api/client.js. 403 on create/update means
 * non-OWNER; 403 on tie-out would mean VIEWER (tie-out is OWNER/
 * ACCOUNTANT/AUDITOR only — VIEWER gets 403 by design).
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
 * GET /api/tax-lodgements
 *
 * @param {Object} [filters]
 * @param {string} [filters.lodgementType]     one of the enum values
 * @param {string} [filters.status]            one of the status values
 * @param {string} [filters.periodFrom]        ISO8601 date-only
 * @param {string} [filters.periodTo]          ISO8601 date-only
 * @param {number} [filters.limit]             1..500
 * @returns {Promise<Array>}
 */
export async function listTaxLodgements(filters = {}) {
  const params = {};
  if (filters.lodgementType) params.lodgementType = filters.lodgementType;
  if (filters.status) params.status = filters.status;
  if (filters.periodFrom) params.periodFrom = filters.periodFrom;
  if (filters.periodTo) params.periodTo = filters.periodTo;
  if (filters.limit != null) params.limit = filters.limit;
  const r = await client.get('/api/tax-lodgements', { params });
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

/**
 * GET /api/tax-lodgements/:id
 *
 * @param {string} id
 * @returns {Promise<Object>}
 */
export async function getTaxLodgement(id) {
  const r = await client.get(
    `/api/tax-lodgements/${encodeURIComponent(id)}`,
  );
  return unwrap(r);
}

/**
 * POST /api/tax-lodgements
 *
 * @param {Object} payload                     see Lodgement DTO
 * @returns {Promise<Object>}
 */
export async function recordTaxLodgement(payload) {
  const r = await client.post('/api/tax-lodgements', payload);
  return unwrap(r);
}

/**
 * PATCH /api/tax-lodgements/:id/status
 *
 * @param {string} id
 * @param {Object} patch
 * @param {'SUBMITTED'|'ACKNOWLEDGED'|'AMENDED'|'VOIDED'} patch.status
 * @param {string} [patch.notes]
 * @returns {Promise<Object>}
 */
export async function updateTaxLodgementStatus(id, patch) {
  const r = await client.patch(
    `/api/tax-lodgements/${encodeURIComponent(id)}/status`,
    patch,
  );
  return unwrap(r);
}

/**
 * GET /api/tax-lodgements/:id/tie-out
 *
 * @param {string} id
 * @returns {Promise<Object>}                  TieOut DTO
 */
export async function getTaxLodgementTieOut(id) {
  const r = await client.get(
    `/api/tax-lodgements/${encodeURIComponent(id)}/tie-out`,
  );
  return unwrap(r);
}
