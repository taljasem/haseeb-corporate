/**
 * Data Inalterability API module (FN-226, Phase 4 Wave 1 Item 2).
 *
 * Wraps the composite inalterability proof endpoint on the Corporate API:
 *
 *   GET /api/data-inalterability
 *     Roles: OWNER + AUDITOR (backend-gated 403 for anyone else).
 *
 * The endpoint composes three already-shipped proofs into a single
 * INALTERABLE / BROKEN assertion:
 *
 *   1. Audit chain dual-hash verify (FN-162b DUALCHAIN)
 *   2. Report-version inventory       (FN-244)
 *   3. Migration-audit schema-chain   (FN-245)
 *
 * Response DTO shape (JSDoc; the dashboard speaks JSON):
 *
 *   {
 *     generatedAt: string,                        // ISO8601
 *     overall:     'INALTERABLE' | 'BROKEN',
 *     rationale:   string,                        // one-line human summary
 *     auditChain: {
 *       fullValid:          boolean,
 *       financialValid:     boolean,
 *       entriesCount:       number,
 *       brokenAtSequence:   number | null,
 *       lastFullHash:       string | null,
 *       lastFinancialHash:  string | null,
 *     },
 *     reportVersions: {
 *       totalCount:         number,
 *       currentCount:       number,
 *       lastPublishedAt:    string | null,
 *       byType:             Record<string, number>,
 *     },
 *     migrationChain: {
 *       linkCount:             number,
 *       gapCount:              number,
 *       firstGapMigrationName: string | null,
 *       lastMigrationName:     string | null,
 *       lastAppliedAt:         string | null,
 *       lastSchemaHashAfter:   string | null,
 *     },
 *   }
 *
 * All responses come in the standard wrapped envelope `{ success, data }`.
 * Errors are normalised by `src/api/client.js` into:
 *   { ok: false, status, code, message }
 * A 403 means the caller is neither OWNER nor AUDITOR; the UI shows a
 * role-denied panel rather than blowing up.
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
 * GET /api/data-inalterability
 *
 * @returns {Promise<Object>} composite inalterability report DTO
 */
export async function getDataInalterabilityReport() {
  const r = await client.get('/api/data-inalterability');
  return unwrap(r);
}
