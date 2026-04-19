/**
 * Board Pack API module (FN-258, Phase 4 Track A Tier 5 — 2026-04-19).
 *
 * Annual board-pack composite aggregator. Single read-only endpoint
 * returns all published report-version rows intersecting the
 * requested fiscal year plus YoY comparisons against the prior year
 * plus disclosure-note summaries. OWNER + AUDITOR only.
 *
 *   GET /api/board-pack?fiscalYear=YYYY       — generate pack
 *
 * BoardPack DTO:
 *   {
 *     fiscalYear: number
 *     priorFiscalYear: number
 *     generatedAt: string
 *     currentReportVersions: ReportVersionRef[]
 *     priorReportVersions: ReportVersionRef[]
 *     yoyComparisons: Array<{
 *       reportType: string
 *       reportKey: string
 *       metrics: Array<{
 *         metricName: string
 *         priorValue: string | null
 *         currentValue: string | null
 *         deltaAbsolute: string | null
 *         deltaPercent: string | null
 *       }>
 *       priorVersion: ReportVersionRef | null
 *       currentVersion: ReportVersionRef | null
 *     }>
 *     disclosureSummaries: Array<{
 *       runId: string
 *       fiscalYear: number
 *       language: string
 *       approvedAt: string | null
 *       materialNoteCount: number
 *     }>
 *     warnings: string[]
 *   }
 *
 * ReportVersionRef:
 *   {
 *     reportType: string
 *     reportKey: string
 *     version: number
 *     publishedAt: string
 *     publishedBy: string
 *     notes: string | null
 *     asOfDate: string | null
 *     periodFrom: string | null
 *     periodTo: string | null
 *   }
 *
 * Errors normalised by src/api/client.js. 403 means non-OWNER-and-
 * non-AUDITOR.
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
 * GET /api/board-pack?fiscalYear={YYYY}
 * @param {Object} query
 * @param {number} query.fiscalYear
 * @returns {Promise<Object>}
 */
export async function getBoardPack(query) {
  const r = await client.get('/api/board-pack', {
    params: { fiscalYear: query.fiscalYear },
  });
  return unwrap(r);
}
