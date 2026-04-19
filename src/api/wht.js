/**
 * WHT (Withholding Tax) API module (FN-250, Phase 4 Track A Wave 2 —
 * 2026-04-19).
 *
 * Wraps two distinct resources:
 *
 *   /api/wht-config        — policy CRUD. Effective-dated per-category
 *                            basis-point rates + minimum-threshold KWD.
 *                            OWNER on writes; OWNER/ACCOUNTANT/AUDITOR
 *                            on reads.
 *   /api/wht-certificates  — read-only certificate register. Creation
 *                            is service-layer only — the future AP-flow
 *                            splice calls service.recordCertificate
 *                            inside the bill-payment $transaction. This
 *                            module does NOT expose a createCertificate
 *                            wrapper.
 *
 * Rate units are integer basis points 0..10000 (10000 = 100.00%). The
 * dashboard speaks percent to users and converts at the boundary.
 *
 * WhtConfig DTO:
 *   {
 *     id: string
 *     rateServicePercent?: number | null        // bps
 *     rateProfessionalPercent?: number | null   // bps
 *     rateRentalPercent?: number | null         // bps
 *     rateInterestPercent?: number | null       // bps
 *     rateCustomPercent?: number | null         // bps
 *     minThresholdKwd?: string                  // decimal (3 dp)
 *     notes?: string | null
 *     activeFrom: string                        // ISO date
 *     activeUntil?: string | null               // ISO date
 *     createdAt: string
 *     updatedAt: string
 *   }
 *
 * WhtCertificate DTO:
 *   {
 *     id: string
 *     certificateNumber: string                 // unique, WHT-YYYY-NNNN
 *     vendorId: string
 *     relatedBillId?: string | null
 *     relatedPaymentId?: string | null
 *     relatedJournalEntryId?: string | null
 *     category: 'SERVICE'|'PROFESSIONAL'|'RENTAL'|'INTEREST'|'CUSTOM'
 *     grossAmountKwd: string                    // decimal
 *     ratePercent: number                       // bps
 *     withheldAmountKwd: string                 // decimal
 *     netPaidAmountKwd: string                  // decimal
 *     paymentDate: string                       // ISO date
 *     issuedBy: string                          // user id
 *     issuedAt: string                          // ISO timestamp
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

// ─── Config ─────────────────────────────────────────────────────

/**
 * GET /api/wht-config
 *
 * @param {Object} [filters]
 * @param {boolean} [filters.activeOnly]
 * @param {string}  [filters.asOf]              ISO date
 * @returns {Promise<Array>}
 */
export async function listWhtConfigs(filters = {}) {
  const params = {};
  if (filters.activeOnly != null) params.activeOnly = filters.activeOnly;
  if (filters.asOf) params.asOf = filters.asOf;
  const r = await client.get('/api/wht-config', { params });
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

/** GET /api/wht-config/active */
export async function getActiveWhtConfig() {
  const r = await client.get('/api/wht-config/active');
  return unwrap(r);
}

/** GET /api/wht-config/:id */
export async function getWhtConfig(id) {
  const r = await client.get(`/api/wht-config/${encodeURIComponent(id)}`);
  return unwrap(r);
}

/**
 * POST /api/wht-config
 *
 * @param {Object} payload                       see WhtConfig DTO
 * @returns {Promise<Object>}
 */
export async function createWhtConfig(payload) {
  const r = await client.post('/api/wht-config', payload);
  return unwrap(r);
}

/**
 * PATCH /api/wht-config/:id
 *
 * Server only accepts {notes, activeUntil} mutations — rate fields are
 * frozen after create to preserve the audit trail. To change rates,
 * deactivate the current config and create a new one.
 *
 * @param {string} id
 * @param {Object} patch                         {notes?, activeUntil?}
 * @returns {Promise<Object>}
 */
export async function updateWhtConfig(id, patch) {
  const r = await client.patch(
    `/api/wht-config/${encodeURIComponent(id)}`,
    patch,
  );
  return unwrap(r);
}

/** POST /api/wht-config/:id/deactivate */
export async function deactivateWhtConfig(id) {
  const r = await client.post(
    `/api/wht-config/${encodeURIComponent(id)}/deactivate`,
  );
  return unwrap(r);
}

// ─── Certificates (read-only) ───────────────────────────────────

/**
 * GET /api/wht-certificates
 *
 * @param {Object} [filters]
 * @param {string} [filters.vendorId]
 * @param {string} [filters.category]
 * @param {string} [filters.paymentDateFrom]
 * @param {string} [filters.paymentDateTo]
 * @param {number} [filters.limit]
 * @returns {Promise<Array>}
 */
export async function listWhtCertificates(filters = {}) {
  const params = {};
  if (filters.vendorId) params.vendorId = filters.vendorId;
  if (filters.category) params.category = filters.category;
  if (filters.paymentDateFrom) params.paymentDateFrom = filters.paymentDateFrom;
  if (filters.paymentDateTo) params.paymentDateTo = filters.paymentDateTo;
  if (filters.limit != null) params.limit = filters.limit;
  const r = await client.get('/api/wht-certificates', { params });
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

/** GET /api/wht-certificates/:id */
export async function getWhtCertificate(id) {
  const r = await client.get(
    `/api/wht-certificates/${encodeURIComponent(id)}`,
  );
  return unwrap(r);
}
