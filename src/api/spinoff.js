/**
 * Spinoff API module (FN-242, Phase 4 Track A Tier 4 — 2026-04-19).
 *
 * Entity split / spinoff event lifecycle: DRAFT → VALIDATED →
 * APPROVED → POSTED (POSTED deferred pending backend JE splice).
 * CANCELLED terminal from DRAFT or VALIDATED.
 *
 *   POST   /api/spinoff/events                    — create DRAFT
 *   POST   /api/spinoff/events/:id/transfers      — add a transfer
 *   DELETE /api/spinoff/transfers/:id             — remove a transfer
 *   POST   /api/spinoff/events/:id/validate       — DRAFT|VALIDATED →
 *                                                    VALIDATED (if
 *                                                    A=L+E balanced)
 *   POST   /api/spinoff/events/:id/approve        — VALIDATED → APPROVED
 *                                                    (OWNER only)
 *   POST   /api/spinoff/events/:id/cancel         — DRAFT|VALIDATED →
 *                                                    CANCELLED (OWNER)
 *   GET    /api/spinoff/events/:id/balance-check  — A = L + E check
 *   GET    /api/spinoff/events/:id                — read one
 *   GET    /api/spinoff/events                    — list + filters
 *
 * Event DTO:
 *   {
 *     id: string
 *     targetEntityLabel: string            // name of the new entity
 *     effectiveDate: string                // ISO date
 *     description: string
 *     status: 'DRAFT' | 'VALIDATED' | 'APPROVED' | 'POSTED' | 'CANCELLED'
 *     notes?: string | null
 *     validatedAt?: string | null
 *     approvedAt?: string | null
 *     approvedBy?: string | null
 *     createdBy: string
 *     createdAt: string
 *     updatedAt: string
 *     transfers?: Transfer[]               // populated on detail read
 *   }
 *
 * Transfer DTO:
 *   {
 *     id: string
 *     eventId: string
 *     sourceAccountId: string
 *     amountKwd: string                    // non-negative decimal
 *     classification: 'ASSET' | 'LIABILITY' | 'EQUITY'
 *     notes?: string | null
 *     createdAt: string
 *   }
 *
 * BalanceCheck DTO:
 *   {
 *     assetsKwd: string
 *     liabilitiesKwd: string
 *     equityKwd: string
 *     leftSideKwd: string                  // = assets
 *     rightSideKwd: string                 // = liabilities + equity
 *     differenceKwd: string                // left - right
 *     isBalanced: boolean                  // |difference| <= 0.001
 *     note: string
 *   }
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

export async function listSpinoffEvents(filters = {}) {
  const params = {};
  if (filters.status) params.status = filters.status;
  const r = await client.get('/api/spinoff/events', { params });
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export async function getSpinoffEvent(id) {
  const r = await client.get(`/api/spinoff/events/${encodeURIComponent(id)}`);
  return unwrap(r);
}

export async function createSpinoffEvent(payload) {
  const r = await client.post('/api/spinoff/events', payload);
  return unwrap(r);
}

export async function addSpinoffTransfer(eventId, payload) {
  const r = await client.post(
    `/api/spinoff/events/${encodeURIComponent(eventId)}/transfers`,
    payload,
  );
  return unwrap(r);
}

export async function removeSpinoffTransfer(transferId) {
  const r = await client.delete(
    `/api/spinoff/transfers/${encodeURIComponent(transferId)}`,
  );
  return unwrap(r);
}

export async function validateSpinoffEvent(id) {
  const r = await client.post(
    `/api/spinoff/events/${encodeURIComponent(id)}/validate`,
  );
  return unwrap(r);
}

export async function approveSpinoffEvent(id) {
  const r = await client.post(
    `/api/spinoff/events/${encodeURIComponent(id)}/approve`,
  );
  return unwrap(r);
}

export async function cancelSpinoffEvent(id) {
  const r = await client.post(
    `/api/spinoff/events/${encodeURIComponent(id)}/cancel`,
  );
  return unwrap(r);
}

export async function getSpinoffBalanceCheck(id) {
  const r = await client.get(
    `/api/spinoff/events/${encodeURIComponent(id)}/balance-check`,
  );
  return unwrap(r);
}
