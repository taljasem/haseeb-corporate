/**
 * Warranty Provision Policy API module (FN-256, Phase 4 Track A Tier 5
 * — 2026-04-19).
 *
 * Per-tenant effective-dated warranty provision policy. Two basis
 * modes: REVENUE_PERCENT (basis-point rate applied to period revenue)
 * and PER_UNIT (fixed KWD amount per unit sold). The policy is
 * consulted by a future period-end accrual runner which posts via
 * journalEntryService.create with jeScope='warranty_accrual'; this
 * module exposes the CRUD surface only.
 *
 *   POST   /api/warranty-provision-policy              — create (OWNER)
 *   PATCH  /api/warranty-provision-policy/:id          — update (OWNER;
 *                                                        notes +
 *                                                        activeUntil +
 *                                                        role codes only —
 *                                                        basis/rate/amount
 *                                                        frozen post-create)
 *   POST   /api/warranty-provision-policy/:id/deactivate — OWNER
 *   GET    /api/warranty-provision-policy              — list + filters
 *   GET    /api/warranty-provision-policy/active       — active row
 *                                                        (current date)
 *   GET    /api/warranty-provision-policy/:id          — read one
 *
 * Policy DTO:
 *   {
 *     id: string
 *     basis: 'REVENUE_PERCENT' | 'PER_UNIT'
 *     ratePercent?: number | null           // bps 0..10000
 *     perUnitAmountKwd?: string | null      // decimal
 *     plRoleCode?: string                   // AccountRole for the P&L
 *                                           // side of the accrual JE
 *     liabilityRoleCode?: string            // AccountRole for the
 *                                           // warranty-provision liability
 *     notes?: string | null
 *     activeFrom: string
 *     activeUntil?: string | null
 *     createdBy: string
 *     createdAt: string
 *     updatedAt: string
 *   }
 *
 * Rate units: rates on the wire are basis points 0..10000 where 10000
 * = 100.00%. UI converts percent ↔ bps at the boundary.
 *
 * Errors normalised by src/api/client.js. 403 on mutations means
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

export async function listWarrantyPolicies(filters = {}) {
  const params = {};
  if (filters.activeOnly != null) params.activeOnly = filters.activeOnly;
  if (filters.asOf) params.asOf = filters.asOf;
  const r = await client.get('/api/warranty-provision-policy', { params });
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export async function getActiveWarrantyPolicy() {
  const r = await client.get('/api/warranty-provision-policy/active');
  return unwrap(r);
}

export async function getWarrantyPolicy(id) {
  const r = await client.get(
    `/api/warranty-provision-policy/${encodeURIComponent(id)}`,
  );
  return unwrap(r);
}

export async function createWarrantyPolicy(payload) {
  const r = await client.post('/api/warranty-provision-policy', payload);
  return unwrap(r);
}

/**
 * Server only accepts {notes, activeUntil, plRoleCode, liabilityRoleCode}
 * on PATCH. basis / ratePercent / perUnitAmountKwd are frozen after
 * create.
 */
export async function updateWarrantyPolicy(id, patch) {
  const r = await client.patch(
    `/api/warranty-provision-policy/${encodeURIComponent(id)}`,
    patch,
  );
  return unwrap(r);
}

export async function deactivateWarrantyPolicy(id) {
  const r = await client.post(
    `/api/warranty-provision-policy/${encodeURIComponent(id)}/deactivate`,
  );
  return unwrap(r);
}
