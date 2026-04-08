# Haseeb Corporate — Progress Snapshot

**Last updated:** After Step 14B (i18n shared infrastructure translation)
**Live:** https://haseeb-corporate.vercel.app
**Repo:** taljasem/haseeb-corporate (main branch)
**Local:** ~/Downloads/haseeb-corporate
**Stack:** Vite + React + JSX (no TypeScript) + plain JS engine (mockEngine.js) + react-i18next

## Strategic Positioning

Haseeb Corporate is a bank-embedded AI-native corporate accounting product built by AFT for the Gulf market. It is a SEPARATE product from Haseeb Standalone (SME) — different codebase, stack, market, competitors. Never conflate.

Three distribution modes supported via tenant configuration:
- Bank-embedded (KIB pilot first, Boubyan second)
- Embedded with other banks (white-label)
- Standalone direct sales with customization

Real product, not a demo. Real work begins when Haseeb SME stabilizes and migration starts. Every decision should pass the test "would I be okay maintaining this in 18 months."

## Four Unfair Advantages (LOCKED)

1. Deterministic engine — source of truth, owns ledger mutations, 3-tier categorization (Rules → Patterns → AI), confidence pills
2. Grounded Aminah AI — strict query layer, calls engine functions only, never invents data, role-aware behavior
3. Bank-embedded architecture — tenant-configurable, not hardcoded to one bank
4. Audit Bridge — 15 continuous checks, SHA-256 hash chain, frozen snapshots, XBRL, external auditor read-only access

## Role Boundaries (LOCKED)

- **Owner (Tarek):** read + approve + ask, NEVER creates entries
- **CFO (You):** full bookkeeping + Conversational JE for non-bank only
- **Junior (Sara):** operational, JE > 1,000 KWD requires CFO approval
- **Bank transactions:** ALWAYS through engine review, NEVER conversational JE
- **JE lifecycle states:** suggested (amber engine-drafted) / draft-validated (teal human-drafted) / posted (grey locked hash chain) / pending-approval (amber junior-over-threshold)

## Design System (LOCKED)

- Background #05070A, surface rgba(255,255,255,0.04)
- Text: primary #E6EDF3, secondary #8B98A5, tertiary #5B6570
- Accents: teal #00C48C (Aminah, primary), red #FF5A5F, amber #D4A84B, blue #3B82F6, purple #8B5CF6
- Fonts: Bebas Neue (display), DM Sans (body), DM Mono (numbers), Noto Sans Arabic (Arabic)
- KWD 3 decimals, USD 2 decimals, formatting via src/utils/format.js (UNTOUCHABLE)
- 220px sidebar with collapsible groups, 52px header, per-role hero band

## Canonical Team (TASKBOX_PEOPLE — single source of truth)

- Tarek Aljasem (Owner) → #8B5CF6 purple
- You (CFO) → #00C48C teal
- Sara Al-Ahmadi (Senior Accountant) → #3B82F6 blue
- Noor Kandari (Junior) → #8B5CF6 purple
- Jasem Al-Rashed (Junior) → #D4A84B amber
- Layla Habib (AP) → #FF5A5F red

## Tenant Configuration

Three pre-configured tenants via TenantContext with read-time branding transformer (_brandObj in mockEngine.js):

1. **Al Manara Trading** (KIB) — bank-embedded mode, default demo
2. **Al Mawred Corporation** (Boubyan/BBY) — bank-embedded mode
3. **Demo Corporate** (generic) — standalone-direct mode, no bank branding

Transformer rewrites tokens at read time (KIB → BBY, company names, etc.) so single codebase serves all tenants. Header tenant switcher for dev-only switching.

## Build Workflow (LOCKED)

- Claude chat = scope / prompts / decisions
- Claude Code (yolo mode via --dangerously-skip-permissions) = file ops / builds / deploys
- Tarek = orchestrator
- Each terminal command in its own copy block
- Never ask Tarek to cd or navigate paths
- Simplest path only, no alternatives
- Terse, direct, fix everything when asked
- Flag risks briefly, Tarek reviews previews before pushing

## Phase A — COMPLETE (through Step 9)

### Owner View — 9 screens
- Today (BUSINESS PULSE, Aminah's Top Insight, Budget Performance, Needs Your Attention)
- Taskbox (universal task inbox)
- Overview (4-section layout with variance integration)
- Bank Accounts (shared screen, read mode)
- Financial Statements (P&L, Balance Sheet, Cash Flow with Aminah narration, mathematical footing end-to-end)
- Budget (full with multi-role workflow)
- Month-End Close (pre-close validations, close steps, live reconciliation count)
- Audit Bridge (15 continuous checks visualization, hash chain)
- Team (derived responsibilities from rules + routing)
- Settings placeholder

### CFO View — 14 screens
- Today (CFO-specific status strip, NEEDS YOUR REVIEW section)
- Taskbox
- Bank Transactions (categorization with 3-tier confidence: RULE/PATTERN/AI)
- Bank Accounts (shared, edit mode)
- Conversational JE (natural language JE drafting via Aminah)
- Manual JE (split-pane formal double-entry with templates, scheduled, reversal)
- Rules (12 categorization + 8 routing + 5 suggested, with audit trail)
- Reconciliation (3-tier matching engine, side-by-side columns, inline JE creation)
- Budget (full workflow with delegate modal, review actions)
- Forecast placeholder
- Financial Statements placeholder
- Aging Reports placeholder
- Variance Analysis placeholder
- Month-End Close placeholder
- Audit Bridge placeholder
- Setup placeholder

### Junior View (Sara) — 9 screens
- Today (TODAY'S WORK QUEUE with reconciliation exceptions)
- Taskbox (filtered to assigned tasks)
- Bank Transactions (filtered to Sara's assigned accounts)
- Conversational JE (with 1,000 KWD threshold routing)
- Reconciliation (shared screen, Sara owns all reconciliations per routing rules)
- Budget (editing for assigned departments, read-only for others)
- My Responsibilities (derived from rules)
- Bank Accounts (read-only)
- Profile

### Shared Infrastructure
- Universal Taskbox with 9+ task types, linked items, approval flows, threaded replies
- Rules system (categorization + routing + suggestions) with full audit trails
- 3-tier reconciliation matching engine (exact / fuzzy / manual)
- Hash-chained ledger (immutable, engine-owned)
- JournalEntryCard with 4 lifecycle states
- Complete budget workflow state machine (DRAFT → DELEGATED → IN REVIEW → PENDING APPROVAL → ACTIVE → CLOSED)
- Financial Statements with mathematical footing
- Audit Bridge with 15 continuous checks
- Team management with derived responsibilities
- Tenant configuration with read-time branding transformer

## Phase A Deferred Items (post-Phase D+E)

- Step 10: Reporting deeper screens (Aging, Variance Analysis, Trial Balance, GL explorer)
- Step 11: Vendor/Customer registries
- Step 12: Document management (with OCR integration)
- Step 13: Settings / Profile / Setup placeholder cleanups

These are deferred intentionally. They don't block the product's core bookkeeping workflow. They get built on top of the i18n + light mode + responsive + accessible foundation established by Phase D and E.

## Phase D — IN PROGRESS

### Step 14A — i18n infrastructure foundation — COMPLETE
- react-i18next + i18next + i18next-browser-languagedetector installed
- 17 namespaces × 2 languages registered
- localStorage persistence ("haseeb-language" key)
- LanguageContext with LanguageProvider + useLanguage hook
- Sets dir/lang attributes on html element
- Arabic toggle in header wired to actually switch languages
- tokens.css with RTL font fallback (Noto Sans Arabic) + DM Mono LTR override

### Step 14B — Shared infrastructure translation — COMPLETE
- src/i18n/TRANSLATION_RULES.md created as permanent source of truth
- src/components/shared/LtrText.jsx utility for Latin substrings in RTL
- common namespace populated (actions, status, labels, time, currency, common_phrases)
- sidebar namespace populated (groups, items)
- hero namespace populated (labels, status_pills, buttons)
- header namespace extended (notifications, distribution_modes)
- All 3 sidebars refactored to t() calls (CFOSidebar, OwnerSidebar, JuniorSidebar)
- All 3 hero bands refactored to t() calls + LtrText wrapping (OwnerHeroBand, CFOHeroBand, JuniorHeroBand)
- Header tenant switcher and notification dropdown refactored
- Role names locked: Owner=المالك, CFO=المدير المالي, Senior Accountant=محاسب أول, Junior Accountant=محاسب مساعد (NOT محاسب مبتدئ)

**RTL layout issues observed (deferred to Step 14F dedicated RTL pass):**
- Sidebar still anchored LEFT in RTL mode (needs flex-direction: row-reverse on role view containers + border swap on aside)
- Header right-cluster (role pills, bell, theme, language, avatar) still on right in RTL (should mirror to left)
- Sidebar nav active indicator uses inset 2px 0 0 (left border) — RTL needs inset -2px 0 0 (right border)
- Hero band gradient underline points left-to-right — RTL should mirror
- Bebas Neue display headers fall back to Noto Sans Arabic for Arabic (non-issue, visual weight delta)

### Phase D Remaining Steps

- **Step 14C** — CFO screens translation (Today, Bank Transactions, Bank Accounts, Conv JE, Manual JE, Rules, Reconciliation)
- **Step 14D** — Owner + Junior + Budget + Taskbox screens translation
- **Step 14E** — Verification across 3 tenants × 2 languages × 3 roles + bidi/LtrText fixes
- **Step 14F** — Full RTL layout pass (sidebar flip, header mirror, gradient mirror, icon flipping, padding logical properties)
- **Step 15** — Light mode

## Phase E (after Phase D)

- Step 16: Responsive / mobile layouts
- Step 17: Accessibility (ARIA, keyboard nav, focus management)
- Step 18: Error states, empty states, loading states
- Step 19: Performance (bundle size, lazy loading, render optimization)
- Step 20: Final polish pass

## Critical Invariants (NEVER BREAK)

1. src/utils/format.js is UNTOUCHABLE
2. Engine functions additive only (never modify existing signatures)
3. Mock data in mockEngine.js (never split to JSON)
4. All monetary display via format helpers
5. Avatar colors from TASKBOX_PEOPLE
6. Role boundaries enforced (Owner can't post, Junior over threshold → CFO, bank tx never conv JE)
7. Aminah never invents data
8. Hash chain only via engine
9. No new top-level routes outside role views
10. Don't compare Corporate to SME tools (Xero/QuickBooks/Wafeq) — use NetSuite/Sage Intacct/Dynamics/Workday/SAP
11. No free trial CTAs
12. Cairo NOT used for Arabic — use Noto Sans Arabic
13. Every new screen post-14B MUST use t() calls from day one (no hardcoded strings)
14. Follow src/i18n/TRANSLATION_RULES.md for all translation work
15. Role names locked: محاسب مساعد for junior, never محاسب مبتدئ

## Build Session Discipline

- Yolo mode: Claude Code runs with --dangerously-skip-permissions
- Trivial errors fixed inline without asking
- Only flag: scope violations, build breaks, architect-level decisions
- Per-step post-build ritual: git add → commit → push → wait for deploy → output URL → walk verification → note RTL issues → list files
- Prompts from Step 14C onward reference TRANSLATION_RULES.md instead of repeating standing content
