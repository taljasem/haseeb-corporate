/**
 * PIFSS Annual Reconciliation API module — AUDIT-ACC-058 (2026-04-22).
 *
 * Wraps the 5 endpoints exposed by corporate-api's
 * pifss-reconciliation module (FN-251). Distinct from the PayrollScreen
 * monthly PIFSS Submissions surface (outbound SIF generation) — this
 * module drives the ANNUAL reconciliation workflow: import the PIFSS
 * authority's year-end statement → run reconciliation compare against
 * the tenant's payroll history → resolve per-employee variances →
 * surface an auditor-formatted report.
 *
 * Endpoints:
 *   POST   /api/pifss-reconciliation/statements/:fiscalYear/import
 *   POST   /api/pifss-reconciliation/:fiscalYear/run
 *   GET    /api/pifss-reconciliation/:fiscalYear
 *   GET    /api/pifss-reconciliation/:fiscalYear/report
 *   PATCH  /api/pifss-reconciliation/variances/:id
 *
 * Role gates (backend-enforced, mirrored in the screen for progressive
 * disclosure):
 *   - OWNER / ACCOUNTANT: import + run + resolve.
 *   - Any authenticated role: GET reads.
 *   - Service-layer reopen gate: only OWNER may transition a
 *     RESOLVED/IN_DISPUTE variance back to UNRESOLVED; `reopenReason`
 *     is required.
 *
 * VarianceType (4): COMPANY_ONLY | PORTAL_ONLY |
 *   CONTRIBUTION_AMOUNT_DIFFERS | SALARY_BASE_DIFFERS
 * VarianceStatus (4): UNRESOLVED | UNDER_INVESTIGATION | RESOLVED |
 *   IN_DISPUTE
 *
 * Monetary fields are KWD Decimal(18,3) serialized as strings at the
 * JSON boundary. Callers must NOT parseFloat for any math — use
 * decimal.js for rollups.
 *
 * Response envelope: controller returns `successResponse(narrowed)`
 * which this module unwraps into the narrowed object / list directly.
 *
 * Errors flow through client.js into `{ ok:false, status, code, message }`.
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

// ── Statement + run + read endpoints ────────────────────────────────

/**
 * Import the PIFSS authority's annual statement for a fiscal year.
 * OWNER / ACCOUNTANT only (backend-enforced).
 *
 * Caller supplies EXACTLY ONE of `entries` (pre-parsed array) or
 * `rawBody` (+ required `parserVersion`). Schema mutually excludes them
 * server-side.
 *
 * @param {number} fiscalYear
 * @param {{
 *   entries?: Array<{
 *     civilId: string,
 *     employeeNameSnapshot?: string,
 *     periodYear: number,
 *     periodMonth: number,
 *     employerContribKwd: string|number,
 *     employeeContribKwd: string|number,
 *     basicSalarySnapshot: string|number,
 *   }>,
 *   rawBody?: string,
 *   parserVersion?: string,
 *   portalReference?: string,
 *   fileUrl?: string,
 * }} body
 * @returns {Promise<{ statementId: string, importedAt: string }>}
 */
export async function importStatement(fiscalYear, body) {
  if (fiscalYear == null) {
    throw new Error('importStatement: fiscalYear is required');
  }
  const fy = Number(fiscalYear);
  if (!Number.isInteger(fy) || fy < 2000 || fy > 2100) {
    throw new Error('importStatement: fiscalYear must be an integer in [2000, 2100]');
  }
  const hasEntries = Array.isArray(body?.entries);
  const hasRawBody = typeof body?.rawBody === 'string' && body.rawBody.length > 0;
  if (hasEntries === hasRawBody) {
    throw new Error(
      'importStatement: supply exactly one of `entries` or `rawBody`',
    );
  }
  if (hasRawBody && !body?.parserVersion) {
    throw new Error(
      'importStatement: parserVersion is required when rawBody is provided',
    );
  }
  const payload = {};
  if (hasEntries) payload.entries = body.entries;
  if (hasRawBody) {
    payload.rawBody = body.rawBody;
    payload.parserVersion = body.parserVersion;
  }
  if (body?.portalReference) payload.portalReference = body.portalReference;
  if (body?.fileUrl) payload.fileUrl = body.fileUrl;
  const r = await client.post(
    `/api/pifss-reconciliation/statements/${encodeURIComponent(String(fy))}/import`,
    payload,
  );
  return unwrap(r);
}

/**
 * Run the reconciliation compare for a fiscal year. OWNER / ACCOUNTANT.
 * Returns `ReconciliationSummary` with `totalVariances`,
 * `unresolvedCount`, `byType` (per-VarianceType counts),
 * `preservedResolutionCount` (carried from prior run), `newVarianceCount`.
 *
 * @param {number} fiscalYear
 * @returns {Promise<{
 *   reconciliationId: string,
 *   fiscalYear: number,
 *   statementId: string,
 *   totalVariances: number,
 *   unresolvedCount: number,
 *   byType: Record<string, number>,
 *   preservedResolutionCount: number,
 *   newVarianceCount: number,
 * }>}
 */
export async function runReconciliation(fiscalYear) {
  if (fiscalYear == null) {
    throw new Error('runReconciliation: fiscalYear is required');
  }
  const fy = Number(fiscalYear);
  const r = await client.post(
    `/api/pifss-reconciliation/${encodeURIComponent(String(fy))}/run`,
  );
  return unwrap(r);
}

/**
 * Get current reconciliation state + full variance list for a fiscal
 * year. Any authenticated role.
 *
 * @param {number} fiscalYear
 * @returns {Promise<{ reconciliation: object | null, variances: Array }>}
 */
export async function getReconciliation(fiscalYear) {
  if (fiscalYear == null) {
    throw new Error('getReconciliation: fiscalYear is required');
  }
  const fy = Number(fiscalYear);
  const r = await client.get(
    `/api/pifss-reconciliation/${encodeURIComponent(String(fy))}`,
  );
  return unwrap(r);
}

/**
 * Get the auditor-formatted report for a fiscal year. Variances grouped
 * by employee, sorted by Σ|delta| desc. Any authenticated role.
 *
 * @param {number} fiscalYear
 * @returns {Promise<{
 *   reconciliationId: string,
 *   fiscalYear: number,
 *   statementId: string,
 *   runBy: string,
 *   runAt: string,
 *   totalVariances: number,
 *   unresolvedCount: number,
 *   byType: Record<string, number>,
 *   totalDeltaEmployerKwd: string,
 *   totalDeltaEmployeeKwd: string,
 *   employees: Array,
 * }>}
 */
export async function getReconciliationReport(fiscalYear) {
  if (fiscalYear == null) {
    throw new Error('getReconciliationReport: fiscalYear is required');
  }
  const fy = Number(fiscalYear);
  const r = await client.get(
    `/api/pifss-reconciliation/${encodeURIComponent(String(fy))}/report`,
  );
  return unwrap(r);
}

/**
 * Patch a single variance's resolution status. OWNER / ACCOUNTANT.
 * Service-layer additionally enforces OWNER-only on RESOLVED/IN_DISPUTE
 * → UNRESOLVED (reopen); `reopenReason` required on reopen.
 *
 * @param {string} varianceId
 * @param {{
 *   status: 'UNRESOLVED'|'UNDER_INVESTIGATION'|'RESOLVED'|'IN_DISPUTE',
 *   resolutionNote?: string,
 *   reopenReason?: string,
 * }} body
 * @returns {Promise<{ variance: object }>}
 */
export async function resolveVariance(varianceId, body) {
  if (!varianceId) {
    throw new Error('resolveVariance: varianceId is required');
  }
  if (!body?.status) {
    throw new Error('resolveVariance: status is required');
  }
  const payload = { status: body.status };
  if (body.resolutionNote) payload.resolutionNote = body.resolutionNote;
  if (body.reopenReason) payload.reopenReason = body.reopenReason;
  const r = await client.patch(
    `/api/pifss-reconciliation/variances/${encodeURIComponent(varianceId)}`,
    payload,
  );
  return unwrap(r);
}

/**
 * List known reconciliation fiscal years. No backend list-years
 * endpoint exists today (HASEEB-215 follow-up). For now, probes a
 * bounded window of recent fiscal years (currentYear, -1, -2) and
 * collects the ones that have a persisted reconciliation. Returns an
 * array of `{ fiscalYear, reconciliation }` tuples where
 * `reconciliation` is `null` when no run exists yet for that year.
 *
 * Screen uses this to seed the Year List tab. Empty-state branch fires
 * when all probes return null (i.e. no imports + no runs at all).
 *
 * @returns {Promise<{ years: Array<{ fiscalYear: number, reconciliation: object|null, variances: Array }> }>}
 */
export async function listReconciliationYears() {
  const nowYear = new Date().getUTCFullYear();
  const candidates = [nowYear, nowYear - 1, nowYear - 2];
  const results = await Promise.all(
    candidates.map(async (fy) => {
      try {
        const data = await getReconciliation(fy);
        return { fiscalYear: fy, ...data };
      } catch (err) {
        // 404 / no reconciliation for year → treat as empty slot so the
        // screen can still offer "New fiscal year" for any of the 3
        // probed years.
        return {
          fiscalYear: fy,
          reconciliation: null,
          variances: [],
          _probeError: err?.message || null,
        };
      }
    }),
  );
  return { years: results };
}
