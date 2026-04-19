/**
 * Purchase Orders + Goods Receipts + Three-way Match API module
 * (FN-217 + FN-218, Phase 4 Track A Tier 4 — 2026-04-19).
 *
 *   POST   /api/purchase-orders                      — create PO
 *   PATCH  /api/purchase-orders/:id/status           — transition PO
 *   GET    /api/purchase-orders                      — list POs
 *   GET    /api/purchase-orders/:id                  — read one PO
 *
 *   POST   /api/goods-receipts                       — create GR
 *
 *   POST   /api/three-way-match                      — run match
 *   POST   /api/three-way-match/predict              — predictive bill
 *
 * PO status lifecycle: DRAFT → OPEN → PARTIALLY_RECEIVED → CLOSED.
 * CANCELLED terminal from any pre-CLOSED state.
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

export async function listPurchaseOrders(filters = {}) {
  const params = {};
  if (filters.vendorId) params.vendorId = filters.vendorId;
  if (filters.status) params.status = filters.status;
  const r = await client.get('/api/purchase-orders', { params });
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export async function getPurchaseOrder(id) {
  const r = await client.get(`/api/purchase-orders/${encodeURIComponent(id)}`);
  return unwrap(r);
}

export async function createPurchaseOrder(payload) {
  const r = await client.post('/api/purchase-orders', payload);
  return unwrap(r);
}

export async function transitionPurchaseOrderStatus(id, status) {
  const r = await client.patch(
    `/api/purchase-orders/${encodeURIComponent(id)}/status`,
    { status },
  );
  return unwrap(r);
}

export async function createGoodsReceipt(payload) {
  const r = await client.post('/api/goods-receipts', payload);
  return unwrap(r);
}

export async function runThreeWayMatch(payload) {
  const r = await client.post('/api/three-way-match', payload);
  return unwrap(r);
}

export async function predictiveBillMatch(payload) {
  const r = await client.post('/api/three-way-match/predict', payload);
  return unwrap(r);
}
