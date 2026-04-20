/**
 * Vendors API module — FN-272 Phase 4 KYC admin UI (2026-04-19).
 *
 * Wraps the 5 endpoints exposed by corporate-api Hasseb_Standalone_Api
 * @ 493030e (HASEEB-143 KYC write-surface):
 *
 *   GET    /api/vendors              — list + search + pagination (any auth)
 *   GET    /api/vendors/:id          — detail (any auth)
 *   POST   /api/vendors              — create (OWNER | ACCOUNTANT)
 *   PATCH  /api/vendors/:id          — partial update (OWNER | ACCOUNTANT)
 *   DELETE /api/vendors/:id          — soft-delete / deactivate (OWNER only)
 *
 * Vendor DTO (per Prisma + HASEEB-143 schema, post-Wave-6 migration):
 *   {
 *     id: string                                // uuid
 *     nameEn: string                            // 1..200
 *     nameAr?: string | null                    // <=200
 *     email?: string | null
 *     phone?: string | null                     // <=30
 *     businessAddress?: string | null           // <=500
 *     crNumber?: string | null                  // CR / commercial-registration <=50
 *     paymentTermsDays?: number                 // 0..365
 *     isActive: boolean                         // mirrored on backend
 *     // HASEEB-143 KYC fields:
 *     crExpiryDate?: string | null              // ISO YYYY-MM-DD; UTC-midnight on db
 *     crIssuedAt?: string | null                // ISO YYYY-MM-DD
 *     civilIdNumber?: string | null             // <=50
 *     kycNotes?: string | null                  // <=2000
 *     createdAt: string                         // ISO timestamp
 *     updatedAt: string
 *   }
 *
 * List response: backend returns either an array directly or a paginated
 * envelope `{ items, total, page, limit }`. unwrap() handles both shapes
 * via the same idiom used by related-party.js / budgets.js.
 *
 * KYC null semantics (matches HASEEB-143 backend):
 *   - undefined  → field is omitted from PATCH (server preserves prior value)
 *   - null       → field is explicitly cleared (server sets column to NULL)
 *   - ""         → callers should normalise empty strings to null before send
 *
 * Errors normalised by src/api/client.js. 403 on POST/PATCH means non-OWNER
 * + non-ACCOUNTANT; 403 on DELETE means non-OWNER.
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
 * GET /api/vendors
 * @param {Object} [filters]
 * @param {string} [filters.search]    — server-side search (nameEn / nameAr / email / crNumber)
 * @param {number} [filters.page]      — 1-indexed
 * @param {number} [filters.limit]     — 1..200
 */
export async function listVendors(filters = {}) {
  const params = {};
  if (filters.search) params.search = filters.search;
  if (filters.page != null) params.page = filters.page;
  if (filters.limit != null) params.limit = filters.limit;
  const r = await client.get('/api/vendors', { params });
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

/** GET /api/vendors/:id */
export async function getVendor(id) {
  const r = await client.get(`/api/vendors/${encodeURIComponent(id)}`);
  return unwrap(r);
}

/** POST /api/vendors — OWNER | ACCOUNTANT. Requires nameEn. */
export async function createVendor(payload) {
  const r = await client.post('/api/vendors', payload);
  return unwrap(r);
}

/** PATCH /api/vendors/:id — OWNER | ACCOUNTANT. Partial; null clears. */
export async function updateVendor(id, patch) {
  const r = await client.patch(
    `/api/vendors/${encodeURIComponent(id)}`,
    patch,
  );
  return unwrap(r);
}

/** DELETE /api/vendors/:id — OWNER only. Soft-delete (sets isActive=false). */
export async function deactivateVendor(id) {
  const r = await client.delete(`/api/vendors/${encodeURIComponent(id)}`);
  return unwrap(r);
}
