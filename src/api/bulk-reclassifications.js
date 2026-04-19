/**
 * Bulk Reclassifications API module (FN-239, Phase 4 Track A Tier 3
 * — 2026-04-19).
 *
 * Proposal → Preview → Approve lifecycle for bulk GL reclassifications.
 * Per Sarah's audit-trail model the reclassification NEVER mutates the
 * original JE lines; approval triggers a new RECLASSIFICATION JE
 * moving aggregated balances from `fromAccount` to `toAccount`. The
 * actual JE posting ships in a follow-up backend dispatch; for now
 * APPROVED is the terminal state and the jeShape endpoint surfaces
 * what the future posting would look like.
 *
 *   POST   /api/bulk-reclassifications                — create
 *                                                        (DRAFT)
 *   POST   /api/bulk-reclassifications/:id/preview   — capture lines
 *                                                        (DRAFT →
 *                                                        PREVIEWED, or
 *                                                        re-preview)
 *   POST   /api/bulk-reclassifications/:id/approve   — lock proposal
 *                                                        (PREVIEWED →
 *                                                        APPROVED)
 *   POST   /api/bulk-reclassifications/:id/cancel    — terminal-cancel
 *                                                        (DRAFT or
 *                                                        PREVIEWED →
 *                                                        CANCELLED)
 *   GET    /api/bulk-reclassifications/:id/je-shape  — show what the
 *                                                        posting JE
 *                                                        will look
 *                                                        like (APPROVED
 *                                                        or POSTED only)
 *   GET    /api/bulk-reclassifications               — list + filter
 *   GET    /api/bulk-reclassifications/:id           — read one
 *
 * Proposal DTO:
 *   {
 *     id: string
 *     description: string
 *     fromAccountId: string
 *     toAccountId: string
 *     dateFrom?: string | null
 *     dateTo?: string | null
 *     descriptionContains?: string | null
 *     notes?: string | null
 *     status: 'DRAFT' | 'PREVIEWED' | 'APPROVED' | 'POSTED' |
 *             'CANCELLED'
 *     createdBy: string
 *     createdAt: string
 *     updatedAt: string
 *     lines?: Array<{
 *       id: string
 *       reclassificationId: string
 *       originJournalEntryLineId: string
 *       originJournalEntryId: string
 *       originDate: string
 *       originDescription: string | null
 *       debit: string
 *       credit: string
 *     }>
 *   }
 *
 * JE shape DTO:
 *   {
 *     reclassificationId: string
 *     fromAccountId: string
 *     toAccountId: string
 *     totalMovedKwd: string
 *     legs: Array<{
 *       accountId: string
 *       side: 'DEBIT' | 'CREDIT'
 *       amountKwd: string
 *       description: string
 *     }>
 *     note: string
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

/** GET /api/bulk-reclassifications */
export async function listBulkReclassifications(filters = {}) {
  const params = {};
  if (filters.status) params.status = filters.status;
  const r = await client.get('/api/bulk-reclassifications', { params });
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

/** GET /api/bulk-reclassifications/:id */
export async function getBulkReclassification(id) {
  const r = await client.get(
    `/api/bulk-reclassifications/${encodeURIComponent(id)}`,
  );
  return unwrap(r);
}

/**
 * POST /api/bulk-reclassifications
 * @param {Object} payload
 * @param {string} payload.description
 * @param {string} payload.fromAccountId         uuid
 * @param {string} payload.toAccountId           uuid
 * @param {string} [payload.dateFrom]            ISO date
 * @param {string} [payload.dateTo]              ISO date
 * @param {string} [payload.descriptionContains]
 * @param {string} [payload.notes]
 */
export async function createBulkReclassification(payload) {
  const r = await client.post('/api/bulk-reclassifications', payload);
  return unwrap(r);
}

/** POST /api/bulk-reclassifications/:id/preview */
export async function previewBulkReclassification(id) {
  const r = await client.post(
    `/api/bulk-reclassifications/${encodeURIComponent(id)}/preview`,
  );
  return unwrap(r);
}

/** POST /api/bulk-reclassifications/:id/approve */
export async function approveBulkReclassification(id) {
  const r = await client.post(
    `/api/bulk-reclassifications/${encodeURIComponent(id)}/approve`,
  );
  return unwrap(r);
}

/** POST /api/bulk-reclassifications/:id/cancel */
export async function cancelBulkReclassification(id) {
  const r = await client.post(
    `/api/bulk-reclassifications/${encodeURIComponent(id)}/cancel`,
  );
  return unwrap(r);
}

/** GET /api/bulk-reclassifications/:id/je-shape */
export async function getBulkReclassificationJeShape(id) {
  const r = await client.get(
    `/api/bulk-reclassifications/${encodeURIComponent(id)}/je-shape`,
  );
  return unwrap(r);
}
