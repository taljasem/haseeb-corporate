/**
 * Reports API module — financial statements.
 *
 * This is the biggest shape-adapter layer in Wave 2. The existing
 * FinancialStatementsScreen expects a very specific sectioned structure
 * (see mockEngine.js:2046 for the IS and :2117 for the BS), and the
 * Corporate API returns a different, more normalized shape.
 *
 * We adapt the API response into the mock shape at the module boundary so
 * the UI component stays unchanged.
 *
 * Mock shape for IS:
 *   {
 *     period: "March 2026",
 *     aminahNarration: "...",  // NOT generated in LIVE mode (see R1 in dashboard inventory)
 *     sections: [
 *       { name: "REVENUE",            lines: [...], subtotal: { label, current, prior } },
 *       { name: "COGS",               lines: [...], subtotal: {...} },
 *       { name: "GROSS PROFIT",       highlight: "teal"|"amber"|"red", current, prior },
 *       ...
 *       { name: "NET INCOME", highlight: ..., final: true, current, prior },
 *     ]
 *   }
 *
 * If the API response is not in the expected shape, we do our best to
 * coerce it. If the API returns zeroed-out data (empty tenant), the UI
 * will render "0.000 KWD" rows and should already show an empty-state
 * banner via our patch in FinancialStatementsScreen.
 */
import client from './client';

function unwrap(response) {
  if (response && response.data && typeof response.data === 'object') {
    if ('data' in response.data) return response.data.data;
    return response.data;
  }
  return response?.data;
}

function num(v) {
  const n = Number(v || 0);
  return Number.isFinite(n) ? Number(n.toFixed(3)) : 0;
}

function highlightFor(current, prior) {
  if (current < 0) return 'red';
  if (current >= (prior || 0)) return 'teal';
  return 'amber';
}

function periodLabelFromRange(from, to) {
  if (!from && !to) return '';
  try {
    const d = new Date(to || from);
    return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  } catch {
    return `${from || ''} — ${to || ''}`;
  }
}

function mapLineList(lines) {
  if (!Array.isArray(lines)) return [];
  return lines.map((l) => ({
    account: l.account || l.name || l.accountName || l.label || '',
    code: l.code || l.accountCode || '',
    current: num(l.current ?? l.amount ?? l.balance ?? 0),
    prior: num(l.prior ?? l.priorAmount ?? 0),
    change: num((l.current ?? l.amount ?? 0) - (l.prior ?? 0)),
    percentChange:
      l.prior && Number(l.prior) !== 0
        ? Number((((Number(l.current || 0) - Number(l.prior || 0)) / Math.abs(Number(l.prior || 1))) * 100).toFixed(1))
        : null,
  }));
}

// ── Period / date helpers ─────────────────────────────────────────
function rangeForPeriod(period) {
  // Accept strings that the existing FS screen passes: "month", "quarter",
  // "ytd", "custom" (we treat custom as current month for now).
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  if (period === 'quarter') {
    const qStart = Math.floor(m / 3) * 3;
    return {
      from: new Date(y, qStart, 1).toISOString().slice(0, 10),
      to: new Date(y, qStart + 3, 0).toISOString().slice(0, 10),
    };
  }
  if (period === 'ytd') {
    return {
      from: new Date(y, 0, 1).toISOString().slice(0, 10),
      to: new Date(y, 11, 31).toISOString().slice(0, 10),
    };
  }
  // Default: current month.
  return {
    from: new Date(y, m, 1).toISOString().slice(0, 10),
    to: new Date(y, m + 1, 0).toISOString().slice(0, 10),
  };
}

// ── Income Statement ──────────────────────────────────────────────
export async function getIncomeStatement(period = 'month') {
  const { from, to } = rangeForPeriod(period);
  const r = await client.get('/api/reports/income-statement', {
    params: { from, to },
  });
  const data = unwrap(r) || {};

  // Try a few common shapes.
  const revenueLines = mapLineList(data.revenue || data.revenues || data.revenueLines);
  const cogsLines = mapLineList(data.cogs || data.costOfGoodsSold || data.cogsLines);
  const opexLines = mapLineList(data.operatingExpenses || data.opex || data.expenses || data.operatingExpenseLines);
  const otherLines = mapLineList(data.otherIncome || data.other || []);

  const totalRev = revenueLines.reduce((s, l) => s + l.current, 0);
  const totalRevPrior = revenueLines.reduce((s, l) => s + l.prior, 0);
  const totalCogs = cogsLines.reduce((s, l) => s + l.current, 0);
  const totalCogsPrior = cogsLines.reduce((s, l) => s + l.prior, 0);
  const totalOpex = opexLines.reduce((s, l) => s + l.current, 0);
  const totalOpexPrior = opexLines.reduce((s, l) => s + l.prior, 0);

  const gross = num(totalRev - totalCogs);
  const grossPrior = num(totalRevPrior - totalCogsPrior);
  const opIncome = num(gross - totalOpex);
  const opIncomePrior = num(grossPrior - totalOpexPrior);
  const net = num(opIncome + otherLines.reduce((s, l) => s + l.current, 0));
  const netPrior = num(opIncomePrior + otherLines.reduce((s, l) => s + l.prior, 0));

  const sections = [
    { name: 'REVENUE', lines: revenueLines, subtotal: { label: 'Total Revenue', current: num(totalRev), prior: num(totalRevPrior) } },
    { name: 'COST OF GOODS SOLD', lines: cogsLines, subtotal: { label: 'Total COGS', current: num(totalCogs), prior: num(totalCogsPrior), negative: true } },
    { name: 'GROSS PROFIT', highlight: highlightFor(gross, grossPrior), current: gross, prior: grossPrior },
    { name: 'OPERATING EXPENSES', lines: opexLines, subtotal: { label: 'Total OpEx', current: num(totalOpex), prior: num(totalOpexPrior), negative: true } },
    { name: 'OPERATING INCOME', highlight: highlightFor(opIncome, opIncomePrior), current: opIncome, prior: opIncomePrior },
    ...(otherLines.length
      ? [{ name: 'OTHER INCOME/(EXPENSE)', lines: otherLines, subtotal: { label: 'Total Other', current: num(otherLines.reduce((s, l) => s + l.current, 0)), prior: num(otherLines.reduce((s, l) => s + l.prior, 0)) } }]
      : []),
    { name: 'NET INCOME', highlight: highlightFor(net, netPrior), final: true, current: net, prior: netPrior },
  ];

  return {
    period: data.period || periodLabelFromRange(from, to),
    aminahNarration: null, // not generated in LIVE mode
    sections,
  };
}

// ── Balance Sheet ─────────────────────────────────────────────────
export async function getBalanceSheet(period = 'month') {
  const { to } = rangeForPeriod(period);
  const r = await client.get('/api/reports/balance-sheet', {
    params: { as_of: to },
  });
  const data = unwrap(r) || {};

  const currentAssets = mapLineList(data.currentAssets || data.assets?.current || []);
  const fixedAssets = mapLineList(data.fixedAssets || data.assets?.fixed || []);
  const currentLiab = mapLineList(data.currentLiabilities || data.liabilities?.current || []);
  const longLiab = mapLineList(data.longTermLiabilities || data.liabilities?.longTerm || []);
  const equityLines = mapLineList(data.equity || data.equityLines || []);

  const totalCA = currentAssets.reduce((s, l) => s + l.current, 0);
  const totalCAPrior = currentAssets.reduce((s, l) => s + l.prior, 0);
  const totalFA = fixedAssets.reduce((s, l) => s + l.current, 0);
  const totalFAPrior = fixedAssets.reduce((s, l) => s + l.prior, 0);
  const totalCL = currentLiab.reduce((s, l) => s + l.current, 0);
  const totalCLPrior = currentLiab.reduce((s, l) => s + l.prior, 0);
  const totalLL = longLiab.reduce((s, l) => s + l.current, 0);
  const totalLLPrior = longLiab.reduce((s, l) => s + l.prior, 0);
  const totalEq = equityLines.reduce((s, l) => s + l.current, 0);
  const totalEqPrior = equityLines.reduce((s, l) => s + l.prior, 0);

  const totalAssets = num(totalCA + totalFA);
  const totalAssetsPrior = num(totalCAPrior + totalFAPrior);
  const totalLiab = num(totalCL + totalLL);
  const totalLiabPrior = num(totalCLPrior + totalLLPrior);

  const sections = [
    { name: 'ASSETS', isParent: true },
    { name: 'Current Assets', lines: currentAssets, subtotal: { label: 'Total Current Assets', current: num(totalCA), prior: num(totalCAPrior) } },
    ...(fixedAssets.length
      ? [{ name: 'Fixed Assets', lines: fixedAssets, subtotal: { label: 'Total Fixed Assets', current: num(totalFA), prior: num(totalFAPrior) } }]
      : []),
    { name: 'TOTAL ASSETS', highlight: 'teal', current: totalAssets, prior: totalAssetsPrior },
    { name: 'LIABILITIES', isParent: true },
    { name: 'Current Liabilities', lines: currentLiab, subtotal: { label: 'Total Current Liabilities', current: num(totalCL), prior: num(totalCLPrior) } },
    ...(longLiab.length
      ? [{ name: 'Long-term Liabilities', lines: longLiab, subtotal: { label: 'Total Long-term', current: num(totalLL), prior: num(totalLLPrior) } }]
      : []),
    { name: 'TOTAL LIABILITIES', highlight: 'amber', current: totalLiab, prior: totalLiabPrior },
    { name: 'EQUITY', isParent: true },
    { name: 'Equity Lines', lines: equityLines, subtotal: { label: 'Total Equity', current: num(totalEq), prior: num(totalEqPrior) } },
    { name: 'TOTAL LIABILITIES + EQUITY', highlight: 'teal', final: true, current: num(totalLiab + totalEq), prior: num(totalLiabPrior + totalEqPrior) },
  ];

  return {
    period: data.period || `As of ${to}`,
    aminahNarration: null,
    sections,
  };
}

// ── Cash Flow ─────────────────────────────────────────────────────
export async function getCashFlow(period = 'month') {
  const { from, to } = rangeForPeriod(period);
  const r = await client.get('/api/reports/cash-flow', {
    params: { from, to },
  });
  const data = unwrap(r) || {};

  const operating = mapLineList(data.operating || data.operatingActivities || []);
  const investing = mapLineList(data.investing || data.investingActivities || []);
  const financing = mapLineList(data.financing || data.financingActivities || []);

  const totalOp = operating.reduce((s, l) => s + l.current, 0);
  const totalInv = investing.reduce((s, l) => s + l.current, 0);
  const totalFin = financing.reduce((s, l) => s + l.current, 0);
  const net = num(totalOp + totalInv + totalFin);

  const sections = [
    { name: 'OPERATING ACTIVITIES', lines: operating, subtotal: { label: 'Net Cash from Operating', current: num(totalOp), prior: 0 } },
    ...(investing.length
      ? [{ name: 'INVESTING ACTIVITIES', lines: investing, subtotal: { label: 'Net Cash from Investing', current: num(totalInv), prior: 0 } }]
      : []),
    ...(financing.length
      ? [{ name: 'FINANCING ACTIVITIES', lines: financing, subtotal: { label: 'Net Cash from Financing', current: num(totalFin), prior: 0 } }]
      : []),
    { name: 'NET CHANGE IN CASH', highlight: highlightFor(net, 0), final: true, current: net, prior: 0 },
  ];

  return {
    period: data.period || periodLabelFromRange(from, to),
    aminahNarration: null,
    sections,
  };
}

// Alias to match the mockEngine name.
export const getCashFlowStatement = getCashFlow;

// ── Trial Balance ─────────────────────────────────────────────────
export async function getTrialBalance(period = 'month') {
  const { from, to } = rangeForPeriod(period);
  const r = await client.get('/api/reports/trial-balance', {
    params: { from, to },
  });
  return unwrap(r);
}
