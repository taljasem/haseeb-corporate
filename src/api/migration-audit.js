/**
 * Migration Audit Trail API module (FN-245, Phase 4 Track A Tier 5
 * — 2026-04-19).
 *
 * Read-only surface over the append-only migration-audit register.
 * The audit rows are written service-layer only by the migrate-tenants
 * runner (HASEEB-127 lineage) — inalterability of the trail is the
 * point. All HTTP access is read-only to OWNER + AUDITOR.
 *
 *   GET    /api/migration-audit               — list + filters
 *   GET    /api/migration-audit/schema-chain  — per-row chain integrity
 *   GET    /api/migration-audit/:id           — read one
 *
 * MigrationAudit DTO:
 *   {
 *     id: string
 *     migrationName: string
 *     appliedAt: string                       // ISO timestamp
 *     appliedBy: string                       // user id / 'system' /
 *                                             // 'self-heal'
 *     triggerSource: 'MIGRATE_DEPLOY' | 'SELF_HEAL' | 'MANUAL'
 *     schemaHashBefore: string | null         // SHA-256 hex
 *     schemaHashAfter: string                 // SHA-256 hex
 *     diffSummary: string | null
 *     outcome: 'SUCCESS' | 'FAILED' | 'ROLLED_BACK'
 *     errorMessage: string | null
 *     durationMs: number | null
 *   }
 *
 * SchemaChainLink DTO:
 *   {
 *     audit: MigrationAudit
 *     chainsToPrevious: boolean               // true when this row's
 *                                             // schemaHashBefore equals
 *                                             // the preceding row's
 *                                             // schemaHashAfter
 *     previousAuditId: string | null          // null on first row
 *   }
 *
 * Errors normalised by src/api/client.js. 403 means non-OWNER-and-
 * non-AUDITOR.
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
 * GET /api/migration-audit
 * @param {Object} [filters]
 * @param {string} [filters.migrationName]
 * @param {'SUCCESS'|'FAILED'|'ROLLED_BACK'} [filters.outcome]
 * @param {'MIGRATE_DEPLOY'|'SELF_HEAL'|'MANUAL'} [filters.triggerSource]
 * @param {string} [filters.appliedAtFrom]     ISO date
 * @param {string} [filters.appliedAtTo]       ISO date
 * @param {number} [filters.limit]             1..1000
 * @returns {Promise<Array>}                    MigrationAudit[]
 */
export async function listMigrationAudits(filters = {}) {
  const params = {};
  if (filters.migrationName) params.migrationName = filters.migrationName;
  if (filters.outcome) params.outcome = filters.outcome;
  if (filters.triggerSource) params.triggerSource = filters.triggerSource;
  if (filters.appliedAtFrom) params.appliedAtFrom = filters.appliedAtFrom;
  if (filters.appliedAtTo) params.appliedAtTo = filters.appliedAtTo;
  if (filters.limit != null) params.limit = filters.limit;
  const r = await client.get('/api/migration-audit', { params });
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

/**
 * GET /api/migration-audit/schema-chain
 * @returns {Promise<Array>}                    SchemaChainLink[]
 */
export async function getMigrationSchemaChain() {
  const r = await client.get('/api/migration-audit/schema-chain');
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

/** GET /api/migration-audit/:id */
export async function getMigrationAudit(id) {
  const r = await client.get(
    `/api/migration-audit/${encodeURIComponent(id)}`,
  );
  return unwrap(r);
}
