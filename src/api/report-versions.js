/**
 * Report Versions API module (FN-244, Phase 4 Wave 1).
 *
 * Wraps the immutable report-version register on the Corporate API:
 *
 *   POST   /api/report-versions           — publish a new version.
 *                                           Roles: OWNER + ACCOUNTANT.
 *   GET    /api/report-versions           — list versions for (type, key).
 *                                           Roles: OWNER + ACCOUNTANT + VIEWER + AUDITOR.
 *   GET    /api/report-versions/:id       — read one version.
 *                                           Roles: same as list.
 *
 * `reportType` ∈
 *   PROFIT_AND_LOSS | BALANCE_SHEET | CASH_FLOW_STATEMENT | TRIAL_BALANCE |
 *   AGING_AR | AGING_AP | BUDGET_VARIANCE | CUSTOM
 *
 * `reportKey` is an opaque scope string the caller picks. For the financial
 * statements screen it is the period key (e.g. "2026-03" for month, or a
 * from-to range).
 *
 * Publishing sets `version` auto-incremented per `(reportType, reportKey)`
 * tuple on the server. Supersession sets `supersededAt` + `supersededBy`
 * on the prior row, creating an immutable chain.
 *
 * ReportVersion DTO shape (JSDoc, dashboard speaks JSON):
 *   {
 *     id: string
 *     tenantId: string
 *     reportType: string
 *     reportKey: string
 *     version: number                   // auto-incremented per (type, key)
 *     snapshotData: any                 // opaque per-report payload
 *     asOfDate?: string                 // ISO8601 date-only
 *     periodFrom?: string               // ISO8601 date-only
 *     periodTo?: string                 // ISO8601 date-only
 *     notes?: string
 *     publishedAt: string               // ISO8601
 *     publishedBy: string               // user id
 *     publishedByName?: string          // server-hydrated display name
 *     supersedesId?: string             // prior row id this supersedes
 *     supersededAt?: string             // set when a later row supersedes this
 *     supersededBy?: string             // id of the later row
 *     createdAt: string
 *   }
 *
 * All endpoints return the standard wrapped envelope `{ success, data }`.
 * Errors are normalised by `src/api/client.js` into:
 *   { ok: false, status, code, message }
 * with code ∈ NETWORK_ERROR | UNAUTHORIZED | SERVER_ERROR | CLIENT_ERROR.
 * A 403 on publish means the user is not OWNER or ACCOUNTANT; the UI should
 * present that gracefully rather than blowing up.
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
 * POST /api/report-versions
 *
 * @param {Object} payload
 * @param {string} payload.reportType     one of the enum values above
 * @param {string} payload.reportKey      opaque scope string
 * @param {*}      payload.snapshotData   the statement's rendered data
 * @param {string} [payload.asOfDate]     ISO8601 date-only
 * @param {string} [payload.periodFrom]   ISO8601 date-only
 * @param {string} [payload.periodTo]     ISO8601 date-only
 * @param {string} [payload.notes]
 * @param {string} [payload.supersedesId] prior version id
 * @returns {Promise<Object>}             the created ReportVersion DTO
 */
export async function publishReportVersion(payload) {
  const r = await client.post('/api/report-versions', payload);
  return unwrap(r);
}

/**
 * GET /api/report-versions
 *
 * @param {Object} filters
 * @param {string} filters.reportType
 * @param {string} filters.reportKey
 * @param {boolean} [filters.currentOnly]  if true, only non-superseded rows
 * @param {number} [filters.limit]
 * @returns {Promise<Array>}               array of ReportVersion DTOs,
 *                                         newest first
 */
export async function listReportVersions(filters = {}) {
  const params = {};
  if (filters.reportType) params.reportType = filters.reportType;
  if (filters.reportKey) params.reportKey = filters.reportKey;
  if (filters.currentOnly != null) params.currentOnly = filters.currentOnly;
  if (filters.limit != null) params.limit = filters.limit;
  const r = await client.get('/api/report-versions', { params });
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

/**
 * GET /api/report-versions/:id
 *
 * @param {string} id
 * @returns {Promise<Object>}  ReportVersion DTO, or null if not found
 */
export async function getReportVersion(id) {
  const r = await client.get(`/api/report-versions/${encodeURIComponent(id)}`);
  return unwrap(r);
}
