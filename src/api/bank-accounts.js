/**
 * Bank Accounts API module — read-only surface (Track B Dispatch 4, 2026-04-20).
 *
 * Backend endpoints (all 4 roles):
 *   GET /api/banking/accounts
 *     → [{ id, accountId, accountName, accountCode, bankName,
 *          accountNumberMasked, accountType, currency, balance,
 *          lastUpdated, accentColor }]
 *   GET /api/banking/accounts/:id/statement?range=month|quarter|year|all&from?&to?
 *     → [{ id, postedAt, description, reference, debitKwd, creditKwd,
 *          runningBalanceKwd, journalEntryId }] ordered postedAt ASC
 *   GET /api/banking/accounts/:id/summary?range=...
 *     → { openingBalanceKwd, closingBalanceKwd, inflowKwd, outflowKwd,
 *         txCount, currency }
 *
 * Calendar-window semantics (HASEEB-148 hotfix, 2026-04-20):
 *   month   → current calendar month (1st → last day UTC)
 *   quarter → current calendar quarter (Q1 Jan-Mar, …)
 *   year    → current calendar year (Jan 1 → Dec 31)
 *   all     → all POSTED history, no bounds
 *   explicit from/to ISO overrides. from > to → 400.
 *
 * Empty-list caveat (HASEEB-147):
 *   Until ops seeds `BankAccount` rows, GET /api/banking/accounts returns
 *   []. The screen handles this with an informative empty state.
 *
 * Shape adapters: the live endpoints return backend-native field names
 * (balance as Decimal-string, debitKwd/creditKwd split, postedAt, etc.).
 * The existing BankAccountsScreen + BankAccountCard + BankStatementTable
 * components were built against the mockEngine shape (currentBalance,
 * signed amount, date, categorization object). The mappers below
 * translate backend → UI shape so the consumer code stays untouched.
 *
 * Errors are normalised by client.js into `{ ok:false, status, code, message }`
 * and surface to callers — the screen decides whether to toast.
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

// ── Shape adapters ─────────────────────────────────────────────────────────

function toNumber(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Map a backend account row → UI account shape.
 *
 *   backend: { id, accountId, accountName, accountCode, bankName,
 *              accountNumberMasked, accountType, currency, balance,
 *              lastUpdated, accentColor }
 *   UI:      { id, bankName, accountName, accountNumberMasked, accountType,
 *              currency, currentBalance, availableBalance, mtdInflow,
 *              mtdOutflow, lastUpdated, status, accentColor }
 *
 * mtdInflow / mtdOutflow are not returned by the list endpoint. The UI's
 * account card shows them but the summary strip (which DOES hit the
 * per-account month summary endpoint) is the authoritative source. We
 * map to 0 here and the card renders `+0.000 / -0.000` as a sensible
 * fallback. A future dispatch can parallel-fetch per-account month
 * summaries if the card needs live MTD figures.
 */
function mapAccount(raw) {
  if (!raw) return null;
  return {
    id: raw.id,
    accountId: raw.accountId,
    bankName: raw.bankName,
    accountName: raw.accountName,
    accountCode: raw.accountCode,
    accountNumberMasked: raw.accountNumberMasked,
    accountType: raw.accountType,
    currency: raw.currency || 'KWD',
    currentBalance: toNumber(raw.balance),
    availableBalance: toNumber(raw.balance),
    mtdInflow: 0,
    mtdOutflow: 0,
    lastUpdated: raw.lastUpdated,
    status: 'active',
    // accentColor is nullable in the backend; default to the primary
    // accent (teal) so BankAccountCard's `borderInlineStart` CSS always
    // resolves to a valid color.
    accentColor: raw.accentColor || '#00A684',
  };
}

/**
 * Map a backend statement row → UI transaction shape.
 *
 *   backend: { id, postedAt, description, reference, debitKwd, creditKwd,
 *              runningBalanceKwd, journalEntryId }
 *   UI:      { id, date, description, reference, amount (signed),
 *              runningBalance, categorization: { method, category, ruleId,
 *              journalEntryId }, type }
 *
 * Sign convention: from the tenant's (account holder's) perspective the
 * backend ledger DEBIT to the bank asset account is an inflow (positive
 * UI amount). A ledger CREDIT to the bank asset is an outflow (negative).
 * This matches how the mockEngine signs amount: credits in the colloquial
 * "money came in" sense are positive.
 *
 * The backend statement payload does not include a categorization object
 * (no rule-engine integration on the banking statement endpoint yet — that
 * lives on the TransactionMatch/ReconciliationQueue surface). We emit a
 * neutral MANUAL categorization so the row's confidence pill renders as
 * "MANUAL" without pretending the transaction was AI-categorised.
 */
function mapStatementRow(raw) {
  if (!raw) return null;
  const debit = toNumber(raw.debitKwd);
  const credit = toNumber(raw.creditKwd);
  const amount = debit - credit;
  return {
    id: raw.id,
    accountId: raw.accountId || null,
    date: raw.postedAt,
    description: raw.description || '',
    reference: raw.reference || '',
    amount: Number(amount.toFixed(3)),
    type: amount >= 0 ? 'credit' : 'debit',
    runningBalance: toNumber(raw.runningBalanceKwd),
    categorization: {
      method: 'MANUAL',
      category: null,
      ruleId: null,
      journalEntryId: raw.journalEntryId || null,
    },
  };
}

/**
 * Map a backend summary → UI summary shape.
 *
 *   backend: { openingBalanceKwd, closingBalanceKwd, inflowKwd,
 *              outflowKwd, txCount, currency }
 *   UI:      { openingBalance, closingBalance, totalInflow, totalOutflow,
 *              transactionCount, categorizationBreakdown }
 *
 * The "Kwd" suffix is a backend naming artifact; the numeric values are
 * denominated in the account's currency (summary.currency). We strip the
 * suffix for the UI shape. categorizationBreakdown is not provided by the
 * backend; we emit empty counts so the UI renders a zero-breakdown block.
 */
function mapSummary(raw) {
  if (!raw) return null;
  return {
    openingBalance: toNumber(raw.openingBalanceKwd),
    closingBalance: toNumber(raw.closingBalanceKwd),
    totalInflow: toNumber(raw.inflowKwd),
    totalOutflow: toNumber(raw.outflowKwd),
    transactionCount: Number(raw.txCount || 0),
    currency: raw.currency || 'KWD',
    categorizationBreakdown: { RULE: 0, PATTERN: 0, AI: 0, MANUAL: 0, PENDING: 0 },
  };
}

// ── HTTP wrappers ──────────────────────────────────────────────────────────

/**
 * List all bank accounts visible to the current tenant. All 4 roles.
 *
 * Returns an array (possibly empty — see HASEEB-147 empty-list caveat).
 * The screen handles the empty case with an informative "ops will finish
 * onboarding shortly" empty state.
 */
export async function listBankAccounts() {
  const r = await client.get('/api/banking/accounts');
  const data = unwrap(r);
  if (!Array.isArray(data)) return [];
  return data.map(mapAccount).filter(Boolean);
}

/**
 * Fetch the statement for a single account. All 4 roles.
 *
 * @param {string} id Bank account id (primary key, not accountCode)
 * @param {{range?: 'month'|'quarter'|'year'|'all', from?: string, to?: string}} opts
 *   range defaults to 'month' (calendar month). from/to ISO dates override.
 *   Caller must validate from <= to; a 400 comes back otherwise.
 *
 * Returns an array of UI-shaped transaction rows ordered postedAt ASC.
 */
export async function getBankAccountStatement(id, opts = {}) {
  if (!id) throw new Error('getBankAccountStatement: id is required');
  const params = {};
  if (opts.range) params.range = opts.range;
  if (opts.from) params.from = opts.from;
  if (opts.to) params.to = opts.to;
  const r = await client.get(
    `/api/banking/accounts/${encodeURIComponent(id)}/statement`,
    { params }
  );
  const data = unwrap(r);
  if (!Array.isArray(data)) return [];
  // Attach accountId on each row (not in backend payload but useful for
  // downstream JE lookup) and map shape.
  return data.map((row) => {
    const mapped = mapStatementRow(row);
    if (mapped) mapped.accountId = id;
    return mapped;
  }).filter(Boolean);
}

/**
 * Fetch the summary (opening/closing/inflow/outflow/tx-count) for a
 * single account over the range window. All 4 roles.
 *
 * @param {string} id Bank account id
 * @param {{range?: ..., from?: string, to?: string}} opts  Same semantics
 *   as getBankAccountStatement.
 */
export async function getBankAccountSummary(id, opts = {}) {
  if (!id) throw new Error('getBankAccountSummary: id is required');
  const params = {};
  if (opts.range) params.range = opts.range;
  if (opts.from) params.from = opts.from;
  if (opts.to) params.to = opts.to;
  const r = await client.get(
    `/api/banking/accounts/${encodeURIComponent(id)}/summary`,
    { params }
  );
  const data = unwrap(r);
  return mapSummary(data);
}
