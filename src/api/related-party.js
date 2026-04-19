/**
 * Related-Party API module (FN-254, Phase 4 Track A Tier 3 — 2026-04-19).
 *
 * Register of IAS-24 related-party relationships + period transaction
 * report aggregated over existing bills + invoices. Memo-only — no JE
 * posting. OWNER writes; OWNER/ACCOUNTANT/AUDITOR reads.
 *
 *   POST   /api/related-parties                  — create (OWNER)
 *   PATCH  /api/related-parties/:id              — update (OWNER)
 *   POST   /api/related-parties/:id/deactivate   — close effective
 *                                                  window (OWNER)
 *   GET    /api/related-parties                  — list + filters
 *   GET    /api/related-parties/report           — period aggregation
 *                                                  over bills + invoices
 *   GET    /api/related-parties/:id              — read one
 *
 * RelatedParty DTO:
 *   {
 *     id: string
 *     counterpartyType: 'VENDOR' | 'CUSTOMER'
 *     counterpartyVendorId?: string | null       // uuid if VENDOR
 *     counterpartyCustomerId?: string | null     // uuid if CUSTOMER
 *     natureOfRelationship: 'PARENT' | 'SUBSIDIARY' | 'ASSOCIATE' |
 *                           'JOINT_VENTURE' | 'KEY_MANAGEMENT_PERSONNEL' |
 *                           'CLOSE_FAMILY_MEMBER' | 'OTHER_RELATED_ENTITY' |
 *                           'OTHER'
 *     disclosureNote?: string | null
 *     activeFrom: string                         // ISO date
 *     activeUntil?: string | null
 *     notes?: string | null
 *     createdBy: string
 *     createdAt: string
 *     updatedAt: string
 *   }
 *
 * Report DTO:
 *   {
 *     periodFrom: string                         // ISO date
 *     periodTo: string
 *     rows: Array<{
 *       relatedPartyId: string
 *       counterpartyType: 'VENDOR' | 'CUSTOMER'
 *       counterpartyId: string
 *       natureOfRelationship: string
 *       disclosureNote: string | null
 *       purchasesKwd: string                     // decimal (Bill.total)
 *       purchasePaymentsKwd: string              // decimal (Bill.paid)
 *       salesKwd: string                         // decimal (Invoice.total)
 *       salesReceiptsKwd: string                 // decimal (Invoice.paid)
 *       transactionCount: number
 *       windowFrom: string                       // effective-window
 *                                                // clipped to period
 *       windowTo: string
 *     }>
 *     totals: {
 *       purchasesKwd: string
 *       purchasePaymentsKwd: string
 *       salesKwd: string
 *       salesReceiptsKwd: string
 *       transactionCount: number
 *     }
 *   }
 *
 * Errors normalised by src/api/client.js. 403 on create/update/
 * deactivate means non-OWNER.
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
 * GET /api/related-parties
 * @param {Object} [filters]
 * @param {string} [filters.counterpartyType]
 * @param {string} [filters.natureOfRelationship]
 * @param {boolean} [filters.activeOnly]
 * @param {string} [filters.asOf]
 */
export async function listRelatedParties(filters = {}) {
  const params = {};
  if (filters.counterpartyType) params.counterpartyType = filters.counterpartyType;
  if (filters.natureOfRelationship)
    params.natureOfRelationship = filters.natureOfRelationship;
  if (filters.activeOnly != null) params.activeOnly = filters.activeOnly;
  if (filters.asOf) params.asOf = filters.asOf;
  const r = await client.get('/api/related-parties', { params });
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

/** GET /api/related-parties/:id */
export async function getRelatedParty(id) {
  const r = await client.get(
    `/api/related-parties/${encodeURIComponent(id)}`,
  );
  return unwrap(r);
}

/** POST /api/related-parties */
export async function createRelatedParty(payload) {
  const r = await client.post('/api/related-parties', payload);
  return unwrap(r);
}

/** PATCH /api/related-parties/:id */
export async function updateRelatedParty(id, patch) {
  const r = await client.patch(
    `/api/related-parties/${encodeURIComponent(id)}`,
    patch,
  );
  return unwrap(r);
}

/** POST /api/related-parties/:id/deactivate */
export async function deactivateRelatedParty(id) {
  const r = await client.post(
    `/api/related-parties/${encodeURIComponent(id)}/deactivate`,
  );
  return unwrap(r);
}

/**
 * GET /api/related-parties/report
 * @param {Object} query
 * @param {string} query.periodFrom                ISO date (required)
 * @param {string} query.periodTo                  ISO date (required)
 */
export async function getRelatedPartyReport(query) {
  const r = await client.get('/api/related-parties/report', {
    params: { periodFrom: query.periodFrom, periodTo: query.periodTo },
  });
  return unwrap(r);
}

// ─── Helpers for the register UX: vendor + customer pickers ─────
// These are thin wrappers around the existing vendor/customer modules
// (both surface GET / read-only to any authenticated role). Kept here
// so the related-party modal doesn't need to import from two other
// API modules directly.

/** GET /api/vendors */
export async function listVendorsForRelatedParty() {
  const r = await client.get('/api/vendors');
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

/** GET /api/customers */
export async function listCustomersForRelatedParty() {
  const r = await client.get('/api/customers');
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}
