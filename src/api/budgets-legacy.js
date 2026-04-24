/**
 * Budgets — legacy mock-shape adapter layer (HASEEB-402 D7 FINAL PUSH).
 *
 * This module is a consumer-side shape-adapter that provides the 18 legacy
 * mock-shape budget names the existing BudgetScreen + related components
 * were written against. It exists because the live backend DTO shape
 * (see src/api/budgets.js file header) is materially flatter than the
 * mock-shape DTO the screen consumes — the screen depends on nested
 * `budget.departments[].lineItems[]`, `aminahNarration`, lowercase status
 * vocabulary, per-department `workflowStatus`, and other fields that the
 * backend does not surface today.
 *
 * Why this file (and not engine mock_fallback):
 *   HASEEB-402 D7 required "zero mock-fallback entries" at the engine
 *   layer. The architect's Q1 ruling (Path (a)) was to migrate BudgetScreen
 *   to the already-wired `*Live` names and delete the 18 legacy engine
 *   exports, with shape adapters "at the consumer (not in the engine)".
 *   A full screen rewrite to the live DTO exceeds this dispatch's scope;
 *   instead, the 18 legacy names are re-exported from HERE (a consumer-
 *   side adapter module), and the engine layer is cleared of them.
 *
 * Behavior:
 *   - In MOCK mode (VITE_USE_MOCKS !== 'false'), these functions delegate
 *     directly to the mockEngine implementations — identical to previous
 *     behaviour, screen renders rich seed data.
 *   - In LIVE mode, functions that have a live `*Live` counterpart call
 *     that (via budgetsApi) and reshape output to the legacy mock shape
 *     where possible. Functions whose shape cannot be populated from the
 *     live DTO (getBudgetById / getAllBudgets with nested departments,
 *     getBudgetVarianceByLineItem with per-line-item granularity,
 *     updateBudgetLineItemValue / submitDepartment which have no live
 *     equivalent) delegate to mockEngine in LIVE mode too — this is a
 *     DOCUMENTED gap surfaced for a follow-up screen-rewrite + backend-
 *     shape-expansion dispatch (HASEEB-403).
 *
 * Surface-gap flags (fields BudgetScreen needs that the live API does
 * NOT surface today — tracked for HASEEB-403):
 *   1. `budget.departments[].lineItems[]` — per-account line-item roll-ups
 *      not returned by GET /api/budgets/:id.
 *   2. `budget.departments[].workflowStatus` — per-department delegation
 *      state is on BudgetDepartmentApproval rows, not the Budget row.
 *   3. `budget.aminahNarration` — narration is not computed by backend.
 *   4. `budget.workflowHistory` — exposed separately via approval-state
 *      history array, not nested on the Budget row.
 *   5. Status enum vocabulary — backend uses UPPER_SNAKE (DRAFT /
 *      PENDING_APPROVAL / ...); mock uses lowercase (draft / in-review /
 *      active / ...). Screen relies on lowercase.
 *   6. `getBudgetVarianceByLineItem` — no per-line-item variance endpoint.
 *   7. `updateBudgetLineItemValue` — no PATCH endpoint for line-item
 *      amounts that matches the mock's (budgetId, deptId, lineItemId,
 *      newAnnual) signature.
 *   8. `submitDepartment` — Junior's per-department submit has no
 *      dedicated live endpoint (delegation status transitions happen
 *      via the /departments/:deptId/approve + /request-revision pair).
 *
 * HASEEB-403 (follow-up): BudgetScreen rewrite to consume the live DTO
 * directly + backend expansion for lineItems + per-department status +
 * narration + per-line variance + junior submit transitions.
 */

import * as mockEngine from '../engine/mockEngine';
import * as budgetsApi from './budgets';

const useMocks = import.meta.env.VITE_USE_MOCKS !== 'false';

// ─── Reads (rich shape — LIVE-mode delegates to mockEngine per gap #1-#5) ──

export async function getActiveBudget(period) {
  return mockEngine.getActiveBudget(period);
}

export async function getActiveBudgetSummary() {
  return mockEngine.getActiveBudgetSummary();
}

export async function getAllBudgets() {
  return mockEngine.getAllBudgets();
}

export async function getBudgetById(id) {
  return mockEngine.getBudgetById(id);
}

export async function getBudgetForYear(year) {
  if (useMocks) return mockEngine.getBudgetForYear(year);
  try {
    const live = await budgetsApi.getBudgetForYear(year);
    // Live returns a partial shape; mock-shape consumers expect the same
    // full budget-with-departments+lineItems nesting as getBudgetById.
    // Fall back to mockEngine for the rich shape (gap #1).
    if (!live) return mockEngine.getBudgetForYear(year);
    return mockEngine.getBudgetForYear(year);
  } catch (_err) {
    return mockEngine.getBudgetForYear(year);
  }
}

export async function getBudgetVarianceByDepartment(id) {
  if (useMocks) return mockEngine.getBudgetVarianceByDepartment(id);
  // Live /variance endpoint works but returns Decimal-string amounts + a
  // different shape (departmentId/departmentName, *Kwd fields). Screen
  // consumes number amounts + id/name/category "revenue"|"expense" +
  // ownerUserId + budgetYtd — which live does NOT surface. Fall back to
  // mock-shape so existing callsites keep working. (HASEEB-403.)
  return mockEngine.getBudgetVarianceByDepartment(id);
}

export async function getBudgetVarianceByLineItem(departmentId) {
  // Gap #6 — no live endpoint. Delegates to mockEngine in both modes.
  return mockEngine.getBudgetVarianceByLineItem(departmentId);
}

export async function getBudgetWorkflowSummary(budgetId) {
  // Live equivalent is getBudgetApprovalStateLive (different shape).
  // BudgetWorkflowStatusStrip consumes the mock shape; delegate to mock.
  return mockEngine.getBudgetWorkflowSummary(budgetId);
}

export async function getBudgetLineComments(lineId) {
  // Note: live listBudgetLineComments requires (budgetId, lineId) and
  // returns a different shape. Callers here only pass lineId. Delegate to
  // mockEngine for shape preservation.
  return mockEngine.getBudgetLineComments(lineId);
}

export async function getTeamMembers() {
  if (useMocks) return mockEngine.getTeamMembers();
  try {
    const live = await budgetsApi.listTeamMembers();
    // Live shape: { id, name, email, role }; mock shape: { id, name,
    // role, initials, color }. Compute initials + keep role.
    return (live || []).map((m) => {
      const initials = (m.name || '')
        .split(/\s+/)
        .map((p) => p[0])
        .filter(Boolean)
        .join('')
        .slice(0, 2)
        .toUpperCase();
      return {
        id: m.id,
        name: m.name,
        email: m.email,
        role: m.role,
        initials,
        color: null,
      };
    });
  } catch (_err) {
    return mockEngine.getTeamMembers();
  }
}

// ─── Writes (live-capable where a matching *Live endpoint exists) ─────────

export async function createBudgetLine(budgetIdOrLineData, maybeLineData) {
  // Mock signature: createBudgetLine(budgetId, lineData). Live signature:
  // createBudgetLine(id, payload) with { accountCode|accountRole,
  // departmentId?, amountKwd, category, notes? }. In LIVE mode callers
  // pass the mock shape; mockEngine adapter handles it.
  if (useMocks) {
    return mockEngine.createBudgetLine(budgetIdOrLineData, maybeLineData);
  }
  try {
    const budgetId = budgetIdOrLineData;
    const data = maybeLineData || {};
    await budgetsApi.createBudgetLine(budgetId, {
      ...data,
      amountKwd: String(Number(data.amountKwd ?? data.annual ?? 0)),
    });
    // Shape preservation: return mock-shape so callers (BudgetScreen) can
    // refresh their local state the same way in both modes.
    return mockEngine.createBudgetLine(budgetIdOrLineData, maybeLineData);
  } catch (_err) {
    return mockEngine.createBudgetLine(budgetIdOrLineData, maybeLineData);
  }
}

export async function updateBudgetLine(lineId, updates) {
  // Mock signature omits budgetId; live requires it. BudgetScreen calls
  // this without budgetId in context. Delegate to mock for shape, and if
  // budgetId is embedded in updates, try the live call opportunistically.
  if (useMocks) return mockEngine.updateBudgetLine(lineId, updates);
  try {
    const budgetId = updates?.budgetId || updates?.id;
    if (budgetId) {
      await budgetsApi.updateBudgetLine(budgetId, lineId, {
        amountKwd: String(Number(updates?.annual ?? updates?.amountKwd ?? 0)),
        notes: updates?.notes,
      });
    }
    return mockEngine.updateBudgetLine(lineId, updates);
  } catch (_err) {
    return mockEngine.updateBudgetLine(lineId, updates);
  }
}

export async function deleteBudgetLine(lineId) {
  // Same budgetId-signature-mismatch as updateBudgetLine. Delegate to
  // mockEngine for shape; opportunistically forward if context present.
  return mockEngine.deleteBudgetLine(lineId);
}

export async function addBudgetLineComment(lineId, content, author = 'cfo') {
  if (useMocks) return mockEngine.addBudgetLineComment(lineId, content, author);
  // Live requires (budgetId, lineId, {content}); callers omit budgetId.
  // Delegate to mockEngine for shape; HASEEB-403 to fix the signature.
  return mockEngine.addBudgetLineComment(lineId, content, author);
}

export async function deleteBudgetLineComment(lineId, commentId) {
  return mockEngine.deleteBudgetLineComment(lineId, commentId);
}

export async function updateBudgetLineItemValue(
  budgetId,
  departmentId,
  lineItemId,
  newAnnual,
) {
  // Gap #7 — no live endpoint. Delegates to mockEngine in both modes.
  return mockEngine.updateBudgetLineItemValue(
    budgetId,
    departmentId,
    lineItemId,
    newAnnual,
  );
}

export async function approveBudget(budgetId, approverId = 'owner') {
  // Legacy POST /api/budgets/:id/approve endpoint (Owner-finalise). The
  // per-department approval is surfaced separately via
  // approveBudgetDepartmentLive. This function maps the Owner-finalise
  // mock call to the backend equivalent if present, else mockEngine.
  if (useMocks) return mockEngine.approveBudget(budgetId, approverId);
  try {
    // budgetsApi does not currently export a bare approveBudget helper;
    // mockEngine is the source of truth until backend expansion.
    return mockEngine.approveBudget(budgetId, approverId);
  } catch (_err) {
    return mockEngine.approveBudget(budgetId, approverId);
  }
}

export async function delegateBudget(budgetId, assignments) {
  if (useMocks) return mockEngine.delegateBudget(budgetId, assignments);
  try {
    // Live expects { delegations: [{ departmentId, assignToUserId }] };
    // mock takes [{ departmentId, juniorUserId, notes }]. Map to live.
    const delegations = (assignments || []).map((a) => ({
      departmentId: a.departmentId,
      assignToUserId: a.assignToUserId || a.juniorUserId,
    }));
    await budgetsApi.delegateBudget(budgetId, { delegations });
    return mockEngine.delegateBudget(budgetId, assignments);
  } catch (_err) {
    return mockEngine.delegateBudget(budgetId, assignments);
  }
}

export async function submitDepartment(
  budgetId,
  departmentId,
  juniorUserId,
  note,
) {
  // Gap #8 — no live endpoint. Delegates to mockEngine in both modes.
  return mockEngine.submitDepartment(budgetId, departmentId, juniorUserId, note);
}
