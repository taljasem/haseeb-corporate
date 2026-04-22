// Deterministic mock engine for Al Manara Trading Co.
// All functions async, simulate 200ms delay, return KWD with 3 decimals.

import { TENANTS, DEFAULT_TENANT_ID } from "../config/tenants";

const delay = (ms = 200) => new Promise((r) => setTimeout(r, ms));

// ─────────────────────────────────────────
// TENANT-AWARE BRANDING TRANSFORMER
// ─────────────────────────────────────────
// The engine stores seed data authored for the Al Manara / KIB tenant.
// When the current tenant is different, we transform display strings at
// read-time by replacing the source tenant's tokens with the current
// tenant's tokens. This keeps a single authoritative data set while
// supporting multi-tenant demos.

let _currentTenantId = DEFAULT_TENANT_ID;
export function setCurrentTenant(id) {
  if (TENANTS[id]) _currentTenantId = id;
}
export function getCurrentTenant() {
  return TENANTS[_currentTenantId] || TENANTS[DEFAULT_TENANT_ID];
}

let _currentRole = "Owner";
export function setCurrentRole(role) { _currentRole = role; }
export function getCurrentRole() { return _currentRole; }
function _currentUserDisplayName() {
  const labels = { Owner: "Owner", CFO: "CFO", Junior: "Junior Accountant" };
  return `You (${labels[_currentRole] || _currentRole})`;
}

// Source-tenant tokens that exist in the seed data.
const SOURCE_TOKENS = {
  companyName: "Al Manara Trading",
  companyNameUpper: "AL MANARA TRADING",
  bankAbbrev: "KIB",
  bankFullName: "Kuwait International Bank",
  accountPrefix: "KWIB",
};

// Apply tenant branding to a string. Used for account names, descriptions, narrations.
function _brand(str) {
  if (typeof str !== "string") return str;
  const t = getCurrentTenant();
  if (_currentTenantId === DEFAULT_TENANT_ID) return str;

  const bank = t.banks[0] || {};
  const abbrev = bank.abbreviation || "";
  const bankFull = bank.name || "";
  const acctPrefix = bank.accountNumberPrefix || "";
  const hideBankBranding = !t.features?.showBankBranding;

  let out = str;

  // Company name
  out = out.split(SOURCE_TOKENS.companyName).join(t.company.name);
  out = out.split(SOURCE_TOKENS.companyNameUpper).join(t.company.name.toUpperCase());

  // Bank full name
  if (bankFull) out = out.split(SOURCE_TOKENS.bankFullName).join(bankFull);

  // Bank abbreviation: in bank-embedded mode, swap. In standalone, strip.
  if (hideBankBranding) {
    // "KIB Operating Account" → "Operating Account"
    out = out.replace(/\bKIB\s+/g, "");
    // "4 KIB accounts" → "4 accounts"
    out = out.replace(/\b(\d+)\s+KIB\s+accounts/g, "$1 accounts");
    out = out.replace(/\bKIB\b/g, "");
  } else if (abbrev && abbrev !== "KIB") {
    out = out.split("KIB").join(abbrev);
  }

  // Account number prefix "KWIB •••• 8472"
  if (acctPrefix && acctPrefix !== "KWIB") {
    out = out.split(SOURCE_TOKENS.accountPrefix).join(acctPrefix);
  } else if (!acctPrefix) {
    // Strip the prefix entirely for tenants that don't brand account numbers.
    out = out.replace(/KWIB\s+/g, "");
  }

  // Clean up any accidental double spaces from stripping
  out = out.replace(/\s{2,}/g, " ").trim();

  return out;
}

// Recursive branding — walks an object and brands any string fields we care about.
// Also replaces "You (CFO)" with the current role-aware display name.
function _brandObj(obj) {
  if (obj == null) return obj;
  if (Array.isArray(obj)) return obj.map(_brandObj);
  if (typeof obj === "string") {
    const s = _currentTenantId === DEFAULT_TENANT_ID ? obj : _brand(obj);
    return s === "You (CFO)" ? _currentUserDisplayName() : s.includes("You (CFO)") ? s.replace(/You \(CFO\)/g, _currentUserDisplayName()) : s;
  }
  if (typeof obj !== "object") return obj;
  const out = {};
  for (const k of Object.keys(obj)) {
    out[k] = _brandObj(obj[k]);
  }
  return out;
}

export async function getCashPosition() {
  await delay();
  return _brandObj({
    total: 184235.5,
    accounts: [
      { name: "KIB Operating", balance: 142100.25, currency: "KWD" },
      { name: "KIB Reserve", balance: 42135.25, currency: "KWD" },
    ],
    asOf: new Date().toISOString(),
  });
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

function fmtTime(d) {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
function fmtMonthDay(d) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export async function getRecentTransactions(limit = 8) {
  await delay();
  const now = new Date();
  const today = (h, m) => {
    const d = new Date(now);
    d.setHours(h, m, 0, 0);
    return d;
  };
  const yesterday = (h, m) => {
    const d = today(h, m);
    d.setDate(d.getDate() - 1);
    return d;
  };
  const daysAgo = (n, h, m) => {
    const d = today(h, m);
    d.setDate(d.getDate() - n);
    return d;
  };

  const rows = [
    { id: "tx-001", merchant: "Alghanim Industries — payment in", when: today(14, 14), amount: 12450.0,  direction:  1, isToday: true  },
    { id: "tx-002", merchant: "KNPC fuel cards",                   when: today(11, 30), amount:  1820.5,  direction: -1, isToday: true  },
    { id: "tx-003", merchant: "Al Shaya Trading",                  when: today( 9, 45), amount:  8740.0,  direction:  1, isToday: true  },
    { id: "tx-004", merchant: "Office rent — Sharq",               when: yesterday(16, 30), amount: 4200.0, direction: -1, isToday: false, rel: "Yesterday" },
    { id: "tx-005", merchant: "Zain Kuwait — corporate lines",     when: yesterday(14, 15), amount:  624.75, direction: -1, isToday: false, rel: "Yesterday" },
    { id: "tx-006", merchant: "Deliveroo payout",                  when: daysAgo(2, 18, 0),  amount: 2310.0, direction:  1, isToday: false },
    { id: "tx-007", merchant: "KIB transfer — payroll",            when: daysAgo(3,  9, 0),  amount: 18500.0, direction: -1, isToday: false },
    { id: "tx-008", merchant: "Ooredoo fiber",                     when: daysAgo(4, 11, 20), amount:  135.0, direction: -1, isToday: false },
    { id: "tx-009", merchant: "MyFatoorah settlement",             when: daysAgo(5, 20, 45), amount: 5612.25, direction:  1, isToday: false },
  ];

  return _brandObj(rows.slice(0, limit).map((r) => {
    let timestamp;
    if (r.isToday) timestamp = `Today, ${fmtTime(r.when)}`;
    else if (r.rel === "Yesterday") timestamp = `Yesterday, ${fmtTime(r.when)}`;
    else timestamp = `${fmtMonthDay(r.when)}, ${fmtTime(r.when)}`;
    return {
      id: r.id,
      merchant: r.merchant,
      timestamp,
      amount: r.amount,
      direction: r.direction,
      isToday: r.isToday,
    };
  }));
}

export async function getMockChatHistory() {
  await delay();
  return _brandObj([
    {
      role: "user",
      text: "What's our cash position right now?",
    },
    {
      role: "aminah",
      text: "Total cash is **184,235.500 KWD** across 2 KIB accounts. Operating: **142,100.250**. Reserve: **42,135.250**. This is current as of 2 minutes ago — bank feed live.",
    },
    {
      role: "user",
      text: "Why is marketing over budget again?",
    },
    {
      role: "aminah",
      text: "Marketing is at **91% of budget** with 8 days left in the period — projected to close at **+23% over**. Three large items this month: campaign A (**4,200**), tradeshow B (**3,100**), agency retainer (**2,800**). This is the third consecutive month over budget. Want me to flag this for the CFO?",
    },
    {
      role: "user",
      text: "I paid the office rent today, 8,750",
    },
    {
      role: "aminah",
      text: "I can't record transactions from the owner view — that's your accounting team's job. I've notified **Sara** to log this entry. You'll see it appear in your transaction feed once she records it.",
    },
  ]);
}

export async function getPendingApprovals() {
  await delay();
  return _brandObj([
    { id: "ap-1", type: "EXPENSE", description: "Q2 marketing campaign — Avenues",   amount:  4200.0, requestedBy: "Layla (Marketing)", timeAgo: "2h ago" },
    { id: "ap-2", type: "PO",      description: "Office equipment — Sharq HQ",       amount: 12800.0, requestedBy: "Operations",        timeAgo: "5h ago" },
    { id: "ap-3", type: "PAYMENT", description: "Al Shaya Trading — invoice #2847",  amount: 24500.0, requestedBy: "CFO",               timeAgo: "yesterday" },
    { id: "ap-4", type: "JOURNAL", description: "PIFSS accrual — March",             amount:  9500.0, requestedBy: "Sara",              timeAgo: "yesterday" },
  ]);
}

export async function getBudgetSummary() {
  await delay();
  return _brandObj([
    { department: "Operations",   used:  67, status: "good"    },
    { department: "Sales",        used:  78, status: "good"    },
    { department: "Marketing",    used:  91, status: "warning" },
    { department: "Tech & Infra", used:  54, status: "good"    },
    { department: "Admin",        used: 103, status: "over"    },
  ]);
}

export async function getAuditReadiness() {
  await delay();
  const checks = [
    true, true, true, true, true,
    true, true, true, true, true,
    true, true, true, false, true,
  ];
  return {
    totalChecks: 15,
    passing: 14,
    failing: 1,
    failingCheck: "Sequential numbering",
    failingDetail: "JE-0413 missing reference",
    checks,
  };
}

export async function getCloseStatus() {
  await delay();
  return {
    period: "March 2026",
    tasksTotal: 15,
    tasksComplete: 9,
    percentComplete: 60,
    nextTasks: [
      { task: "Reconcile Boubyan Bank",            assignee: "Noor", complete: false },
      { task: "Review uncategorized transactions", assignee: "You",  complete: false },
      { task: "Post adjusting entries",            assignee: "You",  complete: false },
    ],
  };
}

export async function getAminahNotes() {
  await delay();
  return _brandObj([
    { id: "note-1", severity: "high",   text: "[3 overdue invoices] — Gulf Logistics WLL, [14,200.000 KWD] unpaid >30 days" },
    { id: "note-2", severity: "medium", text: "PIFSS contribution due in [5 days] — estimated [4,862.500 KWD]" },
    { id: "note-3", severity: "medium", text: "Marketing budget at [+91%] of monthly cap — third month trending over" },
  ]);
}

export async function getMonthlyInsights() {
  await delay();
  return _brandObj({
    text: "Revenue up [+10.5%] from last month. Margins holding at [42%]. Marketing trending [+23% over budget] for the third month.",
  });
}

export async function getEngineAlerts() {
  await delay();
  return _brandObj([
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
  ]);
}

// ─────────────────────────────────────────
// CFO VIEW — additive functions
// ─────────────────────────────────────────

export async function getCFOTodayQueue() {
  await delay();
  return {
    pendingApprovals: 4,
    bankTransactionsToReview: 12,
    reconciliationExceptions: 2,
    auditFailures: 1,
  };
}

export async function getCFOAminahNotes() {
  await delay();
  return _brandObj([
    { id: "cn-1", text: "Trial balance off by [2,462.500 KWD] — likely from Boubyan unmatched items" },
    { id: "cn-2", text: "Sara's accuracy this week is [94%], up from [91%] last week" },
    { id: "cn-3", text: "Marketing variance flagged: [+23%] over budget for the third consecutive month" },
    { id: "cn-4", text: "PIFSS accrual draft ready for your review — JE-0415 ([9,500.000 KWD])" },
  ]);
}

export async function getTeamActivity() {
  await delay();
  return _brandObj([
    { id: "ta-1", initials: "S", name: "Sara",  action: "Reconciled KIB Operating and Settlement",          detail: "78 items matched", timeAgo: "2h ago" },
    { id: "ta-2", initials: "N", name: "Noor",  action: "Posted 5 journal entries",        detail: "Manual JEs",       timeAgo: "1h ago" },
    { id: "ta-3", initials: "S", name: "Sara",  action: "Categorized 23 bank transactions", detail: "Auto-confirmed",   timeAgo: "45min ago" },
    { id: "ta-4", initials: "N", name: "Noor",  action: "Drafted PIFSS accrual",           detail: "Awaiting approval", timeAgo: "30min ago" },
    { id: "ta-5", initials: "S", name: "Sara",  action: "Closed 4 reconciliation items",   detail: "Boubyan",          timeAgo: "12min ago" },
  ]);
}

export async function getEngineStatus() {
  await delay();
  return {
    coverage: 97,
    autoToday: 412,
    ruleBased: 78,
    patternBased: 16,
    aiSuggested: 6,
  };
}

// Mutable bank transactions store — extracted from inline array so bulk ops can mutate
const _BANK_TX_DB = [
  { id: "bt-1",  date: "2026-04-07", merchant: "KNPC fuel cards",            amount: -1820.5,  currency: "KWD", source: "KIB Operating", terminal: "POS-2241", description: "KNPC fuel cards",            categoryCode: null, assigneeId: null, reviewed: false, engineSuggestion: { account: "Fuel & Vehicle",     accountCode: "6420", confidence: "RULE",    reasoning: "Matched rule: KNPC merchants → Fuel & Vehicle (6420)" } },
  { id: "bt-2",  date: "2026-04-07", merchant: "Alghanim Industries",        amount: 12450.0,  currency: "KWD", source: "KIB Operating", terminal: "WIRE",     description: "Alghanim Industries",        categoryCode: null, assigneeId: null, reviewed: false, engineSuggestion: { account: "Sales Revenue",      accountCode: "4100", confidence: "PATTERN", reasoning: "Pattern match: customer payments from Alghanim entities" } },
  { id: "bt-3",  date: "2026-04-07", merchant: "Al Shaya Trading",           amount: 8740.0,   currency: "KWD", source: "KIB Operating", terminal: "WIRE",     description: "Al Shaya Trading",           categoryCode: null, assigneeId: null, reviewed: false, engineSuggestion: { account: "Sales Revenue",      accountCode: "4100", confidence: "RULE",    reasoning: "Recurring customer — rule active since Jan 2025" } },
  { id: "bt-4",  date: "2026-04-06", merchant: "Office rent — Sharq",        amount: -4200.0,  currency: "KWD", source: "KIB Operating", terminal: "STO",      description: "Office rent — Sharq",        categoryCode: null, assigneeId: null, reviewed: false, engineSuggestion: { account: "Office Rent",        accountCode: "6200", confidence: "RULE",    reasoning: "Standing order — landlord rule" } },
  { id: "bt-5",  date: "2026-04-06", merchant: "Zain Kuwait",                amount: -624.75,  currency: "KWD", source: "KIB Operating", terminal: "DD",       description: "Zain Kuwait",                categoryCode: null, assigneeId: null, reviewed: false, engineSuggestion: { account: "Internet & Phone",   accountCode: "6220", confidence: "RULE",    reasoning: "Direct debit — telecom rule" } },
  { id: "bt-6",  date: "2026-04-05", merchant: "Avenues Mall — booth fee",   amount: -3100.0,  currency: "KWD", source: "KIB Operating", terminal: "POS",      description: "Avenues Mall — booth fee",   categoryCode: null, assigneeId: null, reviewed: false, engineSuggestion: { account: "Trade Shows",        accountCode: "6310", confidence: "AI",      reasoning: "AI inferred from memo: 'tradeshow booth Q2'" } },
  { id: "bt-7",  date: "2026-04-05", merchant: "Boubyan transfer in — unidentified", amount: 2462.5, currency: "KWD", source: "KIB Operating", terminal: "WIRE", description: "Boubyan transfer in — unidentified", categoryCode: null, assigneeId: null, reviewed: false, engineSuggestion: { account: "",              accountCode: "",     confidence: "NONE",    reasoning: "No matching customer or rule. Manual review required." } },
  { id: "bt-8",  date: "2026-04-04", merchant: "Ooredoo fiber",              amount: -135.0,   currency: "KWD", source: "KIB Operating", terminal: "DD",       description: "Ooredoo fiber",              categoryCode: null, assigneeId: null, reviewed: false, engineSuggestion: { account: "Internet & Phone",   accountCode: "6220", confidence: "RULE",    reasoning: "Direct debit — telecom rule" } },
  { id: "bt-9",  date: "2026-04-04", merchant: "Tradeshow vendor — Dubai",   amount: -1240.0,  currency: "KWD", source: "KIB Operating", terminal: "WIRE",     description: "Tradeshow vendor — Dubai",   categoryCode: null, assigneeId: null, reviewed: false, engineSuggestion: { account: "Trade Shows",        accountCode: "6310", confidence: "PATTERN", reasoning: "Pattern: vendor previously coded to Trade Shows" } },
  { id: "bt-10", date: "2026-04-03", merchant: "Misc deposit — counter",     amount: 380.0,    currency: "KWD", source: "KIB Operating", terminal: "BRANCH",   description: "Misc deposit — counter",     categoryCode: null, assigneeId: null, reviewed: false, engineSuggestion: { account: "",              accountCode: "",     confidence: "NONE",    reasoning: "No description from bank. Needs manual coding." } },
];

export async function getBankTransactionsPending() {
  await delay();
  return _brandObj(_BANK_TX_DB.map((tx) => ({ ...tx })));
}

export async function getChartOfAccounts() {
  await delay();
  return _brandObj([
    { code: "1110", name: "Petty Cash",                  category: "Assets",             type: "debit"  },
    { code: "1120", name: "KIB Operating Account",       category: "Assets",             type: "debit"  },
    { code: "1130", name: "KIB Reserve Account",         category: "Assets",             type: "debit"  },
    { code: "1140", name: "KIB Settlement Account",      category: "Assets",             type: "debit"  },
    { code: "1200", name: "Accounts Receivable",         category: "Assets",             type: "debit"  },
    { code: "1300", name: "Inventory",                   category: "Assets",             type: "debit"  },
    { code: "1400", name: "Prepaid Expenses",            category: "Assets",             type: "debit"  },
    { code: "1500", name: "Fixed Assets — Equipment",    category: "Assets",             type: "debit"  },
    { code: "1510", name: "Fixed Assets — Furniture",    category: "Assets",             type: "debit"  },
    { code: "1520", name: "Accumulated Depreciation",    category: "Assets",             type: "credit" },
    { code: "2100", name: "Accounts Payable",            category: "Liabilities",        type: "credit" },
    { code: "2200", name: "PIFSS Payable",               category: "Liabilities",        type: "credit" },
    { code: "2210", name: "Salaries Payable",            category: "Liabilities",        type: "credit" },
    { code: "2300", name: "Tax Payable",                 category: "Liabilities",        type: "credit" },
    { code: "2400", name: "Accrued Expenses",            category: "Liabilities",        type: "credit" },
    { code: "3000", name: "Owner Equity",                category: "Equity",             type: "credit" },
    { code: "3100", name: "Retained Earnings",           category: "Equity",             type: "credit" },
    { code: "4100", name: "Sales Revenue",               category: "Revenue",            type: "credit" },
    { code: "4200", name: "Service Revenue",             category: "Revenue",            type: "credit" },
    { code: "5100", name: "Cost of Goods Sold",          category: "Cost of Goods Sold", type: "debit"  },
    { code: "5200", name: "Direct Labor",                category: "Cost of Goods Sold", type: "debit"  },
    { code: "6100", name: "Salaries & Wages",            category: "Operating Expenses", type: "debit"  },
    { code: "6110", name: "PIFSS Contributions",         category: "Operating Expenses", type: "debit"  },
    { code: "6120", name: "Bonuses",                     category: "Operating Expenses", type: "debit"  },
    { code: "6200", name: "Office Rent",                 category: "Operating Expenses", type: "debit"  },
    { code: "6210", name: "Utilities",                   category: "Operating Expenses", type: "debit"  },
    { code: "6220", name: "Internet & Phone",            category: "Operating Expenses", type: "debit"  },
    { code: "6230", name: "Cleaning & Maintenance",      category: "Operating Expenses", type: "debit"  },
    { code: "6300", name: "Marketing & Advertising",     category: "Operating Expenses", type: "debit"  },
    { code: "6310", name: "Trade Shows",                 category: "Operating Expenses", type: "debit"  },
    { code: "6400", name: "Travel & Transport",          category: "Operating Expenses", type: "debit"  },
    { code: "6420", name: "Fuel & Vehicle",              category: "Operating Expenses", type: "debit"  },
    { code: "6500", name: "Professional Fees",           category: "Operating Expenses", type: "debit"  },
    { code: "6510", name: "Audit Fees",                  category: "Operating Expenses", type: "debit"  },
    { code: "6520", name: "Legal Fees",                  category: "Operating Expenses", type: "debit"  },
    { code: "6600", name: "Office Supplies",             category: "Operating Expenses", type: "debit"  },
    { code: "6700", name: "Insurance",                   category: "Operating Expenses", type: "debit"  },
    { code: "6800", name: "Bank Charges",                category: "Operating Expenses", type: "debit"  },
    { code: "7100", name: "Interest Income",             category: "Other Income",       type: "credit" },
    { code: "7200", name: "FX Gain",                     category: "Other Income",       type: "credit" },
    { code: "8100", name: "Interest Expense",            category: "Other Expense",      type: "debit"  },
    { code: "8200", name: "FX Loss",                     category: "Other Expense",      type: "debit"  },
  ]);
}

export async function draftJournalEntry({ description, amount, debitAccount, creditAccount, date }) {
  await delay();
  const seq = Math.floor(400 + Math.random() * 100);
  const num = Number(amount || 0);
  return {
    id: `JE-0${seq}`,
    description: description || "",
    status: "Draft - Validated",
    lines: [
      { account: debitAccount.name,  code: debitAccount.code,  debit: num, credit: null },
      { account: creditAccount.name, code: creditAccount.code, debit: null, credit: num },
    ],
    totalDebit: num,
    totalCredit: num,
    balanced: true,
    mappingVersion: "v1.0",
    createdAt: (date || new Date()).toISOString ? (date || new Date()).toISOString() : new Date().toISOString(),
    hashChainStatus: "ready",
  };
}

// ─────────────────────────────────────────
// CFO architecture fixes — additive
// ─────────────────────────────────────────

let _suggSeq = 1;

export async function suggestJournalEntryFromBankTransaction(bankTx) {
  await delay();
  if (!bankTx) return null;

  // Bank account name → code map (matches chart of accounts)
  const bankMap = {
    "KIB Operating": { name: "KIB Operating Account", code: "1120" },
    "KIB Reserve":   { name: "KIB Reserve Account",   code: "1130" },
    "KIB Settlement":{ name: "KIB Settlement Account", code: "1140" },
  };
  const bank = bankMap[bankTx.source] || { name: bankTx.source || "Bank Account", code: "1120" };
  const sug = bankTx.engineSuggestion || {};
  const abs = Math.abs(bankTx.amount);
  const isOutflow = bankTx.amount < 0;

  const counterparty = sug.account
    ? { name: sug.account, code: sug.accountCode }
    : null;

  // Build lines.
  // Outflow: debit suggested expense, credit bank
  // Inflow: debit bank, credit suggested revenue
  let debitLine, creditLine;
  if (isOutflow) {
    debitLine  = counterparty
      ? { account: counterparty.name, code: counterparty.code, debit: abs, credit: null }
      : { account: null, code: null, debit: abs, credit: null, placeholder: true };
    creditLine = { account: bank.name, code: bank.code, debit: null, credit: abs };
  } else {
    debitLine  = { account: bank.name, code: bank.code, debit: abs, credit: null };
    creditLine = counterparty
      ? { account: counterparty.name, code: counterparty.code, debit: null, credit: abs }
      : { account: null, code: null, debit: null, credit: abs, placeholder: true };
  }

  return {
    id: `JE-SUGG-${String(_suggSeq++).padStart(3, "0")}`,
    sourceBankTxId: bankTx.id,
    description: bankTx.merchant,
    status: "Engine Suggestion",
    lines: [debitLine, creditLine],
    totalDebit: abs,
    totalCredit: abs,
    balanced: !!counterparty,
    mappingVersion: "v1.0",
    createdAt: new Date().toISOString(),
    hashChainStatus: "not committed",
    confidence: sug.confidence || "NONE",
    reasoning: sug.reasoning || "",
  };
}

export async function getTeamMembers() {
  await delay();
  return [
    { id: "self",  name: "You (CFO)",        role: "CFO",                initials: "You", color: "#00C48C" },
    { id: "sara",  name: "Sara Al-Ahmadi",   role: "Senior Accountant",  initials: "SA",  color: "#3B82F6" },
    { id: "noor",  name: "Noor Kandari",     role: "Junior Accountant",  initials: "NK",  color: "#8B5CF6" },
    { id: "jasem", name: "Jasem Al-Rashed",  role: "Junior Accountant",  initials: "JA",  color: "#D4A84B" },
    { id: "layla", name: "Layla Habib",      role: "Accounts Payable",   initials: "LH",  color: "#FF5A5F" },
  ];
}

// ─────────────────────────────────────────
// TASKBOX — universal work communication layer
// ─────────────────────────────────────────

const TASKBOX_PEOPLE = {
  owner: { id: "owner", name: "Tarek Aljasem",   role: "Owner",              initials: "TA",  avatarColor: "#8B5CF6" },
  cfo:   { id: "cfo",   name: "You (CFO)",       role: "CFO",                initials: "You", avatarColor: "#00C48C" },
  sara:  { id: "sara",  name: "Sara Al-Ahmadi",  role: "Senior Accountant",  initials: "SA",  avatarColor: "#3B82F6" },
  noor:  { id: "noor",  name: "Noor Kandari",    role: "Junior Accountant",  initials: "NK",  avatarColor: "#8B5CF6" },
  jasem: { id: "jasem", name: "Jasem Al-Rashed", role: "Junior Accountant",  initials: "JA",  avatarColor: "#D4A84B" },
  layla: { id: "layla", name: "Layla Habib",     role: "Accounts Payable",   initials: "LH",  avatarColor: "#FF5A5F" },
};

// Helpers for timestamps
function _hoursAgo(h) {
  const d = new Date();
  d.setHours(d.getHours() - h);
  return d.toISOString();
}
function _daysAgo(d) {
  const x = new Date();
  x.setDate(x.getDate() - d);
  return x.toISOString();
}
function _daysFromNow(d) {
  const x = new Date();
  x.setDate(x.getDate() + d);
  return x.toISOString();
}

const TASK_TYPES = [
  // Downward
  { id: "request-work",            label: "Request Work",     icon: "ClipboardList", color: "#3B82F6", direction: "downward" },
  { id: "request-review",          label: "Request Review",   icon: "Eye",           color: "#D4A84B", direction: "downward" },
  { id: "request-investigation",   label: "Investigate",      icon: "Search",        color: "#D4A84B", direction: "downward" },
  { id: "draft-je",                label: "Draft JE",         icon: "FileText",      color: "#00C48C", direction: "downward" },
  { id: "draft-report",            label: "Draft Report",     icon: "BarChart2",     color: "#3B82F6", direction: "downward" },
  { id: "draft-budget",            label: "Draft Budget",     icon: "BarChart3",     color: "#3B82F6", direction: "downward" },
  { id: "request-budget-revision", label: "Revise Budget",    icon: "Pencil",        color: "#D4A84B", direction: "downward" },
  { id: "approve-budget",          label: "Approve Budget",   icon: "ShieldCheck",   color: "#D4A84B", direction: "lateral" },
  { id: "reconcile-account",       label: "Reconcile",        icon: "CheckCircle",   color: "#00C48C", direction: "downward" },
  { id: "categorize-transactions", label: "Categorize",       icon: "Tag",           color: "#00C48C", direction: "downward" },
  { id: "upload-document",         label: "Upload",           icon: "Upload",        color: "#3B82F6", direction: "downward" },
  { id: "request-report",          label: "Request Report",   icon: "BarChart2",     color: "#3B82F6", direction: "downward" },
  // Upward
  { id: "submit-work",             label: "Submit Work",      icon: "CheckSquare",   color: "#00C48C", direction: "upward" },
  { id: "submit-budget-section",   label: "Submit Budget",    icon: "CheckCircle2",  color: "#00C48C", direction: "upward" },
  { id: "request-approval",        label: "Request Approval", icon: "ShieldCheck",   color: "#D4A84B", direction: "upward" },
  { id: "escalate",                label: "Escalate",         icon: "AlertTriangle", color: "#FF5A5F", direction: "upward" },
  { id: "ask-clarification",       label: "Ask Clarification",icon: "HelpCircle",    color: "#D4A84B", direction: "upward" },
  // Lateral / any
  { id: "explain-transaction",     label: "Explain",          icon: "MessageCircle", color: "#8B5CF6", direction: "lateral" },
  { id: "flag-for-review",         label: "Flag",             icon: "Flag",          color: "#FF5A5F", direction: "lateral" },
  { id: "request-information",     label: "Info Request",     icon: "Info",          color: "#3B82F6", direction: "lateral" },
  { id: "general-question",        label: "Question",         icon: "MessageSquare", color: "#5B6570", direction: "lateral" },
];

export function getTaskTypeMeta(typeId) {
  return TASK_TYPES.find((t) => t.id === typeId) || TASK_TYPES[TASK_TYPES.length - 1];
}

let _taskSeq = 100;
const _newId = () => `TSK-${++_taskSeq}`;

// Build a system event
function _sysEvent(type, detail, isoTimestamp) {
  return {
    id: `EV-${Math.random().toString(36).slice(2, 8)}`,
    type: "system",
    systemEventType: type,
    systemEventDetail: detail,
    timestamp: isoTimestamp || new Date().toISOString(),
  };
}
function _msgEvent(author, body, isoTimestamp, attachments) {
  return {
    id: `EV-${Math.random().toString(36).slice(2, 8)}`,
    type: "message",
    author,
    body,
    timestamp: isoTimestamp || new Date().toISOString(),
    attachments: attachments || [],
  };
}

const P = TASKBOX_PEOPLE;

// 25 mock tasks
const TASKBOX_DB = [
  // 1 — Owner → CFO, request-report, open
  {
    id: "TSK-101",
    subject: "Q1 marketing spend breakdown",
    body: "Can you pull the full Q1 marketing spend by campaign? I want to understand the variance before the board meeting next week.",
    type: "request-report",
    direction: "lateral",
    status: "open",
    sender: P.owner,
    recipient: P.cfo,
    visibleTo: ["Owner", "CFO"],
    createdAt: _hoursAgo(5),
    updatedAt: _hoursAgo(5),
    dueDate: _daysFromNow(3),
    unread: true,
    thread: [
      _sysEvent("created", "Tarek created this task", _hoursAgo(5)),
      _msgEvent(P.owner, "Can you pull the full Q1 marketing spend by campaign? I want to understand the variance before the board meeting next week.", _hoursAgo(5)),
    ],
  },
  // 2 — CFO → Sara, reconcile, in-progress
  {
    id: "TSK-102",
    subject: "Reconcile Boubyan Bank — March",
    body: "Please complete the Boubyan reconciliation by end of day. There are 3 unmatched items from Mar 28 totaling 2,462.500 KWD. Check the deposit slips folder for the missing reference numbers.",
    type: "reconcile-account",
    direction: "downward",
    status: "in-progress",
    sender: P.cfo,
    recipient: P.sara,
    visibleTo: ["CFO", "Junior"],
    createdAt: _hoursAgo(8),
    updatedAt: _hoursAgo(2),
    dueDate: _daysFromNow(0),
    linkedItem: { type: "account", id: "1140", preview: "Boubyan Bank · Reconciliation pending" },
    unread: false,
    thread: [
      _sysEvent("created", "You created this task", _hoursAgo(8)),
      _msgEvent(P.cfo, "Please complete the Boubyan reconciliation by end of day. There are **3 unmatched items** from Mar 28 totaling **2,462.500 KWD**. Check the deposit slips folder for the missing reference numbers.", _hoursAgo(8)),
      _msgEvent(P.sara, "Started. I'll check the deposit slips folder this morning.", _hoursAgo(3)),
      _sysEvent("status-changed", "Sara marked this in-progress", _hoursAgo(2)),
    ],
  },
  // 3 — CFO → Noor, draft-je, open
  {
    id: "TSK-103",
    subject: "PIFSS accrual — March",
    body: "Draft the PIFSS accrual entry for March. Amount should be ~9,500.000 KWD based on the payroll run. Post it to account 2200 (PIFSS Payable) and 6110 (PIFSS Contributions).",
    type: "draft-je",
    direction: "downward",
    status: "open",
    sender: P.cfo,
    recipient: P.noor,
    visibleTo: ["CFO", "Junior"],
    createdAt: _hoursAgo(6),
    updatedAt: _hoursAgo(6),
    dueDate: _daysFromNow(2),
    unread: false,
    thread: [
      _sysEvent("created", "You created this task", _hoursAgo(6)),
      _msgEvent(P.cfo, "Draft the PIFSS accrual entry for March. Amount should be ~**9,500.000 KWD** based on the payroll run. Post to **2200 (PIFSS Payable)** and **6110 (PIFSS Contributions)**.", _hoursAgo(6)),
    ],
  },
  // 4 — Sara → CFO, escalate, open
  {
    id: "TSK-104",
    subject: "Unusual Boubyan transfer — 2,462.500 KWD",
    body: "Found this transfer from Boubyan dated Mar 28 with no matching reference in our records. Merchant description just says 'TRF-INT-2847'. Escalating for your review before I categorize.",
    type: "escalate",
    direction: "upward",
    status: "open",
    sender: P.sara,
    recipient: P.cfo,
    visibleTo: ["CFO", "Junior"],
    createdAt: _hoursAgo(4),
    updatedAt: _hoursAgo(4),
    linkedItem: { type: "bank-transaction", id: "BT-4521", preview: "Unidentified transfer · +2,462.500 · Mar 28" },
    unread: true,
    thread: [
      _sysEvent("created", "Sara created this task", _hoursAgo(4)),
      _msgEvent(P.sara, "Found this transfer from Boubyan dated Mar 28 with no matching reference in our records. Merchant description just says 'TRF-INT-2847' which doesn't match any of our vendors or customers. Escalating for your review before I categorize.", _hoursAgo(4)),
    ],
  },
  // 5 — Sara → CFO, submit-work, completed (multi-turn with reopen)
  {
    id: "TSK-105",
    subject: "Completed: KIB Operating and KIB Settlement reconciliations",
    body: "Both KIB Operating and KIB Settlement reconciliations are complete. 78 items matched, 0 exceptions. Summary attached.",
    type: "submit-work",
    direction: "upward",
    status: "completed",
    sender: P.sara,
    recipient: P.cfo,
    visibleTo: ["CFO", "Junior"],
    createdAt: _daysAgo(1),
    updatedAt: _hoursAgo(2),
    attachments: [{ name: "reconciliation-summary-mar26.pdf", size: "142 KB", type: "pdf" }],
    unread: false,
    thread: [
      _sysEvent("created", "Sara created this task", _daysAgo(1)),
      _msgEvent(P.sara, "Both KIB Operating and KIB Settlement reconciliations are complete. **78 items matched**, **0 exceptions**. Summary attached.", _daysAgo(1), [{ name: "reconciliation-summary-mar26.pdf", size: "142 KB", type: "pdf" }]),
      _sysEvent("completed", "Sara completed this task", _daysAgo(1)),
      _msgEvent(P.cfo, "Thanks Sara, reviewing now.", _hoursAgo(20)),
      _sysEvent("reopened", "You reopened this task", _hoursAgo(20)),
      _msgEvent(P.cfo, "One question — the KIB Settlement closing balance shows 142,100.250 but our GL shows 142,099.750. Can you check?", _hoursAgo(19)),
      _msgEvent(P.sara, "Resolved — there was a 0.500 rounding discrepancy on a wire fee. Adjusting JE posted as JE-0418. Closing balances now match.", _hoursAgo(3)),
      _sysEvent("completed", "Sara completed this task", _hoursAgo(2)),
    ],
  },
  // 6 — CFO → Jasem, categorize, open
  {
    id: "TSK-106",
    subject: "23 uncategorized transactions from Avenues branch",
    body: "Batch of 23 transactions from the Avenues branch needs categorization. Most are POS settlements but a few look unusual. Flag anything you're unsure about.",
    type: "categorize-transactions",
    direction: "downward",
    status: "open",
    sender: P.cfo,
    recipient: P.jasem,
    visibleTo: ["CFO", "Junior"],
    createdAt: _hoursAgo(11),
    updatedAt: _hoursAgo(11),
    unread: false,
    thread: [
      _sysEvent("created", "You created this task", _hoursAgo(11)),
      _msgEvent(P.cfo, "Batch of 23 transactions from the Avenues branch needs categorization. Most are POS settlements but a few look unusual. Please review and categorize each one. Flag anything you're unsure about.", _hoursAgo(11)),
    ],
  },
  // 7 — CFO → Owner, request-approval, open with attachment
  {
    id: "TSK-107",
    subject: "March close ready for your sign-off",
    body: "March close is 93% complete. All reconciliations done, adjusting entries posted, trial balance balanced. The final close requires your approval. Period summary attached.",
    type: "request-approval",
    direction: "lateral",
    status: "open",
    sender: P.cfo,
    recipient: P.owner,
    visibleTo: ["Owner", "CFO"],
    createdAt: _hoursAgo(3),
    updatedAt: _hoursAgo(3),
    attachments: [{ name: "march-close-summary.pdf", size: "256 KB", type: "pdf" }],
    unread: true,
    thread: [
      _sysEvent("created", "You created this task", _hoursAgo(3)),
      _msgEvent(P.cfo, "March close is **93% complete**. All reconciliations done, adjusting entries posted, trial balance balanced. The final close requires your approval. Period summary attached.", _hoursAgo(3), [{ name: "march-close-summary.pdf", size: "256 KB", type: "pdf" }]),
    ],
  },
  // 8 — Owner → CFO, explain-transaction, completed (with reply chain)
  {
    id: "TSK-108",
    subject: "What's this Al Shaya charge?",
    body: "Saw a 24,500 KWD outflow to Al Shaya Trading yesterday. Didn't recognize it. Can you explain?",
    type: "explain-transaction",
    direction: "lateral",
    status: "completed",
    sender: P.owner,
    recipient: P.cfo,
    visibleTo: ["Owner", "CFO"],
    createdAt: _daysAgo(1),
    updatedAt: _hoursAgo(22),
    linkedItem: { type: "bank-transaction", id: "BT-4498", preview: "Al Shaya Trading · -24,500.000 · Apr 6" },
    unread: false,
    thread: [
      _sysEvent("created", "Tarek created this task", _daysAgo(1)),
      _msgEvent(P.owner, "Saw a **24,500 KWD** outflow to Al Shaya Trading yesterday. Didn't recognize it. Can you explain?", _daysAgo(1)),
      _msgEvent(P.cfo, "This was a scheduled supplier payment for Q1 inventory. Invoice **#ALS-2847**, approved by you on March 15. I've attached the full documentation for reference.", _hoursAgo(23), [{ name: "ALS-2847-supplier-doc.pdf", size: "318 KB", type: "pdf" }]),
      _sysEvent("completed", "You completed this task", _hoursAgo(22)),
      _msgEvent(P.owner, "Got it, thanks.", _hoursAgo(22)),
    ],
  },
  // 9 — CFO → Sara, flag-for-review, open with due
  {
    id: "TSK-109",
    subject: "Marketing spend pattern — needs attention",
    body: "Marketing is at 91% of budget with 8 days left in the period. Third consecutive month trending over. Please pull the detail by campaign.",
    type: "flag-for-review",
    direction: "lateral",
    status: "open",
    sender: P.cfo,
    recipient: P.sara,
    visibleTo: ["CFO", "Junior"],
    createdAt: _hoursAgo(7),
    updatedAt: _hoursAgo(7),
    dueDate: _daysFromNow(1),
    unread: false,
    thread: [
      _sysEvent("created", "You created this task", _hoursAgo(7)),
      _msgEvent(P.cfo, "Marketing is at **91% of budget** with 8 days left in the period. **Third consecutive month** trending over. Please pull the detail by campaign so we can understand what's driving this.", _hoursAgo(7)),
    ],
  },
  // 10 — Sara → CFO, ask-clarification, completed
  {
    id: "TSK-110",
    subject: "Which account for trade show booth fees?",
    body: "The Avenues Mall charged us 3,100 KWD for booth fees during the Q1 promotion. Should this go to Trade Shows (6310) or Marketing & Advertising (6300)?",
    type: "ask-clarification",
    direction: "upward",
    status: "completed",
    sender: P.sara,
    recipient: P.cfo,
    visibleTo: ["CFO", "Junior"],
    createdAt: _daysAgo(2),
    updatedAt: _daysAgo(1),
    unread: false,
    thread: [
      _sysEvent("created", "Sara created this task", _daysAgo(2)),
      _msgEvent(P.sara, "The Avenues Mall charged us **3,100 KWD** for booth fees during the Q1 promotion. Should this go to **Trade Shows (6310)** or **Marketing & Advertising (6300)**? Company policy wasn't clear.", _daysAgo(2)),
      _msgEvent(P.cfo, "**Trade Shows (6310)** — booth fees always go there regardless of which event. Updating the rules registry to auto-categorize future Avenues Mall booth fees.", _daysAgo(1)),
      _sysEvent("completed", "You completed this task", _daysAgo(1)),
    ],
  },
  // 11 — CFO → Sara, request-investigation, open, reassigned
  {
    id: "TSK-111",
    subject: "Investigate duplicate vendor payment to Gulf Logistics",
    body: "There appear to be two payments to Gulf Logistics WLL on Apr 3 — one for 4,200.000 and another for 4,200.000. Can you confirm whether this is a duplicate or two separate invoices?",
    type: "request-investigation",
    direction: "downward",
    status: "open",
    sender: P.cfo,
    recipient: P.sara,
    visibleTo: ["CFO", "Junior"],
    createdAt: _hoursAgo(15),
    updatedAt: _hoursAgo(9),
    unread: false,
    thread: [
      _sysEvent("created", "You created this task", _hoursAgo(15)),
      _msgEvent(P.cfo, "Two payments to **Gulf Logistics WLL** on Apr 3 — one for **4,200.000** and another for **4,200.000**. Confirm duplicate or two separate invoices.", _hoursAgo(15)),
      _sysEvent("reassigned", "You reassigned this from Noor to Sara", _hoursAgo(9)),
      _msgEvent(P.cfo, "Reassigning to you, Sara — Noor is in training today.", _hoursAgo(9)),
    ],
  },
  // 12 — CFO → Layla, upload-document, open
  {
    id: "TSK-112",
    subject: "Upload signed PIFSS receipts for March",
    body: "We need the PIFSS payment receipts for March uploaded to the audit folder. Three receipts total.",
    type: "upload-document",
    direction: "downward",
    status: "open",
    sender: P.cfo,
    recipient: P.layla,
    visibleTo: ["CFO", "Junior"],
    createdAt: _hoursAgo(13),
    updatedAt: _hoursAgo(13),
    dueDate: _daysFromNow(2),
    unread: false,
    thread: [
      _sysEvent("created", "You created this task", _hoursAgo(13)),
      _msgEvent(P.cfo, "We need the **PIFSS payment receipts** for March uploaded to the audit folder. Three receipts total.", _hoursAgo(13)),
    ],
  },
  // 13 — Sara → CFO, request-approval, open
  {
    id: "TSK-113",
    subject: "Approve PIFSS accrual JE-0415",
    body: "Drafted PIFSS accrual JE-0415 per your instructions. Total 9,500.000 KWD. Awaiting your approval before I post.",
    type: "request-approval",
    direction: "upward",
    status: "open",
    sender: P.sara,
    recipient: P.cfo,
    visibleTo: ["CFO", "Junior"],
    createdAt: _hoursAgo(2),
    updatedAt: _hoursAgo(2),
    linkedItem: { type: "journal-entry", id: "JE-0415", preview: "PIFSS accrual · 9,500.000 KWD · Draft" },
    unread: true,
    thread: [
      _sysEvent("created", "Sara created this task", _hoursAgo(2)),
      _msgEvent(P.sara, "Drafted PIFSS accrual **JE-0415** per your instructions. Total **9,500.000 KWD**. Awaiting your approval before I post.", _hoursAgo(2)),
    ],
  },
  // 14 — CFO → Noor, draft-budget, open
  {
    id: "TSK-114",
    subject: "Q2 marketing budget proposal",
    body: "Draft the Q2 marketing budget proposal based on Q1 actuals + 8% growth assumption. Use the template in the budgets folder.",
    type: "draft-budget",
    direction: "downward",
    status: "open",
    sender: P.cfo,
    recipient: P.noor,
    visibleTo: ["CFO", "Junior"],
    createdAt: _daysAgo(1),
    updatedAt: _daysAgo(1),
    dueDate: _daysFromNow(4),
    unread: false,
    thread: [
      _sysEvent("created", "You created this task", _daysAgo(1)),
      _msgEvent(P.cfo, "Draft the **Q2 marketing budget proposal** based on Q1 actuals + 8% growth assumption. Use the template in the budgets folder.", _daysAgo(1)),
    ],
  },
  // 15 — Owner → CFO, request-information, completed
  {
    id: "TSK-115",
    subject: "Cash burn rate trend",
    body: "What's our 90-day rolling cash burn rate?",
    type: "request-information",
    direction: "lateral",
    status: "completed",
    sender: P.owner,
    recipient: P.cfo,
    visibleTo: ["Owner", "CFO"],
    createdAt: _daysAgo(3),
    updatedAt: _daysAgo(2),
    unread: false,
    thread: [
      _sysEvent("created", "Tarek created this task", _daysAgo(3)),
      _msgEvent(P.owner, "What's our 90-day rolling cash burn rate?", _daysAgo(3)),
      _msgEvent(P.cfo, "Trailing 90-day burn is **~21,400.000 KWD/month** on average. April month-to-date is tracking 7% below average.", _daysAgo(2)),
      _sysEvent("completed", "Tarek completed this task", _daysAgo(2)),
    ],
  },
  // 16 — Sara → CFO, submit-work, open
  {
    id: "TSK-116",
    subject: "Bank charges reconciliation — March",
    body: "Reconciled all bank charges across KIB Operating, KIB Reserve, and KIB Settlement. Found 4 unposted charges totaling 87.500 KWD. Posting JEs now.",
    type: "submit-work",
    direction: "upward",
    status: "open",
    sender: P.sara,
    recipient: P.cfo,
    visibleTo: ["CFO", "Junior"],
    createdAt: _hoursAgo(1),
    updatedAt: _hoursAgo(1),
    unread: true,
    thread: [
      _sysEvent("created", "Sara created this task", _hoursAgo(1)),
      _msgEvent(P.sara, "Reconciled all bank charges across **KIB Operating**, **KIB Reserve**, and **KIB Settlement**. Found 4 unposted charges totaling **87.500 KWD**. Posting JEs now.", _hoursAgo(1)),
    ],
  },
  // 17 — CFO → Sara, request-review, open
  {
    id: "TSK-117",
    subject: "Review March variance commentary draft",
    body: "Draft commentary for March variance is ready. Please review for accuracy before I send to Owner.",
    type: "request-review",
    direction: "downward",
    status: "open",
    sender: P.cfo,
    recipient: P.sara,
    visibleTo: ["CFO", "Junior"],
    createdAt: _hoursAgo(9),
    updatedAt: _hoursAgo(9),
    attachments: [{ name: "march-variance-draft.docx", size: "48 KB", type: "docx" }],
    unread: false,
    thread: [
      _sysEvent("created", "You created this task", _hoursAgo(9)),
      _msgEvent(P.cfo, "Draft commentary for March variance is ready. Please review for accuracy before I send to Owner.", _hoursAgo(9), [{ name: "march-variance-draft.docx", size: "48 KB", type: "docx" }]),
    ],
  },
  // 18 — Noor → CFO, ask-clarification, open
  {
    id: "TSK-118",
    subject: "Capitalize or expense the office furniture?",
    body: "We bought office furniture for 1,840.000 KWD. Above our 500 KWD threshold but it's a single chair set. Capitalize per policy or expense as one-off?",
    type: "ask-clarification",
    direction: "upward",
    status: "open",
    sender: P.noor,
    recipient: P.cfo,
    visibleTo: ["CFO", "Junior"],
    createdAt: _hoursAgo(4),
    updatedAt: _hoursAgo(4),
    unread: false,
    thread: [
      _sysEvent("created", "Noor created this task", _hoursAgo(4)),
      _msgEvent(P.noor, "We bought office furniture for **1,840.000 KWD**. Above our 500 KWD threshold but it's a single chair set. Capitalize per policy or expense as one-off?", _hoursAgo(4)),
    ],
  },
  // 19 — CFO → Sara, general-question, completed
  {
    id: "TSK-119",
    subject: "Did we receive the Alghanim April invoice?",
    body: "Quick check — did we receive the April invoice from Alghanim Industries yet?",
    type: "general-question",
    direction: "downward",
    status: "completed",
    sender: P.cfo,
    recipient: P.sara,
    visibleTo: ["CFO", "Junior"],
    createdAt: _daysAgo(2),
    updatedAt: _daysAgo(2),
    unread: false,
    thread: [
      _sysEvent("created", "You created this task", _daysAgo(2)),
      _msgEvent(P.cfo, "Quick check — did we receive the April invoice from Alghanim Industries yet?", _daysAgo(2)),
      _msgEvent(P.sara, "Yes, received Apr 5. Already in the AP queue. Reference: ALS-3122.", _daysAgo(2)),
      _sysEvent("completed", "You completed this task", _daysAgo(2)),
    ],
  },
  // 20 — CFO → Owner, draft-report, open
  {
    id: "TSK-120",
    subject: "March P&L draft for review",
    body: "March P&L draft is ready. Net income 24,300.000 KWD. Highlights: revenue up 10.5%, marketing 23% over budget, ops on plan.",
    type: "draft-report",
    direction: "lateral",
    status: "open",
    sender: P.cfo,
    recipient: P.owner,
    visibleTo: ["Owner", "CFO"],
    createdAt: _hoursAgo(18),
    updatedAt: _hoursAgo(18),
    attachments: [{ name: "march-pnl-draft.xlsx", size: "94 KB", type: "xlsx" }],
    unread: false,
    thread: [
      _sysEvent("created", "You created this task", _hoursAgo(18)),
      _msgEvent(P.cfo, "March P&L draft is ready. Net income **24,300.000 KWD**. Highlights: revenue up **10.5%**, marketing **23% over budget**, ops on plan.", _hoursAgo(18), [{ name: "march-pnl-draft.xlsx", size: "94 KB", type: "xlsx" }]),
    ],
  },
  // 21 — Layla → CFO, escalate, open
  {
    id: "TSK-121",
    subject: "Vendor refusing to send invoice",
    body: "The Sharq landlord won't send a formal invoice for the April rent payment. They said 'standing order, no invoice needed'. Need your guidance on documentation.",
    type: "escalate",
    direction: "upward",
    status: "open",
    sender: P.layla,
    recipient: P.cfo,
    visibleTo: ["CFO", "Junior"],
    createdAt: _hoursAgo(5),
    updatedAt: _hoursAgo(5),
    unread: true,
    thread: [
      _sysEvent("created", "Layla created this task", _hoursAgo(5)),
      _msgEvent(P.layla, "The Sharq landlord won't send a formal invoice for the April rent payment. They said 'standing order, no invoice needed'. Need your guidance on documentation.", _hoursAgo(5)),
    ],
  },
  // 22 — CFO → Sara, request-work, completed (reassigned earlier)
  {
    id: "TSK-122",
    subject: "Pull customer aging report — top 20",
    body: "Need an aging report for our top 20 customers. Format: 0-30, 31-60, 61-90, 90+. Include AR balance and last payment date.",
    type: "request-work",
    direction: "downward",
    status: "completed",
    sender: P.cfo,
    recipient: P.sara,
    visibleTo: ["CFO", "Junior"],
    createdAt: _daysAgo(3),
    updatedAt: _daysAgo(2),
    attachments: [{ name: "top20-aging.xlsx", size: "62 KB", type: "xlsx" }],
    unread: false,
    thread: [
      _sysEvent("created", "You created this task", _daysAgo(3)),
      _msgEvent(P.cfo, "Need an aging report for our top 20 customers. Format: 0-30, 31-60, 61-90, 90+. Include AR balance and last payment date.", _daysAgo(3)),
      _sysEvent("reassigned", "You reassigned this from Jasem to Sara", _daysAgo(3)),
      _msgEvent(P.sara, "Done — attached. Two customers are over 90 days: Gulf Logistics (8,400) and Marina Holdings (5,100).", _daysAgo(2), [{ name: "top20-aging.xlsx", size: "62 KB", type: "xlsx" }]),
      _sysEvent("completed", "Sara completed this task", _daysAgo(2)),
    ],
  },
  // 23 — CFO → Sara, request-work, in-progress
  {
    id: "TSK-123",
    subject: "Match Q1 expense receipts to bank charges",
    body: "We have 47 expense receipts from Q1 that need to be matched against bank charges. Use the receipts folder. Anything unmatched, flag for follow-up.",
    type: "request-work",
    direction: "downward",
    status: "in-progress",
    sender: P.cfo,
    recipient: P.sara,
    visibleTo: ["CFO", "Junior"],
    createdAt: _daysAgo(1),
    updatedAt: _hoursAgo(6),
    unread: false,
    thread: [
      _sysEvent("created", "You created this task", _daysAgo(1)),
      _msgEvent(P.cfo, "We have **47 expense receipts** from Q1 that need to be matched against bank charges. Use the receipts folder. Anything unmatched, flag for follow-up.", _daysAgo(1)),
      _msgEvent(P.sara, "31 of 47 matched so far. 4 receipts have no corresponding bank charge — investigating whether they were paid in cash.", _hoursAgo(6)),
      _sysEvent("status-changed", "Sara marked this in-progress", _hoursAgo(6)),
    ],
  },
  // 24 — Owner → CFO, general-question, completed
  {
    id: "TSK-124",
    subject: "Are we still on track for Q1 revenue target?",
    body: "Quick check before the partner call.",
    type: "general-question",
    direction: "lateral",
    status: "completed",
    sender: P.owner,
    recipient: P.cfo,
    visibleTo: ["Owner", "CFO"],
    createdAt: _daysAgo(4),
    updatedAt: _daysAgo(4),
    unread: false,
    thread: [
      _sysEvent("created", "Tarek created this task", _daysAgo(4)),
      _msgEvent(P.owner, "Quick check before the partner call.", _daysAgo(4)),
      _msgEvent(P.cfo, "Yes — Q1 actuals **612,400.000 KWD** vs target **600,000.000**. Hit 102% of target.", _daysAgo(4)),
      _sysEvent("completed", "Tarek completed this task", _daysAgo(4)),
    ],
  },
  // 25 — CFO → Sara, request-review, open with linked JE
  {
    id: "TSK-125",
    subject: "Review JE-0418 — wire fee adjustment",
    body: "I posted JE-0418 to fix the 0.500 KIB Settlement rounding discrepancy. Please double-check the entry before our weekly review.",
    type: "request-review",
    direction: "downward",
    status: "open",
    sender: P.cfo,
    recipient: P.sara,
    visibleTo: ["CFO", "Junior"],
    createdAt: _hoursAgo(2),
    updatedAt: _hoursAgo(2),
    linkedItem: { type: "journal-entry", id: "JE-0418", preview: "Wire fee adjustment · 0.500 KWD · Posted" },
    unread: true,
    thread: [
      _sysEvent("created", "You created this task", _hoursAgo(2)),
      _msgEvent(P.cfo, "I posted **JE-0418** to fix the 0.500 KIB Settlement rounding discrepancy. Please double-check the entry before our weekly review.", _hoursAgo(2)),
    ],
  },
];

export async function getTaskbox(role = "CFO", filter = "all") {
  await delay();
  let visible;
  if (role === "CFO") {
    visible = TASKBOX_DB; // CFO sees everything
  } else if (role === "Owner") {
    visible = TASKBOX_DB.filter(
      (t) => t.sender.id === "owner" || t.recipient.id === "owner" || (t.visibleTo || []).includes("Owner")
    );
  } else if (role === "Junior") {
    visible = TASKBOX_DB.filter(
      (t) => ["sara", "noor", "jasem", "layla"].includes(t.sender.id) || ["sara", "noor", "jasem", "layla"].includes(t.recipient.id)
    );
  } else {
    visible = [];
  }

  // Apply filter
  const me = role === "CFO" ? "cfo" : role === "Owner" ? "owner" : "sara";
  const isCancelled = (t) => t.status === "cancelled";
  switch (filter) {
    case "unread":
      visible = visible.filter((t) => t.unread && t.status !== "completed" && !isCancelled(t));
      break;
    case "approvals":
      visible = visible.filter(
        (t) => t.type === "request-approval" && !isCancelled(t) && t.status !== "completed"
      );
      break;
    case "received":
      visible = visible.filter((t) => t.recipient.id === me && !isCancelled(t));
      break;
    case "sent":
      // sent: include cancelled so the user remembers they cancelled it
      visible = visible.filter((t) => t.sender.id === me);
      break;
    case "needs-action":
      visible = visible.filter(
        (t) => t.recipient.id === me && t.status !== "completed" && !isCancelled(t)
      );
      break;
    case "completed":
      visible = visible.filter((t) => t.status === "completed");
      break;
    default:
      // "all" — show everything including cancelled (sorted last)
      break;
  }
  // Sort: open first by updatedAt desc, completed/cancelled last
  const sorted = visible
    .slice()
    .sort((a, b) => {
      const rank = (s) => (s === "cancelled" ? 2 : s === "completed" ? 1 : 0);
      const r = rank(a.status) - rank(b.status);
      if (r !== 0) return r;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
  return _brandObj(sorted);
}

// Counts for each Taskbox filter tab — single-pass, no per-filter delay
export async function getTaskboxCounts(role = "CFO") {
  await delay();
  const all = await getTaskbox(role, "all");
  const me = role === "CFO" ? "cfo" : role === "Owner" ? "owner" : "sara";
  const isCancelled = (t) => t.status === "cancelled";
  return {
    all:           all.length,
    unread:        all.filter((t) => t.unread && t.status !== "completed" && !isCancelled(t)).length,
    approvals:     all.filter((t) => t.type === "request-approval" && !isCancelled(t) && t.status !== "completed").length,
    received:      all.filter((t) => t.recipient.id === me && !isCancelled(t)).length,
    sent:          all.filter((t) => t.sender.id === me).length,
    "needs-action":all.filter((t) => t.recipient.id === me && t.status !== "completed" && !isCancelled(t)).length,
    completed:     all.filter((t) => t.status === "completed").length,
  };
}

export async function getTaskById(taskId) {
  await delay();
  return TASKBOX_DB.find((t) => t.id === taskId) || null;
}

export async function createTask(params) {
  await delay();
  const sender = P[params.senderId] || P.cfo;
  const newTask = {
    id: _newId(),
    subject: params.subject || "",
    body: params.body || "",
    type: params.type || "general-question",
    direction: getTaskTypeMeta(params.type).direction,
    status: "open",
    sender,
    recipient: params.recipient,
    visibleTo: params.visibleTo || [sender.role, params.recipient.role === "Owner" ? "Owner" : params.recipient.role === "CFO" ? "CFO" : "Junior"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    dueDate: params.dueDate || null,
    linkedItem: params.linkedItem || null,
    attachments: params.attachments || [],
    unread: true,
    thread: [
      _sysEvent("created", `${sender.name} created this task`),
      _msgEvent(sender, params.body || "", new Date().toISOString(), params.attachments || []),
    ],
  };
  TASKBOX_DB.unshift(newTask);
  return newTask;
}

export async function replyToTask(taskId, body, authorId = "cfo", attachments = []) {
  await delay();
  const t = TASKBOX_DB.find((x) => x.id === taskId);
  if (!t) return null;
  const author = P[authorId] || P.cfo;
  t.thread.push(_msgEvent(author, body, new Date().toISOString(), attachments));
  t.updatedAt = new Date().toISOString();
  return t;
}

export async function reassignTask(taskId, newRecipientId, note, byId = "cfo") {
  await delay();
  const t = TASKBOX_DB.find((x) => x.id === taskId);
  if (!t) return null;
  const newRecipient = P[newRecipientId];
  if (!newRecipient) return t;
  const by = P[byId];
  t.thread.push(_sysEvent("reassigned", `${by.name} reassigned this from ${t.recipient.name} to ${newRecipient.name}`));
  if (note) t.thread.push(_msgEvent(by, note));
  t.recipient = newRecipient;
  t.updatedAt = new Date().toISOString();
  return t;
}

export async function completeTask(taskId, completionNote, byId = "cfo") {
  await delay();
  const t = TASKBOX_DB.find((x) => x.id === taskId);
  if (!t) return null;
  const by = P[byId];
  if (completionNote) t.thread.push(_msgEvent(by, completionNote));
  t.thread.push(_sysEvent("completed", `${by.name} completed this task`));
  t.status = "completed";
  t.updatedAt = new Date().toISOString();
  return t;
}

export async function getOpenTaskCount(role = "CFO") {
  await delay();
  const all = await getTaskbox(role, "all");
  return all.filter((t) => t.status !== "completed").length;
}

export async function getTaskTypesForDirection(direction) {
  await delay();
  if (direction === "any") return TASK_TYPES;
  return TASK_TYPES.filter((t) => t.direction === direction || t.direction === "lateral");
}

export async function getRecipientsForRole(senderRole) {
  await delay();
  if (senderRole === "Owner") return [P.cfo];
  if (senderRole === "CFO") return [P.owner, P.sara, P.noor, P.jasem, P.layla];
  if (senderRole === "Junior") return [P.cfo];
  return [];
}

// ─────────────────────────────────────────
// RULES SYSTEM — categorization + routing
// ─────────────────────────────────────────

const _rAudit = (type, author, detail, iso) => ({
  id: `EV-${Math.random().toString(36).slice(2, 8)}`,
  type,
  timestamp: iso || new Date().toISOString(),
  author,
  detail,
});

const CAT_RULES_DB = [
  {
    id: "CRULE-001",
    name: "KNPC Fuel Station auto-categorization",
    merchantPattern: { type: "contains", value: "KNPC" },
    debitAccount:  { code: "6420", name: "Fuel & Vehicle" },
    creditAccount: { code: "1120", name: "KIB Operating Account" },
    mode: "auto-apply",
    conditions: { amountMin: null, amountMax: null, sourceAccount: "KIB Operating" },
    costCenter: null,
    approvalThreshold: null,
    status: "active",
    appliedCount: 47,
    createdBy: P.sara,
    createdAt: _daysAgo(115),
    lastAppliedAt: _hoursAgo(4),
    auditTrail: [
      _rAudit("created", P.sara, "Sara created this rule", _daysAgo(115)),
      _rAudit("applied-summary", P.cfo, "Applied 47 times since creation", _hoursAgo(4)),
    ],
  },
  {
    id: "CRULE-002",
    name: "Ooredoo → Internet & Phone",
    merchantPattern: { type: "contains", value: "Ooredoo" },
    debitAccount:  { code: "6220", name: "Internet & Phone" },
    creditAccount: { code: "1120", name: "KIB Operating Account" },
    mode: "auto-apply",
    conditions: { amountMin: null, amountMax: null, sourceAccount: null },
    costCenter: null, approvalThreshold: null,
    status: "active", appliedCount: 12,
    createdBy: P.noor, createdAt: _daysAgo(97), lastAppliedAt: _daysAgo(1),
    auditTrail: [ _rAudit("created", P.noor, "Noor created this rule", _daysAgo(97)) ],
  },
  {
    id: "CRULE-003",
    name: "Office rent Sharq → Office Rent",
    merchantPattern: { type: "contains", value: "Office rent" },
    debitAccount:  { code: "6200", name: "Office Rent" },
    creditAccount: { code: "1120", name: "KIB Operating Account" },
    mode: "auto-apply",
    conditions: { amountMin: null, amountMax: null, sourceAccount: "KIB Operating" },
    costCenter: "HQ", approvalThreshold: null,
    status: "active", appliedCount: 8,
    createdBy: P.cfo, createdAt: _daysAgo(115), lastAppliedAt: _daysAgo(1),
    auditTrail: [
      _rAudit("created", P.cfo, "You created this rule", _daysAgo(115)),
      _rAudit("edited",  P.cfo, "You added cost center HQ",        _daysAgo(90)),
    ],
  },
  {
    id: "CRULE-004",
    name: "Deliveroo payout → Sales Revenue",
    merchantPattern: { type: "contains", value: "Deliveroo" },
    debitAccount:  { code: "1120", name: "KIB Operating Account" },
    creditAccount: { code: "4100", name: "Sales Revenue" },
    mode: "auto-apply",
    conditions: { amountMin: null, amountMax: null, sourceAccount: null },
    costCenter: null, approvalThreshold: null,
    status: "active", appliedCount: 23,
    createdBy: P.sara, createdAt: _daysAgo(110), lastAppliedAt: _daysAgo(2),
    auditTrail: [ _rAudit("created", P.sara, "Sara created this rule", _daysAgo(110)) ],
  },
  {
    id: "CRULE-005",
    name: "Alghanim Industries → Sales Revenue",
    merchantPattern: { type: "contains", value: "Alghanim" },
    debitAccount:  { code: "1120", name: "KIB Operating Account" },
    creditAccount: { code: "4100", name: "Sales Revenue" },
    mode: "auto-apply",
    conditions: { amountMin: null, amountMax: null, sourceAccount: null },
    costCenter: null, approvalThreshold: null,
    status: "active", appliedCount: 15,
    createdBy: P.cfo, createdAt: _daysAgo(99), lastAppliedAt: _hoursAgo(6),
    auditTrail: [ _rAudit("created", P.cfo, "You created this rule", _daysAgo(99)) ],
  },
  {
    id: "CRULE-006",
    name: "Avenues Mall booth → Trade Shows",
    merchantPattern: { type: "contains", value: "Avenues Mall" },
    debitAccount:  { code: "6310", name: "Trade Shows" },
    creditAccount: { code: "1120", name: "KIB Operating Account" },
    mode: "auto-apply",
    conditions: { amountMin: null, amountMax: null, sourceAccount: null },
    costCenter: "Marketing", approvalThreshold: null,
    status: "active", appliedCount: 3,
    createdBy: P.cfo, createdAt: _daysAgo(1), lastAppliedAt: _hoursAgo(3),
    auditTrail: [ _rAudit("created", P.cfo, "You created this rule", _daysAgo(1)) ],
  },
  {
    id: "CRULE-007",
    name: "Staff salary Sara → Salaries & Wages",
    merchantPattern: { type: "exact", value: "PAYROLL-SARA" },
    debitAccount:  { code: "6100", name: "Salaries & Wages" },
    creditAccount: { code: "1120", name: "KIB Operating Account" },
    mode: "auto-apply",
    conditions: { amountMin: null, amountMax: null, sourceAccount: "KIB Operating" },
    costCenter: null, approvalThreshold: 500,
    status: "active", appliedCount: 6,
    createdBy: P.cfo, createdAt: _daysAgo(80), lastAppliedAt: _daysAgo(5),
    auditTrail: [ _rAudit("created", P.cfo, "You created this rule", _daysAgo(80)) ],
  },
  {
    id: "CRULE-008",
    name: "Zain Kuwait → Internet & Phone",
    merchantPattern: { type: "contains", value: "Zain" },
    debitAccount:  { code: "6220", name: "Internet & Phone" },
    creditAccount: { code: "1120", name: "KIB Operating Account" },
    mode: "auto-apply",
    conditions: { amountMin: null, amountMax: null, sourceAccount: null },
    costCenter: null, approvalThreshold: null,
    status: "active", appliedCount: 18,
    createdBy: P.sara, createdAt: _daysAgo(88), lastAppliedAt: _hoursAgo(20),
    auditTrail: [ _rAudit("created", P.sara, "Sara created this rule", _daysAgo(88)) ],
  },
  {
    id: "CRULE-009",
    name: "KNPC trade → Fuel & Vehicle (MUTED)",
    merchantPattern: { type: "contains", value: "KNPC-TRADE" },
    debitAccount:  { code: "6420", name: "Fuel & Vehicle" },
    creditAccount: { code: "1120", name: "KIB Operating Account" },
    mode: "auto-apply",
    conditions: { amountMin: null, amountMax: null, sourceAccount: null },
    costCenter: null, approvalThreshold: null,
    status: "muted", appliedCount: 4,
    createdBy: P.sara, createdAt: _daysAgo(60), lastAppliedAt: _daysAgo(10),
    auditTrail: [
      _rAudit("created", P.sara, "Sara created this rule", _daysAgo(60)),
      _rAudit("muted",   P.cfo,  "You muted this rule — policy change", _daysAgo(3)),
    ],
  },
  {
    id: "CRULE-010",
    name: "PIFSS payment → PIFSS Contributions",
    merchantPattern: { type: "contains", value: "PIFSS" },
    debitAccount:  { code: "6110", name: "PIFSS Contributions" },
    creditAccount: { code: "2200", name: "PIFSS Payable" },
    mode: "suggest-only",
    conditions: { amountMin: null, amountMax: null, sourceAccount: null },
    costCenter: null, approvalThreshold: null,
    status: "active", appliedCount: 11,
    createdBy: P.cfo, createdAt: _daysAgo(70), lastAppliedAt: _daysAgo(4),
    auditTrail: [ _rAudit("created", P.cfo, "You created this rule", _daysAgo(70)) ],
  },
  {
    id: "CRULE-011",
    name: "Office supplies batch → Office Supplies",
    merchantPattern: { type: "contains", value: "office supplies" },
    debitAccount:  { code: "6600", name: "Office Supplies" },
    creditAccount: { code: "1120", name: "KIB Operating Account" },
    mode: "auto-apply",
    conditions: { amountMin: null, amountMax: 200, sourceAccount: null },
    costCenter: null, approvalThreshold: null,
    status: "active", appliedCount: 9,
    createdBy: P.sara, createdAt: _daysAgo(55), lastAppliedAt: _daysAgo(2),
    auditTrail: [ _rAudit("created", P.sara, "Sara created this rule", _daysAgo(55)) ],
  },
  {
    id: "CRULE-012",
    name: "Boubyan Logistics → Accounts Payable",
    merchantPattern: { type: "contains", value: "Boubyan Logistics" },
    debitAccount:  { code: "2100", name: "Accounts Payable" },
    creditAccount: { code: "1120", name: "KIB Operating Account" },
    mode: "ask-each-time",
    conditions: { amountMin: null, amountMax: null, sourceAccount: null },
    costCenter: null, approvalThreshold: null,
    status: "active", appliedCount: 7,
    createdBy: P.sara, createdAt: _daysAgo(45), lastAppliedAt: _daysAgo(6),
    auditTrail: [ _rAudit("created", P.sara, "Sara created this rule", _daysAgo(45)) ],
  },
];

const ROUTING_RULES_DB = [
  {
    id: "RRULE-001",
    name: "All expense categorization → Sara",
    trigger: { taskTypes: ["categorize-transactions"], linkedItemTypes: [], conditions: {} },
    action: { assignTo: P.sara, alsoNotify: null, priority: "normal" },
    status: "active", appliedCount: 34,
    createdBy: P.cfo, createdAt: _daysAgo(90), lastAppliedAt: _hoursAgo(5),
    auditTrail: [ _rAudit("created", P.cfo, "You created this rule", _daysAgo(90)) ],
  },
  {
    id: "RRULE-002",
    name: "All invoice work → Jasem",
    trigger: { taskTypes: ["upload-document", "request-work"], linkedItemTypes: ["invoice"], conditions: {} },
    action: { assignTo: P.jasem, alsoNotify: null, priority: "normal" },
    status: "active", appliedCount: 19,
    createdBy: P.cfo, createdAt: _daysAgo(70), lastAppliedAt: _hoursAgo(13),
    auditTrail: [ _rAudit("created", P.cfo, "You created this rule", _daysAgo(70)) ],
  },
  {
    id: "RRULE-003",
    name: "Marketing-related tasks → Layla",
    trigger: {
      taskTypes: ["all"], linkedItemTypes: [],
      conditions: { accountCategory: "Operating Expenses", merchantPattern: "marketing|advertising|campaign|trade show" },
    },
    action: { assignTo: P.layla, alsoNotify: null, priority: "normal" },
    status: "active", appliedCount: 11,
    createdBy: P.cfo, createdAt: _daysAgo(50), lastAppliedAt: _daysAgo(2),
    auditTrail: [ _rAudit("created", P.cfo, "You created this rule", _daysAgo(50)) ],
  },
  {
    id: "RRULE-004",
    name: "Bank reconciliations → Noor",
    trigger: { taskTypes: ["reconcile-account"], linkedItemTypes: ["account"], conditions: { accountCategory: "Assets" } },
    action: { assignTo: P.noor, alsoNotify: null, priority: "normal" },
    status: "active", appliedCount: 15,
    createdBy: P.cfo, createdAt: _daysAgo(65), lastAppliedAt: _daysAgo(3),
    auditTrail: [ _rAudit("created", P.cfo, "You created this rule", _daysAgo(65)) ],
  },
  {
    id: "RRULE-005",
    name: "JE drafts > 5,000 KWD → request CFO approval",
    trigger: { taskTypes: ["draft-je"], linkedItemTypes: ["journal-entry"], conditions: { amountMin: 5000 } },
    action: { assignTo: P.sara, alsoNotify: [P.cfo.id], priority: "high" },
    status: "active", appliedCount: 7,
    createdBy: P.cfo, createdAt: _daysAgo(40), lastAppliedAt: _daysAgo(1),
    auditTrail: [ _rAudit("created", P.cfo, "You created this rule", _daysAgo(40)) ],
  },
  {
    id: "RRULE-006",
    name: "PIFSS and payroll related → Noor",
    trigger: { taskTypes: ["all"], linkedItemTypes: [], conditions: { merchantPattern: "pifss|payroll|salary" } },
    action: { assignTo: P.noor, alsoNotify: null, priority: "normal" },
    status: "active", appliedCount: 12,
    createdBy: P.cfo, createdAt: _daysAgo(55), lastAppliedAt: _daysAgo(2),
    auditTrail: [ _rAudit("created", P.cfo, "You created this rule", _daysAgo(55)) ],
  },
  {
    id: "RRULE-007",
    name: "Audit responses → Sara",
    trigger: { taskTypes: ["request-investigation", "flag-for-review"], linkedItemTypes: [], conditions: {} },
    action: { assignTo: P.sara, alsoNotify: null, priority: "high" },
    status: "active", appliedCount: 4,
    createdBy: P.cfo, createdAt: _daysAgo(30), lastAppliedAt: _daysAgo(4),
    auditTrail: [ _rAudit("created", P.cfo, "You created this rule", _daysAgo(30)) ],
  },
  {
    id: "RRULE-008",
    name: "JE approvals above 10,000 KWD → escalate to Owner (MUTED)",
    trigger: { taskTypes: ["request-approval"], linkedItemTypes: ["journal-entry"], conditions: { amountMin: 10000 } },
    action: { assignTo: P.cfo, alsoNotify: [P.owner.id], priority: "urgent" },
    status: "muted", appliedCount: 3,
    createdBy: P.cfo, createdAt: _daysAgo(50), lastAppliedAt: _daysAgo(9),
    auditTrail: [
      _rAudit("created", P.cfo, "You created this rule", _daysAgo(50)),
      _rAudit("muted",   P.cfo, "You muted this rule last week", _daysAgo(7)),
    ],
  },
];

const _filterRule = (arr, filter) => {
  if (!filter || filter === "all") return arr.filter((r) => r.status !== "deleted");
  return arr.filter((r) => r.status === filter);
};

export async function getCategorizationRules(filter = "all") {
  await delay();
  return _filterRule(CAT_RULES_DB, filter).slice();
}
export async function getCategorizationRuleById(id) {
  await delay();
  return CAT_RULES_DB.find((r) => r.id === id) || null;
}
export async function createCategorizationRule(params) {
  await delay();
  const id = `CRULE-${String(CAT_RULES_DB.length + 1).padStart(3, "0")}`;
  const rule = {
    id,
    name: params.name || "Untitled rule",
    merchantPattern: params.merchantPattern || { type: "contains", value: "" },
    debitAccount: params.debitAccount || { code: "", name: "" },
    creditAccount: params.creditAccount || { code: "", name: "" },
    mode: params.mode || "suggest-only",
    conditions: params.conditions || { amountMin: null, amountMax: null, sourceAccount: null },
    costCenter: params.costCenter || null,
    approvalThreshold: params.approvalThreshold || null,
    status: "active",
    appliedCount: 0,
    createdBy: P.cfo,
    createdAt: new Date().toISOString(),
    lastAppliedAt: null,
    auditTrail: [ _rAudit("created", P.cfo, "You created this rule") ],
  };
  CAT_RULES_DB.unshift(rule);
  return rule;
}
export async function muteCategorizationRule(id) {
  await delay();
  const r = CAT_RULES_DB.find((x) => x.id === id);
  if (r) { r.status = "muted"; r.auditTrail.push(_rAudit("muted", P.cfo, "You muted this rule")); }
  return r;
}
export async function unmuteCategorizationRule(id) {
  await delay();
  const r = CAT_RULES_DB.find((x) => x.id === id);
  if (r) { r.status = "active"; r.auditTrail.push(_rAudit("unmuted", P.cfo, "You re-activated this rule")); }
  return r;
}
export async function deleteCategorizationRule(id) {
  await delay();
  const r = CAT_RULES_DB.find((x) => x.id === id);
  if (r) { r.status = "deleted"; r.auditTrail.push(_rAudit("deleted", P.cfo, "You deleted this rule")); }
  return r;
}
export async function getCategorizationRuleAuditTrail(id) {
  await delay();
  const r = CAT_RULES_DB.find((x) => x.id === id);
  return r ? r.auditTrail : [];
}
export async function getSuggestedCategorizationRules() {
  await delay();
  return [
    { id: "SUG-CAT-1", kind: "categorization", count: 4, merchant: "Al Shaya Trading Co.",    target: "Operating Expense", context: "Based on 4 manual categorizations in the last 7 days" },
    { id: "SUG-CAT-2", kind: "categorization", count: 3, merchant: "Talabat payouts",          target: "Sales Revenue",      context: "Based on 3 manual categorizations in the last 5 days" },
    { id: "SUG-CAT-3", kind: "categorization", count: 3, merchant: "STC telecom bills",        target: "Internet & Phone",   context: "Based on 3 manual categorizations in the last 10 days" },
  ];
}

export async function getRoutingRules(filter = "all") {
  await delay();
  return _filterRule(ROUTING_RULES_DB, filter).slice();
}
export async function getRoutingRuleById(id) {
  await delay();
  return ROUTING_RULES_DB.find((r) => r.id === id) || null;
}
export async function createRoutingRule(params) {
  await delay();
  const id = `RRULE-${String(ROUTING_RULES_DB.length + 1).padStart(3, "0")}`;
  const rule = {
    id,
    name: params.name || "Untitled routing rule",
    trigger: params.trigger || { taskTypes: ["all"], linkedItemTypes: [], conditions: {} },
    action: params.action || { assignTo: P.sara, alsoNotify: null, priority: "normal" },
    status: "active",
    appliedCount: 0,
    createdBy: P.cfo,
    createdAt: new Date().toISOString(),
    lastAppliedAt: null,
    auditTrail: [ _rAudit("created", P.cfo, "You created this rule") ],
  };
  ROUTING_RULES_DB.unshift(rule);
  return rule;
}
export async function muteRoutingRule(id) {
  await delay();
  const r = ROUTING_RULES_DB.find((x) => x.id === id);
  if (r) { r.status = "muted"; r.auditTrail.push(_rAudit("muted", P.cfo, "You muted this rule")); }
  return r;
}
export async function unmuteRoutingRule(id) {
  await delay();
  const r = ROUTING_RULES_DB.find((x) => x.id === id);
  if (r) { r.status = "active"; r.auditTrail.push(_rAudit("unmuted", P.cfo, "You re-activated this rule")); }
  return r;
}
export async function deleteRoutingRule(id) {
  await delay();
  const r = ROUTING_RULES_DB.find((x) => x.id === id);
  if (r) { r.status = "deleted"; r.auditTrail.push(_rAudit("deleted", P.cfo, "You deleted this rule")); }
  return r;
}
export async function getRoutingRuleAuditTrail(id) {
  await delay();
  const r = ROUTING_RULES_DB.find((x) => x.id === id);
  return r ? r.auditTrail : [];
}
export async function getSuggestedRoutingRules() {
  await delay();
  return [
    { id: "SUG-RTE-1", kind: "routing", count: 4, description: "Vendor onboarding tasks → Jasem",   context: "You manually assigned the last 4 vendor onboarding tasks to Jasem" },
    { id: "SUG-RTE-2", kind: "routing", count: 3, description: "Month-end accrual drafts → Noor",   context: "You manually assigned 3 month-end accrual drafts to Noor" },
  ];
}

export async function getOpenApprovalCount(role = "CFO") {
  await delay();
  const all = await getTaskbox(role, "all");
  return all.filter((t) => t.type === "request-approval" && t.status !== "completed" && t.status !== "rejected").length;
}

// Enhance TSK-113 with a full JE linked item so approval preview can render the JournalEntryCard
const _tsk113 = TASKBOX_DB.find((t) => t.id === "TSK-113");
if (_tsk113) {
  _tsk113.linkedItem = {
    type: "journal-entry",
    id: "JE-0415",
    preview: "PIFSS accrual · 9,500.000 KWD · Draft",
    entry: {
      id: "JE-0415",
      description: "PIFSS accrual — March",
      status: "Draft - Validated",
      lines: [
        { account: "PIFSS Contributions", code: "6110", debit: 9500, credit: null },
        { account: "PIFSS Payable",       code: "2200", debit: null,  credit: 9500 },
      ],
      totalDebit: 9500,
      totalCredit: 9500,
      balanced: true,
      mappingVersion: "v1.0",
      createdAt: new Date().toISOString(),
      hashChainStatus: "not committed",
    },
  };
}

// ─────────────────────────────────────────
// BANK ACCOUNTS
// ─────────────────────────────────────────

const BANK_ACCOUNTS_DB = [
  {
    id: "ACC-1",
    bankName: "KIB",
    accountName: "KIB Operating Account",
    accountNumberMasked: "KWIB •••• 8472",
    accountType: "operating",
    currency: "KWD",
    currentBalance: 142100.25,
    availableBalance: 142100.25,
    mtdInflow:  87420.0,
    mtdOutflow: 63180.5,
    lastUpdated: _hoursAgo(0),
    status: "active",
    accentColor: "#00C48C",
  },
  {
    id: "ACC-2",
    bankName: "KIB",
    accountName: "KIB Reserve Account",
    accountNumberMasked: "KWIB •••• 9211",
    accountType: "reserve",
    currency: "KWD",
    currentBalance: 42135.25,
    availableBalance: 42135.25,
    mtdInflow:  0,
    mtdOutflow: 0,
    lastUpdated: _hoursAgo(1),
    status: "active",
    accentColor: "#3B82F6",
  },
  {
    id: "ACC-3",
    bankName: "KIB",
    accountName: "KIB Settlement Account",
    accountNumberMasked: "KWIB •••• 3049",
    accountType: "settlement",
    currency: "KWD",
    currentBalance: 18420.75,
    availableBalance: 18420.75,
    mtdInflow:  23890.0,
    mtdOutflow: 18200.0,
    lastUpdated: _hoursAgo(0),
    status: "active",
    accentColor: "#8B5CF6",
  },
  {
    id: "ACC-4",
    bankName: "KIB",
    accountName: "KIB USD Account",
    accountNumberMasked: "KWIB •••• 5560",
    accountType: "usd",
    currency: "USD",
    currentBalance: 8240.5,
    availableBalance: 8240.5,
    mtdInflow:  5000.0,
    mtdOutflow: 2800.0,
    lastUpdated: _hoursAgo(3),
    status: "active",
    accentColor: "#D4A84B",
  },
];

const _cat = (method, category, ruleId, jeId) => ({
  method, category, ruleId: ruleId || null, journalEntryId: jeId || null,
});

function _mkStmt(accountId, txs, startingBalance) {
  // txs are given oldest-first. Compute running balance forward.
  let bal = startingBalance;
  const enriched = txs.map((t, i) => {
    bal += t.amount;
    return {
      id: `BST-${accountId}-${String(i + 1).padStart(3, "0")}`,
      accountId,
      ...t,
      runningBalance: Number(bal.toFixed(3)),
    };
  });
  // Return newest-first
  return enriched.slice().reverse();
}

// Account 1 — KIB Operating — 30 tx, starting balance ~118k, ending 142,100.250
const _acc1Tx = (() => {
  const now = new Date();
  const d = (n, h = 10, m = 0) => {
    const x = new Date(now);
    x.setDate(x.getDate() - n);
    x.setHours(h, m, 0, 0);
    return x.toISOString();
  };
  return [
    { date: d(13,  9,  0), description: "Opening adjustment",              reference: "ADJ-0001",  amount:  0,         type: "credit",   categorization: _cat("MANUAL",  "Opening Balance") },
    { date: d(13, 14, 30), description: "Talabat payout",                  reference: "TLB-88412", amount:  3800.0,   type: "credit",   categorization: _cat("RULE",    "Sales Revenue",       "CRULE-004") },
    { date: d(12, 11, 15), description: "KNPC fuel cards",                 reference: "KNPC-2211", amount: -1820.5,   type: "debit",    categorization: _cat("RULE",    "Fuel & Vehicle",      "CRULE-001") },
    { date: d(12, 16, 45), description: "Alghanim Industries — payment",   reference: "ALG-9918",  amount: 12450.0,   type: "credit",   categorization: _cat("PATTERN", "Sales Revenue") },
    { date: d(11, 10,  0), description: "Zain Kuwait — corporate lines",   reference: "ZN-44812",  amount:  -624.75,  type: "debit",    categorization: _cat("RULE",    "Internet & Phone",    "CRULE-008") },
    { date: d(11, 15, 20), description: "Al Shaya Trading — invoice #2847",reference: "ALS-2847",  amount: -8740.0,   type: "debit",    categorization: _cat("MANUAL",  "Cost of Goods Sold") },
    { date: d(10,  9,  0), description: "Office rent — Sharq",             reference: "RENT-APR",  amount: -4200.0,   type: "debit",    categorization: _cat("RULE",    "Office Rent",         "CRULE-003") },
    { date: d(10, 13, 15), description: "Deliveroo payout",                reference: "DLV-3321",  amount:  2310.0,   type: "credit",   categorization: _cat("RULE",    "Sales Revenue",       "CRULE-004") },
    { date: d( 9,  9,  0), description: "KIB transfer — payroll run",      reference: "PAY-MAR",   amount:-18500.0,   type: "transfer", categorization: _cat("MANUAL",  "Salaries & Wages"),        counterparty: "Payroll batch" },
    { date: d( 9, 14,  0), description: "Staff salary — Sara",             reference: "PAY-SARA",  amount: -2200.0,   type: "debit",    categorization: _cat("RULE",    "Salaries & Wages",    "CRULE-007") },
    { date: d( 8, 11, 20), description: "Ooredoo fiber",                   reference: "OOR-7712",  amount:  -135.0,   type: "debit",    categorization: _cat("RULE",    "Internet & Phone",    "CRULE-002") },
    { date: d( 8, 16, 30), description: "Avenues Mall — booth fee Q2",     reference: "AVN-5521",  amount: -3100.0,   type: "debit",    categorization: _cat("AI",      "Trade Shows") },
    { date: d( 7, 10, 15), description: "Al Shaya Trading",                reference: "ALS-9902",  amount:  8740.0,   type: "credit",   categorization: _cat("RULE",    "Sales Revenue",       "CRULE-005") },
    { date: d( 7, 12,  0), description: "Office supplies — batch",         reference: "OFS-4412",  amount:  -182.5,   type: "debit",    categorization: _cat("RULE",    "Office Supplies",     "CRULE-011") },
    { date: d( 6,  9, 30), description: "Boubyan transfer in — unidentified", reference: "TRF-INT-2847", amount: 2462.5, type: "transfer", categorization: _cat("PENDING", "Needs review"),        counterparty: "Boubyan (?)" },
    { date: d( 6, 15, 40), description: "MyFatoorah settlement",           reference: "MF-2019",   amount:  5612.25,  type: "credit",   categorization: _cat("PATTERN", "Sales Revenue") },
    { date: d( 5, 11,  0), description: "KNPC fuel cards",                 reference: "KNPC-2315", amount:  -980.25,  type: "debit",    categorization: _cat("RULE",    "Fuel & Vehicle",      "CRULE-001") },
    { date: d( 5, 14, 20), description: "Gulf Logistics WLL",              reference: "GLG-1102",  amount: -4200.0,   type: "debit",    categorization: _cat("MANUAL",  "Accounts Payable") },
    { date: d( 4, 10, 30), description: "Alghanim Industries — payment",   reference: "ALG-9921",  amount:  8740.0,   type: "credit",   categorization: _cat("PATTERN", "Sales Revenue") },
    { date: d( 4, 13, 15), description: "Cleaning services",               reference: "CLN-0412",  amount:  -135.0,   type: "debit",    categorization: _cat("MANUAL",  "Cleaning & Maintenance") },
    { date: d( 3,  9, 45), description: "Bank charges",                    reference: "BCH-APR",   amount:   -12.5,   type: "debit",    categorization: _cat("MANUAL",  "Bank Charges") },
    { date: d( 3, 14, 30), description: "Deliveroo payout",                reference: "DLV-3398",  amount:  1840.0,   type: "credit",   categorization: _cat("RULE",    "Sales Revenue",       "CRULE-004") },
    { date: d( 2, 10, 15), description: "KNPC fuel cards",                 reference: "KNPC-2401", amount: -1420.75,  type: "debit",    categorization: _cat("RULE",    "Fuel & Vehicle",      "CRULE-001") },
    { date: d( 2, 16,  0), description: "Talabat payout",                  reference: "TLB-88492", amount:  2940.0,   type: "credit",   categorization: _cat("RULE",    "Sales Revenue",       "CRULE-004") },
    { date: d( 1,  9,  0), description: "Office rent — Sharq",             reference: "RENT-EXT",  amount:  -280.0,   type: "debit",    categorization: _cat("RULE",    "Office Rent",         "CRULE-003") },
    { date: d( 1, 12, 30), description: "PIFSS contribution",              reference: "PIFSS-MAR", amount: -4862.5,   type: "debit",    categorization: _cat("PATTERN", "PIFSS Contributions") },
    { date: d( 1, 15, 45), description: "Alghanim Industries — payment",   reference: "ALG-9941",  amount: 12450.0,   type: "credit",   categorization: _cat("PATTERN", "Sales Revenue") },
    { date: d( 0,  9, 45), description: "Al Shaya Trading",                reference: "ALS-1011",  amount:  8740.0,   type: "credit",   categorization: _cat("RULE",    "Sales Revenue",       "CRULE-005") },
    { date: d( 0, 11,  5), description: "KNPC fuel cards",                 reference: "KNPC-2498", amount: -1820.5,   type: "debit",    categorization: _cat("RULE",    "Fuel & Vehicle",      "CRULE-001") },
    { date: d( 0, 14, 14), description: "Talabat payout",                  reference: "TLB-88521", amount:  3800.0,   type: "credit",   categorization: _cat("RULE",    "Sales Revenue",       "CRULE-004") },
  ];
})();

const _acc2Tx = (() => {
  const now = new Date();
  const d = (n, h = 10) => { const x = new Date(now); x.setDate(x.getDate() - n); x.setHours(h, 0, 0, 0); return x.toISOString(); };
  return [
    { date: d(13), description: "Opening adjustment",      reference: "ADJ-RSV", amount: 0,       type: "credit",   categorization: _cat("MANUAL", "Opening Balance") },
    { date: d(11), description: "Interest credit — March", reference: "INT-MAR", amount:  85.25,  type: "credit",   categorization: _cat("RULE",   "Interest Income") },
    { date: d(10), description: "Interest credit — March", reference: "INT-MAR2",amount:  40.0,   type: "credit",   categorization: _cat("RULE",   "Interest Income") },
    { date: d( 9), description: "Reserve top-up transfer", reference: "TRF-901", amount: 10000.0, type: "transfer", categorization: _cat("MANUAL", "Transfer"), counterparty: "KIB Operating" },
    { date: d( 8), description: "Reserve top-up transfer", reference: "TRF-902", amount:  5000.0, type: "transfer", categorization: _cat("MANUAL", "Transfer"), counterparty: "KIB Operating" },
    { date: d( 6), description: "Bank charges",            reference: "BCH-R1",  amount:   -3.0,  type: "debit",    categorization: _cat("MANUAL", "Bank Charges") },
    { date: d( 5), description: "Interest credit",         reference: "INT-MAR3",amount:  25.0,   type: "credit",   categorization: _cat("RULE",   "Interest Income") },
    { date: d( 4), description: "Reserve top-up transfer", reference: "TRF-903", amount:  8000.0, type: "transfer", categorization: _cat("MANUAL", "Transfer"), counterparty: "KIB Operating" },
    { date: d( 3), description: "Bank charges",            reference: "BCH-R2",  amount:   -3.0,  type: "debit",    categorization: _cat("MANUAL", "Bank Charges") },
    { date: d( 2), description: "Interest credit",         reference: "INT-MAR4",amount:  18.5,   type: "credit",   categorization: _cat("RULE",   "Interest Income") },
    { date: d( 1), description: "Reserve top-up transfer", reference: "TRF-904", amount:  4000.0, type: "transfer", categorization: _cat("MANUAL", "Transfer"), counterparty: "KIB Operating" },
    { date: d( 0), description: "Interest credit",         reference: "INT-MAR5",amount:  12.5,   type: "credit",   categorization: _cat("RULE",   "Interest Income") },
  ];
})();

const _acc3Tx = (() => {
  const now = new Date();
  const d = (n, h = 12) => { const x = new Date(now); x.setDate(x.getDate() - n); x.setHours(h, 0, 0, 0); return x.toISOString(); };
  const rows = [];
  rows.push({ date: d(13, 9), description: "Opening adjustment", reference: "ADJ-SET", amount: 0, type: "credit", categorization: _cat("MANUAL", "Opening Balance") });
  for (let i = 12; i >= 0; i--) {
    rows.push({ date: d(i, 15),  description: "POS settlement — batch", reference: `POS-${3000 + i}`, amount: 1420.0 + i * 35,  type: "credit", categorization: _cat("RULE", "Sales Revenue", "CRULE-004") });
    rows.push({ date: d(i, 16),  description: "Acquirer fees",           reference: `ACQ-${3000 + i}`, amount: -(85 + i * 3),   type: "debit",  categorization: _cat("RULE", "Bank Charges") });
  }
  return rows;
})();

const _acc4Tx = (() => {
  const now = new Date();
  const d = (n) => { const x = new Date(now); x.setDate(x.getDate() - n); x.setHours(10, 0, 0, 0); return x.toISOString(); };
  return [
    { date: d(13), description: "Opening adjustment",          reference: "ADJ-USD", amount: 0,        type: "credit",   categorization: _cat("MANUAL", "Opening Balance") },
    { date: d(11), description: "Wire in — international client",reference: "WIRE-441", amount: 3500.0, type: "credit",  categorization: _cat("PATTERN","Service Revenue") },
    { date: d( 9), description: "Vendor wire — software license",reference: "WIRE-442", amount: -1200.0,type: "debit",   categorization: _cat("MANUAL", "Professional Fees") },
    { date: d( 7), description: "Wire in — international client",reference: "WIRE-443", amount: 1500.0, type: "credit",  categorization: _cat("PATTERN","Service Revenue") },
    { date: d( 5), description: "Vendor wire — AWS hosting",     reference: "WIRE-444", amount:  -800.0,type: "debit",   categorization: _cat("RULE",   "Internet & Phone") },
    { date: d( 3), description: "Bank charges — wire fee",       reference: "BCH-USD",  amount:   -25.0,type: "debit",   categorization: _cat("MANUAL", "Bank Charges") },
    { date: d( 1), description: "Vendor wire — contractor",      reference: "WIRE-445", amount:  -775.0,type: "debit",   categorization: _cat("MANUAL", "Professional Fees") },
    { date: d( 0), description: "Wire in — international client",reference: "WIRE-446", amount:    0.0, type: "credit",  categorization: _cat("PATTERN","Service Revenue") },
  ];
})();

// Compute opening balances so the final running balance matches currentBalance
function _computeOpening(txs, targetEnding) {
  const net = txs.reduce((s, t) => s + t.amount, 0);
  return Number((targetEnding - net).toFixed(3));
}

const _openingBalances = {
  "ACC-1": _computeOpening(_acc1Tx, 142100.25),
  "ACC-2": _computeOpening(_acc2Tx, 42135.25),
  "ACC-3": _computeOpening(_acc3Tx, 18420.75),
  "ACC-4": _computeOpening(_acc4Tx, 8240.5),
};

const _statements = {
  "ACC-1": _mkStmt("ACC-1", _acc1Tx, _openingBalances["ACC-1"]),
  "ACC-2": _mkStmt("ACC-2", _acc2Tx, _openingBalances["ACC-2"]),
  "ACC-3": _mkStmt("ACC-3", _acc3Tx, _openingBalances["ACC-3"]),
  "ACC-4": _mkStmt("ACC-4", _acc4Tx, _openingBalances["ACC-4"]),
};

export async function getBankAccounts() {
  await delay();
  return _brandObj(BANK_ACCOUNTS_DB.slice());
}

export async function getBankAccountById(id) {
  await delay();
  return _brandObj(BANK_ACCOUNTS_DB.find((a) => a.id === id) || null);
}

export async function getBankStatement(accountId, range = "month") {
  await delay();
  const all = (_statements[accountId] || []).slice();
  const now = new Date();
  let since = null;
  if (range === "today") {
    since = new Date(now); since.setHours(0, 0, 0, 0);
  } else if (range === "week") {
    since = new Date(now); since.setDate(since.getDate() - 7);
  } else if (range === "month") {
    since = new Date(now); since.setDate(since.getDate() - 30);
  } else if (range && range.from) {
    since = new Date(range.from);
  }
  const filtered = since ? all.filter((t) => new Date(t.date) >= since) : all;
  return _brandObj(filtered);
}

export async function getBankAccountSummary(accountId, period = "month") {
  await delay();
  const txs = (_statements[accountId] || []).slice();
  const opening = _openingBalances[accountId] || 0;
  const acct = BANK_ACCOUNTS_DB.find((a) => a.id === accountId);
  let totalInflow = 0;
  let totalOutflow = 0;
  const breakdown = { RULE: 0, PATTERN: 0, AI: 0, MANUAL: 0, PENDING: 0 };
  for (const t of txs) {
    if (t.amount > 0) totalInflow += t.amount;
    else totalOutflow += -t.amount;
    const m = t.categorization?.method || "MANUAL";
    breakdown[m] = (breakdown[m] || 0) + 1;
  }
  return {
    openingBalance: opening,
    closingBalance: acct ? acct.currentBalance : 0,
    totalInflow: Number(totalInflow.toFixed(3)),
    totalOutflow: Number(totalOutflow.toFixed(3)),
    transactionCount: txs.length,
    categorizationBreakdown: breakdown,
  };
}

export async function getTransactionJournalEntry(transactionId) {
  await delay();
  // Find the statement row across all statements
  let tx = null;
  for (const k of Object.keys(_statements)) {
    const found = _statements[k].find((t) => t.id === transactionId);
    if (found) { tx = found; break; }
  }
  if (!tx) return null;
  const cat = tx.categorization || {};
  const abs = Math.abs(tx.amount);
  const isOutflow = tx.amount < 0;
  const acct = BANK_ACCOUNTS_DB.find((a) => a.id === tx.accountId);
  const bankLine = { account: acct?.accountName || "Bank Account", code: acct?.id === "ACC-1" ? "1120" : acct?.id === "ACC-2" ? "1130" : acct?.id === "ACC-3" ? "1140" : "1120" };
  const otherLine = { account: cat.category || "Suspense", code: cat.ruleId ? "AUTO" : "—" };
  const lines = isOutflow
    ? [
        { account: otherLine.account, code: otherLine.code, debit: abs, credit: null },
        { account: bankLine.account, code: bankLine.code, debit: null, credit: abs },
      ]
    : [
        { account: bankLine.account, code: bankLine.code, debit: abs, credit: null },
        { account: otherLine.account, code: otherLine.code, debit: null, credit: abs },
      ];
  return _brandObj({
    id: cat.journalEntryId || `JE-POST-${transactionId.slice(-3)}`,
    description: tx.description,
    status: "Posted",
    lines,
    totalDebit: abs,
    totalCredit: abs,
    balanced: true,
    mappingVersion: "v1.0",
    createdAt: tx.date,
    hashChainStatus: "extended",
  });
}

// ─────────────────────────────────────────
// OWNER VIEW — financial statements, close, audit, team
// ─────────────────────────────────────────

function _line(account, current, prior) {
  const change = Number((current - prior).toFixed(3));
  const percentChange = prior === 0 ? null : Number(((change / Math.abs(prior)) * 100).toFixed(1));
  return { account, current, prior, change, percentChange };
}
function _sum(lines, field = "current") {
  return Number(lines.reduce((s, l) => s + (l[field] || 0), 0).toFixed(3));
}

export async function getIncomeStatement(period = "month") {
  await delay();
  const revenue = [
    _line("Sales Revenue",   87420.0, 79100.0),
    _line("Service Revenue", 0.0,     0.0),
  ];
  const totalRevenueCurrent = _sum(revenue, "current");
  const totalRevenuePrior   = _sum(revenue, "prior");

  const cogs = [
    _line("Cost of Goods Sold", 35200.0, 32100.0),
    _line("Direct Labor",       7800.0,  7500.0),
  ];
  const totalCogsCurrent = _sum(cogs, "current");
  const totalCogsPrior   = _sum(cogs, "prior");

  const grossCurrent = Number((totalRevenueCurrent - totalCogsCurrent).toFixed(3));
  const grossPrior   = Number((totalRevenuePrior   - totalCogsPrior  ).toFixed(3));

  const opex = [
    _line("Salaries & Wages",        7200.0, 7000.0),
    _line("PIFSS Contributions",     820.0,  800.0),
    _line("Office Rent",             4200.0, 4200.0),
    _line("Utilities",               890.0,  1100.0),
    _line("Internet & Phone",        760.0,  745.0),
    _line("Marketing & Advertising", 1800.0, 1450.0),
    _line("Trade Shows",             3100.0, 2520.0),
    _line("Travel & Transport",      420.0,  380.0),
    _line("Fuel & Vehicle",          320.0,  295.0),
    _line("Office Supplies",         180.0,  170.0),
    _line("Professional Fees",       350.0,  350.0),
    _line("Insurance",               0.0,    0.0),
    _line("Bank Charges",            80.0,   82.0),
  ];
  const totalOpexCurrent = _sum(opex, "current");
  const totalOpexPrior   = _sum(opex, "prior");

  const opIncomeCurrent = Number((grossCurrent - totalOpexCurrent).toFixed(3));
  const opIncomePrior   = Number((grossPrior   - totalOpexPrior  ).toFixed(3));

  const other = [
    _line("Interest Income",    0.0, 0.0),
    _line("Interest Expense",   0.0, 0.0),
    _line("FX Gain/(Loss)",     0.0, 0.0),
  ];
  const totalOtherCurrent = 0;
  const totalOtherPrior   = 0;

  const nibtCurrent = Number((opIncomeCurrent + totalOtherCurrent).toFixed(3));
  const nibtPrior   = Number((opIncomePrior   + totalOtherPrior  ).toFixed(3));
  const netIncomeCurrent = nibtCurrent; // Kuwait 0% tax
  const netIncomePrior   = nibtPrior;

  return _brandObj({
    period: "March 2026",
    aminahNarration:
      "Revenue grew [+10.5%] month-over-month, driven primarily by Alghanim Industries orders and the Avenues branch. Gross margins held at [50.8%]. Operating expenses ran [+23.4%] with marketing flagged [+23% over budget] for the third consecutive month. Net income of [24,300.000 KWD] is still up [+6.3%] versus prior period and on track to exceed Q1 target.",
    sections: [
      { name: "REVENUE",             lines: revenue, subtotal: { label: "Total Revenue", current: totalRevenueCurrent, prior: totalRevenuePrior } },
      { name: "COST OF GOODS SOLD",  lines: cogs,    subtotal: { label: "Total COGS",    current: totalCogsCurrent,    prior: totalCogsPrior, negative: true } },
      { name: "GROSS PROFIT",        highlight: grossCurrent < 0 ? "red" : grossCurrent >= grossPrior ? "teal" : "amber", current: grossCurrent, prior: grossPrior },
      { name: "OPERATING EXPENSES",  lines: opex,    subtotal: { label: "Total OpEx",    current: totalOpexCurrent,    prior: totalOpexPrior, negative: true } },
      { name: "OPERATING INCOME",    highlight: opIncomeCurrent < 0 ? "red" : opIncomeCurrent >= opIncomePrior ? "teal" : "amber", current: opIncomeCurrent, prior: opIncomePrior },
      { name: "OTHER INCOME/(EXPENSE)", lines: other, subtotal: { label: "Total Other", current: totalOtherCurrent, prior: totalOtherPrior } },
      { name: "NET INCOME BEFORE TAX", highlight: nibtCurrent < 0 ? "red" : nibtCurrent >= nibtPrior ? "teal" : "amber", current: nibtCurrent, prior: nibtPrior },
      { name: "TAX EXPENSE",         lines: [_line("Corporate tax (Kuwait 0%)", 0, 0)], subtotal: { label: "Total Tax", current: 0, prior: 0, negative: true } },
      { name: "NET INCOME",          highlight: netIncomeCurrent < 0 ? "red" : netIncomeCurrent >= netIncomePrior ? "teal" : "amber", final: true, current: netIncomeCurrent, prior: netIncomePrior },
    ],
    // HASEEB-216 / AUDIT-ACC-038 — IAS 8 restatement watermark.
    restatementWatermark: _restatementWatermarkForTenant(_currentTenantId),
  });
}

export async function getBalanceSheet(period = "month") {
  await delay();
  const currentAssets = [
    _line("Cash (KIB Accounts)",   210896.5, 182496.5),
    _line("Accounts Receivable",   56200.0,  52000.0),
    _line("Inventory",             42300.0,  43800.0),
    _line("Prepaid Expenses",      3200.0,   3200.0),
  ];
  const totalCurrentAssets = _sum(currentAssets);
  const totalCurrentAssetsPrior = _sum(currentAssets, "prior");

  const fixedAssets = [
    _line("Equipment",                  45000.0, 45000.0),
    _line("Furniture",                  12000.0, 12000.0),
    _line("Accumulated Depreciation",  -18400.0, -16600.0),
  ];
  const totalFixedAssets = _sum(fixedAssets);
  const totalFixedAssetsPrior = _sum(fixedAssets, "prior");

  const totalAssets = Number((totalCurrentAssets + totalFixedAssets).toFixed(3));
  const totalAssetsPrior = Number((totalCurrentAssetsPrior + totalFixedAssetsPrior).toFixed(3));

  const currentLiab = [
    _line("Accounts Payable",   38900.0, 33900.0),
    _line("PIFSS Payable",      9500.0,  9100.0),
    _line("Salaries Payable",   14200.0, 13800.0),
  ];
  const totalCurrentLiab = _sum(currentLiab);
  const totalCurrentLiabPrior = _sum(currentLiab, "prior");
  const totalLiab = totalCurrentLiab;
  const totalLiabPrior = totalCurrentLiabPrior;

  // Equity must close the books.
  const equityLines = [
    _line("Owner Equity",            252000.0, 252000.0),
    _line("Retained Earnings",       12296.5,  12296.5),
    _line("Current Period Net Income", 24300.0, 22850.0),
  ];
  // Force balance
  const neededEquity = Number((totalAssets - totalLiab).toFixed(3));
  const summed = _sum(equityLines);
  if (summed !== neededEquity) {
    equityLines[0].current = Number((equityLines[0].current + (neededEquity - summed)).toFixed(3));
  }
  const totalEquity = _sum(equityLines);
  const totalEquityPrior = _sum(equityLines, "prior");

  return _brandObj({
    period: "March 2026",
    aminahNarration:
      "Total assets of [351,196.500 KWD] are up [+5.2%] from prior period, with cash accounting for [60%] of the total. Accounts receivable of [56,200.000 KWD] has [14,200.000 KWD overdue] — worth reviewing with Sara. No long-term debt. Owner equity continues to grow in line with profitability.",
    sections: [
      { name: "ASSETS", isParent: true },
      { name: "Current Assets",  lines: currentAssets, subtotal: { label: "Total Current Assets", current: totalCurrentAssets, prior: totalCurrentAssetsPrior } },
      { name: "Fixed Assets",    lines: fixedAssets,   subtotal: { label: "Total Fixed Assets",   current: totalFixedAssets,   prior: totalFixedAssetsPrior } },
      { name: "TOTAL ASSETS",    highlight: "teal", current: totalAssets, prior: totalAssetsPrior },

      { name: "LIABILITIES", isParent: true },
      { name: "Current Liabilities", lines: currentLiab, subtotal: { label: "Total Current Liabilities", current: totalCurrentLiab, prior: totalCurrentLiabPrior } },
      { name: "Long-term Liabilities", lines: [_line("None", 0, 0)], subtotal: { label: "Total Long-term", current: 0, prior: 0 } },
      { name: "TOTAL LIABILITIES", highlight: "amber", current: totalLiab, prior: totalLiabPrior },

      { name: "EQUITY", isParent: true },
      { name: "Equity Lines", lines: equityLines, subtotal: { label: "Total Equity", current: totalEquity, prior: totalEquityPrior } },

      { name: "TOTAL LIABILITIES + EQUITY", highlight: "teal", final: true, current: Number((totalLiab + totalEquity).toFixed(3)), prior: Number((totalLiabPrior + totalEquityPrior).toFixed(3)) },
    ],
    // HASEEB-216 / AUDIT-ACC-038 — IAS 8 restatement watermark on the
    // Balance Sheet envelope (backend shipped `restatementWatermark?` on
    // `BalanceSheetReport`). Populated from the tenant-scoped helper so
    // MOCK mode surfaces the watermark on the same tenants as SOCIE.
    restatementWatermark: _restatementWatermarkForTenant(_currentTenantId),
  });
}

export async function getCashFlowStatement(period = "month") {
  await delay();
  const operating = [
    _line("Net Income",              24300.0, 22850.0),
    _line("Depreciation",            1800.0,  1800.0),
    _line("Accounts Receivable",    -4200.0, -3100.0),
    _line("Inventory",               1500.0,  -800.0),
    _line("Accounts Payable",        5000.0,  2100.0),
  ];
  const totalOperating = _sum(operating);
  const totalOperatingPrior = _sum(operating, "prior");

  const investing = [
    _line("Purchase of Equipment",   0.0, 0.0),
  ];
  const totalInvesting = _sum(investing);
  const totalInvestingPrior = _sum(investing, "prior");

  const financing = [
    _line("Owner Contributions",     0.0, 0.0),
    _line("Owner Distributions",     0.0, 0.0),
  ];
  const totalFinancing = _sum(financing);
  const totalFinancingPrior = _sum(financing, "prior");

  const netChange = Number((totalOperating + totalInvesting + totalFinancing).toFixed(3));
  const beginningCash = 182496.5;
  const endingCash = Number((beginningCash + netChange).toFixed(3));

  return _brandObj({
    period: "March 2026",
    aminahNarration:
      "Operating cash flow of [28,400.000 KWD] is healthy, driven by strong collections and lower-than-expected OpEx. No investing activities this period. Net cash increased [28,400.000 KWD], taking total cash to [210,896.500 KWD] across the 4 KIB accounts.",
    sections: [
      { name: "OPERATING ACTIVITIES", lines: operating, subtotal: { label: "Total Operating", current: totalOperating, prior: totalOperatingPrior } },
      { name: "INVESTING ACTIVITIES", lines: investing, subtotal: { label: "Total Investing", current: totalInvesting, prior: totalInvestingPrior } },
      { name: "FINANCING ACTIVITIES", lines: financing, subtotal: { label: "Total Financing", current: totalFinancing, prior: totalFinancingPrior } },
      { name: "NET CHANGE IN CASH",   highlight: "teal", current: netChange, prior: 0 },
      { name: "Beginning Cash",       lines: [_line("Beginning Cash", beginningCash, 0)], subtotal: { label: "Beginning Cash", current: beginningCash, prior: 0 } },
      { name: "ENDING CASH",          highlight: "teal", final: true, current: endingCash, prior: 0 },
    ],
    // HASEEB-216 / AUDIT-ACC-038 — IAS 8 restatement watermark.
    restatementWatermark: _restatementWatermarkForTenant(_currentTenantId),
  });
}

export async function getMonthEndCloseTasks() {
  await delay();
  const tasks = [
    { id: "CT-1",  name: "Import bank feeds (all 4 KIB accounts)",     assignee: P.sara,  status: "complete",    completedAt: _daysAgo(3), dueDate: null },
    { id: "CT-2",  name: "Categorize all bank transactions",           assignee: P.sara,  status: "complete",    completedAt: _daysAgo(2), dueDate: null },
    { id: "CT-3",  name: "Reconcile KIB Operating",                    assignee: P.sara,  status: "complete",    completedAt: _daysAgo(2), dueDate: null },
    { id: "CT-4",  name: "Reconcile KIB Reserve",                      assignee: P.sara,  status: "complete",    completedAt: _daysAgo(1), dueDate: null },
    { id: "CT-5",  name: "Reconcile KIB USD Account",                  assignee: P.noor,  status: "complete",    completedAt: _daysAgo(1), dueDate: null },
    { id: "CT-6",  name: "Post payroll accrual",                       assignee: P.noor,  status: "complete",    completedAt: _hoursAgo(18), dueDate: null },
    { id: "CT-7",  name: "Post PIFSS accrual (JE-0415)",               assignee: P.noor,  status: "complete",    completedAt: _hoursAgo(6),  dueDate: null },
    { id: "CT-8",  name: "Post depreciation entry",                    assignee: P.noor,  status: "complete",    completedAt: _hoursAgo(5),  dueDate: null },
    { id: "CT-9",  name: "Review uncategorized transactions",          assignee: P.sara,  status: "complete",    completedAt: _hoursAgo(3),  dueDate: null },
    { id: "CT-10", name: "Reconcile KIB Settlement",                   assignee: P.sara,  status: "in-progress", completedAt: null, dueDate: _daysFromNow(1) },
    { id: "CT-11", name: "Resolve Boubyan unidentified transfer",      assignee: P.sara,  status: "in-progress", completedAt: null, dueDate: _daysFromNow(1) },
    { id: "CT-12", name: "Post adjusting entries",                     assignee: P.cfo,   status: "pending",     completedAt: null, dueDate: _daysFromNow(2) },
    { id: "CT-13", name: "Resolve audit check JE-0413",                assignee: P.sara,  status: "pending",     completedAt: null, dueDate: _daysFromNow(1) },
    { id: "CT-14", name: "CFO sign-off",                               assignee: P.cfo,   status: "pending",     completedAt: null, dueDate: _daysFromNow(2) },
    { id: "CT-15", name: "Owner approval + lock period",               assignee: P.owner, status: "pending",     completedAt: null, dueDate: _daysFromNow(3) },
  ];
  return _brandObj({
    period: "March 2026",
    status: "in-progress",
    tasks,
    validations: [
      { name: "Trial balance balances",            passing: true,  detail: "0.000 KWD variance" },
      { name: "No unposted transactions",          passing: true,  detail: "All entries committed" },
      { name: "All reconciliations complete",      passing: false, detail: "4 of 5 done — KIB Settlement in progress", resolveScreen: "bank-accounts" },
      { name: "Audit checks passing",              passing: false, detail: "1 check failing — JE-0413 missing reference", resolveScreen: "audit-bridge" },
      { name: "No pending approvals blocking",     passing: true,  detail: "All approvals cleared" },
    ],
    aminahSummary:
      "March close is [60% complete] with 6 tasks remaining. Three reconciliations done (KIB Operating, KIB Reserve, KIB USD). Sara is working on KIB Settlement. Post-close estimate: [April 3]. Two items will need your sign-off when complete: the adjusting entries and the final period lock.",
  });
}

export async function getAuditChecks() {
  await delay();
  const now = _hoursAgo(0);
  const ok = (name, detail) => ({ id: `AC-${name.replace(/\s/g, "").slice(0,6)}`, name, status: "passing", lastVerified: now, detail });
  const bad = (name, detail) => ({ id: `AC-${name.replace(/\s/g, "").slice(0,6)}`, name, status: "failing", lastVerified: now, detail });
  const checks = [
    ok("Double-Entry Balance",       "Every entry balances to zero"),
    ok("Hash Chain Integrity",       "Chain intact across 2,847 blocks"),
    bad("Sequential Numbering",      "JE-0413 missing reference number"),
    ok("Reconciliation Status",      "4 of 5 accounts reconciled"),
    ok("Period Locking",             "Prior period March 2025 locked"),
    ok("JE Approval Trail",          "All JEs have approval chain"),
    ok("Bank Feed Freshness",        "All feeds < 1h old"),
    ok("Trial Balance Balances",     "TB = 0.000 KWD"),
    ok("Rule Audit Trail",           "All rule applications logged"),
    ok("User Access Controls",       "RBAC enforced per role"),
    ok("Segregation of Duties",      "No prohibited combinations"),
    ok("Retention Policy",           "7-year retention enforced"),
    ok("GL-to-Subledger Tie-Out",    "AR/AP tied to GL"),
    ok("FX Rate Audit",              "Rates sourced from CBK daily"),
    ok("Statement Recomputation",    "Statements reproducible from ledger"),
  ];
  return _brandObj({
    total: checks.length,
    passing: checks.filter((c) => c.status === "passing").length,
    failing: checks.filter((c) => c.status === "failing").length,
    checks,
    hashChain: {
      totalEntries: 2847,
      chainLength: 2847,
      lastHash: "a4f2…9c1b",
      status: "INTACT",
      lastVerified: _hoursAgo(0),
    },
    aminahNarration:
      "Audit bridge is [14 of 15 checks passing]. The one failing check is [Sequential numbering] — JE-0413 is missing a reference number. This is a Sara-level fix and has been in her Taskbox for 2 hours. No other integrity issues. Hash chain is intact across [2,847 posted entries]. Period is currently audit-ready except for this one item.",
  });
}

export async function getTeamMembersWithResponsibilities() {
  await delay();
  const all = [
    { ...P.owner, accessLevel: "Full access",          isOnline: true,  lastActive: _hoursAgo(0) },
    { ...P.cfo,   accessLevel: "Full accounting",      isOnline: true,  lastActive: _hoursAgo(0) },
    { ...P.sara,  accessLevel: "Bookkeeping + Approvals", isOnline: true,  lastActive: _hoursAgo(0) },
    { ...P.noor,  accessLevel: "Bookkeeping",          isOnline: false, lastActive: _hoursAgo(2) },
    { ...P.jasem, accessLevel: "Bookkeeping",          isOnline: true,  lastActive: _hoursAgo(0) },
    { ...P.layla, accessLevel: "AP only",              isOnline: false, lastActive: _daysAgo(1) },
  ];
  // Derive responsibilities from routing rules
  const rules = ROUTING_RULES_DB.filter((r) => r.status === "active");
  const byAssignee = {};
  for (const rule of rules) {
    const aid = rule.action.assignTo?.id;
    if (!aid) continue;
    if (!byAssignee[aid]) byAssignee[aid] = [];
    byAssignee[aid].push(rule.name);
  }
  for (const m of all) {
    m.responsibilities = byAssignee[m.id] || [];
  }
  return all;
}

export async function getOwnerTopInsight() {
  await delay();
  return _brandObj({
    id: "TOP-1",
    text:
      "Marketing spend is [+23% over budget] for the third consecutive month. Three large items this month: campaign A ([4,200.000 KWD]), tradeshow B ([3,100.000 KWD]), agency retainer ([2,800.000 KWD]). Want me to draft a board-level summary?",
    action: "draft-summary",
  });
}

// ─────────────────────────────────────────
// JUNIOR VIEW — Sara's view
// ─────────────────────────────────────────

export async function getSaraTaskStats() {
  await delay();
  const now = new Date();
  const sara = TASKBOX_DB.filter(
    (t) => t.recipient.id === "sara" && t.status !== "completed" && t.status !== "rejected"
  );
  const overdue = sara.filter((t) => t.dueDate && new Date(t.dueDate) < now).length;
  const dueSoon = sara.filter((t) => {
    if (!t.dueDate) return false;
    const diff = (new Date(t.dueDate) - now) / (1000 * 60 * 60);
    return diff > 0 && diff < 24;
  }).length;
  return { open: sara.length, overdue, dueSoon };
}

export async function getSaraAccuracy() {
  await delay();
  return { current: 94, previous: 91, trend: "up" };
}

export async function getSaraWorkQueue() {
  await delay();
  return {
    bankTransactions: 8,
    reconciliationExceptions: 3,
    jeAwaitingApproval: 2,
    escalationsToRespond: 1,
  };
}

export async function getSaraActivityLog() {
  await delay();
  return _brandObj([
    { id: "sa-1", type: "completed",    icon: "check", description: "Reconciled KIB Operating — 78 items matched", timestamp: _hoursAgo(2) },
    { id: "sa-2", type: "completed",    icon: "check", description: "Categorized 23 bank transactions",             timestamp: _hoursAgo(3) },
    { id: "sa-3", type: "completed",    icon: "check", description: "Drafted PIFSS accrual JE-0415 — sent for CFO approval", timestamp: _hoursAgo(4) },
    { id: "sa-4", type: "completed",    icon: "check", description: "Responded to Owner's Al Shaya question",       timestamp: _hoursAgo(5) },
    { id: "sa-5", type: "in-progress",  icon: "pencil", description: "Started KIB Settlement reconciliation",        timestamp: _hoursAgo(1) },
  ]);
}

export async function getSaraAminahNotes() {
  await delay();
  return _brandObj([
    { id: "sn-1", text: "Your accuracy this week is [94%], up from [91%] last week. Most common correction: cost center allocation." },
    { id: "sn-2", text: "You have [6 open tasks], [2 are due today]. Consider prioritizing the Gulf Logistics follow-up." },
    { id: "sn-3", text: "You've categorized [23 transactions] today. Rule CRULE-001 (KNPC) auto-handled 4 of them, saving ~10 minutes." },
  ]);
}

export async function getJuniorDomainStats(juniorId = "sara") {
  await delay();
  return {
    tasksHandled: 34,
    accuracyRate: 94,
    avgCompletionMinutes: 42,
    pendingInQueue: 6,
  };
}

export async function getFilteredBankTransactions(juniorId = "sara") {
  await delay();
  // Sara's domain: Operating Expenses, Revenue, Fuel, Trade Shows, Sales — NOT payroll/PIFSS/invoicing
  const SARA_CATEGORIES = [
    "Fuel & Vehicle", "Sales Revenue", "Office Rent", "Internet & Phone",
    "Trade Shows", "Cost of Goods Sold", "Office Supplies", "Marketing & Advertising",
  ];
  const all = await getBankTransactionsPending();
  return all.filter((t) => {
    const cat = t.engineSuggestion?.account || "";
    return SARA_CATEGORIES.includes(cat) || t.engineSuggestion?.confidence === "NONE";
  });
}

export async function draftJournalEntryForJunior({ amount, debitAccount, creditAccount, description }) {
  await delay();
  const threshold = 1000;
  const num = Number(amount || 0);
  const needsApproval = num >= threshold;
  const entry = {
    id: `JE-${Math.floor(500 + Math.random() * 100)}`,
    description: description || "",
    status: needsApproval ? "Pending Approval" : "Posted",
    lines: [
      { account: debitAccount.name,  code: debitAccount.code,  debit: num, credit: null },
      { account: creditAccount.name, code: creditAccount.code, debit: null, credit: num },
    ],
    totalDebit: num,
    totalCredit: num,
    balanced: true,
    mappingVersion: "v1.0",
    createdAt: new Date().toISOString(),
    hashChainStatus: needsApproval ? "pending approval" : "extended",
  };
  return { entry, needsApproval };
}

// ─────────────────────────────────────────
// POLISH — reconciled Business Pulse
// ─────────────────────────────────────────

export async function getBusinessPulse() {
  await delay();
  // Source of truth:
  //   revenue    → getIncomeStatement totals
  //   expenses   → getIncomeStatement COGS + OpEx
  //   netIncome  → getIncomeStatement NET INCOME
  //   cash       → getBankAccounts (USD converted at 3.28 KWD/USD)
  const is = await getIncomeStatement();
  const accounts = await getBankAccounts();
  const FX_USD_KWD = 3.28;

  const sec = (name) => is.sections.find((s) => s.name === name);
  const revenue = sec("REVENUE");
  const cogs = sec("COST OF GOODS SOLD");
  const opex = sec("OPERATING EXPENSES");
  const netIncome = sec("NET INCOME");

  const revCurr = revenue?.subtotal?.current || 0;
  const revPrior = revenue?.subtotal?.prior || 0;
  const cogsCurr = cogs?.subtotal?.current || 0;
  const cogsPrior = cogs?.subtotal?.prior || 0;
  const opexCurr = opex?.subtotal?.current || 0;
  const opexPrior = opex?.subtotal?.prior || 0;
  const expCurr = Number((cogsCurr + opexCurr).toFixed(3));
  const expPrior = Number((cogsPrior + opexPrior).toFixed(3));
  const niCurr = netIncome?.current || 0;
  const niPrior = netIncome?.prior || 0;

  const pct = (curr, prior) =>
    prior === 0 ? null : Number((((curr - prior) / Math.abs(prior)) * 100).toFixed(1));

  const grossMargin = revCurr ? Number((((revCurr - cogsCurr) / revCurr) * 100).toFixed(1)) : 0;
  const operatingMargin = revCurr
    ? Number((((revCurr - cogsCurr - opexCurr) / revCurr) * 100).toFixed(1))
    : 0;

  const cashTotal = accounts.reduce((sum, a) => {
    const rate = a.currency === "USD" ? FX_USD_KWD : 1;
    return sum + a.currentBalance * rate;
  }, 0);

  return _brandObj({
    revenue:   { current: revCurr, prior: revPrior, percentChange: pct(revCurr, revPrior) },
    expenses:  { current: expCurr, prior: expPrior, percentChange: pct(expCurr, expPrior) },
    netIncome: { current: niCurr,  prior: niPrior,  percentChange: pct(niCurr, niPrior), grossMargin, operatingMargin },
    cash: {
      total: Number(cashTotal.toFixed(3)),
      accountCount: accounts.length,
      subtext: `across ${accounts.length} KIB accounts`,
    },
  });
}

export async function cancelTask(taskId, byId = "cfo") {
  await delay();
  const t = TASKBOX_DB.find((x) => x.id === taskId);
  if (!t) return null;
  const by = P[byId] || P.cfo;
  t.thread.push(_sysEvent("cancelled", `${by.name} cancelled this request`));
  t.status = "cancelled";
  t.updatedAt = new Date().toISOString();
  return t;
}

export async function updateCategorizationRule(id, changes) {
  await delay();
  const r = CAT_RULES_DB.find((x) => x.id === id);
  if (!r) return null;
  Object.assign(r, changes);
  r.auditTrail.push(_rAudit("edited", P.cfo, "You edited this rule"));
  return r;
}
export async function updateRoutingRule(id, changes) {
  await delay();
  const r = ROUTING_RULES_DB.find((x) => x.id === id);
  if (!r) return null;
  Object.assign(r, changes);
  r.auditTrail.push(_rAudit("edited", P.cfo, "You edited this rule"));
  return r;
}

// ─────────────────────────────────────────
// BUDGET — FY 2026 plan, actuals integration
// ─────────────────────────────────────────

// Helper: build a 12-month even distribution from an annual total.
function _monthly12(annual) {
  const each = Math.round((annual / 12) * 1000) / 1000;
  const arr = Array(12).fill(each);
  // Adjust last month so the array sums exactly to annual.
  const sum = arr.reduce((s, n) => s + n, 0);
  arr[11] = Number((arr[11] + (annual - sum)).toFixed(3));
  return arr;
}

let _lineSeq = 0;
function _budgetLine(code, name, annual, priorActual = 0, notes = null) {
  return {
    id: `LINE-${String(++_lineSeq).padStart(3, "0")}`,
    glAccountCode: code,
    glAccountName: name,
    annual,
    monthlyDistribution: _monthly12(annual),
    priorPeriodActual: priorActual,
    notes,
  };
}

function _dept(id, name, category, ownerUserId, lineItems) {
  const totalAnnual = Number(lineItems.reduce((s, l) => s + l.annual, 0).toFixed(3));
  const monthlyDistribution = Array(12)
    .fill(0)
    .map((_, m) =>
      Number(lineItems.reduce((s, l) => s + l.monthlyDistribution[m], 0).toFixed(3))
    );
  return {
    id,
    name,
    category,
    ownerUserId,
    status: "approved",
    totalAnnual,
    monthlyDistribution,
    lineItems,
    notes: null,
  };
}

const _BUDGET_DEPARTMENTS = [
  _dept("DEPT-sales", "Sales", "revenue", "cfo", [
    _budgetLine("4100", "Sales Revenue",   1200000, 1080000),
    _budgetLine("4200", "Service Revenue", 0,       0),
  ]),
  _dept("DEPT-operations", "Operations", "expense", "noor", [
    _budgetLine("5110", "Cost of Goods Sold",     480000, 432000),
    _budgetLine("5120", "Direct Labor",            90000,  82000),
    _budgetLine("5130", "Inventory adjustments",   18000,  16500),
  ]),
  _dept("DEPT-sales-ops", "Sales (Ops)", "expense", "jasem", [
    _budgetLine("5200", "Sales Commissions", 36000, 31000),
    _budgetLine("5240", "Sales Travel",      15000, 13500),
  ]),
  _dept("DEPT-marketing", "Marketing", "expense", "layla", [
    _budgetLine("6320", "Marketing & Advertising", 38000, 31500),
    _budgetLine("6310", "Trade Shows",             25000, 18000),
    _budgetLine("6330", "Agency Retainer",         28000, 25200),
  ]),
  _dept("DEPT-tech", "Tech & Infra", "expense", "sara", [
    _budgetLine("6220", "Internet & Phone",         9000,  8400),
    _budgetLine("6230", "Software Subscriptions",  24000, 21600),
    _budgetLine("6240", "Cloud Infra",             18000, 15800),
  ]),
  _dept("DEPT-admin", "Admin", "expense", "sara", [
    _budgetLine("6100", "Salaries & Wages",      168000, 156000),
    _budgetLine("6110", "PIFSS Contributions",    19200,  18000),
    _budgetLine("6200", "Office Rent",            50400,  50400),
    _budgetLine("6210", "Utilities",              12000,  11400),
    _budgetLine("6260", "Office Supplies",         5000,   4500),
    _budgetLine("6270", "Professional Fees",      10200,   9800),
    _budgetLine("6280", "Insurance",               4000,   3800),
    _budgetLine("6290", "Bank Charges",             900,    850),
  ]),
];

const _ACTIVE_BUDGET = (() => {
  const totalRevenue = _BUDGET_DEPARTMENTS
    .filter((d) => d.category === "revenue")
    .reduce((s, d) => s + d.totalAnnual, 0);
  const totalExpenses = _BUDGET_DEPARTMENTS
    .filter((d) => d.category === "expense")
    .reduce((s, d) => s + d.totalAnnual, 0);
  return {
    id: "BUD-2026-FY",
    period: {
      type: "annual",
      label: "FY 2026",
      fiscalYear: 2026,
      startDate: new Date("2026-01-01").toISOString(),
      endDate: new Date("2026-12-31").toISOString(),
    },
    status: "active",
    approvedBy: "owner",
    approvedAt: new Date("2025-12-18").toISOString(),
    createdBy: "cfo",
    createdAt: new Date("2025-11-20").toISOString(),
    totalRevenue: Number(totalRevenue.toFixed(3)),
    totalExpenses: Number(totalExpenses.toFixed(3)),
    netIncome: Number((totalRevenue - totalExpenses).toFixed(3)),
    departments: _BUDGET_DEPARTMENTS,
    aminahNarration:
      "FY 2026 budget is [active] with total revenue target of [1,200,000.000 KWD] and expenses budget of [1,051,700.000 KWD], leaving projected net income of [148,300.000 KWD] (margin [12.4%]). Through Q1 we're tracking on plan for revenue but [Marketing is at 91% of YTD allocation] — at this pace we'll exceed annual budget by approximately [+18,000.000 KWD]. Operations and Tech & Infra are running below pace which offsets the marketing variance.",
  };
})();

// Hand-tuned YTD actuals per department (3 months in = 25% of year baseline)
// Marketing is intentionally over plan; others on or under track.
const _DEPT_YTD_ACTUALS = {
  "DEPT-sales":      300000,   // 25.0% of 1,200,000
  "DEPT-operations": 138750,   // ~24.0% of 588,000
  "DEPT-sales-ops":  12200,    // ~23.9% of 51,000
  "DEPT-marketing":  25025,    // 110% of YTD (22,750) — activates over-budget narrative + overflow bar
  "DEPT-tech":       11475,    // ~22.5% of 51,000
  "DEPT-admin":      67425,    // 25.0% of 269,700
};

function _statusForPercent(pct, category = "expense") {
  if (category === "revenue") {
    if (pct < 90)   return "behind";
    if (pct <= 100) return "on-track";
    return "ahead";
  }
  if (pct < 90)   return "under";
  if (pct <= 100) return "on-track";
  if (pct <= 110) return "over";
  return "critical";
}

function _budgetNarration() {
  const totalRev = _ACTIVE_BUDGET.totalRevenue;
  const totalExp = _ACTIVE_BUDGET.totalExpenses;
  const netInc = _ACTIVE_BUDGET.netIncome;
  const margin = totalRev > 0 ? (netInc / totalRev) * 100 : 0;
  const ytdFraction = 3 / 12;
  const marketing = _ACTIVE_BUDGET.departments.find((d) => d.name === "Marketing");
  let marketingPct = 0;
  let overage = 0;
  if (marketing) {
    const ytdBudget = marketing.totalAnnual * ytdFraction;
    const ytdActual = _DEPT_YTD_ACTUALS[marketing.id] || 0;
    marketingPct = ytdBudget === 0 ? 0 : (ytdActual / ytdBudget) * 100;
    // Project: if pace continues, what's the annual overage?
    const projectedAnnual = (ytdActual / ytdFraction);
    overage = Math.max(0, projectedAnnual - marketing.totalAnnual);
  }
  const fmt = (n) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  return (
    `FY 2026 budget is [active] with total revenue target of [${fmt(totalRev)} KWD] ` +
    `and expenses budget of [${fmt(totalExp)} KWD], leaving projected net income of ` +
    `[${fmt(netInc)} KWD] (margin [${margin.toFixed(1)}%]). Through Q1 we're tracking ` +
    `on plan for revenue but [Marketing is at ${marketingPct.toFixed(0)}% of YTD allocation] — ` +
    `at this pace we'll exceed annual budget by approximately [+${fmt(overage)} KWD]. ` +
    `Operations and Tech & Infra are running below pace which offsets the marketing variance.`
  );
}

export async function getActiveBudget(_period) {
  await delay();
  return _brandObj({
    ..._ACTIVE_BUDGET,
    aminahNarration: _budgetNarration(),
    departments: _ACTIVE_BUDGET.departments.map((d) => ({ ...d })),
  });
}

export async function getBudgetById(id) {
  await delay();
  const b = (typeof _BUDGETS_DB !== "undefined" && _BUDGETS_DB[id]) || (id === _ACTIVE_BUDGET.id ? _ACTIVE_BUDGET : null);
  if (!b) return null;
  const narration =
    b.id === _ACTIVE_BUDGET.id
      ? _budgetNarration()
      : typeof _fy2027Narration === "function"
        ? _fy2027Narration()
        : (b.aminahNarration || "");
  return _brandObj({ ...b, aminahNarration: narration });
}

export async function getActiveBudgetSummary() {
  await delay();
  return _brandObj({
    id: _ACTIVE_BUDGET.id,
    label: _ACTIVE_BUDGET.period.label,
    status: _ACTIVE_BUDGET.status,
    totalRevenue: _ACTIVE_BUDGET.totalRevenue,
    totalExpenses: _ACTIVE_BUDGET.totalExpenses,
    netIncome: _ACTIVE_BUDGET.netIncome,
    departmentCount: _ACTIVE_BUDGET.departments.length,
    expenseDepartmentCount: _ACTIVE_BUDGET.departments.filter((d) => d.category === "expense").length,
    margin: Number(((_ACTIVE_BUDGET.netIncome / _ACTIVE_BUDGET.totalRevenue) * 100).toFixed(1)),
  });
}

export async function getBudgetDepartments() {
  await delay();
  return _brandObj(_ACTIVE_BUDGET.departments.map((d) => ({ ...d })));
}

export async function getBudgetDepartmentById(id) {
  await delay();
  const d = _ACTIVE_BUDGET.departments.find((x) => x.id === id);
  return d ? _brandObj({ ...d }) : null;
}

export async function getBudgetVarianceByDepartment() {
  await delay();
  // YTD budget = 3/12 of annual (3 months elapsed)
  const ytdFraction = 3 / 12;
  const rows = _ACTIVE_BUDGET.departments.map((d) => {
    const budgetYtd = Number((d.totalAnnual * ytdFraction).toFixed(3));
    const actualYtd = Number((_DEPT_YTD_ACTUALS[d.id] || 0).toFixed(3));
    const varianceAmount = Number((actualYtd - budgetYtd).toFixed(3));
    const variancePercent = budgetYtd === 0 ? 0 : Number(((actualYtd / budgetYtd) * 100).toFixed(1));
    return {
      id: d.id,
      name: d.name,
      category: d.category,
      ownerUserId: d.ownerUserId,
      budgetAnnual: d.totalAnnual,
      budgetYtd,
      actualYtd,
      varianceAmount,
      variancePercent,
      status: _statusForPercent(variancePercent, d.category),
    };
  });
  return _brandObj(rows);
}

export async function getBudgetVarianceByLineItem(departmentId) {
  await delay();
  const d = _ACTIVE_BUDGET.departments.find((x) => x.id === departmentId);
  if (!d) return [];
  const ytdFraction = 3 / 12;
  // For demo: distribute the dept-level YTD actual across line items proportionally to annual.
  const deptActual = _DEPT_YTD_ACTUALS[departmentId] || 0;
  const rows = d.lineItems.map((l) => {
    const proportion = d.totalAnnual > 0 ? l.annual / d.totalAnnual : 0;
    const actualYtd = Number((deptActual * proportion).toFixed(3));
    const budgetYtd = Number((l.annual * ytdFraction).toFixed(3));
    const varianceAmount = Number((actualYtd - budgetYtd).toFixed(3));
    const variancePercent = budgetYtd === 0 ? 0 : Number(((actualYtd / budgetYtd) * 100).toFixed(1));
    return {
      id: l.id,
      glAccountCode: l.glAccountCode,
      glAccountName: l.glAccountName,
      budgetAnnual: l.annual,
      budgetYtd,
      actualYtd,
      varianceAmount,
      variancePercent,
      status: _statusForPercent(variancePercent, d.category),
    };
  });
  return _brandObj(rows);
}

export async function getBudgetMonthlyComparison(departmentId, lineItemId) {
  await delay();
  const d = _ACTIVE_BUDGET.departments.find((x) => x.id === departmentId);
  if (!d) return [];
  const li = lineItemId ? d.lineItems.find((x) => x.id === lineItemId) : null;
  const monthly = li ? li.monthlyDistribution : d.monthlyDistribution;
  // Mock actuals: months 0-2 use seeded YTD, months 3-11 are projected (shown as 0)
  const annualActual = li
    ? Number(((_DEPT_YTD_ACTUALS[departmentId] || 0) * (li.annual / d.totalAnnual)).toFixed(3))
    : _DEPT_YTD_ACTUALS[departmentId] || 0;
  const monthlyActuals = [
    annualActual / 3, annualActual / 3, annualActual / 3,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
  ].map((n) => Number(n.toFixed(3)));
  return _brandObj(
    monthly.map((b, i) => ({
      month: i + 1,
      monthLabel: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i],
      budget: b,
      actual: monthlyActuals[i],
    }))
  );
}

export async function getBudgetForJunior(juniorId) {
  await delay();
  const owned = _ACTIVE_BUDGET.departments.filter((d) => d.ownerUserId === juniorId);
  const others = _ACTIVE_BUDGET.departments.filter((d) => d.ownerUserId !== juniorId);
  return _brandObj({
    owned: owned.map((d) => ({ ...d })),
    others: others.map((d) => ({
      id: d.id,
      name: d.name,
      category: d.category,
      totalAnnual: d.totalAnnual,
      ownerUserId: d.ownerUserId,
    })),
  });
}

export async function updateBudgetLineItem(_budgetId, departmentId, lineItemId, changes) {
  await delay();
  const d = _ACTIVE_BUDGET.departments.find((x) => x.id === departmentId);
  if (!d) return null;
  const li = d.lineItems.find((x) => x.id === lineItemId);
  if (!li) return null;
  if (changes && typeof changes.annual === "number") {
    li.annual = changes.annual;
    li.monthlyDistribution = _monthly12(changes.annual);
  }
  if (changes && changes.notes != null) li.notes = changes.notes;
  d.totalAnnual = Number(d.lineItems.reduce((s, l) => s + l.annual, 0).toFixed(3));
  d.monthlyDistribution = Array(12)
    .fill(0)
    .map((_, m) =>
      Number(d.lineItems.reduce((s, l) => s + l.monthlyDistribution[m], 0).toFixed(3))
    );
  // Recompute budget totals
  _ACTIVE_BUDGET.totalRevenue = Number(
    _ACTIVE_BUDGET.departments
      .filter((x) => x.category === "revenue")
      .reduce((s, x) => s + x.totalAnnual, 0).toFixed(3)
  );
  _ACTIVE_BUDGET.totalExpenses = Number(
    _ACTIVE_BUDGET.departments
      .filter((x) => x.category === "expense")
      .reduce((s, x) => s + x.totalAnnual, 0).toFixed(3)
  );
  _ACTIVE_BUDGET.netIncome = Number(
    (_ACTIVE_BUDGET.totalRevenue - _ACTIVE_BUDGET.totalExpenses).toFixed(3)
  );
  return _brandObj({ ...li });
}

export async function updateBudgetMonthlyDistribution(_budgetId, departmentId, lineItemId, monthlyArray) {
  await delay();
  const d = _ACTIVE_BUDGET.departments.find((x) => x.id === departmentId);
  if (!d) return null;
  const li = d.lineItems.find((x) => x.id === lineItemId);
  if (!li) return null;
  if (Array.isArray(monthlyArray) && monthlyArray.length === 12) {
    li.monthlyDistribution = monthlyArray.map((n) => Number(n.toFixed(3)));
    li.annual = Number(monthlyArray.reduce((s, n) => s + n, 0).toFixed(3));
  }
  d.totalAnnual = Number(d.lineItems.reduce((s, l) => s + l.annual, 0).toFixed(3));
  d.monthlyDistribution = Array(12)
    .fill(0)
    .map((_, m) =>
      Number(d.lineItems.reduce((s, l) => s + l.monthlyDistribution[m], 0).toFixed(3))
    );
  return _brandObj({ ...li });
}

// ─────────────────────────────────────────
// BUDGET WORKFLOW — FY 2027 in DELEGATED state
// ─────────────────────────────────────────

// Deep clone of FY 2026 department structure with bumped numbers
function _fy2027Line(code, name, annual2026, growthPct = 0.06) {
  const annual = Math.round(annual2026 * (1 + growthPct));
  return {
    id: `LINE-27-${String(++_lineSeq).padStart(3, "0")}`,
    glAccountCode: code,
    glAccountName: name,
    annual,
    monthlyDistribution: _monthly12(annual),
    priorPeriodActual: annual2026,
    notes: null,
  };
}

function _fy2027Dept(id, name, category, ownerUserId, workflowStatus, extra = {}) {
  return { id, name, category, ownerUserId, workflowStatus, ...extra };
}

const _FY2027_DEPARTMENTS = [
  {
    ..._fy2027Dept("DEPT-sales-27", "Sales", "revenue", "cfo", "approved"),
    lineItems: [
      _fy2027Line("4100", "Sales Revenue",   1200000, 0.083), // → ~1,300,000
      _fy2027Line("4200", "Service Revenue", 0, 0),
    ],
    submittedAt: null,
    reviewedAt: new Date().toISOString(),
    assignedTaskId: null,
  },
  {
    ..._fy2027Dept("DEPT-operations-27", "Operations", "expense", "noor", "submitted"),
    lineItems: [
      _fy2027Line("5110", "Cost of Goods Sold",   480000, 0.06),
      _fy2027Line("5120", "Direct Labor",          90000, 0.06),
      _fy2027Line("5130", "Inventory adjustments", 18000, 0.06),
    ],
    submittedAt: _daysAgo(1),
    reviewedAt: null,
    assignedTaskId: "TSK-201",
  },
  {
    ..._fy2027Dept("DEPT-sales-ops-27", "Sales (Ops)", "expense", "jasem", "in-progress"),
    lineItems: [
      _fy2027Line("5200", "Sales Commissions", 36000, 0.06),
      _fy2027Line("5240", "Sales Travel",      15000, 0.06),
    ],
    submittedAt: null,
    reviewedAt: null,
    assignedTaskId: "TSK-202",
  },
  {
    ..._fy2027Dept("DEPT-marketing-27", "Marketing", "expense", "layla", "submitted"),
    lineItems: [
      _fy2027Line("6320", "Marketing & Advertising", 38000, 0.06),
      _fy2027Line("6310", "Trade Shows",             25000, 0.06),
      _fy2027Line("6330", "Agency Retainer",         28000, 0.06),
    ],
    submittedAt: _hoursAgo(3),
    reviewedAt: null,
    assignedTaskId: "TSK-203",
  },
  {
    ..._fy2027Dept("DEPT-tech-27", "Tech & Infra", "expense", "sara", "submitted"),
    lineItems: [
      _fy2027Line("6220", "Internet & Phone",        9000, 0.06),
      _fy2027Line("6230", "Software Subscriptions", 24000, 0.12), // Atlassian renewal bump
      _fy2027Line("6240", "Cloud Infra",            18000, 0.06),
    ],
    submittedAt: _daysAgo(1),
    reviewedAt: null,
    assignedTaskId: "TSK-204",
  },
  {
    ..._fy2027Dept("DEPT-admin-27", "Admin", "expense", "sara", "needs-revision", {
      revisionNotes: "Salaries line looks low — please double-check the new hires",
    }),
    lineItems: [
      _fy2027Line("6100", "Salaries & Wages",    168000, 0.06),
      _fy2027Line("6110", "PIFSS Contributions",  19200, 0.06),
      _fy2027Line("6200", "Office Rent",          50400, 0.06),
      _fy2027Line("6210", "Utilities",            12000, 0.06),
      _fy2027Line("6260", "Office Supplies",       5000, 0.06),
      _fy2027Line("6270", "Professional Fees",    10200, 0.06),
      _fy2027Line("6280", "Insurance",             4000, 0.06),
      _fy2027Line("6290", "Bank Charges",            900, 0.06),
    ],
    submittedAt: _daysAgo(2),
    reviewedAt: _hoursAgo(2),
    assignedTaskId: "TSK-205",
  },
];

// Fill in computed department totals + monthly distribution
_FY2027_DEPARTMENTS.forEach((d) => {
  d.totalAnnual = Number(d.lineItems.reduce((s, l) => s + l.annual, 0).toFixed(3));
  d.monthlyDistribution = Array(12)
    .fill(0)
    .map((_, m) =>
      Number(d.lineItems.reduce((s, l) => s + l.monthlyDistribution[m], 0).toFixed(3))
    );
});

const _FY2027_BUDGET = (() => {
  const totalRevenue = _FY2027_DEPARTMENTS
    .filter((d) => d.category === "revenue")
    .reduce((s, d) => s + d.totalAnnual, 0);
  const totalExpenses = _FY2027_DEPARTMENTS
    .filter((d) => d.category === "expense")
    .reduce((s, d) => s + d.totalAnnual, 0);
  return {
    id: "BUD-2027-FY",
    period: {
      type: "annual",
      label: "FY 2027",
      fiscalYear: 2027,
      startDate: new Date("2027-01-01").toISOString(),
      endDate: new Date("2027-12-31").toISOString(),
    },
    status: "delegated",
    approvedBy: null,
    approvedAt: null,
    createdBy: "cfo",
    createdAt: _daysAgo(5),
    totalRevenue: Number(totalRevenue.toFixed(3)),
    totalExpenses: Number(totalExpenses.toFixed(3)),
    netIncome: Number((totalRevenue - totalExpenses).toFixed(3)),
    departments: _FY2027_DEPARTMENTS,
    workflowHistory: [
      { timestamp: _daysAgo(5), fromState: null,       toState: "draft",     byUserId: "cfo", note: "Created FY 2027 budget from FY 2026 baseline" },
      { timestamp: _daysAgo(4), fromState: "draft",    toState: "delegated", byUserId: "cfo", note: "Delegated 5 expense departments to team" },
    ],
    aminahNarration: "", // computed per-call
  };
})();

// Annotate the FY 2026 active budget with workflow fields so both budgets share shape
_ACTIVE_BUDGET.workflowHistory = [
  { timestamp: _daysAgo(140), fromState: null,                 toState: "draft",             byUserId: "cfo",   note: "Created FY 2026 budget" },
  { timestamp: _daysAgo(130), fromState: "draft",              toState: "delegated",         byUserId: "cfo",   note: "Delegated to team" },
  { timestamp: _daysAgo(120), fromState: "delegated",          toState: "in-review",         byUserId: "cfo",   note: "All sections submitted" },
  { timestamp: _daysAgo(115), fromState: "in-review",          toState: "pending-approval",  byUserId: "cfo",   note: "Sent to Owner" },
  { timestamp: _daysAgo(112), fromState: "pending-approval",   toState: "active",            byUserId: "owner", note: "Owner approved" },
];
_ACTIVE_BUDGET.departments.forEach((d) => {
  d.workflowStatus = "approved";
  d.submittedAt = _daysAgo(120);
  d.reviewedAt = _daysAgo(118);
  d.assignedTaskId = null;
});

function _fy2027Narration() {
  const submittedCount = _FY2027_DEPARTMENTS.filter(
    (d) => d.category === "expense" && d.workflowStatus === "submitted"
  ).length;
  const expenseCount = _FY2027_DEPARTMENTS.filter((d) => d.category === "expense").length;
  return (
    `FY 2027 budget is currently [DELEGATED] — [${submittedCount} of ${expenseCount}] expense ` +
    `departments have submitted their drafts. Operations and Marketing came back on plan; ` +
    `Tech & Infra came back slightly tighter than my model. [Admin needs revision] — I flagged ` +
    `a salary line that looks low given the new hire announcements. Sales (Ops) is still in ` +
    `progress with Jasem. Once everything is in, we'll consolidate and send to the Owner for approval.`
  );
}

const _BUDGETS_DB = {
  [_ACTIVE_BUDGET.id]: _ACTIVE_BUDGET,
  [_FY2027_BUDGET.id]: _FY2027_BUDGET,
};

export async function getAllBudgets() {
  await delay();
  const list = Object.values(_BUDGETS_DB).sort(
    (a, b) => b.period.fiscalYear - a.period.fiscalYear
  );
  return _brandObj(
    list.map((b) => ({
      id: b.id,
      label: b.period.label,
      fiscalYear: b.period.fiscalYear,
      status: b.status,
      totalRevenue: b.totalRevenue,
      totalExpenses: b.totalExpenses,
      netIncome: b.netIncome,
    }))
  );
}

// Override getBudgetById to search across all budgets
export async function getBudgetByIdV2(id) {
  await delay();
  const b = _BUDGETS_DB[id];
  if (!b) return null;
  const narration =
    b.id === _ACTIVE_BUDGET.id ? _budgetNarration() : _fy2027Narration();
  return _brandObj({ ...b, aminahNarration: narration });
}

export async function getBudgetWorkflowSummary(budgetId) {
  await delay();
  const b = _BUDGETS_DB[budgetId];
  if (!b) return null;
  const expenseDepts = b.departments.filter((d) => d.category === "expense");
  const count = (status) => expenseDepts.filter((d) => d.workflowStatus === status).length;
  const totalDepartments = expenseDepts.length;
  const approved = count("approved");
  const submitted = count("submitted");
  const needsRevision = count("needs-revision");
  const inProgress = count("in-progress");
  const assigned = count("assigned");
  const unassigned = count("unassigned");
  const percentComplete = totalDepartments === 0
    ? 0
    : Math.round(((approved + submitted) / totalDepartments) * 100);
  return {
    budgetId,
    budgetStatus: b.status,
    totalDepartments,
    unassigned,
    assigned,
    inProgress,
    submitted,
    needsRevision,
    approved,
    percentComplete,
    expenseDepartments: expenseDepts.map((d) => ({
      id: d.id,
      name: d.name,
      workflowStatus: d.workflowStatus,
      ownerUserId: d.ownerUserId,
    })),
  };
}

// State transition functions
function _addHistory(b, fromState, toState, byUserId, note) {
  b.workflowHistory = b.workflowHistory || [];
  b.workflowHistory.push({
    timestamp: new Date().toISOString(),
    fromState,
    toState,
    byUserId,
    note: note || null,
  });
}

export async function delegateBudget(budgetId, assignments) {
  await delay();
  const b = _BUDGETS_DB[budgetId];
  if (!b || b.status !== "draft") return null;
  (assignments || []).forEach(({ departmentId, juniorUserId }) => {
    const d = b.departments.find((x) => x.id === departmentId);
    if (!d) return;
    d.ownerUserId = juniorUserId;
    d.workflowStatus = "assigned";
    // Seed a draft-budget task
    const junior = P[juniorUserId];
    if (!junior) return;
    const task = {
      id: _newId(),
      subject: `Draft your section: ${d.name} ${b.period.label}`,
      body: `Please draft the ${d.name} section for ${b.period.label}.`,
      type: "draft-budget",
      direction: "downward",
      status: "open",
      sender: P.cfo,
      recipient: junior,
      visibleTo: ["CFO", "Junior"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      linkedItem: { type: "budget-department", budgetId, departmentId, preview: `${d.name} · ${b.period.label}` },
      unread: true,
      thread: [
        _sysEvent("created", "You created this task"),
        _msgEvent(P.cfo, `Please draft the ${d.name} section for ${b.period.label}.`),
      ],
    };
    TASKBOX_DB.unshift(task);
    d.assignedTaskId = task.id;
  });
  _addHistory(b, b.status, "delegated", "cfo", "Delegated to team");
  b.status = "delegated";
  return _brandObj({ ...b });
}

export async function submitDepartment(budgetId, departmentId, juniorUserId, note) {
  await delay();
  const b = _BUDGETS_DB[budgetId];
  if (!b) return null;
  const d = b.departments.find((x) => x.id === departmentId);
  if (!d) return null;
  d.workflowStatus = "submitted";
  d.submittedAt = new Date().toISOString();
  const junior = P[juniorUserId] || P.sara;
  const task = {
    id: _newId(),
    subject: `Submitted: ${d.name} ${b.period.label} budget`,
    body: note || `Draft submitted for your review.`,
    type: "submit-budget-section",
    direction: "upward",
    status: "open",
    sender: junior,
    recipient: P.cfo,
    visibleTo: ["CFO", "Junior"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    linkedItem: { type: "budget-department", budgetId, departmentId, preview: `${d.name} · ${b.period.label}` },
    unread: true,
    thread: [
      _sysEvent("created", `${junior.name} created this task`),
      _msgEvent(junior, note || `Draft submitted for your review.`),
    ],
  };
  TASKBOX_DB.unshift(task);
  // If all expense departments now submitted/approved, flip budget to in-review
  const expenseDepts = b.departments.filter((x) => x.category === "expense");
  const allDone = expenseDepts.every(
    (x) => x.workflowStatus === "submitted" || x.workflowStatus === "approved"
  );
  if (allDone && b.status === "delegated") {
    _addHistory(b, "delegated", "in-review", "cfo", "All sections submitted");
    b.status = "in-review";
  }
  return _brandObj({ ...d });
}

export async function requestDepartmentRevision(budgetId, departmentId, notes) {
  await delay();
  const b = _BUDGETS_DB[budgetId];
  if (!b) return null;
  const d = b.departments.find((x) => x.id === departmentId);
  if (!d) return null;
  d.workflowStatus = "needs-revision";
  d.revisionNotes = notes || null;
  d.reviewedAt = new Date().toISOString();
  const junior = P[d.ownerUserId] || P.sara;
  const task = {
    id: _newId(),
    subject: `Revise: ${d.name} ${b.period.label}`,
    body: notes || `Please revise and resubmit.`,
    type: "request-budget-revision",
    direction: "downward",
    status: "open",
    sender: P.cfo,
    recipient: junior,
    visibleTo: ["CFO", "Junior"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    linkedItem: { type: "budget-department", budgetId, departmentId, preview: `${d.name} · ${b.period.label}` },
    unread: true,
    thread: [
      _sysEvent("created", "You created this task"),
      _msgEvent(P.cfo, notes || `Please revise and resubmit.`),
    ],
  };
  TASKBOX_DB.unshift(task);
  if (b.status === "in-review") {
    _addHistory(b, "in-review", "delegated", "cfo", "Revision requested");
    b.status = "delegated";
  }
  return _brandObj({ ...d });
}

export async function approveDepartment(budgetId, departmentId) {
  await delay();
  const b = _BUDGETS_DB[budgetId];
  if (!b) return null;
  const d = b.departments.find((x) => x.id === departmentId);
  if (!d) return null;
  d.workflowStatus = "approved";
  d.reviewedAt = new Date().toISOString();
  return _brandObj({ ...d });
}

export async function submitBudgetForApproval(budgetId) {
  await delay();
  const b = _BUDGETS_DB[budgetId];
  if (!b) return null;
  if (b.status !== "in-review" && b.status !== "delegated") return null;
  _addHistory(b, b.status, "pending-approval", "cfo", "Sent to Owner");
  b.status = "pending-approval";
  const task = {
    id: _newId(),
    subject: `Approve: ${b.period.label} budget`,
    body: `${b.period.label} budget ready for your approval. Total revenue ${b.totalRevenue.toLocaleString()}, expenses ${b.totalExpenses.toLocaleString()}, projected net income ${b.netIncome.toLocaleString()}.`,
    type: "approve-budget",
    direction: "lateral",
    status: "open",
    sender: P.cfo,
    recipient: P.owner,
    visibleTo: ["Owner", "CFO"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    linkedItem: { type: "budget-master", budgetId, preview: `${b.period.label} · ${b.departments.length} departments` },
    unread: true,
    thread: [
      _sysEvent("created", "You created this task"),
      _msgEvent(P.cfo, `${b.period.label} budget ready for your approval.`),
    ],
  };
  TASKBOX_DB.unshift(task);
  return _brandObj({ ...b });
}

export async function approveBudget(budgetId, approverId = "owner") {
  await delay();
  const b = _BUDGETS_DB[budgetId];
  if (!b || b.status !== "pending-approval") return null;
  _addHistory(b, "pending-approval", "active", approverId, "Approved");
  b.status = "active";
  b.approvedBy = approverId;
  b.approvedAt = new Date().toISOString();
  return _brandObj({ ...b });
}

export async function requestBudgetChanges(budgetId, notes) {
  await delay();
  const b = _BUDGETS_DB[budgetId];
  if (!b || b.status !== "pending-approval") return null;
  _addHistory(b, "pending-approval", "in-review", "owner", notes || "Change request from Owner");
  b.status = "in-review";
  return _brandObj({ ...b });
}

export async function closeBudget(budgetId) {
  await delay();
  const b = _BUDGETS_DB[budgetId];
  if (!b || b.status !== "active") return null;
  _addHistory(b, "active", "closed", "cfo", "Period closed");
  b.status = "closed";
  return _brandObj({ ...b });
}

// MOCK-mode adapters for the three new OWNER-only status transitions
// (2026-04-21). Mock-side status vocabulary is kebab-lower ("active",
// "in-review", etc.); live backend is UPPER_SNAKE ("APPROVED",
// "CHANGES_REQUESTED", "LOCKED", "REJECTED"). Per Dispatch 6 pattern the
// live ↔ mock vocabulary divergence is tolerated and the adapters accept
// the set of mock states that are semantically equivalent to the backend's
// allowed source states.
//   lock           APPROVED | CHANGES_REQUESTED → LOCKED
//     mock: "active" | "in-review" → "locked"
//   reopenToDraft  LOCKED   | REJECTED           → DRAFT
//     mock: "locked" | "rejected"                → "draft"
//   reject         PENDING_APPROVAL | CHANGES_REQUESTED → REJECTED
//     mock: "pending-approval" | "in-review"     → "rejected"
export async function lockBudget(budgetId, reason) {
  await delay();
  const b = _BUDGETS_DB[budgetId];
  if (!b || (b.status !== "active" && b.status !== "in-review")) return null;
  _addHistory(b, b.status, "locked", "owner", reason || "Locked");
  b.status = "locked";
  return _brandObj({ ...b });
}

export async function reopenBudgetToDraft(budgetId, reason) {
  await delay();
  const b = _BUDGETS_DB[budgetId];
  if (!b || (b.status !== "locked" && b.status !== "rejected")) return null;
  _addHistory(b, b.status, "draft", "owner", reason || "Reopened to draft");
  b.status = "draft";
  return _brandObj({ ...b });
}

export async function rejectBudget(budgetId, reason) {
  await delay();
  const b = _BUDGETS_DB[budgetId];
  if (!b || (b.status !== "pending-approval" && b.status !== "in-review")) return null;
  _addHistory(b, b.status, "rejected", "owner", reason || "Rejected");
  b.status = "rejected";
  return _brandObj({ ...b });
}

// Line item edit for juniors — also triggers status flip
export async function updateBudgetLineItemValue(budgetId, departmentId, lineItemId, newAnnual) {
  await delay();
  const b = _BUDGETS_DB[budgetId];
  if (!b) return null;
  const d = b.departments.find((x) => x.id === departmentId);
  if (!d) return null;
  const li = d.lineItems.find((x) => x.id === lineItemId);
  if (!li) return null;
  li.annual = Number(newAnnual);
  li.monthlyDistribution = _monthly12(li.annual);
  d.totalAnnual = Number(d.lineItems.reduce((s, l) => s + l.annual, 0).toFixed(3));
  d.monthlyDistribution = Array(12)
    .fill(0)
    .map((_, m) =>
      Number(d.lineItems.reduce((s, l) => s + l.monthlyDistribution[m], 0).toFixed(3))
    );
  b.totalRevenue = Number(
    b.departments.filter((x) => x.category === "revenue").reduce((s, x) => s + x.totalAnnual, 0).toFixed(3)
  );
  b.totalExpenses = Number(
    b.departments.filter((x) => x.category === "expense").reduce((s, x) => s + x.totalAnnual, 0).toFixed(3)
  );
  b.netIncome = Number((b.totalRevenue - b.totalExpenses).toFixed(3));
  // Flip department to in-progress if it was assigned
  if (d.workflowStatus === "assigned") d.workflowStatus = "in-progress";
  return _brandObj({ ...d });
}

// ─── FY 2027 seed tasks (hardcoded IDs referenced by department.assignedTaskId) ───
(function seedFy2027Tasks() {
  const seedTask = (id, type, sender, recipient, subject, body, deptId, extras) => ({
    id,
    subject,
    body,
    type,
    direction: sender.id === "cfo" ? "downward" : "upward",
    status: "open",
    sender,
    recipient,
    visibleTo: ["CFO", "Junior"],
    createdAt: extras?.createdAt || new Date().toISOString(),
    updatedAt: extras?.createdAt || new Date().toISOString(),
    linkedItem: { type: "budget-department", budgetId: "BUD-2027-FY", departmentId: deptId, preview: `${extras?.deptName} · FY 2027` },
    unread: true,
    thread: [
      _sysEvent("created", `${sender.name} created this task`, extras?.createdAt),
      _msgEvent(sender, body, extras?.createdAt),
      ...(extras?.extraMessages || []),
    ],
  });

  TASKBOX_DB.unshift(
    seedTask(
      "TSK-201", "submit-budget-section", P.noor, P.cfo,
      "Submitted: Operations FY 2027 budget",
      "Drafted Operations budget per the +6% guidance. Let me know if you want me to re-baseline COGS based on the latest supplier renegotiations.",
      "DEPT-operations-27",
      { createdAt: _daysAgo(1), deptName: "Operations",
        extraMessages: [_msgEvent(P.noor, "Note: if we can lock in the Alghanim price list for another year, I can shave 2% off COGS.", _hoursAgo(20))] }
    ),
    seedTask(
      "TSK-202", "draft-budget", P.cfo, P.jasem,
      "Draft your section: Sales Ops FY 2027",
      "Please draft the Sales Ops section for FY 2027. Targeting 54,000 KWD annual. Use prior year actuals as baseline plus the new commission structure we discussed.",
      "DEPT-sales-ops-27",
      { createdAt: _daysAgo(4), deptName: "Sales (Ops)" }
    ),
    seedTask(
      "TSK-203", "submit-budget-section", P.layla, P.cfo,
      "Submitted: Marketing FY 2027 budget",
      "FY 2027 Marketing draft attached. I tightened the agency retainer line and front-loaded trade shows to Q2 since we're attending GITEX in Q4.",
      "DEPT-marketing-27",
      { createdAt: _hoursAgo(3), deptName: "Marketing" }
    ),
    seedTask(
      "TSK-204", "submit-budget-section", P.sara, P.cfo,
      "Submitted: Tech & Infra FY 2027 budget",
      "Tech & Infra draft submitted. Software subscriptions line is up because of the Atlassian renewal you mentioned and the new HR system migration.",
      "DEPT-tech-27",
      { createdAt: _daysAgo(1), deptName: "Tech & Infra" }
    ),
    seedTask(
      "TSK-205", "request-budget-revision", P.cfo, P.sara,
      "Revise: Admin FY 2027 — salaries line",
      "The Admin budget you submitted has Salaries & Wages at 178,000. Given the 2 new hires we approved last month, I think it should be closer to 192,000. Can you revise and resubmit?",
      "DEPT-admin-27",
      { createdAt: _hoursAgo(2), deptName: "Admin",
        extraMessages: [_msgEvent(P.sara, "Got it — I'll revise and resubmit by end of day.", _hoursAgo(1))] }
    )
  );
})();

// Dynamic getOwnerTopInsight replacing the hardcoded version
export async function getOwnerTopInsightDynamic() {
  await delay();
  const marketing = _ACTIVE_BUDGET.departments.find((d) => d.name === "Marketing");
  const ytdFraction = 3 / 12;
  const ytdBudget = marketing ? marketing.totalAnnual * ytdFraction : 0;
  const ytdActual = _DEPT_YTD_ACTUALS["DEPT-marketing"] || 0;
  const pct = ytdBudget === 0 ? 0 : (ytdActual / ytdBudget) * 100;
  const projectedAnnual = ytdActual / ytdFraction;
  const overage = Math.max(0, projectedAnnual - (marketing?.totalAnnual || 0));
  const fmt = (n) =>
    n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  // Pick top 3 marketing line items by annual value
  const items = marketing
    ? marketing.lineItems.slice().sort((a, b) => b.annual - a.annual).slice(0, 3)
    : [];
  const itemStr = items
    .map((l) => `${l.glAccountName} ([${fmt(l.annual / 12)} KWD] monthly))`)
    .join(", ");
  const text =
    `Marketing spend is at [${pct.toFixed(0)}% of YTD budget] — at this pace projected annual ` +
    `overage is [+${fmt(overage)} KWD]. Top contributing lines: ${itemStr}. ` +
    `Want me to draft a board-level summary?`;
  return _brandObj({ id: "TOP-1", text, action: "draft-summary" });
}

// ─────────────────────────────────────────
// FY 2028 — DRAFT (for delegate modal demo)
// ─────────────────────────────────────────

const _FY2028_DEPARTMENTS = (() => {
  const depts = [
    {
      id: "DEPT-sales-28",
      name: "Sales",
      category: "revenue",
      ownerUserId: "cfo",
      workflowStatus: "unassigned",
      lineItems: [
        _fy2027Line("4100", "Sales Revenue",   1200000, 0.166),
        _fy2027Line("4200", "Service Revenue", 0, 0),
      ],
    },
    {
      id: "DEPT-operations-28",
      name: "Operations",
      category: "expense",
      ownerUserId: "cfo",
      workflowStatus: "unassigned",
      lineItems: [
        _fy2027Line("5110", "Cost of Goods Sold",   480000, 0.12),
        _fy2027Line("5120", "Direct Labor",          90000, 0.12),
        _fy2027Line("5130", "Inventory adjustments", 18000, 0.12),
      ],
    },
    {
      id: "DEPT-sales-ops-28",
      name: "Sales (Ops)",
      category: "expense",
      ownerUserId: "cfo",
      workflowStatus: "unassigned",
      lineItems: [
        _fy2027Line("5200", "Sales Commissions", 36000, 0.12),
        _fy2027Line("5240", "Sales Travel",      15000, 0.12),
      ],
    },
    {
      id: "DEPT-marketing-28",
      name: "Marketing",
      category: "expense",
      ownerUserId: "cfo",
      workflowStatus: "unassigned",
      lineItems: [
        _fy2027Line("6320", "Marketing & Advertising", 38000, 0.12),
        _fy2027Line("6310", "Trade Shows",             25000, 0.12),
        _fy2027Line("6330", "Agency Retainer",         28000, 0.12),
      ],
    },
    {
      id: "DEPT-tech-28",
      name: "Tech & Infra",
      category: "expense",
      ownerUserId: "cfo",
      workflowStatus: "unassigned",
      lineItems: [
        _fy2027Line("6220", "Internet & Phone",        9000, 0.12),
        _fy2027Line("6230", "Software Subscriptions", 24000, 0.18),
        _fy2027Line("6240", "Cloud Infra",            18000, 0.12),
      ],
    },
    {
      id: "DEPT-admin-28",
      name: "Admin",
      category: "expense",
      ownerUserId: "cfo",
      workflowStatus: "unassigned",
      lineItems: [
        _fy2027Line("6100", "Salaries & Wages",    168000, 0.12),
        _fy2027Line("6110", "PIFSS Contributions",  19200, 0.12),
        _fy2027Line("6200", "Office Rent",          50400, 0.12),
        _fy2027Line("6210", "Utilities",            12000, 0.12),
        _fy2027Line("6260", "Office Supplies",       5000, 0.12),
        _fy2027Line("6270", "Professional Fees",    10200, 0.12),
        _fy2027Line("6280", "Insurance",             4000, 0.12),
        _fy2027Line("6290", "Bank Charges",            900, 0.12),
      ],
    },
  ];
  depts.forEach((d) => {
    d.totalAnnual = Number(d.lineItems.reduce((s, l) => s + l.annual, 0).toFixed(3));
    d.monthlyDistribution = Array(12)
      .fill(0)
      .map((_, m) =>
        Number(d.lineItems.reduce((s, l) => s + l.monthlyDistribution[m], 0).toFixed(3))
      );
    d.submittedAt = null;
    d.reviewedAt = null;
    d.assignedTaskId = null;
  });
  return depts;
})();

const _FY2028_BUDGET = (() => {
  const totalRevenue = _FY2028_DEPARTMENTS
    .filter((d) => d.category === "revenue")
    .reduce((s, d) => s + d.totalAnnual, 0);
  const totalExpenses = _FY2028_DEPARTMENTS
    .filter((d) => d.category === "expense")
    .reduce((s, d) => s + d.totalAnnual, 0);
  return {
    id: "BUD-2028-FY",
    period: {
      type: "annual",
      label: "FY 2028",
      fiscalYear: 2028,
      startDate: new Date("2028-01-01").toISOString(),
      endDate: new Date("2028-12-31").toISOString(),
    },
    status: "draft",
    approvedBy: null,
    approvedAt: null,
    createdBy: "cfo",
    createdAt: _hoursAgo(6),
    totalRevenue: Number(totalRevenue.toFixed(3)),
    totalExpenses: Number(totalExpenses.toFixed(3)),
    netIncome: Number((totalRevenue - totalExpenses).toFixed(3)),
    departments: _FY2028_DEPARTMENTS,
    workflowHistory: [
      { timestamp: _hoursAgo(6), fromState: null, toState: "draft", byUserId: "cfo", note: "Created FY 2028 draft from FY 2027 baseline" },
    ],
    aminahNarration: "",
  };
})();

_BUDGETS_DB[_FY2028_BUDGET.id] = _FY2028_BUDGET;

// ─────────────────────────────────────────
// RECONCILIATION — bank vs ledger matching
// ─────────────────────────────────────────

const _RECONS_DB = {};

// Hand-crafted seed so counts match the spec exactly
function _mkBankItem(id, date, desc, ref, amount) {
  return { id, date, description: desc, reference: ref, amount };
}
function _mkLedgerEntry(id, date, desc, amount, jeId) {
  return { id, date, description: desc, amount, journalEntryId: jeId };
}
function _mkMatch(id, bankItemId, ledgerEntryId, tier, matchedBy = "engine") {
  return {
    id,
    bankItemId,
    ledgerEntryId,
    matchTier: tier,
    matchedAt: new Date().toISOString(),
    matchedBy,
    notes: null,
  };
}
function _mkException(id, type, description, suggestedAction, bankItemId = null, ledgerEntryId = null) {
  return {
    id,
    type,
    bankItemId,
    ledgerEntryId,
    description,
    suggestedAction,
    resolved: false,
    resolutionNotes: null,
  };
}

// ACC-1 KIB Operating — March 2026 — IN PROGRESS
// 30 bank + 30 ledger, 25 matched (24 exact + 1 manual), 5 exceptions, 5 unmatched per side
(function seedOperatingRec() {
  const matchedItems = [];
  const unmatchedBankItems = [];
  const unmatchedLedgerItems = [];
  const exceptions = [];

  // 25 matched pairs
  for (let i = 1; i <= 25; i++) {
    const bid = `OP-B${String(i).padStart(3, "0")}`;
    const lid = `OP-L${String(i).padStart(3, "0")}`;
    matchedItems.push(_mkMatch(`MATCH-OP-${i}`, bid, lid, i === 25 ? "manual" : "exact", i === 25 ? "sara" : "engine"));
  }

  // 5 unmatched bank items + 5 exceptions for the spec'd cases
  const unmatchedBank = [
    _mkBankItem("OP-B026", _daysAgo(8),  "Boubyan transfer in — unidentified", "TRF-INT-2847", 2462.5),
    _mkBankItem("OP-B027", _daysAgo(6),  "KIB wire fee",                        "FEE-0341",     -12.5),
    _mkBankItem("OP-B028", _daysAgo(4),  "KIB monthly service fee",             "FEE-0342",     -8.0),
    _mkBankItem("OP-B029", _daysAgo(3),  "Talabat payout (commission adj)",     "TLB-92104",    3800.0),
    _mkBankItem("OP-B030", _daysAgo(2),  "Alghanim Industries wire",            "ALG-88123",    12450.0),
    // 20D-3: items for pending suggestions
    _mkBankItem("OP-B031", _daysAgo(4),  "Zain Kuwait autopay",                 "DD-ZN-0412",   47.25),
    _mkBankItem("OP-B032", _daysAgo(3),  "Ooredoo fiber",                       "DD-OO-0413",   35.5),
    _mkBankItem("OP-B033", _daysAgo(2),  "Avenues Mall rent — April",           "STO-AV-0414",  4500.0),
    // 20D-3: items for ledger_only + duplicate exception types
    _mkBankItem("OP-B034", _daysAgo(1),  "Duplicate KNPC fuel",                 "POS-KNPC-DUP", 82.75),
  ];
  unmatchedBankItems.push(...unmatchedBank);

  const unmatchedLedger = [
    _mkLedgerEntry("OP-L026", _daysAgo(3), "Talabat payout (JE)", 3750.0, "JE-0411"),
    _mkLedgerEntry("OP-L027", _daysAgo(3), "Alghanim payment (JE)", 12450.0, "JE-0412"),
    // 20D-3: items for pending suggestions
    _mkLedgerEntry("OP-L028", _daysAgo(5), "Zain telecom bill", 47.25, "JE-0413"),
    _mkLedgerEntry("OP-L029", _daysAgo(4), "Internet service Ooredoo", 35.5, "JE-0414"),
    _mkLedgerEntry("OP-L030", _daysAgo(3), "Rent Avenues Mall", 4500.0, "JE-0415"),
    // 20D-3: ledger-only item (no bank counterpart)
    _mkLedgerEntry("OP-L031", _daysAgo(2), "PIFSS accrual — March", 1250.0, "JE-0416"),
  ];
  unmatchedLedgerItems.push(...unmatchedLedger);

  // 5 original exceptions + 3 new types for 20D-3 coverage
  exceptions.push(
    _mkException("EXC-OP-1", "unidentified",           "Boubyan transfer in for 2,462.500 KWD — no matching ledger entry found",      "investigate",     "OP-B026"),
    _mkException("EXC-OP-2", "missing-ledger-entry",   "KIB wire fee 12.500 KWD not yet booked to Bank Charges (6800)",               "create-je",       "OP-B027"),
    _mkException("EXC-OP-3", "missing-ledger-entry",   "KIB monthly service fee 8.000 KWD not yet booked to Bank Charges (6800)",    "create-je",       "OP-B028"),
    _mkException("EXC-OP-4", "amount-mismatch",         "Talabat bank payout 3,800.000 vs JE posted 3,750.000 — commission rounding", "investigate",     "OP-B029", "OP-L026"),
    _mkException("EXC-OP-5", "date-mismatch",           "Alghanim payment — bank shows 3 days ago, JE dated 4 days ago (fuzzy match)", "accept",          "OP-B030", "OP-L027"),
    // 20D-3: ledger_only exception
    _mkException("EXC-OP-6", "ledger-only",             "PIFSS accrual 1,250.000 KWD booked in ledger with no matching bank debit",   "investigate",     null,       "OP-L031"),
    // 20D-3: duplicate exception
    _mkException("EXC-OP-7", "duplicate",               "KNPC fuel 82.750 KWD appears twice — possible duplicate POS settlement",     "investigate",     "OP-B034"),
  );

  const openingBalance = 118000.25;
  const closingBankBalance = 142100.25;
  // Compute ledger closing as bank closing minus unresolved differences
  const closingLedgerBalance = closingBankBalance - 2462.5 + 12.5 + 8.0 - 50.0;

  _RECONS_DB["REC-2026-03-ACC-1"] = {
    id: "REC-2026-03-ACC-1",
    accountId: "ACC-1",
    period: { month: 3, year: 2026, label: "March 2026" },
    status: "in-progress",
    startedAt: _daysAgo(5),
    completedAt: null,
    completedBy: null,
    reopenedAt: null,
    lockedAt: null,
    approvalTaskId: null,
    openingBalance,
    closingBalance: closingBankBalance,
    closingLedgerBalance: Number(closingLedgerBalance.toFixed(3)),
    matchedItems,
    unmatchedBankItems,
    unmatchedLedgerItems,
    exceptions,
    pendingSuggestions: [
      { id: "SUGG-OP-1", bankItemId: "OP-B031", ledgerEntryId: "OP-L028", confidence: 85, tier: "fuzzy", dayDiff: 1, tokenOverlap: 0.55, createdAt: _daysAgo(3) },
      { id: "SUGG-OP-2", bankItemId: "OP-B032", ledgerEntryId: "OP-L029", confidence: 78, tier: "fuzzy", dayDiff: 1, tokenOverlap: 0.42, createdAt: _daysAgo(3) },
      { id: "SUGG-OP-3", bankItemId: "OP-B033", ledgerEntryId: "OP-L030", confidence: 92, tier: "fuzzy", dayDiff: 1, tokenOverlap: 0.60, createdAt: _daysAgo(2) },
    ],
    totalBankItems: 34,
    totalLedgerItems: 31,
    matchedCount: 25,
    exceptionCount: exceptions.length,
    reconciliationDifference: Number((closingBankBalance - closingLedgerBalance).toFixed(3)),
    activityLog: [
      { id: "ACT-1", timestamp: _daysAgo(5), user: "sara", action: "started",  detail: "Reconciliation started" },
      { id: "ACT-2", timestamp: _daysAgo(5), user: "engine", action: "auto-matched", detail: "24 items matched by engine (Tier 1)" },
      { id: "ACT-3", timestamp: _daysAgo(3), user: "sara", action: "manual-match", detail: "Matched 1 item manually" },
      { id: "ACT-4", timestamp: _daysAgo(2), user: "sara", action: "flagged",  detail: "Flagged 5 exceptions" },
      { id: "ACT-5", timestamp: _daysAgo(2), user: "engine", action: "suggestions", detail: "3 fuzzy match suggestions generated" },
    ],
  };
})();

// ACC-2 KIB Reserve — COMPLETED
(function seedReserveRec() {
  const matchedItems = [];
  for (let i = 1; i <= 12; i++) {
    matchedItems.push(_mkMatch(`MATCH-RS-${i}`, `RS-B${i}`, `RS-L${i}`, "exact"));
  }
  _RECONS_DB["REC-2026-03-ACC-2"] = {
    id: "REC-2026-03-ACC-2",
    accountId: "ACC-2",
    period: { month: 3, year: 2026, label: "March 2026" },
    status: "completed",
    startedAt: _daysAgo(4),
    completedAt: _daysAgo(1),
    completedBy: "sara",
    reopenedAt: null,
    lockedAt: null,
    approvalTaskId: null,
    openingBalance: 37000.0,
    closingBalance: 42135.25,
    closingLedgerBalance: 42135.25,
    matchedItems,
    unmatchedBankItems: [],
    unmatchedLedgerItems: [],
    exceptions: [],
    pendingSuggestions: [],
    totalBankItems: 12,
    totalLedgerItems: 12,
    matchedCount: 12,
    exceptionCount: 0,
    reconciliationDifference: 0,
    activityLog: [
      { id: "ACT-R1", timestamp: _daysAgo(4), user: "sara",   action: "started",       detail: "Reconciliation started" },
      { id: "ACT-R2", timestamp: _daysAgo(4), user: "engine", action: "auto-matched",  detail: "12 items matched by engine (Tier 1)" },
      { id: "ACT-R3", timestamp: _daysAgo(1), user: "sara",   action: "completed",     detail: "Reconciliation completed" },
    ],
  };
})();

// ACC-3 KIB Settlement — IN PROGRESS — 18/20 + 2 POS timing exceptions + 20D-3 suggestions
(function seedSettlementRec() {
  const matchedItems = [];
  for (let i = 1; i <= 18; i++) {
    matchedItems.push(_mkMatch(`MATCH-ST-${i}`, `ST-B${i}`, `ST-L${i}`, "exact"));
  }
  const unmatchedBankItems = [
    _mkBankItem("ST-B019", _daysAgo(2), "POS batch settlement", "POS-3471", 1420.0),
    _mkBankItem("ST-B020", _daysAgo(1), "POS batch settlement", "POS-3472", 1385.0),
    // 20D-3: items for pending suggestions
    _mkBankItem("ST-B021", _daysAgo(2), "KNPC fuel station — Salmiya",    "POS-KNPC-441", 68.5),
    _mkBankItem("ST-B022", _daysAgo(1), "PIFSS monthly",                   "DD-PIFSS-03",  2180.0),
    _mkBankItem("ST-B023", _daysAgo(1), "Alghanim Industries deposit",     "WIRE-ALG-812", 5420.0),
    _mkBankItem("ST-B024", _daysAgo(1), "Talabat daily payout — Mar 27",   "TLB-93201",    1840.5),
    // 20D-3: bank_only exception item
    _mkBankItem("ST-B025", _daysAgo(1), "Unknown ATM withdrawal — Farwaniya", "ATM-FRW-01", -200.0),
  ];
  const unmatchedLedgerItems = [
    _mkLedgerEntry("ST-L019", _daysAgo(3), "POS receipts batch (pre-settlement)", 1420.0, "JE-0401"),
    _mkLedgerEntry("ST-L020", _daysAgo(2), "POS receipts batch (pre-settlement)", 1385.0, "JE-0402"),
    // 20D-3: items for pending suggestions
    _mkLedgerEntry("ST-L021", _daysAgo(3), "Fuel expense KNPC", 68.5, "JE-0403"),
    _mkLedgerEntry("ST-L022", _daysAgo(2), "PIFSS contribution — March", 2180.0, "JE-0404"),
    _mkLedgerEntry("ST-L023", _daysAgo(2), "Alghanim receivable deposit", 5420.0, "JE-0405"),
    _mkLedgerEntry("ST-L024", _daysAgo(2), "Talabat POS payout batch", 1840.5, "JE-0406"),
  ];
  const exceptions = [
    _mkException("EXC-ST-1", "date-mismatch", "POS settlement timing — bank Mar 6, ledger Mar 5",   "accept", "ST-B019", "ST-L019"),
    _mkException("EXC-ST-2", "date-mismatch", "POS settlement timing — bank Mar 7, ledger Mar 5",   "accept", "ST-B020", "ST-L020"),
    // 20D-3: bank_only exception
    _mkException("EXC-ST-3", "bank-only",     "ATM withdrawal 200.000 KWD — no matching ledger entry", "create-je", "ST-B025"),
  ];
  _RECONS_DB["REC-2026-03-ACC-3"] = {
    id: "REC-2026-03-ACC-3",
    accountId: "ACC-3",
    period: { month: 3, year: 2026, label: "March 2026" },
    status: "in-progress",
    startedAt: _daysAgo(3),
    completedAt: null,
    completedBy: null,
    reopenedAt: null,
    lockedAt: null,
    approvalTaskId: null,
    openingBalance: 15015.75,
    closingBalance: 18420.75,
    closingLedgerBalance: 18420.75,
    matchedItems,
    unmatchedBankItems,
    unmatchedLedgerItems,
    exceptions,
    pendingSuggestions: [
      { id: "SUGG-ST-1", bankItemId: "ST-B021", ledgerEntryId: "ST-L021", confidence: 82, tier: "fuzzy", dayDiff: 1, tokenOverlap: 0.48, createdAt: _daysAgo(2) },
      { id: "SUGG-ST-2", bankItemId: "ST-B022", ledgerEntryId: "ST-L022", confidence: 90, tier: "fuzzy", dayDiff: 1, tokenOverlap: 0.65, createdAt: _daysAgo(1) },
      { id: "SUGG-ST-3", bankItemId: "ST-B023", ledgerEntryId: "ST-L023", confidence: 88, tier: "fuzzy", dayDiff: 1, tokenOverlap: 0.52, createdAt: _daysAgo(1) },
      { id: "SUGG-ST-4", bankItemId: "ST-B024", ledgerEntryId: "ST-L024", confidence: 76, tier: "fuzzy", dayDiff: 1, tokenOverlap: 0.45, createdAt: _daysAgo(1) },
    ],
    totalBankItems: 25,
    totalLedgerItems: 24,
    matchedCount: 18,
    exceptionCount: 3,
    reconciliationDifference: 0,
    activityLog: [
      { id: "ACT-S1", timestamp: _daysAgo(3), user: "sara",   action: "started",      detail: "Reconciliation started" },
      { id: "ACT-S2", timestamp: _daysAgo(3), user: "engine", action: "auto-matched", detail: "18 items matched (Tier 1)" },
      { id: "ACT-S3", timestamp: _daysAgo(2), user: "sara",   action: "flagged",      detail: "Flagged 2 POS timing exceptions" },
      { id: "ACT-S4", timestamp: _daysAgo(1), user: "engine", action: "suggestions",  detail: "4 fuzzy match suggestions generated" },
    ],
  };
})();

// ACC-4 KIB USD — NOT STARTED
(function seedUsdRec() {
  _RECONS_DB["REC-2026-03-ACC-4"] = {
    id: "REC-2026-03-ACC-4",
    accountId: "ACC-4",
    period: { month: 3, year: 2026, label: "March 2026" },
    status: "not-started",
    startedAt: null,
    completedAt: null,
    completedBy: null,
    reopenedAt: null,
    lockedAt: null,
    approvalTaskId: null,
    openingBalance: 5816.5,
    closingBalance: 8240.5,
    closingLedgerBalance: 8240.5,
    matchedItems: [],
    unmatchedBankItems: [],
    unmatchedLedgerItems: [],
    exceptions: [],
    pendingSuggestions: [],
    totalBankItems: 8,
    totalLedgerItems: 8,
    matchedCount: 0,
    exceptionCount: 0,
    reconciliationDifference: 0,
    activityLog: [],
  };
})();

// ─── Matching engine (3-tier) ───
function _normalizeTokens(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((t) => t.length > 3);
}
function _tokenOverlap(a, b) {
  const ta = _normalizeTokens(a);
  const tb = _normalizeTokens(b);
  if (!ta.length || !tb.length) return 0;
  const setB = new Set(tb);
  const hit = ta.filter((t) => setB.has(t)).length;
  return hit / Math.max(ta.length, tb.length);
}
function _runMatchingEngine(bankItems, ledgerEntries) {
  const tier1Matches = [];
  const tier2Suggestions = [];
  const usedBank = new Set();
  const usedLedger = new Set();

  // Tier 1 — exact
  bankItems.forEach((b) => {
    if (usedBank.has(b.id)) return;
    const match = ledgerEntries.find(
      (l) =>
        !usedLedger.has(l.id) &&
        Math.abs(l.amount - b.amount) < 0.001 &&
        new Date(l.date).toDateString() === new Date(b.date).toDateString() &&
        _tokenOverlap(b.description, l.description) > 0.3
    );
    if (match) {
      tier1Matches.push({ bankItem: b, ledgerEntry: match, tier: "exact", confidence: 100 });
      usedBank.add(b.id);
      usedLedger.add(match.id);
    }
  });

  // Tier 2 — fuzzy (amount match, date within ±2 days)
  bankItems.forEach((b) => {
    if (usedBank.has(b.id)) return;
    const candidates = ledgerEntries
      .filter((l) => !usedLedger.has(l.id) && Math.abs(l.amount - b.amount) < 0.001)
      .map((l) => {
        const dayDiff = Math.abs(
          (new Date(l.date) - new Date(b.date)) / (1000 * 60 * 60 * 24)
        );
        const overlap = _tokenOverlap(b.description, l.description);
        const confidence = Math.round(100 - dayDiff * 15 + overlap * 20);
        return { ledgerEntry: l, dayDiff, overlap, confidence };
      })
      .filter((c) => c.dayDiff <= 2)
      .sort((a, b) => b.confidence - a.confidence);
    if (candidates.length) {
      const best = candidates[0];
      tier2Suggestions.push({
        bankItem: b,
        ledgerEntry: best.ledgerEntry,
        tier: "fuzzy",
        confidence: best.confidence,
      });
      usedBank.add(b.id);
      usedLedger.add(best.ledgerEntry.id);
    }
  });

  const unmatchedBank = bankItems.filter((b) => !usedBank.has(b.id));
  const unmatchedLedger = ledgerEntries.filter((l) => !usedLedger.has(l.id));
  return { tier1Matches, tier2Suggestions, unmatchedBank, unmatchedLedger };
}

// Read functions
export async function getReconciliationDashboard() {
  await delay();
  const accounts = await getBankAccounts();
  const rows = accounts.map((a) => {
    const rec = Object.values(_RECONS_DB).find((r) => r.accountId === a.id && r.period.year === 2026 && r.period.month === 3);
    return {
      accountId: a.id,
      accountName: a.accountName,
      accountNumberMasked: a.accountNumberMasked,
      bankName: a.bankName,
      accentColor: a.accentColor,
      currentReconciliationId: rec ? rec.id : null,
      status: rec ? rec.status : "not-started",
      matchedCount: rec ? rec.matchedCount : 0,
      totalCount: rec ? rec.totalBankItems : 0,
      exceptionCount: rec ? rec.exceptionCount : 0,
      lastReconciledAt: rec ? (rec.completedAt || rec.startedAt) : null,
    };
  });
  return _brandObj(rows);
}

export async function getReconciliationsForAccount(accountId) {
  await delay();
  const list = Object.values(_RECONS_DB)
    .filter((r) => r.accountId === accountId)
    .sort((a, b) => (b.period.year - a.period.year) || (b.period.month - a.period.month));
  return _brandObj(list);
}

export async function getReconciliationById(id) {
  await delay();
  const r = _RECONS_DB[id];
  return r ? _brandObj({ ...r, matchedItems: [...r.matchedItems], unmatchedBankItems: [...r.unmatchedBankItems], unmatchedLedgerItems: [...r.unmatchedLedgerItems], exceptions: [...r.exceptions], activityLog: [...r.activityLog] }) : null;
}

export async function getReconciliationHistory(accountId) {
  await delay();
  const allRecs = Object.values(_RECONS_DB)
    .filter((r) => r.accountId === accountId)
    .map((r) => ({
      id: r.id,
      period: r.period,
      status: r.status,
      completedAt: r.completedAt,
      completedBy: r.completedBy,
      openingBalance: r.openingBalance,
      closingBalance: r.closingBalance,
      matchedCount: r.matchedCount,
      totalBankItems: r.totalBankItems,
      exceptionCount: (r.exceptions || []).filter((e) => e.resolved).length,
      reconciliationDifference: r.reconciliationDifference,
    }))
    .sort((a, b) => {
      const aKey = `${a.period.year}-${String(a.period.month).padStart(2, "0")}`;
      const bKey = `${b.period.year}-${String(b.period.month).padStart(2, "0")}`;
      return bKey.localeCompare(aKey);
    });
  return _brandObj(allRecs);
}

// Action functions
function _recomputeCounts(rec) {
  rec.matchedCount = rec.matchedItems.length;
  rec.exceptionCount = rec.exceptions.filter((e) => !e.resolved).length;
  rec.totalBankItems = rec.matchedItems.length + rec.unmatchedBankItems.length;
  rec.totalLedgerItems = rec.matchedItems.length + rec.unmatchedLedgerItems.length;
}
function _logActivity(rec, user, action, detail) {
  rec.activityLog.push({
    id: `ACT-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    user,
    action,
    detail,
  });
}

export async function manualMatch(reconciliationId, bankItemId, ledgerEntryId, user = "sara") {
  await delay();
  const r = _RECONS_DB[reconciliationId];
  if (!r) return null;
  const bi = r.unmatchedBankItems.find((x) => x.id === bankItemId);
  const le = r.unmatchedLedgerItems.find((x) => x.id === ledgerEntryId);
  if (!bi || !le) return null;
  r.unmatchedBankItems = r.unmatchedBankItems.filter((x) => x.id !== bankItemId);
  r.unmatchedLedgerItems = r.unmatchedLedgerItems.filter((x) => x.id !== ledgerEntryId);
  r.matchedItems.push(_mkMatch(`MATCH-${Math.random().toString(36).slice(2, 6)}`, bankItemId, ledgerEntryId, "manual", user));
  _logActivity(r, user, "manual-match", `Manually matched ${bankItemId} ↔ ${ledgerEntryId}`);
  _recomputeCounts(r);
  return _brandObj({ ...r });
}

export async function unmatch(reconciliationId, matchId, user = "sara") {
  await delay();
  const r = _RECONS_DB[reconciliationId];
  if (!r) return null;
  const m = r.matchedItems.find((x) => x.id === matchId);
  if (!m) return null;
  r.matchedItems = r.matchedItems.filter((x) => x.id !== matchId);
  _logActivity(r, user, "unmatch", `Unmatched ${matchId}`);
  _recomputeCounts(r);
  return _brandObj({ ...r });
}

export async function resolveException(reconciliationId, exceptionId, resolution, user = "sara") {
  await delay();
  const r = _RECONS_DB[reconciliationId];
  if (!r) return null;
  const e = r.exceptions.find((x) => x.id === exceptionId);
  if (!e) return null;
  e.resolved = true;
  e.resolutionNotes = resolution || null;
  // If the exception was linked to a bank+ledger pair (fuzzy/date mismatch), auto-match them
  if (e.bankItemId && e.ledgerEntryId) {
    const bi = r.unmatchedBankItems.find((x) => x.id === e.bankItemId);
    const le = r.unmatchedLedgerItems.find((x) => x.id === e.ledgerEntryId);
    if (bi && le) {
      r.unmatchedBankItems = r.unmatchedBankItems.filter((x) => x.id !== e.bankItemId);
      r.unmatchedLedgerItems = r.unmatchedLedgerItems.filter((x) => x.id !== e.ledgerEntryId);
      r.matchedItems.push(_mkMatch(`MATCH-${Math.random().toString(36).slice(2, 6)}`, e.bankItemId, e.ledgerEntryId, "manual", user));
    }
  }
  _logActivity(r, user, "resolved-exception", `Resolved ${exceptionId}: ${resolution || "accepted"}`);
  _recomputeCounts(r);
  return _brandObj({ ...r });
}

export async function createMissingJournalEntry(reconciliationId, bankItemId, debitAccount, creditAccount, amount, user = "sara") {
  await delay();
  const r = _RECONS_DB[reconciliationId];
  if (!r) return null;
  const bi = r.unmatchedBankItems.find((x) => x.id === bankItemId);
  if (!bi) return null;
  const jeId = `JE-${Math.floor(500 + Math.random() * 500)}`;
  const le = _mkLedgerEntry(`LE-${Math.random().toString(36).slice(2, 6)}`, bi.date, `Auto-created from ${bi.reference}`, bi.amount, jeId);
  r.unmatchedBankItems = r.unmatchedBankItems.filter((x) => x.id !== bankItemId);
  r.matchedItems.push(_mkMatch(`MATCH-${Math.random().toString(36).slice(2, 6)}`, bankItemId, le.id, "manual", user));
  // Remove the related exception
  r.exceptions = r.exceptions.filter((e) => e.bankItemId !== bankItemId);
  _logActivity(r, user, "created-je", `Created ${jeId} for ${bi.reference} (${amount})`);
  _recomputeCounts(r);
  return _brandObj({ ...r, newJournalEntryId: jeId });
}

export async function completeReconciliation(reconciliationId, completedBy = "sara", options = {}) {
  await delay();
  const r = _RECONS_DB[reconciliationId];
  if (!r) return null;

  const unresolvedExceptions = (r.exceptions || []).filter((e) => !e.resolved).length;
  const hasDifference = Math.abs(r.reconciliationDifference || 0) > 0.001;
  const forceComplete = !!options.force;

  if ((unresolvedExceptions > 0 || hasDifference) && !forceComplete) {
    return {
      error: "Cannot complete — unresolved exceptions or difference",
      unresolvedExceptions,
      difference: r.reconciliationDifference,
      status: r.status,
    };
  }

  // Check period status for soft-closed routing
  const periodDate = new Date(r.period.year, r.period.month - 1, 15);
  const periodStatus = await checkPeriodStatus(periodDate);

  if (periodStatus.status === "soft-closed") {
    const taskId = `TSK-REC-${Math.floor(Math.random() * 10000)}`;
    TASKBOX_DB.unshift({
      id: taskId,
      type: "request-approval",
      title: `Reconciliation ${r.period.label} — needs approval`,
      body: `CFO has completed the ${r.period.label} reconciliation for account ${r.accountId}. Approval required because the period is soft-closed.`,
      from: completedBy,
      to: "owner",
      status: "open",
      priority: "high",
      createdAt: new Date().toISOString(),
      unread: true,
      linkedItem: { type: "reconciliation", reconciliationId: r.id, accountId: r.accountId, period: r.period },
      attachments: [],
    });
    r.approvalTaskId = taskId;
    r.status = "pending-approval";
    _logActivity(r, completedBy, "submitted-for-approval", `Submitted for Owner approval (soft-closed period) — task ${taskId}`);
    return _brandObj({ ...r, activityLog: [...r.activityLog], requiresApproval: true, approvalTaskId: taskId });
  }

  r.status = "completed";
  r.completedAt = new Date().toISOString();
  r.completedBy = completedBy;
  if (forceComplete && unresolvedExceptions > 0) {
    _logActivity(r, completedBy, "completed-with-exceptions", `Completed with ${unresolvedExceptions} unresolved exceptions (forced)`);
  } else {
    _logActivity(r, completedBy, "completed", "Reconciliation completed");
  }
  return _brandObj({ ...r, activityLog: [...r.activityLog], requiresApproval: false });
}

export async function lockReconciliation(reconciliationId) {
  await delay();
  const r = _RECONS_DB[reconciliationId];
  if (!r || r.status !== "completed") return null;
  r.status = "locked";
  r.lockedAt = new Date().toISOString();
  _logActivity(r, "system", "locked", "Period locked");
  return _brandObj({ ...r });
}

export async function createReconciliation(accountId, period) {
  await delay();
  const id = `REC-${period.year}-${String(period.month).padStart(2, "0")}-${accountId}`;
  if (_RECONS_DB[id]) return _brandObj({ ..._RECONS_DB[id] });
  // Minimal stub — real impl would pull bank statement + ledger for period
  const r = {
    id,
    accountId,
    period,
    status: "in-progress",
    startedAt: new Date().toISOString(),
    completedAt: null,
    completedBy: null,
    openingBalance: 0,
    closingBalance: 0,
    closingLedgerBalance: 0,
    matchedItems: [],
    unmatchedBankItems: [],
    unmatchedLedgerItems: [],
    exceptions: [],
    totalBankItems: 0,
    totalLedgerItems: 0,
    matchedCount: 0,
    exceptionCount: 0,
    reconciliationDifference: 0,
    activityLog: [{ id: "ACT-NEW", timestamp: new Date().toISOString(), user: "sara", action: "started", detail: "Reconciliation started" }],
  };
  _RECONS_DB[id] = r;
  return _brandObj({ ...r });
}

// ─────────────────────────────────────────────────────────────────────────────
// Reconciliation 20D-3 extensions
// Added: confirmSuggestion, dismissSuggestion, bulkMatchByRule, previewBulkMatchByRule,
//        reopenReconciliation, approveReconciliationCompletion, rejectReconciliationCompletion,
//        resolveExceptionWithJE, parseBankStatementCSV, importUploadedStatement, exportReconciliationCSV
// Modified: completeReconciliation (additive options parameter), getReconciliationHistory (replaced stub)
// ─────────────────────────────────────────────────────────────────────────────

export async function confirmSuggestion(reconciliationId, suggestionId, user = "cfo") {
  await delay();
  const r = _RECONS_DB[reconciliationId];
  if (!r) return null;
  const sugg = (r.pendingSuggestions || []).find((s) => s.id === suggestionId);
  if (!sugg) return null;
  r.pendingSuggestions = r.pendingSuggestions.filter((s) => s.id !== suggestionId);
  r.unmatchedBankItems = r.unmatchedBankItems.filter((b) => b.id !== sugg.bankItemId);
  r.unmatchedLedgerItems = r.unmatchedLedgerItems.filter((l) => l.id !== sugg.ledgerEntryId);
  const matchId = `MATCH-${Math.random().toString(36).slice(2, 8)}`;
  r.matchedItems.push(_mkMatch(matchId, sugg.bankItemId, sugg.ledgerEntryId, "fuzzy-confirmed", user));
  _logActivity(r, user, "confirmed-suggestion", `Confirmed fuzzy match ${sugg.bankItemId} with ${sugg.ledgerEntryId} (${sugg.confidence}%)`);
  _recomputeCounts(r);
  return _brandObj({ ...r, matchedItems: [...r.matchedItems], unmatchedBankItems: [...r.unmatchedBankItems], unmatchedLedgerItems: [...r.unmatchedLedgerItems], pendingSuggestions: [...r.pendingSuggestions], exceptions: [...r.exceptions], activityLog: [...r.activityLog] });
}

export async function dismissSuggestion(reconciliationId, suggestionId, user = "cfo") {
  await delay();
  const r = _RECONS_DB[reconciliationId];
  if (!r) return null;
  const sugg = (r.pendingSuggestions || []).find((s) => s.id === suggestionId);
  if (!sugg) return null;
  r.pendingSuggestions = r.pendingSuggestions.filter((s) => s.id !== suggestionId);
  _logActivity(r, user, "dismissed-suggestion", `Dismissed fuzzy match ${sugg.bankItemId} with ${sugg.ledgerEntryId}`);
  return _brandObj({ ...r, pendingSuggestions: [...r.pendingSuggestions], activityLog: [...r.activityLog] });
}

export async function bulkMatchByRule(reconciliationId, rule, user = "cfo") {
  await delay();
  const r = _RECONS_DB[reconciliationId];
  if (!r) return null;
  const amountTolerance = Number(rule.amountTolerance || 0.010);
  const dateToleranceDays = Number(rule.dateToleranceDays || 2);
  const minOverlap = Number(rule.minDescriptionOverlap || 0);
  const usedBank = new Set();
  const usedLedger = new Set();
  const newMatches = [];
  r.unmatchedBankItems.forEach((b) => {
    if (usedBank.has(b.id)) return;
    const candidate = r.unmatchedLedgerItems.find((l) => {
      if (usedLedger.has(l.id)) return false;
      if (Math.abs(l.amount - b.amount) > amountTolerance) return false;
      const dayDiff = Math.abs((new Date(l.date) - new Date(b.date)) / (1000 * 60 * 60 * 24));
      if (dayDiff > dateToleranceDays) return false;
      if (minOverlap > 0 && _tokenOverlap(b.description, l.description) < minOverlap) return false;
      return true;
    });
    if (candidate) {
      usedBank.add(b.id);
      usedLedger.add(candidate.id);
      newMatches.push({ bankItem: b, ledgerEntry: candidate });
    }
  });
  newMatches.forEach(({ bankItem, ledgerEntry }) => {
    r.unmatchedBankItems = r.unmatchedBankItems.filter((b) => b.id !== bankItem.id);
    r.unmatchedLedgerItems = r.unmatchedLedgerItems.filter((l) => l.id !== ledgerEntry.id);
    r.matchedItems.push(_mkMatch(`MATCH-${Math.random().toString(36).slice(2, 8)}`, bankItem.id, ledgerEntry.id, "bulk-rule", user));
  });
  _logActivity(r, user, "bulk-matched", `Bulk matched ${newMatches.length} items via rule (amount +/- ${amountTolerance}, date +/- ${dateToleranceDays} days)`);
  _recomputeCounts(r);
  return { reconciliation: _brandObj({ ...r, matchedItems: [...r.matchedItems], unmatchedBankItems: [...r.unmatchedBankItems], unmatchedLedgerItems: [...r.unmatchedLedgerItems], pendingSuggestions: [...(r.pendingSuggestions || [])], exceptions: [...r.exceptions], activityLog: [...r.activityLog] }), matchedCount: newMatches.length };
}

export async function previewBulkMatchByRule(reconciliationId, rule) {
  await delay();
  const r = _RECONS_DB[reconciliationId];
  if (!r) return null;
  const amountTolerance = Number(rule.amountTolerance || 0.010);
  const dateToleranceDays = Number(rule.dateToleranceDays || 2);
  const minOverlap = Number(rule.minDescriptionOverlap || 0);
  const usedBank = new Set();
  const usedLedger = new Set();
  const previewMatches = [];
  r.unmatchedBankItems.forEach((b) => {
    if (usedBank.has(b.id)) return;
    const candidate = r.unmatchedLedgerItems.find((l) => {
      if (usedLedger.has(l.id)) return false;
      if (Math.abs(l.amount - b.amount) > amountTolerance) return false;
      const dayDiff = Math.abs((new Date(l.date) - new Date(b.date)) / (1000 * 60 * 60 * 24));
      if (dayDiff > dateToleranceDays) return false;
      if (minOverlap > 0 && _tokenOverlap(b.description, l.description) < minOverlap) return false;
      return true;
    });
    if (candidate) {
      usedBank.add(b.id);
      usedLedger.add(candidate.id);
      previewMatches.push({ bankItem: { ...b }, ledgerEntry: { ...candidate } });
    }
  });
  return _brandObj({ matchCount: previewMatches.length, matches: previewMatches });
}

export async function reopenReconciliation(reconciliationId, user = "cfo") {
  await delay();
  const r = _RECONS_DB[reconciliationId];
  if (!r) return null;
  if (r.status !== "completed" && r.status !== "locked") {
    return { error: "Can only reopen a completed or locked reconciliation", status: r.status };
  }
  const wasLocked = r.status === "locked";
  r.status = "in-progress";
  r.reopenedAt = new Date().toISOString();
  r.completedAt = null;
  r.completedBy = null;
  r.lockedAt = null;
  _logActivity(r, user, "reopened", wasLocked ? "Reopened from locked" : "Reopened from completed");
  return _brandObj({ ...r, activityLog: [...r.activityLog] });
}

export async function approveReconciliationCompletion(reconciliationId, approvedBy = "owner") {
  await delay();
  const r = _RECONS_DB[reconciliationId];
  if (!r) return null;
  if (r.status !== "pending-approval") {
    return { error: "Reconciliation is not pending approval", status: r.status };
  }
  r.status = "completed";
  r.completedAt = new Date().toISOString();
  r.completedBy = approvedBy;
  r.approvalTaskId = null;
  _logActivity(r, approvedBy, "approved", "Owner approved reconciliation completion");
  return _brandObj({ ...r, activityLog: [...r.activityLog] });
}

export async function rejectReconciliationCompletion(reconciliationId, rejectedBy = "owner", reason = "") {
  await delay();
  const r = _RECONS_DB[reconciliationId];
  if (!r) return null;
  if (r.status !== "pending-approval") {
    return { error: "Reconciliation is not pending approval", status: r.status };
  }
  r.status = "in-progress";
  r.approvalTaskId = null;
  _logActivity(r, rejectedBy, "approval-rejected", reason ? `Owner rejected: ${reason}` : "Owner rejected approval");
  return _brandObj({ ...r, activityLog: [...r.activityLog] });
}

export async function resolveExceptionWithJE(reconciliationId, exceptionId, resolutionType, jeData, user = "cfo") {
  await delay();
  const r = _RECONS_DB[reconciliationId];
  if (!r) return null;
  const exc = (r.exceptions || []).find((e) => e.id === exceptionId);
  if (!exc) return null;

  const _fullReturn = () => _brandObj({
    ...r,
    matchedItems: [...r.matchedItems],
    unmatchedBankItems: [...r.unmatchedBankItems],
    unmatchedLedgerItems: [...r.unmatchedLedgerItems],
    pendingSuggestions: [...(r.pendingSuggestions || [])],
    exceptions: [...r.exceptions],
    activityLog: [...r.activityLog],
  });

  if (resolutionType === "create_je_from_statement") {
    if (!exc.bankItemId) return { error: "Exception has no bankItemId" };
    const result = await createMissingJournalEntry(reconciliationId, exc.bankItemId, jeData.debitAccount, jeData.creditAccount, jeData.amount, user);
    if (result && !result.error) {
      const e2 = r.exceptions.find((e) => e.id === exceptionId);
      if (e2) { e2.resolved = true; e2.resolutionNotes = `Created JE: ${jeData.debitAccount} / ${jeData.creditAccount}`; }
      _recomputeCounts(r);
      return _fullReturn();
    }
    return result;
  }

  if (resolutionType === "create_adjustment_je") {
    const adjAmount = Number(jeData.amount || 0);
    if (adjAmount <= 0) return { error: "Adjustment amount must be positive" };
    const jeId = `JE-ADJ-${Math.floor(500 + Math.random() * 500)}`;
    const le = _mkLedgerEntry(`LE-ADJ-${Math.random().toString(36).slice(2, 6)}`, new Date().toISOString().slice(0, 10), `Adjustment: ${exc.description}`, adjAmount, jeId);
    if (exc.bankItemId) {
      r.unmatchedBankItems = r.unmatchedBankItems.filter((b) => b.id !== exc.bankItemId);
      r.matchedItems.push(_mkMatch(`MATCH-${Math.random().toString(36).slice(2, 6)}`, exc.bankItemId, le.id, "manual", user));
    }
    exc.resolved = true;
    exc.resolutionNotes = `Created adjustment JE ${jeId} for ${adjAmount.toFixed(3)}`;
    _logActivity(r, user, "created-adjustment-je", `Created ${jeId} for exception ${exceptionId} (${adjAmount.toFixed(3)})`);
    _recomputeCounts(r);
    return _fullReturn();
  }

  if (resolutionType === "accept_timing" || resolutionType === "wait_clearance" || resolutionType === "ignore") {
    exc.resolved = true;
    exc.resolutionNotes =
      resolutionType === "accept_timing" ? "Accepted as timing difference"
        : resolutionType === "wait_clearance" ? "Waiting for bank clearance"
        : "Ignored";
    if (exc.bankItemId && exc.ledgerEntryId) {
      const bi = r.unmatchedBankItems.find((b) => b.id === exc.bankItemId);
      const le = r.unmatchedLedgerItems.find((l) => l.id === exc.ledgerEntryId);
      if (bi && le) {
        r.unmatchedBankItems = r.unmatchedBankItems.filter((b) => b.id !== exc.bankItemId);
        r.unmatchedLedgerItems = r.unmatchedLedgerItems.filter((l) => l.id !== exc.ledgerEntryId);
        r.matchedItems.push(_mkMatch(`MATCH-${Math.random().toString(36).slice(2, 6)}`, exc.bankItemId, exc.ledgerEntryId, "manual", user));
      }
    }
    _logActivity(r, user, "resolved-exception", `Resolved exception ${exceptionId}: ${exc.resolutionNotes}`);
    _recomputeCounts(r);
    return _fullReturn();
  }

  return { error: `Unknown resolution type: ${resolutionType}` };
}

function _parseDateFlexible(input) {
  const s = (input || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(s)) return s.replace(/\//g, "-");
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
  const m2 = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m2) return `${m2[3]}-${m2[2].padStart(2, "0")}-${m2[1].padStart(2, "0")}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

export async function parseBankStatementCSV(csvText, _options = {}) {
  await delay();
  const errors = [];
  const warnings = [];
  const items = [];
  if (!csvText || !csvText.trim()) return { items: [], errors: ["Empty file"], warnings: [], format: null };
  const text = csvText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  // Simple CSV parser handling quoted fields
  const rows = [];
  let currentRow = [];
  let currentField = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { currentField += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else currentField += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { currentRow.push(currentField); currentField = ""; }
      else if (ch === "\n") { currentRow.push(currentField); rows.push(currentRow); currentRow = []; currentField = ""; }
      else currentField += ch;
    }
  }
  if (currentField || currentRow.length > 0) { currentRow.push(currentField); rows.push(currentRow); }
  if (rows.length < 2) return { items: [], errors: ["CSV must have a header row and at least one data row"], warnings: [], format: null };
  const header = rows[0].map((h) => (h || "").trim().toLowerCase());
  const dateIdx = header.findIndex((h) => /^(date|transaction.?date|posting.?date|value.?date)$/.test(h));
  const descIdx = header.findIndex((h) => /^(description|narration|details|memo|particulars)$/.test(h));
  const amountIdx = header.findIndex((h) => /^amount$/.test(h));
  const debitIdx = header.findIndex((h) => /^debit$/.test(h));
  const creditIdx = header.findIndex((h) => /^credit$/.test(h));
  const refIdx = header.findIndex((h) => /^(reference|ref|txn.?id|transaction.?id|document)$/.test(h));
  if (dateIdx < 0) errors.push('Missing required column: "Date"');
  if (descIdx < 0) errors.push('Missing required column: "Description"');
  if (amountIdx < 0 && (debitIdx < 0 || creditIdx < 0)) errors.push('Missing required column: either "Amount" or both "Debit" and "Credit"');
  if (errors.length > 0) return { items: [], errors, warnings: [], format: null };
  const format = amountIdx >= 0 ? "single_amount" : "debit_credit";
  for (let rIdx = 1; rIdx < rows.length; rIdx++) {
    const row = rows[rIdx];
    if (row.length === 0 || row.every((f) => !f || !f.trim())) continue;
    const dateRaw = (row[dateIdx] || "").trim();
    if (!dateRaw) { warnings.push(`Row ${rIdx + 1}: missing date, skipped`); continue; }
    const date = _parseDateFlexible(dateRaw);
    if (!date) { warnings.push(`Row ${rIdx + 1}: unparseable date "${dateRaw}", skipped`); continue; }
    const description = ((row[descIdx] || "") + "").trim();
    const reference = refIdx >= 0 ? ((row[refIdx] || "") + "").trim() : "";
    let amount, type;
    if (format === "single_amount") {
      const raw = ((row[amountIdx] || "") + "").trim().replace(/,/g, "");
      const parsed = parseFloat(raw);
      if (isNaN(parsed)) { warnings.push(`Row ${rIdx + 1}: unparseable amount "${raw}", skipped`); continue; }
      amount = Number(Math.abs(parsed).toFixed(3));
      type = parsed < 0 ? "debit" : "credit";
    } else {
      const debit = parseFloat(((row[debitIdx] || "") + "").trim().replace(/,/g, "") || "0");
      const credit = parseFloat(((row[creditIdx] || "") + "").trim().replace(/,/g, "") || "0");
      if (isNaN(debit) || isNaN(credit)) { warnings.push(`Row ${rIdx + 1}: unparseable debit/credit, skipped`); continue; }
      if (debit > 0) { amount = Number(debit.toFixed(3)); type = "debit"; }
      else if (credit > 0) { amount = Number(credit.toFixed(3)); type = "credit"; }
      else { warnings.push(`Row ${rIdx + 1}: both debit and credit are zero, skipped`); continue; }
    }
    items.push({ id: `CSV-${rIdx}-${Math.random().toString(36).slice(2, 6)}`, date, description, reference, amount, type, source: "uploaded", sourceRow: rIdx + 1 });
  }
  if (items.length === 0 && errors.length === 0) errors.push("No valid rows found in the file");
  return { items, errors, warnings, format };
}

export async function importUploadedStatement(reconciliationId, parsedItems, filename, user = "cfo") {
  await delay();
  const r = _RECONS_DB[reconciliationId];
  if (!r) return null;
  const newBankItems = parsedItems.map((item, idx) => ({
    id: `UP-${Date.now()}-${idx}`,
    date: item.date,
    description: item.description,
    reference: item.reference || `CSV-ROW-${item.sourceRow}`,
    amount: item.amount,
    source: "uploaded",
    sourceFile: filename,
  }));
  r.unmatchedBankItems = [...r.unmatchedBankItems, ...newBankItems];
  r.totalBankItems = (r.totalBankItems || 0) + newBankItems.length;
  const matchResult = _runMatchingEngine(r.unmatchedBankItems, r.unmatchedLedgerItems);
  // Apply Tier 1 auto-matches
  matchResult.tier1Matches.forEach((m) => {
    r.matchedItems.push(_mkMatch(`MATCH-${Math.random().toString(36).slice(2, 8)}`, m.bankItem.id, m.ledgerEntry.id, "exact", "engine"));
    r.unmatchedBankItems = r.unmatchedBankItems.filter((b) => b.id !== m.bankItem.id);
    r.unmatchedLedgerItems = r.unmatchedLedgerItems.filter((l) => l.id !== m.ledgerEntry.id);
  });
  // Add Tier 2 as pending suggestions
  r.pendingSuggestions = r.pendingSuggestions || [];
  matchResult.tier2Suggestions.forEach((s) => {
    const dayDiff = Math.abs((new Date(s.ledgerEntry.date) - new Date(s.bankItem.date)) / (1000 * 60 * 60 * 24));
    const overlap = _tokenOverlap(s.bankItem.description, s.ledgerEntry.description);
    r.pendingSuggestions.push({ id: `SUGG-${Math.random().toString(36).slice(2, 8)}`, bankItemId: s.bankItem.id, ledgerEntryId: s.ledgerEntry.id, confidence: s.confidence, tier: "fuzzy", dayDiff, tokenOverlap: overlap, createdAt: new Date().toISOString() });
  });
  _logActivity(r, user, "imported-statement", `Imported ${newBankItems.length} items from ${filename} — ${matchResult.tier1Matches.length} auto-matched, ${matchResult.tier2Suggestions.length} suggestions`);
  _recomputeCounts(r);
  return _brandObj({ ...r, matchedItems: [...r.matchedItems], unmatchedBankItems: [...r.unmatchedBankItems], unmatchedLedgerItems: [...r.unmatchedLedgerItems], pendingSuggestions: [...r.pendingSuggestions], exceptions: [...r.exceptions], activityLog: [...r.activityLog], importSummary: { newItems: newBankItems.length, autoMatched: matchResult.tier1Matches.length, newSuggestions: matchResult.tier2Suggestions.length } });
}

export async function exportReconciliationCSV(reconciliationId) {
  await delay();
  const r = _RECONS_DB[reconciliationId];
  if (!r) return null;
  const csvRows = [];
  csvRows.push(["Type", "Date", "Description", "Reference", "Amount", "Status", "MatchedWith", "ExceptionType", "Resolution"]);
  r.matchedItems.forEach((m) => { csvRows.push(["matched", "", `Match ${m.bankItemId} / ${m.ledgerEntryId}`, "", "", m.matchTier, `${m.bankItemId} / ${m.ledgerEntryId}`, "", ""]); });
  r.unmatchedBankItems.forEach((b) => { csvRows.push(["bank", b.date, b.description, b.reference || "", String(b.amount.toFixed(3)), "unmatched", "", "", ""]); });
  r.unmatchedLedgerItems.forEach((l) => { csvRows.push(["ledger", l.date, l.description, l.journalEntryId || "", String(l.amount.toFixed(3)), "unmatched", "", "", ""]); });
  r.exceptions.forEach((e) => { csvRows.push(["exception", "", e.description, "", "", e.resolved ? "resolved" : "open", e.bankItemId || e.ledgerEntryId || "", e.type, e.suggestedAction || ""]); });
  const csvText = csvRows.map((row) => row.map((cell) => { const s = String(cell || ""); return (s.includes(",") || s.includes('"') || s.includes("\n")) ? `"${s.replace(/"/g, '""')}"` : s; }).join(",")).join("\n");
  const filename = `reconciliation_${r.accountId}_${r.period.year}-${String(r.period.month).padStart(2, "0")}.csv`;
  return _brandObj({ filename, csvText, rowCount: csvRows.length - 1 });
}

// ─────────────────────────────────────────────────────────────────────────────
// Bank Transactions 20D-3 extensions (real implementations — turn 3)
// ─────────────────────────────────────────────────────────────────────────────

function _filterBankTransactions(txs, filters = {}) {
  let result = [...txs];
  if (filters.direction && filters.direction !== "all") {
    result = result.filter((t) => filters.direction === "inflow" ? t.amount > 0 : t.amount < 0);
  }
  if (filters.categoryCodes && filters.categoryCodes.length > 0) {
    result = result.filter((t) => {
      const code = t.categoryCode || t.engineSuggestion?.accountCode || "";
      return filters.categoryCodes.includes(code);
    });
  }
  if (filters.assigneeIds && filters.assigneeIds.length > 0) {
    result = result.filter((t) => {
      if (filters.assigneeIds.includes("unassigned") && !t.assigneeId) return true;
      return filters.assigneeIds.includes(t.assigneeId);
    });
  }
  if (filters.status) {
    if (filters.status === "pending") result = result.filter((t) => !t.categoryCode && !t.reviewed);
    if (filters.status === "categorized") result = result.filter((t) => t.categoryCode && !t.reviewed);
    if (filters.status === "reviewed") result = result.filter((t) => t.reviewed);
  }
  if (filters.searchQuery) {
    const q = filters.searchQuery.toLowerCase();
    result = result.filter((t) => (t.description || t.merchant || "").toLowerCase().includes(q) || (t.terminal || "").toLowerCase().includes(q));
  }
  return result;
}

export async function bulkCategorizeTransactions(txIds, categoryCode, user = "cfo") {
  await delay();
  let updated = 0, skipped = 0;
  for (const txId of (txIds || [])) {
    const tx = _BANK_TX_DB.find((t) => t.id === txId);
    if (!tx) { skipped++; continue; }
    tx.categoryCode = categoryCode;
    tx.reviewedBy = user;
    tx.reviewedAt = new Date().toISOString();
    updated++;
  }
  return _brandObj({ updated, skipped, categoryCode });
}

export async function bulkAssignTransactions(txIds, assigneeId, user = "cfo") {
  await delay();
  let updated = 0, skipped = 0;
  for (const txId of (txIds || [])) {
    const tx = _BANK_TX_DB.find((t) => t.id === txId);
    if (!tx) { skipped++; continue; }
    tx.assigneeId = assigneeId;
    tx.assignedAt = new Date().toISOString();
    tx.assignedBy = user;
    updated++;
  }
  return _brandObj({ updated, skipped, assigneeId });
}

export async function bulkMarkTransactionsReviewed(txIds, user = "cfo") {
  await delay();
  let updated = 0, skipped = 0;
  for (const txId of (txIds || [])) {
    const tx = _BANK_TX_DB.find((t) => t.id === txId);
    if (!tx) { skipped++; continue; }
    if (tx.reviewed) { skipped++; continue; }
    tx.reviewed = true;
    tx.reviewedBy = user;
    tx.reviewedAt = new Date().toISOString();
    updated++;
  }
  return _brandObj({ updated, skipped });
}

export async function exportBankTransactionsCSV(txIds, filters = {}) {
  await delay();
  let txs;
  if (txIds && txIds.length > 0) { txs = _BANK_TX_DB.filter((t) => txIds.includes(t.id)); }
  else { txs = _filterBankTransactions(_BANK_TX_DB, filters); }
  const header = ["Date", "Merchant", "Amount", "Currency", "Source", "Terminal", "Category", "Assignee", "Reviewed"];
  const rows = [header];
  for (const tx of txs) {
    rows.push([tx.date, tx.merchant || tx.description || "", String((tx.amount || 0).toFixed(3)), tx.currency || "KWD", tx.source || "", tx.terminal || "", tx.categoryCode || tx.engineSuggestion?.accountCode || "", tx.assigneeId || "", tx.reviewed ? "yes" : "no"]);
  }
  const csvText = rows.map((row) => row.map((cell) => { const s = String(cell || ""); return (s.includes(",") || s.includes('"') || s.includes("\n")) ? `"${s.replace(/"/g, '""')}"` : s; }).join(",")).join("\n");
  const filename = `${_currentTenantId}_bank_transactions_${Date.now()}.csv`;
  return _brandObj({ filename, csvText, rowCount: txs.length });
}

export async function createRuleFromTransactions(txIds) {
  await delay();
  if (!txIds || txIds.length === 0) return _brandObj({ proposedRule: null });
  const txs = _BANK_TX_DB.filter((t) => txIds.includes(t.id));
  if (txs.length === 0) return _brandObj({ proposedRule: null });
  const categoryCounts = {};
  for (const tx of txs) { const c = tx.categoryCode || tx.engineSuggestion?.accountCode; if (c) categoryCounts[c] = (categoryCounts[c] || 0) + 1; }
  const topCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const descs = txs.map((t) => (t.merchant || t.description || "").toLowerCase().trim()).filter(Boolean);
  let commonPattern = "";
  if (descs.length > 0) {
    const tokenCounts = {};
    for (const d of descs) { for (const tok of d.split(/\s+/).filter((t) => t.length > 3)) { tokenCounts[tok] = (tokenCounts[tok] || 0) + 1; } }
    const topToken = Object.entries(tokenCounts).sort((a, b) => b[1] - a[1])[0];
    if (topToken && topToken[1] >= Math.ceil(txs.length / 2)) commonPattern = topToken[0];
  }
  const amounts = txs.map((t) => Math.abs(t.amount || 0));
  return _brandObj({ proposedRule: { name: commonPattern ? `Auto: ${commonPattern}` : "Auto: bulk rule", matchType: "description_contains", matchValue: commonPattern || "", categoryCode: topCategory || "", amountRange: { min: Math.min(...amounts), max: Math.max(...amounts) }, priority: 50, confidence: commonPattern ? 80 : 50, sourceTransactionCount: txs.length } });
}

export async function getBankTransactionsSorted(accountId, filters = {}, sort = { field: "date", direction: "desc" }) {
  await delay();
  let txs = _filterBankTransactions(_BANK_TX_DB, filters);
  const field = sort.field || "date";
  const dir = sort.direction === "asc" ? 1 : -1;
  txs.sort((a, b) => {
    switch (field) {
      case "date": return (new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()) * dir;
      case "amount": return (Math.abs(a.amount || 0) - Math.abs(b.amount || 0)) * dir;
      case "merchant": case "description": return (a.merchant || a.description || "").localeCompare(b.merchant || b.description || "") * dir;
      case "category": return (a.categoryCode || a.engineSuggestion?.accountCode || "").localeCompare(b.categoryCode || b.engineSuggestion?.accountCode || "") * dir;
      case "status": { const av = a.reviewed ? 2 : (a.categoryCode ? 1 : 0); const bv = b.reviewed ? 2 : (b.categoryCode ? 1 : 0); return (av - bv) * dir; }
      default: return 0;
    }
  });
  return _brandObj(txs.map((t) => ({ ...t })));
}

let _txAttachmentSeq = 1;
const _txAttachmentStore = {};

export async function attachTransactionFile(txId, file) {
  await delay();
  if (!_txAttachmentStore[txId]) _txAttachmentStore[txId] = [];
  if (_txAttachmentStore[txId].length >= 3) return { error: "Maximum 3 attachments per transaction" };
  const att = { id: `txa-${_txAttachmentSeq++}`, name: file.name, size: file.size, type: file.type || "application/octet-stream", uploadedBy: file.uploadedBy || "cfo", uploadedAt: new Date().toISOString(), dataUrl: file.dataUrl || "" };
  _txAttachmentStore[txId].push(att);
  return _brandObj({ ...att });
}

export async function removeTransactionAttachment(txId, attachmentId) {
  await delay();
  if (!_txAttachmentStore[txId]) return { success: false };
  _txAttachmentStore[txId] = _txAttachmentStore[txId].filter((a) => a.id !== attachmentId);
  return _brandObj({ success: true });
}

export async function getTransactionAttachments(txId) {
  await delay();
  return _brandObj(_txAttachmentStore[txId] ? [..._txAttachmentStore[txId]] : []);
}

// Hoisted from line ~6752 to fix TDZ crash (BUG-005): IIFE below references this const at module init time.
const _MOCK_PDF_URL = "data:application/pdf;base64,JVBERi0xLjMKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0NvdW50IDEvS2lkc1szIDAgUl0+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCA2MTIgNzkyXT4+CmVuZG9iagp4cmVmCjAgNAowMDAwMDAwMDAwIDY1NTM1IGYKMDAwMDAwMDAxMCAwMDAwMCBuCjAwMDAwMDAwNTMgMDAwMDAgbgowMDAwMDAwMDk0IDAwMDAwIG4KdHJhaWxlcgo8PC9TaXplIDQvUm9vdCAxIDAgUj4+CnN0YXJ0eHJlZgoxNDcKJSVFT0YK";

// Seed attachments on a few existing transactions
(function _seedTxAttachments() {
  _txAttachmentStore["bt-1"] = [{ id: "txa-s1", name: "fuel_receipt_knpc.pdf", size: 84000, type: "application/pdf", uploadedBy: "sara", uploadedAt: _daysAgo(1), dataUrl: _MOCK_PDF_URL }];
  _txAttachmentStore["bt-4"] = [{ id: "txa-s2", name: "rent_contract_sharq.pdf", size: 215000, type: "application/pdf", uploadedBy: "cfo", uploadedAt: _daysAgo(2), dataUrl: _MOCK_PDF_URL }, { id: "txa-s3", name: "rent_invoice_apr.pdf", size: 67000, type: "application/pdf", uploadedBy: "cfo", uploadedAt: _daysAgo(2), dataUrl: _MOCK_PDF_URL }];
  _txAttachmentStore["bt-6"] = [{ id: "txa-s4", name: "avenues_booth_agreement.pdf", size: 156000, type: "application/pdf", uploadedBy: "sara", uploadedAt: _daysAgo(1), dataUrl: _MOCK_PDF_URL }];
  _txAttachmentStore["bt-9"] = [{ id: "txa-s5", name: "dubai_vendor_invoice.pdf", size: 98000, type: "application/pdf", uploadedBy: "sara", uploadedAt: _daysAgo(3), dataUrl: _MOCK_PDF_URL }];
  _txAttachmentSeq = 10;
})();

// ─────────────────────────────────────────
// MANUAL JOURNAL ENTRIES — formal double-entry workspace
// ─────────────────────────────────────────

const _MANUAL_JES_DB = {};
const _MANUAL_JE_TEMPLATES_DB = {};

function _mkLine(id, code, name, dr, cr, memo = "") {
  return { id, accountCode: code, accountName: name, debit: Number(dr || 0), credit: Number(cr || 0), memo };
}

function _mkManualJE(overrides = {}) {
  const lines = overrides.lines || [];
  const totalDebits = Number(lines.reduce((s, l) => s + (l.debit || 0), 0).toFixed(3));
  const totalCredits = Number(lines.reduce((s, l) => s + (l.credit || 0), 0).toFixed(3));
  return {
    id: overrides.id,
    type: "manual",
    source: overrides.source || "manual",
    date: overrides.date || new Date().toISOString(),
    reference: overrides.reference || "",
    description: overrides.description || "",
    status: overrides.status || "draft",
    lines,
    totalDebits,
    totalCredits,
    isBalanced: totalDebits === totalCredits && totalDebits > 0,
    createdBy: overrides.createdBy || "cfo",
    createdAt: overrides.createdAt || new Date().toISOString(),
    postedAt: overrides.postedAt || null,
    postedBy: overrides.postedBy || null,
    reversalOf: overrides.reversalOf || null,
    reversedBy: overrides.reversedBy || null,
    templateId: overrides.templateId || null,
    scheduledFor: overrides.scheduledFor || null,
    recurringRule: overrides.recurringRule || null,
    attachmentUrl: overrides.attachmentUrl || null,
    hashChain: overrides.hashChain || null,
  };
}

// Templates
_MANUAL_JE_TEMPLATES_DB["TPL-MONTHLY-RENT"] = {
  id: "TPL-MONTHLY-RENT",
  name: "Monthly Rent Allocation",
  description: "Monthly office rent payment, allocated to Admin",
  source: "manual",
  defaultReference: "Rent — {month} {year}",
  createdAt: _daysAgo(120),
  usageCount: 6,
  lines: [
    { id: "T1L1", accountCode: "6200", accountName: "Office Rent",          debit: 0, credit: 0, memo: "" },
    { id: "T1L2", accountCode: "1120", accountName: "KIB Operating Account", debit: 0, credit: 0, memo: "" },
  ],
};
_MANUAL_JE_TEMPLATES_DB["TPL-PAYROLL"] = {
  id: "TPL-PAYROLL",
  name: "Payroll Run",
  description: "Monthly payroll posting",
  source: "manual",
  defaultReference: "Payroll — {month} {year}",
  createdAt: _daysAgo(120),
  usageCount: 6,
  lines: [
    { id: "T2L1", accountCode: "6100", accountName: "Salaries & Wages",      debit: 0, credit: 0, memo: "" },
    { id: "T2L2", accountCode: "6110", accountName: "PIFSS Contributions",   debit: 0, credit: 0, memo: "" },
    { id: "T2L3", accountCode: "2210", accountName: "Salaries Payable",      debit: 0, credit: 0, memo: "" },
    { id: "T2L4", accountCode: "2200", accountName: "PIFSS Payable",         debit: 0, credit: 0, memo: "" },
    { id: "T2L5", accountCode: "1120", accountName: "KIB Operating Account", debit: 0, credit: 0, memo: "" },
  ],
};
_MANUAL_JE_TEMPLATES_DB["TPL-DEPRECIATION"] = {
  id: "TPL-DEPRECIATION",
  name: "Monthly Depreciation",
  description: "Monthly depreciation of fixed assets",
  source: "manual",
  defaultReference: "Depreciation — {month} {year}",
  createdAt: _daysAgo(120),
  usageCount: 6,
  lines: [
    { id: "T3L1", accountCode: "6420", accountName: "Depreciation Expense",   debit: 0, credit: 0, memo: "" },
    { id: "T3L2", accountCode: "1520", accountName: "Accumulated Depreciation", debit: 0, credit: 0, memo: "" },
  ],
};
_MANUAL_JE_TEMPLATES_DB["TPL-PIFSS-ACCRUAL"] = {
  id: "TPL-PIFSS-ACCRUAL",
  name: "PIFSS Accrual",
  description: "Monthly PIFSS accrual",
  source: "manual",
  defaultReference: "PIFSS Accrual — {month} {year}",
  createdAt: _daysAgo(90),
  usageCount: 3,
  lines: [
    { id: "T4L1", accountCode: "6110", accountName: "PIFSS Contributions", debit: 0, credit: 0, memo: "" },
    { id: "T4L2", accountCode: "2200", accountName: "PIFSS Payable",       debit: 0, credit: 0, memo: "" },
  ],
};

// Posted JEs
(function seedManualJEs() {
  const list = [
    _mkManualJE({
      id: "JE-MAN-0501", source: "manual", status: "posted", reference: "Rent — March 2026",
      description: "Monthly office rent allocation", date: _daysAgo(38), templateId: "TPL-MONTHLY-RENT",
      lines: [
        _mkLine("L1", "6200", "Office Rent",          4200, 0),
        _mkLine("L2", "1120", "KIB Operating Account", 0,   4200),
      ],
      postedAt: _daysAgo(38), postedBy: "cfo", hashChain: "h:a1b2c3",
    }),
    _mkManualJE({
      id: "JE-MAN-0502", source: "manual", status: "posted", reference: "Depreciation — March 2026",
      description: "Monthly depreciation of equipment & furniture", date: _daysAgo(38), templateId: "TPL-DEPRECIATION",
      lines: [
        _mkLine("L1", "6420", "Depreciation Expense",     1800, 0),
        _mkLine("L2", "1520", "Accumulated Depreciation", 0,    1800),
      ],
      postedAt: _daysAgo(38), postedBy: "cfo", hashChain: "h:b2c3d4",
    }),
    _mkManualJE({
      id: "JE-MAN-0503", source: "adjustment", status: "posted", reference: "REF-ADJ-001",
      description: "Insurance prepayment adjustment", date: _daysAgo(34),
      lines: [
        _mkLine("L1", "1400", "Prepaid Expenses", 850, 0),
        _mkLine("L2", "6700", "Insurance",        0,   850),
      ],
      postedAt: _daysAgo(34), postedBy: "cfo", hashChain: "h:c3d4e5",
    }),
    _mkManualJE({
      id: "JE-MAN-0504", source: "manual", status: "posted", reference: "Payroll — March 2026",
      description: "Monthly payroll posting", date: _daysAgo(24), templateId: "TPL-PAYROLL",
      lines: [
        _mkLine("L1", "6100", "Salaries & Wages",      15800, 0),
        _mkLine("L2", "6110", "PIFSS Contributions",    1620, 0),
        _mkLine("L3", "2210", "Salaries Payable",       0, 15800),
        _mkLine("L4", "2200", "PIFSS Payable",          0,  1620),
        _mkLine("L5", "1120", "KIB Operating Account",  0,     0),
      ],
      postedAt: _daysAgo(24), postedBy: "cfo", hashChain: "h:d4e5f6",
    }),
    _mkManualJE({
      id: "JE-MAN-0505", source: "manual", status: "posted", reference: "PIFSS Accrual — March 2026",
      description: "Monthly PIFSS accrual", date: _daysAgo(14), templateId: "TPL-PIFSS-ACCRUAL",
      lines: [
        _mkLine("L1", "6110", "PIFSS Contributions", 1640, 0),
        _mkLine("L2", "2200", "PIFSS Payable",       0,    1640),
      ],
      postedAt: _daysAgo(14), postedBy: "cfo", hashChain: "h:e5f6a7",
    }),
    _mkManualJE({
      id: "JE-MAN-0506", source: "reversal", status: "posted", reference: "REV-JE-MAN-0490",
      description: "Reversal of prior year-end accrual", date: _daysAgo(38), reversalOf: "JE-MAN-0490",
      lines: [
        _mkLine("L1", "2400", "Accrued Expenses",        3200, 0),
        _mkLine("L2", "6500", "Professional Fees",       0,    3200),
      ],
      postedAt: _daysAgo(38), postedBy: "cfo", hashChain: "h:f6a7b8",
    }),
    _mkManualJE({
      id: "JE-MAN-0507", source: "adjustment", status: "posted", reference: "REF-ADJ-002",
      description: "Bank fee miscategorization fix", date: _daysAgo(21),
      lines: [
        _mkLine("L1", "6800", "Bank Charges",           75, 0),
        _mkLine("L2", "6500", "Professional Fees",      0,  75),
      ],
      postedAt: _daysAgo(21), postedBy: "cfo", hashChain: "h:a7b8c9",
    }),
    _mkManualJE({
      id: "JE-MAN-0508", source: "adjustment", status: "posted", reference: "REF-ADJ-003",
      description: "Inventory adjustment for damaged stock", date: _daysAgo(11),
      lines: [
        _mkLine("L1", "5100", "Cost of Goods Sold", 1200, 0),
        _mkLine("L2", "1300", "Inventory",          0,    1200),
      ],
      postedAt: _daysAgo(11), postedBy: "cfo", hashChain: "h:b8c9d0",
    }),
    // Drafts
    _mkManualJE({
      id: "JE-MAN-DRAFT-001", source: "manual", status: "draft", reference: "Marketing Accrual",
      description: "March marketing services accrual (incomplete)", date: _hoursAgo(8),
      lines: [
        _mkLine("L1", "6300", "Marketing & Advertising", 3200, 0),
        _mkLine("L2", "",     "",                         0,    0),
      ],
      createdAt: _hoursAgo(8),
    }),
    _mkManualJE({
      id: "JE-MAN-DRAFT-002", source: "manual", status: "draft", reference: "Q1 Bonus Accrual",
      description: "Quarterly bonus accrual — ready to post", date: _hoursAgo(3),
      lines: [
        _mkLine("L1", "6120", "Bonuses",         8500, 0),
        _mkLine("L2", "2400", "Accrued Expenses", 0,  8500),
      ],
      createdAt: _hoursAgo(3),
    }),
    _mkManualJE({
      id: "JE-MAN-DRAFT-003", source: "adjustment", status: "draft", reference: "Equipment Write-off",
      description: "Equipment write-off (in progress)", date: _hoursAgo(20),
      lines: [
        _mkLine("L1", "1500", "Fixed Assets — Equipment", 0, 2400),
        _mkLine("L2", "",     "",                         0, 0),
      ],
      createdAt: _hoursAgo(20),
    }),
    // Scheduled
    _mkManualJE({
      id: "JE-MAN-SCHED-001", source: "recurring", status: "scheduled", reference: "Rent — April 2026",
      description: "Monthly rent allocation (scheduled)", date: _daysFromNow(7), templateId: "TPL-MONTHLY-RENT",
      scheduledFor: _daysFromNow(7),
      recurringRule: { frequency: "monthly", nextRun: _daysFromNow(7) },
      lines: [
        _mkLine("L1", "6200", "Office Rent",          4200, 0),
        _mkLine("L2", "1120", "KIB Operating Account", 0,   4200),
      ],
    }),
    _mkManualJE({
      id: "JE-MAN-SCHED-002", source: "recurring", status: "scheduled", reference: "Depreciation — April 2026",
      description: "Monthly depreciation (scheduled)", date: _daysFromNow(7), templateId: "TPL-DEPRECIATION",
      scheduledFor: _daysFromNow(7),
      recurringRule: { frequency: "monthly", nextRun: _daysFromNow(7) },
      lines: [
        _mkLine("L1", "6420", "Depreciation Expense",     1800, 0),
        _mkLine("L2", "1520", "Accumulated Depreciation", 0,    1800),
      ],
    }),
    _mkManualJE({
      id: "JE-MAN-SCHED-003", source: "recurring", status: "scheduled", reference: "Payroll — April 2026",
      description: "Monthly payroll (scheduled)", date: _daysFromNow(21), templateId: "TPL-PAYROLL",
      scheduledFor: _daysFromNow(21),
      recurringRule: { frequency: "monthly", nextRun: _daysFromNow(21) },
      lines: [
        _mkLine("L1", "6100", "Salaries & Wages",      15800, 0),
        _mkLine("L2", "6110", "PIFSS Contributions",    1620, 0),
        _mkLine("L3", "2210", "Salaries Payable",       0, 15800),
        _mkLine("L4", "2200", "PIFSS Payable",          0,  1620),
      ],
    }),
  ];
  list.forEach((j) => { _MANUAL_JES_DB[j.id] = j; });
})();

function _recomputeJE(j) {
  j.totalDebits = Number(j.lines.reduce((s, l) => s + (l.debit || 0), 0).toFixed(3));
  j.totalCredits = Number(j.lines.reduce((s, l) => s + (l.credit || 0), 0).toFixed(3));
  j.isBalanced = j.totalDebits === j.totalCredits && j.totalDebits > 0;
}

function _validateJELines(lines) {
  const errors = [];
  if (lines.length < 2) errors.push("Entry must have at least 2 lines");
  lines.forEach((l, i) => {
    if (!l.accountCode) errors.push(`Line ${i + 1}: account not selected`);
    if (l.debit > 0 && l.credit > 0) errors.push(`Line ${i + 1}: cannot have both debit and credit`);
    if (l.debit === 0 && l.credit === 0 && l.accountCode) errors.push(`Line ${i + 1}: amount required`);
  });
  const td = lines.reduce((s, l) => s + (l.debit || 0), 0);
  const tc = lines.reduce((s, l) => s + (l.credit || 0), 0);
  if (Math.abs(td - tc) > 0.0001) errors.push(`Out of balance by ${(td - tc).toFixed(3)}`);
  return { isBalanced: Math.abs(td - tc) < 0.0001 && td > 0, totalDebits: td, totalCredits: tc, difference: td - tc, errors };
}

export async function getManualJEs(filter = "all") {
  await delay();
  let list = Object.values(_MANUAL_JES_DB);
  if (filter === "recent-posted") list = list.filter((j) => j.status === "posted").sort((a, b) => new Date(b.postedAt) - new Date(a.postedAt));
  else if (filter === "drafts") list = list.filter((j) => j.status === "draft").sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  else if (filter === "scheduled") list = list.filter((j) => j.status === "scheduled").sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor));
  return _brandObj(list.map((j) => ({ ...j, lines: [...j.lines] })));
}

export async function getManualJEById(id) {
  await delay();
  const j = _MANUAL_JES_DB[id];
  return j ? _brandObj({ ...j, lines: j.lines.map((l) => ({ ...l })) }) : null;
}

export async function getManualJETemplates() {
  await delay();
  return _brandObj(Object.values(_MANUAL_JE_TEMPLATES_DB).map((t) => ({ ...t, lines: t.lines.map((l) => ({ ...l })) })));
}

export async function getManualJETemplateById(id) {
  await delay();
  const t = _MANUAL_JE_TEMPLATES_DB[id];
  return t ? _brandObj({ ...t, lines: t.lines.map((l) => ({ ...l })) }) : null;
}

export async function getRecentManualJEs(limit = 10) {
  const all = await getManualJEs("recent-posted");
  return all.slice(0, limit);
}

export async function getDraftManualJEs() {
  return getManualJEs("drafts");
}

export async function getScheduledManualJEs() {
  return getManualJEs("scheduled");
}

let _manualJESeq = 600;
function _nextManualJEId() {
  _manualJESeq += 1;
  return `JE-MAN-${String(_manualJESeq).padStart(4, "0")}`;
}

export async function createManualJEDraft(initialData = {}) {
  await delay();
  const id = initialData.id || _nextManualJEId();
  const lines = initialData.lines && initialData.lines.length
    ? initialData.lines.map((l, i) => ({ id: `L${i + 1}`, accountCode: l.accountCode || "", accountName: l.accountName || "", debit: l.debit || 0, credit: l.credit || 0, memo: l.memo || "" }))
    : [
        { id: "L1", accountCode: "", accountName: "", debit: 0, credit: 0, memo: "" },
        { id: "L2", accountCode: "", accountName: "", debit: 0, credit: 0, memo: "" },
      ];
  const j = _mkManualJE({ ...initialData, id, status: "draft", lines, createdAt: new Date().toISOString() });
  _MANUAL_JES_DB[id] = j;
  return _brandObj({ ...j, lines: j.lines.map((l) => ({ ...l })) });
}

export async function updateManualJEDraft(jeId, changes) {
  await delay();
  const j = _MANUAL_JES_DB[jeId];
  if (!j) return null;
  Object.assign(j, changes);
  if (changes.lines) j.lines = changes.lines;
  _recomputeJE(j);
  return _brandObj({ ...j, lines: j.lines.map((l) => ({ ...l })) });
}

export async function addLineToManualJE(jeId) {
  await delay();
  const j = _MANUAL_JES_DB[jeId];
  if (!j) return null;
  j.lines.push({ id: `L${j.lines.length + 1}-${Math.random().toString(36).slice(2, 5)}`, accountCode: "", accountName: "", debit: 0, credit: 0, memo: "" });
  _recomputeJE(j);
  return _brandObj({ ...j, lines: j.lines.map((l) => ({ ...l })) });
}

export async function updateLineInManualJE(jeId, lineId, changes) {
  await delay();
  const j = _MANUAL_JES_DB[jeId];
  if (!j) return null;
  const line = j.lines.find((l) => l.id === lineId);
  if (!line) return null;
  Object.assign(line, changes);
  if (changes.debit && changes.debit > 0) line.credit = 0;
  if (changes.credit && changes.credit > 0) line.debit = 0;
  _recomputeJE(j);
  return _brandObj({ ...j, lines: j.lines.map((l) => ({ ...l })) });
}

export async function removeLineFromManualJE(jeId, lineId) {
  await delay();
  const j = _MANUAL_JES_DB[jeId];
  if (!j) return null;
  j.lines = j.lines.filter((l) => l.id !== lineId);
  _recomputeJE(j);
  return _brandObj({ ...j, lines: j.lines.map((l) => ({ ...l })) });
}

export async function validateManualJE(jeId) {
  await delay();
  const j = _MANUAL_JES_DB[jeId];
  if (!j) return null;
  return _validateJELines(j.lines);
}

export async function postManualJE(jeId, postedBy = "cfo") {
  await delay();
  const j = _MANUAL_JES_DB[jeId];
  if (!j) return null;
  const v = _validateJELines(j.lines);
  if (!v.isBalanced) return { error: "Cannot post unbalanced entry", validation: v };
  j.status = "posted";
  j.postedAt = new Date().toISOString();
  j.postedBy = postedBy;
  j.hashChain = `h:${Math.random().toString(36).slice(2, 8)}`;
  _recomputeJE(j);
  return _brandObj({ ...j, lines: j.lines.map((l) => ({ ...l })) });
}

export async function saveDraftManualJE(jeId) {
  await delay();
  const j = _MANUAL_JES_DB[jeId];
  if (!j) return null;
  j.status = "draft";
  return _brandObj({ ...j, lines: j.lines.map((l) => ({ ...l })) });
}

export async function discardManualJEDraft(jeId) {
  await delay();
  delete _MANUAL_JES_DB[jeId];
  return { success: true };
}

export async function createFromTemplate(templateId) {
  await delay();
  const t = _MANUAL_JE_TEMPLATES_DB[templateId];
  if (!t) return null;
  const id = _nextManualJEId();
  const lines = t.lines.map((l, i) => ({ id: `L${i + 1}`, accountCode: l.accountCode, accountName: l.accountName, debit: 0, credit: 0, memo: "" }));
  const j = _mkManualJE({
    id, status: "draft", source: t.source, templateId,
    reference: t.defaultReference || t.name,
    description: t.description, lines, createdAt: new Date().toISOString(),
  });
  _MANUAL_JES_DB[id] = j;
  t.usageCount = (t.usageCount || 0) + 1;
  return _brandObj({ ...j, lines: j.lines.map((l) => ({ ...l })) });
}

export async function saveAsTemplate(jeId, templateName, description) {
  await delay();
  const j = _MANUAL_JES_DB[jeId];
  if (!j) return null;
  const id = `TPL-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const t = {
    id, name: templateName, description: description || "",
    source: j.source || "manual",
    defaultReference: j.reference,
    createdAt: new Date().toISOString(),
    usageCount: 0,
    lines: j.lines.map((l, i) => ({ id: `T${i + 1}`, accountCode: l.accountCode, accountName: l.accountName, debit: 0, credit: 0, memo: "" })),
  };
  _MANUAL_JE_TEMPLATES_DB[id] = t;
  return _brandObj({ ...t });
}

export async function reverseManualJE(originalJeId, reason = "") {
  await delay();
  const orig = _MANUAL_JES_DB[originalJeId];
  if (!orig) return null;
  const id = _nextManualJEId();
  const flippedLines = orig.lines.map((l, i) => ({
    id: `L${i + 1}`, accountCode: l.accountCode, accountName: l.accountName,
    debit: l.credit, credit: l.debit, memo: l.memo,
  }));
  const j = _mkManualJE({
    id, status: "draft", source: "reversal",
    reference: `REV-${orig.id}`,
    description: `Reversal of ${orig.id}${reason ? ` — ${reason}` : ""}`,
    reversalOf: originalJeId,
    lines: flippedLines,
    createdAt: new Date().toISOString(),
  });
  _MANUAL_JES_DB[id] = j;
  orig.reversedBy = id;
  return _brandObj({ ...j, lines: j.lines.map((l) => ({ ...l })) });
}

export async function scheduleManualJE(jeId, scheduledFor, recurring = null) {
  await delay();
  const j = _MANUAL_JES_DB[jeId];
  if (!j) return null;
  j.status = "scheduled";
  j.scheduledFor = scheduledFor;
  j.recurringRule = recurring;
  j.source = recurring ? "recurring" : j.source;
  return _brandObj({ ...j, lines: j.lines.map((l) => ({ ...l })) });
}

export async function postScheduledNow(jeId, postedBy = "cfo") {
  await delay();
  const j = _MANUAL_JES_DB[jeId];
  if (!j) return null;
  j.status = "posted";
  j.postedAt = new Date().toISOString();
  j.postedBy = postedBy;
  j.scheduledFor = null;
  j.hashChain = `h:${Math.random().toString(36).slice(2, 8)}`;
  return _brandObj({ ...j, lines: j.lines.map((l) => ({ ...l })) });
}

// ─────────────────────────────────────────
// Step 20B additions — all additive, no existing signatures modified.
// ─────────────────────────────────────────

// Returns the tenant's primary operating bank account (GL code + display
// label) with `_brandObj` tenant-brand substitution applied so the label
// reads correctly on every tenant. Used by reconciliation inline JE composer
// to replace the hardcoded "1010 — KIB Operating" initial value.
export async function getPrimaryOperatingAccount() {
  await delay();
  return _brandObj({
    code: "1120",
    name: "KIB Operating Account",
    label: "1120 — KIB Operating Account",
  });
}

// Updates an existing team member. Additive stub that mutates the in-memory
// people records so the UI can reflect changes immediately after the modal
// saves. Backend will replace this with a real PATCH call.
export async function updateTeamMember(memberId, updates) {
  await delay();
  const person = P[memberId];
  if (!person) return null;
  if (updates.name != null) person.name = updates.name;
  if (updates.email != null) person.email = updates.email;
  if (updates.role != null) person.role = updates.role;
  if (updates.accessLevel != null) person.accessLevel = updates.accessLevel;
  if (updates.status != null) person.status = updates.status;
  return _brandObj({ ...person });
}

// Marks all notifications for the given role as read. Stub — the header
// currently renders a fixed demo notification list, so this just flips a
// module-level map that the header reads to decide whether to show the dot.
const _notificationsUnread = { Owner: true, CFO: true, Junior: true };
export async function getNotificationsUnread(role) {
  await delay();
  return !!_notificationsUnread[role];
}
export async function markAllNotificationsRead(role) {
  await delay();
  _notificationsUnread[role] = false;
  return true;
}

// ─────────────────────────────────────────
// Step 20C-1 additions — Settings + Profile. All additive.
// ─────────────────────────────────────────

const _notificationPreferences = {
  Owner: {
    email_enabled: true,
    in_app_enabled: true,
    categories: {
      task_assignments: true,
      approval_requests: true,
      mentions: true,
      daily_digest: true,
      weekly_summary: true,
      audit_alerts: true,
      reconciliation_alerts: false,
      budget_alerts: true,
    },
  },
  CFO: {
    email_enabled: true,
    in_app_enabled: true,
    categories: {
      task_assignments: true,
      approval_requests: true,
      mentions: true,
      daily_digest: false,
      weekly_summary: true,
      audit_alerts: true,
      reconciliation_alerts: true,
      budget_alerts: true,
    },
  },
  Junior: {
    email_enabled: true,
    in_app_enabled: true,
    categories: {
      task_assignments: true,
      approval_requests: false,
      mentions: true,
      daily_digest: true,
      weekly_summary: false,
      audit_alerts: false,
      reconciliation_alerts: true,
      budget_alerts: false,
    },
  },
};

export async function getNotificationPreferences(role) {
  await delay();
  const r = _notificationPreferences[role] || _notificationPreferences.CFO;
  return JSON.parse(JSON.stringify(r));
}

export async function updateNotificationPreferences(role, prefs) {
  await delay();
  _notificationPreferences[role] = JSON.parse(JSON.stringify(prefs));
  return JSON.parse(JSON.stringify(_notificationPreferences[role]));
}

// Active sessions
let _sessions = [
  { id: "s-current", device: "MacBook Pro", browser: "Chrome 126", location: "Kuwait City, KW", lastActive: new Date().toISOString(), isCurrent: true },
  { id: "s-2",       device: "iPhone 15",  browser: "Safari Mobile", location: "Kuwait City, KW", lastActive: _hoursAgo(3), isCurrent: false },
  { id: "s-3",       device: "iPad Pro",   browser: "Safari 17",     location: "Salmiya, KW",     lastActive: _hoursAgo(22), isCurrent: false },
  { id: "s-4",       device: "Windows 11", browser: "Edge 125",      location: "Jabriya, KW",     lastActive: _daysAgo(2),   isCurrent: false },
  { id: "s-5",       device: "MacBook Air", browser: "Firefox 127",  location: "Dubai, AE",       lastActive: _daysAgo(5),   isCurrent: false },
];

export async function getActiveSessions() {
  await delay();
  return _sessions.map((s) => ({ ...s }));
}
export async function signOutSession(sessionId) {
  await delay();
  _sessions = _sessions.filter((s) => s.id !== sessionId || s.isCurrent);
  return { success: true };
}
export async function signOutAllOtherSessions() {
  await delay();
  const count = _sessions.filter((s) => !s.isCurrent).length;
  _sessions = _sessions.filter((s) => s.isCurrent);
  return { success: true, count };
}

// 2FA
let _twoFactor = { enabled: false, method: null };
export async function getTwoFactorStatus() {
  await delay();
  return { ...(_twoFactor) };
}
export async function enableTwoFactor(method, code) {
  await delay();
  if (!code || code.length !== 6) return { success: false, error: "validation.invalid_code" };
  _twoFactor = { enabled: true, method: method || "totp" };
  return {
    success: true,
    backupCodes: [
      "A1B2-C3D4", "E5F6-G7H8", "J9K0-L1M2", "N3P4-Q5R6",
      "S7T8-U9V0", "W1X2-Y3Z4", "A5B6-C7D8", "E9F0-G1H2",
    ],
  };
}
export async function disableTwoFactor(code) {
  await delay();
  if (!code || code.length !== 6) return { success: false, error: "validation.invalid_code" };
  _twoFactor = { enabled: false, method: null };
  return { success: true };
}
export async function changePassword(oldPassword, newPassword) {
  await delay();
  if (!oldPassword) return { success: false, error: "validation.old_password_required" };
  if (!newPassword || newPassword.length < 8) return { success: false, error: "validation.password_too_short" };
  return { success: true };
}

// Integrations — tenant-aware via _brandObj (bank name substitution)
let _integrations = [
  { id: "int-bank",    name: "KIB Corporate Banking", category: "Banking",    status: "connected",    lastSync: _hoursAgo(1),  config: { syncFrequency: "hourly" } },
  { id: "int-pos",     name: "Talabat POS",           category: "POS",        status: "connected",    lastSync: _hoursAgo(2),  config: { storeId: "TLB-KW-0412" } },
  { id: "int-deliv",   name: "Deliveroo",             category: "Delivery",   status: "disconnected", lastSync: null,          config: {} },
  { id: "int-qb",      name: "QuickBooks Export",     category: "Accounting", status: "disconnected", lastSync: null,          config: {} },
  { id: "int-bayzat",  name: "Bayzat HR & Payroll",   category: "HR",         status: "connected",    lastSync: _hoursAgo(6),  config: { companyId: "BZT-00421" } },
  { id: "int-zid",     name: "Zid E-commerce",        category: "E-commerce", status: "error",        lastSync: _daysAgo(1),   config: { errorMsg: "Token expired" } },
];

export async function getIntegrations() {
  await delay();
  return _brandObj(_integrations.map((i) => ({ ...i, config: { ...i.config } })));
}
export async function configureIntegration(integrationId, config) {
  await delay();
  const i = _integrations.find((x) => x.id === integrationId);
  if (!i) return null;
  i.config = { ...i.config, ...config };
  i.status = "connected";
  i.lastSync = new Date().toISOString();
  return _brandObj({ ...i });
}
export async function addIntegration(integrationId) {
  await delay();
  const i = _integrations.find((x) => x.id === integrationId);
  if (i) {
    i.status = "connected";
    i.lastSync = new Date().toISOString();
    return _brandObj({ ...i });
  }
  return null;
}
export async function removeIntegration(integrationId) {
  await delay();
  const i = _integrations.find((x) => x.id === integrationId);
  if (i) {
    i.status = "disconnected";
    i.lastSync = null;
  }
  return { success: true };
}

// Audit log
export async function getAccountAuditLog(filters = {}) {
  await delay();
  const all = [
    { id: "al-1",  timestamp: _hoursAgo(1),  actor: "Tarek Aljasem",  action: "login",           target: "MacBook Pro · Chrome 126",  ipAddress: "156.0.12.44",  details: "Kuwait City, KW" },
    { id: "al-2",  timestamp: _hoursAgo(2),  actor: "Tarek Aljasem",  action: "settings_change", target: "Notifications",              ipAddress: "156.0.12.44",  details: "Disabled weekly summary" },
    { id: "al-3",  timestamp: _hoursAgo(4),  actor: "You (CFO)",      action: "approval",        target: "JE-0418",                     ipAddress: "156.0.12.40",  details: "Approved journal entry" },
    { id: "al-4",  timestamp: _hoursAgo(6),  actor: "Sara Al-Ahmadi", action: "post_je",         target: "JE-0417",                     ipAddress: "156.0.12.42",  details: "Posted reconciliation adjustment" },
    { id: "al-5",  timestamp: _hoursAgo(22), actor: "Tarek Aljasem",  action: "login",           target: "iPhone 15 · Safari Mobile",   ipAddress: "77.88.1.12",   details: "Kuwait City, KW" },
    { id: "al-6",  timestamp: _daysAgo(1),   actor: "You (CFO)",      action: "rule_create",     target: "Talabat auto-categorization", ipAddress: "156.0.12.40",  details: "Created categorization rule" },
    { id: "al-7",  timestamp: _daysAgo(1),   actor: "Tarek Aljasem",  action: "role_change",     target: "Noor",                        ipAddress: "156.0.12.44",  details: "Promoted to Senior Accountant" },
    { id: "al-8",  timestamp: _daysAgo(2),   actor: "Sara Al-Ahmadi", action: "reconciliation",  target: "REC-2026-03 / KIB Operating", ipAddress: "156.0.12.42",  details: "Completed reconciliation" },
    { id: "al-9",  timestamp: _daysAgo(2),   actor: "Tarek Aljasem",  action: "settings_change", target: "Language",                    ipAddress: "156.0.12.44",  details: "Switched to Arabic" },
    { id: "al-10", timestamp: _daysAgo(3),   actor: "You (CFO)",      action: "budget_approve",  target: "Q2-2026 / Marketing",         ipAddress: "156.0.12.40",  details: "Approved departmental budget" },
    { id: "al-11", timestamp: _daysAgo(3),   actor: "Sara Al-Ahmadi", action: "login",           target: "Windows 11 · Edge 125",       ipAddress: "77.88.1.14",   details: "Jabriya, KW" },
    { id: "al-12", timestamp: _daysAgo(4),   actor: "Tarek Aljasem",  action: "integration",     target: "Bayzat",                      ipAddress: "156.0.12.44",  details: "Reconnected integration" },
    { id: "al-13", timestamp: _daysAgo(5),   actor: "You (CFO)",      action: "post_je",         target: "JE-0410",                     ipAddress: "156.0.12.40",  details: "Posted manual journal entry" },
    { id: "al-14", timestamp: _daysAgo(6),   actor: "Tarek Aljasem",  action: "login",           target: "MacBook Air · Firefox 127",   ipAddress: "92.211.88.3",  details: "Dubai, AE" },
    { id: "al-15", timestamp: _daysAgo(7),   actor: "Sara Al-Ahmadi", action: "approval",        target: "TSK-107",                     ipAddress: "156.0.12.42",  details: "Completed approval task" },
    { id: "al-16", timestamp: _daysAgo(8),   actor: "You (CFO)",      action: "settings_change", target: "Notifications",              ipAddress: "156.0.12.40",  details: "Enabled audit alerts" },
    { id: "al-17", timestamp: _daysAgo(9),   actor: "Tarek Aljasem",  action: "approval",        target: "TSK-098",                     ipAddress: "156.0.12.44",  details: "Approved budget request" },
    { id: "al-18", timestamp: _daysAgo(10),  actor: "Sara Al-Ahmadi", action: "rule_create",     target: "Kuwait Utilities routing",    ipAddress: "156.0.12.42",  details: "Created routing rule" },
    { id: "al-19", timestamp: _daysAgo(12),  actor: "Tarek Aljasem",  action: "settings_change", target: "Security",                    ipAddress: "156.0.12.44",  details: "Updated password" },
    { id: "al-20", timestamp: _daysAgo(14),  actor: "You (CFO)",      action: "login",           target: "MacBook Pro · Chrome 125",    ipAddress: "156.0.12.40",  details: "Kuwait City, KW" },
    { id: "al-21", timestamp: _daysAgo(18),  actor: "Tarek Aljasem",  action: "role_change",     target: "Jasem",                       ipAddress: "156.0.12.44",  details: "Granted Bookkeeping access" },
    { id: "al-22", timestamp: _daysAgo(21),  actor: "Tarek Aljasem",  action: "integration",     target: "QuickBooks",                  ipAddress: "156.0.12.44",  details: "Attempted to connect" },
  ];
  let result = all;
  if (filters.action && filters.action !== "all") {
    result = result.filter((e) => e.action === filters.action);
  }
  return _brandObj(result);
}

// Profile
let _userProfile = {
  id: "cfo",
  name: "You (CFO)",
  email: "cfo@almanara.com",
  role: "CFO",
  tenantId: _currentTenantId,
  avatarColor: "#00C48C",
  bio: "Finance leader overseeing daily operations, approvals, and month-end close.",
  joinedAt: _daysAgo(420),
};

export async function getUserProfile() {
  await delay();
  return _brandObj({ ...(_userProfile) });
}

export async function updateUserProfile(updates) {
  await delay();
  _userProfile = { ..._userProfile, ...updates };
  return _brandObj({ ..._userProfile });
}

export async function getUserStats(role, period = "month") {
  await delay();
  const map = {
    Owner:  {
      primary: { label: "decisions_month", value: 47,  trend: "up",   delta: "+12%" },
      cards: [
        { key: "approvals_processed", value: 124, unit: "tasks" },
        { key: "reports_reviewed",    value: 18,  unit: "reports" },
        { key: "audit_checks",        value: 15,  unit: "checks" },
        { key: "budget_reviews",      value: 9,   unit: "reviews" },
      ],
    },
    CFO:    {
      primary: { label: "jes_approved_month", value: 86, trend: "up", delta: "+8%" },
      cards: [
        { key: "budgets_reviewed",       value: 11,  unit: "budgets" },
        { key: "reconciliations_done",   value: 14,  unit: "reconciliations" },
        { key: "tasks_managed",          value: 62,  unit: "tasks" },
        { key: "rules_created",          value: 7,   unit: "rules" },
      ],
    },
    Junior: {
      primary: { label: "accuracy_week", value: 94, trend: "up", delta: "+3%", unit: "pct" },
      cards: [
        { key: "tasks_completed_month", value: 138, unit: "tasks" },
        { key: "reconciliations_done",  value: 9,   unit: "reconciliations" },
        { key: "jes_posted",            value: 42,  unit: "entries" },
        { key: "transactions_coded",    value: 237, unit: "transactions" },
      ],
    },
  };
  return map[role] || map.CFO;
}

export async function getUserResponsibilities(role) {
  await delay();
  const map = {
    Owner: [
      { id: "r1",  type: "approval",   label: "Budget approvals",          scope: "All departments",      description: "Final sign-off on budgets above 50,000 KWD" },
      { id: "r2",  type: "approval",   label: "Strategic hires",           scope: "All departments",      description: "Personnel additions and role changes" },
      { id: "r3",  type: "oversight",  label: "Month-end close",           scope: "Whole company",        description: "Review and approve each close cycle" },
      { id: "r4",  type: "oversight",  label: "Audit readiness",           scope: "Whole company",        description: "Review all 15 audit checks monthly" },
      { id: "r5",  type: "governance", label: "Board reporting",           scope: "Quarterly",            description: "P&L, Balance Sheet, KPI dashboards" },
      { id: "r6",  type: "oversight",  label: "Vendor relationships",      scope: "Top-tier vendors",     description: "Contract renewals and major changes" },
      { id: "r7",  type: "approval",   label: "Bank account changes",      scope: "All banks",            description: "New account openings and closures" },
      { id: "r8",  type: "governance", label: "Compliance sign-off",       scope: "PIFSS, Tax authority", description: "Quarterly filings review" },
    ],
    CFO: [
      { id: "r1",  type: "oversight",  label: "Accounts Payable",          scope: "6100-6800 series",     description: "Operating expense categorization and approvals" },
      { id: "r2",  type: "oversight",  label: "Accounts Receivable",       scope: "1200 series",          description: "Customer receivables and collections" },
      { id: "r3",  type: "approval",   label: "Manual journal entries",    scope: "> 1,000 KWD",          description: "Approve non-routine entries" },
      { id: "r4",  type: "approval",   label: "Budget revisions",          scope: "All departments",      description: "Mid-cycle reallocations and changes" },
      { id: "r5",  type: "oversight",  label: "Bank reconciliations",      scope: "Operating + Reserve",  description: "Review and sign off each period" },
      { id: "r6",  type: "oversight",  label: "Team supervision",          scope: "Junior accountants",   description: "Direct report management and reviews" },
      { id: "r7",  type: "governance", label: "Close coordination",        scope: "Monthly close",        description: "Drive the 15-task close checklist" },
      { id: "r8",  type: "oversight",  label: "Payroll review",            scope: "All staff",            description: "PIFSS and tax withholding verification" },
      { id: "r9",  type: "governance", label: "Audit check resolution",    scope: "Failing checks",       description: "Investigate and clear audit issues" },
    ],
    Junior: [
      { id: "r1",  type: "execution",  label: "Bank transaction coding",   scope: "All incoming tx",      description: "Categorize and post daily bank activity" },
      { id: "r2",  type: "execution",  label: "Talabat reconciliation",    scope: "Weekly",               description: "Match POS settlements to bank deposits" },
      { id: "r3",  type: "execution",  label: "PIFSS accrual",             scope: "Monthly",              description: "Draft the month-end PIFSS entry" },
      { id: "r4",  type: "execution",  label: "Expense report processing", scope: "All staff",            description: "Code and post employee expense claims" },
      { id: "r5",  type: "execution",  label: "Vendor invoice entry",      scope: "< 5,000 KWD",          description: "Enter and match vendor invoices" },
      { id: "r6",  type: "execution",  label: "Petty cash reconciliation", scope: "Weekly",               description: "Reconcile petty cash against receipts" },
      { id: "r7",  type: "execution",  label: "Utilities categorization",  scope: "MEW, ISP, telco",      description: "Match recurring utility transactions" },
      { id: "r8",  type: "execution",  label: "Bank fees posting",         scope: "All banks",            description: "Post monthly bank charges" },
    ],
  };
  return map[role] || map.Junior;
}

export async function getUserRecentActivity(limit = 10) {
  await delay();
  const all = [
    { id: "ua-1",  timestamp: _hoursAgo(2),  action: "approved_je",        target: "JE-0418",                targetType: "je",           link: "manual-je"        },
    { id: "ua-2",  timestamp: _hoursAgo(5),  action: "posted_budget_rev",  target: "Marketing Q2",           targetType: "budget",       link: "budget"           },
    { id: "ua-3",  timestamp: _hoursAgo(8),  action: "completed_recon",    target: "REC-2026-03",            targetType: "reconciliation", link: "reconciliation" },
    { id: "ua-4",  timestamp: _hoursAgo(22), action: "created_rule",       target: "Talabat auto-categorize", targetType: "rule",         link: "rules"            },
    { id: "ua-5",  timestamp: _daysAgo(1),   action: "replied_task",       target: "TSK-113",                targetType: "task",         link: "taskbox"          },
    { id: "ua-6",  timestamp: _daysAgo(1),   action: "approved_budget",    target: "Operations Q2",          targetType: "budget",       link: "budget"           },
    { id: "ua-7",  timestamp: _daysAgo(2),   action: "posted_je",          target: "JE-0415",                targetType: "je",           link: "manual-je"        },
    { id: "ua-8",  timestamp: _daysAgo(3),   action: "completed_task",     target: "TSK-104",                targetType: "task",         link: "taskbox"          },
    { id: "ua-9",  timestamp: _daysAgo(3),   action: "coded_tx",           target: "BT-4521",                targetType: "bank-tx",      link: "bank-transactions" },
    { id: "ua-10", timestamp: _daysAgo(4),   action: "reviewed_report",    target: "Q1 P&L",                 targetType: "report",       link: "financial-statements" },
    { id: "ua-11", timestamp: _daysAgo(5),   action: "approved_je",        target: "JE-0410",                targetType: "je",           link: "manual-je"        },
    { id: "ua-12", timestamp: _daysAgo(6),   action: "replied_task",       target: "TSK-099",                targetType: "task",         link: "taskbox"          },
  ];
  return _brandObj(all.slice(0, limit));
}

export async function getUserFullActivity() {
  await delay();
  const all = await getUserRecentActivity(50);
  return all;
}

let _userNotes = {
  content:
    "KIB reconciliation pattern: always match against the settlement sweep first, then residuals to the operating account.\n\nPIFSS accrual: use the payroll export from Bayzat, NOT the manual HR sheet.\n\nWatch Talabat POS settlement timing — 2-day lag during weekends.",
  lastSaved: _hoursAgo(3),
};

export async function getUserNotes() {
  await delay();
  return { ..._userNotes };
}

export async function updateUserNotes(content) {
  await delay();
  _userNotes = { content, lastSaved: new Date().toISOString() };
  return { ..._userNotes };
}

// ─────────────────────────────────────────
// Step 20C-2 additions — CFO FinStmts + MEC. All additive.
// ─────────────────────────────────────────

// ── Adjusting entries feed for Financial Statements ─────────────
const _adjustingEntries = [
  { id: "JE-0420", postedBy: "cfo",  postedAt: _hoursAgo(2),  amount: 1250.5,  description: "Reclassify freight charges from COGS to Operating Expenses", statementType: "income",  confidence: "cfo-approved",  lines: [{ account: "6400 Travel & Transport", debit: 1250.5, credit: 0 }, { account: "5100 Cost of Goods Sold", debit: 0, credit: 1250.5 }] },
  { id: "JE-0419", postedBy: "sara", postedAt: _hoursAgo(5),  amount: 9500.0,  description: "PIFSS accrual — March payroll",                               statementType: "income",  confidence: "engine",        lines: [{ account: "6110 PIFSS Contributions", debit: 9500, credit: 0 }, { account: "2200 PIFSS Payable", debit: 0, credit: 9500 }] },
  { id: "JE-0418", postedBy: "cfo",  postedAt: _hoursAgo(22), amount: 3200.0,  description: "Prepaid insurance amortization — March",                       statementType: "income",  confidence: "cfo-approved",  lines: [{ account: "6700 Insurance", debit: 3200, credit: 0 }, { account: "1400 Prepaid Expenses", debit: 0, credit: 3200 }] },
  { id: "JE-0417", postedBy: "cfo",  postedAt: _daysAgo(1),   amount: 4862.5,  description: "Inventory shrinkage adjustment",                                statementType: "balance", confidence: "cfo-approved",  lines: [{ account: "5100 Cost of Goods Sold", debit: 4862.5, credit: 0 }, { account: "1300 Inventory", debit: 0, credit: 4862.5 }] },
  { id: "JE-0416", postedBy: "sara", postedAt: _daysAgo(2),   amount: 720.0,   description: "Depreciation expense — March",                                 statementType: "balance", confidence: "engine",        lines: [{ account: "6500 Professional Fees", debit: 720, credit: 0 }, { account: "1520 Accumulated Depreciation", debit: 0, credit: 720 }] },
  { id: "JE-0415", postedBy: "cfo",  postedAt: _daysAgo(3),   amount: 2100.0,  description: "Accrued audit fees — Q1 review",                                statementType: "balance", confidence: "cfo-approved",  lines: [{ account: "6510 Audit Fees", debit: 2100, credit: 0 }, { account: "2400 Accrued Expenses", debit: 0, credit: 2100 }] },
  { id: "JE-0414", postedBy: "sara", postedAt: _daysAgo(4),   amount: 580.0,   description: "Bank fee correction — KIB Settlement",                         statementType: "cash-flow", confidence: "engine",      lines: [{ account: "6800 Bank Charges", debit: 580, credit: 0 }, { account: "1140 KIB Settlement Account", debit: 0, credit: 580 }] },
  { id: "JE-0413", postedBy: "cfo",  postedAt: _daysAgo(6),   amount: 12500.0, description: "Deferred revenue recognition — subscription",                  statementType: "income",  confidence: "cfo-approved",  lines: [{ account: "2100 Accounts Payable", debit: 12500, credit: 0 }, { account: "4200 Service Revenue", debit: 0, credit: 12500 }] },
  { id: "JE-0412", postedBy: "cfo",  postedAt: _daysAgo(8),   amount: 1800.0,  description: "Utility bill reclassification",                                statementType: "income",  confidence: "cfo-approved",  lines: [{ account: "6210 Utilities", debit: 1800, credit: 0 }, { account: "6220 Internet & Phone", debit: 0, credit: 1800 }] },
  { id: "JE-0411", postedBy: "sara", postedAt: _daysAgo(10),  amount: 450.0,   description: "FX gain on USD receivable",                                     statementType: "income",  confidence: "engine",        lines: [{ account: "1200 Accounts Receivable", debit: 450, credit: 0 }, { account: "7200 FX Gain", debit: 0, credit: 450 }] },
  { id: "JE-0410", postedBy: "cfo",  postedAt: _daysAgo(12),  amount: 6200.0,  description: "Rent accrual — March",                                          statementType: "balance", confidence: "cfo-approved",  lines: [{ account: "6200 Office Rent", debit: 6200, credit: 0 }, { account: "2400 Accrued Expenses", debit: 0, credit: 6200 }] },
];

export async function getAdjustingEntries(period, statementType) {
  await delay();
  let list = _adjustingEntries.filter((j) => j.statementType === statementType);
  if (period === "week") list = list.filter((j) => new Date(j.postedAt) > new Date(Date.now() - 7 * 86400000));
  return _brandObj(list.map((j) => ({ ...j, lines: j.lines.map((l) => ({ ...l })) })));
}

let _nextJEId = 421;
export async function createReclassificationJE(sourceAccount, targetAccount, amount, reason, effectiveDate) {
  await delay();
  const id = `JE-0${_nextJEId++}`;
  const je = {
    id,
    postedBy: "cfo",
    postedAt: new Date().toISOString(),
    amount: Number(amount),
    description: `Reclassification — ${reason}`.slice(0, 160),
    statementType: "income",
    confidence: "cfo-approved",
    lines: [
      { account: targetAccount, debit: Number(amount), credit: 0 },
      { account: sourceAccount, debit: 0, credit: Number(amount) },
    ],
    effectiveDate: effectiveDate || new Date().toISOString(),
  };
  _adjustingEntries.unshift(je);
  return _brandObj({ ...je, lines: je.lines.map((l) => ({ ...l })) });
}

// ── Line notes ──────────────────────────────────────────────────
let _lineNoteSeq = 1;
let _lineNotes = [
  { id: `ln-${_lineNoteSeq++}`, accountCode: "6300",  period: "march-2026", note: "Marketing budget overrun tracking — three large campaigns this month. Watch April.",           author: "cfo",  timestamp: _hoursAgo(14), visibility: "cfo_owner" },
  { id: `ln-${_lineNoteSeq++}`, accountCode: "1300",  period: "march-2026", note: "Inventory count completed on the 28th. Minor shrinkage adjustment posted (JE-0417).",           author: "cfo",  timestamp: _hoursAgo(26), visibility: "cfo_owner" },
  { id: `ln-${_lineNoteSeq++}`, accountCode: "2400",  period: "march-2026", note: "Accrued expenses include audit fees and March rent. Review with auditor next week.",            author: "cfo",  timestamp: _daysAgo(2),   visibility: "cfo_owner" },
  { id: `ln-${_lineNoteSeq++}`, accountCode: "6110",  period: "march-2026", note: "PIFSS accrual higher than February — new hire in Operations.",                                   author: "cfo",  timestamp: _daysAgo(3),   visibility: "cfo_only" },
  { id: `ln-${_lineNoteSeq++}`, accountCode: "4100",  period: "march-2026", note: "Revenue includes one-time distribution partner onboarding — adjust for trend analysis.",        author: "cfo",  timestamp: _daysAgo(5),   visibility: "cfo_owner" },
];

export async function getLineNotes(period) {
  await delay();
  const p = period || "march-2026";
  return _brandObj(_lineNotes.filter((n) => n.period === p).map((n) => ({ ...n })));
}

export async function addLineNote(accountCode, period, note, visibility) {
  await delay();
  const newNote = {
    id: `ln-${_lineNoteSeq++}`,
    accountCode,
    period: period || "march-2026",
    note,
    author: "cfo",
    timestamp: new Date().toISOString(),
    visibility: visibility || "cfo_owner",
  };
  _lineNotes.unshift(newNote);
  return _brandObj({ ...newNote });
}

export async function updateLineNote(noteId, updates) {
  await delay();
  const n = _lineNotes.find((x) => x.id === noteId);
  if (!n) return null;
  if (updates.note != null) n.note = updates.note;
  if (updates.visibility != null) n.visibility = updates.visibility;
  n.timestamp = new Date().toISOString();
  return _brandObj({ ...n });
}

export async function deleteLineNote(noteId) {
  await delay();
  _lineNotes = _lineNotes.filter((n) => n.id !== noteId);
  return { success: true };
}

// Metadata stub for tracked exports. The real file is built client-side so
// this just returns a canonical filename + timestamp.
export async function exportStatement(statementType, period, format) {
  await delay();
  const tn = (TENANTS[_currentTenantId]?.company?.shortName || "tenant").toLowerCase().replace(/\s+/g, "-");
  return { url: null, filename: `${tn}_${statementType}_${period}.${format}` };
}

// ──────────────────────────────────────────────────────────────────
// YEAR-END-FS-TRIO — SOCIE + IAS 8 Restatement Watermark
// + Disclosure Notes (AUDIT-ACC-040 / HASEEB-213 / HASEEB-216)
// ──────────────────────────────────────────────────────────────────
//
// Mock fixtures for the three year-end FS surfaces. Shapes mirror the
// backend types from `src/modules/reports/report.types.ts` +
// `src/modules/disclosure-notes/disclosure-notes.types.ts`.
//
// Per-tenant seeding strategy:
//   • `almanara`         — non-restated, no AAOIFI (classic IFRS tenant)
//   • `almawred`         — restated (IAS 8) on Operating Expenses + RE
//   • `demo-corporate`   — Islamic-finance tenant with AAOIFI notes
//
// Amounts are 3-dp KWD strings at the boundary — Decimal.js-safe.

function _socieMovement({
  category,
  labelEn,
  labelAr,
  accountCodes,
  openingBalance,
  profitLoss = null,
  otherComprehensiveIncome = 0,
  transactionsWithOwners = 0,
  transfersBetweenComponents = 0,
  restatedMarker = null,
}) {
  const closing =
    Number(openingBalance) +
    Number(profitLoss || 0) +
    Number(otherComprehensiveIncome || 0) +
    Number(transactionsWithOwners || 0) +
    Number(transfersBetweenComponents || 0);
  return {
    category,
    labelEn,
    labelAr,
    accountCodes,
    openingBalance: Number(openingBalance),
    profitLoss: profitLoss == null ? null : Number(profitLoss),
    otherComprehensiveIncome: Number(otherComprehensiveIncome),
    transactionsWithOwners: Number(transactionsWithOwners),
    transfersBetweenComponents: Number(transfersBetweenComponents),
    closingBalance: Number(closing.toFixed(3)),
    restatedMarker,
  };
}

function _sumComponents(components, field) {
  return Number(
    components.reduce((s, c) => s + Number(c[field] || 0), 0).toFixed(3),
  );
}

// YEAR-END-FS-TRIO note: the production tenant config (`src/config/tenants.js`)
// exposes only `almanara` and `generic`. We map:
//   • `almanara` → classic IFRS tenant, non-restated, no AAOIFI
//   • `generic`  → Islamic-finance tenant (AAOIFI note block +
//                  restated watermark active) — combines both demo
//                  scenarios on one tenant so a screenshot harness
//                  can exercise every surface with the two real IDs.
// An optional module-level override (`__yearEndFsScenario`) lets the
// screenshot script force a specific variant without adding a third
// tenant to production config.
let __yearEndFsScenario = null;
export function __setYearEndFsScenario(variant) {
  // Dev/test hook only — never called from production UI.
  __yearEndFsScenario = variant;
}
// Expose on window so the Playwright screenshot script can force a
// specific fixture variant without adding a third tenant to production
// config. Guarded so the dev-tool never leaks into SSR / Node.
if (typeof window !== "undefined") {
  try {
    window.__setYearEndFsScenario = __setYearEndFsScenario;
  } catch {
    /* no-op */
  }
}
function _resolveSocieVariant(tenantId) {
  if (__yearEndFsScenario) return __yearEndFsScenario;
  if (tenantId === "almawred") return "almawred";
  if (tenantId === "demo-corporate") return "demo-corporate";
  if (tenantId === "generic") return "demo-corporate"; // AAOIFI + watermark
  return "almanara";
}

function _socieCurrent(tenantId) {
  const variant = _resolveSocieVariant(tenantId);
  // IAS 1 para 106 — component rows in canonical presentation order.
  if (variant === "almawred") {
    // RESTATED scenario — OpEx accrual understated in prior year;
    // restatement flips opening RE. Marker stamped on RE component.
    const components = [
      _socieMovement({
        category: "SHARE_CAPITAL",
        labelEn: "Share Capital",
        labelAr: "رأس المال",
        accountCodes: ["3100"],
        openingBalance: 1500000,
        transactionsWithOwners: 250000,
      }),
      _socieMovement({
        category: "STATUTORY_RESERVE",
        labelEn: "Statutory Reserve",
        labelAr: "الاحتياطي القانوني",
        accountCodes: ["3210"],
        openingBalance: 320000,
        transfersBetweenComponents: 45000,
      }),
      _socieMovement({
        category: "RETAINED_EARNINGS",
        labelEn: "Retained Earnings",
        labelAr: "الأرباح المرحلة",
        accountCodes: ["3300"],
        openingBalance: 880000,
        profitLoss: 450000,
        transfersBetweenComponents: -45000,
        transactionsWithOwners: -120000,
        restatedMarker: "RESTATED_IAS8",
      }),
      _socieMovement({
        category: "OWNER_DRAWINGS",
        labelEn: "Owner Drawings",
        labelAr: "مسحوبات المالك",
        accountCodes: ["3400"],
        openingBalance: 0,
      }),
    ];
    return _socieFinalize("2025-01-01", "2025-12-31", components);
  }
  if (variant === "demo-corporate") {
    // Islamic-finance tenant — clean non-restated with OCI present
    const components = [
      _socieMovement({
        category: "SHARE_CAPITAL",
        labelEn: "Share Capital",
        labelAr: "رأس المال",
        accountCodes: ["3100"],
        openingBalance: 2000000,
      }),
      _socieMovement({
        category: "SHARE_PREMIUM",
        labelEn: "Share Premium",
        labelAr: "علاوة إصدار",
        accountCodes: ["3150"],
        openingBalance: 300000,
      }),
      _socieMovement({
        category: "STATUTORY_RESERVE",
        labelEn: "Statutory Reserve",
        labelAr: "الاحتياطي القانوني",
        accountCodes: ["3210"],
        openingBalance: 500000,
        transfersBetweenComponents: 72500,
      }),
      _socieMovement({
        category: "OTHER_RESERVES",
        labelEn: "Other Reserves",
        labelAr: "احتياطيات أخرى",
        accountCodes: ["3250"],
        openingBalance: 180000,
        otherComprehensiveIncome: 22000,
      }),
      _socieMovement({
        category: "RETAINED_EARNINGS",
        labelEn: "Retained Earnings",
        labelAr: "الأرباح المرحلة",
        accountCodes: ["3300"],
        openingBalance: 1120000,
        profitLoss: 725000,
        transfersBetweenComponents: -72500,
        transactionsWithOwners: -200000,
      }),
    ];
    return _socieFinalize("2025-01-01", "2025-12-31", components);
  }
  // Default (almanara) — classic IFRS tenant, non-restated
  const components = [
    _socieMovement({
      category: "SHARE_CAPITAL",
      labelEn: "Share Capital",
      labelAr: "رأس المال",
      accountCodes: ["3100"],
      openingBalance: 1000000,
    }),
    _socieMovement({
      category: "STATUTORY_RESERVE",
      labelEn: "Statutory Reserve",
      labelAr: "الاحتياطي القانوني",
      accountCodes: ["3210"],
      openingBalance: 250000,
      transfersBetweenComponents: 38000,
    }),
    _socieMovement({
      category: "RETAINED_EARNINGS",
      labelEn: "Retained Earnings",
      labelAr: "الأرباح المرحلة",
      accountCodes: ["3300"],
      openingBalance: 650000,
      profitLoss: 380000,
      transfersBetweenComponents: -38000,
      transactionsWithOwners: -100000,
    }),
  ];
  return _socieFinalize("2025-01-01", "2025-12-31", components);
}

function _sociePrior(tenantId) {
  const variant = _resolveSocieVariant(tenantId);
  // Prior-year comparative — simpler seed for presentation
  if (variant === "almawred") {
    const components = [
      _socieMovement({
        category: "SHARE_CAPITAL",
        labelEn: "Share Capital",
        labelAr: "رأس المال",
        accountCodes: ["3100"],
        openingBalance: 1500000,
      }),
      _socieMovement({
        category: "STATUTORY_RESERVE",
        labelEn: "Statutory Reserve",
        labelAr: "الاحتياطي القانوني",
        accountCodes: ["3210"],
        openingBalance: 280000,
        transfersBetweenComponents: 40000,
      }),
      _socieMovement({
        category: "RETAINED_EARNINGS",
        labelEn: "Retained Earnings",
        labelAr: "الأرباح المرحلة",
        accountCodes: ["3300"],
        openingBalance: 700000,
        profitLoss: 300000,
        transfersBetweenComponents: -40000,
        transactionsWithOwners: -80000,
        restatedMarker: "RESTATED_IAS8",
      }),
      _socieMovement({
        category: "OWNER_DRAWINGS",
        labelEn: "Owner Drawings",
        labelAr: "مسحوبات المالك",
        accountCodes: ["3400"],
        openingBalance: 0,
      }),
    ];
    return _socieFinalize("2024-01-01", "2024-12-31", components);
  }
  if (variant === "demo-corporate") {
    const components = [
      _socieMovement({
        category: "SHARE_CAPITAL",
        labelEn: "Share Capital",
        labelAr: "رأس المال",
        accountCodes: ["3100"],
        openingBalance: 2000000,
      }),
      _socieMovement({
        category: "SHARE_PREMIUM",
        labelEn: "Share Premium",
        labelAr: "علاوة إصدار",
        accountCodes: ["3150"],
        openingBalance: 300000,
      }),
      _socieMovement({
        category: "STATUTORY_RESERVE",
        labelEn: "Statutory Reserve",
        labelAr: "الاحتياطي القانوني",
        accountCodes: ["3210"],
        openingBalance: 430000,
        transfersBetweenComponents: 70000,
      }),
      _socieMovement({
        category: "OTHER_RESERVES",
        labelEn: "Other Reserves",
        labelAr: "احتياطيات أخرى",
        accountCodes: ["3250"],
        openingBalance: 165000,
        otherComprehensiveIncome: 15000,
      }),
      _socieMovement({
        category: "RETAINED_EARNINGS",
        labelEn: "Retained Earnings",
        labelAr: "الأرباح المرحلة",
        accountCodes: ["3300"],
        openingBalance: 890000,
        profitLoss: 620000,
        transfersBetweenComponents: -70000,
        transactionsWithOwners: -180000,
      }),
    ];
    return _socieFinalize("2024-01-01", "2024-12-31", components);
  }
  const components = [
    _socieMovement({
      category: "SHARE_CAPITAL",
      labelEn: "Share Capital",
      labelAr: "رأس المال",
      accountCodes: ["3100"],
      openingBalance: 1000000,
    }),
    _socieMovement({
      category: "STATUTORY_RESERVE",
      labelEn: "Statutory Reserve",
      labelAr: "الاحتياطي القانوني",
      accountCodes: ["3210"],
      openingBalance: 218000,
      transfersBetweenComponents: 32000,
    }),
    _socieMovement({
      category: "RETAINED_EARNINGS",
      labelEn: "Retained Earnings",
      labelAr: "الأرباح المرحلة",
      accountCodes: ["3300"],
      openingBalance: 500000,
      profitLoss: 290000,
      transfersBetweenComponents: -32000,
      transactionsWithOwners: -80000,
    }),
  ];
  return _socieFinalize("2024-01-01", "2024-12-31", components);
}

function _socieFinalize(fromDate, toDate, components) {
  return {
    fromDate,
    toDate,
    components,
    totalOpeningBalance: _sumComponents(components, "openingBalance"),
    totalProfitLoss: _sumComponents(components, "profitLoss"),
    totalOtherComprehensiveIncome: _sumComponents(
      components,
      "otherComprehensiveIncome",
    ),
    totalTransactionsWithOwners: _sumComponents(
      components,
      "transactionsWithOwners",
    ),
    totalTransfersBetweenComponents: _sumComponents(
      components,
      "transfersBetweenComponents",
    ),
    totalClosingBalance: _sumComponents(components, "closingBalance"),
    isBalanced: true,
  };
}

/**
 * Mock SOCIE fetch. Mirrors the backend `statementOfChangesInEquity`
 * envelope shape from `report.types.ts`. The frontend wrapper in
 * `src/api/reports.js` falls back to this when the dedicated backend
 * route is not yet wired — tracked as HASEEB-223 / AUDIT-ACC-040 note.
 */
export async function getStatementOfChangesInEquity(
  fromDate,
  toDate,
  priorFromDate,
  priorToDate,
) {
  await delay();
  const tenantId = _currentTenantId;
  const current = _socieCurrent(tenantId);
  const prior =
    priorFromDate && priorToDate ? _sociePrior(tenantId) : null;
  const watermark = _restatementWatermarkForTenant(tenantId);
  // Derive a top-level restatementNote when watermark active (bilingual
  // concatenated body; matches backend shape).
  const restatementNote = watermark.isRestated
    ? `${watermark.labelEn}\n${watermark.restatementReasons.join("; ")}\n${watermark.labelAr}\n${watermark.restatementReasons.join("; ")}`
    : null;
  return _brandObj({
    fromDate: current.fromDate,
    toDate: current.toDate,
    components: current.components,
    totalOpeningBalance: current.totalOpeningBalance,
    totalProfitLoss: current.totalProfitLoss,
    totalOtherComprehensiveIncome: current.totalOtherComprehensiveIncome,
    totalTransactionsWithOwners: current.totalTransactionsWithOwners,
    totalTransfersBetweenComponents:
      current.totalTransfersBetweenComponents,
    totalClosingBalance: current.totalClosingBalance,
    isBalanced: current.isBalanced,
    priorPeriod: prior,
    restatementNote,
    restatementWatermark: watermark,
  });
}

// ── IAS 8 restatement watermark fixtures ──────────────────────────
function _restatementWatermarkForTenant(tenantId) {
  const variant = _resolveSocieVariant(tenantId);
  // Watermark active on almawred variant (dedicated restated scenario)
  // and on the `generic` tenant (combined AAOIFI + watermark demo).
  if (variant === "almawred" || tenantId === "generic" || __yearEndFsScenario === "almawred") {
    return {
      isRestated: true,
      restatementReasons: [
        "IAS 8 \u2014 Operating expenses accrual understated in prior year (utilities, telecom).",
        "IAS 8 \u2014 Depreciation expense reclassified from SG&A to COGS per revised policy.",
      ],
      restatedComponents: ["3300", "5100", "6200", "5210"],
      restatementEffectiveDate: "2025-03-15",
      labelEn: "Restated (IAS 8)",
      labelAr: "بعد التسوية (المعيار ٨)",
      affectedRestatementIds: ["PPR-2025-001", "PPR-2025-002"],
    };
  }
  return {
    isRestated: false,
    restatementReasons: [],
    restatedComponents: [],
    restatementEffectiveDate: null,
    labelEn: "Restated (IAS 8)",
    labelAr: "بعد التسوية (المعيار ٨)",
    affectedRestatementIds: [],
  };
}

// ── Disclosure Notes (AUDIT-ACC-040) ──────────────────────────────
//
// 19 IFRS + 6 AAOIFI = 25 slots. Islamic-finance tenant (demo-corporate)
// seeds AAOIFI; others seed IFRS-only.

function _ifrsNote({
  noteType,
  standardReference,
  titleEn,
  titleAr,
  narrativeEn,
  narrativeAr,
  methodVersion,
  table = null,
  narrativePending = false,
  autoPopulatedFrom = null,
}) {
  const tables = [];
  if (table) tables.push(table);
  return {
    noteType,
    kind: narrativePending ? "NARRATIVE_PENDING" : "READY",
    standardReference,
    titleEn,
    titleAr,
    methodVersion,
    isAaoifi: false,
    autoPopulatedFrom,
    narratives: [
      {
        key: "disclosure-body",
        titleEn: null,
        titleAr: null,
        paragraphsEn: [narrativeEn],
        paragraphsAr: [narrativeAr],
      },
    ],
    tables,
    warnings: [],
  };
}

function _aaoifiNote({
  noteType,
  standardReference,
  titleEn,
  titleAr,
  narrativeEn,
  narrativeAr,
  methodVersion,
  instrumentLabelEn,
  instrumentLabelAr,
  rows,
}) {
  return {
    noteType,
    kind: "READY",
    standardReference,
    titleEn,
    titleAr,
    methodVersion,
    isAaoifi: true,
    autoPopulatedFrom: "islamic_finance",
    narratives: [
      {
        key: "disclosure-body",
        titleEn: null,
        titleAr: null,
        paragraphsEn: [narrativeEn],
        paragraphsAr: [narrativeAr],
      },
    ],
    tables: [
      {
        key: "aaoifi-position",
        titleEn: `${instrumentLabelEn} \u2014 Position Schedule (${standardReference}) \u2014 FY 2025`,
        titleAr: `${instrumentLabelAr} \u2014 جدول المراكز (${standardReference}) \u2014 السنة المالية 2025`,
        columns: [
          {
            key: "ifrsCrossReference",
            labelEn: "IFRS Cross-Reference",
            labelAr: "المرجع وفق المعايير الدولية",
            isAmount: false,
            align: "start",
          },
          {
            key: "outstandingPrincipal",
            labelEn: "Outstanding Principal (KWD)",
            labelAr: "رأس المال القائم (د.ك)",
            isAmount: true,
            align: "end",
          },
          {
            key: "profitAccrued",
            labelEn: "Profit Accrued to Date (KWD)",
            labelAr: "الربح المستحق للتاريخ (د.ك)",
            isAmount: true,
            align: "end",
          },
          {
            key: "profitPaid",
            labelEn: "Profit Paid to Date (KWD)",
            labelAr: "الربح المدفوع للتاريخ (د.ك)",
            isAmount: true,
            align: "end",
          },
          {
            key: "profitUnearned",
            labelEn: "Profit Unearned (KWD)",
            labelAr: "الربح غير المكتسب (د.ك)",
            isAmount: true,
            align: "end",
          },
          {
            key: "overdueCount",
            labelEn: "Overdue Installments",
            labelAr: "الأقساط المتأخرة",
            isAmount: false,
            align: "end",
          },
        ],
        rows,
        footnoteEn:
          "Amounts are in KWD 3-dp. Per-arrangement row labels preserve the source-term from the underlying contract. The IFRS Cross-Reference column carries the P&L label used in parallel IFRS-basis statements.",
        footnoteAr:
          "المبالغ بالدينار الكويتي بثلاث منازل عشرية. تحتفظ تسمية كل صف بالمصطلح الأصلي من العقد.",
      },
    ],
    warnings: [],
  };
}

function _disclosureNotesFor(tenantId) {
  const base = [
    _ifrsNote({
      noteType: "ACCOUNTING_POLICIES",
      standardReference: "IAS 1 \u00b6117\u2013124",
      titleEn: "Significant Accounting Policies",
      titleAr: "السياسات المحاسبية الهامة",
      narrativeEn:
        "The financial statements have been prepared in accordance with International Financial Reporting Standards (IFRS) as adopted for use in the State of Kuwait. The accounting policies set out below have been applied consistently to all periods presented.",
      narrativeAr:
        "تم إعداد القوائم المالية وفقاً للمعايير الدولية لإعداد التقارير المالية (IFRS) كما هي معتمدة للاستخدام في دولة الكويت. طُبقت السياسات المحاسبية المبينة أدناه بصورة متسقة على جميع الفترات المعروضة.",
      methodVersion: "accounting-policies-v1",
    }),
    _ifrsNote({
      noteType: "CRITICAL_JUDGEMENTS",
      standardReference: "IAS 1 \u00b6122\u2013133",
      titleEn: "Critical Judgements and Estimates",
      titleAr: "الأحكام والتقديرات الجوهرية",
      narrativeEn:
        "The preparation of financial statements requires management to make judgements, estimates and assumptions that affect the reported amounts of assets, liabilities, income and expenses.",
      narrativeAr:
        "يتطلب إعداد القوائم المالية من الإدارة إجراء أحكام وتقديرات وافتراضات تؤثر على المبالغ المُعلَنة للأصول والالتزامات والإيرادات والمصروفات.",
      methodVersion: "critical-judgements-v1",
      narrativePending: true,
    }),
    _ifrsNote({
      noteType: "REVENUE",
      standardReference: "IFRS 15",
      titleEn: "Revenue from Contracts with Customers",
      titleAr: "الإيرادات من العقود مع العملاء",
      narrativeEn:
        "Revenue is recognised when control of goods or services passes to the customer. Contract liabilities reflect consideration received in advance of performance.",
      narrativeAr:
        "يُعترف بالإيرادات عند انتقال السيطرة على السلع أو الخدمات إلى العميل. تعكس التزامات العقود المبالغ المستلمة مقدماً قبل الأداء.",
      methodVersion: "revenue-v1",
      autoPopulatedFrom: "invoices",
      table: {
        key: "revenue-by-category",
        titleEn: "Revenue by Category",
        titleAr: "الإيرادات حسب الفئة",
        columns: [
          { key: "category", labelEn: "Category", labelAr: "الفئة", isAmount: false, align: "start" },
          { key: "current", labelEn: "Current (KWD)", labelAr: "الحالي (د.ك)", isAmount: true, align: "end" },
          { key: "prior", labelEn: "Prior (KWD)", labelAr: "السابق (د.ك)", isAmount: true, align: "end" },
        ],
        rows: [
          { labelEn: "Product sales", labelAr: "مبيعات المنتجات", cells: ["Product", "1250000.000", "980000.000"] },
          { labelEn: "Services", labelAr: "خدمات", cells: ["Services", "380000.000", "320000.000"] },
          { labelEn: "Total", labelAr: "الإجمالي", cells: [null, "1630000.000", "1300000.000"], isTotal: true },
        ],
      },
    }),
    _ifrsNote({
      noteType: "IFRS_9_ECL",
      standardReference: "IFRS 9 \u00b65",
      titleEn: "Expected Credit Losses (IFRS 9)",
      titleAr: "الخسائر الائتمانية المتوقعة (المعيار ٩)",
      narrativeEn:
        "The Company applies the IFRS 9 simplified approach for trade receivables. A provision matrix is maintained based on days-past-due with forward-looking adjustments.",
      narrativeAr:
        "تطبق الشركة النهج المبسط للمعيار ٩ على الذمم المدينة التجارية. يُحتفظ بمصفوفة مخصصات بناءً على أيام التأخر مع تعديلات تطلعية.",
      methodVersion: "ifrs9-ecl-v1",
      narrativePending: true,
    }),
    _ifrsNote({
      noteType: "IFRS_7_FINANCIAL_INSTRUMENTS",
      standardReference: "IFRS 7",
      titleEn: "Financial Instruments Risk Disclosures",
      titleAr: "إفصاحات مخاطر الأدوات المالية",
      narrativeEn:
        "The Company is exposed to credit, liquidity and market risks. Risk management policies are reviewed by the Board annually.",
      narrativeAr:
        "الشركة معرضة لمخاطر الائتمان والسيولة والسوق. تُراجع سياسات إدارة المخاطر من قبل مجلس الإدارة سنوياً.",
      methodVersion: "ifrs7-v1",
      narrativePending: true,
    }),
    _ifrsNote({
      noteType: "IFRS_16_LEASES",
      standardReference: "IFRS 16",
      titleEn: "Leases",
      titleAr: "عقود الإيجار",
      narrativeEn:
        "Right-of-use assets and lease liabilities are measured at the present value of remaining lease payments.",
      narrativeAr:
        "تُقاس أصول حق الاستخدام والتزامات الإيجار بالقيمة الحالية لمدفوعات الإيجار المتبقية.",
      methodVersion: "ifrs16-v1",
      autoPopulatedFrom: "leases",
    }),
    _ifrsNote({
      noteType: "IAS_7_CASH_EQUIVALENTS",
      standardReference: "IAS 7 \u00b67",
      titleEn: "Cash and Cash Equivalents",
      titleAr: "النقد وما في حكمه",
      narrativeEn:
        "Cash equivalents comprise short-term, highly liquid investments maturing within three months of acquisition.",
      narrativeAr:
        "يشمل ما في حكم النقد الاستثمارات قصيرة الأجل شديدة السيولة التي تستحق خلال ثلاثة أشهر من الاقتناء.",
      methodVersion: "ias7-v1",
      autoPopulatedFrom: "bank_accounts",
    }),
    _ifrsNote({
      noteType: "IAS_8_RESTATEMENT",
      standardReference: "IAS 8 \u00b622",
      titleEn: "Prior-Period Restatement",
      titleAr: "إعادة إصدار الفترة السابقة",
      narrativeEn:
        "Comparative figures have been restated for the correction of prior-period errors identified during the year-end close.",
      narrativeAr:
        "أُعيد إصدار الأرقام المقارنة لتصحيح أخطاء فترة سابقة تم تحديدها خلال الإقفال السنوي.",
      methodVersion: "ias8-v1",
      autoPopulatedFrom: "prior_period_restatements",
    }),
    _ifrsNote({
      noteType: "IAS_12_INCOME_TAXES",
      standardReference: "IAS 12",
      titleEn: "Income Taxes",
      titleAr: "ضرائب الدخل",
      narrativeEn:
        "Current tax is calculated at rates enacted or substantively enacted at the reporting date. Deferred tax is recognised on timing differences.",
      narrativeAr:
        "تُحتسب الضريبة الحالية بالمعدلات السارية أو الصادرة فعلياً في تاريخ التقرير. يُعترف بالضريبة المؤجلة على الفروق الزمنية.",
      methodVersion: "ias12-v1",
      autoPopulatedFrom: "tax_lodgements",
    }),
    _ifrsNote({
      noteType: "IAS_16_PROPERTY_PLANT_EQUIPMENT",
      standardReference: "IAS 16",
      titleEn: "Property, Plant and Equipment",
      titleAr: "الممتلكات والآلات والمعدات",
      narrativeEn:
        "PP&E is stated at cost less accumulated depreciation. Depreciation is calculated on a straight-line basis over useful lives.",
      narrativeAr:
        "تُدرج الممتلكات والآلات والمعدات بالتكلفة ناقصاً الإهلاك المتراكم. يُحتسب الإهلاك بطريقة القسط الثابت على مدى الأعمار الإنتاجية.",
      methodVersion: "ias16-v1",
      autoPopulatedFrom: "fixed_assets",
      table: {
        key: "ppe-rollforward",
        titleEn: "PP&E Roll-Forward",
        titleAr: "حركة الممتلكات والآلات والمعدات",
        columns: [
          { key: "class", labelEn: "Asset Class", labelAr: "فئة الأصل", isAmount: false, align: "start" },
          { key: "opening", labelEn: "Opening (KWD)", labelAr: "الافتتاحي (د.ك)", isAmount: true, align: "end" },
          { key: "additions", labelEn: "Additions", labelAr: "الإضافات", isAmount: true, align: "end" },
          { key: "disposals", labelEn: "Disposals", labelAr: "الاستبعادات", isAmount: true, align: "end" },
          { key: "depreciation", labelEn: "Depreciation", labelAr: "الإهلاك", isAmount: true, align: "end" },
          { key: "closing", labelEn: "Closing", labelAr: "الختامي", isAmount: true, align: "end" },
        ],
        rows: [
          { labelEn: "Buildings", labelAr: "مبانٍ", cells: ["Buildings", "1800000.000", "0.000", "0.000", "-72000.000", "1728000.000"] },
          { labelEn: "Machinery", labelAr: "آلات", cells: ["Machinery", "650000.000", "125000.000", "-18000.000", "-81000.000", "676000.000"] },
          { labelEn: "Vehicles", labelAr: "مركبات", cells: ["Vehicles", "220000.000", "55000.000", "-30000.000", "-44000.000", "201000.000"] },
          { labelEn: "Total", labelAr: "الإجمالي", cells: [null, "2670000.000", "180000.000", "-48000.000", "-197000.000", "2605000.000"], isTotal: true },
        ],
      },
    }),
    _ifrsNote({
      noteType: "IAS_19_EMPLOYEE_BENEFITS",
      standardReference: "IAS 19",
      titleEn: "Employee Benefits",
      titleAr: "مزايا الموظفين",
      narrativeEn:
        "The Company recognises end-of-service indemnity (EOSI) and leave provisions per Kuwaiti labour law.",
      narrativeAr:
        "تعترف الشركة بمخصصات مكافأة نهاية الخدمة والإجازات وفقاً لقانون العمل الكويتي.",
      methodVersion: "ias19-v1",
      autoPopulatedFrom: "payroll",
    }),
    _ifrsNote({
      noteType: "IAS_24_RELATED_PARTY",
      standardReference: "IAS 24",
      titleEn: "Related-Party Disclosures",
      titleAr: "إفصاحات الأطراف ذات العلاقة",
      narrativeEn:
        "Related-party transactions are disclosed below. Transactions are conducted on arm's-length terms unless otherwise stated.",
      narrativeAr:
        "تُفصح المعاملات مع الأطراف ذات العلاقة أدناه. تُجرى المعاملات بشروط السوق المعتادة ما لم يُذكر خلاف ذلك.",
      methodVersion: "ias24-v1",
      autoPopulatedFrom: "related_parties",
    }),
    _ifrsNote({
      noteType: "IAS_37_PROVISIONS",
      standardReference: "IAS 37",
      titleEn: "Provisions, Contingent Liabilities and Contingent Assets",
      titleAr: "المخصصات والالتزامات والأصول المحتملة",
      narrativeEn:
        "Provisions are recognised when a present obligation exists as a result of a past event and a reliable estimate can be made.",
      narrativeAr:
        "يُعترف بالمخصصات عند وجود التزام حالي نتيجة حدث سابق ويمكن تقدير المبلغ بصورة موثوقة.",
      methodVersion: "ias37-v1",
      autoPopulatedFrom: "provisions",
    }),
    _ifrsNote({
      noteType: "RETENTION_BALANCES",
      standardReference: "Contract-retention schedule",
      titleEn: "Retention Balances",
      titleAr: "المبالغ المحتجزة",
      narrativeEn:
        "Retention receivables and payables on construction contracts.",
      narrativeAr:
        "ذمم المبالغ المحتجزة المدينة والدائنة على عقود الإنشاءات.",
      methodVersion: "retention-v1",
      narrativePending: true,
    }),
    _ifrsNote({
      noteType: "COMMITMENTS_CONTINGENCIES",
      standardReference: "IAS 37 \u00b684\u201392",
      titleEn: "Commitments and Contingencies",
      titleAr: "الالتزامات والمطلوبات المحتملة",
      narrativeEn:
        "Capital commitments and letters of guarantee outstanding at the reporting date.",
      narrativeAr:
        "الالتزامات الرأسمالية وخطابات الضمان القائمة في تاريخ التقرير.",
      methodVersion: "commitments-v1",
    }),
    _ifrsNote({
      noteType: "STATUTORY_RESERVE",
      standardReference: "Kuwait Companies Law \u00a7244",
      titleEn: "Statutory Reserve",
      titleAr: "الاحتياطي القانوني",
      narrativeEn:
        "10% of net profit is transferred to the statutory reserve until it reaches 50% of paid-up capital.",
      narrativeAr:
        "يُحول 10% من صافي الربح إلى الاحتياطي القانوني حتى يبلغ 50% من رأس المال المدفوع.",
      methodVersion: "statutory-reserve-v1",
      autoPopulatedFrom: "general_ledger",
    }),
    _ifrsNote({
      noteType: "CONCENTRATION_RISK",
      standardReference: "IFRS 7 \u00b634",
      titleEn: "Concentration Risk",
      titleAr: "مخاطر التركز",
      narrativeEn:
        "Top-10 customer concentration and sector exposure summary.",
      narrativeAr:
        "ملخص تركز أكبر ١٠ عملاء والتعرض القطاعي.",
      methodVersion: "concentration-v1",
      autoPopulatedFrom: "customers",
    }),
    _ifrsNote({
      noteType: "SUBSEQUENT_EVENTS",
      standardReference: "IAS 10",
      titleEn: "Events After the Reporting Period",
      titleAr: "الأحداث اللاحقة لفترة التقرير",
      narrativeEn:
        "No adjusting or non-adjusting events have occurred between the reporting date and the date of authorisation of these financial statements.",
      narrativeAr:
        "لم تقع أي أحداث معدلة أو غير معدلة بين تاريخ التقرير وتاريخ اعتماد هذه القوائم المالية.",
      methodVersion: "subsequent-events-v1",
      narrativePending: true,
    }),
    _ifrsNote({
      noteType: "GOING_CONCERN",
      standardReference: "IAS 1 \u00b625\u201326",
      titleEn: "Going Concern",
      titleAr: "الاستمرارية",
      narrativeEn:
        "Management has assessed the Company's ability to continue as a going concern and is satisfied that the Company has the resources to continue operations for the foreseeable future.",
      narrativeAr:
        "قيّمت الإدارة قدرة الشركة على الاستمرار وهي مقتنعة بأن لدى الشركة الموارد اللازمة لمواصلة عملياتها في المستقبل المنظور.",
      methodVersion: "going-concern-v1",
    }),
  ];

  const variant = _resolveSocieVariant(tenantId);
  if (variant !== "demo-corporate") {
    return base;
  }

  // Islamic-finance tenant — add the 6 AAOIFI notes
  const aaoifi = [
    _aaoifiNote({
      noteType: "AAOIFI_FAS_4_MUDARABA",
      standardReference: "AAOIFI FAS 4",
      titleEn: "Mudaraba (AAOIFI FAS 4)",
      titleAr: "المضاربة (معيار الهيئة رقم ٤)",
      narrativeEn:
        "Mudaraba arrangements treat the Company as rab-al-mal (capital provider) or mudarib (manager). Profit is distributed per the agreed ratio; losses are borne by rab-al-mal unless due to mudarib's negligence.",
      narrativeAr:
        "تتعامل ترتيبات المضاربة مع الشركة باعتبارها رب المال أو المضارب. يُوزَّع الربح وفق النسبة المتفق عليها؛ ويتحمل رب المال الخسائر ما لم تكن نتيجة تقصير المضارب.",
      methodVersion: "aaoifi-fas-4-mudaraba-v1",
      instrumentLabelEn: "Mudaraba",
      instrumentLabelAr: "مضاربة",
      rows: [
        { labelEn: "MUD-001 \u2014 Warba Bank", labelAr: "مض-٠٠١ \u2014 بنك وربة", cells: ["Profit on Mudaraba", "800000.000", "48000.000", "36000.000", "12000.000", "0"] },
        { labelEn: "Total", labelAr: "الإجمالي", cells: [null, "800000.000", "48000.000", "36000.000", "12000.000", "0"], isTotal: true },
      ],
    }),
    _aaoifiNote({
      noteType: "AAOIFI_FAS_4_MUSHARAKA",
      standardReference: "AAOIFI FAS 4",
      titleEn: "Musharaka (AAOIFI FAS 4)",
      titleAr: "المشاركة (معيار الهيئة رقم ٤)",
      narrativeEn:
        "Musharaka is a joint-venture equity partnership in which all partners contribute capital and share profits and losses per contractual ratios.",
      narrativeAr:
        "المشاركة شراكة استثمارية يُسهم فيها جميع الشركاء برأس المال ويقتسمون الأرباح والخسائر وفق النسب التعاقدية.",
      methodVersion: "aaoifi-fas-4-musharaka-v1",
      instrumentLabelEn: "Musharaka",
      instrumentLabelAr: "مشاركة",
      rows: [
        { labelEn: "MSH-001 \u2014 Boubyan Bank", labelAr: "مشـ-٠٠١ \u2014 بنك بوبيان", cells: ["Share of Partnership Profit", "500000.000", "32000.000", "20000.000", "12000.000", "1"] },
        { labelEn: "Total", labelAr: "الإجمالي", cells: [null, "500000.000", "32000.000", "20000.000", "12000.000", "1"], isTotal: true },
      ],
    }),
    _aaoifiNote({
      noteType: "AAOIFI_FAS_28_MURABAHA",
      standardReference: "AAOIFI FAS 28",
      titleEn: "Murabaha and Deferred-Payment Sales (AAOIFI FAS 28)",
      titleAr: "المرابحة والبيوع الآجلة (معيار الهيئة رقم ٢٨)",
      narrativeEn:
        "Murabaha is a cost-plus sale where the client is sold a commodity at cost plus a disclosed markup, payable on deferred terms. Profit is recognised time-apportioned over the deferral period.",
      narrativeAr:
        "المرابحة بيع بالتكلفة مع ربح معلوم حيث تُباع للعميل سلعة بسعر التكلفة زائداً هامش ربح معلن ويُدفع على دفعات مؤجلة. يُعترف بالربح بالتناسب الزمني على مدى فترة التأجيل.",
      methodVersion: "aaoifi-fas-28-murabaha-v1",
      instrumentLabelEn: "Murabaha",
      instrumentLabelAr: "مرابحة",
      rows: [
        { labelEn: "MUR-001 \u2014 NBK Kuwait", labelAr: "مرا-٠٠١ \u2014 بنك الكويت الوطني", cells: ["Finance Cost", "1200000.000", "72000.000", "54000.000", "18000.000", "0"] },
        { labelEn: "MUR-002 \u2014 KFH", labelAr: "مرا-٠٠٢ \u2014 بيت التمويل الكويتي", cells: ["Finance Cost", "850000.000", "51000.000", "38000.000", "13000.000", "2"] },
        { labelEn: "Total", labelAr: "الإجمالي", cells: [null, "2050000.000", "123000.000", "92000.000", "31000.000", "2"], isTotal: true },
      ],
    }),
    _aaoifiNote({
      noteType: "AAOIFI_FAS_31_WAKALA",
      standardReference: "AAOIFI FAS 31",
      titleEn: "Wakala Investment Agency (AAOIFI FAS 31)",
      titleAr: "الوكالة الاستثمارية (معيار الهيئة رقم ٣١)",
      narrativeEn:
        "Under Wakala arrangements, the Company acts as wakil (agent) or muwakkil (principal) for investment placements. Profit above the expected rate is retained by the wakil as an incentive fee.",
      narrativeAr:
        "بموجب ترتيبات الوكالة، تعمل الشركة وكيلاً أو موكلاً لتوظيفات استثمارية. يحتفظ الوكيل بأي ربح يزيد عن المعدل المتوقع كأتعاب حافزة.",
      methodVersion: "aaoifi-fas-31-wakala-v1",
      instrumentLabelEn: "Wakala",
      instrumentLabelAr: "وكالة",
      rows: [
        { labelEn: "WKL-001 \u2014 CBK Islamic", labelAr: "وكـ-٠٠١ \u2014 CBK الإسلامي", cells: ["Finance Income", "400000.000", "20000.000", "14000.000", "6000.000", "0"] },
        { labelEn: "Total", labelAr: "الإجمالي", cells: [null, "400000.000", "20000.000", "14000.000", "6000.000", "0"], isTotal: true },
      ],
    }),
    _aaoifiNote({
      noteType: "AAOIFI_FAS_32_IJARA",
      standardReference: "AAOIFI FAS 32",
      titleEn: "Ijara (AAOIFI FAS 32)",
      titleAr: "الإجارة (معيار الهيئة رقم ٣٢)",
      narrativeEn:
        "Ijara arrangements are leases of assets. Ijara Muntahia Bittamleek couples the lease with a promise to transfer ownership at the end of the lease term.",
      narrativeAr:
        "ترتيبات الإجارة هي إجارة للأصول. تجمع الإجارة المنتهية بالتمليك بين الإجارة والوعد بنقل الملكية في نهاية مدة الإجارة.",
      methodVersion: "aaoifi-fas-32-ijara-v1",
      instrumentLabelEn: "Ijara",
      instrumentLabelAr: "إجارة",
      rows: [
        { labelEn: "IJR-001 \u2014 Warba Bank", labelAr: "إجـ-٠٠١ \u2014 بنك وربة", cells: ["Lease Expense", "950000.000", "57000.000", "43000.000", "14000.000", "0"] },
        { labelEn: "Total", labelAr: "الإجمالي", cells: [null, "950000.000", "57000.000", "43000.000", "14000.000", "0"], isTotal: true },
      ],
    }),
    _aaoifiNote({
      noteType: "AAOIFI_FAS_34_SUKUK",
      standardReference: "AAOIFI FAS 34",
      titleEn: "Sukuk (AAOIFI FAS 34)",
      titleAr: "الصكوك (معيار الهيئة رقم ٣٤)",
      narrativeEn:
        "Sukuk are certificates representing proportional ownership in an underlying pool of assets. Periodic distributions derive from the pool's cash flows.",
      narrativeAr:
        "الصكوك شهادات تمثل ملكية جزئية في مجموعة أصول. تنشأ التوزيعات الدورية من التدفقات النقدية للمجموعة.",
      methodVersion: "aaoifi-fas-34-sukuk-v1",
      instrumentLabelEn: "Sukuk",
      instrumentLabelAr: "صكوك",
      rows: [
        { labelEn: "SUK-001 \u2014 KFH Sukuk 2028", labelAr: "صـك-٠٠١ \u2014 صكوك بيت التمويل ٢٠٢٨", cells: ["Finance Cost (Bond Coupon)", "1500000.000", "90000.000", "67500.000", "22500.000", "0"] },
        { labelEn: "Total", labelAr: "الإجمالي", cells: [null, "1500000.000", "90000.000", "67500.000", "22500.000", "0"], isTotal: true },
      ],
    }),
  ];

  // Insert AAOIFI block between CONCENTRATION_RISK and SUBSEQUENT_EVENTS
  // to mirror the backend canonical-note-order.
  const result = [];
  for (const note of base) {
    if (note.noteType === "SUBSEQUENT_EVENTS") {
      for (const a of aaoifi) result.push(a);
    }
    result.push(note);
  }
  return result;
}

/**
 * Mock disclosure-notes fetch. Returns one run-shaped envelope so the
 * frontend renderer doesn't have to branch between mock + live.
 */
export async function getDisclosureNotes(period) {
  await delay();
  const tenantId = _currentTenantId;
  const notes = _disclosureNotesFor(tenantId);
  // Simulate one "run" of the disclosure-notes orchestrator.
  return _brandObj({
    runId: `DN-RUN-MOCK-${tenantId}`,
    fiscalYear: 2025,
    asOfDate: "2025-12-31",
    language: "bilingual",
    period: period || "FY 2025",
    notes: notes.map((n, i) => ({
      ...n,
      id: `DN-NOTE-${tenantId}-${i + 1}`,
      noteOrder: i + 1,
    })),
  });
}

// ── Month-End Close — CFO authority ─────────────────────────────
// Per-tenant close state so every tenant shows a different progress.
const _closeStateByTenant = {
  almanara:      { status: "in_progress",  day: 5,  totalDays: 8, rejectionReason: null, submittedAt: null, approvedAt: null },
  almawred:      { status: "in_progress",  day: 3,  totalDays: 8, rejectionReason: null, submittedAt: null, approvedAt: null },
  "demo-corporate": { status: "in_progress", day: 6, totalDays: 8, rejectionReason: null, submittedAt: null, approvedAt: null },
};

// Per-tenant checklist progression — seeded so each tenant shows a distinct
// proportion of completed items.
const _closeItemsByTenant = {
  almanara:         { complete: 9,  total: 15 }, // ~60%
  almawred:         { complete: 6,  total: 15 }, // ~40%
  "demo-corporate": { complete: 12, total: 15 }, // ~80%
};

export async function getCloseStatusDetail(period) {
  await delay();
  const s = _closeStateByTenant[_currentTenantId] || _closeStateByTenant.almanara;
  const p = _closeItemsByTenant[_currentTenantId] || _closeItemsByTenant.almanara;
  return {
    period: period || "March 2026",
    status: s.status,
    day: s.day,
    totalDays: s.totalDays,
    completedItems: p.complete,
    totalItems: p.total,
    lastUpdated: _hoursAgo(1),
    blockers: s.status === "in_progress" && p.complete < p.total ? [
      { id: "bk-1", label: "Bank reconciliation KIB Settlement pending", severity: "warning" },
      { id: "bk-2", label: "2 unposted manual JEs", severity: "info" },
    ] : [],
    rejectionReason: s.rejectionReason,
    submittedAt: s.submittedAt,
    approvedAt: s.approvedAt,
  };
}

// Mark a close item complete — accepts notes + in-memory attachment names.
const _closeItemDetails = {};
export async function markCloseItemComplete(itemId, notes, attachments) {
  await delay();
  _closeItemDetails[itemId] = {
    completed: true,
    notes: notes || "",
    attachments: Array.isArray(attachments) ? attachments.slice() : [],
    completedAt: new Date().toISOString(),
    completedBy: "cfo",
  };
  // Bump the completed count for the active tenant so progress feels live.
  const p = _closeItemsByTenant[_currentTenantId];
  if (p && p.complete < p.total) p.complete = Math.min(p.total, p.complete + 1);
  return { id: itemId, ..._closeItemDetails[itemId] };
}

export async function getCloseItemDetail(itemId) {
  await delay();
  return _closeItemDetails[itemId] ? { id: itemId, ..._closeItemDetails[itemId] } : null;
}

export async function runPreCloseValidations(period) {
  await delay();
  return [
    { checkId: "pc-1",  name: "All bank accounts reconciled",                status: "fail",    details: "1 account (KIB Settlement) has 3 unmatched items",        actionable: true,  fixAction: "reconciliation" },
    { checkId: "pc-2",  name: "All bank transactions categorized",           status: "pass",    details: "237 / 237 transactions coded",                              actionable: false, fixAction: null },
    { checkId: "pc-3",  name: "All manual JEs posted (no drafts)",           status: "fail",    details: "2 drafts awaiting post — JE-DRAFT-0004, JE-DRAFT-0005",    actionable: true,  fixAction: "manual-je" },
    { checkId: "pc-4",  name: "PIFSS accrual posted",                        status: "pass",    details: "JE-0419 posted 2h ago",                                     actionable: false, fixAction: null },
    { checkId: "pc-5",  name: "Depreciation entries posted",                 status: "pass",    details: "JE-0416 posted 2d ago",                                     actionable: false, fixAction: null },
    { checkId: "pc-6",  name: "All receivables aged and reviewed",           status: "warning", details: "4 invoices > 90 days, totaling 12,400 KWD",                 actionable: true,  fixAction: "aging-reports" },
    { checkId: "pc-7",  name: "No unapproved budget variances > 10%",        status: "pass",    details: "All variances within tolerance",                            actionable: false, fixAction: null },
    { checkId: "pc-8",  name: "Inventory count reconciled",                  status: "pass",    details: "Count completed 3/28, shrinkage adjustment posted",         actionable: false, fixAction: null },
    { checkId: "pc-9",  name: "Prepaid expenses amortized",                  status: "pass",    details: "Insurance amortization posted — JE-0418",                   actionable: false, fixAction: null },
    { checkId: "pc-10", name: "Trial balance in balance",                    status: "pass",    details: "Debits = Credits (verified)",                               actionable: false, fixAction: null },
    { checkId: "pc-11", name: "Audit trail complete for period",             status: "pass",    details: "15 / 15 checks in Audit Bridge passing",                    actionable: false, fixAction: "audit-bridge" },
    { checkId: "pc-12", name: "Period cut-off review complete",              status: "warning", details: "3 transactions near period boundary need review",           actionable: true,  fixAction: "bank-transactions" },
  ];
}

export async function submitCloseForApproval(period) {
  await delay();
  const s = _closeStateByTenant[_currentTenantId];
  if (s) {
    s.status = "pending_approval";
    s.submittedAt = new Date().toISOString();
  }
  // Create a task in Owner's taskbox
  const taskId = `TSK-CLS-${Math.floor(Math.random() * 900 + 100)}`;
  const task = {
    id: taskId,
    senderId: "cfo",
    recipient: P.owner,
    sender: P.cfo,
    type: "request-approval",
    subject: `${period || "March"} close submitted for approval`,
    body: "The month-end close checklist is complete and pre-close validations have been run. Please review and approve to lock the period.",
    direction: "upward",
    priority: "high",
    status: "open",
    unread: true,
    linkedItem: { type: "month-end-close", period: period || "March 2026" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    dueDate: _daysFromNow(2),
    messages: [
      _msgEvent(P.cfo, "Please review and approve the March close.", 0),
    ],
  };
  TASKBOX_DB.unshift(task);
  return { taskId, status: "pending_approval" };
}

export async function approveClose(period) {
  await delay();
  const s = _closeStateByTenant[_currentTenantId];
  if (s) {
    s.status = "approved";
    s.approvedAt = new Date().toISOString();
  }
  return { status: "approved", lockedAt: new Date().toISOString() };
}

export async function rejectClose(period, reason) {
  await delay();
  const s = _closeStateByTenant[_currentTenantId];
  if (s) {
    s.status = "in_progress";
    s.rejectionReason = reason || "";
    s.submittedAt = null;
  }
  return { status: "in_progress", rejectionReason: reason || "" };
}

// ─────────────────────────────────────────
// Step 20C-3 additions — Forecast + Variance + carryovers. All additive.
// ─────────────────────────────────────────

// ── Forecast ────────────────────────────────────────────────────
const _baseAssumptions = {
  conservative: { revenueGrowth: 3,  churnRate: 8,  avgDealSize: 2400, hiringPlan: 2, salaryInflation: 2, marketingRatio: 8,  taxRate: 15 },
  base:         { revenueGrowth: 10, churnRate: 5,  avgDealSize: 2800, hiringPlan: 4, salaryInflation: 3, marketingRatio: 10, taxRate: 15 },
  aggressive:   { revenueGrowth: 20, churnRate: 3,  avgDealSize: 3200, hiringPlan: 8, salaryInflation: 4, marketingRatio: 14, taxRate: 15 },
};

const _tenantForecastSeed = {
  almanara:         { baseRevenue: 185000, baseExpenses: 142000, startingCash: 184235, maturity: "mature" },
  almawred:         { baseRevenue: 92000,  baseExpenses: 88000,  startingCash: 62400,  maturity: "early" },
  "demo-corporate": { baseRevenue: 140000, baseExpenses: 108000, startingCash: 124800, maturity: "mid" },
};

function _monthLabelsFromNow(count) {
  const now = new Date();
  const out = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    out.push(d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }));
  }
  return out;
}

function _confidenceForMonth(i) {
  if (i < 3) return "high";
  if (i < 6) return "medium";
  return "low";
}

function _projectForecast(scenario, assumptions) {
  const seed = _tenantForecastSeed[_currentTenantId] || _tenantForecastSeed.almanara;
  const a = assumptions || _baseAssumptions[scenario] || _baseAssumptions.base;
  const monthlyGrowth = Math.pow(1 + a.revenueGrowth / 100, 1 / 12) - 1;
  const labels = _monthLabelsFromNow(12);
  let runningCash = seed.startingCash;
  const months = labels.map((m, i) => {
    const revMult = Math.pow(1 + monthlyGrowth, i + 1);
    const revenue = Math.round(seed.baseRevenue * revMult);
    const marketingBump = 1 + (a.marketingRatio - 10) / 100;
    const salaryBump = 1 + (i * a.salaryInflation) / 1200;
    const expenses = Math.round(seed.baseExpenses * marketingBump * salaryBump);
    const netIncome = revenue - expenses;
    const afterTax = Math.round(netIncome * (1 - a.taxRate / 100));
    runningCash += afterTax;
    return {
      month: m,
      revenue,
      expenses,
      netIncome: afterTax,
      cashFlow: afterTax,
      endingBalance: runningCash,
      confidence: _confidenceForMonth(i),
      revenueBreakdown: {
        "Product A": Math.round(revenue * 0.45),
        "Product B": Math.round(revenue * 0.25),
        "Services":  Math.round(revenue * 0.22),
        "Other":     Math.round(revenue * 0.08),
      },
      expenseBreakdown: {
        "Payroll":       Math.round(expenses * 0.55),
        "Rent":          Math.round(expenses * 0.08),
        "Marketing":     Math.round(expenses * (a.marketingRatio / 100)),
        "Operations":    Math.round(expenses * 0.12),
        "Tech & Infra":  Math.round(expenses * 0.06),
        "Other":         Math.round(expenses * 0.06),
      },
    };
  });
  const totals = months.reduce(
    (acc, m) => ({
      revenue:   acc.revenue + m.revenue,
      expenses:  acc.expenses + m.expenses,
      netIncome: acc.netIncome + m.netIncome,
      endingCash: m.endingBalance,
    }),
    { revenue: 0, expenses: 0, netIncome: 0, endingCash: 0 }
  );
  return { scenario, months, totals, assumptions: a };
}

export async function getForecast(scenario) {
  await delay();
  const s = scenario || "base";
  return _brandObj(_projectForecast(s, null));
}

export async function recalculateForecast(scenario, customAssumptions) {
  await delay();
  return _brandObj(_projectForecast(scenario || "base", customAssumptions));
}

let _savedScenarios = [
  { id: "sv-1", name: "Q4 stretch plan",      scenario: "aggressive",  assumptions: _baseAssumptions.aggressive,  savedAt: _daysAgo(12), author: "cfo" },
  { id: "sv-2", name: "Pre-funding baseline", scenario: "base",        assumptions: _baseAssumptions.base,        savedAt: _daysAgo(30), author: "cfo" },
  { id: "sv-3", name: "Conservative floor",   scenario: "conservative", assumptions: _baseAssumptions.conservative, savedAt: _daysAgo(5),  author: "cfo" },
];
let _savedSeq = 4;

export async function getSavedForecastScenarios() {
  await delay();
  return _brandObj(_savedScenarios.map((s) => ({ ...s, assumptions: { ...s.assumptions } })));
}

export async function saveForecastScenario(name, scenario, assumptions) {
  await delay();
  const s = {
    id: `sv-${_savedSeq++}`,
    name,
    scenario,
    assumptions: { ...assumptions },
    savedAt: new Date().toISOString(),
    author: "cfo",
  };
  _savedScenarios.unshift(s);
  return _brandObj({ ...s, assumptions: { ...s.assumptions } });
}

export async function deleteSavedForecastScenario(id) {
  await delay();
  _savedScenarios = _savedScenarios.filter((s) => s.id !== id);
  return { success: true };
}

export async function getForecastNarration(scenario) {
  await delay();
  const n = {
    conservative: "Conservative projection assumes [3% YoY revenue growth] and elevated churn. Cash runway remains stable but net income flattens by Q3. Risk: margin compression if marketing scales back.",
    base:         "Base projection tracks historical [10% YoY growth]. Cash position strengthens meaningfully by end of year. Watch for seasonal Q2 dip — marketing spend should ramp ahead of it.",
    aggressive:   "Aggressive scenario banks on [20% YoY growth] with 8 new hires. Cash position expands strongly but expenses run higher — tight execution on hiring cadence is critical.",
  };
  return _brandObj({
    narration: n[scenario] || n.base,
    highlights: [
      "Revenue compounds 10% across the year under base assumptions",
      "Cash position grows by ~42,000 KWD over 12 months",
      "Payroll remains ~55% of total expenses",
    ],
    risks: [
      "Q2 seasonality typically reduces revenue by 8-12%",
      "Marketing ratio above 12% historically yields diminishing returns",
      "PIFSS rates may increase in Q3",
    ],
  });
}

// ── Variance Analysis ───────────────────────────────────────────
const DEPARTMENTS_V = ["Sales", "Operations", "Marketing", "Tech", "Finance", "HR"];
const CATEGORIES_V = ["Revenue", "Payroll", "Rent", "Marketing", "Operations", "Tech & Infra", "Other"];

function _tenantVarianceMultiplier() {
  return ({ almanara: 1.0, almawred: 1.6, "demo-corporate": 1.2 }[_currentTenantId]) || 1.0;
}

function _seedMatrix() {
  const m = _tenantVarianceMultiplier();
  // rows = departments, cols = categories. Positive = favorable, negative = unfavorable.
  const raw = [
    [ 4200,  -1800,  -300,  -620,  -450,  -120,  -300],
    [  800,   -520,  -180, -1100, -1650,  -340,  -210],
    [-2400,  -3100,  -240, -4200,  -560,  -180,  -340],
    [  120,   -780,  -190,  -310, -1120,   720,   -90],
    [  300,   -200,  -140,    80,  -220,   -60,   -40],
    [  -40,   -330,  -110,  -160,  -180,  -40,   -70],
  ];
  return raw.map((row) => row.map((v) => Math.round(v * m)));
}

function _varianceStatus(v, planAbs) {
  const pct = planAbs > 0 ? (v / planAbs) * 100 : 0;
  if (v < -3000 || pct < -15) return { status: "critical", severity: 4 };
  if (v < -1000 || pct < -8)  return { status: "investigate", severity: 3 };
  if (v < -300  || pct < -3)  return { status: "watch", severity: 2 };
  return { status: "on_track", severity: 1 };
}

export async function getVarianceAnalysis(period, comparisonType) {
  await delay();
  const cells = _seedMatrix();
  const topVariances = [];
  let totalVariance = 0;
  for (let r = 0; r < DEPARTMENTS_V.length; r++) {
    for (let c = 0; c < CATEGORIES_V.length; c++) {
      const v = cells[r][c];
      const plan = 8000 + (r * 700) + (c * 450);
      const actual = plan - v;
      totalVariance += v;
      const meta = _varianceStatus(v, plan);
      topVariances.push({
        id: `var-${r}-${c}`,
        category: CATEGORIES_V[c],
        department: DEPARTMENTS_V[r],
        plan,
        actual,
        variance: v,
        variancePct: +((v / plan) * 100).toFixed(1),
        status: meta.status,
        severity: meta.severity,
        favorable: v > 0,
      });
    }
  }
  topVariances.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
  const top5 = topVariances.slice(0, 5);
  const trend = _monthLabelsFromNow(1).length && (() => {
    const labels = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      labels.push(d.toLocaleDateString("en-US", { month: "short" }));
    }
    return labels.map((m, i) => ({
      month: m,
      totalVariance: Math.round((Math.sin(i / 2) * 3200 - i * 180) * _tenantVarianceMultiplier()),
      topContributors: ["Marketing", "Payroll", "Operations"],
    }));
  })();
  return _brandObj({
    topVariances: top5,
    allVariances: topVariances,
    matrix: { departments: DEPARTMENTS_V, categories: CATEGORIES_V, cells },
    trend,
    totalVariance,
  });
}

let _varianceNotes = [
  { id: "vn-1", varianceId: "var-2-3", note: "Marketing ran 4.2k over — three big campaigns stacked in March. Q2 plan revises down.", author: "cfo", visibility: "cfo_owner", timestamp: _daysAgo(2) },
  { id: "vn-2", varianceId: "var-1-4", note: "Ops overrun from one-time equipment repair. Not recurring.", author: "cfo", visibility: "cfo_owner", timestamp: _daysAgo(4) },
  { id: "vn-3", varianceId: "var-3-4", note: "Tech infra under-spend is expected — Q3 hardware refresh pushed to Q4.", author: "cfo", visibility: "cfo_only", timestamp: _daysAgo(6) },
];
let _varianceNoteSeq = 4;
let _flaggedVariances = new Set(["var-2-3"]);

export async function getVarianceDetail(varianceId) {
  await delay();
  const all = (await getVarianceAnalysis()).allVariances;
  const v = all.find((x) => x.id === varianceId);
  if (!v) return null;
  const contributors = [
    { ref: "JE-0420", desc: "Campaign A invoice",   amount: -1820 },
    { ref: "JE-0417", desc: "Trade show booth",     amount: -1420 },
    { ref: "JE-0411", desc: "Agency retainer",      amount: -960 },
  ];
  const monthlyTrend = Array.from({ length: 6 }, (_, i) => ({
    month: new Date(new Date().getFullYear(), new Date().getMonth() - (5 - i), 1).toLocaleDateString("en-US", { month: "short" }),
    variance: Math.round((Math.sin(i / 1.5) - 0.3) * 1800 * _tenantVarianceMultiplier()),
  }));
  const notes = _varianceNotes.filter((n) => n.varianceId === varianceId);
  return _brandObj({
    ...v,
    monthlyTrend,
    contributors,
    notes,
    flagged: _flaggedVariances.has(varianceId),
    aminahCommentary: `Variance driven primarily by ${contributors[0].desc.toLowerCase()}. Pattern not recurring — expect reversion in next period.`,
  });
}

export async function addVarianceNote(varianceId, note, visibility) {
  await delay();
  const n = {
    id: `vn-${_varianceNoteSeq++}`,
    varianceId,
    note,
    author: "cfo",
    visibility: visibility || "cfo_owner",
    timestamp: new Date().toISOString(),
  };
  _varianceNotes.unshift(n);
  return _brandObj({ ...n });
}

export async function flagVariance(varianceId, reason, assignTo) {
  await delay();
  _flaggedVariances.add(varianceId);
  const recipient = assignTo === "sara" ? P.sara : P.cfo;
  const taskId = `TSK-VAR-${Math.floor(Math.random() * 900 + 100)}`;
  const task = {
    id: taskId,
    senderId: "cfo",
    recipient,
    sender: P.cfo,
    type: "request-investigation",
    subject: `Variance investigation — ${varianceId}`,
    body: `CFO flagged this variance for investigation.\n\nReason: ${reason}`,
    direction: assignTo === "sara" ? "downward" : "lateral",
    priority: "high",
    status: "open",
    unread: true,
    linkedItem: { type: "variance", varianceId },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    dueDate: _daysFromNow(3),
    messages: [_msgEvent(P.cfo, reason, 0)],
  };
  TASKBOX_DB.unshift(task);
  return { taskId, success: true };
}

export async function unflagVariance(varianceId) {
  await delay();
  _flaggedVariances.delete(varianceId);
  return { success: true };
}

export async function getVarianceNarration(period) {
  await delay();
  return _brandObj({
    narration: "Total variance is driven by Marketing overspend (~4.2k over plan) and Operations one-time equipment repair. Favorable variances in Sales Revenue partially offset. Aminah recommends reviewing Q2 marketing commitments before any reallocation.",
    topInsights: [
      "Marketing ran [4,200 KWD over budget] in March",
      "Sales revenue is [3,600 KWD ahead of plan]",
      "Operations equipment overage is non-recurring",
    ],
    recommendedActions: [
      "Revise Q2 marketing plan down by ~8%",
      "Confirm Ops repair is a one-time charge",
      "Reallocate Tech underspend to Sales enablement",
    ],
  });
}

export async function exportVarianceReport(period, format) {
  await delay();
  const tn = (TENANTS[_currentTenantId]?.company?.shortName || "tenant").toLowerCase().replace(/\s+/g, "-");
  return { url: null, filename: `${tn}_variance-report_${period || "march-2026"}.${format || "csv"}` };
}

// ── Close sync: mutate close-approval task when Owner acts ──────
function _findCloseApprovalTask(period) {
  return TASKBOX_DB.find(
    (t) =>
      t.linkedItem &&
      t.linkedItem.type === "month-end-close" &&
      (t.linkedItem.period === period || !period) &&
      t.status !== "completed"
  );
}

// Monkey-patch the originally-defined approveClose / rejectClose by
// re-defining them as local wrappers. We can't re-export, so expose new
// helpers that wire both sides. The screens now call these helpers.
export async function approveCloseAndSyncTask(period) {
  await delay();
  const s = _closeStateByTenant[_currentTenantId];
  if (s) {
    s.status = "approved";
    s.approvedAt = new Date().toISOString();
  }
  const task = _findCloseApprovalTask(period);
  if (task) {
    task.status = "completed";
    task.updatedAt = new Date().toISOString();
    task.messages.push(_msgEvent(P.owner, "[System] Close approved — period locked.", 0));
  }
  return { status: "approved", lockedAt: new Date().toISOString(), taskId: task?.id || null };
}

export async function rejectCloseAndSyncTask(period, reason) {
  await delay();
  const s = _closeStateByTenant[_currentTenantId];
  if (s) {
    s.status = "in_progress";
    s.rejectionReason = reason || "";
    s.submittedAt = null;
  }
  const task = _findCloseApprovalTask(period);
  if (task) {
    task.status = "needs-revision";
    task.updatedAt = new Date().toISOString();
    task.messages.push(_msgEvent(P.owner, `[System] Close rejected. Reason: ${reason || ""}`, 0));
  }
  return { status: "in_progress", rejectionReason: reason || "", taskId: task?.id || null };
}

// ─────────────────────────────────────────
// Step 20C-4 additions — Aging Reports + Setup. All additive.
// ─────────────────────────────────────────

// ── Aging Reports ───────────────────────────────────────────────
const AR_CUSTOMERS = [
  { id: "cu-1",  name: "Al Shaya Trading Co." },
  { id: "cu-2",  name: "Boubyan Industries" },
  { id: "cu-3",  name: "Gulf Cement Partners" },
  { id: "cu-4",  name: "Kuwait Airways Catering" },
  { id: "cu-5",  name: "Sultan Center Wholesale" },
  { id: "cu-6",  name: "Al Ahli Holdings" },
  { id: "cu-7",  name: "National Bank Corp." },
  { id: "cu-8",  name: "Dubai Ports Holdings" },
  { id: "cu-9",  name: "Zain Telecom B2B" },
  { id: "cu-10", name: "Al Manshar Rotana" },
  { id: "cu-11", name: "Kuwait Oil Tanker Co." },
  { id: "cu-12", name: "AlGhanim Distribution" },
  { id: "cu-13", name: "Gulf Bank Procurement" },
  { id: "cu-14", name: "Saudi Aramco Supply" },
  { id: "cu-15", name: "Emirates Airline Ops" },
];
const AP_VENDORS = [
  { id: "vn-1",  name: "MEW Kuwait" },
  { id: "vn-2",  name: "Kuwait Telecom KTC" },
  { id: "vn-3",  name: "Talabat POS" },
  { id: "vn-4",  name: "AWS Middle East" },
  { id: "vn-5",  name: "Ooredoo Business" },
  { id: "vn-6",  name: "Salary & Wages Payroll" },
  { id: "vn-7",  name: "KIB Bank Charges" },
  { id: "vn-8",  name: "Kuwait Fire Dept" },
  { id: "vn-9",  name: "Office Cleaning Co." },
  { id: "vn-10", name: "Al Rai Media Advertising" },
  { id: "vn-11", name: "Trade Show Productions" },
  { id: "vn-12", name: "Legal Firm Al-Sabah" },
  { id: "vn-13", name: "Deloitte & Touche" },
  { id: "vn-14", name: "Shamal Office Supplies" },
];

function _tenantAgingMultiplier(type) {
  const m = ({ almanara: 0.8, almawred: 1.6, "demo-corporate": 1.1 })[_currentTenantId] || 1.0;
  return type === "AP" ? m * 0.7 : m;
}

function _bucketForDays(days) {
  if (days <= 0) return "current";
  if (days <= 30) return "b1_30";
  if (days <= 60) return "b31_60";
  if (days <= 90) return "b61_90";
  return "b90_plus";
}

function _seedInvoices(type) {
  const pool = type === "AR" ? AR_CUSTOMERS : AP_VENDORS;
  const mult = _tenantAgingMultiplier(type);
  const count = type === "AR" ? 48 : 34;
  const now = new Date();
  const out = [];
  const spread = [0, 0, -8, -14, -22, -35, -45, -52, -68, -75, -82, -95, -110, -125, 5, 10, -3, -18, -40, -62, -88, -102];
  for (let i = 0; i < count; i++) {
    const party = pool[i % pool.length];
    const dueOffset = spread[i % spread.length];
    const dueDate = new Date(now);
    dueDate.setDate(now.getDate() + dueOffset);
    const invoiceDate = new Date(dueDate);
    invoiceDate.setDate(dueDate.getDate() - 30);
    const daysOverdue = Math.max(0, Math.round((now - dueDate) / 86400000));
    const bucket = _bucketForDays(daysOverdue);
    const baseAmount = (180 + (i * 137) % 14000) * mult;
    const amount = Math.round(baseAmount * 100) / 100;
    let status = "outstanding";
    let outstanding = amount;
    let partialPayments = [];
    if (i % 9 === 0 && daysOverdue > 0) {
      const paid = Math.round(amount * 0.4 * 100) / 100;
      outstanding = Math.round((amount - paid) * 100) / 100;
      status = "partial";
      partialPayments = [{ date: _daysAgo(Math.max(1, Math.floor(daysOverdue / 2))), amount: paid, method: "bank_transfer", reference: `PMT-${1000 + i}` }];
    }
    if (i % 17 === 0 && daysOverdue > 30) {
      status = "disputed";
    }
    if (i % 23 === 0) {
      status = "paid";
      outstanding = 0;
    }
    const commHistory = [];
    if (daysOverdue > 30 && type === "AR") {
      commHistory.push({ type: "email_reminder", template: "friendly", sentAt: _daysAgo(Math.max(1, daysOverdue - 15)), sentBy: "cfo" });
    }
    if (daysOverdue > 60 && type === "AR") {
      commHistory.push({ type: "email_reminder", template: "firm", sentAt: _daysAgo(Math.max(1, daysOverdue - 35)), sentBy: "cfo" });
    }
    if (daysOverdue > 90 && type === "AR" && i % 5 === 0) {
      commHistory.push({ type: "call", notes: "Left voicemail, no response", at: _daysAgo(Math.max(1, daysOverdue - 50)), by: "sara" });
    }
    out.push({
      id: `${type.toLowerCase()}-inv-${i + 1}`,
      type,
      partyId: party.id,
      partyName: party.name,
      invoiceNumber: `${type === "AR" ? "INV" : "BILL"}-2026-${String(1000 + i).padStart(4, "0")}`,
      invoiceDate: invoiceDate.toISOString(),
      dueDate: dueDate.toISOString(),
      daysOverdue,
      amount,
      outstanding,
      status,
      bucket,
      partialPayments,
      communicationHistory: commHistory,
      lineItems: [
        { description: type === "AR" ? "Services rendered" : "Services purchased", qty: 1, unitPrice: amount * 0.9, total: amount * 0.9 },
        { description: type === "AR" ? "Taxes & fees" : "Taxes", qty: 1, unitPrice: amount * 0.1, total: amount * 0.1 },
      ],
    });
  }
  return out;
}

let _agingInvoicesARByTenant = {};
let _agingInvoicesAPByTenant = {};
function _getAgingInvoices(type) {
  const bag = type === "AR" ? _agingInvoicesARByTenant : _agingInvoicesAPByTenant;
  if (!bag[_currentTenantId]) bag[_currentTenantId] = _seedInvoices(type);
  return bag[_currentTenantId];
}

function _totalsFromInvoices(invoices) {
  const t = { current: 0, b1_30: 0, b31_60: 0, b61_90: 0, b90_plus: 0, total: 0 };
  const c = { current: 0, b1_30: 0, b31_60: 0, b61_90: 0, b90_plus: 0, total: 0 };
  for (const inv of invoices) {
    if (inv.status === "paid") continue;
    t[inv.bucket] += inv.outstanding;
    t.total += inv.outstanding;
    c[inv.bucket] += 1;
    c.total += 1;
  }
  const round = (n) => Math.round(n * 100) / 100;
  Object.keys(t).forEach((k) => { t[k] = round(t[k]); });
  return { totals: t, counts: c };
}

export async function getAgingReport(type, asOfDate) {
  await delay();
  const invoices = _getAgingInvoices(type || "AR");
  const { totals, counts } = _totalsFromInvoices(invoices);
  const mult = _tenantAgingMultiplier(type || "AR");
  const trend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() - (5 - i), 1);
    const label = d.toLocaleDateString("en-US", { month: "short" });
    const seed = (1 + i * 0.05) * mult;
    return {
      month: label,
      current: Math.round(28000 * seed),
      b1_30:   Math.round(16000 * seed),
      b31_60:  Math.round(9000 * seed),
      b61_90:  Math.round(5000 * seed),
      b90_plus: Math.round(4000 * seed * (i > 3 ? 0.7 : 1)),
      total:   0,
    };
  }).map((m) => ({ ...m, total: m.current + m.b1_30 + m.b31_60 + m.b61_90 + m.b90_plus }));
  const dso = type === "AR" ? Math.round(42 * mult) : null;
  const dpo = type === "AP" ? Math.round(38 * mult) : null;
  const narrationMap = {
    AR: `Receivables aging is ${mult > 1.2 ? "stretched" : "healthy"} — ${counts.b90_plus} invoices over 90 days totaling ${Math.round(totals.b90_plus).toLocaleString()} KWD. ${counts.b61_90 > 3 ? "Watch the 61-90 bucket trending up." : ""}`,
    AP: `Payables are ${mult > 1.0 ? "slightly aged" : "current"} — DPO at ${dpo} days. Schedule payments for ${counts.b1_30 + counts.b31_60} invoices due or recently past due.`,
  };
  return _brandObj({
    type: type || "AR",
    asOfDate: asOfDate || new Date().toISOString(),
    totals,
    counts,
    invoices: invoices.map((i) => ({ ...i, lineItems: i.lineItems.map((l) => ({ ...l })), partialPayments: i.partialPayments.map((p) => ({ ...p })), communicationHistory: i.communicationHistory.map((c) => ({ ...c })) })),
    dso,
    dpo,
    trend,
    narration: narrationMap[type || "AR"],
  });
}

export async function getInvoiceDetail(invoiceId) {
  await delay();
  const all = [..._getAgingInvoices("AR"), ..._getAgingInvoices("AP")];
  const inv = all.find((x) => x.id === invoiceId);
  if (!inv) return null;
  return _brandObj({ ...inv, lineItems: inv.lineItems.map((l) => ({ ...l })), partialPayments: inv.partialPayments.map((p) => ({ ...p })), communicationHistory: inv.communicationHistory.map((c) => ({ ...c })) });
}

// PHASE-4-BLOCKED-ON-BACKEND: sendAgingReminder
// Reason: no email-service endpoint. The Corporate API has no
//   email-dispatch surface for per-invoice reminder emails today.
// Unblocker: an email-service backend that exposes something like
//   POST /api/invoices/:id/reminders with {template, body, cc}.
// Recon: 2026-04-19 architect — memory-bank/2026-04-19-phase4-breakdown.md §B-Tier 2.
export async function sendAgingReminder(invoiceIds, template, body, cc) {
  await delay();
  const ids = Array.isArray(invoiceIds) ? invoiceIds : [invoiceIds];
  for (const id of ids) {
    const all = [..._getAgingInvoices("AR"), ..._getAgingInvoices("AP")];
    const inv = all.find((x) => x.id === id);
    if (inv) {
      inv.communicationHistory.unshift({
        type: "email_reminder",
        template: template || "friendly",
        body: body || "",
        cc: cc || "",
        sentAt: new Date().toISOString(),
        sentBy: "cfo",
      });
    }
  }
  return { sent: ids.length, success: true };
}

export async function logPayment(invoiceId, amount, date, method, reference, notes) {
  await delay();
  const all = [..._getAgingInvoices("AR"), ..._getAgingInvoices("AP")];
  const inv = all.find((x) => x.id === invoiceId);
  if (!inv) return null;
  const pay = { date: date || new Date().toISOString(), amount: Number(amount), method: method || "bank_transfer", reference: reference || "", notes: notes || "" };
  inv.partialPayments.unshift(pay);
  inv.outstanding = Math.max(0, Math.round((inv.outstanding - Number(amount)) * 100) / 100);
  inv.status = inv.outstanding <= 0 ? "paid" : "partial";
  return _brandObj({ ...inv });
}

// PHASE-4-BLOCKED-ON-BACKEND: scheduleVendorPayment
// Reason: no future-dated payment endpoint. POST /api/bills/:id/payment
//   is pay-now only (posts a JE immediately) with no scheduledDate field.
// Unblocker: either a new scheduled-payment surface (e.g.
//   POST /api/bills/:id/payment-schedule) or a scheduledDate field on
//   the existing pay-now endpoint that defers the JE post.
// Recon: 2026-04-19 architect — memory-bank/2026-04-19-phase4-breakdown.md §B-Tier 2.
export async function scheduleVendorPayment(invoiceId, amount, date, method, fromAccount, notes) {
  await delay();
  const inv = _getAgingInvoices("AP").find((x) => x.id === invoiceId);
  if (!inv) return null;
  inv.scheduledPayment = { amount: Number(amount), date, method, fromAccount, notes, scheduledAt: new Date().toISOString() };
  return _brandObj({ ...inv });
}

// markInvoiceDisputed: REMOVED 2026-04-22 (AUDIT-ACC-005, corporate-api
// 3fdb92c). Superseded by invoicesApi.disputeInvoice which POSTs to the
// new /api/invoices/:id/dispute endpoint. Engine surface re-exported as
// `disputeInvoice` (not `markInvoiceDisputed`); MOCK parity stub lives
// in src/engine/index.js buildMockExtras() so both modes round-trip.

export async function resolveDispute(invoiceId, resolution) {
  await delay();
  const all = [..._getAgingInvoices("AR"), ..._getAgingInvoices("AP")];
  const inv = all.find((x) => x.id === invoiceId);
  if (!inv) return null;
  inv.status = "outstanding";
  inv.disputeResolution = { resolution, at: new Date().toISOString() };
  return _brandObj({ ...inv });
}

// createWriteOffJE: REMOVED 2026-04-22 (AUDIT-ACC-005, corporate-api
// 3fdb92c). Superseded by invoicesApi.writeOffInvoice which POSTs to the
// new /api/invoices/:id/write-off endpoint (DR BAD_DEBT_EXPENSE / CR
// AR_DEFAULT JE via journalEntryService.create). HASEEB-068 closed by
// this backend dispatch. Engine surface re-exported as `writeOffInvoice`
// (not `createWriteOffJE`); MOCK parity stub lives in src/engine/index.js
// buildMockExtras(). GL-flexibility follow-up tracked as HASEEB-194.

export async function logContactAttempt(invoiceId, type, notes) {
  await delay();
  const all = [..._getAgingInvoices("AR"), ..._getAgingInvoices("AP")];
  const inv = all.find((x) => x.id === invoiceId);
  if (!inv) return null;
  inv.communicationHistory.unshift({ type: type || "call", notes: notes || "", at: new Date().toISOString(), by: "cfo" });
  return _brandObj({ ...inv });
}

// ── Setup ────────────────────────────────────────────────────────
const _setupChartOfAccounts = [
  // Assets
  { code: "1000", name: "Cash & Equivalents",          type: "Assets", subtype: "Current Assets", balance: 0,      status: "active", parent: null },
  { code: "1110", name: "Petty Cash",                  type: "Assets", subtype: "Current Assets", balance: 850,    status: "active", parent: "1000" },
  { code: "1120", name: "KIB Operating Account",       type: "Assets", subtype: "Current Assets", balance: 142100, status: "active", parent: "1000" },
  { code: "1130", name: "KIB Reserve Account",         type: "Assets", subtype: "Current Assets", balance: 42135,  status: "active", parent: "1000" },
  { code: "1140", name: "KIB Settlement Account",      type: "Assets", subtype: "Current Assets", balance: 0,      status: "active", parent: "1000" },
  { code: "1200", name: "Accounts Receivable",         type: "Assets", subtype: "Current Assets", balance: 68400,  status: "active", parent: null },
  { code: "1300", name: "Inventory",                   type: "Assets", subtype: "Current Assets", balance: 52100,  status: "active", parent: null },
  { code: "1400", name: "Prepaid Expenses",            type: "Assets", subtype: "Current Assets", balance: 18200,  status: "active", parent: null },
  { code: "1500", name: "Fixed Assets — Equipment",    type: "Assets", subtype: "Fixed Assets",   balance: 98000,  status: "active", parent: null },
  { code: "1510", name: "Fixed Assets — Furniture",    type: "Assets", subtype: "Fixed Assets",   balance: 24300,  status: "active", parent: null },
  { code: "1520", name: "Accumulated Depreciation",    type: "Assets", subtype: "Fixed Assets",   balance: -31200, status: "active", parent: null },
  // Liabilities
  { code: "2100", name: "Accounts Payable",            type: "Liabilities", subtype: "Current Liabilities", balance: 42800, status: "active", parent: null },
  { code: "2200", name: "PIFSS Payable",               type: "Liabilities", subtype: "Current Liabilities", balance: 9500,  status: "active", parent: null },
  { code: "2210", name: "Salaries Payable",            type: "Liabilities", subtype: "Current Liabilities", balance: 28400, status: "active", parent: null },
  { code: "2300", name: "Tax Payable",                 type: "Liabilities", subtype: "Current Liabilities", balance: 4200,  status: "active", parent: null },
  { code: "2400", name: "Accrued Expenses",            type: "Liabilities", subtype: "Current Liabilities", balance: 12600, status: "active", parent: null },
  // Equity
  { code: "3000", name: "Owner Equity",                type: "Equity", subtype: "Equity", balance: 180000, status: "active", parent: null },
  { code: "3100", name: "Retained Earnings",           type: "Equity", subtype: "Equity", balance: 92400,  status: "active", parent: null },
  // Revenue
  { code: "4100", name: "Sales Revenue",               type: "Revenue", subtype: "Operating Revenue", balance: -185000, status: "active", parent: null },
  { code: "4200", name: "Service Revenue",             type: "Revenue", subtype: "Operating Revenue", balance: -48000,  status: "active", parent: null },
  // Expenses
  { code: "5100", name: "Cost of Goods Sold",          type: "Expenses", subtype: "Cost of Goods Sold", balance: 84200, status: "active", parent: null },
  { code: "5200", name: "Direct Labor",                type: "Expenses", subtype: "Cost of Goods Sold", balance: 18400, status: "active", parent: null },
  { code: "6100", name: "Salaries & Wages",            type: "Expenses", subtype: "Operating Expenses", balance: 48000, status: "active", parent: null },
  { code: "6110", name: "PIFSS Contributions",         type: "Expenses", subtype: "Operating Expenses", balance: 9500,  status: "active", parent: null },
  { code: "6120", name: "Bonuses",                     type: "Expenses", subtype: "Operating Expenses", balance: 3200,  status: "active", parent: null },
  { code: "6200", name: "Office Rent",                 type: "Expenses", subtype: "Operating Expenses", balance: 6200,  status: "active", parent: null },
  { code: "6210", name: "Utilities",                   type: "Expenses", subtype: "Operating Expenses", balance: 1800,  status: "active", parent: null },
  { code: "6220", name: "Internet & Phone",            type: "Expenses", subtype: "Operating Expenses", balance: 900,   status: "active", parent: null },
  { code: "6300", name: "Marketing & Advertising",     type: "Expenses", subtype: "Operating Expenses", balance: 12400, status: "active", parent: null },
  { code: "6310", name: "Trade Shows",                 type: "Expenses", subtype: "Operating Expenses", balance: 3100,  status: "active", parent: null },
  { code: "6400", name: "Travel & Transport",          type: "Expenses", subtype: "Operating Expenses", balance: 2400,  status: "active", parent: null },
  { code: "6500", name: "Professional Fees",           type: "Expenses", subtype: "Operating Expenses", balance: 3600,  status: "active", parent: null },
  { code: "6510", name: "Audit Fees",                  type: "Expenses", subtype: "Operating Expenses", balance: 2100,  status: "active", parent: null },
  { code: "6520", name: "Legal Fees",                  type: "Expenses", subtype: "Operating Expenses", balance: 1200,  status: "active", parent: null },
  { code: "6600", name: "Office Supplies",             type: "Expenses", subtype: "Operating Expenses", balance: 820,   status: "active", parent: null },
  { code: "6700", name: "Insurance",                   type: "Expenses", subtype: "Operating Expenses", balance: 3200,  status: "active", parent: null },
  { code: "6800", name: "Bank Charges",                type: "Expenses", subtype: "Operating Expenses", balance: 420,   status: "active", parent: null },
  { code: "7100", name: "Interest Income",             type: "Revenue", subtype: "Other Income", balance: -1200, status: "active", parent: null },
  { code: "7200", name: "FX Gain",                     type: "Revenue", subtype: "Other Income", balance: -450,  status: "active", parent: null },
  { code: "8100", name: "Interest Expense",            type: "Expenses", subtype: "Other Expense", balance: 340,  status: "active", parent: null },
  { code: "8200", name: "FX Loss",                     type: "Expenses", subtype: "Other Expense", balance: 210,  status: "active", parent: null },
  { code: "8300", name: "Bad Debt Write-off",          type: "Expenses", subtype: "Other Expense", balance: 0,    status: "active", parent: null },
];

export async function getSetupChartOfAccounts() {
  await delay();
  return _brandObj(_setupChartOfAccounts.map((a) => ({ ...a })));
}

export async function createAccount(account) {
  await delay();
  const exists = _setupChartOfAccounts.find((a) => a.code === account.code);
  if (exists) return { success: false, error: "Code already exists" };
  const a = { ...account, balance: 0, status: "active" };
  _setupChartOfAccounts.push(a);
  return _brandObj({ ...a, requiresApproval: !account.parent });
}

export async function updateAccount(code, updates) {
  await delay();
  const a = _setupChartOfAccounts.find((x) => x.code === code);
  if (!a) return null;
  if (updates.name != null) a.name = updates.name;
  if (updates.subtype != null) a.subtype = updates.subtype;
  if (updates.description != null) a.description = updates.description;
  return _brandObj({ ...a });
}

export async function deactivateAccount(code) {
  await delay();
  const a = _setupChartOfAccounts.find((x) => x.code === code);
  if (!a) return null;
  const needsApproval = Math.abs(a.balance) > 0;
  a.status = "inactive";
  return _brandObj({ ...a, requiresApproval: needsApproval });
}

// Fiscal year + periods
const _fiscalYearByTenant = {};
function _initFY(tenantId) {
  if (!_fiscalYearByTenant[tenantId]) {
    _fiscalYearByTenant[tenantId] = {
      currentFY: 2026,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      periods: [
        { month: "Jan 2026", status: "hard_closed" },
        { month: "Feb 2026", status: "hard_closed" },
        { month: "Mar 2026", status: "open" },
        { month: "Apr 2026", status: "open" },
        { month: "May 2026", status: "not_started" },
        { month: "Jun 2026", status: "not_started" },
        { month: "Jul 2026", status: "not_started" },
        { month: "Aug 2026", status: "not_started" },
        { month: "Sep 2026", status: "not_started" },
        { month: "Oct 2026", status: "not_started" },
        { month: "Nov 2026", status: "not_started" },
        { month: "Dec 2026", status: "not_started" },
      ],
      milestones: [
        { date: _daysFromNow(7),  label: "March close target" },
        { date: _daysFromNow(30), label: "Q1 tax filing (KGT)" },
        { date: _daysFromNow(60), label: "Q1 management review" },
      ],
    };
  }
  return _fiscalYearByTenant[tenantId];
}

export async function getFiscalYearConfig() {
  await delay();
  return _brandObj(JSON.parse(JSON.stringify(_initFY(_currentTenantId))));
}

export async function updateFiscalYearConfig(config) {
  await delay();
  const fy = _initFY(_currentTenantId);
  Object.assign(fy, config);
  return _brandObj(JSON.parse(JSON.stringify(fy)));
}

export async function openPeriod(month) {
  await delay();
  const fy = _initFY(_currentTenantId);
  const p = fy.periods.find((x) => x.month === month);
  if (p) p.status = "open";
  return { success: true, period: p };
}

export async function closePeriod(month) {
  await delay();
  const fy = _initFY(_currentTenantId);
  const p = fy.periods.find((x) => x.month === month);
  if (p) p.status = "hard_closed";
  return { success: true, period: p };
}

// Tax configuration
const _taxConfigByTenant = {};
function _initTax(tenantId) {
  if (!_taxConfigByTenant[tenantId]) {
    _taxConfigByTenant[tenantId] = {
      regime: "kuwait",
      zakatRate: 2.5,
      zakatAccount: "2300",
      corporateTaxRate: 15,
      corporateTaxAppliesTo: "foreign",
      pifssEnabled: true,
      pifssRate: 11,
      pifssAccount: "2200",
      vatEnabled: false,
      vatRate: 0,
      vatRegistrationNumber: "",
      vatAccount: null,
      filingFrequency: "quarterly",
      exemptions: [
        { partyName: "Government entities", reason: "Statutory exemption" },
        { partyName: "Export transactions", reason: "Zero-rated" },
      ],
    };
  }
  return _taxConfigByTenant[tenantId];
}

export async function getTaxConfiguration() {
  await delay();
  return _brandObj(JSON.parse(JSON.stringify(_initTax(_currentTenantId))));
}
export async function updateTaxConfiguration(config) {
  await delay();
  const cur = _initTax(_currentTenantId);
  Object.assign(cur, config);
  return _brandObj(JSON.parse(JSON.stringify(cur)));
}

// Currencies
const _currencyConfigByTenant = {};
function _initCurrency(tenantId) {
  if (!_currencyConfigByTenant[tenantId]) {
    _currencyConfigByTenant[tenantId] = {
      base: "KWD",
      enabled: { USD: true, EUR: true, GBP: false, SAR: true, AED: true, BHD: false, OMR: false, QAR: false },
      rates: { USD: 0.3075, EUR: 0.3345, GBP: 0.3910, SAR: 0.0820, AED: 0.0837, BHD: 0.8147, OMR: 0.7979, QAR: 0.0844 },
      rateSource: "central_bank_kuwait",
      lastUpdated: _hoursAgo(4),
    };
  }
  return _currencyConfigByTenant[tenantId];
}

export async function getCurrencyConfig() {
  await delay();
  return _brandObj(JSON.parse(JSON.stringify(_initCurrency(_currentTenantId))));
}
export async function updateCurrencyConfig(config) {
  await delay();
  const cur = _initCurrency(_currentTenantId);
  Object.assign(cur, config);
  return _brandObj(JSON.parse(JSON.stringify(cur)));
}
export async function updateExchangeRates() {
  await delay();
  const cur = _initCurrency(_currentTenantId);
  const now = new Date().toISOString();
  const updated = [];
  Object.keys(cur.rates).forEach((k) => {
    const drift = (Math.random() - 0.5) * 0.002;
    cur.rates[k] = Math.round((cur.rates[k] + drift) * 10000) / 10000;
    updated.push({ currency: k, rate: cur.rates[k], timestamp: now });
  });
  cur.lastUpdated = now;
  return { updated };
}

// Integration status (monitoring view)
export async function getIntegrationStatus() {
  await delay();
  return _brandObj([
    { id: "int-bank",   name: "KIB Corporate Banking",  status: "connected",    lastSync: _hoursAgo(1),  syncFrequency: "hourly",  volumePerDay: 84,  recentErrors: [] },
    { id: "int-pos",    name: "Talabat POS",            status: "connected",    lastSync: _hoursAgo(2),  syncFrequency: "hourly",  volumePerDay: 132, recentErrors: [] },
    { id: "int-bayzat", name: "Bayzat HR & Payroll",    status: "connected",    lastSync: _hoursAgo(6),  syncFrequency: "daily",   volumePerDay: 4,   recentErrors: [] },
    { id: "int-zid",    name: "Zid E-commerce",         status: "error",        lastSync: _daysAgo(1),   syncFrequency: "hourly",  volumePerDay: 0,   recentErrors: [
      { timestamp: _hoursAgo(8),  message: "OAuth token expired" },
      { timestamp: _hoursAgo(18), message: "Connection timeout" },
    ] },
    { id: "int-qb",     name: "QuickBooks Export",      status: "disconnected", lastSync: null,          syncFrequency: "daily",   volumePerDay: 0,   recentErrors: [] },
    { id: "int-deliv",  name: "Deliveroo",              status: "disconnected", lastSync: null,          syncFrequency: "hourly",  volumePerDay: 0,   recentErrors: [] },
  ]);
}

export async function forceSyncIntegration(id) {
  await delay();
  return { success: true, syncedAt: new Date().toISOString(), id };
}

export async function getIntegrationSyncLogs(id, limit) {
  await delay();
  return _brandObj(
    Array.from({ length: Math.min(limit || 10, 10) }, (_, i) => ({
      timestamp: _hoursAgo(i * 2 + 1),
      status: i === 3 || i === 7 ? "error" : "success",
      details: i === 3 || i === 7 ? "Transient network error" : `Synced ${Math.floor(Math.random() * 40 + 5)} records`,
    }))
  );
}

// Team access matrix
const _teamAccessSeed = [
  { memberId: "owner", name: "Tarek Aljasem",  role: "Owner",             permissions: { view_financials: true, post_je: true, approve_je: true, edit_budget: true, close_periods: true, configure_setup: true, approve_writeoffs: true } },
  { memberId: "cfo",   name: "You (CFO)",      role: "CFO",               permissions: { view_financials: true, post_je: true, approve_je: true, edit_budget: true, close_periods: true, configure_setup: true, approve_writeoffs: false } },
  { memberId: "sara",  name: "Sara Al-Ahmadi", role: "Senior Accountant", permissions: { view_financials: true, post_je: true, approve_je: false, edit_budget: false, close_periods: false, configure_setup: false, approve_writeoffs: false } },
  { memberId: "noor",  name: "Noor",           role: "Senior Accountant", permissions: { view_financials: true, post_je: true, approve_je: false, edit_budget: false, close_periods: false, configure_setup: false, approve_writeoffs: false } },
  { memberId: "jasem", name: "Jasem",          role: "Junior Accountant", permissions: { view_financials: false, post_je: true, approve_je: false, edit_budget: false, close_periods: false, configure_setup: false, approve_writeoffs: false } },
  { memberId: "layla", name: "Layla",          role: "Junior Accountant", permissions: { view_financials: false, post_je: false, approve_je: false, edit_budget: false, close_periods: false, configure_setup: false, approve_writeoffs: false } },
];

export async function getTeamAccessMatrix() {
  await delay();
  return _brandObj(_teamAccessSeed.map((m) => ({ ...m, permissions: { ...m.permissions } })));
}

export async function updateTeamMemberPermissions(memberId, permissions) {
  await delay();
  const m = _teamAccessSeed.find((x) => x.memberId === memberId);
  if (!m) return null;
  Object.assign(m.permissions, permissions);
  const sensitive = ["approve_je", "close_periods", "configure_setup", "approve_writeoffs"];
  const requiresApproval = Object.keys(permissions).some((k) => sensitive.includes(k));
  return _brandObj({ ...m, permissions: { ...m.permissions }, requiresApproval });
}

export async function getRoleTemplates() {
  await delay();
  return [
    { id: "rt-junior",   name: "Junior Accountant",  permissions: { view_financials: false, post_je: true,  approve_je: false, edit_budget: false, close_periods: false, configure_setup: false, approve_writeoffs: false } },
    { id: "rt-senior",   name: "Senior Accountant",  permissions: { view_financials: true,  post_je: true,  approve_je: false, edit_budget: false, close_periods: false, configure_setup: false, approve_writeoffs: false } },
    { id: "rt-cfo",      name: "CFO",                permissions: { view_financials: true,  post_je: true,  approve_je: true,  edit_budget: true,  close_periods: true,  configure_setup: true,  approve_writeoffs: false } },
    { id: "rt-auditor",  name: "Auditor (read-only)", permissions: { view_financials: true,  post_je: false, approve_je: false, edit_budget: false, close_periods: false, configure_setup: false, approve_writeoffs: false } },
    { id: "rt-owner",    name: "Owner",              permissions: { view_financials: true,  post_je: true,  approve_je: true,  edit_budget: true,  close_periods: true,  configure_setup: true,  approve_writeoffs: true } },
  ];
}

export async function applyRoleTemplate(memberId, templateId) {
  await delay();
  const templates = await getRoleTemplates();
  const tpl = templates.find((x) => x.id === templateId);
  const m = _teamAccessSeed.find((x) => x.memberId === memberId);
  if (!tpl || !m) return null;
  m.permissions = { ...tpl.permissions };
  return _brandObj({ ...m, permissions: { ...m.permissions } });
}

// Engine configuration
const _engineConfigByTenant = {};
function _initEngineConfig(tenantId) {
  if (!_engineConfigByTenant[tenantId]) {
    _engineConfigByTenant[tenantId] = {
      jeApprovalThreshold: 1000,
      autoCategorizationConfidence: 85,
      autoReconDateTolerance: 2,
      materialityThreshold: 1000,
      writeOffApprovalThreshold: 500,
    };
  }
  return _engineConfigByTenant[tenantId];
}

export async function getEngineConfiguration() {
  await delay();
  return { ..._initEngineConfig(_currentTenantId) };
}

export async function updateEngineConfiguration(config) {
  await delay();
  const cur = _initEngineConfig(_currentTenantId);
  Object.assign(cur, config);
  return { ...cur };
}

// ─────────────────────────────────────────
// Step 20D-1 additions — Taskbox completeness. All additive.
// NOTE: attachments are stored as in-memory data URLs. Phase B backend
// must replace with real upload to S3/Supabase storage.
// ─────────────────────────────────────────

// ── Attachments ──────────────────────────────────────────────────
let _attachmentSeq = 1;

// Seed a tiny 1x1 green PNG as a data URL. (_MOCK_PDF_URL hoisted to line ~4651 to fix BUG-005 TDZ.)
const _MOCK_PNG_URL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4//8/AwAI/AL+X6Jz0AAAAABJRU5ErkJggg==";

function _seedAttachment(name, type, size, uploaderId, daysAgoN) {
  let dataUrl = "";
  if (type.startsWith("image/")) dataUrl = _MOCK_PNG_URL;
  else if (type === "application/pdf") dataUrl = _MOCK_PDF_URL;
  return {
    id: `att-${_attachmentSeq++}`,
    name,
    size,
    type,
    uploadedBy: uploaderId,
    uploadedAt: _daysAgo(daysAgoN),
    dataUrl,
  };
}

// Seed a handful of existing tasks with attachments to exercise the UI.
(function seedTaskAttachments() {
  const tsk113 = TASKBOX_DB.find((t) => t.id === "TSK-113");
  if (tsk113) tsk113.attachments = [
    _seedAttachment("PIFSS_March_payroll.pdf",   "application/pdf", 184320, "sara", 1),
    _seedAttachment("Bayzat_export_March.xlsx",  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 52400, "sara", 1),
  ];
  const tsk120 = TASKBOX_DB.find((t) => t.id === "TSK-120");
  if (tsk120) tsk120.attachments = [
    _seedAttachment("Q1_PL_draft.pdf", "application/pdf", 248000, "cfo", 0),
  ];
  const tsk102 = TASKBOX_DB.find((t) => t.id === "TSK-102");
  if (tsk102) tsk102.attachments = [
    _seedAttachment("Boubyan_deposit_slip.png", "image/png", 88000, "sara", 2),
    _seedAttachment("Boubyan_statement_Mar.pdf", "application/pdf", 312000, "sara", 2),
    _seedAttachment("reconciliation_notes.txt", "text/plain", 4200, "cfo", 1),
  ];
  // Ensure every task has an attachments array so the UI can unconditionally read it.
  for (const t of TASKBOX_DB) {
    if (!Array.isArray(t.attachments)) t.attachments = [];
  }
})();

export async function attachTaskFile(taskId, file) {
  await delay();
  const task = TASKBOX_DB.find((t) => t.id === taskId);
  if (!task) return null;
  // The caller is expected to have already converted the File to a data URL
  // because FileReader is async and lives in the component. `file` here is
  // the {name, size, type, dataUrl} shape.
  const att = {
    id: `att-${_attachmentSeq++}`,
    name: file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
    uploadedBy: file.uploadedBy || "cfo",
    uploadedAt: new Date().toISOString(),
    dataUrl: file.dataUrl || "",
  };
  if (!Array.isArray(task.attachments)) task.attachments = [];
  task.attachments.push(att);
  task.messages.push(_msgEvent(TASKBOX_PEOPLE[att.uploadedBy] || P.cfo, `[System] Attached ${att.name}`, 0));
  task.updatedAt = new Date().toISOString();
  return { ...att };
}

export async function removeTaskAttachment(taskId, attachmentId) {
  await delay();
  const task = TASKBOX_DB.find((t) => t.id === taskId);
  if (!task || !Array.isArray(task.attachments)) return { success: false };
  const att = task.attachments.find((a) => a.id === attachmentId);
  task.attachments = task.attachments.filter((a) => a.id !== attachmentId);
  if (att) {
    task.messages.push(_msgEvent(P.cfo, `[System] Removed ${att.name}`, 0));
    task.updatedAt = new Date().toISOString();
  }
  return { success: true };
}

export async function getTaskAttachments(taskId) {
  await delay();
  const task = TASKBOX_DB.find((t) => t.id === taskId);
  return task && Array.isArray(task.attachments) ? task.attachments.map((a) => ({ ...a })) : [];
}

// ── Escalation ───────────────────────────────────────────────────
export async function escalateTask(taskId, toUserId, reason, priority) {
  await delay();
  const original = TASKBOX_DB.find((t) => t.id === taskId);
  if (!original) return null;
  const recipient = TASKBOX_PEOPLE[toUserId] || P.owner;
  const newId = `TSK-ESC-${Math.floor(Math.random() * 900 + 100)}`;
  const newTask = {
    id: newId,
    senderId: original.recipient.id,
    sender: original.recipient,
    recipient,
    type: original.type,
    subject: `[Escalated] ${original.subject}`,
    body: `${reason}\n\nOriginal task: ${original.id}\n\n${original.body}`,
    direction: "upward",
    priority: priority || original.priority || "normal",
    status: "open",
    unread: true,
    linkedItem: { type: "escalated_from", taskId: original.id },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    dueDate: original.dueDate,
    messages: [_msgEvent(original.recipient, reason, 0)],
    attachments: [],
  };
  TASKBOX_DB.unshift(newTask);
  original.status = "escalated";
  original.escalatedTo = { taskId: newId, at: new Date().toISOString() };
  original.messages.push(_msgEvent(original.recipient, `[System] Escalated to ${recipient.name}: ${reason}`, 0));
  original.updatedAt = new Date().toISOString();
  return { originalTaskId: taskId, newTaskId: newId, status: "escalated" };
}

// ── Bulk operations ──────────────────────────────────────────────
function _isApprovalType(t) {
  return t.type === "request-approval" || t.type === "approve-budget";
}

export async function bulkApproveTasks(taskIds) {
  await delay();
  const ids = Array.isArray(taskIds) ? taskIds : [];
  let approved = 0;
  const skippedIds = [];
  for (const id of ids) {
    const task = TASKBOX_DB.find((t) => t.id === id);
    if (!task) continue;
    if (!_isApprovalType(task)) { skippedIds.push(id); continue; }
    task.status = "completed";
    task.updatedAt = new Date().toISOString();
    task.messages.push(_msgEvent(P.cfo, "[System] Bulk approved.", 0));
    approved += 1;
  }
  return { approved, skipped: skippedIds.length, skippedIds };
}

export async function bulkRejectTasks(taskIds, reason) {
  await delay();
  const ids = Array.isArray(taskIds) ? taskIds : [];
  let rejected = 0;
  let skipped = 0;
  for (const id of ids) {
    const task = TASKBOX_DB.find((t) => t.id === id);
    if (!task) { skipped++; continue; }
    task.status = "rejected";
    task.updatedAt = new Date().toISOString();
    task.messages.push(_msgEvent(P.cfo, `[System] Bulk rejected: ${reason || ""}`, 0));
    rejected += 1;
  }
  return { rejected, skipped };
}

export async function bulkAssignTasks(taskIds, recipientId) {
  await delay();
  const ids = Array.isArray(taskIds) ? taskIds : [];
  const recipient = TASKBOX_PEOPLE[recipientId] || P.sara;
  let assigned = 0;
  for (const id of ids) {
    const task = TASKBOX_DB.find((t) => t.id === id);
    if (!task) continue;
    task.recipient = recipient;
    task.updatedAt = new Date().toISOString();
    task.messages.push(_msgEvent(P.cfo, `[System] Reassigned to ${recipient.name}`, 0));
    assigned += 1;
  }
  return { assigned };
}

export async function bulkEscalateTasks(taskIds, toUserId, reason, priority) {
  await delay();
  const newTaskIds = [];
  for (const id of taskIds) {
    const r = await escalateTask(id, toUserId, reason, priority);
    if (r?.newTaskId) newTaskIds.push(r.newTaskId);
  }
  return { escalated: newTaskIds.length, newTaskIds };
}

export async function bulkMarkAsRead(taskIds) {
  await delay();
  let marked = 0;
  for (const id of taskIds) {
    const task = TASKBOX_DB.find((t) => t.id === id);
    if (task && task.unread) { task.unread = false; marked++; }
  }
  return { marked };
}

export async function bulkCompleteTasks(taskIds) {
  await delay();
  let completed = 0;
  for (const id of taskIds) {
    const task = TASKBOX_DB.find((t) => t.id === id);
    if (task) { task.status = "completed"; task.updatedAt = new Date().toISOString(); completed++; }
  }
  return { completed };
}

export async function bulkArchiveTasks(taskIds) {
  await delay();
  let archived = 0;
  for (const id of taskIds) {
    const task = TASKBOX_DB.find((t) => t.id === id);
    if (task) { task.archived = true; archived++; }
  }
  return { archived };
}

export async function exportTasks(taskIds, format) {
  await delay();
  return { filename: `tasks-export-${new Date().toISOString().slice(0, 10)}.${format || "csv"}`, rowCount: taskIds.length };
}

// ── Task Templates ───────────────────────────────────────────────
let _templateSeq = 100;
let _taskTemplates = [
  { id: "tpl-1", name: "Monthly reconciliation review",  description: "Review month's bank reconciliations before close.", type: "request-review",       recipientId: "sara", priority: "normal", subject: "Monthly reconciliation review — {{period}}", body: "Please complete reconciliation review for all bank accounts before the close deadline. Flag any exceptions.",                    visibility: "role",    author: "cfo",  lastUsed: _daysAgo(7),  usageCount: 8 },
  { id: "tpl-2", name: "Weekly budget check-in",         description: "Weekly variance review with department lead.",      type: "request-review",       recipientId: "sara", priority: "normal", subject: "Weekly budget check-in — {{week}}",           body: "Review weekly variance against the plan. Highlight any items over 10% variance for discussion.",                                visibility: "my",      author: "cfo",  lastUsed: _daysAgo(3),  usageCount: 14 },
  { id: "tpl-3", name: "Request JE approval",            description: "Standard JE approval request template.",            type: "request-approval",    recipientId: "owner", priority: "high",   subject: "JE approval — {{je_id}}",                     body: "Please review and approve the attached journal entry. All supporting documentation is included.",                              visibility: "role",    author: "cfo",  lastUsed: _hoursAgo(6),  usageCount: 23 },
  { id: "tpl-4", name: "Vendor invoice dispute",         description: "Escalate a disputed vendor invoice.",                type: "escalate",            recipientId: "owner", priority: "high",   subject: "Vendor invoice dispute — {{vendor}}",         body: "Disputing invoice from {{vendor}}. Reason attached. Please advise on next steps.",                                             visibility: "my",      author: "cfo",  lastUsed: _daysAgo(12), usageCount: 3 },
  { id: "tpl-5", name: "Month-end close status",         description: "Weekly close status update to Owner.",               type: "general-question",    recipientId: "owner", priority: "normal", subject: "Month-end close status — {{period}}",         body: "Current status of month-end close: {{status}}. Pending items: {{pending}}. On track for {{deadline}}.",                         visibility: "role",    author: "cfo",  lastUsed: _daysAgo(5),  usageCount: 11 },
  { id: "tpl-6", name: "Expense receipt match",          description: "Ask Senior Accountant to match receipts.",           type: "request-work",        recipientId: "sara", priority: "normal", subject: "Match expense receipts — {{period}}",         body: "Match the attached expense reports against bank statements for {{period}}. Flag any missing receipts.",                          visibility: "role",    author: "cfo",  lastUsed: _daysAgo(2),  usageCount: 18 },
  { id: "tpl-7", name: "New customer onboarding",        description: "Set up new customer in the system.",                 type: "request-work",        recipientId: "sara", priority: "normal", subject: "Customer onboarding — {{customer}}",           body: "New customer {{customer}} needs a ledger entry, tax exemption verification, and payment terms setup.",                          visibility: "role",    author: "cfo",  lastUsed: _daysAgo(9),  usageCount: 6 },
  { id: "tpl-8", name: "Weekly team 1:1",                description: "Recurring weekly sync.",                             type: "general-question",    recipientId: "sara", priority: "normal", subject: "Weekly 1:1 — {{week}}",                       body: "Topics:\n• Workload\n• Blockers\n• Process improvements\n• Questions",                                                         visibility: "my",      author: "cfo",  lastUsed: _hoursAgo(30), usageCount: 22 },
];

export async function getTaskTemplates(filter) {
  await delay();
  const f = filter || "all";
  let list = _taskTemplates.slice();
  if (f === "my") list = list.filter((t) => t.visibility === "my");
  if (f === "role") list = list.filter((t) => t.visibility === "role");
  return list.map((t) => ({ ...t }));
}

export async function createTaskTemplate(template) {
  await delay();
  const t = {
    id: `tpl-${_templateSeq++}`,
    lastUsed: null,
    usageCount: 0,
    author: "cfo",
    visibility: "my",
    ...template,
  };
  _taskTemplates.unshift(t);
  return { ...t };
}

export async function updateTaskTemplate(id, updates) {
  await delay();
  const t = _taskTemplates.find((x) => x.id === id);
  if (!t) return null;
  Object.assign(t, updates);
  return { ...t };
}

export async function deleteTaskTemplate(id) {
  await delay();
  _taskTemplates = _taskTemplates.filter((t) => t.id !== id);
  return { success: true };
}

export async function duplicateTaskTemplate(id) {
  await delay();
  const src = _taskTemplates.find((x) => x.id === id);
  if (!src) return null;
  const copy = { ...src, id: `tpl-${_templateSeq++}`, name: `${src.name} (copy)`, lastUsed: null, usageCount: 0, visibility: "my" };
  _taskTemplates.unshift(copy);
  return { ...copy };
}

export async function shareTaskTemplate(id, scope) {
  await delay();
  const t = _taskTemplates.find((x) => x.id === id);
  if (!t) return null;
  t.visibility = scope === "role" ? "role" : "my";
  return { ...t };
}

export async function createTaskFromTemplate(templateId, overrides) {
  await delay();
  const tpl = _taskTemplates.find((x) => x.id === templateId);
  if (!tpl) return null;
  tpl.usageCount += 1;
  tpl.lastUsed = new Date().toISOString();
  return {
    type: tpl.type,
    recipientId: tpl.recipientId,
    subject: tpl.subject,
    body: tpl.body,
    priority: tpl.priority,
    ...overrides,
  };
}

// ── Search ──────────────────────────────────────────────────────
// Client-side filter wrapped in an engine function so the backend can
// implement server-side search later.
export async function searchTasks(query, filters, role) {
  await delay();
  const all = await getTaskbox(role || "CFO", "all");
  const q = (query || "").toLowerCase().trim();
  const f = filters || {};
  return all.filter((t) => {
    if (q) {
      const hay = [
        t.subject, t.body, t.sender?.name, t.recipient?.name, t.type,
        t.linkedItem?.id,
        ...(t.messages || []).map((m) => m.body),
        ...(t.attachments || []).map((a) => a.name),
      ].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.senderIds?.length && !f.senderIds.includes(t.sender?.id)) return false;
    if (f.recipientIds?.length && !f.recipientIds.includes(t.recipient?.id)) return false;
    if (f.types?.length && !f.types.includes(t.type)) return false;
    if (f.statuses?.length && !f.statuses.includes(t.status)) return false;
    if (f.priorities?.length && !f.priorities.includes(t.priority)) return false;
    if (f.hasAttachments && !(t.attachments && t.attachments.length > 0)) return false;
    if (f.linkedType && t.linkedItem?.type !== f.linkedType) return false;
    if (f.createdAfter && new Date(t.createdAt) < new Date(f.createdAfter)) return false;
    if (f.createdBefore && new Date(t.createdAt) > new Date(f.createdBefore)) return false;
    return true;
  });
}

// ─────────────────────────────────────────
// Step 20D-2 additions — Rules + Manual JE completeness. All additive.
// ─────────────────────────────────────────

// ── Rule preview ────────────────────────────────────────────────
// Runs an in-progress rule against the current tenant's bank transactions
// and returns sample matches so the user can validate the logic before save.
export async function previewRule(ruleType, ruleConfig) {
  await delay();
  const txs = await getBankTransactionsPending();
  const cfg = ruleConfig || {};
  const matches = [];

  for (const tx of txs) {
    let match = true;

    // Pattern matching
    if (cfg.merchantPattern?.value) {
      const p = String(cfg.merchantPattern.value).toLowerCase();
      const t = ruleType === "categorization" ? cfg.merchantPattern.type || "contains" : "contains";
      const hay = String(tx.merchant || "").toLowerCase();
      if (t === "contains" && !hay.includes(p)) match = false;
      else if (t === "starts-with" && !hay.startsWith(p)) match = false;
      else if (t === "exact" && hay !== p) match = false;
      else if (t === "regex") {
        try { if (!new RegExp(p, "i").test(hay)) match = false; } catch (e) { match = false; }
      }
    }

    // Amount band
    if (cfg.conditions?.amountMin != null && Math.abs(tx.amount) < Number(cfg.conditions.amountMin)) match = false;
    if (cfg.conditions?.amountMax != null && Math.abs(tx.amount) > Number(cfg.conditions.amountMax)) match = false;

    // Routing rules: taskTypes + linkedItemTypes don't filter txs — they just
    // describe what would be routed. Skip to matching.
    if (ruleType === "routing" && !cfg.merchantPattern?.value && !cfg.conditions?.amountMin && !cfg.conditions?.amountMax) {
      // No filter criteria yet — don't spam matches
      continue;
    }

    if (match) {
      matches.push({
        txId: tx.id,
        date: tx.date,
        merchant: tx.merchant,
        amount: tx.amount,
        currentCategory: tx.engineSuggestion?.account || "",
        proposedCategory: ruleType === "categorization" ? (cfg.debitAccount?.name || "—") : tx.engineSuggestion?.account || "",
        proposedRecipient: ruleType === "routing" ? (cfg.action?.assignTo?.name || "—") : null,
      });
    }
    if (matches.length >= 10) break;
  }

  // Count total matches (run again without the 10-cap)
  let total = 0;
  for (const tx of txs) {
    let ok = true;
    if (cfg.merchantPattern?.value) {
      const p = String(cfg.merchantPattern.value).toLowerCase();
      const hay = String(tx.merchant || "").toLowerCase();
      if (!hay.includes(p)) ok = false;
    } else if (ruleType === "routing") {
      ok = false;
    }
    if (ok && cfg.conditions?.amountMin != null && Math.abs(tx.amount) < Number(cfg.conditions.amountMin)) ok = false;
    if (ok && cfg.conditions?.amountMax != null && Math.abs(tx.amount) > Number(cfg.conditions.amountMax)) ok = false;
    if (ok) total += 1;
  }

  return _brandObj({ matchCount: total, matches });
}

// ── Suggested rule accept / dismiss ──────────────────────────────
let _acceptedFromAiTimestamps = {}; // ruleId → acceptedAt
const _dismissedSuggestions = new Set();

export async function acceptSuggestedRule(suggestionId) {
  await delay();
  const catSugs = await getSuggestedCategorizationRules();
  const routeSugs = await getSuggestedRoutingRules();
  const catHit = catSugs.find((s) => s.id === suggestionId);
  const routeHit = routeSugs.find((s) => s.id === suggestionId);

  let acceptedRule = null;
  if (catHit) {
    acceptedRule = await createCategorizationRule({
      name: `${catHit.merchant} auto-categorization`,
      merchantPattern: { type: "contains", value: catHit.merchant },
      debitAccount: catHit.suggestedAccount || { code: "6800", name: "Bank Charges" },
      creditAccount: { code: "1120", name: "KIB Operating Account" },
      mode: "auto-apply",
      conditions: {},
      approvalThreshold: null,
    });
  } else if (routeHit) {
    acceptedRule = await createRoutingRule({
      name: routeHit.description || "AI-suggested routing rule",
      trigger: { taskTypes: ["all"], linkedItemTypes: [], conditions: { amountMin: routeHit.amountMin || null, merchantPattern: routeHit.merchantPattern || null } },
      action: { assignTo: routeHit.suggestedAssignee || P.sara, alsoNotify: null, priority: "normal" },
    });
  }
  _dismissedSuggestions.add(suggestionId);
  if (acceptedRule?.id) _acceptedFromAiTimestamps[acceptedRule.id] = new Date().toISOString();
  return { acceptedRule, suggestionId };
}

export async function dismissSuggestedRule(suggestionId) {
  await delay();
  _dismissedSuggestions.add(suggestionId);
  return { success: true };
}

export function isSuggestionDismissed(id) {
  return _dismissedSuggestions.has(id);
}

export function getAcceptedFromAiTimestamp(ruleId) {
  return _acceptedFromAiTimestamps[ruleId] || null;
}

// ── Chart of accounts search (canonical picker path) ────────────
// Consolidation note: getChartOfAccounts is legacy (20B engine), and
// getSetupChartOfAccounts is the Setup tree (20C-4). This new function is
// the canonical picker query — returns the rich shape from setup.
export async function searchChartOfAccounts(query, filters) {
  await delay();
  const list = await getSetupChartOfAccounts();
  const q = (query || "").toLowerCase().trim();
  const f = filters || {};
  let result = list;
  if (f.types && f.types.length > 0) {
    result = result.filter((a) => f.types.includes(a.type));
  }
  if (f.activeOnly) {
    result = result.filter((a) => a.status === "active");
  }
  if (q) {
    result = result.filter((a) =>
      a.code.includes(q) ||
      a.name.toLowerCase().includes(q) ||
      (a.subtype || "").toLowerCase().includes(q)
    );
  }
  return _brandObj(result.map((a) => ({ ...a })));
}

// ── Period status check (for Manual JE lock) ────────────────────
export async function checkPeriodStatus(date) {
  await delay();
  const fy = await getFiscalYearConfig();
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) {
    return { status: "open", period: { month: "", year: null }, requiresApproval: false, lockedAt: null };
  }
  const monthLabel = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  const p = fy.periods.find((x) => x.month === monthLabel);
  if (!p) {
    return { status: "not-started", period: { month: monthLabel, year: d.getFullYear() }, requiresApproval: false, lockedAt: null };
  }
  return {
    status: p.status === "hard_closed" ? "hard-closed" : p.status === "soft_closed" ? "soft-closed" : p.status === "open" ? "open" : "not-started",
    period: { month: monthLabel, year: d.getFullYear() },
    requiresApproval: p.status === "soft_closed",
    lockedAt: p.status === "hard_closed" ? _daysAgo(7) : null,
  };
}

// ── JE attachments ──────────────────────────────────────────────
// Reuses the same in-memory data URL pattern as taskbox attachments.
// Phase B backend replaces with real storage.
let _jeAttachmentSeq = 1;

function _seedJEAttachments() {
  // Attach to a few posted JEs that already live in the engine history.
  try {
    const targets = ["JE-0417", "JE-0418", "JE-0420"];
    for (const jeId of targets) {
      // Find in adjusting entries (from 20C-2)
      const adj = _adjustingEntries && _adjustingEntries.find((j) => j.id === jeId);
      if (adj && !adj.attachments) {
        adj.attachments = [{
          id: `jea-${_jeAttachmentSeq++}`,
          name: `${jeId}_support.pdf`,
          size: 132000,
          type: "application/pdf",
          uploadedBy: "cfo",
          uploadedAt: _daysAgo(2),
          dataUrl: _MOCK_PDF_URL,
        }];
      }
    }
  } catch (e) { /* ignore — adjusting entries may not be present */ }
}
_seedJEAttachments();

// Storage for draft / posted JE attachments, keyed by je id.
const _jeAttachmentStore = {};

export async function attachJEFile(jeId, file) {
  await delay();
  if (!_jeAttachmentStore[jeId]) _jeAttachmentStore[jeId] = [];
  const att = {
    id: `jea-${_jeAttachmentSeq++}`,
    name: file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
    uploadedBy: file.uploadedBy || "cfo",
    uploadedAt: new Date().toISOString(),
    dataUrl: file.dataUrl || "",
  };
  _jeAttachmentStore[jeId].push(att);
  // Also attempt to attach to the adjusting-entries list if the JE lives there.
  if (typeof _adjustingEntries !== "undefined") {
    const adj = _adjustingEntries.find((j) => j.id === jeId);
    if (adj) {
      if (!adj.attachments) adj.attachments = [];
      adj.attachments.push(att);
    }
  }
  return { ...att };
}

export async function removeJEAttachment(jeId, attachmentId) {
  await delay();
  if (_jeAttachmentStore[jeId]) {
    _jeAttachmentStore[jeId] = _jeAttachmentStore[jeId].filter((a) => a.id !== attachmentId);
  }
  if (typeof _adjustingEntries !== "undefined") {
    const adj = _adjustingEntries.find((j) => j.id === jeId);
    if (adj && adj.attachments) {
      adj.attachments = adj.attachments.filter((a) => a.id !== attachmentId);
    }
  }
  return { success: true };
}

export async function getJEAttachments(jeId) {
  await delay();
  const direct = _jeAttachmentStore[jeId] || [];
  let adjAtts = [];
  if (typeof _adjustingEntries !== "undefined") {
    const adj = _adjustingEntries.find((j) => j.id === jeId);
    if (adj && adj.attachments) adjAtts = adj.attachments;
  }
  // Merge + de-dupe by id
  const map = new Map();
  [...direct, ...adjAtts].forEach((a) => map.set(a.id, a));
  return Array.from(map.values());
}

// ── JE template metadata ────────────────────────────────────────
// getManualJETemplates exists (earlier engine); augment with real metadata
// tracking. Since the existing templates shape lives in a module-level
// constant, we maintain a parallel `_jeTemplateMeta` map keyed by template id.
const _jeTemplateMeta = {};
function _ensureTemplateMeta(id) {
  if (!_jeTemplateMeta[id]) {
    _jeTemplateMeta[id] = {
      usageCount: Math.floor(Math.random() * 20 + 2),
      lastUsed: _daysAgo(Math.floor(Math.random() * 12 + 1)),
      createdAt: _daysAgo(Math.floor(Math.random() * 60 + 10)),
      createdBy: "cfo",
      sharedWithRole: Math.random() > 0.5,
    };
  }
  return _jeTemplateMeta[id];
}

export async function useJETemplate(templateId) {
  await delay();
  const meta = _ensureTemplateMeta(templateId);
  meta.usageCount += 1;
  meta.lastUsed = new Date().toISOString();
  // Delegate to existing createFromTemplate for the actual draft creation
  return createFromTemplate(templateId);
}

export async function getJETemplateMeta(templateId) {
  await delay();
  return { ..._ensureTemplateMeta(templateId) };
}

export async function updateJETemplate(templateId, updates) {
  await delay();
  const meta = _ensureTemplateMeta(templateId);
  Object.assign(meta, updates);
  return { ...meta };
}

export async function deleteJETemplateRecord(templateId) {
  await delay();
  delete _jeTemplateMeta[templateId];
  return { success: true };
}

export async function shareJETemplate(templateId, sharedWithRole) {
  await delay();
  const meta = _ensureTemplateMeta(templateId);
  meta.sharedWithRole = !!sharedWithRole;
  return { ...meta };
}

// ─────────────────────────────────────────────────────────────────────────────
// Aminah session persistence (in-memory, wiped on page refresh)
// ─────────────────────────────────────────────────────────────────────────────
const _AMINAH_SESSIONS_DB = {};
let _aminahSessionSeq = 1;

export async function createAminahSession(role) {
  await delay();
  const id = `sess-${_aminahSessionSeq++}-${Date.now()}`;
  const session = {
    id,
    role,
    tenantId: _currentTenantId,
    createdAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    messages: [],
    metadata: { totalToolCalls: 0, totalTokens: 0, modelUsed: "stub-canned-v1" },
  };
  _AMINAH_SESSIONS_DB[id] = session;
  return _brandObj({ ...session });
}

export async function getAminahSession(sessionId) {
  await delay();
  const s = _AMINAH_SESSIONS_DB[sessionId];
  return s ? _brandObj({ ...s, messages: [...s.messages] }) : null;
}

export async function listRecentAminahSessions(role, limit = 10) {
  await delay();
  const list = Object.values(_AMINAH_SESSIONS_DB)
    .filter((s) => s.role === role && s.tenantId === _currentTenantId)
    .sort((a, b) => new Date(b.lastActivityAt) - new Date(a.lastActivityAt))
    .slice(0, limit);
  return _brandObj(list.map((s) => ({ id: s.id, role: s.role, createdAt: s.createdAt, lastActivityAt: s.lastActivityAt, messageCount: s.messages.length, preview: s.messages[0]?.blocks?.[0]?.text?.slice(0, 60) || "" })));
}

export async function deleteAminahSession(sessionId) {
  await delay();
  delete _AMINAH_SESSIONS_DB[sessionId];
  return { success: true };
}

export async function appendMessageToSession(sessionId, message) {
  await delay();
  const s = _AMINAH_SESSIONS_DB[sessionId];
  if (!s) return null;
  s.messages.push(message);
  s.lastActivityAt = new Date().toISOString();
  if (message.blocks?.some((b) => b.type === "tool_call")) {
    s.metadata.totalToolCalls += message.blocks.filter((b) => b.type === "tool_call").length;
  }
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Budget 20D-5 extensions
// ─────────────────────────────────────────────────────────────────────────────

const _BUDGET_COMMENTS_DB = {};
let _budgetCommentSeq = 1;

export async function createBudgetLine(budgetId, lineData) {
  await delay();
  const b = _BUDGETS_DB[budgetId];
  if (!b) return null;
  const dept = b.departments.find((d) => d.id === lineData.departmentId);
  if (!dept) return null;
  const id = `line-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const newLine = { id, code: lineData.code || "", name: lineData.name || "New line", annual: Number(lineData.annual || 0), monthlyDistribution: Array(12).fill(Number(((lineData.annual || 0) / 12).toFixed(3))), growthRate: 0 };
  dept.lineItems.push(newLine);
  dept.totalAnnual = Number(dept.lineItems.reduce((s, l) => s + l.annual, 0).toFixed(3));
  return _brandObj({ ...newLine });
}

export async function updateBudgetLine(lineId, updates) {
  await delay();
  for (const b of Object.values(_BUDGETS_DB)) {
    for (const d of b.departments) {
      const line = d.lineItems.find((l) => l.id === lineId);
      if (line) {
        if (updates.name != null) line.name = updates.name;
        if (updates.code != null) line.code = updates.code;
        if (updates.annual != null) {
          line.annual = Number(updates.annual);
          line.monthlyDistribution = Array(12).fill(Number((line.annual / 12).toFixed(3)));
        }
        if (updates.monthlyDistribution) line.monthlyDistribution = updates.monthlyDistribution;
        d.totalAnnual = Number(d.lineItems.reduce((s, l) => s + l.annual, 0).toFixed(3));
        return _brandObj({ ...line });
      }
    }
  }
  return null;
}

export async function deleteBudgetLine(lineId) {
  await delay();
  for (const b of Object.values(_BUDGETS_DB)) {
    for (const d of b.departments) {
      const idx = d.lineItems.findIndex((l) => l.id === lineId);
      if (idx >= 0) {
        d.lineItems.splice(idx, 1);
        d.totalAnnual = Number(d.lineItems.reduce((s, l) => s + l.annual, 0).toFixed(3));
        return _brandObj({ success: true });
      }
    }
  }
  return { success: false };
}

export async function getBudgetForYear(year) {
  await delay();
  const all = Object.values(_BUDGETS_DB);
  const match = all.find((b) => b.period?.fiscalYear === year);
  if (match) return _brandObj({ ...match, departments: match.departments.map((d) => ({ ...d, lineItems: [...d.lineItems] })) });
  const base = all[0];
  if (!base) return null;
  const factor = year < 2026 ? 0.88 : 1.0;
  return _brandObj({
    id: `BUD-${year}-FY`, period: { type: "annual", label: `FY ${year}`, fiscalYear: year },
    status: year < 2026 ? "approved" : "draft", approvedBy: year < 2026 ? "owner" : null, approvedAt: year < 2026 ? `${year}-12-15T00:00:00Z` : null,
    totalRevenue: Number((base.totalRevenue * factor).toFixed(3)), totalExpenses: Number((base.totalExpenses * factor).toFixed(3)),
    netIncome: Number(((base.totalRevenue - base.totalExpenses) * factor).toFixed(3)),
    departments: base.departments.map((d) => ({ ...d, id: `${d.id}-${year}`, totalAnnual: Number((d.totalAnnual * factor).toFixed(3)), lineItems: d.lineItems.map((l) => ({ ...l, annual: Number((l.annual * factor).toFixed(3)) })) })),
  });
}

export async function addBudgetLineComment(lineId, content, author = "cfo") {
  await delay();
  if (!_BUDGET_COMMENTS_DB[lineId]) _BUDGET_COMMENTS_DB[lineId] = [];
  const comment = { id: `bc-${_budgetCommentSeq++}`, lineId, author, authorRole: author === "owner" ? "Owner" : author === "cfo" ? "CFO" : "Junior", content, createdAt: new Date().toISOString(), edited: false, editedAt: null };
  _BUDGET_COMMENTS_DB[lineId].push(comment);
  return _brandObj({ ...comment });
}

export async function getBudgetLineComments(lineId) {
  await delay();
  return _brandObj(_BUDGET_COMMENTS_DB[lineId] ? [..._BUDGET_COMMENTS_DB[lineId]] : []);
}

export async function deleteBudgetLineComment(lineId, commentId) {
  await delay();
  if (!_BUDGET_COMMENTS_DB[lineId]) return { success: false };
  const c = _BUDGET_COMMENTS_DB[lineId].find((x) => x.id === commentId);
  if (!c) return { success: false };
  if (Date.now() - new Date(c.createdAt).getTime() > 5 * 60 * 1000) return { success: false, error: "Cannot delete after 5 minutes" };
  _BUDGET_COMMENTS_DB[lineId] = _BUDGET_COMMENTS_DB[lineId].filter((x) => x.id !== commentId);
  return _brandObj({ success: true });
}

export async function getBudgetApprovalState(budgetId) {
  await delay();
  const b = _BUDGETS_DB[budgetId];
  if (!b) return null;
  return _brandObj({
    status: b.status, approvedBy: b.approvedBy || null, approvedAt: b.approvedAt || null,
    reviewers: [{ role: "Owner", status: b.status === "approved" || b.status === "active" ? "approved" : "pending" }],
    history: b.workflowHistory || [],
    nextAction: b.status === "draft" ? "Submit for approval" : b.status === "pending_review" ? "Awaiting Owner decision" : (b.status === "approved" || b.status === "active") ? "None — budget is active" : "Revise and resubmit",
  });
}

// Seed sample comments
(function _seedBudgetComments() {
  _BUDGET_COMMENTS_DB["6100"] = [
    { id: "bc-s1", lineId: "6100", author: "cfo", authorRole: "CFO", content: "Salaries include the 2 new hires starting Q2. Should we phase the increase or book full year?", createdAt: _daysAgo(3), edited: false, editedAt: null },
    { id: "bc-s2", lineId: "6100", author: "owner", authorRole: "Owner", content: "Phase it — book 50% for Q2, full from Q3. Safer for cash flow.", createdAt: _daysAgo(2), edited: false, editedAt: null },
  ];
  _BUDGET_COMMENTS_DB["6300"] = [
    { id: "bc-s3", lineId: "6300", author: "cfo", authorRole: "CFO", content: "Marketing is already 23% over budget YTD. Consider pulling Q2 allocation down by 15%.", createdAt: _daysAgo(1), edited: false, editedAt: null },
  ];
  _budgetCommentSeq = 10;
})();

// ─────────────────────────────────────────────────────────────────────────────
// Month-End Close 20D-5 extensions
// ─────────────────────────────────────────────────────────────────────────────

const _CLOSE_CHECK_NOTES_DB = {};
const _CLOSE_CHECK_ATTACHMENTS_DB = {};
const _CLOSE_CHECK_OVERRIDES_DB = {};

export async function getCloseSummary(periodKey) {
  await delay();
  const status = await getCloseStatusDetail(periodKey);
  const tasks = await getMonthEndCloseTasks();
  return _brandObj({
    period: periodKey || "March 2026", status: status?.status || "in_progress",
    closedAt: status?.status === "approved" ? _daysAgo(0) : null, closedBy: status?.status === "approved" ? "owner" : null,
    checks: (tasks?.tasks || []).map((t) => ({ id: t.id, name: t.name, status: t.status, completedAt: t.completedAt, assignee: t.assignee })),
    forcedItems: Object.entries(_CLOSE_CHECK_OVERRIDES_DB).map(([k, v]) => ({ checkId: k, reason: v.reason, overriddenBy: v.user, overriddenAt: v.timestamp })),
    auditHash: `h:${Math.random().toString(36).slice(2, 10)}`,
  });
}

export async function exportClosePackage(periodKey, _format = "csv") {
  await delay();
  const summary = await getCloseSummary(periodKey);
  const header = ["Check", "Status", "Assignee", "Completed", "Override"];
  const rows = [header, ...summary.checks.map((c) => [c.name, c.status, c.assignee?.name || "", c.completedAt || "", _CLOSE_CHECK_OVERRIDES_DB[c.id] ? `Override: ${_CLOSE_CHECK_OVERRIDES_DB[c.id].reason}` : ""])];
  const csvText = rows.map((r) => r.map((c) => String(c).includes(",") ? `"${c}"` : c).join(",")).join("\n");
  return _brandObj({ filename: `close_package_${(periodKey || "march_2026").replace(/\s+/g, "_")}.csv`, csvText, rowCount: rows.length - 1 });
}

export async function reopenPeriodClose(periodKey, reason, user = "cfo") {
  await delay();
  const status = await getCloseStatusDetail(periodKey);
  if (!status) return { error: "Period not found" };
  if (status.status === "in_progress" || status.status === "not_started") return { error: "Period is not closed" };
  if (status.status === "approved" && user !== "owner") {
    const taskId = `TSK-REOPEN-${Math.floor(Math.random() * 10000)}`;
    TASKBOX_DB.unshift({
      id: taskId, type: "request-approval",
      title: `Period re-open request: ${periodKey || "March 2026"}`,
      body: `CFO has requested to re-open the ${periodKey || "March 2026"} close. Reason: ${reason}`,
      from: user, to: "owner", status: "open", priority: "high",
      createdAt: new Date().toISOString(), unread: true,
      linkedItem: { type: "period_reopen", periodKey: periodKey || "March 2026", reason },
      attachments: [],
    });
    return _brandObj({ requiresApproval: true, taskId });
  }
  const fy = await getFiscalYearConfig();
  const p = fy.periods.find((x) => x.month === (periodKey || "Mar 2026"));
  if (p) { p.status = "open"; p.reopenedAt = new Date().toISOString(); p.reopenedBy = user; p.reopenReason = reason; }
  return _brandObj({ success: true, status: "open" });
}

export async function approvePeriodReopen(periodKey, approvedBy = "owner") {
  await delay();
  const fy = await getFiscalYearConfig();
  const p = fy.periods.find((x) => x.month === (periodKey || "Mar 2026"));
  if (p) { p.status = "open"; p.reopenedAt = new Date().toISOString(); p.reopenedBy = approvedBy; }
  return _brandObj({ success: true, status: "open" });
}

export async function rejectPeriodReopen(periodKey, rejectedBy = "owner", reason = "") {
  await delay();
  return _brandObj({ success: true, rejected: true, reason });
}

export async function recalculateCloseChecks(periodKey) {
  await delay();
  const tasks = await getMonthEndCloseTasks();
  return _brandObj({
    period: periodKey || "March 2026",
    checks: (tasks?.tasks || []).map((t) => ({ id: t.id, name: t.name, status: _CLOSE_CHECK_OVERRIDES_DB[t.id] ? "complete" : t.status, overridden: !!_CLOSE_CHECK_OVERRIDES_DB[t.id], overrideReason: _CLOSE_CHECK_OVERRIDES_DB[t.id]?.reason || null, assignee: t.assignee, completedAt: t.completedAt })),
    refreshedAt: new Date().toISOString(),
  });
}

export async function overrideCloseCheck(_periodKey, checkId, reason, user = "cfo") {
  await delay();
  _CLOSE_CHECK_OVERRIDES_DB[checkId] = { reason, user, timestamp: new Date().toISOString() };
  return _brandObj({ success: true, checkId, overridden: true });
}

export async function addCloseCheckNote(_periodKey, checkId, note, user = "cfo") {
  await delay();
  if (!_CLOSE_CHECK_NOTES_DB[checkId]) _CLOSE_CHECK_NOTES_DB[checkId] = [];
  _CLOSE_CHECK_NOTES_DB[checkId].push({ id: `ccn-${Date.now()}`, checkId, note, user, createdAt: new Date().toISOString() });
  return _brandObj({ success: true });
}

export async function getCloseCheckNotes(_periodKey, checkId) {
  await delay();
  return _brandObj(_CLOSE_CHECK_NOTES_DB[checkId] ? [..._CLOSE_CHECK_NOTES_DB[checkId]] : []);
}

export async function attachCloseCheckFile(_periodKey, checkId, file, user = "cfo") {
  await delay();
  if (!_CLOSE_CHECK_ATTACHMENTS_DB[checkId]) _CLOSE_CHECK_ATTACHMENTS_DB[checkId] = [];
  const att = { id: `cca-${Date.now()}`, checkId, name: file.name, size: file.size, type: file.type, dataUrl: file.dataUrl || "", uploadedBy: user, uploadedAt: new Date().toISOString() };
  _CLOSE_CHECK_ATTACHMENTS_DB[checkId].push(att);
  return _brandObj({ ...att });
}

export async function getCloseCheckAttachments(_periodKey, checkId) {
  await delay();
  return _brandObj(_CLOSE_CHECK_ATTACHMENTS_DB[checkId] ? [..._CLOSE_CHECK_ATTACHMENTS_DB[checkId]] : []);
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit Bridge 20D-6
// ─────────────────────────────────────────────────────────────────────────────

const _AUDIT_ENGAGEMENTS_DB = {};
const _AUDIT_CLARIFICATIONS_DB = {};
let _engSeq = 1;
let _clarSeq = 1;

const AUDIT_CHECKS_SEED = [
  { id: "CHK-01", name: "Trial balance balances", trustClass: "A", passResult: "Balanced. Total debits: 450,000.000 KWD = Total credits: 450,000.000 KWD", failResult: "Out of balance by 12.500 KWD", passExplanation: "The trial balance is perfectly balanced — all debits equal all credits for the period.", failExplanation: "The trial balance is out of balance. Check for unposted journal entries or rounding errors." },
  { id: "CHK-02", name: "All JEs posted (no drafts)", trustClass: "A", passResult: "All 142 journal entries posted", failResult: "3 draft JEs remain unposted", passExplanation: "Every journal entry in the period has been posted. No drafts remain.", failExplanation: "There are draft journal entries that haven't been posted yet. Review and post or discard them." },
  { id: "CHK-03", name: "Source documents attached", trustClass: "A", passResult: "100% source document coverage", failResult: "8 JEs missing source documents", passExplanation: "All journal entries have at least one supporting source document attached.", failExplanation: "Some journal entries are missing source documents. Attach receipts, invoices, or contracts." },
  { id: "CHK-04", name: "No orphaned accounts", trustClass: "A", passResult: "All 42 accounts have activity or are system accounts", failResult: "2 accounts with zero activity and no system flag", passExplanation: "Every account in the chart of accounts is either active or properly flagged.", failExplanation: "There are inactive accounts that should be archived or flagged." },
  { id: "CHK-05", name: "Period is locked", trustClass: "A", passResult: "March 2026 hard-closed on Apr 3", failResult: "Period still open — not yet locked", passExplanation: "The period has been hard-closed, preventing any further modifications.", failExplanation: "The period is still open. Complete the month-end close process before audit." },
  { id: "CHK-06", name: "Bank reconciliations complete", trustClass: "B", passResult: "4 of 4 bank accounts reconciled", failResult: "1 of 4 accounts unreconciled (KIB Settlement)", passExplanation: "All bank accounts have been reconciled for the period with zero exceptions.", failExplanation: "One or more bank accounts have not been fully reconciled." },
  { id: "CHK-07", name: "AR aging ties to balance sheet", trustClass: "B", passResult: "AR balance 120,006 KWD matches BS line", failResult: "AR aging total differs from BS by 1,200 KWD", passExplanation: "The accounts receivable aging report total matches the balance sheet AR line exactly.", failExplanation: "There is a discrepancy between the AR aging and the balance sheet." },
  { id: "CHK-08", name: "AP aging ties to balance sheet", trustClass: "B", passResult: "AP balance 87,450 KWD matches BS line", failResult: "AP aging differs from BS", passExplanation: "The accounts payable aging matches the balance sheet AP line.", failExplanation: "There is a discrepancy in accounts payable." },
  { id: "CHK-09", name: "Revenue cutoff verified", trustClass: "B", passResult: "No revenue recognized after period end", failResult: "2 invoices dated after cutoff included", passExplanation: "All revenue in the period was earned before the cutoff date.", failExplanation: "Some revenue appears to have been recognized after the period end." },
  { id: "CHK-10", name: "Expense accruals posted", trustClass: "B", passResult: "All 6 standard accruals posted", failResult: "Payroll accrual missing", passExplanation: "All standard expense accruals (payroll, rent, utilities, etc.) have been posted.", failExplanation: "One or more standard accruals are missing." },
  { id: "CHK-11", name: "Inventory count verified", trustClass: "B", passResult: "N/A — service company", failResult: "N/A", passExplanation: "This check is not applicable for service companies without inventory.", failExplanation: "N/A" },
  { id: "CHK-12", name: "PIFSS contributions reconciled", trustClass: "C", passResult: "PIFSS contributions match payroll at 11.5%", failResult: "PIFSS shortfall of 450 KWD", passExplanation: "Social security contributions (PIFSS) are correctly calculated and reconciled to payroll.", failExplanation: "PIFSS contributions don't match the expected percentage of payroll." },
  { id: "CHK-13", name: "Zakat accrual calculated", trustClass: "C", passResult: "N/A — Kuwaiti company exempt", failResult: "N/A", passExplanation: "Kuwaiti companies are exempt from Zakat. This check is not applicable.", failExplanation: "N/A" },
  { id: "CHK-14", name: "FX revaluation posted", trustClass: "C", passResult: "USD account revalued at 0.3070 KWD/USD", failResult: "USD account not revalued", passExplanation: "Foreign currency accounts have been revalued at the period-end exchange rate.", failExplanation: "Foreign currency balances have not been revalued at the closing rate." },
  { id: "CHK-15", name: "Related party disclosures", trustClass: "C", passResult: "No related party transactions identified", failResult: "2 related party transactions undisclosed", passExplanation: "No related party transactions were identified in the period.", failExplanation: "Related party transactions exist but have not been disclosed." },
];

function _seedAuditEngagements() {
  const tenants = ["almanara", "almawred", "demo-corporate"];
  const firms = ["Al-Aiban & Partners", "KPMG Al-Osaimi", "EY Kuwait"];
  const auditors = ["Ahmad Al-Aiban", "Fatima Al-Osaimi", "Khalid Al-Rashidi"];
  for (const tid of tenants) {
    const fi = tenants.indexOf(tid);
    // Active engagement
    const activeId = `eng-${tid}-active`;
    const activeChecks = AUDIT_CHECKS_SEED.map((c, i) => ({
      ...c,
      status: c.id === "CHK-05" ? "fail" : c.id === "CHK-11" || c.id === "CHK-13" ? "not_applicable" : c.id === "CHK-06" ? "fail" : "pass",
      result: (c.id === "CHK-05" || c.id === "CHK-06") ? c.failResult : c.id === "CHK-11" || c.id === "CHK-13" ? c.passResult : c.passResult,
      explanation: (c.id === "CHK-05" || c.id === "CHK-06") ? c.failExplanation : c.passExplanation,
      failReason: (c.id === "CHK-05") ? "Period still open" : c.id === "CHK-06" ? "KIB Settlement unreconciled" : null,
      lastRunAt: _daysAgo(1),
      clarificationId: c.id === "CHK-06" ? `clar-${tid}-1` : null,
    }));
    _AUDIT_ENGAGEMENTS_DB[activeId] = {
      id: activeId, tenantId: tid, auditorFirm: firms[fi], auditorFirmLicense: `MOC-${2024 + fi}-${String(1000 + fi * 100)}`,
      leadAuditor: auditors[fi], leadAuditorEmail: `${auditors[fi].toLowerCase().replace(/\s+/g, ".")}@${firms[fi].toLowerCase().replace(/\s+/g, "")}.com`,
      fiscalPeriod: "2025", status: "active", createdAt: _daysAgo(30), snapshotId: `snap-${tid}-2025`,
      snapshotFrozenAt: _daysAgo(14), completedAt: null, engagementType: "annual_audit",
      checks: activeChecks,
      checksSummary: { total: 15, passing: activeChecks.filter(c => c.status === "pass").length, failing: activeChecks.filter(c => c.status === "fail").length, pending: 0, notApplicable: activeChecks.filter(c => c.status === "not_applicable").length },
      clarificationsSummary: { open: 1, resolved: 1 },
      fees: { amount: 12500, currency: "KWD", paid: false },
      auditTrail: [
        { id: "at-1", timestamp: _daysAgo(30), actor: "CFO", actorRole: "cfo", action: "created_engagement", target: activeId, targetType: "engagement", digestHash: `sha256:${btoa(tid + "create").slice(0, 16)}` },
        { id: "at-2", timestamp: _daysAgo(14), actor: "CFO", actorRole: "cfo", action: "froze_snapshot", target: `snap-${tid}-2025`, targetType: "snapshot", digestHash: `sha256:${btoa(tid + "freeze").slice(0, 16)}` },
        { id: "at-3", timestamp: _daysAgo(7), actor: "System", actorRole: "system", action: "ran_all_checks", target: activeId, targetType: "engagement", digestHash: `sha256:${btoa(tid + "checks").slice(0, 16)}` },
        { id: "at-4", timestamp: _daysAgo(3), actor: auditors[fi], actorRole: "auditor", action: "raised_clarification", target: `clar-${tid}-1`, targetType: "clarification", digestHash: `sha256:${btoa(tid + "clar1").slice(0, 16)}` },
        { id: "at-5", timestamp: _daysAgo(1), actor: "CFO", actorRole: "cfo", action: "responded_clarification", target: `clar-${tid}-1`, targetType: "clarification", digestHash: `sha256:${btoa(tid + "resp1").slice(0, 16)}` },
      ],
    };
    // Seed clarifications for active
    _AUDIT_CLARIFICATIONS_DB[`clar-${tid}-1`] = {
      id: `clar-${tid}-1`, engagementId: activeId, raisedBy: "auditor", raisedByName: auditors[fi], raisedAt: _daysAgo(3),
      subject: "KIB Settlement reconciliation incomplete", context: { type: "check", refId: "CHK-06" }, status: "open",
      messages: [
        { author: auditors[fi], role: "auditor", content: "CHK-06 shows KIB Settlement is not fully reconciled. Can you provide the status and expected completion date?", attachments: [], createdAt: _daysAgo(3) },
        { author: "CFO", role: "cfo", content: "Sara is working on the remaining 3 items. Expected completion by April 5.", attachments: [], createdAt: _daysAgo(1) },
      ],
      resolution: null, resolvedAt: null,
    };
    _AUDIT_CLARIFICATIONS_DB[`clar-${tid}-2`] = {
      id: `clar-${tid}-2`, engagementId: activeId, raisedBy: "auditor", raisedByName: auditors[fi], raisedAt: _daysAgo(10),
      subject: "Marketing expense variance explanation", context: { type: "account", refId: "6300" }, status: "resolved",
      messages: [
        { author: auditors[fi], role: "auditor", content: "Marketing expenses are 23% over budget. Please explain.", attachments: [], createdAt: _daysAgo(10) },
        { author: "CFO", role: "cfo", content: "GITEX Q2 tradeshow costs were front-loaded. Expected to normalize in Q3.", attachments: [], createdAt: _daysAgo(8) },
      ],
      resolution: "Accepted — seasonal variance", resolvedAt: _daysAgo(7),
    };
    // Completed engagement
    _AUDIT_ENGAGEMENTS_DB[`eng-${tid}-completed`] = {
      id: `eng-${tid}-completed`, tenantId: tid, auditorFirm: firms[fi], auditorFirmLicense: `MOC-${2023 + fi}-${900 + fi * 100}`,
      leadAuditor: auditors[fi], leadAuditorEmail: `${auditors[fi].toLowerCase().replace(/\s+/g, ".")}@firm.com`,
      fiscalPeriod: "2024", status: "completed", createdAt: _daysAgo(120), snapshotId: `snap-${tid}-2024`,
      snapshotFrozenAt: _daysAgo(100), completedAt: _daysAgo(60), engagementType: "annual_audit",
      checks: AUDIT_CHECKS_SEED.map(c => ({ ...c, status: c.id === "CHK-11" || c.id === "CHK-13" ? "not_applicable" : "pass", result: c.passResult, explanation: c.passExplanation, failReason: null, lastRunAt: _daysAgo(65), clarificationId: null })),
      checksSummary: { total: 15, passing: 13, failing: 0, pending: 0, notApplicable: 2 },
      clarificationsSummary: { open: 0, resolved: 3 },
      fees: { amount: 11000, currency: "KWD", paid: true },
      auditTrail: [{ id: "at-h1", timestamp: _daysAgo(120), actor: "CFO", actorRole: "cfo", action: "created_engagement", target: `eng-${tid}-completed`, targetType: "engagement", digestHash: "sha256:completed1234" }],
    };
    // Draft engagement
    _AUDIT_ENGAGEMENTS_DB[`eng-${tid}-draft`] = {
      id: `eng-${tid}-draft`, tenantId: tid, auditorFirm: firms[fi], auditorFirmLicense: "",
      leadAuditor: "", leadAuditorEmail: "", fiscalPeriod: "2026-Q1", status: "draft",
      createdAt: _daysAgo(2), snapshotId: null, snapshotFrozenAt: null, completedAt: null,
      engagementType: "quarterly_review",
      checks: [], checksSummary: { total: 0, passing: 0, failing: 0, pending: 0, notApplicable: 0 },
      clarificationsSummary: { open: 0, resolved: 0 },
      fees: { amount: 5000, currency: "KWD", paid: false },
      auditTrail: [{ id: "at-d1", timestamp: _daysAgo(2), actor: "CFO", actorRole: "cfo", action: "created_engagement", target: `eng-${tid}-draft`, targetType: "engagement", digestHash: "sha256:draft5678" }],
    };
  }
}
_seedAuditEngagements();

export async function listAuditEngagements() {
  await delay();
  const list = Object.values(_AUDIT_ENGAGEMENTS_DB).filter(e => e.tenantId === _currentTenantId);
  return _brandObj(list.map(e => ({ ...e, checks: undefined, auditTrail: undefined })));
}

export async function getAuditEngagement(engagementId) {
  await delay();
  const e = _AUDIT_ENGAGEMENTS_DB[engagementId];
  return e ? _brandObj({ ...e }) : null;
}

export async function createAuditEngagement(data) {
  await delay();
  const id = `eng-${_currentTenantId}-${_engSeq++}`;
  const e = { id, tenantId: _currentTenantId, auditorFirm: data.auditorFirm || "", auditorFirmLicense: "", leadAuditor: data.leadAuditor || "", leadAuditorEmail: data.leadAuditorEmail || "", fiscalPeriod: data.fiscalPeriod || "", status: "draft", createdAt: new Date().toISOString(), snapshotId: null, snapshotFrozenAt: null, completedAt: null, engagementType: data.engagementType || "annual_audit", checks: [], checksSummary: { total: 0, passing: 0, failing: 0, pending: 0, notApplicable: 0 }, clarificationsSummary: { open: 0, resolved: 0 }, fees: { amount: 0, currency: "KWD", paid: false }, auditTrail: [{ id: `at-new-${Date.now()}`, timestamp: new Date().toISOString(), actor: "CFO", actorRole: "cfo", action: "created_engagement", target: id, targetType: "engagement", digestHash: `sha256:${btoa(id).slice(0, 16)}` }] };
  _AUDIT_ENGAGEMENTS_DB[id] = e;
  return _brandObj({ ...e });
}

export async function createSnapshot(engagementId) {
  await delay();
  const e = _AUDIT_ENGAGEMENTS_DB[engagementId];
  if (!e) return null;
  e.snapshotId = `snap-${e.tenantId}-${Date.now()}`;
  e.snapshotFrozenAt = new Date().toISOString();
  e.status = "active";
  e.checks = AUDIT_CHECKS_SEED.map(c => ({ ...c, status: "pending", result: "Pending first run", explanation: "Check has not been run yet.", failReason: null, lastRunAt: null, clarificationId: null }));
  e.checksSummary = { total: 15, passing: 0, failing: 0, pending: 15, notApplicable: 0 };
  e.auditTrail.push({ id: `at-snap-${Date.now()}`, timestamp: new Date().toISOString(), actor: "CFO", actorRole: "cfo", action: "froze_snapshot", target: e.snapshotId, targetType: "snapshot", digestHash: `sha256:${btoa(e.snapshotId).slice(0, 16)}` });
  return _brandObj({ ...e });
}

export async function runAuditCheck(engagementId, checkId) {
  await delay();
  const e = _AUDIT_ENGAGEMENTS_DB[engagementId];
  if (!e) return null;
  const c = e.checks.find(x => x.id === checkId);
  if (!c) return null;
  const seed = AUDIT_CHECKS_SEED.find(s => s.id === checkId);
  const shouldFail = checkId === "CHK-05" || checkId === "CHK-06";
  c.status = (checkId === "CHK-11" || checkId === "CHK-13") ? "not_applicable" : shouldFail ? "fail" : "pass";
  c.result = shouldFail ? seed.failResult : seed.passResult;
  c.explanation = shouldFail ? seed.failExplanation : seed.passExplanation;
  c.failReason = shouldFail ? c.result : null;
  c.lastRunAt = new Date().toISOString();
  e.checksSummary = { total: e.checks.length, passing: e.checks.filter(x => x.status === "pass").length, failing: e.checks.filter(x => x.status === "fail").length, pending: e.checks.filter(x => x.status === "pending").length, notApplicable: e.checks.filter(x => x.status === "not_applicable").length };
  return _brandObj({ ...c });
}

export async function runAllAuditChecks(engagementId) {
  await delay();
  const e = _AUDIT_ENGAGEMENTS_DB[engagementId];
  if (!e) return null;
  for (const c of e.checks) { await runAuditCheck(engagementId, c.id); }
  return _brandObj({ ...e.checksSummary });
}

export async function generateAuditPackage(engagementId) {
  await delay();
  const e = _AUDIT_ENGAGEMENTS_DB[engagementId];
  if (!e || !e.snapshotId) return null;
  const manifest = {
    packageId: `pkg-${Date.now()}`, engagementId, snapshotId: e.snapshotId, generatedAt: new Date().toISOString(),
    files: [
      { name: "trial_balance.xlsx", sha256: `sha256:${btoa("tb" + e.snapshotId).slice(0, 32)}` },
      { name: "balance_sheet.xlsx", sha256: `sha256:${btoa("bs" + e.snapshotId).slice(0, 32)}` },
      { name: "income_statement.xlsx", sha256: `sha256:${btoa("is" + e.snapshotId).slice(0, 32)}` },
      { name: "journal_register.xlsx", sha256: `sha256:${btoa("jr" + e.snapshotId).slice(0, 32)}` },
      { name: "check_summary.xlsx", sha256: `sha256:${btoa("cs" + e.snapshotId).slice(0, 32)}` },
      { name: "clarification_summary.xlsx", sha256: `sha256:${btoa("cl" + e.snapshotId).slice(0, 32)}` },
      { name: "financial_statements.xhtml", sha256: `sha256:${btoa("ix" + e.snapshotId).slice(0, 32)}`, type: "iXBRL" },
      { name: "snapshot_certificate.pdf", sha256: `sha256:${btoa("cert" + e.snapshotId).slice(0, 32)}` },
    ],
    sha256: `sha256:${btoa("manifest" + engagementId + Date.now()).slice(0, 48)}`,
  };
  const filename = `audit_package_${e.tenantId}_${e.fiscalPeriod}.json`;
  const csvText = JSON.stringify(manifest, null, 2);
  return _brandObj({ ...manifest, filename, csvText });
}

export async function listClarifications(engagementId) {
  await delay();
  return _brandObj(Object.values(_AUDIT_CLARIFICATIONS_DB).filter(c => c.engagementId === engagementId));
}

export async function getClarification(clarificationId) {
  await delay();
  return _brandObj(_AUDIT_CLARIFICATIONS_DB[clarificationId] ? { ..._AUDIT_CLARIFICATIONS_DB[clarificationId] } : null);
}

export async function createClarification(engagementId, data) {
  await delay();
  const id = `clar-${_currentTenantId}-${_clarSeq++}`;
  const c = { id, engagementId, raisedBy: data.raisedBy || "cfo", raisedByName: data.raisedByName || "CFO", raisedAt: new Date().toISOString(), subject: data.subject, context: data.context || { type: "general", refId: null }, status: "open", messages: [{ author: data.raisedByName || "CFO", role: data.raisedBy || "cfo", content: data.message, attachments: [], createdAt: new Date().toISOString() }], resolution: null, resolvedAt: null };
  _AUDIT_CLARIFICATIONS_DB[id] = c;
  return _brandObj({ ...c });
}

export async function addClarificationMessage(clarificationId, message) {
  await delay();
  const c = _AUDIT_CLARIFICATIONS_DB[clarificationId];
  if (!c) return null;
  c.messages.push({ author: message.author || "CFO", role: message.role || "cfo", content: message.content, attachments: message.attachments || [], createdAt: new Date().toISOString() });
  return _brandObj({ ...c });
}

export async function resolveClarification(clarificationId, resolution, user = "cfo") {
  await delay();
  const c = _AUDIT_CLARIFICATIONS_DB[clarificationId];
  if (!c) return null;
  c.status = "resolved";
  c.resolution = resolution;
  c.resolvedAt = new Date().toISOString();
  return _brandObj({ ...c });
}

// ─────────────────────────────────────────────────────────────────────────────
// Team 20D-6 extensions
// ─────────────────────────────────────────────────────────────────────────────

export async function addTeamMember(data) {
  await delay();
  const id = data.id || `user-${Date.now()}`;
  const member = { id, name: data.name, email: data.email, role: data.role || "junior", initials: (data.name || "").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2), status: "invited", joinedAt: new Date().toISOString(), lastActiveAt: null };
  TASKBOX_PEOPLE[id] = member;
  return _brandObj({ ...member });
}

export async function removeTeamMember(memberId) {
  await delay();
  if (TASKBOX_PEOPLE[memberId]?.role === "owner") return { success: false, error: "Cannot remove Owner" };
  delete TASKBOX_PEOPLE[memberId];
  return { success: true };
}

export async function updateTeamMemberRole(memberId, newRole) {
  await delay();
  const m = TASKBOX_PEOPLE[memberId];
  if (!m) return null;
  m.role = newRole;
  return _brandObj({ ...m });
}

export async function getTeamActivityLog(memberId, limit = 20) {
  await delay();
  return _brandObj([
    { id: "ta-1", memberId, action: "login", timestamp: _hoursAgo(2), detail: "Logged in" },
    { id: "ta-2", memberId, action: "view_reconciliation", timestamp: _hoursAgo(3), detail: "Viewed KIB Operating reconciliation" },
    { id: "ta-3", memberId, action: "post_je", timestamp: _daysAgo(1), detail: "Posted JE-0417" },
    { id: "ta-4", memberId, action: "complete_task", timestamp: _daysAgo(1), detail: "Completed task TSK-113" },
    { id: "ta-5", memberId, action: "login", timestamp: _daysAgo(2), detail: "Logged in" },
  ].slice(0, limit));
}

// ─── Soft-close JE post approval (20F) ─────────────────────────
export async function approveSoftClosePost(jeId, approvedBy = "owner") {
  await delay();
  const j = _MANUAL_JES_DB[jeId];
  if (!j) return null;
  j.status = "posted";
  j.postedAt = new Date().toISOString();
  j.postedBy = approvedBy;
  return _brandObj({ ...j, lines: j.lines.map((l) => ({ ...l })) });
}

export async function rejectSoftClosePost(jeId, rejectedBy = "owner", reason = "") {
  await delay();
  const j = _MANUAL_JES_DB[jeId];
  if (!j) return null;
  j.status = "draft";
  j.rejectionReason = reason;
  j.rejectedBy = rejectedBy;
  j.rejectedAt = new Date().toISOString();
  return _brandObj({ ...j });
}

// ──────────────────────────────────────────────────────────────────────
// FN-226 (Phase 4 Wave 1 Item 2) — Data Inalterability composite MOCK.
//
// Returns a canned INALTERABLE response. All three component shapes
// (auditChain / reportVersions / migrationChain) are populated so the
// AuditBridgeScreen's InalterabilityPanel renders end-to-end in MOCK
// mode without a backend. No state, no persistence — pure read.
//
// Roles: real endpoint is OWNER + AUDITOR only (backend-enforced).
// The MOCK mode does not simulate role denial; the UI's 403 branch is
// reachable only against the real API.
// ──────────────────────────────────────────────────────────────────────
export async function getDataInalterabilityReport() {
  await delay();
  return {
    generatedAt: new Date().toISOString(),
    overall: "INALTERABLE",
    rationale:
      "Audit chain verified (1,284 entries). 42 report versions on record, 12 current. Migration chain intact across 87 links.",
    auditChain: {
      fullValid: true,
      financialValid: true,
      entriesCount: 1284,
      brokenAtSequence: null,
      lastFullHash:
        "a7f3c9b2e4d8f1a6c5b9e2f7d3a8c1b4e6f9d2a5c8b1e4f7d9a3c6b5e8f2d1a4",
      lastFinancialHash:
        "c9e2f5a8d1b4c7e0f3a6d9c2e5b8f1a4d7c0e3b6f9d2a5c8e1b4f7d0a3c6e9b2",
    },
    reportVersions: {
      totalCount: 42,
      currentCount: 12,
      lastPublishedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      byType: {
        PROFIT_AND_LOSS: 14,
        BALANCE_SHEET: 14,
        CASH_FLOW_STATEMENT: 8,
        TRIAL_BALANCE: 6,
      },
    },
    migrationChain: {
      linkCount: 87,
      gapCount: 0,
      firstGapMigrationName: null,
      lastMigrationName: "20260418_add_data_inalterability_index",
      lastAppliedAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
      lastSchemaHashAfter:
        "d4f7a1c8b3e6f9d2a5c8b1e4f7d0a3c6e9b2f5d8a1c4b7e0f3d6a9c2b5e8f1d4",
    },
  };
}

// ──────────────────────────────────────────────────────────────────────
// FN-227 (Phase 4 Wave 1 Item 3) — Monthly Close Checklist MOCK.
//
// Module-scoped in-memory stores so create/update/list/mark/sign-off/
// reopen all round-trip end-to-end in MOCK mode without a backend. The
// UI flows (ChecklistTemplateEditor, ChecklistInstancePanel, SignOffModal)
// exercise every mutation on the same store so demo flows behave
// identically to LIVE mode shape-wise.
//
// Role enforcement is NOT simulated in MOCK (no session user); the real
// backend 403 branches are only reachable against the live API. The UI
// additionally disables controls client-side based on the `role` prop
// that drives MonthEndCloseScreen, which is enough for mock-mode demo.
// ──────────────────────────────────────────────────────────────────────

let _mccTemplateCounter = 0;
let _mccInstanceCounter = 0;
let _mccItemCounter = 0;

const _mccTemplates = [
  {
    id: "mcc-tpl-seed-1",
    tenantId: "mock-tenant",
    label: "Reconcile all bank accounts",
    description: "Ensure every bank account is reconciled through month end.",
    sortOrder: 10,
    completeRoleGate: "ACCOUNTANT",
    isActive: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
  },
  {
    id: "mcc-tpl-seed-2",
    tenantId: "mock-tenant",
    label: "Review outstanding receivables",
    description: "Review AR aging and chase overdue balances.",
    sortOrder: 20,
    completeRoleGate: "OWNER_OR_ACCOUNTANT",
    isActive: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
  },
  {
    id: "mcc-tpl-seed-3",
    tenantId: "mock-tenant",
    label: "Post depreciation entries",
    description: null,
    sortOrder: 30,
    completeRoleGate: "ACCOUNTANT",
    isActive: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
  },
  {
    id: "mcc-tpl-seed-4",
    tenantId: "mock-tenant",
    label: "Review and approve close package",
    description: "Owner sign-off for the monthly close.",
    sortOrder: 40,
    completeRoleGate: "OWNER",
    isActive: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
  },
];

const _mccInstances = [];

// MOCK "current user". Real mode reads from the JWT; MOCK uses a fixed
// label so the SoD check can still be simulated client-side.
const MCC_MOCK_USER_ID = "mock-owner";
const MCC_MOCK_USER_NAME = "Mock Owner";
const MCC_MOCK_ACCOUNTANT_ID = "mock-accountant";
const MCC_MOCK_ACCOUNTANT_NAME = "Mock Accountant";

function _mccNextTemplateId() {
  _mccTemplateCounter += 1;
  return `mcc-tpl-${Date.now()}-${_mccTemplateCounter}`;
}
function _mccNextInstanceId() {
  _mccInstanceCounter += 1;
  return `mcc-inst-${Date.now()}-${_mccInstanceCounter}`;
}
function _mccNextItemId() {
  _mccItemCounter += 1;
  return `mcc-item-${Date.now()}-${_mccItemCounter}`;
}

function _mccSortedTemplates(activeOnly) {
  let list = [..._mccTemplates];
  if (activeOnly) list = list.filter((t) => t.isActive);
  list.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
  return list;
}

function _mccHydrateInstance(instance) {
  return {
    ...instance,
    items: (instance.items || []).map((i) => ({ ...i })),
  };
}

function _mccRecomputeInstanceStatus(instance) {
  // Do not auto-advance past terminal states (SIGNED_OFF / REOPENED) —
  // the lifecycle transitions for those are driven by explicit endpoints.
  if (instance.status === "SIGNED_OFF" || instance.status === "REOPENED") {
    return;
  }
  const items = instance.items || [];
  if (items.length === 0) {
    instance.status = "OPEN";
    return;
  }
  const allCompleted = items.every((i) => i.status === "COMPLETED");
  const anyTouched = items.some(
    (i) => i.status !== "PENDING"
  );
  if (allCompleted) {
    instance.status = "COMPLETED";
  } else if (anyTouched) {
    instance.status = "IN_PROGRESS";
  } else {
    instance.status = "OPEN";
  }
}

export async function createTemplateItem(body = {}) {
  await delay();
  const now = new Date().toISOString();
  const row = {
    id: _mccNextTemplateId(),
    tenantId: "mock-tenant",
    label: body.label || "Untitled",
    description: body.description || null,
    sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 100,
    completeRoleGate: body.completeRoleGate || "OWNER_OR_ACCOUNTANT",
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
  _mccTemplates.push(row);
  return _brandObj({ ...row });
}

export async function updateTemplateItem(id, body = {}) {
  await delay();
  const row = _mccTemplates.find((t) => t.id === id);
  if (!row) return null;
  if (body.label != null) row.label = body.label;
  if (body.description !== undefined) row.description = body.description || null;
  if (body.sortOrder != null) row.sortOrder = body.sortOrder;
  if (body.completeRoleGate) row.completeRoleGate = body.completeRoleGate;
  if (body.isActive != null) row.isActive = !!body.isActive;
  row.updatedAt = new Date().toISOString();
  return _brandObj({ ...row });
}

export async function listTemplateItems(activeOnly) {
  await delay();
  return _brandObj(_mccSortedTemplates(!!activeOnly).map((t) => ({ ...t })));
}

export async function openInstance(body = {}) {
  await delay();
  const fiscalYear = body.fiscalYear;
  const fiscalMonth = body.fiscalMonth;
  if (!fiscalYear || !fiscalMonth) {
    throw new Error("fiscalYear and fiscalMonth are required");
  }
  // Idempotent: return existing open-ish instance if any.
  const existing = _mccInstances.find(
    (i) => i.fiscalYear === fiscalYear && i.fiscalMonth === fiscalMonth
  );
  if (existing) return _brandObj(_mccHydrateInstance(existing));
  const now = new Date().toISOString();
  const templates = _mccSortedTemplates(true);
  const items = templates.map((tpl) => ({
    id: _mccNextItemId(),
    instanceId: "",
    templateItemId: tpl.id,
    label: tpl.label,
    description: tpl.description,
    sortOrder: tpl.sortOrder,
    completeRoleGate: tpl.completeRoleGate,
    status: "PENDING",
    blockedReason: null,
    notes: null,
    completedAt: null,
    completedBy: null,
    completedByName: null,
  }));
  const inst = {
    id: _mccNextInstanceId(),
    tenantId: "mock-tenant",
    fiscalYear,
    fiscalMonth,
    status: "OPEN",
    signedOffAt: null,
    signedOffBy: null,
    signedOffByName: null,
    createdAt: now,
    updatedAt: now,
    items,
  };
  // Back-fill instanceId on items.
  inst.items.forEach((i) => { i.instanceId = inst.id; });
  _mccInstances.push(inst);
  return _brandObj(_mccHydrateInstance(inst));
}

export async function listInstances(filter = {}) {
  await delay();
  let list = _mccInstances.slice();
  if (filter.status) list = list.filter((i) => i.status === filter.status);
  if (filter.fiscalYear != null) list = list.filter((i) => i.fiscalYear === filter.fiscalYear);
  list.sort((a, b) => {
    if (a.fiscalYear !== b.fiscalYear) return b.fiscalYear - a.fiscalYear;
    return b.fiscalMonth - a.fiscalMonth;
  });
  // List response strips items (shape parity with backend GET list).
  return _brandObj(
    list.map((i) => {
      const { items: _items, ...rest } = i;
      return { ...rest };
    })
  );
}

export async function getInstance(id) {
  await delay();
  const inst = _mccInstances.find((i) => i.id === id);
  if (!inst) return null;
  return _brandObj(_mccHydrateInstance(inst));
}

export async function markItemStatus(itemId, body = {}) {
  await delay();
  const inst = _mccInstances.find((i) => (i.items || []).some((it) => it.id === itemId));
  if (!inst) return null;
  const item = inst.items.find((it) => it.id === itemId);
  if (!item) return null;
  const nextStatus = body.status || "PENDING";
  const allowed = new Set(["PENDING", "IN_PROGRESS", "COMPLETED", "BLOCKED"]);
  if (!allowed.has(nextStatus)) {
    throw new Error(`Invalid status: ${nextStatus}`);
  }
  if (nextStatus === "BLOCKED" && !body.blockedReason) {
    throw new Error("blockedReason is required when status=BLOCKED");
  }
  item.status = nextStatus;
  if (body.notes !== undefined) item.notes = body.notes || null;
  if (nextStatus === "BLOCKED") {
    item.blockedReason = body.blockedReason;
  } else {
    item.blockedReason = null;
  }
  if (nextStatus === "COMPLETED") {
    item.completedAt = new Date().toISOString();
    // In MOCK, we mark the completer as the accountant by default for
    // items gated to ACCOUNTANT, else the owner. This keeps the client
    // SoD check meaningful.
    if (item.completeRoleGate === "ACCOUNTANT") {
      item.completedBy = MCC_MOCK_ACCOUNTANT_ID;
      item.completedByName = MCC_MOCK_ACCOUNTANT_NAME;
    } else {
      item.completedBy = MCC_MOCK_USER_ID;
      item.completedByName = MCC_MOCK_USER_NAME;
    }
  } else {
    item.completedAt = null;
    item.completedBy = null;
    item.completedByName = null;
  }
  inst.updatedAt = new Date().toISOString();
  _mccRecomputeInstanceStatus(inst);
  return _brandObj({
    item: { ...item },
    instance: { ..._mccHydrateInstance(inst) },
  });
}

export async function signOffInstance(id) {
  await delay();
  const inst = _mccInstances.find((i) => i.id === id);
  if (!inst) throw new Error("Instance not found");
  if (inst.status !== "COMPLETED") {
    throw new Error("Instance must be COMPLETED before sign-off");
  }
  // SoD: signer must not be any completer.
  const signerId = MCC_MOCK_USER_ID;
  const completers = new Set(
    (inst.items || []).map((i) => i.completedBy).filter(Boolean)
  );
  if (completers.has(signerId)) {
    // Backend returns 4xx with this message; UI surfaces it verbatim.
    throw new Error(
      "Segregation of duties violation: the signer cannot also be a completer of any checklist item."
    );
  }
  inst.status = "SIGNED_OFF";
  inst.signedOffAt = new Date().toISOString();
  inst.signedOffBy = signerId;
  inst.signedOffByName = MCC_MOCK_USER_NAME;
  inst.updatedAt = new Date().toISOString();
  return _brandObj(_mccHydrateInstance(inst));
}

export async function reopenInstance(id) {
  await delay();
  const inst = _mccInstances.find((i) => i.id === id);
  if (!inst) throw new Error("Instance not found");
  if (inst.status !== "SIGNED_OFF" && inst.status !== "COMPLETED") {
    throw new Error(
      "Instance must be SIGNED_OFF or COMPLETED before re-open"
    );
  }
  inst.status = "REOPENED";
  inst.signedOffAt = null;
  inst.signedOffBy = null;
  inst.signedOffByName = null;
  inst.updatedAt = new Date().toISOString();
  return _brandObj(_mccHydrateInstance(inst));
}
