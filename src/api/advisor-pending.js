/**
 * Advisor Pending Queue API module (Wave 6B.3 Layer 3).
 *
 * Wraps the Aminah proactive-surface endpoints on the Corporate API:
 *
 *   GET    /api/aminah/pending                         — list active items
 *   POST   /api/aminah/pending/:id/defer               — push to future
 *   POST   /api/aminah/pending/:id/dismiss             — OWNER-only, kill it
 *   POST   /api/aminah/pending/:id/acknowledge         — OWNER + ACCOUNTANT;
 *                                                        pure bookkeeping
 *                                                        sink called AFTER
 *                                                        the JE approval
 *                                                        gateway succeeds.
 *
 * AdvisorPendingItem shape (JSDoc, dashboard speaks JSON):
 *   {
 *     id: string
 *     tenantId: string
 *     source: 'statutory-reserve' | 'compliance-calendar'
 *           | 'pifss-monthly' | ...              // opaque string
 *     subject: string
 *     message: string
 *     messageAr?: string
 *     severity: 'info' | 'warning' | 'critical'
 *     status: string
 *     suggestedToolCalls?: object[]
 *     pendingJeId?: string                       // drives the Confirm button
 *     actionPayload?: object
 *     displayAmountKwd?: string                  // Decimal 3-dp string
 *     dueAt: ISO8601 string
 *     deferredUntil?: ISO8601 string
 *     createdAt: ISO8601 string
 *     updatedAt: ISO8601 string
 *   }
 *
 * All endpoints return the standard wrapped envelope `{ success, data }`;
 * the list route returns `{ items }` inside `data`. The critical frontend
 * invariant is that `acknowledge` is ONLY called after the JE approval
 * gateway has succeeded — this module does not enforce that; callers
 * must sequence the two calls themselves.
 *
 * Errors are surfaced as the normalised object thrown by `src/api/client.js`:
 *   { ok: false, status, code, message }
 * with code ∈ NETWORK_ERROR | UNAUTHORIZED | SERVER_ERROR | CLIENT_ERROR.
 * A 403 on `dismiss` indicates the authenticated user is not OWNER; the
 * UI should present that gracefully rather than blowing up.
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
 * GET /api/aminah/pending
 * Returns the active items array for the current tenant. Deferred-to-future
 * items are filtered server-side and do not appear here.
 *
 * @returns {Promise<Array>} items
 */
export async function listAdvisorPending() {
  const r = await client.get('/api/aminah/pending');
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

/**
 * POST /api/aminah/pending/:id/defer
 *
 * @param {string} id
 * @param {string} deferredUntil  ISO8601
 * @returns {Promise<Object>} updated item
 */
export async function deferAdvisorPending(id, deferredUntil) {
  const r = await client.post(
    `/api/aminah/pending/${encodeURIComponent(id)}/defer`,
    { deferredUntil }
  );
  return unwrap(r);
}

/**
 * POST /api/aminah/pending/:id/dismiss
 * OWNER-only on the server. Non-Owners receive 403 UNAUTHORIZED.
 *
 * @param {string} id
 * @param {string} [reason]
 * @returns {Promise<Object>} updated item
 */
export async function dismissAdvisorPending(id, reason) {
  const r = await client.post(
    `/api/aminah/pending/${encodeURIComponent(id)}/dismiss`,
    reason ? { reason } : {}
  );
  return unwrap(r);
}

/**
 * POST /api/aminah/pending/:id/acknowledge
 * OWNER + ACCOUNTANT. Pure status-bookkeeping sink; MUST ONLY be called
 * after the JE approval gateway (POST /api/journal-entries/:id/validate)
 * has succeeded. The backend does not verify gateway state; the frontend
 * is the gate.
 *
 * @param {string} id
 * @param {string} [gatewayResponseRef]  opaque id from the gateway response
 * @returns {Promise<Object>} updated item
 */
export async function acknowledgeAdvisorPending(id, gatewayResponseRef) {
  const r = await client.post(
    `/api/aminah/pending/${encodeURIComponent(id)}/acknowledge`,
    gatewayResponseRef ? { gatewayResponseRef } : {}
  );
  return unwrap(r);
}
