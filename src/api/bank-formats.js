/**
 * Bank Formats API module (FN-246, Phase 4 Track A Tier 5 — 2026-04-19).
 *
 * Per-bank statement-parsing format registry. Effective-dated specs
 * with version + format-type + arbitrary `spec` JSON (column mapping,
 * delimiter, header offsets, etc.). Consumed by the statement-upload
 * parser pipeline when a tenant uploads a statement from a matching
 * bankCode.
 *
 *   POST   /api/bank-formats                 — create (OWNER)
 *   PATCH  /api/bank-formats/:id             — update (OWNER;
 *                                              effectiveUntil + notes
 *                                              only — bankCode /
 *                                              formatVersion /
 *                                              formatType / spec
 *                                              frozen post-create)
 *   POST   /api/bank-formats/:id/deactivate  — OWNER
 *   GET    /api/bank-formats                 — list + bankCode filter
 *   GET    /api/bank-formats/active          — active row for a
 *                                              (bankCode, asOf) tuple
 *   GET    /api/bank-formats/:id             — read one
 *
 * BankFormatSpec DTO:
 *   {
 *     id: string
 *     bankCode: string                        // e.g. "NBK", "KFH"
 *     formatVersion: string                   // e.g. "v1.2"
 *     formatType: 'CSV' | 'OFX' | 'MT940' |
 *                 'CAMT053' | 'QIF' | 'CUSTOM'
 *     spec: Record<string, unknown>           // arbitrary JSON
 *     effectiveFrom: string                   // ISO date
 *     effectiveUntil?: string | null
 *     notes?: string | null
 *     createdBy: string
 *     createdAt: string
 *     updatedAt: string
 *   }
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

export async function listBankFormats(filters = {}) {
  const params = {};
  if (filters.bankCode) params.bankCode = filters.bankCode;
  const r = await client.get('/api/bank-formats', { params });
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export async function getActiveBankFormat(query) {
  const params = {};
  if (query?.bankCode) params.bankCode = query.bankCode;
  if (query?.asOf) params.asOf = query.asOf;
  const r = await client.get('/api/bank-formats/active', { params });
  return unwrap(r);
}

export async function getBankFormat(id) {
  const r = await client.get(`/api/bank-formats/${encodeURIComponent(id)}`);
  return unwrap(r);
}

export async function createBankFormat(payload) {
  const r = await client.post('/api/bank-formats', payload);
  return unwrap(r);
}

export async function updateBankFormat(id, patch) {
  const r = await client.patch(
    `/api/bank-formats/${encodeURIComponent(id)}`,
    patch,
  );
  return unwrap(r);
}

export async function deactivateBankFormat(id) {
  const r = await client.post(
    `/api/bank-formats/${encodeURIComponent(id)}/deactivate`,
  );
  return unwrap(r);
}
