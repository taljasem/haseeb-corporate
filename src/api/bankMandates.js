/**
 * Bank Mandates API module — AUDIT-ACC-002 (2026-04-22).
 *
 * Read-only wrappers for the mandate surface exposed by corporate-api's
 * payment-vouchers module (mandatesRouter mounted at /api/bank-mandates).
 *
 * The voucher composer selects an ACTIVE mandate to gate HASEEB-274
 * (two-signatory Kuwait compliance surface). This dispatch ships the
 * three READ wrappers the composer needs; mandate CRUD (create /
 * acknowledge / cancel / assign / revoke) is OWNER-only and is tracked
 * as HASEEB-210 (P3 follow-up for a dedicated mandate-admin surface).
 *
 * Response shape (post-unwrap):
 *   GET /                → { rowCount, rows[] }   — listMandates
 *   GET /:id             → mandate row directly    — getMandate
 *   GET /:id/signatories → { rowCount, rows[] }   — listMandateSignatories
 *
 * mandateRules.requires[].count is the key field the composer reads to
 * surface the HASEEB-274 warning: if Σcount < 2 for CHEQUE_* methods,
 * show a compliance banner.
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
 * List bank mandates. OWNER / ACCOUNTANT / VIEWER / AUDITOR.
 *
 * @param {{ bankName?: string, accountReference?: string,
 *          status?: 'PENDING_BANK_ACKNOWLEDGMENT'|'ACTIVE'|'SUPERSEDED'|'CANCELLED',
 *          limit?: number }} [filter]
 */
export async function listMandates(filter = {}) {
  const params = {};
  if (filter.bankName) params.bankName = filter.bankName;
  if (filter.accountReference) params.accountReference = filter.accountReference;
  if (filter.status) params.status = filter.status;
  if (filter.limit != null) params.limit = String(filter.limit);
  const r = await client.get('/api/bank-mandates', { params });
  const data = unwrap(r);
  if (data && Array.isArray(data.rows)) {
    return { rowCount: data.rowCount ?? data.rows.length, rows: data.rows };
  }
  if (Array.isArray(data)) return { rowCount: data.length, rows: data };
  return { rowCount: 0, rows: [] };
}

/** Mandate detail. Returns the row including mandateRules JSON. */
export async function getMandate(id) {
  if (!id) throw new Error('getMandate: id is required');
  const r = await client.get(
    `/api/bank-mandates/${encodeURIComponent(id)}`,
  );
  return unwrap(r);
}

/** Signatory assignments on a mandate. */
export async function listMandateSignatories(id) {
  if (!id) throw new Error('listMandateSignatories: id is required');
  const r = await client.get(
    `/api/bank-mandates/${encodeURIComponent(id)}/signatories`,
  );
  const data = unwrap(r);
  if (data && Array.isArray(data.rows)) {
    return { rowCount: data.rowCount ?? data.rows.length, rows: data.rows };
  }
  if (Array.isArray(data)) return { rowCount: data.length, rows: data };
  return { rowCount: 0, rows: [] };
}
