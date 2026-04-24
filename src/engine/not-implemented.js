/**
 * not-implemented.js — HASEEB-397 B2+B3 (2026-04-24).
 *
 * Shared helper that returns a uniform "coming soon" response envelope.
 * Used by engine entries where the Corporate backend doesn't ship the
 * route today, OR where the backend route exists but its shape doesn't
 * match the UI's assumptions closely enough for a drop-in wire (requires
 * a screen rewrite tracked as a separate dispatch).
 *
 * The envelope shape:
 *   {
 *     _notImplemented: true,
 *     message:   <EN copy>,
 *     messageAr: <AR copy>,
 *     reason:    'backend_not_shipped' | 'shape_mismatch_requires_screen_rewrite',
 *     // Optional pass-through fields so callers that expect a shape
 *     // (list, object) degrade-but-don't-crash. Callers should key off
 *     // `_notImplemented` before consuming data fields.
 *   }
 *
 * Screens are expected to add a guard:
 *
 *   const data = await getForecast(scenario);
 *   if (data?._notImplemented) { renderComingSoon(data); return; }
 *
 * In the near term, screens that DON'T have the guard will render
 * degraded or crash in LIVE mode — that is intentional per the dispatch
 * brief (architect ruling): honest "this is a stub" is better than
 * silently rendering fake data in production.
 *
 * RATIONALE
 * ─────────
 * Two distinct reason codes capture the two failure modes:
 *   - `backend_not_shipped`
 *       No matching HTTP route exists in the Corporate API today.
 *       Ships when that route lands (spec forwarded to backend lane).
 *   - `shape_mismatch_requires_screen_rewrite`
 *       Backend route exists but its contract is materially different
 *       from what the existing screen assumes (e.g. backend exposes
 *       CRUD rows; UI expects a what-if scenario calculator). The fix
 *       is a UX-level rewrite, not a wire-up.
 */

const _DEFAULT_MESSAGES = {
  backend_not_shipped: {
    en: 'This feature is coming soon.',
    ar: 'هذه الميزة قادمة قريباً.',
  },
  shape_mismatch_requires_screen_rewrite: {
    en: 'This feature is coming soon.',
    ar: 'هذه الميزة قادمة قريباً.',
  },
};

/**
 * Build a canonical not-implemented envelope.
 *
 * @param {('backend_not_shipped'|'shape_mismatch_requires_screen_rewrite')} reason
 * @param {{message?: string, messageAr?: string, extras?: object}} [opts]
 * @returns {object}
 */
export function notImplementedResponse(reason = 'backend_not_shipped', opts = {}) {
  const defaults = _DEFAULT_MESSAGES[reason] || _DEFAULT_MESSAGES.backend_not_shipped;
  const base = {
    _notImplemented: true,
    message: opts.message || defaults.en,
    messageAr: opts.messageAr || defaults.ar,
    reason,
  };
  if (opts.extras && typeof opts.extras === 'object') {
    return { ...base, ...opts.extras };
  }
  return base;
}

/**
 * Async wrapper — some engine callers `await` the response. Produces
 * the same envelope inside a resolved Promise.
 *
 * @param {('backend_not_shipped'|'shape_mismatch_requires_screen_rewrite')} reason
 * @param {{message?: string, messageAr?: string, extras?: object}} [opts]
 * @returns {Promise<object>}
 */
export async function notImplementedAsync(reason = 'backend_not_shipped', opts = {}) {
  return notImplementedResponse(reason, opts);
}
