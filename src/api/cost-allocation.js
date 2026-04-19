/**
 * Cost Allocation API module (FN-243, Phase 4 Track A Tier 3 — 2026-04-19).
 *
 * Shared-overhead allocation rules. Each rule names a source account
 * (the shared-cost account whose balance is being allocated out) plus
 * an ordered list of (costCenterLabel, weight) targets. Cost centers
 * are soft string labels — the rule's `targets` JSON holds the full
 * list normalized to 100% at compute time.
 *
 *   POST   /api/cost-allocation/rules              — create (OWNER)
 *   POST   /api/cost-allocation/rules/:id/deactivate — deactivate (OWNER)
 *   GET    /api/cost-allocation/rules              — list + filters
 *   GET    /api/cost-allocation/rules/:id          — read one
 *   POST   /api/cost-allocation/rules/:id/compute  — compute allocation
 *                                                    over a period
 *                                                    (OWNER/ACCT/AUDITOR)
 *
 * Rules are immutable after create (no PATCH) — to change a rule,
 * deactivate and create a new one. Memo-only — no JE posting in this
 * partial.
 *
 * Rule DTO:
 *   {
 *     id: string
 *     name: string                          // unique per tenant
 *     description?: string | null
 *     sourceAccountId: string               // uuid
 *     driverType: 'HEADCOUNT'|'REVENUE_PERCENT'|'FLOOR_SPACE'|
 *                 'EQUAL_SPLIT'|'CUSTOM'
 *     targets: Array<{
 *       costCenterLabel: string             // soft string label
 *       weight: string                      // positive decimal
 *     }>
 *     activeFrom: string                    // ISO date
 *     activeUntil?: string | null
 *     notes?: string | null
 *     createdBy: string
 *     createdAt: string
 *     updatedAt: string
 *   }
 *
 * Compute result DTO:
 *   {
 *     ruleId: string
 *     ruleName: string
 *     periodFrom: string                    // ISO date
 *     periodTo: string                      // ISO date
 *     sourceAccountId: string
 *     sourcePeriodBalanceKwd: string        // decimal
 *     totalWeight: string                   // decimal
 *     rows: Array<{
 *       costCenterLabel: string
 *       weight: string                      // decimal
 *       weightPercent: string               // decimal (0..100)
 *       amountKwd: string                   // decimal
 *     }>
 *     roundingResidualKwd: string           // ≤ 0.001 KWD typically
 *     note: string
 *   }
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

export async function listCostAllocationRules(filters = {}) {
  const params = {};
  if (filters.activeOnly != null) params.activeOnly = filters.activeOnly;
  if (filters.asOf) params.asOf = filters.asOf;
  if (filters.sourceAccountId) params.sourceAccountId = filters.sourceAccountId;
  const r = await client.get('/api/cost-allocation/rules', { params });
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export async function getCostAllocationRule(id) {
  const r = await client.get(
    `/api/cost-allocation/rules/${encodeURIComponent(id)}`,
  );
  return unwrap(r);
}

export async function createCostAllocationRule(payload) {
  const r = await client.post('/api/cost-allocation/rules', payload);
  return unwrap(r);
}

export async function deactivateCostAllocationRule(id) {
  const r = await client.post(
    `/api/cost-allocation/rules/${encodeURIComponent(id)}/deactivate`,
  );
  return unwrap(r);
}

export async function computeCostAllocation(id, body) {
  const r = await client.post(
    `/api/cost-allocation/rules/${encodeURIComponent(id)}/compute`,
    body,
  );
  return unwrap(r);
}
