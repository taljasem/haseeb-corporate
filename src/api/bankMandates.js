/**
 * Bank Mandates API module — AUDIT-ACC-002 (2026-04-22) read wrappers
 * + HASEEB-211 (2026-04-22) Owner-side admin write wrappers.
 *
 * Wraps the 8 endpoints exposed by corporate-api's payment-vouchers
 * module `mandatesRouter` (mounted at `/api/bank-mandates`):
 *   GET  /                     → listMandates               (all read roles)
 *   GET  /:id                  → getMandate                 (all read roles)
 *   GET  /:id/signatories      → listMandateSignatories     (all read roles)
 *   POST /                     → createMandate              (OWNER)
 *   PATCH /:id/acknowledge     → acknowledgeMandate         (OWNER)
 *   POST /:id/cancel           → cancelMandate              (OWNER)
 *   POST /:id/signatories      → assignMandateSignatory     (OWNER)
 *   POST /signatories/revoke   → revokeMandateSignatory     (OWNER)
 *
 * Mandates follow the Kuwait banking supersession pattern: rules are
 * IMMUTABLE once issued. There is intentionally no PATCH / update
 * endpoint beyond `acknowledge`. To change rules, Owner cancels the
 * current mandate and creates a new one (the "Create replacement
 * mandate" shortcut on BankMandateAdminScreen). HASEEB-232 tracks a
 * future QoL wizard that bundles cancel + create into one atomic flow.
 *
 * Response envelope: controller returns `successResponse(narrowed)` which
 *   unwrap()s to the narrowed object / list. List responses are
 *   `{ rowCount, rows }`.
 *
 * Errors are normalised by client.js into `{ ok:false, status, code, message }`.
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

// ── Reads (AUDIT-ACC-002) ────────────────────────────────────────────

/**
 * List bank mandates. OWNER / ACCOUNTANT / VIEWER / AUDITOR.
 *
 * @param {{ bankName?: string, accountReference?: string,
 *          status?: 'PENDING_BANK_ACKNOWLEDGMENT'|'ACTIVE'|'SUPERSEDED'|'CANCELLED',
 *          limit?: number }} [filter]
 * @returns {Promise<{ rowCount: number, rows: Array }>}
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

/** Signatory assignments on a mandate (current + historical). */
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

// ── Writes (HASEEB-211, OWNER-only) ──────────────────────────────────

/**
 * Create a new bank mandate. OWNER only.
 *
 * @param {{
 *   bankName: string,
 *   accountReference: string,
 *   mandateDocumentUrl?: string | null,
 *   mandateRules: {
 *     requires: Array<{ signatoryClass: string, count: number }>,
 *     amountThresholds?: Array<{
 *       minAmountKwd: string,                  // KWD Decimal 3dp
 *       extraRequires: Array<{ signatoryClass: string, count: number }>
 *     }>
 *   },
 *   effectiveFrom: string,                     // YYYY-MM-DD
 *   effectiveUntil?: string | null,
 *   markActiveImmediately?: boolean
 * }} body
 */
export async function createMandate(body) {
  const r = await client.post('/api/bank-mandates', body);
  return unwrap(r);
}

/**
 * Acknowledge a PENDING_BANK_ACKNOWLEDGMENT mandate → ACTIVE. OWNER only.
 *
 * @param {string} id
 * @param {{ acknowledgedAt?: string, note?: string | null }} [body]
 */
export async function acknowledgeMandate(id, body = {}) {
  if (!id) throw new Error('acknowledgeMandate: id is required');
  const r = await client.patch(
    `/api/bank-mandates/${encodeURIComponent(id)}/acknowledge`,
    body || {},
  );
  return unwrap(r);
}

/**
 * Cancel a mandate (terminal → CANCELLED). OWNER only. Reason optional
 * at the HTTP layer (max 500 chars); the admin surface enforces a
 * required reason on the client side as an audit-trail quality gate.
 *
 * @param {string} id
 * @param {{ reason?: string }} [body]
 */
export async function cancelMandate(id, body = {}) {
  if (!id) throw new Error('cancelMandate: id is required');
  const r = await client.post(
    `/api/bank-mandates/${encodeURIComponent(id)}/cancel`,
    body || {},
  );
  return unwrap(r);
}

/**
 * Assign a per-user signatory to a mandate. OWNER only.
 *
 * @param {string} id
 * @param {{
 *   userId: string,
 *   signatoryClass: string,
 *   effectiveFrom: string,                     // YYYY-MM-DD
 *   effectiveUntil?: string | null
 * }} body
 */
export async function assignMandateSignatory(id, body) {
  if (!id) throw new Error('assignMandateSignatory: id is required');
  const r = await client.post(
    `/api/bank-mandates/${encodeURIComponent(id)}/signatories`,
    body,
  );
  return unwrap(r);
}

/**
 * Revoke an existing signatory assignment. OWNER only.
 *
 * @param {{
 *   assignmentId: string,
 *   revokedReason: string,
 *   effectiveUntil: string                     // YYYY-MM-DD (end date)
 * }} body
 */
export async function revokeMandateSignatory(body) {
  const r = await client.post('/api/bank-mandates/signatories/revoke', body);
  return unwrap(r);
}
