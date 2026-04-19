/**
 * Disallowance Rules API module (FN-222, Phase 4 Track A Wave 2 — 2026-04-19).
 *
 * Wraps the Kuwait CIT disallowance-rule register on the Corporate API.
 * Rules drive automatic tagging of DISALLOWED_EXPENSES lines during the
 * four-levy (FN-233) pipeline; OWNER-only mutation; read surface open to
 * OWNER + ACCOUNTANT + VIEWER + AUDITOR.
 *
 *   POST   /api/disallowance-rules          — create rule. Role: OWNER.
 *   PATCH  /api/disallowance-rules/:id      — update rule. Role: OWNER.
 *   POST   /api/disallowance-rules/:id/deactivate — deactivate by closing
 *                                                   activeUntil to today.
 *                                                   Role: OWNER.
 *   GET    /api/disallowance-rules          — list with filters.
 *   GET    /api/disallowance-rules/:id      — read one.
 *
 * DisallowanceRule DTO (JSDoc; dashboard speaks JSON):
 *   {
 *     id: string
 *     name: string
 *     description?: string | null
 *     ruleType: 'ENTERTAINMENT_CAP_PERCENT' | 'PERSONAL_USE' |
 *               'RELATED_PARTY' | 'CUSTOM'
 *     disallowedPercent: number             // 0..100 integer
 *     targetRole?: string | null            // AccountRole name, e.g.
 *                                           // 'ENTERTAINMENT_EXPENSE'
 *     targetAccountId?: string | null       // uuid — COA row id
 *     activeFrom: string                    // ISO8601 date-only
 *     activeUntil?: string | null           // ISO8601 date-only
 *     notes?: string | null
 *     createdAt: string
 *     updatedAt: string
 *   }
 *
 * At least one of `targetRole` / `targetAccountId` must be set when
 * creating. The list filter `activeOnly=true` respects `asOf` (default
 * today) and returns only rules whose [activeFrom, activeUntil) window
 * includes the date.
 *
 * Errors normalised by src/api/client.js. A 403 on create/update/
 * deactivate means the user is not OWNER.
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
 * GET /api/disallowance-rules
 *
 * @param {Object} [filters]
 * @param {'ENTERTAINMENT_CAP_PERCENT'|'PERSONAL_USE'|'RELATED_PARTY'|'CUSTOM'} [filters.ruleType]
 * @param {boolean} [filters.activeOnly]
 * @param {string}  [filters.asOf]              ISO8601 date-only
 * @returns {Promise<Array>}                    DisallowanceRule[]
 */
export async function listDisallowanceRules(filters = {}) {
  const params = {};
  if (filters.ruleType) params.ruleType = filters.ruleType;
  if (filters.activeOnly != null) params.activeOnly = filters.activeOnly;
  if (filters.asOf) params.asOf = filters.asOf;
  const r = await client.get('/api/disallowance-rules', { params });
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

/**
 * GET /api/disallowance-rules/:id
 *
 * @param {string} id
 * @returns {Promise<Object>}                   DisallowanceRule, or null
 */
export async function getDisallowanceRule(id) {
  const r = await client.get(`/api/disallowance-rules/${encodeURIComponent(id)}`);
  return unwrap(r);
}

/**
 * POST /api/disallowance-rules
 *
 * @param {Object} payload                      see DisallowanceRule DTO
 * @returns {Promise<Object>}                   created rule
 */
export async function createDisallowanceRule(payload) {
  const r = await client.post('/api/disallowance-rules', payload);
  return unwrap(r);
}

/**
 * PATCH /api/disallowance-rules/:id
 *
 * Note: the server schema intentionally does NOT permit changing
 * `ruleType`, `targetRole`, or `targetAccountId` post-creation —
 * recategorising a rule would break the audit chain. If those need to
 * change, deactivate the old rule and create a new one.
 *
 * @param {string} id
 * @param {Object} patch
 * @returns {Promise<Object>}
 */
export async function updateDisallowanceRule(id, patch) {
  const r = await client.patch(
    `/api/disallowance-rules/${encodeURIComponent(id)}`,
    patch,
  );
  return unwrap(r);
}

/**
 * POST /api/disallowance-rules/:id/deactivate
 *
 * Server closes the rule's activeUntil window rather than hard-deleting
 * it — history is preserved for audit.
 *
 * @param {string} id
 * @returns {Promise<Object>}                   deactivated rule
 */
export async function deactivateDisallowanceRule(id) {
  const r = await client.post(
    `/api/disallowance-rules/${encodeURIComponent(id)}/deactivate`,
  );
  return unwrap(r);
}
