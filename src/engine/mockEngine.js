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
    { id: "ta-1", initials: "S", name: "Sara",  action: "Reconciled NBK and KIB",          detail: "78 items matched", timeAgo: "2h ago" },
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
    { code: "1140", name: "NBK Settlement Account",      category: "Assets",             type: "debit"  },
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
    "NBK Settlement":{ name: "NBK Settlement Account", code: "1140" },
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
