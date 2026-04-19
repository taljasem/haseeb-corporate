/**
 * Inventory Count API module (FN-263, Phase 4 Track A Tier 4 — 2026-04-19).
 *
 * Physical count session lifecycle: DRAFT → COUNTING → RECONCILED →
 * POSTED (POSTED deferred pending backend JE splice). CANCELLED is
 * terminal from DRAFT or COUNTING. Memo-only until the backend splice
 * ships; varianceJEShape returns the JE legs that WOULD post.
 *
 *   POST   /api/inventory-counts                  — create DRAFT
 *   POST   /api/inventory-counts/:id/snapshot     — DRAFT → COUNTING
 *                                                    (captures items)
 *   POST   /api/inventory-counts/lines/:id/count  — record line count
 *   POST   /api/inventory-counts/:id/reconcile    — COUNTING → RECONCILED
 *                                                    (computes variance)
 *   POST   /api/inventory-counts/:id/cancel       — DRAFT|COUNTING → CANCELLED
 *   GET    /api/inventory-counts/:id/variance-je-shape — RECONCILED+ only
 *   GET    /api/inventory-counts                  — list + filters
 *   GET    /api/inventory-counts/:id              — read one
 *
 * Count DTO:
 *   {
 *     id: string
 *     countDate: string                     // ISO date
 *     locationLabel?: string | null
 *     status: 'DRAFT' | 'COUNTING' | 'RECONCILED' | 'POSTED' | 'CANCELLED'
 *     notes?: string | null
 *     snapshottedAt?: string | null
 *     reconciledAt?: string | null
 *     reconciledBy?: string | null
 *     createdBy: string
 *     createdAt: string
 *     updatedAt: string
 *     lines?: CountLine[]                   // populated on detail read
 *   }
 *
 * CountLine DTO:
 *   {
 *     id: string
 *     countId: string
 *     itemId: string
 *     itemName?: string                     // hydrated by server
 *     itemCode?: string                     // hydrated by server
 *     systemQuantity: string                // decimal (2 dp)
 *     snapshotUnitCost: string              // decimal (3 dp)
 *     countedQuantity?: string | null       // null until recorded
 *     varianceQuantity?: string | null
 *     varianceValueKwd?: string | null
 *     notes?: string | null
 *   }
 *
 * VarianceJEShape DTO:
 *   {
 *     countId: string
 *     totalAbsoluteVarianceKwd: string
 *     netVarianceKwd: string
 *     legs: Array<{
 *       accountRole: string
 *       side: 'DEBIT' | 'CREDIT'
 *       amountKwd: string
 *       description: string
 *     }>
 *     note: string
 *   }
 *
 * Errors normalised by src/api/client.js. 403 on cancel means
 * non-OWNER.
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

export async function listInventoryCounts(filters = {}) {
  const params = {};
  if (filters.status) params.status = filters.status;
  if (filters.countDateFrom) params.countDateFrom = filters.countDateFrom;
  if (filters.countDateTo) params.countDateTo = filters.countDateTo;
  const r = await client.get('/api/inventory-counts', { params });
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export async function getInventoryCount(id) {
  const r = await client.get(
    `/api/inventory-counts/${encodeURIComponent(id)}`,
  );
  return unwrap(r);
}

export async function createInventoryCount(payload) {
  const r = await client.post('/api/inventory-counts', payload);
  return unwrap(r);
}

export async function snapshotInventoryCount(id) {
  const r = await client.post(
    `/api/inventory-counts/${encodeURIComponent(id)}/snapshot`,
  );
  return unwrap(r);
}

export async function recordInventoryCountLine(lineId, payload) {
  const r = await client.post(
    `/api/inventory-counts/lines/${encodeURIComponent(lineId)}/count`,
    payload,
  );
  return unwrap(r);
}

export async function reconcileInventoryCount(id) {
  const r = await client.post(
    `/api/inventory-counts/${encodeURIComponent(id)}/reconcile`,
  );
  return unwrap(r);
}

export async function cancelInventoryCount(id) {
  const r = await client.post(
    `/api/inventory-counts/${encodeURIComponent(id)}/cancel`,
  );
  return unwrap(r);
}

export async function getInventoryCountVarianceJeShape(id) {
  const r = await client.get(
    `/api/inventory-counts/${encodeURIComponent(id)}/variance-je-shape`,
  );
  return unwrap(r);
}
