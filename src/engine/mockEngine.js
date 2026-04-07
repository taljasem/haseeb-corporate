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
