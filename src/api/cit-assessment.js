/**
 * CIT Assessment API module (FN-249, Phase 4 Track A Wave 2 — 2026-04-19).
 *
 * Wraps the Kuwait CIT-case lifecycle register. One row per fiscal year
 * (unique constraint on server). Memo-only — no JE posting in this
 * partial; the final-assessed JE adjustment ships in a follow-up
 * dispatch. All mutations are OWNER-only.
 *
 *   POST   /api/cit-assessment                      — create case
 *   POST   /api/cit-assessment/:id/open-review      — FILED → UNDER_REVIEW
 *   POST   /api/cit-assessment/:id/record-assessment — → ASSESSED
 *   POST   /api/cit-assessment/:id/record-objection  — ASSESSED → OBJECTED
 *   POST   /api/cit-assessment/:id/finalize          — → FINAL
 *   POST   /api/cit-assessment/:id/close             — FINAL → CLOSED
 *   POST   /api/cit-assessment/:id/mark-statute-expired — any non-terminal
 *   GET    /api/cit-assessment                      — list + filters
 *   GET    /api/cit-assessment/approaching-statute  — sweep
 *   GET    /api/cit-assessment/:id                  — read one
 *
 * CitAssessment DTO (JSDoc):
 *   {
 *     id: string
 *     fiscalYear: number                       // unique per tenant
 *     filedAmountKwd: string                   // decimal (up to 3 dp)
 *     filedOnDate: string                      // ISO8601 date-only
 *     authorityCaseNumber?: string | null
 *     status: 'FILED'|'UNDER_REVIEW'|'ASSESSED'|'OBJECTED'|'FINAL'|
 *             'CLOSED'|'STATUTE_EXPIRED'
 *     computationId?: string | null            // optional link to
 *                                              // FourLevyComputation
 *     assessedAmountKwd?: string | null
 *     assessedOnDate?: string | null
 *     varianceKwd?: string | null              // assessed - filed
 *     objectionFiledOn?: string | null
 *     finalAmountKwd?: string | null
 *     finalizedOnDate?: string | null
 *     statuteExpiresOn: string                 // ISO8601 date-only
 *     notes?: string | null
 *     createdAt: string
 *     updatedAt: string
 *   }
 *
 * Errors normalised by src/api/client.js. 403 on any write means
 * non-OWNER. 409 on create means a case already exists for that fiscal
 * year.
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
 * GET /api/cit-assessment
 *
 * @param {Object} [filters]
 * @param {string} [filters.status]
 * @param {number} [filters.fiscalYearFrom]
 * @param {number} [filters.fiscalYearTo]
 * @param {boolean} [filters.openOnly]
 * @returns {Promise<Array>}                         CitAssessment[]
 */
export async function listCitAssessments(filters = {}) {
  const params = {};
  if (filters.status) params.status = filters.status;
  if (filters.fiscalYearFrom != null) params.fiscalYearFrom = filters.fiscalYearFrom;
  if (filters.fiscalYearTo != null) params.fiscalYearTo = filters.fiscalYearTo;
  if (filters.openOnly != null) params.openOnly = filters.openOnly;
  const r = await client.get('/api/cit-assessment', { params });
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

/**
 * GET /api/cit-assessment/:id
 *
 * @param {string} id
 * @returns {Promise<Object>}
 */
export async function getCitAssessment(id) {
  const r = await client.get(
    `/api/cit-assessment/${encodeURIComponent(id)}`,
  );
  return unwrap(r);
}

/**
 * GET /api/cit-assessment/approaching-statute
 *
 * Returns the subset of cases whose statuteExpiresOn is within
 * `withinDays` of `asOf` (server defaults apply when omitted).
 *
 * @param {Object} [query]
 * @param {string} [query.asOf]                     ISO8601 date-only
 * @param {number} [query.withinDays]               1..730
 * @returns {Promise<Array>}
 */
export async function listApproachingStatute(query = {}) {
  const params = {};
  if (query.asOf) params.asOf = query.asOf;
  if (query.withinDays != null) params.withinDays = query.withinDays;
  const r = await client.get('/api/cit-assessment/approaching-statute', {
    params,
  });
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

/**
 * POST /api/cit-assessment
 *
 * @param {Object} payload
 * @param {number} payload.fiscalYear               unique per tenant
 * @param {string} payload.filedAmountKwd           decimal
 * @param {string} payload.filedOnDate              ISO date
 * @param {string} [payload.computationId]          uuid
 * @param {string} [payload.authorityCaseNumber]
 * @param {string} [payload.statuteExpiresOn]       ISO date; server
 *                                                  defaults to
 *                                                  fiscalYear-end + 5y
 * @param {string} [payload.notes]
 * @returns {Promise<Object>}                       created case
 */
export async function createCitAssessment(payload) {
  const r = await client.post('/api/cit-assessment', payload);
  return unwrap(r);
}

/**
 * POST /api/cit-assessment/:id/open-review
 *
 * Transition FILED → UNDER_REVIEW. Requires authorityCaseNumber to pin
 * the formal reference used by the authority.
 *
 * @param {string} id
 * @param {Object} patch
 * @param {string} patch.authorityCaseNumber
 * @returns {Promise<Object>}
 */
export async function openCitAssessmentReview(id, patch) {
  const r = await client.post(
    `/api/cit-assessment/${encodeURIComponent(id)}/open-review`,
    patch,
  );
  return unwrap(r);
}

/**
 * POST /api/cit-assessment/:id/record-assessment
 *
 * Transition to ASSESSED. Server computes variance = assessed - filed.
 *
 * @param {string} id
 * @param {Object} patch
 * @param {string} patch.assessedAmountKwd
 * @param {string} patch.assessedOnDate
 * @param {string} [patch.authorityCaseNumber]
 * @param {string} [patch.notes]
 * @returns {Promise<Object>}
 */
export async function recordCitAssessment(id, patch) {
  const r = await client.post(
    `/api/cit-assessment/${encodeURIComponent(id)}/record-assessment`,
    patch,
  );
  return unwrap(r);
}

/**
 * POST /api/cit-assessment/:id/record-objection
 *
 * Transition ASSESSED → OBJECTED.
 *
 * @param {string} id
 * @param {Object} patch
 * @param {string} patch.objectionFiledOn
 * @param {string} [patch.notes]
 * @returns {Promise<Object>}
 */
export async function recordCitAssessmentObjection(id, patch) {
  const r = await client.post(
    `/api/cit-assessment/${encodeURIComponent(id)}/record-objection`,
    patch,
  );
  return unwrap(r);
}

/**
 * POST /api/cit-assessment/:id/finalize
 *
 * Transition to FINAL.
 *
 * @param {string} id
 * @param {Object} patch
 * @param {string} patch.finalAmountKwd
 * @param {string} patch.finalizedOnDate
 * @param {string} [patch.notes]
 * @returns {Promise<Object>}
 */
export async function finalizeCitAssessment(id, patch) {
  const r = await client.post(
    `/api/cit-assessment/${encodeURIComponent(id)}/finalize`,
    patch,
  );
  return unwrap(r);
}

/**
 * POST /api/cit-assessment/:id/close
 *
 * Transition FINAL → CLOSED. Typically fired once the final assessed
 * amount has been paid (or the refund settled).
 *
 * @param {string} id
 * @returns {Promise<Object>}
 */
export async function closeCitAssessment(id) {
  const r = await client.post(
    `/api/cit-assessment/${encodeURIComponent(id)}/close`,
  );
  return unwrap(r);
}

/**
 * POST /api/cit-assessment/:id/mark-statute-expired
 *
 * Transition any non-terminal state → STATUTE_EXPIRED.
 *
 * @param {string} id
 * @returns {Promise<Object>}
 */
export async function markCitAssessmentStatuteExpired(id) {
  const r = await client.post(
    `/api/cit-assessment/${encodeURIComponent(id)}/mark-statute-expired`,
  );
  return unwrap(r);
}
