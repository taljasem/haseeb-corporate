// Deterministic mock engine for Al Manara Trading Co.
// All functions async, simulate 200ms delay, return KWD with 3 decimals.

const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));

export async function getCashPosition() {
  await delay();
  return {
    total: 184235.5,
    accounts: [
      { name: "KIB Operating", balance: 142100.25, currency: "KWD" },
      { name: "KIB Reserve", balance: 42135.25, currency: "KWD" },
    ],
    asOf: new Date().toISOString(),
  };
}

export async function getRevenueSummary(period = "month") {
  await delay();
  return {
    period,
    thisMonth: 87420.0,
    lastMonth: 79100.0,
    samePeriodLastYear: 71200.0,
    ytd: 612400.0,
  };
}

export async function getProfitability(period = "month") {
  await delay();
  return {
    period,
    netIncome: 24300.0,
    grossMargin: 0.42,
    operatingMargin: 0.28,
  };
}

export async function getARTotal() {
  await delay();
  return { total: 56200.0, overdue: 14200.0 };
}

export async function getAPTotal() {
  await delay();
  return { total: 38900.0, dueSoon: 12100.0 };
}

export async function getCategorizationCoverage(period = "month") {
  await delay();
  return { period, percentage: 97, categorized: 412, pending: 23, total: 435 };
}

export async function getExpenseSummary(period = "month") {
  await delay();
  return {
    period,
    thisMonth: 312400.0,
    lastMonth: 295800.0,
    ytd: 1842300.0,
  };
}

export async function getHealthScore() {
  await delay();
  return {
    score: 75,
    status: "Good standing",
    message: "Cash reserves healthy. 2 items need attention.",
  };
}

export async function getRecentTransactions(limit = 8) {
  await delay();
  const all = [
    { id: "tx-001", merchant: "Alghanim Industries — payment in", timestamp: "Today, 3:12 PM",    amount: 12450.0,  direction:  1, isToday: true  },
    { id: "tx-002", merchant: "KNPC fuel cards",                   timestamp: "Today, 1:48 PM",    amount:  1820.5,  direction: -1, isToday: true  },
    { id: "tx-003", merchant: "Al Shaya Trading",                  timestamp: "Today, 11:05 AM",   amount:  8740.0,  direction:  1, isToday: true  },
    { id: "tx-004", merchant: "Office rent — Sharq",               timestamp: "Yesterday, 4:30 PM", amount:  4200.0,  direction: -1, isToday: false },
    { id: "tx-005", merchant: "Zain Kuwait — corporate lines",     timestamp: "Yesterday, 2:15 PM", amount:   624.75, direction: -1, isToday: false },
    { id: "tx-006", merchant: "Deliveroo payout",                  timestamp: "Apr 5, 6:00 PM",    amount:  2310.0,  direction:  1, isToday: false },
    { id: "tx-007", merchant: "KIB transfer — payroll",            timestamp: "Apr 5, 9:00 AM",    amount: 18500.0,  direction: -1, isToday: false },
    { id: "tx-008", merchant: "Ooredoo fiber",                     timestamp: "Apr 4, 11:20 AM",   amount:   135.0,  direction: -1, isToday: false },
    { id: "tx-009", merchant: "MyFatoorah settlement",             timestamp: "Apr 3, 8:45 PM",    amount:  5612.25, direction:  1, isToday: false },
  ];
  return all.slice(0, limit);
}

export async function getAminahNotes() {
  await delay();
  return [
    { id: "note-1", severity: "high",   text: "[3 overdue invoices] — Gulf Logistics WLL, [14,200.000 KWD] unpaid >30 days" },
    { id: "note-2", severity: "medium", text: "PIFSS contribution due in [5 days] — estimated [4,862.500 KWD]" },
    { id: "note-3", severity: "medium", text: "Marketing budget at [+91%] of monthly cap — third month trending over" },
  ];
}

export async function getMonthlyInsights() {
  await delay();
  return {
    text: "Revenue up [+10.5%] from last month. Margins holding at [42%]. Marketing trending [+23% over budget] for the third month.",
  };
}

export async function getEngineAlerts() {
  await delay();
  return [
    {
      id: "alert-001",
      severity: "warning",
      message: "Marketing department at 91% of monthly budget",
      source: "engine",
    },
    {
      id: "alert-002",
      severity: "critical",
      message: "3 invoices from Gulf Logistics WLL overdue more than 30 days",
      source: "engine",
    },
    {
      id: "alert-003",
      severity: "info",
      message: "KIB Operating balance up 12% vs. trailing 30-day average",
      source: "engine",
    },
  ];
}
