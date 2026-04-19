/**
 * Petty Cash API module (FN-275, Phase 4 Track A Tier 3 — 2026-04-19).
 *
 * Multi-box imprest model. Each box has a fixed imprestAmountKwd and a
 * running currentBalanceKwd maintained by the server as transactions
 * (EXPENSE / REPLENISH / ADJUSTMENT) are recorded. Reconciliation
 * computes "cash on hand + receipts since last REPLENISH" against the
 * imprest and surfaces any variance.
 *
 *   POST   /api/petty-cash/boxes                  — create box (OWNER)
 *   POST   /api/petty-cash/boxes/:id/deactivate   — deactivate (OWNER)
 *   GET    /api/petty-cash/boxes                  — list (OWNER/ACCT/AUD)
 *   GET    /api/petty-cash/boxes/:id              — read one
 *   POST   /api/petty-cash/boxes/:id/transactions — record tx
 *                                                   (OWNER/ACCOUNTANT)
 *   GET    /api/petty-cash/transactions           — list tx + filters
 *   GET    /api/petty-cash/boxes/:id/reconcile    — reconcile view
 *                                                   (OWNER/ACCT/AUD)
 *
 * Box DTO:
 *   {
 *     id: string
 *     label: string
 *     imprestAmountKwd: string            // decimal
 *     currentBalanceKwd: string           // decimal
 *     custodianUserId?: string | null
 *     isActive: boolean
 *     notes?: string | null
 *     createdBy: string
 *     createdAt: string
 *     updatedAt: string
 *   }
 *
 * Transaction DTO:
 *   {
 *     id: string
 *     boxId: string
 *     txDate: string                      // ISO date-only
 *     type: 'EXPENSE' | 'REPLENISH' | 'ADJUSTMENT'
 *     amountKwd: string                   // non-negative decimal
 *     description: string
 *     receiptRef?: string | null
 *     expenseAccountId?: string | null
 *     createdBy: string
 *     createdAt: string
 *   }
 *
 * Reconciliation DTO:
 *   {
 *     boxId: string
 *     imprestAmountKwd: string
 *     currentBalanceKwd: string
 *     receiptsHeldKwd: string             // sum EXPENSE since last REPLENISH
 *     shortfallKwd: string                // imprest − current
 *     countedVsImprestKwd: string         // current + receipts − imprest
 *     replenishRecommendedKwd: string     // imprest − current
 *     note: string                        // "in balance" | ...
 *   }
 *
 * Errors normalised by src/api/client.js. 403 on box-create/deactivate
 * means non-OWNER; 403 on recordTx means non-OWNER-and-non-ACCOUNTANT.
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

/** GET /api/petty-cash/boxes */
export async function listPettyCashBoxes() {
  const r = await client.get('/api/petty-cash/boxes');
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

/** GET /api/petty-cash/boxes/:id */
export async function getPettyCashBox(id) {
  const r = await client.get(
    `/api/petty-cash/boxes/${encodeURIComponent(id)}`,
  );
  return unwrap(r);
}

/**
 * POST /api/petty-cash/boxes
 * @param {Object} payload  { label, imprestAmountKwd, custodianUserId?, notes? }
 */
export async function createPettyCashBox(payload) {
  const r = await client.post('/api/petty-cash/boxes', payload);
  return unwrap(r);
}

/** POST /api/petty-cash/boxes/:id/deactivate */
export async function deactivatePettyCashBox(id) {
  const r = await client.post(
    `/api/petty-cash/boxes/${encodeURIComponent(id)}/deactivate`,
  );
  return unwrap(r);
}

/**
 * POST /api/petty-cash/boxes/:id/transactions
 * @param {string} boxId
 * @param {Object} payload  { txDate, type, amountKwd, description,
 *                            receiptRef?, expenseAccountId? }
 */
export async function recordPettyCashTx(boxId, payload) {
  const r = await client.post(
    `/api/petty-cash/boxes/${encodeURIComponent(boxId)}/transactions`,
    payload,
  );
  return unwrap(r);
}

/**
 * GET /api/petty-cash/transactions
 * @param {Object} [filters]  { boxId?, type?, dateFrom?, dateTo? }
 */
export async function listPettyCashTransactions(filters = {}) {
  const params = {};
  if (filters.boxId) params.boxId = filters.boxId;
  if (filters.type) params.type = filters.type;
  if (filters.dateFrom) params.dateFrom = filters.dateFrom;
  if (filters.dateTo) params.dateTo = filters.dateTo;
  const r = await client.get('/api/petty-cash/transactions', { params });
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

/** GET /api/petty-cash/boxes/:id/reconcile */
export async function reconcilePettyCashBox(id) {
  const r = await client.get(
    `/api/petty-cash/boxes/${encodeURIComponent(id)}/reconcile`,
  );
  return unwrap(r);
}
