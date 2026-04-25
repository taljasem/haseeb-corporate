/**
 * Journal entries API module.
 *
 * Wraps GET /api/journal-entries and GET /api/journal-entries/:id, plus
 * a backwards-compatible `getManualJEs(filter)` / `getManualJEById(id)`
 * pair for the existing ManualJEScreen which expects the mockEngine shape.
 *
 * Shape adapter:
 *   API returns Prisma JournalEntry rows with lines and accounts.
 *   ManualJEScreen expects { id, date, description, status, lines: [...],
 *   postedAt, createdAt, scheduledFor, memo, ... }. The mapper below
 *   fills in the fields the UI reads, leaving anything it doesn't read
 *   to hang off `raw`.
 */
import client from './client';

function unwrap(response) {
  if (response && response.data && typeof response.data === 'object') {
    if ('data' in response.data) return response.data.data;
    return response.data;
  }
  return response?.data;
}

/**
 * Transform an API JournalEntry into the shape the mock-originated UI reads.
 */
function adaptEntry(entry) {
  if (!entry) return null;
  const lines = Array.isArray(entry.lines) ? entry.lines : [];
  return {
    id: entry.id || entry.entryNumber || '',
    entryNumber: entry.entryNumber || entry.id || '',
    date: entry.date || entry.entryDate || entry.createdAt || null,
    description: entry.description || entry.memo || entry.narrative || '',
    memo: entry.memo || entry.description || '',
    status:
      (entry.status || '').toString().toLowerCase() === 'posted'
        ? 'posted'
        : (entry.status || '').toString().toLowerCase() === 'draft'
        ? 'draft'
        : (entry.status || 'posted').toString().toLowerCase(),
    postedAt: entry.postedAt || entry.date || entry.createdAt || null,
    createdAt: entry.createdAt || entry.date || null,
    scheduledFor: entry.scheduledFor || null,
    // HASEEB-466: backend EntrySource enum is uppercase. The API
    // already returns uppercase values; the fallback is now uppercase
    // too so the round-trip stays consistent through ManualJEScreen's
    // dropdown (which writes the same casing back to the wire).
    source: entry.source || entry.origin || 'MANUAL',
    reference: entry.reference || '',
    lines: lines.map((l, i) => ({
      id: l.id || `L${i + 1}`,
      accountCode: l.accountCode || l.account?.code || l.code || '',
      accountName: l.accountName || l.account?.nameEn || l.account?.name || '',
      debit: Number(l.debit || l.debitAmount || 0),
      credit: Number(l.credit || l.creditAmount || 0),
      memo: l.memo || l.description || '',
    })),
    // Aggregate totals used by the list view.
    totalDebit: lines.reduce((s, l) => s + Number(l.debit || l.debitAmount || 0), 0),
    totalCredit: lines.reduce((s, l) => s + Number(l.credit || l.creditAmount || 0), 0),
    // HASEEB-482 (DECISION-026 Phase 2, 2026-04-24): surface the
    // approval-engine state + proposer id so the ManualJEScreen Post
    // button can decide visibility (AUTO_APPROVED hides it; PENDING_*
    // shows it; SoD self-approval is gated client-side as well as
    // server-side). Backend uppercase enum (AUTO_APPROVED |
    // PENDING_REVIEW | PENDING_APPROVAL | PENDING_BOARD | APPROVED |
    // REJECTED) is preserved verbatim — the UI compares against the
    // enum strings directly.
    approvalState: entry.approvalState || null,
    createdBy: entry.createdBy || entry.createdById || null,
    raw: entry,
  };
}

export async function listJournalEntries(filter = {}) {
  const params = {};
  if (filter.dateFrom) params.dateFrom = filter.dateFrom;
  if (filter.dateTo) params.dateTo = filter.dateTo;
  if (filter.status) params.status = filter.status;
  if (filter.limit) params.limit = filter.limit;
  const r = await client.get('/api/journal-entries', { params });
  const data = unwrap(r);
  const arr = Array.isArray(data) ? data : data?.entries || data?.items || [];
  return arr.map(adaptEntry);
}

export async function getJournalEntry(id) {
  const r = await client.get(`/api/journal-entries/${encodeURIComponent(id)}`);
  return adaptEntry(unwrap(r));
}

/**
 * Backwards-compat wrapper for the existing ManualJEScreen.
 * Filter values map to status + date ordering:
 *   'recent-posted' → status=POSTED, recent first
 *   'drafts'        → status=DRAFT
 *   'scheduled'     → status=SCHEDULED (if backend supports it; empty otherwise)
 *   'all' / other   → no filter
 */
export async function getManualJEs(filter = 'all') {
  let statusFilter;
  if (filter === 'recent-posted') statusFilter = 'POSTED';
  else if (filter === 'drafts') statusFilter = 'DRAFT';
  else if (filter === 'scheduled') statusFilter = 'SCHEDULED';

  try {
    const entries = await listJournalEntries({ status: statusFilter, limit: 50 });
    if (filter === 'scheduled') {
      // If the backend doesn't know about SCHEDULED, return empty rather than crash.
      return entries.filter((e) => e.status === 'scheduled');
    }
    return entries;
  } catch (err) {
    // Re-throw with context so the UI error banner can show something useful.
    throw err;
  }
}

export async function getManualJEById(id) {
  return getJournalEntry(id);
}
