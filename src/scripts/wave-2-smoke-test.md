# Wave 2 smoke test

This guide walks the Corporate dashboard end-to-end against a live
Corporate API. Wave 2 wires login, financial statements, chart of
accounts, journal entries list, and basic settings. Aminah chat,
forecasts, taskbox, and most aggregations stay on mock fallback.

## Prerequisites

1. **Corporate API running at localhost:3000**
   ```bash
   cd ~/Downloads/haseeb-corporate-api-lane2/Hasseb_Standalone_Api
   npm run dev
   ```
   Make sure the API has `FRONTEND_URL=http://localhost:5173` in its
   `.env` so CORS allows the Vite dev server (see dashboard inventory
   §"Architectural snapshot" point 10).

2. **Dev tenant seeded** with:
   - Tenant slug: `dev-tenant`
   - Email: `dev@haseeb.local`
   - Password: `DevPassword123!`

3. **Dashboard `.env.local` configured**:
   ```
   VITE_USE_MOCKS=false
   VITE_API_BASE_URL=http://localhost:3000
   VITE_DEV_PREFILL_CREDENTIALS=true
   ```
   `VITE_DEV_JWT` should be empty — Wave 2 manages the token at runtime
   via the login flow.

## Sequence

1. `cd ~/Downloads/haseeb-corporate-lane2 && npm run dev`
2. Open http://localhost:5173 — should render the **Login screen**.
3. **Step 1 — slug**: the form pre-fills `dev-tenant` if
   `VITE_DEV_PREFILL_CREDENTIALS=true`. Click **Next**.
4. The tenant name returned by `GET /api/auth/tenant-by-slug/:slug`
   should appear at the top of step 2 ("Signing in to … Change").
5. **Step 2 — credentials**: email + password are pre-filled if
   prefill is on. Click **Sign in**. The `POST /api/auth/login` request
   fires; on success the screen swaps to the authenticated dashboard
   shell. The mode badge (top-right) should still read `LIVE`.
6. **Owner overview / Today** loads. These screens are on **mock
   fallback** in LIVE mode (no API support yet) — they will render the
   same data as MOCK mode and you'll see one
   `[engine] mock fallback for getXxx()` warning per function in the
   browser console. This is expected.
7. **Open Aminah chat** (sidebar or overlay). Send "How am I doing?".
   Aminah replies with a streamed mock response. Wave 2 leaves the
   streaming chat UI on the local stub backend — the new
   `/api/ai/chat` wiring is in place but not consumed by the default
   chat surface (see "Known limitations").
8. **Navigate to Financial Statements** (Owner sidebar → Financial
   Statements; or CFO sidebar → Financial Statements).
   - The screen should briefly show "Loading financial statements…"
   - Then render the Income Statement tab. On a freshly seeded tenant
     with no journal entries, you should see the empty-state banner:
     "Not enough activity to generate this report. Record some
     transactions first, then come back."
   - Switch to Balance Sheet and Cash Flow tabs. Each should fetch
     against the corresponding `/api/reports/...` endpoint.
9. **Navigate to Setup → Chart of Accounts** (CFO sidebar → Setup → first
   tab is Chart of Accounts). Should fetch from `GET /api/accounts` and
   render the seeded CoA grouped by Assets / Liabilities / Equity /
   Revenue / Expenses. If the seed hasn't completed yet, you'll see the
   "Chart of accounts is being set up" empty state and can refresh.
10. **Navigate to Manual JE** (CFO sidebar → Manual JE).
    - The Drafts tab will be empty on a fresh tenant.
    - The Recent Posted tab will be empty on a fresh tenant.
    - Templates and Scheduled fall back to mock for now (templates have
      no backend; scheduled is filtered locally to an empty list).
    - **Do not click "New JE" / "Post" against a LIVE tenant.** Wave 2
      does not wire ledger writes; the engine router will throw
      `[engine] postManualJE() is a write operation that has not been
      wired…` if you try.
11. **Navigate to Settings → Account**.
    - Profile pulls from `GET /api/auth/me` (adapted to the mock
      profile shape). You should see your dev user's name and email,
      plus the tenant name from the auth context.
    - Click **Change password**. The modal calls
      `POST /api/auth/change-password` against the real API. NB: the
      backend invalidates other sessions and returns a new token, but
      Wave 2 does not yet swap the in-memory token after change — this
      is a known limitation, you'll be 401'd on the next call and
      bounced to login.
    - Click **Sign out**. Should call `DELETE /api/auth/sessions`,
      clear localStorage, and the screen should swap to the Login page.

## Expected console warnings (these are normal)

- `[engine] mock fallback for getBusinessPulse(); no API support yet`
- `[engine] mock fallback for getCFOTodayQueue(); no API support yet`
- `[engine] mock fallback for getOwnerTopInsightDynamic(); no API support yet`
- `[engine] mock fallback for getMonthlyInsights(); no API support yet`
- `[engine] mock fallback for getTaskbox(); no API support yet`
- `[engine] mock fallback for getForecast(); no API support yet`
- ...and similar for every function on the landing screens that does
  not have a backend yet. One warning per function, not per call.

## Known limitations (out of scope for Wave 2)

- **Aminah chat is still on mock fallback.** The streaming chat UI
  speaks an event protocol (tool.call_started, message.text_delta,
  message.complete) that does not match the single-shot
  `POST /api/ai/chat` response. Adapting it would require a deep
  refactor of `AminahChat.jsx` / `AminahSlideOver.jsx` and is out of
  Wave 2 scope. The new `src/api/chat.js` module is in place and
  ready for Wave 3 to consume it (e.g. ConversationalJEScreen demo
  flow).
- **Owner Overview, Owner Today, CFO Today, Forecast, Variance, Aging,
  Bank Transactions, Reconciliation, Taskbox, Month-End Close,
  Audit Bridge** are all on mock fallback. Either no backend exists or
  the surface mismatch is too large for Wave 2.
- **Ledger writes are blocked in LIVE mode.** Posting / drafting /
  reversing / scheduling JEs throws a loud error in LIVE mode. Wave 3
  wires these.
- **No password reset.** The login screen shows "Contact your
  administrator" instead of a forgot-password link, because the API
  has no `/api/auth/forgot-password` endpoint (auth audit §G15).
- **24h hard session expiry, no refresh.** When the JWT expires, the
  next API call returns 401, the axios interceptor dispatches
  `haseeb:session-expired`, AuthContext clears state, and the user is
  bounced to login with a flash banner. There is no silent refresh.
- **Login UI is English-only.** Adding an i18n namespace for login
  would balloon the file count beyond the Wave 2 budget. Direction
  (LTR/RTL) still flips correctly via LanguageContext.
- **Change-password does not rotate the in-memory token** after a
  successful change. The backend returns a new token and revokes all
  other sessions; the dashboard does not yet pick up the new token, so
  the very next API call after a successful password change will 401
  and bounce the user to login. Wave 3 fix.

## Troubleshooting

- **CORS errors in the browser console**: the Corporate API's
  `FRONTEND_URL` is wrong. Set it to `http://localhost:5173` in the API's
  `.env` and restart the API.
- **401 immediately after login**: the API's `JWT_SECRET` may be
  rotating between the API process and any cached client. Restart both.
- **"Can't reach the server" on the login page**: the Corporate API is
  not running at `VITE_API_BASE_URL`. Check `lsof -i :3000` and
  `npm run dev` in the API repo.
- **CoA empty state stays forever**: the fire-and-forget
  `provisionTenantAccounts` may have failed (see auth audit §G9).
  Re-seed the tenant or call the superadmin re-seed endpoint.
- **Mode badge says MOCK after I set `VITE_USE_MOCKS=false`**: Vite
  caches env vars at process start. Stop the dev server and `npm run dev`
  again.
