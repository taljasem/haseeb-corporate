/**
 * Leave Provision API module (FN-255, Phase 4 Track A Tier 5 — 2026-04-19).
 *
 * Per-tenant effective-dated leave accrual policy + per-employee
 * balance register + provision compute. The policy drives month-end
 * accrual JE posting by a future runner (jeScope='leave_accrual'); the
 * per-employee balance tracks accrued vs. taken days; the provision
 * compute surface returns the aggregate liability at a given date.
 *
 *   POST   /api/leave-provision/policy            — create policy (OWNER)
 *   PATCH  /api/leave-provision/policy/:id        — update (OWNER;
 *                                                   notes + activeUntil
 *                                                   only — accrual rate
 *                                                   frozen post-create)
 *   GET    /api/leave-provision/policy/active     — current active row
 *   GET    /api/leave-provision/policy            — list + filters
 *
 *   POST   /api/leave-provision/balance           — upsert per-employee
 *                                                   balance (OWNER/ACCT)
 *   GET    /api/leave-provision/balance/:employeeId  — single balance
 *   GET    /api/leave-provision/balance           — list all
 *
 *   GET    /api/leave-provision/provision-summary — aggregate liability
 *                                                   as of date
 *   GET    /api/leave-provision/provision/:employeeId — per-employee
 *                                                       provision
 *
 * Policy DTO:
 *   {
 *     id: string
 *     accrualDaysPerMonth: string          // decimal (up to 4 dp)
 *     qualifyingMonthsBeforeAccrual?: number
 *     maxCarryForwardDays?: number
 *     plRoleCode?: string                  // AccountRole for P&L
 *     liabilityRoleCode?: string           // AccountRole for liability
 *     notes?: string | null
 *     activeFrom: string                   // ISO date
 *     activeUntil?: string | null
 *     createdBy: string
 *     createdAt: string
 *     updatedAt: string
 *   }
 *
 * Balance DTO:
 *   {
 *     employeeId: string
 *     accruedDays: string                  // decimal
 *     takenDays: string                    // decimal
 *     lastAccrualDate?: string | null
 *   }
 *
 * Provision summary DTO:
 *   {
 *     asOf: string
 *     employeeCount: number
 *     totalAccruedDays: string
 *     totalTakenDays: string
 *     netOutstandingDays: string
 *     estimatedLiabilityKwd: string        // daily rate × netOutstanding
 *     note: string
 *   }
 *
 * Errors normalised by src/api/client.js.
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

// ─── Policy ────────────────────────────────────────────────────
export async function listLeavePolicies(filters = {}) {
  const params = {};
  if (filters.activeOnly != null) params.activeOnly = filters.activeOnly;
  if (filters.asOf) params.asOf = filters.asOf;
  const r = await client.get('/api/leave-provision/policy', { params });
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export async function getActiveLeavePolicy() {
  const r = await client.get('/api/leave-provision/policy/active');
  return unwrap(r);
}

export async function createLeavePolicy(payload) {
  const r = await client.post('/api/leave-provision/policy', payload);
  return unwrap(r);
}

export async function updateLeavePolicy(id, patch) {
  const r = await client.patch(
    `/api/leave-provision/policy/${encodeURIComponent(id)}`,
    patch,
  );
  return unwrap(r);
}

// ─── Balances ──────────────────────────────────────────────────
export async function listLeaveBalances() {
  const r = await client.get('/api/leave-provision/balance');
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

export async function getLeaveBalance(employeeId) {
  const r = await client.get(
    `/api/leave-provision/balance/${encodeURIComponent(employeeId)}`,
  );
  return unwrap(r);
}

export async function upsertLeaveBalance(payload) {
  const r = await client.post('/api/leave-provision/balance', payload);
  return unwrap(r);
}

// ─── Provision compute ─────────────────────────────────────────
export async function getLeaveProvisionSummary(query = {}) {
  const params = {};
  if (query.asOf) params.asOf = query.asOf;
  const r = await client.get('/api/leave-provision/provision-summary', { params });
  return unwrap(r);
}

export async function getLeaveProvisionForEmployee(employeeId, query = {}) {
  const params = {};
  if (query.asOf) params.asOf = query.asOf;
  const r = await client.get(
    `/api/leave-provision/provision/${encodeURIComponent(employeeId)}`,
    { params },
  );
  return unwrap(r);
}
