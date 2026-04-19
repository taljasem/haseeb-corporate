/**
 * CBK Rates API module (FN-238, Phase 4 Track A Tier 5 — 2026-04-19).
 *
 * Central Bank of Kuwait exchange-rate register. Per-tenant keyed on
 * (currency, rateDate) composite. Consumed by FX revaluation (FN-175)
 * and bilingual reports. This partial ships the manual-entry register
 * + lookup + staleness endpoints. Scheduled CBK scraper + embedded-
 * bank-source wiring are reserved in the CbkRateSource enum but not
 * yet implemented (Lane 1 follow-up).
 *
 *   POST   /api/cbk-rates                   — upsert (OWNER)
 *   DELETE /api/cbk-rates/:id               — delete (OWNER)
 *   GET    /api/cbk-rates                   — list + filters
 *   GET    /api/cbk-rates/lookup/exact      — rate for (currency, asOf)
 *   GET    /api/cbk-rates/lookup/latest     — latest rate for currency
 *   GET    /api/cbk-rates/staleness         — staleness signal
 *   GET    /api/cbk-rates/:id               — read one
 *
 * Rate DTO:
 *   {
 *     id: string
 *     currency: string                      // 3-letter ISO 4217
 *     rateDate: string                      // ISO date
 *     rateKwd: string                       // decimal up to 8 dp
 *     source: 'MANUAL' | 'CBK_SCHEDULED' | 'BANK_EMBEDDED'
 *     notes?: string | null
 *     createdBy: string
 *     createdAt: string
 *     updatedAt: string
 *   }
 *
 * Staleness DTO:
 *   {
 *     currency: string
 *     asOf: string
 *     latestRate?: CbkRate | null
 *     ageInDays: number | null
 *     staleThresholdDays: number
 *     isStale: boolean
 *     note: string
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

export async function listCbkRates(filters = {}) {
  const params = {};
  if (filters.currency) params.currency = filters.currency;
  if (filters.rateDateFrom) params.rateDateFrom = filters.rateDateFrom;
  if (filters.rateDateTo) params.rateDateTo = filters.rateDateTo;
  if (filters.limit != null) params.limit = filters.limit;
  const r = await client.get('/api/cbk-rates', { params });
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export async function getCbkRate(id) {
  const r = await client.get(`/api/cbk-rates/${encodeURIComponent(id)}`);
  return unwrap(r);
}

export async function lookupCbkRateForDate(query) {
  const params = { currency: query.currency };
  if (query.asOf) params.asOf = query.asOf;
  const r = await client.get('/api/cbk-rates/lookup/exact', { params });
  return unwrap(r);
}

export async function lookupLatestCbkRate(query) {
  const params = { currency: query.currency };
  if (query.asOf) params.asOf = query.asOf;
  const r = await client.get('/api/cbk-rates/lookup/latest', { params });
  return unwrap(r);
}

export async function getCbkRateStaleness(query) {
  const params = { currency: query.currency };
  if (query.asOf) params.asOf = query.asOf;
  if (query.staleThresholdDays != null)
    params.staleThresholdDays = query.staleThresholdDays;
  const r = await client.get('/api/cbk-rates/staleness', { params });
  return unwrap(r);
}

export async function upsertCbkRate(payload) {
  const r = await client.post('/api/cbk-rates', payload);
  return unwrap(r);
}

export async function deleteCbkRate(id) {
  const r = await client.delete(`/api/cbk-rates/${encodeURIComponent(id)}`);
  return unwrap(r);
}
