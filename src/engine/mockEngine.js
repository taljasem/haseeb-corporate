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
