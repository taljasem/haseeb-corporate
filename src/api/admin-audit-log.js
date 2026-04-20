/**
 * Admin Audit Log API module (Track B Dispatch 1, 2026-04-20).
 *
 *   GET /api/admin/audit-log?action=<string>&limit=<n>
 *       — tenant-wide admin audit log, all 4 roles read (AUDITOR
 *         included per dispatch spec).
 *
 * Entry shape:
 *   {
 *     id: string
 *     timestamp: string          // ISO8601
 *     actor: string              // display name
 *     action: string             // e.g. 'login' | 'post_je' | 'integration'
 *     target: string
 *     ipAddress: string
 *   }
 *
 * Notes:
 *   • `action` filter is free-form; the sentinel 'all' means no filter
 *     and is dropped on the wire so the backend returns everything.
 *   • `limit` is clamped to the backend max (500) defensively; the
 *     backend also clamps, but we avoid sending nonsense.
 *   • Personal-scope activity lives at a different endpoint used by the
 *     Settings screen; this one is tenant-wide.
 */
import client from './client';

const BACKEND_MAX_LIMIT = 500;

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
 * GET /api/admin/audit-log
 *
 * @param {{action?: string, limit?: number}} [opts]
 * @returns {Promise<Array>}
 */
export async function listAdminAuditLog(opts = {}) {
  const { action, limit } = opts;
  const params = {};
  if (action && action !== 'all') params.action = action;
  if (Number.isFinite(limit)) {
    params.limit = Math.max(1, Math.min(BACKEND_MAX_LIMIT, Math.floor(limit)));
  }
  const r = await client.get('/api/admin/audit-log', { params });
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}
