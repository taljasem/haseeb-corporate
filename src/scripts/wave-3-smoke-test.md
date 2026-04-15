# Wave 3 Smoke Test — Chat + Writes

**Branch:** `lane2/dashboard-wave-3-chat-and-writes`
**Goal:** verify the three write surfaces (Aminah advisor, ConversationalJE recording, Manual JE composer) work end-to-end against the real Corporate API, with the read paths from Wave 1 and Wave 2 still working.

## 0. Environment

```bash
# Corporate API (read-only worktree, port 3000 per .env.local)
cd ~/Downloads/haseeb-corporate-api-lane2/Hasseb_Standalone_Api
npm run dev

# Corporate frontend (Wave 3 worktree)
cd ~/Downloads/haseeb-corporate-lane2
VITE_USE_MOCKS=false VITE_API_BASE_URL=http://localhost:3000 npm run dev
```

Set `VITE_DEV_JWT` in `.env.local` to a short-lived JWT minted for an `OWNER` or `ACCOUNTANT` role on a test tenant DB. Lane 1's Wave 1 smoke test guide has the mint command.

## 1. Wave 1 + Wave 2 still green

Before touching Wave 3 surfaces, confirm the previous waves haven't regressed:

- [ ] `GET /api/health` succeeds via `ModeIndicator` (top-right dot turns teal, no "offline" fallback).
- [ ] Login flow works with the test JWT (LoginScreen → dashboard).
- [ ] COA tree loads on the Setup screen.
- [ ] Trial Balance / Income Statement / Balance Sheet / Cash Flow render with real numbers.
- [ ] Manual JE list tab (Recent) loads without a red error banner.

If any of these fail, STOP and go back to Wave 1 or Wave 2 before continuing.

## 2. Aminah advisor (read-only)

Test the two advisor surfaces in both OWNER and CFO views.

### 2.1 Owner dashboard — AminahChat left sidebar

- [ ] Open the Owner view. The sidebar shows "AMINAH ONLINE".
- [ ] Click a starter prompt (e.g. "Cash position").
- [ ] Observe: the label flips to "AMINAH THINKING..." while the request is in flight.
- [ ] Assistant reply renders in a chat bubble with the response from the Virtual CFO agent.
- [ ] Network tab: exactly one `POST /api/ai/chat` with body `{message, agent: "aminah", ...}`. No `conversation_id` on the first send.
- [ ] Send a second message ("Tell me more"). Observe the second POST carries the `conversation_id` from the first response's `conversationId`.
- [ ] No `pendingJournalEntry` / no confirmation card renders — advisor is read-only.
- [ ] Switch browser language to Arabic (settings → language). Reload.
- [ ] Send an Arabic prompt. Observe: response renders RTL, Noto Sans Arabic font.

### 2.2 CFO view — AminahSlideOver

- [ ] Open the CFO view. Click the Aminah button in the header. The slide-over opens from the inline-end edge.
- [ ] Click "New conversation". Type "What's the biggest expense category this month?"
- [ ] Observe: inline thinking indicator, single `POST /api/ai/chat` request, assistant bubble with response.
- [ ] Session history strip at the top shows the new session.
- [ ] Close and reopen the slide-over — the last session restores.
- [ ] Confirm RTL + Arabic works identically.

### 2.3 Error cases

- [ ] Stop the API (`Ctrl+C` on the backend). Send a message.
- [ ] Expected: inline error bubble with a localized "I couldn't reach the server" message. The spinner stops.
- [ ] Restart the API. Send a new message. Works again.
- [ ] Send a message with an invalid JWT (temporarily corrupt `VITE_DEV_JWT`).
- [ ] Expected: `CustomEvent('haseeb:session-expired')` fires; AuthContext handles it (LoginScreen or session-expired banner).

## 3. ConversationalJE recording (write path)

Navigate to the CFO → Conversational JE screen (`/conversational-je`).

### 3.1 Empty state

- [ ] Three example chips render. Click "I bought office supplies for 50 KWD with cash".
- [ ] Expected: user bubble + thinking indicator + assistant bubble + inline JournalEntryCard with two lines (Office Supplies debit 50, Cash credit 50).
- [ ] Verify the card shows debit red / credit teal, balanced pill teal, mapping version "live".

### 3.2 HASEEB-001 baseline — confirm

- [ ] Click Confirm on the card.
- [ ] Expected: `POST /api/ai/confirm` with `{action: "confirm", confirmationId: "<uuid>", agent: "haseeb"}`.
- [ ] System message appears: "Posted as JE-0001" (or similar — the entry number comes from the server).
- [ ] Open Manual JE → Recent tab. The new JE is at the top of the list (refreshed via `haseeb:journal-entry-posted` event).

### 3.3 HASEEB-002 multi-turn

- [ ] Back on Conversational JE, type: "I paid the salary of employee John with cheque"
- [ ] Expected: assistant replies with a clarifying prompt listing candidate contracts (compound-entry handler handles this ambiguously).
- [ ] Reply: "I meant the sales contract"
- [ ] Expected: assistant returns a new `pendingJournalEntry` with a new `confirmationId`. The card on screen updates to the new draft.
- [ ] Click Confirm. Verify the JE posts.

### 3.4 Compound entry — cheque-funded salary

- [ ] Type: "I paid 300 KWD salary to Sara by cheque from KIB operating account"
- [ ] Expected: the card has 3 lines (salary expense DR, cheques-in-transit CR, or similar — the compound-entry handler decides the structure).
- [ ] Confirm. Verify posted.

### 3.5 Edit path

- [ ] Type: "I received 1000 KWD from client ABC for consulting"
- [ ] When the card renders, click Edit.
- [ ] Expected: navigation to Manual JE screen with the draft pre-filled (date, description, lines populated with the accountCodes and amounts).
- [ ] The composer title shows "MANUAL JOURNAL ENTRY" (a fresh new draft).
- [ ] Network tab: `POST /api/ai/confirm` with `{action: "edit"}` fires (releases the server-side confirmation token).
- [ ] Edit the description, click Save Draft. Entry persists as DRAFT on the server.
- [ ] Click Save and Post. Entry flips to POSTED.

### 3.6 Discard

- [ ] Type: "I bought lunch for 10 KWD cash"
- [ ] When the card renders, click Discard.
- [ ] Expected: `POST /api/ai/confirm` with `{action: "cancel"}` fires. System message: "Discarded. No entry was created."
- [ ] The card disappears. Thread remains.

### 3.7 Error states

- [ ] Type an intentional nonsense: "fjdksljfkldsjf"
- [ ] Expected: assistant returns a plain text "I didn't understand" reply. No card. Input re-enables.
- [ ] Stop the API. Send any message. Expected: error bubble with Retry button.
- [ ] Click Retry. Start the API. Same message replays and succeeds.

### 3.8 Arabic + RTL

- [ ] Switch to Arabic.
- [ ] Empty state: three Arabic examples.
- [ ] Type an Arabic prompt. Response renders RTL. Card labels and buttons translated.

## 4. Manual JE composer (local state + atomic POST)

Navigate to CFO → Manual JE.

### 4.1 New blank flow (create then post)

- [ ] Click "New". Observe: a fresh blank draft opens. No `POST /api/journal-entries` fires yet.
- [ ] Fill in: date = today, description = "Smoke test entry", reference = "TEST-001".
- [ ] Add a second line, then a third. Set line 1 = Cash DR 100, line 2 = Office Supplies CR 100.
- [ ] Observe: total debits / credits update live. "BALANCED" pill goes teal.
- [ ] Validation: set line 1 debit to 150. "OUT OF BALANCE" pill goes red. Errors list shows "Total debits must equal total credits".
- [ ] Restore 100. Click "Save Draft". Observe: **exactly one** `POST /api/journal-entries` with `status: "DRAFT"`. Toast: "Draft saved".
- [ ] Click the draft in the Drafts list. Composer opens pre-populated.
- [ ] Edit the description. Click "Save Draft". Exactly one `PATCH /api/journal-entries/:id`. No per-keystroke POSTs.
- [ ] Click "Save and Post". `POST /api/journal-entries/:id/validate`. Status flips to POSTED, JE moves to Recent tab.

### 4.2 New blank flow (create posted directly)

- [ ] Click "New". Fill in a balanced entry.
- [ ] Click "Save and Post". Observe: a single `POST /api/journal-entries` with `status: "POSTED"`. No intermediate DRAFT create-then-post round-trip.

### 4.3 Edit existing posted — reversal

- [ ] In the Recent tab, open a POSTED entry.
- [ ] The composer is read-only except for the Reverse button.
- [ ] Click "Reverse Entry". Modal opens with a list of the lines and a reason input.
- [ ] Enter a reason. Confirm. `POST /api/journal-entries/:id/reverse` fires.
- [ ] A new reversal draft appears in the Drafts list.

### 4.4 Discard new draft

- [ ] Click "New". Fill in some fields. Click "Discard".
- [ ] Expected: draft disappears. Zero server calls (the client-only draft was never persisted).

### 4.5 Error cases

- [ ] Click "New". Leave description empty. Click "Save and Post".
- [ ] Expected: 422 from backend validator. Red error banner above the form. Draft state preserved.
- [ ] Fill description. Save again. Works.
- [ ] Create an unbalanced entry. "Save and Post" button stays disabled (client-side validation blocks it).

## 5. Known gaps (NOT tested in Wave 3)

- Schedule / Post Now / Save as Template: no backend endpoint, still mock.
- File attachments on JEs: no backend endpoint, still mock.
- Period close / soft-close approval routing: no backend endpoint.
- Junior threshold → CFO approval flow: backend does not emit distinct pending-approval payload yet.
- Taskbox, forecast, aging write surfaces: not in Wave 3 scope.

## 6. Wall checklist

- [ ] All three surfaces tested in English and Arabic.
- [ ] Dark mode + light mode both render (theme toggle in settings).
- [ ] Role views: Owner, CFO, Junior — all load ConversationalJE without crashing.
- [ ] Accessibility: input fields have `aria-label`, buttons have proper `type="button"`, keyboard focus rings visible.
- [ ] `haseeb:journal-entry-posted` event fires on confirm — Manual JE list refreshes automatically.
- [ ] Wave 1 ModeIndicator still works (teal = LIVE, amber = MOCK).
- [ ] Wave 2 read screens still load (login, settings, reports, COA, JE read).
