# HASEEB CORPORATE — BUILD PROGRESS

**Last updated:** April 7, 2026
**Live URL:** https://haseeb-corporate.vercel.app
**GitHub:** taljasem/haseeb-corporate (main branch)
**Local path:** ~/Downloads/haseeb-corporate

---

## WHAT THIS IS

Haseeb Corporate is a **standalone AI-native corporate accounting product** built by AFT for the Gulf market. It is a separate product from Haseeb Standalone (the SME bookkeeping platform). It targets corporate clients with optional bank integration as one of multiple value layers.

**Strategic positioning:** Sells in three modes — bank-embedded (KIB pilot first, Boubyan second), embedded with other banks, or standalone to corporate clients with optional customization layers. The product must NOT be too KIB-specific in visible architecture; the bank is one configurable integration, not the defining identity.

**Product status as of this snapshot:** Functional vertical prototype with production-grade frontend architecture. ~1800 modules, deployed to Vercel via auto-deploy on push. State held in mockEngine.js (in-memory, no persistence). Backend, real bank integration, and real Claude API integration are separate future tracks.

---

## CORE ARCHITECTURE LOCKED

### Four Unfair Advantages (the product thesis)

1. **Deterministic engine as source of truth.** Owns ledger mutations. 3-tier categorization (Rules → Patterns → AI). Confidence indicators (RULE / PATTERN / AI / MANUAL / PENDING) on every number. The engine — not the LLM — writes to the books.

2. **Grounded Aminah AI as strict query layer.** Calls engine functions only. NEVER answers from training. Says "I don't know" when the engine returns nothing. Drafts journal entries via clarifying conversation but only the engine posts them.

3. **Bank-embedded architecture.** Real-time data, no CSV imports. The bank is a configured integration (currently KIB hardcoded — flagged for refactor in Step 7.5).

4. **Audit Bridge.** 15 continuous automated checks, SHA-256 hash chain, frozen snapshots, XBRL compliance, external auditor read-only access.

### Role Boundaries (CRITICAL — these are demoed throughout the product)

- **Owner (Tarek):** read + approve + ask. NEVER creates entries. Aminah refuses entry creation in owner view ("I've notified Sara to log this").
- **CFO (You):** full bookkeeping authority + Conversational JE for non-bank only.
- **Junior (Sara):** operational, threshold-aware. JE > 1,000 KWD requires CFO approval (visible in Junior Conversational JE flow).
- **Bank transactions:** ALWAYS go through deterministic engine review (rules → patterns → AI suggestion → user confirms). NEVER conversational JE.
- **Conversational JE:** ONLY for non-bank transactions. Aminah asks clarifying questions until 100% context, THEN tells engine to draft. User confirms → engine posts → hash chain extends.
- **Three JE lifecycle states:** "suggested" (amber, engine-drafted), "draft-validated" (teal, human-drafted), "posted" (dim, locked, hash chain extended), plus "pending-approval" (amber, junior over threshold).

### Design System (LOCKED)

- **Background:** #05070A
- **Surface:** rgba(255,255,255,0.04)
- **Text primary:** #E6EDF3
- **Text secondary:** #8B98A5
- **Text tertiary:** #5B6570
- **Teal:** #00C48C (Aminah, positive, primary action)
- **Red:** #FF5A5F (critical, error)
- **Amber:** #D4A84B (warning, pending)
- **Blue:** #3B82F6 (information, junior accent)
- **Purple:** #8B5CF6 (Aminah pills, owner accent)
- **Fonts:** Bebas Neue (display), DM Sans (body), DM Mono (numbers), Noto Sans Arabic (NOT Cairo)
- **KWD always 3 decimals, USD always 2 decimals via formatMoney()**
- **Ambient layers:** SVG noise (0.08), pulsing dot grid (24px, 0.10-0.16), two drifting glows (teal top-left, purple top-right), inset vignette
- **Header 52px** blurred backdrop, no top tabs (removed in polish)
- **220px sidebar** with collapsible groups (Owner/CFO/Junior all use shared SidebarGroup component)
- **Hero band** per role with company name + status pills + AMINAH button

### Canonical Team Members & Avatar Colors

- **Tarek Aljasem** (Owner) → #8B5CF6 purple
- **You (CFO)** → #00C48C teal
- **Sara Al-Ahmadi** (Senior Accountant) → #3B82F6 blue
- **Noor Kandari** (Junior) → #8B5CF6 purple
- **Jasem Al-Rashed** (Junior) → #D4A84B amber
- **Layla Habib** (Accounts Payable) → #FF5A5F red

These are the single source of truth in TASKBOX_PEOPLE map. Every avatar in the product pulls from this. The role switcher pills in the header use ROLE_COLOR map with the same canonical colors.

### Bank Accounts (current mock)

All 4 accounts are KIB (NBK was removed for demo consistency — KIB demo can't show competitor's bank):

1. **KIB Operating Account** — KWD, balance 142,100.250, MTD inflow 87,420, MTD outflow 63,180.500, accent teal
2. **KIB Reserve Account** — KWD, balance 42,135.250, accent blue
3. **KIB Settlement Account** — KWD, balance 18,420.750, accent purple (was NBK Settlement, rebranded)
4. **KIB USD Account** — USD, balance 8,240.50, accent amber

**Refactor flagged:** Step 7.5 will replace hardcoded "KIB" with a tenant configuration system so the same product can be demoed for Boubyan, NBK, or generic corporate clients.

---

## WHAT'S BUILT (BY ROLE)

### OWNER VIEW (Tarek's view) — 8 screens

1. **Today** — focused work surface with 5 sections:
   - BUSINESS PULSE (4 KPI cards: Revenue, Expenses, Net Income, Cash Position) — pulls from getBusinessPulse() which is the single source of truth, reconciled with Financial Statements and Bank Accounts
   - NEEDS YOUR ATTENTION (3 actionable rows with amber severity tension dot)
   - TASKBOX SUMMARY (top 4 open tasks via TaskboxSummaryCard)
   - MARCH 2026 CLOSE (read-only progress with link to full close screen)
   - AMINAH'S TOP INSIGHT (single grounded observation with action buttons)
2. **Taskbox** — full inbox via shared TaskboxScreen, filtered to owner-visible tasks
3. **Overview** — dense intelligence stream with 9 section cards in 1fr/1fr responsive grid (Bank Accounts compact, Monthly Insights, Financial Health, Pending Approvals, Budget Performance, Aminah's Notes, Close Status, Audit Readiness, AI Insights)
4. **Bank Accounts** — full BankAccountsScreen (read-write for owner, owns the bank relationship)
5. **Financial Statements** — three tabs (Income Statement, Balance Sheet, Cash Flow) with Aminah narration cards, mathematical footing across all three statements (foots end-to-end), period selector (This Month / Quarter / YTD / Custom), drill-down hooks
6. **Month-End Close** — read-only checklist (15 tasks, 9 complete / 2 in progress / 4 pending), Aminah summary, pre-close validations, owner action buttons (Approve close, Request status, Lock period)
7. **Audit Bridge** — 15-check grid (14 passing, 1 failing on Sequential Numbering), hash chain status card (2,847 entries, intact), external auditor access card
8. **Team** — members table with status/access/last-active, "Who handles what" cards derived live from routing rules, "Invite team member" placeholder
9. **Settings** — placeholder

### CFO VIEW (You) — 13 navigable screens

**PRIMARY:**
1. **Today** — work queue with NEEDS YOUR REVIEW, Suggested Rules section (engine-surfaced), Taskbox summary, Engine status
2. **Taskbox** — full inbox with Approvals filter tab pre-active when navigated from "approvals" route

**BOOKKEEPING:**
3. **Bank Transactions** — split view (pending list + detail), real JournalEntryCard suggestions in 'suggested' state, suggestion banner for rule creation, full categorization power
4. **Bank Accounts** — full screen with 4 KIB account cards, summary strip, transaction table with running balances, expandable JournalEntryCard per row, FutureBankOperationsCard at bottom
5. **Conversational JE** — Aminah-driven JE drafting with AccountPicker integration, validation, hash chain extension on confirm
6. **Manual JE** — placeholder
7. **Rules** — full management screen with three tabs: Categorization (12 rules), Routing (8 rules), Suggested (5 suggestions, 3 categorization + 2 routing). Inline expansion, audit trail per rule, edit modal pre-fills existing data, mute/delete actions
8. **Reconciliation** — placeholder

**REPORTING:** (placeholders)
9. Financial Statements
10. Aging Reports
11. Variance Analysis

**OPERATIONS:** (placeholders)
12. Month-End Close
13. Audit Bridge

### JUNIOR VIEW (Sara's view) — 7 screens

**PRIMARY:**
1. **Today** — task-centric with 5 sections (My Tasks, Today's Work Queue, My Responsibilities summary, Today's Activity log, Aminah's Notes with junior-specific accuracy/workload observations)
2. **Taskbox** — full inbox filtered to Sara

**MY WORK:**
3. **Bank Transactions** — filtered to Sara's domain (~6-8 of 10 transactions, plus all NEEDS REVIEW items)
4. **Conversational JE** — same component as CFO. NOTE: Sara-specific content with threshold flow was deferred until Tier 1.5 polish (in progress)
5. **Reconciliation** — placeholder

**REFERENCE:**
6. **My Responsibilities** — read-only view of routing rules where Sara is the assignee, with audit trail, "Contact CFO to adjust" button (wired to NewTaskModal), domain stats grid
7. **Bank Accounts** — read-only via readOnly prop on shared component (export and FutureBankOperations hidden)

**PERSONAL:**
8. **Profile** — placeholder

---

## SHARED INFRASTRUCTURE

### Components (organized in src/components/)

**Taskbox system:**
- TaskboxScreen, TaskRow, TaskDetail, NewTaskModal (gated 2-step wizard), TaskTypePill (18 task types with hybrid icon + colored pill + label), TaskboxSummaryCard

**Rules system:**
- RulesScreen, NewCategorizationRuleModal, NewRoutingRuleModal (both with editingRule prefill prop), RuleDetailExpanded, SuggestedRuleRow, SuggestionBanner

**Banking:**
- BankAccountsScreen (shared, accepts role + readOnly + initialAccountId props), BankAccountCard, BankAccountSummaryStrip, BankStatementTable, BankStatementRow, FutureBankOperationsCard, BankAccountsCompact (Owner Overview)

**Financial:**
- IncomeStatementTable, BalanceSheetTable, CashFlowTable, AminahNarrationCard

**Audit:**
- AuditCheckCard, HashChainStatus

**Close:**
- CloseChecklistRow, PreCloseValidations

**Team:**
- TeamMemberRow, ResponsibilitiesCard, RoutingRuleReadOnlyCard

**Shared primitives:**
- SidebarGroup (collapsible), AccountPicker, AssignToButton, JournalEntryCard (3 states + pending-approval state), EngineConfidencePill, AminahTag, AminahSlideOver (role-aware content per Tier 2+3 polish), Avatar, Toast

**Per-role:**
- OwnerSidebar, OwnerHeroBand
- CFOSidebar, CFOHeroBand
- JuniorSidebar, JuniorHeroBand (with Accuracy pill + tooltip)

### Engine (src/engine/mockEngine.js)

**~50+ functions, all async with 200ms delay. Selected highlights:**

**Taskbox:**
- getTaskbox(role, filter), getTaskboxCounts(role), getOpenTaskCount, getOpenApprovalCount, createTask, replyToTask, reassignTask, completeTask, cancelTask

**Rules:**
- getCategorizationRules, getRoutingRules (with active/muted/deleted/all filter), createCategorizationRule, createRoutingRule, updateCategorizationRule, updateRoutingRule, mute/unmute/delete, getCategorizationRuleAuditTrail, getRoutingRuleAuditTrail, getSuggestedCategorizationRules, getSuggestedRoutingRules

**Banking:**
- getBankAccounts, getBankAccountById, getBankStatement(id, dateRange), getBankAccountSummary, getTransactionJournalEntry, getFilteredBankTransactions(juniorId)

**Financial Statements:**
- getIncomeStatement (foots: Revenue 87,420 − COGS 43,000 = Gross 44,420 − OpEx 20,120 = Net Income 24,300)
- getBalanceSheet (Total Assets 351,196.500 = Total L+E with auto-balanced Owner Equity)
- getCashFlowStatement (Beginning 182,496.500 + Change 28,400 = Ending 210,896.500)
- getBusinessPulse (single source of truth for KPIs across screens, USD converted at fixed 3.28 KWD/USD)

**Close & Audit:**
- getMonthEndCloseTasks (15 tasks), getAuditChecks (15 checks), getHashChainStatus

**Team:**
- getTeamMembers, getTeamMembersWithResponsibilities (extends with accessLevel, isOnline, lastActive, responsibilities derived from routing rules)

**Junior-specific:**
- getSaraTaskStats, getSaraAccuracy, getSaraWorkQueue, getSaraActivityLog, getSaraAminahNotes, getJuniorDomainStats, draftJournalEntryForJunior (1,000 KWD threshold, returns {entry, needsApproval})

**Owner-specific:**
- getOwnerTopInsight

### Mock Data Stores

- **TASKBOX_DB:** 25 realistic tasks across 18 task types (downward, upward, lateral)
- **CAT_RULES_DB:** 12 categorization rules with audit trails
- **ROUTING_RULES_DB:** 8 routing rules
- **BANK_ACCOUNTS_DB:** 4 KIB accounts
- **Bank statement transactions:** ~70 across all accounts (30 Operating, 12 Reserve, 20 Settlement, 8 USD)
- **TASKBOX_PEOPLE:** 6 team members (canonical avatar colors)

---

## BUILD WORKFLOW (LOCKED)

- **Claude chat (here):** scope, prompts, decisions, architecture
- **Claude Code (terminal):** file ops, builds, tests, deploys
- **Tarek:** orchestrator — pastes prompts, shares results, makes decisions

**Project location:** ~/Downloads/haseeb-corporate
**GitHub:** taljasem/haseeb-corporate (main branch)
**Live URL:** https://haseeb-corporate.vercel.app (auto-deploy on push)

**Build conventions:**
- TypeScript not used — JSX + plain JS (mockEngine.js)
- Vite + React
- All engine functions async with 200ms delay (simulates network)
- All monetary math through formatKWD/formatMoney (never native floats for display, never via format.js which is untouchable from Haseeb Standalone)
- Lucide-react icons (chunk size optimization deferred to Step 19)
- No router library — useState-based screen routing per role view
- Each Terminal command in its own copy block
- Never ask Tarek to cd or navigate paths
- Tarek reviews previews before pushing

---

## SESSION HISTORY (THIS BUILD)

1. **Step 1:** Owner view v1 — three-panel layout (deprecated in Step 4b)
2. **Step 2:** CFO view foundation — sidebar + Today + Bank Transactions split view
3. **Step 3:** Taskbox system — universal work communication layer with 25 tasks
4. **Step 3.5:** Rules system — categorization + routing + suggested + audit trails
5. **Step 4a:** Bank Accounts screen — shared component for CFO and Owner, removed Approvals from sidebars (unified into Taskbox filter)
6. **Step 4a.1:** NBK → KIB rebrand for demo consistency
7. **Step 4b:** Owner view restructure — 8 screens, retired three-panel layout, built Financial Statements / Month-End Close / Audit Bridge / Team
8. **Step 5:** Junior view as Sara's view — 7 screens including My Responsibilities with read-only routing rules
9. **Polish Tier 1:** 8 correctness fixes (header tabs removed, Business Pulse reconciled, approval sender state, dead code, avatar colors, USD formatting, rule edit prefill, navigation wiring)
10. **Polish Tier 2+3:** 17 interaction polish items (collapsible sidebars, NewTaskModal wiring, notification bell dropdown, role-specific Aminah, tension dot variants partial, taskbox filter counts, accuracy pill tooltip, etc.)
11. **Polish Tier 1.5:** 3 final cleanup items (Junior JE threshold flow, notification bell navigation, tension dot CSS variant refactor) — IN PROGRESS as of this snapshot

---

## NEXT STEPS (ROADMAP)

### Immediate

- **Step 7: Budget creation and management flow.** Multi-role workflow: CFO drafts master budget → delegates department sections to juniors via Taskbox → juniors submit back → CFO consolidates → owner approves → ongoing variance tracking against actuals. The last major workflow on the original roadmap.

- **Step 7.5: Bank-agnostic refactor + tenant configuration foundation.** CRITICAL before any non-KIB demos. Replace hardcoded "KIB" with a tenant config object that flows through the app via context. Tenant defines: company name, logo, accent color, bank name(s), enabled modules, terminology choices, feature flags. Same codebase serves KIB demo, Boubyan demo, generic corporate demo.

### Frontend completeness (Phase A continuation)

- **Step 8: Reconciliation workspace** (CFO + Junior). Bank statement on one side, ledger on the other, auto-matching + manual matching for exceptions. Core bookkeeping infrastructure.
- **Step 9: Manual JE workspace** (CFO). Full double-entry interface with multi-line entries, validation, scheduled/recurring entries, attachment upload, save-as-template.
- **Step 10: Reporting deeper screens** (CFO + Owner). Aging Reports (AR/AP with drill-down), Variance Analysis (budget vs actual), Trial Balance, General Ledger explorer.
- **Step 11: Vendor/Customer registries** (CFO + Junior). Master data management. Required before invoicing can be real.
- **Step 12: Document management** (all roles). Upload, attach to transactions, OCR placeholder, retention policies.
- **Step 13: Settings, Profile, Setup screens** (placeholder cleanup → real screens). Notification preferences, theme/language preferences, team onboarding, integrations management, tax/period settings.

### Phase D — Localization (BROUGHT FORWARD per Tarek's direction)

- **Step 14: Localization foundation (Arabic + RTL).** i18n infrastructure (string extraction, translation files, RTL CSS support, locale-aware formatting). Translate canonical strings. Arabic toggle becomes real. ~2-3 prompts.
- **Step 15: Light mode.** Build the light theme. Moon toggle becomes real. ~1 prompt.

### Phase E — Production hardening (BROUGHT FORWARD per Tarek's direction)

- **Step 16: Mobile/tablet responsive pass.** Every screen works on smaller viewports. ~2 prompts.
- **Step 17: Accessibility pass.** Keyboard navigation, ARIA labels, focus management, screen reader compatibility.
- **Step 18: Error handling and edge cases.** Empty states, network error states, loading states, validation messaging.
- **Step 19: Performance pass.** Lucide chunk size, code splitting, lazy loading, image optimization.
- **Step 20: Final polish + demo readiness.** Walk every screen, every interaction, every empty state, every modal.

### Out of scope for frontend (parallel tracks for Swagat/integrations)

- **Phase B:** Backend API layer (replace mockEngine.js with apiClient.js, build Postgres + Prisma + endpoints matching engine function signatures)
- **Phase C:** Real integrations (KIB API for bank embedding, Claude API for Aminah, Document Intelligence for OCR, MyFatoorah/Tap for AP)
- Authentication, multi-tenancy, audit logging, deployment infrastructure

---

## DECISIONS LOCKED

1. **Bank-agnostic by Step 7.5.** No more KIB hardcoding after that point. Tenant config drives bank identity, branding, terminology.
2. **Phase D (localization) and Phase E (production hardening) come BEFORE Phase B/C.** This means a complete, polished, accessible, multilingual frontend before backend integration begins. Tarek wants to demo the standalone product to other banks and corporate clients regardless of KIB outcome.
3. **All three role views are full products** — Owner, CFO, Junior. None is a placeholder. Sara is the canonical Junior; the role switcher renders her view when "Junior" is selected.
4. **Approvals are unified into Taskbox** — no separate Approvals nav item. Approvals are a filter tab inside Taskbox with smart badge color logic.
5. **Aminah is a global slide-over**, not a permanent panel. Triggered from header AMINAH button. Role-aware greeting and suggested questions.
6. **JE threshold for Junior is 1,000 KWD.** Above that, JEs go to CFO as approval requests instead of posting.
7. **No top header tabs.** Sidebar handles all navigation. Header is logo + role pills + bell + theme/language toggles + avatar.
8. **Dark mode is canonical.** Light mode planned for Step 15. Toggle currently shows "Coming soon" tooltip.
9. **Arabic interface planned for Step 14.** Toggle currently shows "Coming soon" tooltip.
10. **All financial numbers must reconcile across screens.** Single source of truth via getBusinessPulse / getIncomeStatement / getBankAccounts. No drift.
11. **Hash chain is mocked** as SHA-256-style strings in posted JE state. Real implementation comes with backend.
12. **Audit Bridge shows 14/15 passing** with Sequential Numbering as the failing check. JE-0413 missing reference. Sara-level fix in her Taskbox.

---

## KNOWN GAPS (TO BE ADDRESSED IN UPCOMING STEPS)

### After Tier 1.5 cleanup
- Junior Conversational JE Sara content (Tier 1.5 in progress)
- Notification bell rows clickable to navigate (Tier 1.5 in progress)
- Tension dot CSS variant refactor (Tier 1.5 in progress)

### Step 7.5 / future
- KIB hardcoded throughout (refactor to tenant config)
- Lucide chunk size (~200kB savings via per-icon imports)
- Settings/Profile placeholder screens
- Reconciliation placeholder (Step 8)
- Manual JE placeholder (Step 9)
- CFO Reporting/Operations group screens (Step 10)
- BudgetPerformance "View all" link points to non-existent budget screen (Step 7)
- CFO/Junior Reconciliation links go nowhere (Step 8)
- NewTaskModal prefilled state visual indicator
- Owner Today "NEEDS YOUR ATTENTION" hardcodes "March close tracking" row regardless of state
- Various placeholder console.logs for unbuilt features (Export PDF, etc.)

---

## CRITICAL INVARIANTS (NEVER BREAK)

1. **src/utils/format.js is UNTOUCHABLE.** This is a shared utility from Haseeb Standalone heritage. Use formatKWD / formatMoney / formatCurrency.js instead.
2. **Engine functions are additive.** Never modify existing function signatures. Add new functions, deprecate old ones, never break the contract.
3. **Mock data lives in mockEngine.js.** Never split it into separate JSON files (would break the in-memory simulation).
4. **All monetary display through format helpers.** Never `${amount}` or toString() on a number.
5. **Avatar colors from TASKBOX_PEOPLE.** Never hardcode a person's color.
6. **Role boundaries enforced in UI.** Owner cannot post entries. Junior over threshold goes to CFO. Bank transactions never go through Conversational JE.
7. **Aminah never invents data.** Every Aminah response references engine state or refuses with "I don't know."
8. **Hash chain extends only through engine functions.** UI never simulates a hash directly.
9. **No new top-level routes outside the role views.** Every screen lives inside Owner/CFO/Junior view.

---

## CONTACT POINTS FOR FUTURE SESSIONS

When picking this up in a new session, start by:

1. Reading this document
2. Reading the haseeb-corporate.skill file in /mnt/skills/user/
3. Pulling the latest from main: `cd ~/Downloads/haseeb-corporate && git pull`
4. Running `npm run dev` to spin up locally
5. Checking the Vercel deploy at https://haseeb-corporate.vercel.app
6. Resuming from the next step in the roadmap above

---

## ANTI-PATTERNS TO AVOID

- Don't compare Haseeb Corporate to Xero, QuickBooks, or other SME tools. Corporate competitors are NetSuite, Sage Intacct, Microsoft Dynamics, Workday, SAP.
- Don't conflate Haseeb Corporate with Haseeb Standalone. They are separate products with separate codebases.
- Don't mention KIB-specific demo details when generalizing the product. KIB is one go-to-market mode, not the product identity.
- Don't add "free trial" CTAs. Same rule as Haseeb Standalone. No free trials ever.
- Don't break the deterministic engine vs LLM separation. Aminah doesn't write to the ledger. Ever.
- Don't add Cairo as the Arabic font. It's Noto Sans Arabic.
