/**
 * Monthly Close Checklist API module (FN-227, Phase 4 Wave 1 Item 3).
 *
 * Wraps the structured monthly-close-checklist surface on the Corporate
 * API. Complements the existing AI-advisor-driven month-end-close flow
 * (close.routes.ts) by giving OWNER a manual template-driven checklist
 * with per-item role-gating, Segregation-of-Duties sign-off, and
 * re-open support.
 *
 *   POST   /api/monthly-close-checklist/template
 *          — OWNER creates a template item.
 *          Body: {
 *            label: string,
 *            description?: string,
 *            sortOrder: number,
 *            completeRoleGate: 'OWNER' | 'ACCOUNTANT' | 'OWNER_OR_ACCOUNTANT'
 *          }
 *
 *   PATCH  /api/monthly-close-checklist/template/:id
 *          — OWNER updates a template item (including `isActive`).
 *
 *   GET    /api/monthly-close-checklist/template?activeOnly=true
 *          — OWNER + ACCOUNTANT + AUDITOR lists template items.
 *
 *   POST   /api/monthly-close-checklist/instances
 *          — OWNER + ACCOUNTANT opens an instance for a (fiscalYear,
 *            fiscalMonth). Idempotent — returns the existing open
 *            instance if one already exists for that period.
 *            Body: { fiscalYear: number, fiscalMonth: number }
 *
 *   GET    /api/monthly-close-checklist/instances?status=&fiscalYear=
 *          — OWNER + ACCOUNTANT + AUDITOR lists instances.
 *
 *   GET    /api/monthly-close-checklist/instances/:id
 *          — OWNER + ACCOUNTANT + AUDITOR reads one instance with its
 *            items.
 *
 *   PATCH  /api/monthly-close-checklist/items/:id
 *          — OWNER + ACCOUNTANT marks an instance item.
 *            Body: {
 *              status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED',
 *              blockedReason?: string,   // required when status=BLOCKED
 *              notes?: string
 *            }
 *            Role-gate is enforced per-item per the template's
 *            `completeRoleGate`. Instance auto-advances on item
 *            transitions.
 *
 *   POST   /api/monthly-close-checklist/instances/:id/sign-off
 *          — OWNER only. Requires instance.status=COMPLETED.
 *            Segregation-of-Duties: signer MUST NOT be any item's
 *            `completedBy`. Backend returns 4xx with a descriptive
 *            error message when SoD is violated.
 *
 *   POST   /api/monthly-close-checklist/instances/:id/reopen
 *          — OWNER only. Requires status in {SIGNED_OFF, COMPLETED}.
 *
 * Instance lifecycle: OPEN → IN_PROGRESS → COMPLETED → SIGNED_OFF,
 * with REOPENED for corrections.
 * Item status: PENDING → IN_PROGRESS → COMPLETED → BLOCKED.
 *
 * Response DTOs (JSDoc; the dashboard speaks JSON):
 *
 *   TemplateItem = {
 *     id: string,
 *     tenantId: string,
 *     label: string,
 *     description?: string | null,
 *     sortOrder: number,
 *     completeRoleGate: 'OWNER' | 'ACCOUNTANT' | 'OWNER_OR_ACCOUNTANT',
 *     isActive: boolean,
 *     createdAt: string,
 *     updatedAt: string,
 *   }
 *
 *   Instance = {
 *     id: string,
 *     tenantId: string,
 *     fiscalYear: number,
 *     fiscalMonth: number,
 *     status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'SIGNED_OFF' | 'REOPENED',
 *     signedOffAt?: string | null,
 *     signedOffBy?: string | null,
 *     signedOffByName?: string | null,
 *     createdAt: string,
 *     updatedAt: string,
 *     items?: InstanceItem[],     // hydrated by GET /:id
 *   }
 *
 *   InstanceItem = {
 *     id: string,
 *     instanceId: string,
 *     templateItemId: string,
 *     label: string,
 *     description?: string | null,
 *     sortOrder: number,
 *     completeRoleGate: 'OWNER' | 'ACCOUNTANT' | 'OWNER_OR_ACCOUNTANT',
 *     status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED',
 *     blockedReason?: string | null,
 *     notes?: string | null,
 *     completedAt?: string | null,
 *     completedBy?: string | null,
 *     completedByName?: string | null,
 *   }
 *
 * All endpoints return the standard wrapped envelope `{ success, data }`.
 * Errors are normalised by `src/api/client.js` into:
 *   { ok: false, status, code, message }
 * A 403 indicates the caller's role is insufficient; the UI should
 * degrade gracefully rather than blow up.
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
 * POST /api/monthly-close-checklist/template
 *
 * @param {Object} body
 * @param {string} body.label
 * @param {string} [body.description]
 * @param {number} body.sortOrder
 * @param {'OWNER'|'ACCOUNTANT'|'OWNER_OR_ACCOUNTANT'} body.completeRoleGate
 * @returns {Promise<Object>}  TemplateItem DTO
 */
export async function createTemplateItem(body) {
  const r = await client.post('/api/monthly-close-checklist/template', body);
  return unwrap(r);
}

/**
 * PATCH /api/monthly-close-checklist/template/:id
 *
 * @param {string} id
 * @param {Object} body  any subset of the TemplateItem fields; `isActive`
 *                       supported for soft-deletion.
 * @returns {Promise<Object>}  updated TemplateItem DTO
 */
export async function updateTemplateItem(id, body) {
  const r = await client.patch(
    `/api/monthly-close-checklist/template/${encodeURIComponent(id)}`,
    body
  );
  return unwrap(r);
}

/**
 * GET /api/monthly-close-checklist/template?activeOnly=true
 *
 * @param {boolean} [activeOnly]  if true, only returns items with isActive=true
 * @returns {Promise<Array>}       array of TemplateItem DTOs, sortOrder asc
 */
export async function listTemplateItems(activeOnly) {
  const params = {};
  if (activeOnly != null) params.activeOnly = activeOnly;
  const r = await client.get('/api/monthly-close-checklist/template', { params });
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

/**
 * POST /api/monthly-close-checklist/instances
 *
 * @param {Object} body
 * @param {number} body.fiscalYear
 * @param {number} body.fiscalMonth   1-indexed (1 = January, 12 = December)
 * @returns {Promise<Object>}         Instance DTO (with items hydrated)
 */
export async function openInstance(body) {
  const r = await client.post('/api/monthly-close-checklist/instances', body);
  return unwrap(r);
}

/**
 * GET /api/monthly-close-checklist/instances?status=&fiscalYear=
 *
 * @param {Object} [filter]
 * @param {string} [filter.status]
 * @param {number} [filter.fiscalYear]
 * @returns {Promise<Array>}   array of Instance DTOs (items NOT hydrated)
 */
export async function listInstances(filter = {}) {
  const params = {};
  if (filter.status) params.status = filter.status;
  if (filter.fiscalYear != null) params.fiscalYear = filter.fiscalYear;
  const r = await client.get('/api/monthly-close-checklist/instances', { params });
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

/**
 * GET /api/monthly-close-checklist/instances/:id
 *
 * @param {string} id
 * @returns {Promise<Object>}  Instance DTO with `items` populated
 */
export async function getInstance(id) {
  const r = await client.get(
    `/api/monthly-close-checklist/instances/${encodeURIComponent(id)}`
  );
  return unwrap(r);
}

/**
 * PATCH /api/monthly-close-checklist/items/:id
 *
 * @param {string} id
 * @param {Object} body
 * @param {'PENDING'|'IN_PROGRESS'|'COMPLETED'|'BLOCKED'} body.status
 * @param {string} [body.blockedReason]   required when status=BLOCKED
 * @param {string} [body.notes]
 * @returns {Promise<Object>}             { item: InstanceItem, instance: Instance }
 */
export async function markItemStatus(id, body) {
  const r = await client.patch(
    `/api/monthly-close-checklist/items/${encodeURIComponent(id)}`,
    body
  );
  return unwrap(r);
}

/**
 * POST /api/monthly-close-checklist/instances/:id/sign-off
 *
 * @param {string} id
 * @returns {Promise<Object>}  updated Instance DTO
 */
export async function signOffInstance(id) {
  const r = await client.post(
    `/api/monthly-close-checklist/instances/${encodeURIComponent(id)}/sign-off`
  );
  return unwrap(r);
}

/**
 * POST /api/monthly-close-checklist/instances/:id/reopen
 *
 * @param {string} id
 * @returns {Promise<Object>}  updated Instance DTO
 */
export async function reopenInstance(id) {
  const r = await client.post(
    `/api/monthly-close-checklist/instances/${encodeURIComponent(id)}/reopen`
  );
  return unwrap(r);
}
