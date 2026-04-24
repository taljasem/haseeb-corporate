/**
 * ECL (IFRS 9 Expected Credit Loss) API module.
 *
 * HASEEB-409 (frontend) — companion to backend HASEEB-408 (FN-265 audit-
 * fatal fix). Three wrappers over /api/ecl/*:
 *
 *   GET   /api/ecl/matrix           — list active provision matrix rows
 *                                     (6 CustomerClass × 7 EclAgingBucket
 *                                     = 42 rows; one active row per pair).
 *                                     Role gate: OWNER or ACCOUNTANT.
 *   PATCH /api/ecl/matrix/:id       — supersede an active row by inserting
 *                                     a new one with adjustedLossRate
 *                                     updated. Null clears the adjustment
 *                                     (fall back to historicalLossRate at
 *                                     compute time).
 *                                     Role gate: OWNER only.
 *   POST  /api/ecl/compute          — dry-run (no fiscalYear/Quarter) or
 *                                     persisted (FY + Q supplied → creates
 *                                     EclQuarterlyComputation audit row +
 *                                     DRAFT JE when adjustment != 0).
 *                                     Role gate: OWNER or ACCOUNTANT.
 *
 * DTO (matrix row):
 *   {
 *     id: string,                 // uuid
 *     customerClass: 'GOVERNMENT'|'PRIVATE_CORPORATE'|'PRIVATE_SME'|
 *                    'AFFILIATE'|'RELATED_PARTY'|'INDIVIDUAL',
 *     agingBucket: 'CURRENT'|'D1_30'|'D31_60'|'D61_90'|'D91_180'|
 *                  'D181_365'|'OVER_365',
 *     historicalLossRate: string, // decimal in [0,1] as string
 *     adjustedLossRate: string | null,
 *     effectiveFrom: string,      // ISO8601
 *   }
 *
 * Compute response envelope:
 *   {
 *     computation: {
 *       asOf: string,             // ISO8601
 *       buckets: EclBucketResult[],
 *       totalExposureKwd: string,
 *       totalComputedEclKwd: string,
 *       currentAllowanceKwd: string,
 *       adjustmentKwd: string,    // signed: +ve = increase provision
 *       direction: 'INCREASE'|'DECREASE'|'NONE',
 *     },
 *     persistedRowId?: string,    // only for persisted path
 *     jeId?: string | null,       // only for persisted path
 *   }
 *
 * EclBucketResult:
 *   {
 *     customerClass: CustomerClass,
 *     agingBucket: EclAgingBucket,
 *     exposureKwd: string,
 *     lossRate: string,
 *     rateSource: 'ADJUSTED'|'HISTORICAL',
 *     eclKwd: string,
 *   }
 *
 * Errors are normalised by src/api/client.js. 403 on any write means the
 * caller lacks the gated role. 400 on PATCH with an out-of-range rate is
 * surfaced as a precondition error.
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
 * GET /api/ecl/matrix — list active matrix rows (42 rows on a fully
 * seeded tenant). Fail-soft: returns [] on error so the UI can render
 * the empty state rather than crash.
 *
 * @returns {Promise<Array>} EclMatrixRow[]
 */
export async function getEclMatrix() {
  try {
    const r = await client.get('/api/ecl/matrix');
    const data = unwrap(r);
    return Array.isArray(data) ? data : [];
  } catch (_err) {
    return [];
  }
}

/**
 * PATCH /api/ecl/matrix/:id — supersede the existing row and insert a
 * new one with `adjustedLossRate`. The caller MUST pass a decimal
 * string (not a number) so Decimal.js can parse without float rounding;
 * the backend zod schema rejects anything outside [0, 1] with up to 6
 * decimal places.
 *
 * Passing `null` clears the adjustment (falls back to historicalLossRate
 * at compute time).
 *
 * @param {string} id
 * @param {{ adjustedLossRate: string | null }} body
 * @returns {Promise<Object>} updated matrix row DTO
 */
export async function updateEclMatrixRow(id, { adjustedLossRate }) {
  if (!id) {
    throw new Error('updateEclMatrixRow: matrix row id is required');
  }
  // Precondition: empty string or undefined not allowed — the caller must
  // explicitly pass `null` to clear. This prevents a confused UI state
  // from silently submitting an empty-string rate that the backend would
  // then reject with a generic zod message.
  if (adjustedLossRate === undefined || adjustedLossRate === '') {
    throw new Error(
      'updateEclMatrixRow: adjustedLossRate must be a decimal string in [0, 1] or null to clear.',
    );
  }
  const r = await client.patch(`/api/ecl/matrix/${id}`, { adjustedLossRate });
  return unwrap(r);
}

/**
 * POST /api/ecl/compute — run the compute engine and return the per-
 * bucket breakdown + totals + adjustment. When `fiscalYear` and
 * `fiscalQuarter` are BOTH supplied, the backend persists an
 * EclQuarterlyComputation audit row and drafts the adjustment JE (when
 * non-zero); otherwise it runs as a dry-run (no persistence).
 *
 * Signature mirrors the task spec: the second parameter is optional.
 * When calling for a dry-run preview, pass `{}` or omit entirely.
 *
 * @param {{ asOf?: string, fiscalYear?: number, fiscalQuarter?: number }} [input]
 * @returns {Promise<Object>} { computation, persistedRowId?, jeId? }
 */
export async function computeEcl(input = {}) {
  const body = {};
  if (input?.asOf) body.asOf = input.asOf;
  if (input?.fiscalYear != null) body.fiscalYear = Number(input.fiscalYear);
  if (input?.fiscalQuarter != null) body.fiscalQuarter = Number(input.fiscalQuarter);
  const r = await client.post('/api/ecl/compute', body);
  return unwrap(r);
}
