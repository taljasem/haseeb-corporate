/**
 * Inventory NRV API module (FN-264, Phase 4 Track A Tier 4 — 2026-04-19).
 *
 * IAS 2 slow-moving / obsolete inventory write-down policy + assessment.
 * Memo-only; write-down runner + reversal workflow ship in follow-up.
 *
 *   POST   /api/inventory-nrv/policy                    — create policy
 *   POST   /api/inventory-nrv/policy/:id/deactivate     — deactivate
 *   GET    /api/inventory-nrv/policy/active             — current policy
 *   GET    /api/inventory-nrv/policy                    — list policies
 *   GET    /api/inventory-nrv/assessment                — compute assessment
 *
 * Band shape:
 *   {
 *     minAgeDays: int 0..10000       // exclusive lower bound
 *     maxAgeDays: int 0..10000 | null // inclusive upper bound; null = catch-all
 *     writedownPercent: int 0..10000  // basis-points ×100; 500 = 5.00%
 *     label: string
 *   }
 *
 * Errors normalised by src/api/client.js.
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

export async function createNrvPolicy(payload) {
  const r = await client.post('/api/inventory-nrv/policy', payload);
  return unwrap(r);
}

export async function deactivateNrvPolicy(id) {
  const r = await client.post(
    `/api/inventory-nrv/policy/${encodeURIComponent(id)}/deactivate`,
  );
  return unwrap(r);
}

export async function getActiveNrvPolicy(asOf = null) {
  const params = {};
  if (asOf) params.asOf = asOf;
  const r = await client.get('/api/inventory-nrv/policy/active', { params });
  return unwrap(r);
}

export async function listNrvPolicies() {
  const r = await client.get('/api/inventory-nrv/policy');
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export async function getNrvAssessment(asOf = null) {
  const params = {};
  if (asOf) params.asOf = asOf;
  const r = await client.get('/api/inventory-nrv/assessment', { params });
  return unwrap(r);
}
