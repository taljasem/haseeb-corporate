/**
 * Customers API module — FN-272 Phase 4 KYC admin UI (2026-04-19).
 *
 * Wraps the 5 endpoints exposed by corporate-api Hasseb_Standalone_Api
 * @ 493030e (HASEEB-143 KYC write-surface):
 *
 *   GET    /api/customers              — list + search + pagination (any auth)
 *   GET    /api/customers/:id          — detail (any auth)
 *   POST   /api/customers              — create (OWNER | ACCOUNTANT)
 *   PATCH  /api/customers/:id          — partial update (OWNER | ACCOUNTANT)
 *   DELETE /api/customers/:id          — soft-delete / deactivate (OWNER only)
 *
 * Customer DTO (per Prisma + HASEEB-143 schema):
 *   {
 *     id: string                                // uuid
 *     nameEn: string                            // 1..200
 *     nameAr?: string | null                    // <=200
 *     email?: string | null
 *     phone?: string | null                     // <=30
 *     businessAddress?: string | null           // <=500
 *     deliveryAddress?: string | null           // <=500
 *     // HASEEB-143 KYC fields (crNumber existed on the Prisma model
 *     // since Wave 4 but had no HTTP entry point until 493030e):
 *     crNumber?: string | null                  // CR <=50
 *     crExpiryDate?: string | null              // ISO YYYY-MM-DD; UTC-midnight on db
 *     crIssuedAt?: string | null                // ISO YYYY-MM-DD
 *     civilIdNumber?: string | null             // <=50
 *     kycNotes?: string | null                  // <=2000
 *     isActive: boolean
 *     createdAt: string
 *     updatedAt: string
 *   }
 *
 * Same null/undefined PATCH semantics as vendors.js.
 *
 * Errors normalised by src/api/client.js. 403 on POST/PATCH means
 * non-OWNER + non-ACCOUNTANT; 403 on DELETE means non-OWNER.
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
 * GET /api/customers
 * @param {Object} [filters]
 * @param {string} [filters.search]
 * @param {number} [filters.page]
 * @param {number} [filters.limit]
 */
export async function listCustomers(filters = {}) {
  const params = {};
  if (filters.search) params.search = filters.search;
  if (filters.page != null) params.page = filters.page;
  if (filters.limit != null) params.limit = filters.limit;
  const r = await client.get('/api/customers', { params });
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

/** GET /api/customers/:id */
export async function getCustomer(id) {
  const r = await client.get(`/api/customers/${encodeURIComponent(id)}`);
  return unwrap(r);
}

/** POST /api/customers — OWNER | ACCOUNTANT. Requires nameEn. */
export async function createCustomer(payload) {
  const r = await client.post('/api/customers', payload);
  return unwrap(r);
}

/** PATCH /api/customers/:id — OWNER | ACCOUNTANT. Partial; null clears. */
export async function updateCustomer(id, patch) {
  const r = await client.patch(
    `/api/customers/${encodeURIComponent(id)}`,
    patch,
  );
  return unwrap(r);
}

/** DELETE /api/customers/:id — OWNER only. Soft-delete (sets isActive=false). */
export async function deactivateCustomer(id) {
  const r = await client.delete(`/api/customers/${encodeURIComponent(id)}`);
  return unwrap(r);
}
