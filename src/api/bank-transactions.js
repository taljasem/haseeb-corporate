/**
 * Bank Transactions API module — HASEEB-396 B1 wire-up (2026-04-24).
 *
 * Backs the BankTransactionsScreen bulk-operations surface shipped in the
 * backend `/api/bank-transactions` module. 6 HTTP endpoints wrap 8 engine
 * entries; two engine entries (`getBankTransactionsSorted`,
 * `createRuleFromTransactions`) do client-side derivation over the live
 * list endpoint rather than a dedicated backend call — see per-function
 * comments for rationale.
 *
 * Backend endpoints (from `src/modules/bank-transactions/`):
 *   GET    /api/bank-transactions                     — filtered list
 *   GET    /api/bank-transactions/export              — CSV text
 *   POST   /api/bank-transactions/bulk-categorize     — staging metadata
 *   POST   /api/bank-transactions/bulk-assign         — assignee
 *   POST   /api/bank-transactions/bulk-mark-reviewed  — reviewed flag
 *   POST   /api/bank-transactions/rule-from-selection — (NOT called; see
 *                                                       createRuleFromTransactions)
 *
 * Role gates (server-side): READS = OWNER/ACCOUNTANT/VIEWER/AUDITOR;
 * WRITES = OWNER/ACCOUNTANT. Enforced via requireRole() — no client-side
 * checks.
 *
 * ─────────────────────────────────────────────────────────────────────
 * Shape-adapter summary (backend → UI)
 * ─────────────────────────────────────────────────────────────────────
 * The backend returns a minimal `FilteredListRow` shape:
 *   { id, statementId, parsedDate, parsedDescription, parsedAmount,
 *     categoryId, accountId, confidenceScore, categorySource,
 *     categorizedAt, reviewedAt, reviewerUserId }
 *
 * The existing UI (BankTransactionsScreen + BankTransactionRow +
 * BankTransactionDetail) was authored against the mockEngine shape:
 *   { id, date, merchant, description, amount, currency, source, terminal,
 *     categoryCode, assigneeId, reviewed, engineSuggestion:
 *     { account, accountCode, confidence, reasoning } }
 *
 * mapRow() below translates backend → UI so the screen/row/detail stay
 * untouched. Fields not provided by the backend (source, terminal,
 * engineSuggestion reasoning prose) resolve to sensible defaults. A
 * future backend dispatch can expand the list shape to carry rule/AI
 * provenance; until then the UI renders neutral values in those columns.
 *
 * ─────────────────────────────────────────────────────────────────────
 * P0 context (dispatch HASEEB-396)
 * ─────────────────────────────────────────────────────────────────────
 * `bulkCategorizeTransactions` and `bulkAssignTransactions` were on the
 * WRITE_THROW set in engine/index.js — they threw "Not implemented" in
 * LIVE mode and crashed BankTransactionsScreen's bulk action bar. This
 * module closes that gap; the engine router removes both names from
 * WRITE_THROW as part of the same change.
 */
import client from './client';
import { getAccountsFlat } from './accounts';

function unwrap(response) {
  if (response && response.data && typeof response.data === 'object') {
    if ('data' in response.data && 'success' in response.data) {
      return response.data.data;
    }
    if ('data' in response.data) return response.data.data;
    return response.data;
  }
  return response?.data;
}

// ─────────────────────────────────────────────────────────────────────
// Shape adapters
// ─────────────────────────────────────────────────────────────────────

function toNumber(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Build the engineSuggestion field for a backend row. The backend's list
 * endpoint doesn't surface the categorisation source prose the UI's
 * EngineConfidencePill renders, so we derive a compact shape from
 * categorySource + confidenceScore and emit neutral fallback values.
 *
 *   categorySource='USER_OVERRIDE'    → confidence='RULE'     (hardened)
 *   categorySource='LLM_T4_FALLBACK'  → confidence='NONE'     (needs review)
 *   categorySource present, any other → confidence='AI'       (inferred)
 *   categorySource null/missing       → confidence='NONE'     (uncategorised)
 */
function buildEngineSuggestion(row, accountLookup) {
  const source = row.categorySource || null;
  const acctCode = row.accountId && accountLookup
    ? accountLookup.get(row.accountId) || ''
    : '';

  let confidence = 'NONE';
  if (source === 'USER_OVERRIDE') confidence = 'RULE';
  else if (source === 'LLM_T4_FALLBACK') confidence = 'NONE';
  else if (source) confidence = 'AI';

  return {
    account: '',
    accountCode: acctCode,
    confidence,
    reasoning: '',
  };
}

/**
 * Map a backend `FilteredListRow` → UI transaction shape.
 *
 * `accountLookup` is an optional Map<accountId, accountCode> used to
 * backfill `categoryCode` (the UI consumes the CoA code string, not the
 * backend's UUID). When the lookup is absent the UI just sees an empty
 * categoryCode — still renders.
 */
function mapRow(row, accountLookup) {
  if (!row) return null;
  const amount = toNumber(row.parsedAmount);
  return {
    id: row.id,
    statementId: row.statementId,
    date: row.parsedDate,
    merchant: row.parsedDescription || '',
    description: row.parsedDescription || '',
    amount,
    currency: 'KWD', // backend lines are already in KWD per precision contract
    source: '',
    terminal: '',
    categoryCode: row.accountId && accountLookup
      ? accountLookup.get(row.accountId) || ''
      : '',
    categoryId: row.categoryId || null,
    accountId: row.accountId || null,
    assigneeId: row.reviewerUserId || null,
    reviewed: row.reviewedAt != null,
    reviewedAt: row.reviewedAt || null,
    confidenceScore: row.confidenceScore,
    categorySource: row.categorySource,
    engineSuggestion: buildEngineSuggestion(row, accountLookup),
  };
}

/**
 * Build a Map<accountId (uuid), accountCode (e.g. "6200")> from the flat
 * chart of accounts. Used by mapRow() to surface categoryCode to the UI.
 * Fail-soft: if the account lookup fails we continue with an empty map
 * (the UI renders empty categoryCode strings, no crash).
 */
async function buildAccountLookup() {
  try {
    const accounts = await getAccountsFlat();
    const map = new Map();
    for (const a of accounts || []) {
      const id = a?.raw?.id;
      const code = a?.code;
      if (id && code) map.set(id, code);
    }
    return map;
  } catch (err) {
    console.warn('[bank-transactions] account lookup failed; categoryCode will be blank', err);
    return new Map();
  }
}

/**
 * Resolve a CoA code (e.g. "6200") → account UUID via the flat CoA.
 * Returns `null` when the code isn't found. Callers treat this as a
 * validation error and surface a bilingual message to the UI.
 */
async function resolveAccountIdFromCode(code) {
  if (!code) return null;
  try {
    const accounts = await getAccountsFlat();
    const hit = (accounts || []).find((a) => a?.code === code || a?.raw?.code === code);
    return hit?.raw?.id || null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────
// HTTP wrappers — GET
// ─────────────────────────────────────────────────────────────────────

/**
 * Fetch the full pending bank-transactions list. Wraps
 * `GET /api/bank-transactions` with no status filter. The UI applies
 * additional client-side filtering (category, assignee, search).
 */
export async function getBankTransactionsPending() {
  const r = await client.get('/api/bank-transactions', {
    params: { limit: 500 },
  });
  const data = unwrap(r);
  const rows = Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];
  const lookup = await buildAccountLookup();
  return rows.map((row) => mapRow(row, lookup)).filter(Boolean);
}

/**
 * Filtered list. The existing UI passes `filterByAssignee` (a user id
 * string) when the screen is being used to show one junior's workload.
 * The backend list endpoint doesn't support an assignee filter directly,
 * so we fetch the full list and filter by `reviewerUserId` client-side
 * (inventory memo Q8: client-side-filter pattern is the accepted approach
 * for these narrow projections over the wired list endpoint).
 */
export async function getFilteredBankTransactions(filterByAssignee = null) {
  const rows = await getBankTransactionsPending();
  if (!filterByAssignee) return rows;
  return rows.filter((tx) => tx.assigneeId === filterByAssignee);
}

/**
 * Sorted list. The existing UI imports this name but does NOT call it
 * today — sorting is applied in the component render path. We still wire
 * it to the live endpoint so MOCK/LIVE parity holds for any future
 * caller. Sort is applied client-side over the live list.
 */
export async function getBankTransactionsSorted(
  _accountId,
  filters = {},
  sort = { field: 'date', direction: 'desc' }
) {
  // The `_accountId` argument is a mock holdover — the live list endpoint
  // doesn't scope by bank account (filters apply per tenant). We ignore
  // it here. A future HASEEB-4xx can add `bankAccountId` to the filter
  // schema if the UI needs per-account bank-tx views.
  const rows = await getBankTransactionsPending();

  // Client-side filter (subset of backend filter schema; the full filter
  // surface is available via the list endpoint's query params but the
  // mock's `filters` arg is informal).
  const q = (filters.search || filters.q || '').toLowerCase();
  let result = rows;
  if (q) {
    result = result.filter((t) =>
      ((t.description || t.merchant || '') + ' ' + (t.terminal || '')).toLowerCase().includes(q)
    );
  }

  const dir = sort?.direction === 'asc' ? 1 : -1;
  const field = sort?.field || 'date';
  result = [...result].sort((a, b) => {
    switch (field) {
      case 'date':
        return (new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()) * dir;
      case 'amount':
        return (Math.abs(a.amount || 0) - Math.abs(b.amount || 0)) * dir;
      case 'merchant':
      case 'description':
        return (a.merchant || a.description || '').localeCompare(b.merchant || b.description || '') * dir;
      case 'category':
        return (a.categoryCode || '').localeCompare(b.categoryCode || '') * dir;
      case 'status': {
        const av = a.reviewed ? 2 : a.categoryCode ? 1 : 0;
        const bv = b.reviewed ? 2 : b.categoryCode ? 1 : 0;
        return (av - bv) * dir;
      }
      default:
        return 0;
    }
  });
  return result;
}

/**
 * Export selected bank transactions as CSV text. The backend's
 * `/export` endpoint exports by filter, not by id list — the BT screen
 * selects N arbitrary rows and asks for "just these N" which the backend
 * schema doesn't model. We resolve by fetching the full list (capped at
 * 500 via the list endpoint) and generating CSV client-side when an id
 * list is provided. This preserves the mock behaviour exactly (screen
 * calls `bulkExport(checkedIds)`) while using live data.
 *
 * When `txIds` is empty/undefined we fall through to the live
 * `/api/bank-transactions/export` endpoint with optional filters, so
 * "export everything matching current filters" hits the proper backend
 * streaming path.
 *
 * Returns `{ filename, csvText, rowCount }` — identical to the mock
 * shape. Screen uses Blob/URL.createObjectURL to trigger download.
 */
export async function exportBankTransactionsCSV(txIds, filters = {}) {
  const ids = Array.isArray(txIds) ? txIds : [];

  if (ids.length === 0) {
    // No selection → call backend export directly with whatever filters
    // the caller passed through. Backend owns CSV formatting.
    const params = {};
    if (filters.status) params.status = filters.status;
    if (filters.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters.dateTo) params.dateTo = filters.dateTo;
    if (filters.amountMin !== undefined) params.amountMin = String(filters.amountMin);
    if (filters.amountMax !== undefined) params.amountMax = String(filters.amountMax);
    if (filters.descriptionContains) params.descriptionContains = filters.descriptionContains;
    const r = await client.get('/api/bank-transactions/export', {
      params,
      // Backend sets Content-Type: text/csv; axios still receives the
      // text as a string because our default client expects JSON —
      // override via transformResponse to preserve raw text.
      responseType: 'text',
      transformResponse: [(data) => data],
    });
    // axios gives us raw CSV; axios `r.data` is the string body.
    const csvText = typeof r?.data === 'string' ? r.data : String(r?.data ?? '');
    const filename = `bank-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    // rowCount = number of newlines minus header
    const rowCount = csvText ? Math.max(0, csvText.split('\n').filter(Boolean).length - 1) : 0;
    return { filename, csvText, rowCount };
  }

  // Selection-based export — fetch live list, filter, emit CSV locally.
  const rows = await getBankTransactionsPending();
  const selected = rows.filter((t) => ids.includes(t.id));
  const header = ['Date', 'Merchant', 'Amount', 'Currency', 'Source', 'Terminal', 'Category', 'Assignee', 'Reviewed'];
  const body = selected.map((tx) => [
    tx.date || '',
    tx.merchant || tx.description || '',
    toNumber(tx.amount).toFixed(3),
    tx.currency || 'KWD',
    tx.source || '',
    tx.terminal || '',
    tx.categoryCode || '',
    tx.assigneeId || '',
    tx.reviewed ? 'yes' : 'no',
  ]);
  const escapeCell = (cell) => {
    const s = String(cell || '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const csvText = [header, ...body]
    .map((row) => row.map(escapeCell).join(','))
    .join('\n');
  const filename = `bank-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  return { filename, csvText, rowCount: selected.length };
}

// ─────────────────────────────────────────────────────────────────────
// HTTP wrappers — POST (writes)
// ─────────────────────────────────────────────────────────────────────

/**
 * Bilingual error factory used when a precondition for the write call
 * fails client-side (typically: CoA code can't be resolved to an account
 * UUID). Shape mirrors the client.js error-normalisation contract so
 * calling screens can render the message directly.
 */
function bilingualError(messageEn, messageAr) {
  const err = new Error(messageEn);
  err.ok = false;
  err.code = 'CLIENT_ERROR';
  err.status = 400;
  err.message = messageEn;
  err.messageAr = messageAr;
  return err;
}

/**
 * Bulk-categorise the selected staging lines.
 *
 * Mock signature:  (txIds, categoryCode, user?)
 * Backend shape:   { statementLineIds, categoryId, accountId }
 *
 * Adapter: resolve `categoryCode` → `accountId` via the live CoA flat
 * endpoint. Backend treats `categoryId` as a free-form string up to
 * 128 chars; we pass the same code string through as categoryId so the
 * staging rows retain a human-readable tag alongside the account UUID.
 * The `user` arg is ignored — the backend reads the authenticated
 * userId from `req.auth`.
 *
 * Returns the mock-compatible shape `{ updated, skipped, categoryCode }`
 * so the existing toast ("Applied to {n} transactions") works unchanged.
 */
// eslint-disable-next-line no-unused-vars
export async function bulkCategorizeTransactions(txIds, categoryCode, _user) {
  const ids = Array.isArray(txIds) ? txIds : [];
  if (ids.length === 0) {
    throw bilingualError(
      'No transactions selected for categorisation.',
      'لم يتم تحديد أي معاملات للتصنيف.',
    );
  }
  const accountId = await resolveAccountIdFromCode(categoryCode);
  if (!accountId) {
    throw bilingualError(
      `Category code "${categoryCode}" not found in the chart of accounts.`,
      `رمز التصنيف "${categoryCode}" غير موجود في دليل الحسابات.`,
    );
  }
  const r = await client.post('/api/bank-transactions/bulk-categorize', {
    statementLineIds: ids,
    categoryId: String(categoryCode),
    accountId,
  });
  const data = unwrap(r) || {};
  return {
    updated: Number(data.updated || 0),
    skipped: Array.isArray(data.skipped) ? data.skipped.length : Number(data.skipped || 0),
    requested: Number(data.requested || ids.length),
    categoryCode,
  };
}

/**
 * Bulk-assign the selected staging lines to a reviewer. Mock accepted an
 * empty-string id to clear assignment; backend requires null. We map
 * accordingly.
 *
 * Mock signature:  (txIds, assigneeId, user?)
 * Backend shape:   { statementLineIds, reviewerUserId, note? }
 */
// eslint-disable-next-line no-unused-vars
export async function bulkAssignTransactions(txIds, assigneeId, _user) {
  const ids = Array.isArray(txIds) ? txIds : [];
  if (ids.length === 0) {
    throw bilingualError(
      'No transactions selected for assignment.',
      'لم يتم تحديد أي معاملات للإسناد.',
    );
  }
  const reviewerUserId = assigneeId === '' || assigneeId == null ? null : assigneeId;
  const r = await client.post('/api/bank-transactions/bulk-assign', {
    statementLineIds: ids,
    reviewerUserId,
  });
  const data = unwrap(r) || {};
  return {
    updated: Number(data.updated || 0),
    skipped: Array.isArray(data.skipped) ? data.skipped.length : Number(data.skipped || 0),
    requested: Number(data.requested || ids.length),
    assigneeId: reviewerUserId,
  };
}

/**
 * Bulk-mark the selected staging lines as reviewed.
 *
 * Mock signature:  (txIds, user?)
 * Backend shape:   { statementLineIds, reviewed }
 *
 * The mock always marked reviewed=true (no way to unmark). We preserve
 * that semantics — the backend schema allows `reviewed=false` but the UI
 * doesn't surface an "unmark" action today.
 */
// eslint-disable-next-line no-unused-vars
export async function bulkMarkTransactionsReviewed(txIds, _user) {
  const ids = Array.isArray(txIds) ? txIds : [];
  if (ids.length === 0) {
    throw bilingualError(
      'No transactions selected to mark as reviewed.',
      'لم يتم تحديد أي معاملات لوضع علامة مراجعة.',
    );
  }
  const r = await client.post('/api/bank-transactions/bulk-mark-reviewed', {
    statementLineIds: ids,
    reviewed: true,
  });
  const data = unwrap(r) || {};
  return {
    updated: Number(data.updated || 0),
    skipped: Array.isArray(data.skipped) ? data.skipped.length : Number(data.skipped || 0),
    requested: Number(data.requested || ids.length),
  };
}

/**
 * Derive a proposed rule from the selected transactions.
 *
 * IMPORTANT: this is intentionally NOT wired to the backend's
 * `POST /api/bank-transactions/rule-from-selection` endpoint — that
 * endpoint CREATES a LabelingRule immediately, but the existing UI flow
 * treats `createRuleFromTransactions` as an *inspection* step that
 * prefills the `NewCategorizationRuleModal`, and the modal then calls
 * `createCategorizationRule` separately when the user confirms. Wiring
 * this to the backend creator would produce a ghost rule every time a
 * user clicked "Create rule from selection" and then cancelled the modal
 * — not a correctness-preserving shape adapter.
 *
 * We instead fetch the live list, filter by selection, and derive the
 * proposal client-side. The computed output matches the mock's
 * `{ proposedRule: {...} }` shape exactly so the modal prefill logic is
 * unchanged.
 *
 * (Inventory memo Q8: client-side derivation over a wired read endpoint
 * is an acceptable wire pattern.)
 */
export async function createRuleFromTransactions(txIds) {
  const ids = Array.isArray(txIds) ? txIds : [];
  if (ids.length === 0) return { proposedRule: null };
  const rows = await getBankTransactionsPending();
  const selected = rows.filter((t) => ids.includes(t.id));
  if (selected.length === 0) return { proposedRule: null };

  // Category vote (mode over selected txs)
  const categoryCounts = {};
  for (const tx of selected) {
    const c = tx.categoryCode;
    if (c) categoryCounts[c] = (categoryCounts[c] || 0) + 1;
  }
  const topCategory =
    Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';

  // Shared-token pattern (longest frequent token across descriptions)
  const descs = selected
    .map((t) => (t.merchant || t.description || '').toLowerCase().trim())
    .filter(Boolean);
  let commonPattern = '';
  if (descs.length > 0) {
    const tokenCounts = {};
    for (const d of descs) {
      for (const tok of d.split(/\s+/).filter((t) => t.length > 3)) {
        tokenCounts[tok] = (tokenCounts[tok] || 0) + 1;
      }
    }
    const top = Object.entries(tokenCounts).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= Math.ceil(selected.length / 2)) commonPattern = top[0];
  }

  const amounts = selected.map((t) => Math.abs(Number(t.amount) || 0));
  return {
    proposedRule: {
      name: commonPattern ? `Auto: ${commonPattern}` : 'Auto: bulk rule',
      matchType: 'description_contains',
      matchValue: commonPattern || '',
      categoryCode: topCategory || '',
      amountRange: {
        min: amounts.length ? Math.min(...amounts) : 0,
        max: amounts.length ? Math.max(...amounts) : 0,
      },
      priority: 50,
      confidence: commonPattern ? 80 : 50,
      sourceTransactionCount: selected.length,
    },
  };
}
