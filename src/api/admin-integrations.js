/**
 * Admin Integrations API module (Track B Dispatch 1, 2026-04-20).
 *
 *   GET    /api/admin/integrations          — list, all 4 roles
 *   POST   /api/admin/integrations          — connect / add, OWNER + ACCOUNTANT
 *   DELETE /api/admin/integrations/:id      — disconnect, OWNER + ACCOUNTANT
 *
 * Integration shape:
 *   {
 *     id: string
 *     name: string
 *     category: string              // e.g. "Banking" / "POS" / "HR"
 *     status: 'connected' | 'disconnected' | 'error'
 *     lastSync: string | null       // ISO8601 or null
 *   }
 *
 * SECURITY: credentials MUST NEVER appear in any response. The POST body
 * carries `{ id, credentials? }`; `credentials` is write-only and the
 * server strips it from every response. This module does not persist
 * credentials locally.
 *
 * Errors are normalised by client.js into `{ ok:false, status, code,
 * message }` and surface to callers — callers decide whether to toast
 * or silently degrade.
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
 * GET /api/admin/integrations
 * @returns {Promise<Array>} integrations array
 */
export async function listAdminIntegrations() {
  const r = await client.get('/api/admin/integrations');
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

/**
 * POST /api/admin/integrations
 * Connect or add an integration. `credentials` is write-only and never
 * echoed back in the response.
 *
 * @param {string|{id:string, credentials?:object}} idOrPayload
 * @returns {Promise<{integration, connected:boolean}>}
 */
export async function addAdminIntegration(idOrPayload) {
  const body =
    typeof idOrPayload === 'string'
      ? { id: idOrPayload }
      : { id: idOrPayload?.id, credentials: idOrPayload?.credentials };
  const r = await client.post('/api/admin/integrations', body);
  return unwrap(r);
}

/**
 * DELETE /api/admin/integrations/:id
 * @param {string} id
 * @returns {Promise<{deleted:true}>}
 */
export async function removeAdminIntegration(id) {
  const r = await client.delete(
    `/api/admin/integrations/${encodeURIComponent(id)}`
  );
  return unwrap(r);
}
