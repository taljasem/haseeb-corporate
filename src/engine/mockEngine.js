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

  return rows.slice(0, limit).map((r) => {
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
  });
}

export async function getMockChatHistory() {
  await delay();
  return [
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
  ];
}

export async function getPendingApprovals() {
  await delay();
  return [
    { id: "ap-1", type: "EXPENSE", description: "Q2 marketing campaign — Avenues",   amount:  4200.0, requestedBy: "Layla (Marketing)", timeAgo: "2h ago" },
    { id: "ap-2", type: "PO",      description: "Office equipment — Sharq HQ",       amount: 12800.0, requestedBy: "Operations",        timeAgo: "5h ago" },
    { id: "ap-3", type: "PAYMENT", description: "Al Shaya Trading — invoice #2847",  amount: 24500.0, requestedBy: "CFO",               timeAgo: "yesterday" },
    { id: "ap-4", type: "JOURNAL", description: "PIFSS accrual — March",             amount:  9500.0, requestedBy: "Sara",              timeAgo: "yesterday" },
  ];
}

export async function getBudgetSummary() {
  await delay();
  return [
    { department: "Operations",   used:  67, status: "good"    },
    { department: "Sales",        used:  78, status: "good"    },
    { department: "Marketing",    used:  91, status: "warning" },
    { department: "Tech & Infra", used:  54, status: "good"    },
    { department: "Admin",        used: 103, status: "over"    },
  ];
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
  return [
    { id: "cn-1", text: "Trial balance off by [2,462.500 KWD] — likely from Boubyan unmatched items" },
    { id: "cn-2", text: "Sara's accuracy this week is [94%], up from [91%] last week" },
    { id: "cn-3", text: "Marketing variance flagged: [+23%] over budget for the third consecutive month" },
    { id: "cn-4", text: "PIFSS accrual draft ready for your review — JE-0415 ([9,500.000 KWD])" },
  ];
}

export async function getTeamActivity() {
  await delay();
  return [
    { id: "ta-1", initials: "S", name: "Sara",  action: "Reconciled KIB Operating and Settlement",          detail: "78 items matched", timeAgo: "2h ago" },
    { id: "ta-2", initials: "N", name: "Noor",  action: "Posted 5 journal entries",        detail: "Manual JEs",       timeAgo: "1h ago" },
    { id: "ta-3", initials: "S", name: "Sara",  action: "Categorized 23 bank transactions", detail: "Auto-confirmed",   timeAgo: "45min ago" },
    { id: "ta-4", initials: "N", name: "Noor",  action: "Drafted PIFSS accrual",           detail: "Awaiting approval", timeAgo: "30min ago" },
    { id: "ta-5", initials: "S", name: "Sara",  action: "Closed 4 reconciliation items",   detail: "Boubyan",          timeAgo: "12min ago" },
  ];
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
  return [
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
  ];
}

export async function getChartOfAccounts() {
  await delay();
  return [
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
  ];
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
  { id: "draft-budget",            label: "Draft Budget",     icon: "TrendingUp",    color: "#3B82F6", direction: "downward" },
  { id: "reconcile-account",       label: "Reconcile",        icon: "CheckCircle",   color: "#00C48C", direction: "downward" },
  { id: "categorize-transactions", label: "Categorize",       icon: "Tag",           color: "#00C48C", direction: "downward" },
  { id: "upload-document",         label: "Upload",           icon: "Upload",        color: "#3B82F6", direction: "downward" },
  { id: "request-report",          label: "Request Report",   icon: "BarChart2",     color: "#3B82F6", direction: "downward" },
  // Upward
  { id: "submit-work",             label: "Submit Work",      icon: "CheckSquare",   color: "#00C48C", direction: "upward" },
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
  switch (filter) {
    case "unread":
      visible = visible.filter((t) => t.unread && t.status !== "completed");
      break;
    case "approvals":
      visible = visible.filter((t) => t.type === "request-approval");
      break;
    case "received":
      visible = visible.filter((t) => t.recipient.id === me);
      break;
    case "sent":
      visible = visible.filter((t) => t.sender.id === me);
      break;
    case "needs-action":
      visible = visible.filter((t) => t.recipient.id === me && t.status !== "completed");
      break;
    case "completed":
      visible = visible.filter((t) => t.status === "completed");
      break;
    default:
      break;
  }
  // Sort: open first by updatedAt desc, completed last
  return visible
    .slice()
    .sort((a, b) => {
      const ac = a.status === "completed" ? 1 : 0;
      const bc = b.status === "completed" ? 1 : 0;
      if (ac !== bc) return ac - bc;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });
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
  return BANK_ACCOUNTS_DB.slice();
}

export async function getBankAccountById(id) {
  await delay();
  return BANK_ACCOUNTS_DB.find((a) => a.id === id) || null;
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
  if (since) {
    return all.filter((t) => new Date(t.date) >= since);
  }
  return all;
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
  return {
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
  };
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

  return {
    period: "March 2026",
    aminahNarration:
      "Revenue grew [+10.5%] month-over-month, driven primarily by Alghanim Industries orders and the Avenues branch. Gross margins held at [50.8%]. Operating expenses ran [+23.4%] with marketing flagged [+23% over budget] for the third consecutive month. Net income of [24,300.000 KWD] is still up [+6.3%] versus prior period and on track to exceed Q1 target.",
    sections: [
      { name: "REVENUE",             lines: revenue, subtotal: { label: "Total Revenue", current: totalRevenueCurrent, prior: totalRevenuePrior } },
      { name: "COST OF GOODS SOLD",  lines: cogs,    subtotal: { label: "Total COGS",    current: totalCogsCurrent,    prior: totalCogsPrior, negative: true } },
      { name: "GROSS PROFIT",        highlight: "teal", current: grossCurrent, prior: grossPrior },
      { name: "OPERATING EXPENSES",  lines: opex,    subtotal: { label: "Total OpEx",    current: totalOpexCurrent,    prior: totalOpexPrior, negative: true } },
      { name: "OPERATING INCOME",    highlight: "amber", current: opIncomeCurrent, prior: opIncomePrior },
      { name: "OTHER INCOME/(EXPENSE)", lines: other, subtotal: { label: "Total Other", current: totalOtherCurrent, prior: totalOtherPrior } },
      { name: "NET INCOME BEFORE TAX", highlight: "teal", current: nibtCurrent, prior: nibtPrior },
      { name: "TAX EXPENSE",         lines: [_line("Corporate tax (Kuwait 0%)", 0, 0)], subtotal: { label: "Total Tax", current: 0, prior: 0, negative: true } },
      { name: "NET INCOME",          highlight: "teal", final: true, current: netIncomeCurrent, prior: netIncomePrior },
    ],
  };
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

  return {
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
  };
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

  return {
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
  };
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
  return {
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
  };
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
  return {
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
  };
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
  return {
    id: "TOP-1",
    text:
      "Marketing spend is [+23% over budget] for the third consecutive month. Three large items this month: campaign A ([4,200.000 KWD]), tradeshow B ([3,100.000 KWD]), agency retainer ([2,800.000 KWD]). Want me to draft a board-level summary?",
    action: "draft-summary",
  };
}
