/**
 * Approval-policy API module — HASEEB-482 (DECISION-026 Phase 2 frontend,
 * 2026-04-24). Wraps the two settings endpoints introduced by HASEEB-481:
 *
 *   GET   /api/settings/approval-policy   — readable to every authenticated
 *                                            role (returns the active policy)
 *   PATCH /api/settings/approval-policy   — OWNER-only. Effective-dated
 *                                            supersede; the patched body
 *                                            accepts ANY subset of:
 *                                              autoApproveCeilingKwd
 *                                              reviewerApprovalCeilingKwd
 *                                              cfoApprovalCeilingKwd
 *                                              boardAckThresholdKwd
 *                                              reviewerQualificationRules
 *                                            (3-decimal-place KWD strings on
 *                                            the wire — the backend zod
 *                                            schema rejects 4+ dp).
 *
 * Wire shape (GET response, also echoed by PATCH):
 *
 *   {
 *     policyId: string,
 *     thresholds: {
 *       autoApproveCeilingKwd: string,
 *       reviewerApprovalCeilingKwd: string,
 *       cfoApprovalCeilingKwd: string,
 *       boardAckThresholdKwd: string,
 *     },
 *     reviewerQualificationRules: {
 *       minCategorizationConfidence: number,
 *       requireVerifiedMerchantBelowKwd: string,
 *     },
 *     effectiveFrom: string,        // ISO datetime
 *     effectiveTo:   string | null, // ISO datetime or null (currently active row)
 *     createdAt:     string,        // ISO datetime
 *     createdBy:     string | null, // userId or null (system default)
 *     lastUpdatedAt: string,        // ISO datetime
 *     lastUpdatedBy: string | null, // userId or null (system default)
 *   }
 *
 * Errors are normalised by client.js into
 *   { ok: false, status, code, message }
 * — callers catch and surface bilingual toasts. The backend already
 * returns bilingual zod messages for range / format / monotonicity
 * violations; the UI just reads `error.errorAr` when present.
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
 * GET /api/settings/approval-policy — return the active policy.
 * Every authenticated role can call this; the backend refuses
 * unauthenticated requests with 401.
 */
export async function getApprovalPolicy() {
  const r = await client.get('/api/settings/approval-policy');
  return unwrap(r);
}

/**
 * PATCH /api/settings/approval-policy — OWNER-only effective-dated
 * supersede. `patch` is a partial object: any monetary field omitted
 * is preserved from the active policy. Sends only the changed fields
 * so a no-op accidental save doesn't churn the audit-log row.
 *
 * Throws a normalised client.js error envelope on non-2xx; the caller
 * surfaces it as a bilingual toast (preferring `error.errorAr` when
 * the backend supplies the suffix). 403 is the Owner-only enforcement
 * path — surfaced as the "Only Owner can edit" message in the UI.
 */
export async function updateApprovalPolicy(patch) {
  const r = await client.patch('/api/settings/approval-policy', patch || {});
  return unwrap(r);
}
