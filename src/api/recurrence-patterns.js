/**
 * Recurrence Patterns API module — operator actions on tenant-scoped
 * RecurrencePattern rows (Tier C-3 backend, corporate-api HASEEB-183 at
 * `aff0764`, 2026-04-21).
 *
 * The Aminah `get_missing_recurrences` read tool surfaces overdue
 * recurrence-pattern alerts (missed bills from detected merchant
 * recurrences that haven't posted within the expected cadence). This
 * module wraps the ONE mutation that pairs with that read: suspending
 * a pattern so it stops emitting missed-detection alerts until re-
 * activated.
 *
 * Backend endpoint:
 *   POST /api/recurrence-patterns/:id/suspend
 *     body: { reason: string (1..500 chars, required) }
 *     role: OWNER or ACCOUNTANT (maps to midsize Owner/CFO/Senior; the
 *           frontend additionally hides the button for Junior)
 *     returns: { success: true, data: { suspended: true, patternId } }
 *
 * Errors are normalised by `client.js` into
 *   `{ ok:false, status, code, message }`
 * and surface to the caller — the card component decides whether to
 * show an inline error toast/badge.
 */
import client from './client';

function unwrap(response) {
  if (response && response.data && typeof response.data === 'object') {
    if ('data' in response.data && 'success' in response.data) {
      return response.data.data;
    }
    return response.data;
  }
  return response?.data;
}

/**
 * Suspend a recurrence pattern so it stops emitting missed-detection
 * alerts. OWNER / ACCOUNTANT role gate on the backend; the UI hides the
 * action for Junior.
 *
 * @param {string} patternId RecurrencePattern primary key
 * @param {{reason: string}} body Required reason, 1..500 chars
 *   backend-side. The UI pairs this with a 10-char minimum matching
 *   FlagVarianceModal.
 * @returns {Promise<{suspended: true, patternId: string}>}
 */
export async function suspendRecurrencePattern(patternId, { reason } = {}) {
  if (!patternId) throw new Error('suspendRecurrencePattern: patternId is required');
  if (typeof reason !== 'string' || reason.trim() === '') {
    throw new Error('suspendRecurrencePattern: reason is required');
  }
  const r = await client.post(
    `/api/recurrence-patterns/${encodeURIComponent(patternId)}/suspend`,
    { reason },
  );
  return unwrap(r);
}
