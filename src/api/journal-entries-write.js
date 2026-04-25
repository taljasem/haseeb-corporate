/**
 * Journal entries write API module (Wave 3).
 *
 * Wraps the write side of /api/journal-entries. Reads are in
 * `./journal-entries.js`; the split keeps the Wave 2 read module
 * unchanged and makes it obvious which call writes to the ledger.
 *
 * Contract reference: memory-bank/wave-3-write-contract.md §2-5, plus
 * the post-implementation prep delta appended for Wave 3 which
 * documents the shipped line schema:
 *
 *   • Line schema accepts exactly one of
 *       accountId   (UUID)
 *     | accountCode (string — "1110")
 *     | accountRole (enum string — "BANK_PRIMARY")
 *     enforced via `.superRefine()` at journal-entry.schemas.ts:52-68.
 *   • `debit` / `credit` accept non-negative numbers OR decimal
 *     strings up to 6 decimal places. The frontend uses decimal
 *     strings to sidestep JS float rounding on sub-fils amounts.
 *   • Standard envelope `{ success, data, error }` on this endpoint
 *     (unlike /api/ai/chat which returns a bare envelope).
 *
 * Status lifecycle:
 *   POST   /api/journal-entries                  → DRAFT or POSTED
 *   PATCH  /api/journal-entries/:id              → update DRAFT fields
 *   POST   /api/journal-entries/:id/validate     → promote DRAFT → POSTED
 *   POST   /api/journal-entries/:id/reverse      → create reversal entry
 *   POST   /api/journal-entries/:id/void         → mark as VOID
 */
import client from './client';

function unwrap(response) {
  // Standard envelope { success, data } — fall back to raw body if a
  // future route ever returns a bare payload.
  if (response && response.data && typeof response.data === 'object') {
    if ('data' in response.data && 'success' in response.data) {
      return response.data.data;
    }
    return response.data;
  }
  return response?.data;
}

/**
 * Convert a monetary value into the Decimal-safe string form the
 * backend accepts. Empty/undefined/null → '0'. Numbers get `.toFixed(3)`
 * to guarantee ≤ 3 dp for KWD. Strings pass through trimmed (the
 * backend accepts up to 6 dp, but we stay at 3 for KWD convention).
 */
function toDecimalString(v) {
  if (v == null || v === '') return '0';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return '0';
    return v.toFixed(3);
  }
  return String(v).trim() || '0';
}

/**
 * Normalise a line from whatever shape the UI is holding (the manual
 * composer and the AI confirmation card each have their own local
 * shape) into the API line shape.
 *
 * Exactly one account identifier must be present on output:
 *   - Prefer `accountId` when the caller has a UUID.
 *   - Otherwise use `accountCode` (the existing AccountPicker emits
 *     codes, and the Wave 3 shipped schema accepts codes).
 *   - Fall back to `accountRole` as a last resort.
 */
function normaliseLine(line) {
  const out = {
    debit: toDecimalString(line.debit),
    credit: toDecimalString(line.credit),
  };
  if (line.description || line.memo) {
    out.description = line.description || line.memo;
  }
  // HASEEB-509: pass per-line Arabic memo through to the backend.
  // The backend column `descriptionAr` exists; the live verification
  // harness caught this adapter stripping it before the POST body left
  // the browser, leaving the persisted entry with descriptionAr=null.
  if (line.descriptionAr || line.memoAr) {
    out.descriptionAr = line.descriptionAr || line.memoAr;
  }
  if (line.accountId) {
    out.accountId = line.accountId;
  } else if (line.accountCode || line.code) {
    out.accountCode = line.accountCode || line.code;
  } else if (line.accountRole) {
    out.accountRole = line.accountRole;
  }
  return out;
}

/**
 * POST /api/journal-entries — create a draft or posted entry.
 *
 * Call shape (the arguments the ManualJEComposer and
 * ConversationalJEScreen actually pass):
 *
 *   createJournalEntry({
 *     date,            // ISO string
 *     description,
 *     reference?,
 *     currency?,       // default 'KWD'
 *     status?,         // 'DRAFT' | 'POSTED' (default POSTED per backend)
 *     lines: [{ accountCode|accountId|accountRole, debit, credit, description? }]
 *   })
 */
export async function createJournalEntry(payload) {
  const body = {
    date: payload.date,
    description: payload.description || '',
    // HASEEB-509: header Arabic narrative was being stripped by this
    // adapter even though the composer accepts it and the backend
    // `descriptionAr` column exists. Pass it through when present.
    ...(payload.descriptionAr ? { descriptionAr: payload.descriptionAr } : {}),
    ...(payload.reference ? { reference: payload.reference } : {}),
    ...(payload.currency ? { currency: payload.currency } : {}),
    ...(payload.status ? { status: payload.status } : {}),
    ...(payload.source ? { source: payload.source } : {}),
    ...(payload.notes ? { notes: payload.notes } : {}),
    lines: (payload.lines || []).map(normaliseLine),
  };
  const r = await client.post('/api/journal-entries', body);
  return unwrap(r);
}

/**
 * PATCH /api/journal-entries/:id — update a draft entry.
 * Only DRAFT entries can be edited; the backend rejects PATCH on
 * POSTED entries with INVALID_STATUS.
 */
export async function updateJournalEntryDraft(id, payload) {
  const body = {
    ...(payload.date ? { date: payload.date } : {}),
    ...(payload.description != null ? { description: payload.description } : {}),
    // HASEEB-509: PATCH path needs the same Arabic-narrative passthrough
    // as POST so a Draft edit doesn't silently null out the field.
    ...(payload.descriptionAr != null ? { descriptionAr: payload.descriptionAr } : {}),
    ...(payload.reference != null ? { reference: payload.reference } : {}),
    ...(payload.currency ? { currency: payload.currency } : {}),
    ...(payload.notes != null ? { notes: payload.notes } : {}),
    ...(payload.lines
      ? { lines: payload.lines.map(normaliseLine) }
      : {}),
  };
  const r = await client.patch(
    `/api/journal-entries/${encodeURIComponent(id)}`,
    body
  );
  return unwrap(r);
}

/**
 * HASEEB-482 (DECISION-026 Phase 2 frontend, 2026-04-24) — promote
 * DRAFT → POSTED via the JE approval engine.
 *
 *   POST /api/journal-entries/approvals/:id/approve  body: { notes? }
 *
 * The legacy `/validate` route still exists in the backend (HASEEB-481
 * intentionally preserved it; HASEEB-483 Phase 3 retires it after this
 * frontend rewire ships). We point ALL frontend post-paths through the
 * approval engine so SoD enforcement and source-based auto-post tier
 * routing apply uniformly.
 *
 * Error contract:
 *   - 403 SoDViolationError  → caller (UI) catches and disables the
 *                              Post button with the bilingual
 *                              "different reviewer must approve"
 *                              message.
 *   - 400 INVALID_STATUS     → entry already POSTED or in a non-
 *                              approvable state; UI re-fetches.
 *   - 400 UNBALANCED_ENTRY   → debit / credit mismatch; UI surfaces.
 *   - 422 ValidationError    → policy or amount edge cases (e.g. above
 *                              the active-policy ceiling); UI shows
 *                              the bilingual error.message.
 */
export async function postJournalEntry(id, opts = {}) {
  const body = opts.notes ? { notes: String(opts.notes) } : {};
  const r = await client.post(
    `/api/journal-entries/approvals/${encodeURIComponent(id)}/approve`,
    body,
  );
  return unwrap(r);
}

/**
 * Alias of postJournalEntry kept for callers that prefer the explicit
 * "approve" verb over the legacy "post" one. They hit the same
 * endpoint; the route layer accepts both flow names because the
 * approval engine is now the single source of truth for promoting a
 * DRAFT to POSTED.
 */
export async function approveJournalEntry(id, opts = {}) {
  return postJournalEntry(id, opts);
}

/**
 * POST /api/journal-entries/approvals/:id/reject  body: { notes? }
 * Mirrors approveJournalEntry. Used by the approvals queue surface;
 * not currently called from ManualJEScreen but exported for parity.
 */
export async function rejectJournalEntry(id, opts = {}) {
  const body = opts.notes ? { notes: String(opts.notes) } : {};
  const r = await client.post(
    `/api/journal-entries/approvals/${encodeURIComponent(id)}/reject`,
    body,
  );
  return unwrap(r);
}

/**
 * POST /api/journal-entries/:id/reverse — create a reversal entry.
 */
export async function reverseJournalEntry(id, reason) {
  const r = await client.post(
    `/api/journal-entries/${encodeURIComponent(id)}/reverse`,
    reason ? { reason } : {}
  );
  return unwrap(r);
}

/**
 * POST /api/journal-entries/:id/void — mark a posted entry as VOID.
 */
export async function voidJournalEntry(id, reason) {
  const r = await client.post(
    `/api/journal-entries/${encodeURIComponent(id)}/void`,
    reason ? { reason } : {}
  );
  return unwrap(r);
}
