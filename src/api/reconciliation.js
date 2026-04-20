/**
 * Reconciliation API module — Track B Dispatch 5 + 5a/5b/5c (2026-04-20).
 *
 * Covers 11 endpoints (bundled into 12 wrappers — `reopen` and `lock` are
 * surfaced separately per UI affordance):
 *
 *   GET  /api/reconciliation/dashboard?period=YYYY-MM
 *   GET  /api/accounts/primary-operating                 (cross-cutting)
 *   GET  /api/fiscal-periods/:year/:month/status         (cross-cutting)
 *   POST /api/reconciliation/:id/reopen
 *   POST /api/reconciliation/:id/lock                    (OWNER only)
 *   POST /api/reconciliation/:id/import-statement
 *   GET  /api/reconciliation/:id/export?format=csv
 *   POST /api/reconciliation/:id/exceptions/:excId/resolve
 *   POST /api/reconciliation/:id/suggestions/:suggId/confirm
 *   POST /api/reconciliation/:id/suggestions/:suggId/dismiss
 *   POST /api/reconciliation/:id/create-journal-entry    (WALL-GATED)
 *   POST /api/reconciliation/parse-statement
 *
 * Shape notes:
 *
 *   • The EXISTING reconciliation read surface (`getReconciliationDashboard`,
 *     `getReconciliationById`, `getReconciliationHistory`) returns a RICH,
 *     UI-shaped payload in the mockEngine — nested `matchedItems`, `unmatched{Bank,Ledger}Items`,
 *     `pendingSuggestions`, `exceptions[]` with `suggestedAction` enum,
 *     `period: {month,year,label}`, `openingBalance / closingBalance /
 *     closingLedgerBalance / reconciliationDifference`, etc.
 *
 *     The LIVE backend `GET /api/reconciliation/dashboard` returns
 *     `{ period, rows: [{ accountId, accountName, bankAccountId, bankName,
 *     accountNumberMasked, status: 'clean'|'in-progress'|'exceptions',
 *     matchedCount, totalStatementCount, exceptionCount, lastActivityAt }] }`
 *     — NO `currentReconciliationId`, different status vocabulary, no totals.
 *
 *     The LIVE `GET /api/reconciliation/:id` returns `{ reconciliation,
 *     matches, unmatchedStatements, unmatchedBookEntries, difference }` —
 *     a radically different shape from the UI's consumption surface.
 *
 *     Writing adapters to invent the missing fields (`pendingSuggestions`,
 *     `exceptions[]` with `type + suggestedAction + description`,
 *     `openingBalance / closingLedgerBalance`, per-match `matchTier`,
 *     per-session `period: {month,year,label}`) would be intrusive and
 *     outside this wire's scope. Per wire 5 spec ("Do NOT refactor the
 *     screen architecture. Swap mocks, handle shape deltas, wire new
 *     actions."), those three READERS are STOPPED-AND-FLAGGED and remain
 *     on mockEngine for now; see BLOCKER at the bottom of the commit
 *     message for the follow-up wire scope.
 *
 *   • The 11 endpoints wrapped below are all ACTION endpoints and take
 *     discrete inputs / return discrete shapes that the UI either consumes
 *     directly (export CSV, fiscal-period status, primary-operating) or
 *     can ignore (reopen / lock / resolve / confirm / dismiss just need a
 *     "success" signal followed by a session reload — and the session
 *     reload goes through `getReconciliationById` which is mock for now).
 *
 * Error handling: client.js normalises to `{ ok:false, status, code,
 * message }`. These wrappers propagate errors as-thrown; consumers surface
 * via the existing toast pattern.
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

// ── Dashboard ────────────────────────────────────────────────────────────

/**
 * GET /api/reconciliation/dashboard?period=YYYY-MM — all 4 roles.
 *
 * Returns `{ period, rows: [...] }`. Mock consumer expects the flat array —
 * this wrapper returns the raw payload; callers destructure.
 *
 * @param {{period?: string}} opts
 */
export async function getReconciliationDashboard({ period } = {}) {
  const params = {};
  if (period) params.period = period;
  const r = await client.get('/api/reconciliation/dashboard', { params });
  return unwrap(r);
}

// ── Cross-cutting resolvers ──────────────────────────────────────────────

/**
 * GET /api/accounts/primary-operating — all 4 roles.
 * 404 if no BANK_PRIMARY Account exists.
 *
 * Returns `{ accountId, accountCode, accountName, bankAccountId, bankName,
 * accountNumberMasked, accentColor }`.
 */
export async function getPrimaryOperatingAccount() {
  const r = await client.get('/api/accounts/primary-operating');
  return unwrap(r);
}

/**
 * GET /api/fiscal-periods/:year/:month/status — all 4 roles.
 *
 * Returns `{ year, month, status: 'open'|'soft-closed'|'hard-closed'|'locked',
 * canEditReconciliations, isApprovalRequired }`.
 */
export async function getFiscalPeriodStatus(year, month) {
  const r = await client.get(
    `/api/fiscal-periods/${encodeURIComponent(year)}/${encodeURIComponent(month)}/status`,
  );
  return unwrap(r);
}

// ── Session lifecycle ────────────────────────────────────────────────────

/**
 * POST /api/reconciliation/:id/reopen — OWNER + ACCOUNTANT.
 * 400 if status !== COMPLETED. 403 if locked.
 *
 * @param {string} id
 * @param {{reason?: string}} body
 */
export async function reopenReconciliation(id, { reason } = {}) {
  const body = {};
  if (reason) body.reason = reason;
  const r = await client.post(
    `/api/reconciliation/${encodeURIComponent(id)}/reopen`,
    body,
  );
  return unwrap(r);
}

/**
 * POST /api/reconciliation/:id/lock — OWNER only.
 * `reason` is REQUIRED. 400 if !COMPLETED or already locked.
 *
 * Returns `{ reconciliation, lock, status: 'locked' }`.
 */
export async function lockReconciliation(id, { reason }) {
  const r = await client.post(
    `/api/reconciliation/${encodeURIComponent(id)}/lock`,
    { reason },
  );
  return unwrap(r);
}

// ── Statement import / export / parse ────────────────────────────────────

/**
 * POST /api/reconciliation/:id/import-statement — OWNER + ACCOUNTANT.
 * 403 if locked, 400 if COMPLETED.
 *
 * Returns `{ imported, duplicateSkipped, reconciliation }`.
 *
 * @param {string} id
 * @param {{items: Array, filename: string}} body
 */
export async function importStatement(id, { items, filename }) {
  const r = await client.post(
    `/api/reconciliation/${encodeURIComponent(id)}/import-statement`,
    { items, filename },
  );
  return unwrap(r);
}

/**
 * GET /api/reconciliation/:id/export?format=csv — all 4 roles.
 *
 * Returns `{ csvText, filename, rowCount }`. Caller builds a Blob and
 * triggers the download.
 */
export async function exportReconciliationCsv(id) {
  const r = await client.get(
    `/api/reconciliation/${encodeURIComponent(id)}/export`,
    { params: { format: 'csv' } },
  );
  return unwrap(r);
}

/**
 * POST /api/reconciliation/parse-statement — OWNER + ACCOUNTANT.
 * Pure function; no reconciliation session is mutated.
 *
 * Returns `{ items, warnings, errors, formatUsed: { id, bankCode,
 * bankName, formatVersion } }`.
 *
 * @param {{csvText: string, bankFormatId?: string}} body
 */
export async function parseStatement({ csvText, bankFormatId } = {}) {
  const body = { csvText };
  if (bankFormatId) body.bankFormatId = bankFormatId;
  const r = await client.post('/api/reconciliation/parse-statement', body);
  return unwrap(r);
}

// ── Decision endpoints ───────────────────────────────────────────────────

/**
 * POST /api/reconciliation/:id/exceptions/:excId/resolve — OWNER + ACCOUNTANT.
 * 400 if already resolved, 403 if locked.
 *
 * @param {string} id
 * @param {string} excId
 * @param {{resolution: string}} body  (1..500 chars)
 */
export async function resolveException(id, excId, { resolution }) {
  const r = await client.post(
    `/api/reconciliation/${encodeURIComponent(id)}/exceptions/${encodeURIComponent(
      excId,
    )}/resolve`,
    { resolution },
  );
  return unwrap(r);
}

/**
 * POST /api/reconciliation/:id/suggestions/:suggId/confirm — OWNER + ACCOUNTANT.
 * Promotes PENDING Suggestion to Match. 400 if !PENDING, 403 if locked.
 *
 * Returns `{ suggestion, confirmed: true, match }`.
 */
export async function confirmSuggestion(id, suggId) {
  const r = await client.post(
    `/api/reconciliation/${encodeURIComponent(id)}/suggestions/${encodeURIComponent(
      suggId,
    )}/confirm`,
    {},
  );
  return unwrap(r);
}

/**
 * POST /api/reconciliation/:id/suggestions/:suggId/dismiss — OWNER + ACCOUNTANT.
 * Sets status=DISMISSED. Aminah negative-training signal.
 *
 * @param {string} id
 * @param {string} suggId
 * @param {{reason?: string}} body  (reason max 500 chars)
 */
export async function dismissSuggestion(id, suggId, { reason } = {}) {
  const body = {};
  if (reason) body.reason = reason;
  const r = await client.post(
    `/api/reconciliation/${encodeURIComponent(id)}/suggestions/${encodeURIComponent(
      suggId,
    )}/dismiss`,
    body,
  );
  return unwrap(r);
}

/**
 * POST /api/reconciliation/:id/create-journal-entry — WALL-GATED.
 * OWNER + ACCOUNTANT. 403 if locked. 400 on unknown AccountRole,
 * unbalanced amounts, or period closed.
 *
 * Returns `{ journalEntryId, journalEntry, exception? }`.
 *
 * The server resolves `debitRole` / `creditRole` (AccountRole strings)
 * to Account.id via `resolveLineAccountRefs`. The client NEVER passes a
 * raw accountId — that's the wall gate.
 *
 * @param {string} id
 * @param {{bankItemId:string, debitRole:string, creditRole:string,
 *          amountKwd:string, memo?:string, exceptionId?:string}} body
 */
export async function createReconciliationJournalEntry(
  id,
  { bankItemId, debitRole, creditRole, amountKwd, memo, exceptionId } = {},
) {
  const body = { bankItemId, debitRole, creditRole, amountKwd };
  if (memo !== undefined && memo !== null && memo !== '') body.memo = memo;
  if (exceptionId) body.exceptionId = exceptionId;
  const r = await client.post(
    `/api/reconciliation/${encodeURIComponent(id)}/create-journal-entry`,
    body,
  );
  return unwrap(r);
}
