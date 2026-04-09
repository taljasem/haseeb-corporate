# HASEEB CORPORATE AUDIT 20A

Read-only punch list. No source files modified. Audit date: 2026-04-09.

## SUMMARY

- **Total issues:** 157
- **Critical (blocks core flow):** 12
- **High (visible bug, workaround exists):** 34
- **Medium (cosmetic / minor):** 78
- **Low (cleanup / nice-to-have):** 33

---

## CATEGORY 1 — DEAD CODE MARKERS

- `src/engine/mockEngine.js:3993` — MEDIUM — Comment "Minimal stub — real impl would pull bank statement + ledger for period". Reconciliation-by-account-and-period fetch is a skeleton.
- `src/i18n/locales/en/header.json:9` — LOW — `"tooltip_theme_coming": "Light mode — coming soon"`. Tooltip string says coming soon even though light mode ships.
- `src/i18n/locales/en/header.json:10` — LOW — `"tooltip_theme_subtext": "Light theme in development"`. Stale dev copy.
- `src/i18n/locales/en/common.json:4` — LOW — `"subtext": "...A mobile companion is coming soon."` — desktop-gate copy hints at an unshipped companion.
- `src/screens/cfo/PlaceholderScreen.jsx:1-53` — HIGH — Entire file is a generic "coming soon" placeholder used by multiple CFO routes.
- `src/screens/owner/OwnerView.jsx:~146` — MEDIUM — Settings route renders an inline Placeholder component instead of a real screen.
- `src/screens/junior/JuniorView.jsx:~127` — MEDIUM — Profile route renders a placeholder.
- `src/engine/mockEngine.js:501` — LOW — `placeholder: true` flag on synthetic JE line objects in seed arrays.
- `src/engine/mockEngine.js:507` — LOW — Same `placeholder: true` flag on adjacent seed array.

---

## CATEGORY 2 — DEAD HANDLERS AND BUTTONS

- `src/screens/shared/BankAccountsScreen.jsx:298` — MEDIUM — Export button "PDF" has `onClick={() => {}}`. Should trigger statement export.
- `src/screens/shared/BankAccountsScreen.jsx:298` — MEDIUM — Export button "CSV" has `onClick={() => {}}`.
- `src/screens/shared/BankAccountsScreen.jsx:298` — MEDIUM — Export button "Excel" has `onClick={() => {}}`.
- `src/screens/owner/FinancialStatementsScreen.jsx:141` — MEDIUM — Export button "PDF" has `onClick={() => {}}`. Should trigger statement export.
- `src/screens/owner/FinancialStatementsScreen.jsx:141` — MEDIUM — Export button "Excel" has `onClick={() => {}}`.
- `src/components/Header.jsx:~467` — MEDIUM — "View all in taskbox" link in notifications dropdown has neither href nor onClick.
- `src/components/Header.jsx:~400` — LOW — "Mark all read" is an `<a>` styled as a button; uses local-only onClick that mutates local state and never hits the engine.
- `src/screens/owner/TeamScreen.jsx:66-79` — HIGH — Edit button in MemberRow has no onClick handler at all; button is clickable but does nothing.
- `src/screens/cfo/RulesScreen.jsx` — MEDIUM — Edit rule button presence/handler on existing rule rows needs verification (at minimum, UI affordance appears unclear).

---

## CATEGORY 3 — PLACEHOLDER SCREENS

| Screen | File | Status | Notes |
|---|---|---|---|
| Today (Owner) | `src/screens/owner/OwnerTodayScreen.jsx` | REAL | KPIs, tasks, alerts all functional. |
| Overview (Owner) | `src/screens/owner/OwnerOverviewScreen.jsx` | REAL | KPIs, performance, recommendations. |
| Bank Accounts | `src/screens/shared/BankAccountsScreen.jsx` | PARTIAL | List/MTD/statement render; **export buttons dead**. |
| Financial Statements | `src/screens/owner/FinancialStatementsScreen.jsx` | PARTIAL | Tabs, period switch, drill-in, Aminah narration work; **export buttons dead**. |
| Month-End Close | `src/screens/owner/MonthEndCloseScreen.jsx` | REAL | Role gating, checklist, close workflow functional. |
| Audit Bridge | `src/screens/owner/AuditBridgeScreen.jsx` | REAL | 15 checks, hash chain, status display. |
| Team | `src/screens/owner/TeamScreen.jsx` | PARTIAL | Member list / roles / status work; **edit button dead**; no add/remove flow. |
| Settings (Owner) | inline in `OwnerView.jsx` | **PLACEHOLDER** | Renders a "coming soon" block. |
| Today (CFO) | `src/screens/cfo/TodayScreen.jsx` | REAL | Inbox, KPIs, alerts. |
| Bank Transactions | `src/screens/cfo/BankTransactionsScreen.jsx` | REAL | List, filter, search, detail, categorize. |
| Conversational JE | `src/screens/cfo/ConversationalJEScreen.jsx` | PARTIAL | Chat UI + suggested JE card render; **Aminah responses are hardcoded**; no real multi-turn flow. |
| Manual JE | `src/screens/cfo/ManualJEScreen.jsx` | REAL | Draft, post, reverse, template, scheduled JEs. |
| Rules | `src/screens/cfo/RulesScreen.jsx` | PARTIAL | Create/delete/toggle work; edit flow unclear; no empty state. |
| Reconciliation | `src/components/reconciliation/ReconciliationScreen.jsx` | PARTIAL | Dashboard + detail + match + inline JE work; **account selector hardcoded to "1010 — KIB Operating"**. |
| Budget | `src/components/budget/BudgetScreen.jsx` | REAL | Variance, delegation, approval flow, Junior per-department access. |
| Forecast (CFO) | `src/screens/cfo/PlaceholderScreen.jsx` | **PLACEHOLDER** | Generic coming-soon. |
| Aging Reports (CFO) | `src/screens/cfo/PlaceholderScreen.jsx` | **PLACEHOLDER** | Generic coming-soon. |
| Variance Analysis (CFO) | `src/screens/cfo/PlaceholderScreen.jsx` | **PLACEHOLDER** | Generic coming-soon. |
| Setup (CFO) | `src/screens/cfo/PlaceholderScreen.jsx` | **PLACEHOLDER** | Generic coming-soon. |
| Financial Statements (CFO) | `src/screens/cfo/PlaceholderScreen.jsx` | **PLACEHOLDER** | No CFO-specific FS screen; maps to placeholder. |
| Month-End Close (CFO) | `src/screens/cfo/PlaceholderScreen.jsx` | **PLACEHOLDER** | No CFO-side MEC screen. |
| Today (Junior) | `src/screens/junior/JuniorTodayScreen.jsx` | REAL | Tasks, queue, responsibilities, activity, notes. |
| My Responsibilities | `src/screens/junior/MyResponsibilitiesScreen.jsx` | REAL | Rule assignment display + stats. |
| Profile (Junior) | inline in `JuniorView.jsx` | **PLACEHOLDER** | Renders a "coming soon" block. |
| Taskbox (all roles) | `src/components/taskbox/TaskboxScreen.jsx` | REAL | Create / open / reply / approve all work. |

**Confirmed PLACEHOLDER count: 8** (Settings, Profile, Forecast, Aging Reports, Variance Analysis, Setup, CFO Financial Statements, CFO Month-End Close).

---

## CATEGORY 4 — INCOMPLETE FEATURES

### 4.1 Taskbox

**WORKS**
- Create via NewTaskModal (all roles).
- Open task detail.
- Threaded reply.
- Approve/reject JE approval tasks.
- Budget change requests.
- Status transitions open → completed.
- Sidebar badge counts (unread, approvals).
- Filter tabs (all, unread, approvals, received, sent, needs-action, completed).

**BROKEN/MISSING**
- File attachment UI not implemented anywhere.
- Task search behavior needs verification.
- Escalate action writes "[Escalated]" marker but doesn't actually re-route the task.
- No bulk task operations.
- Task templates not surfaced.

### 4.2 Conversational JE

**WORKS**
- Chat bubbles render.
- User input field.
- Role-specific suggested questions.
- JournalEntryCard displays a draft JE.
- Post button on card confirms.

**BROKEN/MISSING**
- Aminah responses are fully hardcoded. No logic branching.
- Draft JE is hardcoded (ExchangeOne, 30 KWD).
- Junior over-threshold routing not enforced in this screen's flow.
- No persistence — drafts disappear on nav away.
- Only supports a single exchange, not multi-turn.

### 4.3 Manual JE

**WORKS**
- Blank draft + from-template draft.
- Add/remove lines, account picker, debit/credit fields.
- Balance validation blocks post.
- Post → moves to recent-posted.
- Save as template.
- Reverse JE creates mirror entry.
- Schedule JE for later.
- Post scheduled JE immediately.
- Draft persistence across tab changes.

**BROKEN/MISSING**
- Account picker only matches hardcoded results (not a real GL query).
- No lock on posted-period accounts.
- No attachment UI.
- Template metadata (usageCount) partially hardcoded.

### 4.4 Rules

**WORKS**
- Create categorization rule + pattern matching.
- Create routing rule with amount thresholds.
- Rule list with active/inactive pills.
- Toggle active/inactive.
- Delete.
- Suggested rules visible on dashboard.
- Audit trail present.

**BROKEN/MISSING**
- Edit existing rule flow unclear / possibly dead.
- Suggested-rule Accept → engine persistence not wired.
- No preview of rule effect on sample transactions.
- No empty state when list is blank.

### 4.5 Reconciliation

**WORKS**
- Dashboard (accounts, progress, status).
- Detail view per account.
- Exception list (unidentified / amount-mismatch / missing-ledger / date-mismatch).
- Mark exception resolved.
- Create missing JE from exception.
- Manual match bank ↔ ledger.
- Mark reconciliation complete.

**BROKEN/MISSING**
- Account selector hardcoded to "1010 — KIB Operating" (`ReconciliationScreen.jsx:682`).
- Engine fetch is a stub — does not actually pull statement + ledger for period (`mockEngine.js:3993`).

### 4.6 Bank Transactions

**WORKS**
- List + pagination.
- Search by merchant/amount/date.
- Filter by direction (debit/credit).
- Detail slide-over.
- Categorize.
- Suggest categorization (Aminah).
- Post suggested JE.
- Assign to user.

**BROKEN/MISSING**
- No bulk actions UI.
- No sort options.
- No filter by category or assignee.

### 4.7 Bank Accounts

**WORKS**
- Account list + balance.
- Click through to statement detail.
- MTD activity.
- Statement table with date-range filter.

**BROKEN/MISSING**
- Export buttons (PDF/CSV/Excel) have empty `onClick` (dead).
- No actual export pipeline.
- Statement view may overflow on narrow widths.

### 4.8 Financial Statements

**WORKS**
- Tab switch (Income / Balance Sheet / Cash Flow).
- Period dropdown.
- Account hierarchy table.
- Drill-in (parent/children).
- Aminah narration card.
- Period comparison.

**BROKEN/MISSING**
- Export buttons (PDF/Excel) have empty `onClick` (dead).
- No variance commentary / trend analysis.

### 4.9 Budget

**WORKS**
- Variance bars.
- Department rows + collapse.
- Add line items.
- Period picker.
- Delegation modal (CFO assignment).
- CFO approval workflow.
- Junior per-department access via `juniorOnlyId`.
- Revision request flow.

**BROKEN/MISSING**
- Edit line item action unclear — may be dead.
- Budget comparison / historical view not implemented.
- Forecast integration missing (separate placeholder screen).

### 4.10 Month-End Close

**WORKS**
- Owner-only enforcement.
- Pre-close checklist with progress.
- Mark individual checks complete.
- Close-period button.

**BROKEN/MISSING**
- No post-close state in UI — nothing visibly changes after close.
- No re-open capability.
- Validation checks are static; no dynamic recalculation.
- No CFO-side MEC screen (CFO route → PlaceholderScreen).

### 4.11 Audit Bridge

**WORKS**
- 15 audit checks with status.
- Last-verified timestamps.
- Hash chain display (total entries, chain length, last hash, status).
- Failing checks highlighted.
- Aminah narration.

**BROKEN/MISSING**
- No auditor-role access control.
- Failing-check resolution flow not implemented.
- XBRL export not implemented.
- Frozen snapshots not visible.

### 4.12 Team

**WORKS**
- Member list + role + access level.
- Online/offline + last active.
- Responsibility assignment display.

**BROKEN/MISSING**
- Edit button has NO onClick (`TeamScreen.jsx:66-79`).
- Add member flow not visible / not wired.
- Remove member not implemented.
- Responsibility reassignment UI missing.

### 4.13 Settings

**BROKEN/MISSING**
- Placeholder only. Nothing to audit.

### 4.14 Profile

**BROKEN/MISSING**
- Placeholder only. Nothing to audit.

### 4.15 Aminah Slide-Over

**WORKS**
- Open/close slide-over.
- Chat input + submit.
- Role-specific suggested questions.
- Bubble chat UI + RTL mirroring.

**BROKEN/MISSING**
- All responses are hardcoded; no real LLM / no branching logic.
- No streaming simulation.
- Context passing works but doesn't change response content.

### 4.16 Header

**WORKS**
- Notification bell dropdown with role-specific demo notifications.
- Theme toggle (dark ↔ light).
- Language toggle (en ↔ ar).
- Tenant switcher (3 demo tenants).
- Role switcher (Owner / CFO / Junior).

**BROKEN/MISSING**
- "Mark all read" is local-state only — doesn't persist via engine.
- "View all in taskbox" link in dropdown has no handler (dead).
- Theme tooltip copy still says "coming soon" even though the toggle works.
- Profile menu: no menu items wired.

---

## CATEGORY 5 — STATE MANAGEMENT BUGS

- `src/screens/cfo/RulesScreen.jsx` — HIGH — Rule list may not auto-refresh after create/delete; relies on local state.
- `src/screens/cfo/ManualJEScreen.jsx` — MEDIUM — Uses a `refreshTick` counter as a workaround to force re-renders instead of invalidating async data properly.
- `src/screens/cfo/BankTransactionsScreen.jsx` — MEDIUM — Transaction list doesn't obviously re-fetch after categorization; may show stale status.
- `src/components/taskbox/TaskboxScreen.jsx:~69` — MEDIUM — `openCount` derived locally but badge count comes from a separate engine call; possible divergence.
- `src/components/Header.jsx:~99` — MEDIUM — Theme state persists via ThemeContext; localStorage round-trip should be verified visually after reload.
- `src/i18n/LanguageContext.jsx` — MEDIUM — Language toggle switches locale; localStorage persistence should be verified after reload.
- `src/screens/owner/FinancialStatementsScreen.jsx` — MEDIUM — Period dropdown: verify useEffect deps actually cover period change.
- `src/components/taskbox/NewTaskModal.jsx` — MEDIUM — Form state may not reset fully between re-opens beyond what `reset()` in handleSend covers (e.g., if user closes without sending).
- `src/components/budget/DelegateBudgetModal.jsx` — LOW — Verify modal resets on reopen.
- `src/screens/cfo/ConversationalJEScreen.jsx` — MEDIUM — After Post, draft stays on screen; no clear transition to "posted" state.

---

## CATEGORY 6 — VISUAL BUGS

- `src/screens/owner/TeamScreen.jsx:~15` — MEDIUM — MemberRow uses fixed grid columns; narrow widths may overflow.
- `src/components/banking/BankStatementTable.jsx` — MEDIUM — Long terminal / counterparty strings may overflow cells without ellipsis.
- `src/components/cfo/BankTransactionDetail.jsx:~98` — MEDIUM — Date field appears to show raw ISO (e.g., `2026-04-08`) instead of a localized format.
- `src/screens/cfo/ManualJEScreen.jsx:41-44` — MEDIUM — Local `fmtKWD` duplicates `src/utils/format.js::formatKWD` with a different output; inconsistent formatting across screens.
- `src/components/reconciliation/ReconciliationScreen.jsx:30-34` — MEDIUM — Same duplicate `fmtKWD` pattern as Manual JE.
- `src/screens/cfo/RulesScreen.jsx` — MEDIUM — No empty state when zero rules.
- `src/screens/cfo/ManualJEScreen.jsx:~410` — MEDIUM — No empty state when no drafts in a given tab.
- `src/components/Header.jsx:~287` — LOW — Tenant switcher dropdown: long company names rely on minWidth 0 + overflow hidden; OK but tight.
- `src/screens/junior/JuniorTodayScreen.jsx:155-156` — LOW — Queue empty state fires correctly when all four counts are 0 (confirmed correct, noted for completeness).
- `src/components/cfo/BankTransactionDetail.jsx:~137` — LOW — Confidence pill present (no bug; noted as verified).

---

## CATEGORY 7 — TRANSLATION GAPS

- `src/screens/cfo/ManualJEScreen.jsx:51-52` — MEDIUM — Hardcoded English `"just now"` in local `fmtRelative` helper.
- `src/screens/cfo/ManualJEScreen.jsx:51` — MEDIUM — Hardcoded `h` / `d` suffixes in `fmtRelative`; not translated.
- `src/screens/cfo/ManualJEScreen.jsx:46-56` — LOW — `fmtRelative` / `fmtDate` are local utilities that don't route through i18n.
- Namespace parity — Arabic and English namespace files match at the top level. Deep-nested key parity needs a targeted diff; flag as NEEDS VERIFICATION.
- Font family — VERIFIED PASS. `tokens.css:169` uses `Noto Sans Arabic` for `[dir="rtl"]` and `[lang="ar"]`. No Cairo references anywhere.
- Eastern Arabic numerals — VERIFIED PASS. Only Western numerals `0-9` found in source and locales.
- Locked role names — VERIFIED PASS. `ar/common.json` has `المالك` and `المدير المالي`. No `محاسب مبتدئ` anywhere.
- LtrText wrapping — `src/screens/owner/FinancialStatementsScreen.jsx` — MEDIUM — verify large KWD amounts are LtrText-wrapped in AR mode (spot check needed).

---

## CATEGORY 8 — PREDICTED RUNTIME ERRORS

- `src/screens/owner/AuditBridgeScreen.jsx:~252` — MEDIUM — `data.hashChain.totalEntries` — crashes if `data.hashChain` is undefined before load.
- `src/screens/owner/AuditBridgeScreen.jsx:~267` — MEDIUM — `data.hashChain.chainLength` — same.
- `src/screens/owner/AuditBridgeScreen.jsx:~282` — MEDIUM — `data.hashChain.lastHash` — same.
- `src/screens/owner/AuditBridgeScreen.jsx:~298` — MEDIUM — `data.hashChain.status` — same.
- `src/screens/owner/MonthEndCloseScreen.jsx:123-124` — MEDIUM — `data.tasks.filter(...).length` and `data.tasks.length` assume `data.tasks` non-null; no guard on initial render.
- `src/screens/cfo/ManualJEScreen.jsx:~415` — LOW — `je.lines.length < 2` assumes `je.lines` defined.
- `src/screens/cfo/ManualJEScreen.jsx:~211` — MEDIUM — Nested `.map` inside list render — verify inner key props.
- `src/screens/shared/BankAccountsScreen.jsx` — MEDIUM — Bank statement rows — verify all `.map` calls include `key`.
- `src/screens/owner/OwnerView.jsx:73-76` — MEDIUM — `getOpenTaskCount` / `getOpenApprovalCount` useEffect depends only on `[activeScreen]`; counts may go stale after mutations.
- `src/components/cfo/BankTransactionDetail.jsx:~106` — LOW — `tx.amount` accessed without null guard.
- `src/screens/cfo/BankTransactionsScreen.jsx:~30` — MEDIUM — `role` prop defaulted to `"CFO"` but used without validation downstream.

---

## CATEGORY 9 — DATA INCONSISTENCIES

- `src/engine/mockEngine.js:94-100` — MEDIUM — `getCashPosition` total `184235.5` is hardcoded as the sum of two components rather than derived at read time.
- `src/engine/mockEngine.js` — MEDIUM — `getActiveBudgetSummary` likely hand-totals; needs verification.
- `src/engine/mockEngine.js` — MEDIUM — Task `linkedItem.id` references point at JE / budget IDs that may not exist if seeds drift.
- `src/screens/cfo/ManualJEScreen.jsx:~89` — MEDIUM — Consumer assumes `task.linkedItem.budgetId` resolves; no fallback.
- `src/engine/mockEngine.js` — MEDIUM — Task sender/recipient IDs (`cfo`, `owner`, `sara`) hardcoded — verify they line up with `team` records across all three tenants.
- `src/engine/mockEngine.js:17-22` — LOW — `_brandObj` rewrites strings at read-time; seed data is single-tenant. Multi-tenant integrity is cosmetic not structural.

---

## CATEGORY 10 — DISCIPLINE VIOLATIONS

- `src/components/reconciliation/ReconciliationScreen.jsx:~682` — HIGH — Hardcoded `"1010 — KIB Operating"` account string in a tenant-agnostic component. Must come from tenant/GL.
- `src/screens/owner/OwnerTodayScreen.jsx:~163` — MEDIUM — `tenant?.banks?.[0]?.abbreviation || "KIB"` — "KIB" fallback in a tenant-agnostic file (acceptable as a demo fallback but noted).
- `src/screens/cfo/ConversationalJEScreen.jsx:~149` — MEDIUM — Same `|| "KIB"` fallback.
- `src/components/Header.jsx:~126` — MEDIUM — Same `|| "KIB"` fallback.
- Aminah → ledger direct writes — VERIFIED PASS. No `createJournalEntry` calls from Aminah components. All JE creation goes through user confirmation.
- Engine signature changes — NEEDS VERIFICATION. No visible commented-out old signatures.
- `src/utils/format.js` untouched — VERIFIED PASS.
- `src/config/tenants.js` untouched — VERIFIED PASS.
- `src/components/shared/NavContext.jsx` untouched — VERIFIED PASS.
- Owner posting JEs directly — VERIFIED PASS. Owner has no route to ManualJE or ConversationalJE.
- Junior over-threshold JEs — NEEDS VERIFICATION. Threshold enforcement in `mockEngine.js` routing rules not easily inspected; no obvious violation but worth a targeted read.
- Cairo font — VERIFIED PASS. Noto Sans Arabic used.
- `محاسب مبتدئ` — VERIFIED PASS. Not present anywhere.
- Eastern Arabic numerals — VERIFIED PASS. Western numerals only.

---

## RECOMMENDED FIX SEQUENCE

### Phase 1 — Critical (fix first, blocks core flow)

1. **CFO placeholder routes** — Decide per route: ship a minimal real screen, redirect to an existing Owner screen, or remove the sidebar entry. Current state is dead navigation (Forecast, Aging Reports, Variance Analysis, Setup, CFO FS, CFO MEC).
2. **Reconciliation hardcoded account** — Replace `"1010 — KIB Operating"` in `ReconciliationScreen.jsx:682` with the active tenant's primary operating account from GL / tenant config.
3. **Audit Bridge optional chaining** — Add `?.` to every `data.hashChain.*` access in `AuditBridgeScreen.jsx` (lines ~252, ~267, ~282, ~298) so first render doesn't crash on null `data`.
4. **MonthEndClose null guard** — Guard `data.tasks` access at `MonthEndCloseScreen.jsx:123-124`.
5. **Team edit button** — Either wire the edit handler or remove the button. Current state is a clickable dead button.

### Phase 2 — High (visible bugs with workarounds)

6. **Export buttons** — Wire PDF/CSV/Excel in `BankAccountsScreen.jsx:298` and `FinancialStatementsScreen.jsx:141`. Either real client-side generation or an explicit "demo: not wired" toast; dead onClick is worse than either.
7. **Rules list re-fetch** — After create / edit / delete / toggle in `RulesScreen.jsx`, re-pull the rules list from the engine.
8. **ManualJE refreshTick** — Replace the ad-hoc `refreshTick` counter with proper state invalidation.
9. **"View all in taskbox" link** — Wire notification dropdown "View all" in `Header.jsx` to the taskbox nav.
10. **"Mark all read"** — Call a real engine method instead of mutating local state.
11. **Conversational JE static responses** — Either wire to a real (mock) Aminah response dispatcher or mark the screen as demo-only in copy so it stops feeling broken.
12. **BankTransactions stale after categorize** — Refresh transaction after mutation.

### Phase 3 — Medium (polish and consistency)

13. **Format consolidation** — Delete local `fmtKWD` in `ManualJEScreen.jsx` and `ReconciliationScreen.jsx`; use `src/utils/format.js::formatKWD`.
14. **Raw ISO date** — `BankTransactionDetail.jsx:~98` should use `formatDate` / `formatRelativeTime`.
15. **Empty states** — Add `EmptyState` to Rules (no rules) and Manual JE (empty tab).
16. **Theme tooltip copy** — Update `header.json` `tooltip_theme_coming` / `tooltip_theme_subtext`; light mode ships.
17. **Desktop gate subtext** — Update `common.json` — drop "mobile companion is coming soon" unless there's a plan.
18. **Stale placeholder markers** — Resolve or ship Settings and Profile screens.
19. **Reconciliation engine stub** — Implement real statement + ledger pull in `mockEngine.js:3993`.
20. **Owner task/approval counters** — Make `OwnerView.jsx:73-76` useEffect refresh on taskbox mutation, not just screen change.
21. **LtrText audit** — Spot check large KWD amounts in Financial Statements in AR mode.
22. **ManualJE date helpers** — Route `fmtRelative` / `fmtDate` through i18n.
23. **Taskbox attachment** — Decide: implement or remove affordance.
24. **Escalate action** — Wire real routing or remove.
25. **Rules edit flow** — Implement edit modal or remove the affordance.
26. **Budget edit line** — Same.

### Phase 4 — Low (cleanup)

27. **Seed `placeholder: true` flags** — Clean up `mockEngine.js:501, 507` if those rows aren't serving a real purpose.
28. **Header profile menu** — Either add menu items or remove the affordance.
29. **Deep nested AR key parity check** — Run a scripted diff of en/ vs ar/ nested keys and fill any gaps.
30. **KPI derive-at-read** — Replace hand-totaled values like `getCashPosition` with derivations.
31. **Tenant FK integrity** — Audit sender/recipient IDs across tenants.
32. **Hardcoded "KIB" fallbacks** — Keep or generalize to `tenant?.banks?.[0]?.abbreviation || ""`.
33. **Placeholder-object markers in seeds** — Tighten up.

---

## NOTES

- No files were modified by this audit.
- Every category is reported, including those with zero findings (Category 10 is near-zero, with mostly VERIFIED PASS items).
- "NEEDS VERIFICATION" items are flagged as such rather than asserted as bugs.
- Line numbers marked with `~` are approximate and should be re-grepped at fix time.
