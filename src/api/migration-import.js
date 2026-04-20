/**
 * Migration Import API module (Phase 4 Track 1 Migration Wizard — 2026-04-20).
 *
 * Tenant onboarding migration flow. Parses CSV from a prior accounting
 * system (Zoho / Haseeb-v1 / Odoo / QuickBooks), stages rows for review,
 * lets the user map source account codes to Haseeb account roles, and
 * posts approved rows into the live journal.
 *
 * Twelve wrappers in five groups:
 *
 *   Step 1 — ingest (POST as JSON body, csv field is plain text):
 *     POST /api/migration-import/invoices          ingestInvoices
 *     POST /api/migration-import/bills             ingestBills
 *     POST /api/migration-import/journal-entries   ingestJournalEntries
 *
 *   Step 2 — staged reads (limit caps at 500 per call):
 *     GET  /api/migration-import/staged/invoices           listStagedInvoices
 *     GET  /api/migration-import/staged/bills              listStagedBills
 *     GET  /api/migration-import/staged/journal-entries    listStagedJournalEntries
 *
 *   Step 3 — account mapping:
 *     GET   /api/migration-import/source-account-map                    listSourceAccountMap
 *     POST  /api/migration-import/source-account-map/:id/suggest        suggestSourceMap
 *     POST  /api/migration-import/source-account-map/suggest-all        suggestAllSourceMap
 *     POST  /api/migration-import/source-account-map/:id/decline-suggestion  declineSuggestion
 *     PATCH /api/migration-import/source-account-map/:id                updateSourceMap
 *
 *   Step 5 — post / reject (per-row; no batch endpoint):
 *     POST /api/migration-import/staged/:kind/:id/post    postStagedItem
 *     POST /api/migration-import/staged/:kind/:id/reject  rejectStagedItem
 *
 * Role gates enforced on the server:
 *   - Ingest: OWNER + ACCOUNTANT.
 *   - Suggest / suggest-all / decline: OWNER + ACCOUNTANT.
 *   - PATCH source-account-map (accept / dismiss / manual-map): OWNER.
 *   - Post from staging: OWNER.
 *   - Reject staged: OWNER.
 *   - Reads: OWNER + ACCOUNTANT + AUDITOR.
 *
 * DTOs (structural reference only; screens consume via typed access):
 *   StagedRow ≈ { id, importJobId, rowNumber, ...entityFields, lines[], unmappedCodes[], status }
 *   SourceAccountMapRow ≈ { id, sourceSystem, sourceCode, sourceName?, haseebAccountId?,
 *     haseebAccountRole?, status: UNMAPPED|MAPPED|AMBIGUOUS|REJECTED, confidence?,
 *     suggestedHaseebAccountRole?, suggestionReason?: 'name_match'|'role_token_match'|'cohort_match',
 *     declinedSuggestions? }
 *   PostResult ≈ { stagedId, postedEntityId, status: POSTED|FAILED_POST, failureReason? }
 *
 * Errors normalised by src/api/client.js. 422 on post failure. 403 on role violation.
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

// ── Step 1 — ingest ─────────────────────────────────────────────────────

/**
 * POST /api/migration-import/invoices
 * @param {{sourceSystem: string, parserVersion: string, csv: string, fileName?: string, fileHash?: string}} payload
 * @returns {Promise<{importJobId: string, count: number}>}
 */
export async function ingestInvoices(payload) {
  const r = await client.post('/api/migration-import/invoices', payload);
  return unwrap(r);
}

/** POST /api/migration-import/bills */
export async function ingestBills(payload) {
  const r = await client.post('/api/migration-import/bills', payload);
  return unwrap(r);
}

/** POST /api/migration-import/journal-entries */
export async function ingestJournalEntries(payload) {
  const r = await client.post('/api/migration-import/journal-entries', payload);
  return unwrap(r);
}

// ── Step 2 — staged reads ───────────────────────────────────────────────

function listStagedParams(filters = {}) {
  const params = {};
  if (filters.status) params.status = filters.status;
  if (filters.importJobId) params.importJobId = filters.importJobId;
  // Cap at 500 per call — backend has no offset pagination per recon.
  params.limit = filters.limit != null ? filters.limit : 500;
  return params;
}

export async function listStagedInvoices(filters = {}) {
  const r = await client.get('/api/migration-import/staged/invoices', {
    params: listStagedParams(filters),
  });
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export async function listStagedBills(filters = {}) {
  const r = await client.get('/api/migration-import/staged/bills', {
    params: listStagedParams(filters),
  });
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export async function listStagedJournalEntries(filters = {}) {
  const r = await client.get('/api/migration-import/staged/journal-entries', {
    params: listStagedParams(filters),
  });
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

// ── Step 3 — account mapping ────────────────────────────────────────────

/**
 * GET /api/migration-import/source-account-map
 * @param {{sourceSystem?: string, status?: 'UNMAPPED'|'MAPPED'|'AMBIGUOUS'|'REJECTED', limit?: number}} [filters]
 */
export async function listSourceAccountMap(filters = {}) {
  const params = {};
  if (filters.sourceSystem) params.sourceSystem = filters.sourceSystem;
  if (filters.status) params.status = filters.status;
  params.limit = filters.limit != null ? filters.limit : 500;
  const r = await client.get('/api/migration-import/source-account-map', {
    params,
  });
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

/** POST /api/migration-import/source-account-map/:id/suggest */
export async function suggestSourceMap(id) {
  const r = await client.post(
    `/api/migration-import/source-account-map/${encodeURIComponent(id)}/suggest`,
  );
  return unwrap(r);
}

/** POST /api/migration-import/source-account-map/suggest-all */
export async function suggestAllSourceMap() {
  const r = await client.post(
    '/api/migration-import/source-account-map/suggest-all',
  );
  return unwrap(r);
}

/**
 * POST /api/migration-import/source-account-map/:id/decline-suggestion
 * @param {string} id
 * @param {{declinedRole: string, reason?: string}} payload
 */
export async function declineSuggestion(id, payload) {
  const r = await client.post(
    `/api/migration-import/source-account-map/${encodeURIComponent(id)}/decline-suggestion`,
    payload,
  );
  return unwrap(r);
}

/**
 * PATCH /api/migration-import/source-account-map/:id
 * @param {string} id
 * @param {{haseebAccountId?: string, haseebAccountRole?: string, status: string, confidence?: number}} payload
 */
export async function updateSourceMap(id, payload) {
  const r = await client.patch(
    `/api/migration-import/source-account-map/${encodeURIComponent(id)}`,
    payload,
  );
  return unwrap(r);
}

// ── Step 5 — post / reject ──────────────────────────────────────────────

/**
 * POST /api/migration-import/staged/:kind/:id/post
 * @param {'invoice'|'bill'|'journal-entry'} kind
 * @param {string} id
 * @returns {Promise<{stagedId, postedEntityId, status, failureReason?}>}
 */
export async function postStagedItem(kind, id) {
  const r = await client.post(
    `/api/migration-import/staged/${encodeURIComponent(kind)}/${encodeURIComponent(id)}/post`,
  );
  return unwrap(r);
}

/**
 * POST /api/migration-import/staged/:kind/:id/reject
 * @param {'invoice'|'bill'|'journal-entry'} kind
 * @param {string} id
 * @param {string} reason
 */
export async function rejectStagedItem(kind, id, reason) {
  const r = await client.post(
    `/api/migration-import/staged/${encodeURIComponent(kind)}/${encodeURIComponent(id)}/reject`,
    { reason },
  );
  return unwrap(r);
}
