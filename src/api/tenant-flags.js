/**
 * Tenant Flags API module.
 *
 *   GET   /api/tenant-flags                — read current flags (all 4 roles)
 *   PATCH /api/tenant-flags                — partial update (OWNER + ACCOUNTANT)
 *
 * Flag shape:
 *   {
 *     hasForeignActivity: boolean
 *     updatedBy?: string
 *     updatedAt?: string
 *   }
 *
 * History: shipped 2026-04-19 with a localStorage fallback while the
 * backend was pending. Backend went live on corporate-api main at commit
 * `fba2896` (Track B Dispatch 1, 2026-04-20); this wrapper is now a
 * pure HTTP surface. Errors are normalised by client.js into
 * `{ ok:false, status, code, message }` and surface to callers.
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

export async function getTenantFlags() {
  const r = await client.get('/api/tenant-flags');
  return unwrap(r);
}

export async function updateTenantFlags(patch) {
  const sanitized = {};
  if (typeof patch?.hasForeignActivity === 'boolean') {
    sanitized.hasForeignActivity = patch.hasForeignActivity;
  }
  const r = await client.patch('/api/tenant-flags', sanitized);
  return unwrap(r);
}
