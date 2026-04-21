// AMINAH READ-ONLY INVARIANT
// This backend NEVER calls ledger-modifying functions. Every tool in every scenario
// is a read operation. This matches the Managed Agents deployment where Aminah has
// access to read-only MCP tools only. Violating this would break the deterministic
// engine principle established in the Haseeb SME audit.

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

let _callIdSeq = 1;

const SCENARIOS = [
  {
    id: "cash_position",
    keywords: ["cash", "cash position", "how much cash", "cash flow", "liquidity"],
    build: () => [
      { type: "status.update", label: "Checking your accounts...", icon: "wallet" },
      { _delay: 400 },
      { type: "tool.call_started", toolName: "getCashPosition", toolInput: { period: "current_month" } },
      { _delay: 600 },
      { type: "tool.call_completed", result: { total: "229,685.090 KWD", accounts: 4, inflow: "+87,420.000", outflow: "-63,120.000" } },
      { _delay: 200 },
      { type: "message.block_added", block: { type: "text", text: "" } },
      ...textDeltas("Your cash position is **229,685.090 KWD** across 4 KIB accounts. This month you've seen inflows of **+87,420.000** against outflows of **-63,120.000**. Net income tracking at **24,300.000 KWD** — about 8% ahead of your March forecast."),
      { type: "message.complete" },
    ],
  },
  {
    id: "budget_variance",
    keywords: ["budget", "vs budget", "how are we doing", "variance", "over budget", "under budget"],
    build: () => [
      { type: "status.update", label: "Running report...", icon: "chart" },
      { _delay: 500 },
      { type: "tool.call_started", toolName: "getVarianceAnalysis", toolInput: { period: "March 2026", compareWith: "budget" } },
      { _delay: 700 },
      { type: "tool.call_completed", result: { topVariance: "Marketing +23% over budget", netIncome: "24,300 vs 22,800 budget", status: "on track overall" } },
      { _delay: 200 },
      { type: "message.block_added", block: { type: "text", text: "" } },
      ...textDeltas("Overall you're **on track vs budget**. Net income is **24,300 KWD** against a budgeted **22,800 KWD** — 6.6% ahead. The main concern is **Marketing at 110% of YTD allocation** (+23% over). Operations and Tech are running below pace, which partially offsets."),
      { type: "message.complete" },
    ],
  },
  {
    id: "top_vendors",
    keywords: ["vendor", "vendors", "paid the most", "top vendors", "supplier", "who did we pay"],
    build: () => [
      { type: "status.update", label: "Fetching data...", icon: "users" },
      { _delay: 400 },
      { type: "tool.call_started", toolName: "getTopVendors", toolInput: { period: "last_month", limit: 5 } },
      { _delay: 600 },
      { type: "tool.call_completed", result: { vendors: ["Office rent Sharq: 4,200", "KNPC: 1,820", "Avenues Mall: 3,100", "Tradeshow Dubai: 1,240", "Zain Kuwait: 624"] } },
      { _delay: 200 },
      { type: "message.block_added", block: { type: "text", text: "" } },
      ...textDeltas("Your top 5 vendors last month:\n\n1. **Office rent — Sharq**: 4,200.000 KWD (standing order)\n2. **Avenues Mall booth**: 3,100.000 KWD (trade show)\n3. **KNPC fuel cards**: 1,820.500 KWD\n4. **Tradeshow vendor Dubai**: 1,240.000 KWD\n5. **Zain Kuwait**: 624.750 KWD (telecom)"),
      { type: "message.complete" },
    ],
  },
  {
    id: "reconciliation_status",
    keywords: ["unreconciled", "reconciliation", "reconcile", "recon status", "exceptions"],
    build: () => [
      { type: "status.update", label: "Checking reconciliation status...", icon: "check" },
      { _delay: 400 },
      { type: "tool.call_started", toolName: "getReconciliationDashboard", toolInput: {} },
      { _delay: 500 },
      { type: "tool.call_completed", result: { accounts: 4, completed: 1, inProgress: 2, notStarted: 1, totalExceptions: 10 } },
      { _delay: 200 },
      { type: "message.block_added", block: { type: "text", text: "" } },
      ...textDeltas("Reconciliation status for March 2026:\n\n- **KIB Operating**: 25/34 matched, **7 exceptions** open (in progress)\n- **KIB Reserve**: 12/12 matched, **clean** (completed)\n- **KIB Settlement**: 18/25 matched, **3 exceptions** (in progress)\n- **KIB USD**: not started yet (0/8)\n\nThe biggest gap is KIB Operating with 7 exceptions including a **2,462.500 KWD unidentified Boubyan transfer**. Sara is working on it."),
      { type: "message.complete" },
    ],
  },
  {
    id: "compare_periods",
    keywords: ["compare", "Q1", "Q4", "last year", "quarter", "period comparison", "vs last"],
    build: () => [
      { type: "status.update", label: "Comparing periods...", icon: "calendar" },
      { _delay: 300 },
      { type: "tool.call_started", toolName: "getFinancialReport", toolInput: { period: "Q1 2026" } },
      { _delay: 500 },
      { type: "tool.call_completed", result: { revenue: "262,260", expenses: "189,360", netIncome: "72,900" } },
      { _delay: 200 },
      { type: "tool.call_started", toolName: "getFinancialReport", toolInput: { period: "Q4 2025" } },
      { _delay: 500 },
      { type: "tool.call_completed", result: { revenue: "241,800", expenses: "178,200", netIncome: "63,600" } },
      { _delay: 200 },
      { type: "message.block_added", block: { type: "text", text: "" } },
      ...textDeltas("Q1 2026 vs Q4 2025:\n\n- Revenue: **262,260 KWD** vs 241,800 (+8.5%)\n- Expenses: **189,360 KWD** vs 178,200 (+6.3%)\n- Net income: **72,900 KWD** vs 63,600 (+14.6%)\n\nRevenue growth outpaced expense growth by 2.2 points — healthy trajectory. The main expense driver was marketing (+23% QoQ) offset by lower utilities and professional fees."),
      { type: "message.complete" },
    ],
  },
  {
    id: "rent_expense",
    keywords: ["rent", "rent expense", "office rent", "what happened to rent"],
    build: () => [
      { type: "status.update", label: "Analyzing...", icon: "search" },
      { _delay: 400 },
      { type: "tool.call_started", toolName: "getTransactionsByCategory", toolInput: { category: "6200", period: "March 2026" } },
      { _delay: 600 },
      { type: "tool.call_completed", result: { total: "4,200.000 KWD", transactions: 1, trend: "flat" } },
      { _delay: 200 },
      { type: "message.block_added", block: { type: "text", text: "" } },
      ...textDeltas("Office rent for March: **4,200.000 KWD** — a single standing order to the Sharq landlord, same as every month. Rent has been flat since the lease renewal in October 2025. No concerns here — it's the second-largest fixed cost after payroll."),
      { type: "message.complete" },
    ],
  },
  {
    id: "worry_alerts",
    keywords: ["worry", "should I worry", "alert", "risk", "concern", "attention", "anything wrong"],
    build: () => [
      { type: "status.update", label: "Checking your accounts...", icon: "alert" },
      { _delay: 300 },
      { type: "tool.call_started", toolName: "getAlerts", toolInput: {} },
      { _delay: 400 },
      { type: "tool.call_completed", result: { alerts: 3, critical: 1, warning: 2 } },
      { _delay: 100 },
      { type: "tool.call_started", toolName: "getAuditScore", toolInput: {} },
      { _delay: 400 },
      { type: "tool.call_completed", result: { score: "14/15", trend: "stable" } },
      { _delay: 100 },
      { type: "tool.call_started", toolName: "getCashPosition", toolInput: {} },
      { _delay: 400 },
      { type: "tool.call_completed", result: { runway: "8+ months", trend: "growing" } },
      { _delay: 200 },
      { type: "message.block_added", block: { type: "text", text: "" } },
      ...textDeltas("Three things to watch:\n\n1. **Marketing spend at 110% of budget** — if it continues at this pace, you'll be ~9,100 KWD over annual allocation. Consider pulling back in Q2.\n\n2. **KIB Operating reconciliation has 7 open exceptions** including an unidentified 2,462 KWD transfer. Sara is on it but it's blocking the March close.\n\n3. **Audit score 14/15** — one check failing (bank reconciliation completeness). Will resolve when Sara finishes KIB Settlement.\n\nCash runway is healthy at **8+ months** and growing. No liquidity concerns."),
      { type: "message.complete" },
    ],
  },
  {
    // Tier C-3 FOLLOW-UP (HASEEB-183, 2026-04-21) — typed Aminah card
    // for missed-recurrence alerts + operator Suspend action. Scenario
    // keywords cover common phrasings: "missing bills", "recurrences",
    // "overdue vendors", etc.
    id: "missing_recurrences",
    keywords: [
      "missing bills",
      "missed bills",
      "what bills am i missing",
      "missing recurrences",
      "missed recurrences",
      "overdue bills",
      "overdue recurrences",
      "skipped vendors",
      "recurrence alerts",
      "missed payments",
    ],
    build: () => [
      { type: "status.update", label: "Analyzing...", icon: "search" },
      { _delay: 400 },
      { type: "tool.call_started", toolName: "get_missing_recurrences", toolInput: {} },
      { _delay: 600 },
      {
        type: "tool.call_completed",
        result: {
          items: [
            {
              patternId: "rp-mock-001",
              merchantNormalizedName: "Office rent — Sharq",
              expectedIntervalDays: 30,
              expectedAmountKwd: "4200.000",
              lastSeenAt: "2026-02-01T08:00:00.000Z",
              nextExpectedAt: "2026-04-01T08:00:00.000Z",
              daysOverdue: 20,
              severity: "HIGH",
              severityScore: 95,
            },
            {
              patternId: "rp-mock-002",
              merchantNormalizedName: "Zain Kuwait",
              expectedIntervalDays: 30,
              expectedAmountKwd: "624.750",
              lastSeenAt: "2026-03-05T08:00:00.000Z",
              nextExpectedAt: "2026-04-05T08:00:00.000Z",
              daysOverdue: 16,
              severity: "MEDIUM",
              severityScore: 60,
            },
            {
              patternId: "rp-mock-003",
              merchantNormalizedName: "Cleaning services LLC",
              expectedIntervalDays: 14,
              expectedAmountKwd: "185.000",
              lastSeenAt: "2026-04-03T08:00:00.000Z",
              nextExpectedAt: "2026-04-17T08:00:00.000Z",
              daysOverdue: 4,
              severity: "LOW",
              severityScore: 25,
            },
          ],
          total: 3,
          interactionHint: "operator_suspend",
          currencyNote: "Amounts are in KWD at the expected recurring cadence. FX from non-KWD payments is normalised to the tenant's booking currency.",
        },
      },
      { _delay: 200 },
      { type: "message.block_added", block: { type: "text", text: "" } },
      ...textDeltas("You have **3 missed recurrences** worth watching. The biggest concern is **Office rent — Sharq** at 4,200.000 KWD, 20 days overdue. Zain Kuwait (telecom) and the fortnightly cleaning contract are also overdue but smaller. Use the Suspend button on any row if the vendor relationship has ended so Aminah stops flagging it."),
      { type: "message.complete" },
    ],
  },
  {
    id: "close_status",
    keywords: ["close", "month-end", "month end close", "close progress", "blocking the close"],
    build: () => [
      { type: "status.update", label: "Checking close status...", icon: "calendar" },
      { _delay: 400 },
      { type: "tool.call_started", toolName: "getCloseStatus", toolInput: { period: "March 2026" } },
      { _delay: 500 },
      { type: "tool.call_completed", result: { progress: "60%", tasksComplete: 9, tasksTotal: 15, daysRemaining: 3 } },
      { _delay: 200 },
      { type: "message.block_added", block: { type: "text", text: "" } },
      ...textDeltas("March close is **60% complete** — 9 of 15 tasks done with 3 days remaining.\n\n**Done**: Bank feeds imported, all transactions categorized, 3 of 4 reconciliations complete, payroll accrual posted.\n\n**Remaining**: KIB Settlement reconciliation (Sara working on it), adjusting entries review, trial balance validation, your sign-off on adjusting entries, and final period lock.\n\nEstimated completion: **April 3**. Two items will need your approval."),
      { type: "message.complete" },
    ],
  },
];

const FALLBACK_EVENTS = [
  { type: "message.block_added", block: { type: "text", text: "" } },
  ...textDeltas("I'm not sure I understand that question. Could you try rephrasing? I can help with cash position, budget vs actual, reconciliation status, vendor analysis, or close progress."),
  { type: "message.complete" },
];

function textDeltas(fullText) {
  const words = fullText.split(/(\s+)/);
  const events = [];
  let chunk = "";
  for (let i = 0; i < words.length; i++) {
    chunk += words[i];
    if (chunk.length >= 8 || i === words.length - 1) {
      events.push({ type: "message.text_delta", textDelta: chunk });
      events.push({ _delay: 30 + Math.random() * 40 });
      chunk = "";
    }
  }
  return events;
}

function matchScenario(text) {
  const lower = (text || "").toLowerCase();
  let best = null;
  let bestLen = 0;
  for (const sc of SCENARIOS) {
    for (const kw of sc.keywords) {
      if (lower.includes(kw) && kw.length > bestLen) {
        best = sc;
        bestLen = kw.length;
      }
    }
  }
  return best;
}

export async function* runAminahSession(sessionId, userMessage, context = {}) {
  const msgId = `msg-${Date.now()}`;
  yield { type: "session.start", sessionId, messageId: msgId };
  await delay(200);

  const scenario = matchScenario(userMessage);
  const events = scenario ? scenario.build(context) : FALLBACK_EVENTS;

  for (const evt of events) {
    if (evt._delay) {
      await delay(evt._delay);
      continue;
    }
    // Enrich tool calls with auto-generated callId
    if (evt.type === "tool.call_started" && !evt.callId) {
      evt.callId = `call-${_callIdSeq++}`;
    }
    if (evt.type === "tool.call_completed" && !evt.callId) {
      // Find the last started call
      evt.callId = `call-${_callIdSeq - 1}`;
    }
    yield { ...evt, messageId: msgId };
  }
}
