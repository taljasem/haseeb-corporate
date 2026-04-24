/**
 * Business Pulse composite API module — HASEEB-401 D6 B5 (2026-04-24).
 *
 * Client-side composite readers for the Owner + CFO dashboards. Per
 * architect Q6 on the 2026-04-24 inventory memo: "compose client-side
 * from already-wired sources, not purpose-built backend endpoints".
 *
 * Two entries:
 *   • getBusinessPulse()  — OwnerTodayScreen + QuarterlyKPIScreen.
 *       Shape: {
 *         revenue:   { current, prior, percentChange },
 *         expenses:  { current, prior, percentChange },
 *         netIncome: { current, prior, percentChange,
 *                      grossMargin, operatingMargin },
 *         cash:      { total, accountCount, subtext },
 *       }
 *       Sources:
 *         - revenue / expenses / netIncome → `reportsApi.getIncomeStatement`
 *         - cash total                    → `bankAccountsApi.listBankAccounts`
 *           (USD converted at the 3.28 KWD/USD rate the mock used — same
 *            constant preserved so the composed total is consistent with
 *            the legacy mock computation; a future dispatch can swap in
 *            the live CBK rate from `cbkRatesApi.getCbkRate`).
 *
 *   • getCashPosition() — QuarterlyKPIScreen.
 *       Shape: {
 *         total: number,
 *         accounts: [{ name, balance, currency }],
 *         asOf: ISO string,
 *       }
 *       Sources: same `listBankAccounts` feed, reshaped to the mock's
 *       compact { name, balance, currency } rows. Total is the KWD-
 *       converted sum (same FX constant as getBusinessPulse).
 *
 * FX rate note (FX_USD_KWD = 3.28):
 *   The legacy mock used 3.28 KWD/USD as a hardcoded constant (see
 *   mockEngine.getBusinessPulse). Preserving it here means LIVE-mode
 *   totals match MOCK-mode totals for the same underlying account set.
 *   A production-grade enhancement would fetch the latest CBK rate via
 *   `cbkRatesApi.listCbkRates()` and use the most-recent USD row; the
 *   follow-up ticket is tracked outside this dispatch.
 *
 * Error handling:
 *   Each read is wrapped in a `Promise.all` with a fail-soft catch —
 *   if the income-statement fetch fails, revenue / expenses / netIncome
 *   degrade to zeros rather than crashing the landing screen. Same for
 *   the bank-accounts fetch. This matches the "dashboard never crashes"
 *   contract of the Owner + CFO composite readers.
 */
import * as reportsApi from './reports';
import * as bankAccountsApi from './bank-accounts';

const FX_USD_KWD = 3.28;

function findSection(statement, name) {
  if (!statement || !Array.isArray(statement.sections)) return null;
  return statement.sections.find((s) => s && s.name === name) || null;
}

function pct(curr, prior) {
  if (prior === 0 || prior == null) return null;
  return Number((((curr - prior) / Math.abs(prior)) * 100).toFixed(1));
}

function toNum(v) {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Normalise a bank-accounts response row into { name, balance, currency }.
 * The live `listBankAccounts` shape (from src/api/bank-accounts.js
 * `mapAccount`) is { id, bankName, accountName, currency, currentBalance, … }.
 */
function compactAccount(acc) {
  if (!acc) return null;
  const name = acc.accountName || acc.bankName || acc.name || 'Account';
  const balance = toNum(acc.currentBalance ?? acc.balance);
  const currency = acc.currency || 'KWD';
  return { name, balance, currency };
}

function kwdTotal(accounts) {
  if (!Array.isArray(accounts)) return 0;
  return accounts.reduce((sum, a) => {
    const bal = toNum(a?.currentBalance ?? a?.balance);
    const rate = (a?.currency || 'KWD') === 'USD' ? FX_USD_KWD : 1;
    return sum + bal * rate;
  }, 0);
}

/**
 * getBusinessPulse — composite.
 *
 * Legacy mock signature: () → { revenue, expenses, netIncome, cash }.
 * Live composition uses getIncomeStatement + listBankAccounts.
 */
export async function getBusinessPulse() {
  const [isRes, accountsRes] = await Promise.allSettled([
    reportsApi.getIncomeStatement(),
    bankAccountsApi.listBankAccounts(),
  ]);

  const is = isRes.status === 'fulfilled' ? isRes.value : null;
  const accounts = accountsRes.status === 'fulfilled' && Array.isArray(accountsRes.value)
    ? accountsRes.value
    : [];

  const revenue = findSection(is, 'REVENUE');
  const cogs = findSection(is, 'COST OF GOODS SOLD');
  const opex = findSection(is, 'OPERATING EXPENSES');
  const netIncome = findSection(is, 'NET INCOME');

  const revCurr = toNum(revenue?.subtotal?.current);
  const revPrior = toNum(revenue?.subtotal?.prior);
  const cogsCurr = toNum(cogs?.subtotal?.current);
  const cogsPrior = toNum(cogs?.subtotal?.prior);
  const opexCurr = toNum(opex?.subtotal?.current);
  const opexPrior = toNum(opex?.subtotal?.prior);
  const expCurr = Number((cogsCurr + opexCurr).toFixed(3));
  const expPrior = Number((cogsPrior + opexPrior).toFixed(3));
  const niCurr = toNum(netIncome?.current);
  const niPrior = toNum(netIncome?.prior);

  const grossMargin = revCurr
    ? Number((((revCurr - cogsCurr) / revCurr) * 100).toFixed(1))
    : 0;
  const operatingMargin = revCurr
    ? Number((((revCurr - cogsCurr - opexCurr) / revCurr) * 100).toFixed(1))
    : 0;

  const cashTotal = kwdTotal(accounts);

  return {
    revenue: {
      current: revCurr,
      prior: revPrior,
      percentChange: pct(revCurr, revPrior),
    },
    expenses: {
      current: expCurr,
      prior: expPrior,
      percentChange: pct(expCurr, expPrior),
    },
    netIncome: {
      current: niCurr,
      prior: niPrior,
      percentChange: pct(niCurr, niPrior),
      grossMargin,
      operatingMargin,
    },
    cash: {
      total: Number(cashTotal.toFixed(3)),
      accountCount: accounts.length,
      subtext: `across ${accounts.length} bank account${accounts.length === 1 ? '' : 's'}`,
    },
  };
}

/**
 * getCashPosition — composite.
 *
 * Legacy mock signature: () → { total, accounts: [{name, balance,
 * currency}], asOf }.
 */
export async function getCashPosition() {
  let accounts = [];
  try {
    const live = await bankAccountsApi.listBankAccounts();
    accounts = Array.isArray(live) ? live : [];
  } catch {
    accounts = [];
  }

  const compact = accounts.map(compactAccount).filter(Boolean);
  const total = kwdTotal(accounts);

  return {
    total: Number(total.toFixed(3)),
    accounts: compact,
    asOf: new Date().toISOString(),
  };
}
