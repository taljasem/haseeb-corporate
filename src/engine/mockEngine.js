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
function _brandObj(obj) {
  if (obj == null) return obj;
  if (_currentTenantId === DEFAULT_TENANT_ID) return obj;
  if (Array.isArray(obj)) return obj.map(_brandObj);
  if (typeof obj === "string") return _brand(obj);
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

export async function getBankTransactionsPending() {
  await delay();
  return _brandObj([
    { id: "bt-1", date: "Apr 7", merchant: "KNPC fuel cards",            amount: -1820.5,  currency: "KWD", source: "KIB Operating", terminal: "POS-2241", engineSuggestion: { account: "Fuel & Vehicle",            accountCode: "6420", confidence: "RULE",    reasoning: "Matched rule: KNPC merchants → Fuel & Vehicle (6420)" } },
    { id: "bt-2", date: "Apr 7", merchant: "Alghanim Industries",        amount: 12450.0,  currency: "KWD", source: "KIB Operating", terminal: "WIRE",     engineSuggestion: { account: "Sales Revenue",            accountCode: "4100", confidence: "PATTERN", reasoning: "Pattern match: customer payments from Alghanim entities" } },
    { id: "bt-3", date: "Apr 7", merchant: "Al Shaya Trading",           amount: 8740.0,   currency: "KWD", source: "KIB Operating", terminal: "WIRE",     engineSuggestion: { account: "Sales Revenue",            accountCode: "4100", confidence: "RULE",    reasoning: "Recurring customer — rule active since Jan 2025" } },
    { id: "bt-4", date: "Apr 6", merchant: "Office rent — Sharq",        amount: -4200.0,  currency: "KWD", source: "KIB Operating", terminal: "STO",      engineSuggestion: { account: "Office Rent",              accountCode: "6200", confidence: "RULE",    reasoning: "Standing order — landlord rule" } },
    { id: "bt-5", date: "Apr 6", merchant: "Zain Kuwait",                amount: -624.75,  currency: "KWD", source: "KIB Operating", terminal: "DD",       engineSuggestion: { account: "Internet & Phone",         accountCode: "6220", confidence: "RULE",    reasoning: "Direct debit — telecom rule" } },
    { id: "bt-6", date: "Apr 5", merchant: "Avenues Mall — booth fee",   amount: -3100.0,  currency: "KWD", source: "KIB Operating", terminal: "POS",      engineSuggestion: { account: "Trade Shows",              accountCode: "6310", confidence: "AI",      reasoning: "AI inferred from memo: 'tradeshow booth Q2'" } },
    { id: "bt-7", date: "Apr 5", merchant: "Boubyan transfer in — unidentified", amount: 2462.5, currency: "KWD", source: "KIB Operating", terminal: "WIRE", engineSuggestion: { account: "",                       accountCode: "",     confidence: "NONE",    reasoning: "No matching customer or rule. Manual review required." } },
    { id: "bt-8", date: "Apr 4", merchant: "Ooredoo fiber",              amount: -135.0,   currency: "KWD", source: "KIB Operating", terminal: "DD",       engineSuggestion: { account: "Internet & Phone",         accountCode: "6220", confidence: "RULE",    reasoning: "Direct debit — telecom rule" } },
    { id: "bt-9", date: "Apr 4", merchant: "Tradeshow vendor — Dubai",   amount: -1240.0,  currency: "KWD", source: "KIB Operating", terminal: "WIRE",     engineSuggestion: { account: "Trade Shows",              accountCode: "6310", confidence: "PATTERN", reasoning: "Pattern: vendor previously coded to Trade Shows" } },
    { id: "bt-10", date: "Apr 3", merchant: "Misc deposit — counter",    amount: 380.0,    currency: "KWD", source: "KIB Operating", terminal: "BRANCH",   engineSuggestion: { account: "",                       accountCode: "",     confidence: "NONE",    reasoning: "No description from bank. Needs manual coding." } },
  ]);
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
  ];
  unmatchedBankItems.push(...unmatchedBank);

  const unmatchedLedger = [
    _mkLedgerEntry("OP-L026", _daysAgo(3), "Talabat payout (JE)", 3750.0, "JE-0411"),
    _mkLedgerEntry("OP-L027", _daysAgo(3), "Alghanim payment (JE)", 12450.0, "JE-0412"),
  ];
  unmatchedLedgerItems.push(...unmatchedLedger);

  // 5 exceptions
  exceptions.push(
    _mkException("EXC-OP-1", "unidentified",           "Boubyan transfer in for 2,462.500 KWD — no matching ledger entry found",      "investigate",     "OP-B026"),
    _mkException("EXC-OP-2", "missing-ledger-entry",   "KIB wire fee 12.500 KWD not yet booked to Bank Charges (6800)",               "create-je",       "OP-B027"),
    _mkException("EXC-OP-3", "missing-ledger-entry",   "KIB monthly service fee 8.000 KWD not yet booked to Bank Charges (6800)",    "create-je",       "OP-B028"),
    _mkException("EXC-OP-4", "amount-mismatch",         "Talabat bank payout 3,800.000 vs JE posted 3,750.000 — commission rounding", "investigate",     "OP-B029", "OP-L026"),
    _mkException("EXC-OP-5", "date-mismatch",           "Alghanim payment — bank shows 3 days ago, JE dated 4 days ago (fuzzy match)", "accept",          "OP-B030", "OP-L027"),
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
    openingBalance,
    closingBalance: closingBankBalance,
    closingLedgerBalance: Number(closingLedgerBalance.toFixed(3)),
    matchedItems,
    unmatchedBankItems,
    unmatchedLedgerItems,
    exceptions,
    totalBankItems: 30,
    totalLedgerItems: 30,
    matchedCount: 25,
    exceptionCount: exceptions.length,
    reconciliationDifference: Number((closingBankBalance - closingLedgerBalance).toFixed(3)),
    activityLog: [
      { id: "ACT-1", timestamp: _daysAgo(5), user: "sara", action: "started",  detail: "Reconciliation started" },
      { id: "ACT-2", timestamp: _daysAgo(5), user: "engine", action: "auto-matched", detail: "24 items matched by engine (Tier 1)" },
      { id: "ACT-3", timestamp: _daysAgo(3), user: "sara", action: "manual-match", detail: "Matched 1 item manually" },
      { id: "ACT-4", timestamp: _daysAgo(2), user: "sara", action: "flagged",  detail: "Flagged 5 exceptions" },
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
    openingBalance: 37000.0,
    closingBalance: 42135.25,
    closingLedgerBalance: 42135.25,
    matchedItems,
    unmatchedBankItems: [],
    unmatchedLedgerItems: [],
    exceptions: [],
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

// ACC-3 KIB Settlement — IN PROGRESS — 18/20 + 2 POS timing exceptions
(function seedSettlementRec() {
  const matchedItems = [];
  for (let i = 1; i <= 18; i++) {
    matchedItems.push(_mkMatch(`MATCH-ST-${i}`, `ST-B${i}`, `ST-L${i}`, "exact"));
  }
  const unmatchedBankItems = [
    _mkBankItem("ST-B019", _daysAgo(2), "POS batch settlement", "POS-3471", 1420.0),
    _mkBankItem("ST-B020", _daysAgo(1), "POS batch settlement", "POS-3472", 1385.0),
  ];
  const unmatchedLedgerItems = [
    _mkLedgerEntry("ST-L019", _daysAgo(3), "POS receipts batch (pre-settlement)", 1420.0, "JE-0401"),
    _mkLedgerEntry("ST-L020", _daysAgo(2), "POS receipts batch (pre-settlement)", 1385.0, "JE-0402"),
  ];
  const exceptions = [
    _mkException("EXC-ST-1", "date-mismatch", "POS settlement timing — bank Mar 6, ledger Mar 5",   "accept", "ST-B019", "ST-L019"),
    _mkException("EXC-ST-2", "date-mismatch", "POS settlement timing — bank Mar 7, ledger Mar 5",   "accept", "ST-B020", "ST-L020"),
  ];
  _RECONS_DB["REC-2026-03-ACC-3"] = {
    id: "REC-2026-03-ACC-3",
    accountId: "ACC-3",
    period: { month: 3, year: 2026, label: "March 2026" },
    status: "in-progress",
    startedAt: _daysAgo(3),
    completedAt: null,
    completedBy: null,
    openingBalance: 15015.75,
    closingBalance: 18420.75,
    closingLedgerBalance: 18420.75,
    matchedItems,
    unmatchedBankItems,
    unmatchedLedgerItems,
    exceptions,
    totalBankItems: 20,
    totalLedgerItems: 20,
    matchedCount: 18,
    exceptionCount: 2,
    reconciliationDifference: 0,
    activityLog: [
      { id: "ACT-S1", timestamp: _daysAgo(3), user: "sara",   action: "started",      detail: "Reconciliation started" },
      { id: "ACT-S2", timestamp: _daysAgo(3), user: "engine", action: "auto-matched", detail: "18 items matched (Tier 1)" },
      { id: "ACT-S3", timestamp: _daysAgo(2), user: "sara",   action: "flagged",      detail: "Flagged 2 POS timing exceptions" },
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
    openingBalance: 5816.5,
    closingBalance: 8240.5,
    closingLedgerBalance: 8240.5,
    matchedItems: [],
    unmatchedBankItems: [],
    unmatchedLedgerItems: [],
    exceptions: [],
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
  return []; // Placeholder — February prior period not seeded in this pass
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

export async function completeReconciliation(reconciliationId, completedBy = "sara") {
  await delay();
  const r = _RECONS_DB[reconciliationId];
  if (!r) return null;
  if (r.reconciliationDifference !== 0) return null;
  if (r.exceptions.some((e) => !e.resolved)) return null;
  r.status = "completed";
  r.completedAt = new Date().toISOString();
  r.completedBy = completedBy;
  _logActivity(r, completedBy, "completed", "Reconciliation completed");
  return _brandObj({ ...r });
}

export async function lockReconciliation(reconciliationId) {
  await delay();
  const r = _RECONS_DB[reconciliationId];
  if (!r || r.status !== "completed") return null;
  r.status = "locked";
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
