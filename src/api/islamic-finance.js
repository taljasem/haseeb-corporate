/**
 * Islamic Finance API module (FN-247, Phase 4 Track A Tier 4 — 2026-04-19).
 *
 * Sharia-compliant finance arrangements (Murabaha / Ijara / Mudaraba /
 * Musharaka / Wakala / Sukuk / CUSTOM) with source-term preservation
 * and AAOIFI-alongside-IFRS label pairs.
 *
 * Wire-format note: `profitRatePercent` is basis-points ×100 integer
 * on the wire (500 = 5.00%). The UI edits in percent (0..100, up to 2
 * decimals) and converts at the API boundary.
 *
 *   POST   /api/islamic-finance/arrangements                  — create
 *   PATCH  /api/islamic-finance/arrangements/:id/status       — transition
 *   POST   /api/islamic-finance/arrangements/:id/schedule     — generate
 *                                                                (body:
 *                                                                { regenerate })
 *   POST   /api/islamic-finance/schedule-rows/:id/mark-paid   — mark paid
 *   GET    /api/islamic-finance/arrangements                  — list
 *   GET    /api/islamic-finance/arrangements/:id              — detail +
 *                                                                schedule
 *   GET    /api/islamic-finance/arrangements/:id/position     — position
 *                                                                at asOf
 *
 * Status lifecycle: ACTIVE → MATURED | DEFAULTED (non-terminal) → SETTLED
 * (terminal). CANCELLED terminal from any pre-SETTLED state.
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

export async function listIslamicArrangements(filters = {}) {
  const params = {};
  if (filters.arrangementType) params.arrangementType = filters.arrangementType;
  if (filters.direction) params.direction = filters.direction;
  if (filters.status) params.status = filters.status;
  if (filters.counterpartyBank) params.counterpartyBank = filters.counterpartyBank;
  const r = await client.get('/api/islamic-finance/arrangements', { params });
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export async function getIslamicArrangement(id) {
  const r = await client.get(
    `/api/islamic-finance/arrangements/${encodeURIComponent(id)}`,
  );
  return unwrap(r);
}

export async function createIslamicArrangement(payload) {
  const r = await client.post('/api/islamic-finance/arrangements', payload);
  return unwrap(r);
}

export async function transitionIslamicStatus(id, status) {
  const r = await client.patch(
    `/api/islamic-finance/arrangements/${encodeURIComponent(id)}/status`,
    { status },
  );
  return unwrap(r);
}

export async function generateIslamicSchedule(id, opts = {}) {
  const r = await client.post(
    `/api/islamic-finance/arrangements/${encodeURIComponent(id)}/schedule`,
    { regenerate: !!opts.regenerate },
  );
  return unwrap(r);
}

export async function markIslamicInstallmentPaid(scheduleRowId, payload) {
  const r = await client.post(
    `/api/islamic-finance/schedule-rows/${encodeURIComponent(scheduleRowId)}/mark-paid`,
    payload,
  );
  return unwrap(r);
}

export async function getIslamicPosition(id, asOf = null) {
  const params = {};
  if (asOf) params.asOf = asOf;
  const r = await client.get(
    `/api/islamic-finance/arrangements/${encodeURIComponent(id)}/position`,
    { params },
  );
  return unwrap(r);
}
