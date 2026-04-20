/**
 * Budgets API module — Track B Dispatch 6 wire 6/6 (2026-04-20).
 *
 * Wraps the 16 endpoints shipped by Track B Dispatch 6
 * (corporate-api origin/main @ 55b83a3):
 *
 *   Group A — reads:
 *     GET  /api/budgets/:id/summary
 *     GET  /api/budgets/:id/variance?period=YYYY-MM
 *     GET  /api/budgets/by-year/:year
 *
 *   Group B — per-line CRUD:
 *     POST   /api/budgets/:id/lines
 *     PATCH  /api/budgets/:id/lines/:lineId
 *     DELETE /api/budgets/:id/lines/:lineId
 *
 *   Group C — approval workflow:
 *     POST /api/budgets/:id/submit-approval
 *     POST /api/budgets/:id/delegate
 *     POST /api/budgets/:id/departments/:deptId/approve
 *     POST /api/budgets/:id/departments/:deptId/request-revision
 *     POST /api/budgets/:id/request-changes                (OWNER only)
 *
 *   Group D — comments:
 *     POST   /api/budgets/:id/lines/:lineId/comments
 *     GET    /api/budgets/:id/lines/:lineId/comments
 *     DELETE /api/budgets/:id/lines/:lineId/comments/:commentId
 *
 *   Group E — state + team:
 *     GET /api/budgets/:id/approval-state
 *     GET /api/team/members
 *
 * Shape notes / STOP-AND-FLAG surfaces:
 *
 *   The EXISTING BudgetScreen consumes a dramatically richer DTO than the
 *   live backend currently surfaces. Wire 6 wires the 16 Dispatch 6
 *   endpoints as callable wrappers and rewires the screen's engine
 *   imports so MOCK mode is preserved; but full LIVE-mode takeover of the
 *   screen's core data path would require INVENTING backend fields or
 *   refactoring the screen — both out of scope for this wire.
 *
 *   Flagged shape deltas (see commit body for the full list):
 *
 *   1. Budget DTO (the screen's `budget` state):
 *        Mock:  { id, period:{label, fiscalYear}, status, totalRevenue,
 *                 totalExpenses, netIncome, aminahNarration,
 *                 workflowHistory, departments:[{id, name,
 *                 category:"revenue"|"expense", ownerUserId, totalAnnual,
 *                 workflowStatus, lineItems:[{id, glAccountCode,
 *                 glAccountName, annual, monthlyDistribution, ...}],
 *                 revisionNotes, submittedAt, reviewedAt,
 *                 assignedTaskId}] }
 *        Live:  GET /api/budgets/:id returns the core Budget row; no
 *               `departments[].lineItems` nesting, no `ownerUserId` /
 *               `workflowStatus` per department, no `aminahNarration`, no
 *               `workflowHistory` (that's surfaced separately via
 *               GET /api/budgets/:id/approval-state.history).
 *
 *        Status enum mismatch:
 *          Mock:  draft | delegated | in-review | pending-approval |
 *                 active | closed | approved | rejected
 *          Live:  DRAFT | PENDING_APPROVAL | CHANGES_REQUESTED |
 *                 APPROVED | LOCKED
 *
 *   2. Variance row DTO:
 *        Mock:  { id, name, category:"revenue"|"expense", ownerUserId,
 *                 budgetAnnual, budgetYtd, actualYtd, varianceAmount,
 *                 variancePercent, status }
 *        Live:  { departmentId, departmentName, category:"Revenue"|"Expense",
 *                 budgetAnnualKwd, actualYtdKwd, varianceKwd,
 *                 variancePercent, status:"on-track"|"under"|"over" }
 *                (Decimal strings for amounts; NO budgetYtd,
 *                 NO ownerUserId.)
 *
 *   3. Comment DTO:
 *        Mock:  { id, lineId, author, authorRole, content, createdAt,
 *                 edited, editedAt }
 *        Live:  { id, authorUserId, authorName, authorRole, content,
 *                 createdAt }
 *                (No `author` short key; name is authorName; no edit
 *                 metadata.)
 *
 *   4. Line CRUD signature:
 *        Mock mockEngine.updateBudgetLine(lineId, updates)  — (no budgetId)
 *        Live PATCH /api/budgets/:id/lines/:lineId           — (needs budgetId;
 *              accepts only amountKwd + notes — NOT name, code, or
 *              monthlyDistribution).
 *
 *   5. Delegate payload:
 *        Mock:  [{departmentId, juniorUserId, notes}]
 *        Live:  {delegations: [{departmentId, assignToUserId}]}
 *                (no per-delegation notes field.)
 *
 *   6. Approval-state DTO:
 *        Mock:  { status, approvedBy, approvedAt, reviewers:[{role,
 *                 status}], history:[{fromState, toState, byUserId,
 *                 note, timestamp}], nextAction:string }
 *        Live:  { budgetStatus, nextAction:string,
 *                 reviewers:[{role, userId, userName,
 *                 status:"pending"|"approved"|"needs_revision",
 *                 decidedAt?}],
 *                 history:[{action, actor, timestamp, notes?}] }
 *                (nextAction is the authoritative "what's next" hint;
 *                 history uses action+actor rather than from/to state.)
 *
 * Per wire 6 spec ("flag; don't invent"), the screen rewire in this
 * commit is surface-only: imports swap from `../../engine/mockEngine`
 * to `../../engine`, and LIVE mode falls back to mockEngine with the
 * standard one-shot warn for every hook where the DTO would need
 * invention. The 16 wrappers are exposed as engine extras so future
 * wires (or a screen refactor that bakes to the live DTO) can call them
 * without further plumbing.
 *
 * All amounts on the live backend are KWD Decimal strings (e.g.
 * "1234.500"). Consumers doing arithmetic should parse via Number() or
 * Decimal.js; display via formatKWD(Number(x)).
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

// ── Group A — reads ────────────────────────────────────────────────────────

/**
 * GET /api/budgets/:id/summary — all 4 roles.
 * Returns { budgetId, fiscalYear, totalRevenueKwd, totalExpensesKwd,
 *           netIncomeKwd, departmentCount, marginPercent }.
 * Amounts are Decimal strings.
 */
export async function getBudgetSummary(id) {
  const r = await client.get(`/api/budgets/${encodeURIComponent(id)}/summary`);
  return unwrap(r);
}

/**
 * GET /api/budgets/:id/variance?period=YYYY-MM — all 4 roles.
 * Returns an array of variance rows.
 */
export async function getBudgetVariance(id, { period } = {}) {
  const params = {};
  if (period) params.period = period;
  const r = await client.get(
    `/api/budgets/${encodeURIComponent(id)}/variance`,
    { params },
  );
  return unwrap(r);
}

/**
 * GET /api/budgets/by-year/:year — all 4 roles.
 * Returns { id, period, fiscalYear, status, departments[],
 *           totalRevenueKwd, totalExpensesKwd } or null on 404.
 */
export async function getBudgetForYear(year) {
  try {
    const r = await client.get(`/api/budgets/by-year/${encodeURIComponent(year)}`);
    return unwrap(r);
  } catch (err) {
    if (err && (err.status === 404 || err.response?.status === 404)) return null;
    throw err;
  }
}

// ── Group B — per-line CRUD ────────────────────────────────────────────────

/**
 * POST /api/budgets/:id/lines — OWNER + ACCOUNTANT. 400 if budget !DRAFT.
 * Body must carry exactly one of { accountCode, accountRole }; also
 *   { departmentId?, amountKwd, category:"Revenue"|"Expense", notes? }.
 */
export async function createBudgetLine(id, payload) {
  const r = await client.post(
    `/api/budgets/${encodeURIComponent(id)}/lines`,
    payload,
  );
  return unwrap(r);
}

/**
 * PATCH /api/budgets/:id/lines/:lineId — OWNER + ACCOUNTANT. 400 if !DRAFT.
 * Body: { amountKwd?, notes? }. Does NOT accept name/code updates
 * (backend's line shape is driven by the account mapping, not freeform
 * name edits).
 */
export async function updateBudgetLine(id, lineId, payload) {
  const r = await client.patch(
    `/api/budgets/${encodeURIComponent(id)}/lines/${encodeURIComponent(lineId)}`,
    payload,
  );
  return unwrap(r);
}

/**
 * DELETE /api/budgets/:id/lines/:lineId — OWNER + ACCOUNTANT. 400 if !DRAFT.
 */
export async function deleteBudgetLine(id, lineId) {
  const r = await client.delete(
    `/api/budgets/${encodeURIComponent(id)}/lines/${encodeURIComponent(lineId)}`,
  );
  return unwrap(r);
}

// ── Group C — approval workflow ────────────────────────────────────────────

/**
 * POST /api/budgets/:id/submit-approval — OWNER + ACCOUNTANT.
 * 400 if budget !DRAFT. Transitions DRAFT → PENDING_APPROVAL.
 */
export async function submitBudgetForApproval(id) {
  const r = await client.post(
    `/api/budgets/${encodeURIComponent(id)}/submit-approval`,
  );
  return unwrap(r);
}

/**
 * POST /api/budgets/:id/delegate — OWNER + ACCOUNTANT.
 * Body: { delegations: [{ departmentId, assignToUserId }] }.
 * 400 if !PENDING_APPROVAL. Creates BudgetDepartmentApproval rows.
 *
 * Shape note: backend takes `assignToUserId` (NOT `juniorUserId` like
 * the legacy mock). The screen adapter / caller MUST map accordingly.
 */
export async function delegateBudget(id, { delegations } = {}) {
  const r = await client.post(
    `/api/budgets/${encodeURIComponent(id)}/delegate`,
    { delegations: delegations || [] },
  );
  return unwrap(r);
}

/**
 * POST /api/budgets/:id/departments/:deptId/approve — OWNER + ACCOUNTANT.
 * Service enforces: user matches the delegated assignToUserId OR is Owner.
 * 403 to non-delegated non-Owner callers.
 *
 * Per Dispatch 6 note: the LAST dept-approval does NOT auto-finalise the
 * budget. Owner must subsequently call POST /api/budgets/:id/approve.
 * `GET /api/budgets/:id/approval-state.nextAction` is the authoritative
 * hint for what's next.
 */
export async function approveBudgetDepartment(id, deptId) {
  const r = await client.post(
    `/api/budgets/${encodeURIComponent(id)}/departments/${encodeURIComponent(deptId)}/approve`,
  );
  return unwrap(r);
}

/**
 * POST /api/budgets/:id/departments/:deptId/request-revision — OWNER + ACCOUNTANT.
 * Body: { notes: 1..1000 chars }. Sets delegation.status = NEEDS_REVISION.
 */
export async function requestDepartmentRevision(id, deptId, { notes } = {}) {
  const r = await client.post(
    `/api/budgets/${encodeURIComponent(id)}/departments/${encodeURIComponent(deptId)}/request-revision`,
    { notes },
  );
  return unwrap(r);
}

/**
 * POST /api/budgets/:id/request-changes — OWNER ONLY.
 * Body: { notes: 1..1000 chars }. Transitions budget → CHANGES_REQUESTED.
 */
export async function requestBudgetChanges(id, { notes } = {}) {
  const r = await client.post(
    `/api/budgets/${encodeURIComponent(id)}/request-changes`,
    { notes },
  );
  return unwrap(r);
}

/**
 * POST /api/budgets/:id/lock — OWNER ONLY.
 * Body: { reason: 1..1000 chars }.
 * Transitions APPROVED | CHANGES_REQUESTED → LOCKED.
 */
export async function lockBudget(id, { reason } = {}) {
  const r = await client.post(
    `/api/budgets/${encodeURIComponent(id)}/lock`,
    { reason },
  );
  return unwrap(r);
}

/**
 * POST /api/budgets/:id/reopen-to-draft — OWNER ONLY.
 * Body: { reason: 1..1000 chars }.
 * Transitions LOCKED | REJECTED → DRAFT.
 *
 * Role note: endpoint is OWNER-only per backend. CFOs must request the
 * Owner to reopen a non-DRAFT budget rather than having a direct edit
 * affordance on non-DRAFT state.
 */
export async function reopenBudgetToDraft(id, { reason } = {}) {
  const r = await client.post(
    `/api/budgets/${encodeURIComponent(id)}/reopen-to-draft`,
    { reason },
  );
  return unwrap(r);
}

/**
 * POST /api/budgets/:id/reject — OWNER ONLY.
 * Body: { reason: 1..1000 chars }.
 * Transitions PENDING_APPROVAL | CHANGES_REQUESTED → REJECTED.
 * REJECTED is a proper terminal state on the BudgetStatus enum.
 */
export async function rejectBudget(id, { reason } = {}) {
  const r = await client.post(
    `/api/budgets/${encodeURIComponent(id)}/reject`,
    { reason },
  );
  return unwrap(r);
}

// ── Group D — comments ─────────────────────────────────────────────────────

/**
 * POST /api/budgets/:id/lines/:lineId/comments — all 4 roles (Viewer can comment).
 * Body: { content: 1..2000 chars }.
 */
export async function addBudgetLineComment(id, lineId, { content } = {}) {
  const r = await client.post(
    `/api/budgets/${encodeURIComponent(id)}/lines/${encodeURIComponent(lineId)}/comments`,
    { content },
  );
  return unwrap(r);
}

/**
 * GET /api/budgets/:id/lines/:lineId/comments — all 4 roles.
 * Returns [{ id, authorUserId, authorName, authorRole, content, createdAt }]
 * ordered ASC.
 */
export async function listBudgetLineComments(id, lineId) {
  const r = await client.get(
    `/api/budgets/${encodeURIComponent(id)}/lines/${encodeURIComponent(lineId)}/comments`,
  );
  return unwrap(r);
}

/**
 * DELETE /api/budgets/:id/lines/:lineId/comments/:commentId — author or OWNER.
 * Server-side soft delete.
 */
export async function deleteBudgetLineComment(id, lineId, commentId) {
  const r = await client.delete(
    `/api/budgets/${encodeURIComponent(id)}/lines/${encodeURIComponent(lineId)}/comments/${encodeURIComponent(commentId)}`,
  );
  return unwrap(r);
}

// ── Group E — state + team ─────────────────────────────────────────────────

/**
 * GET /api/budgets/:id/approval-state — all 4 roles.
 * Returns { budgetStatus, nextAction, reviewers:[...], history:[...] }.
 *
 * `nextAction` is the authoritative string describing the next step
 * (e.g. "OWNER to finalise approval (POST /approve)"). The UI surfaces
 * this verbatim.
 */
export async function getBudgetApprovalState(id) {
  const r = await client.get(
    `/api/budgets/${encodeURIComponent(id)}/approval-state`,
  );
  return unwrap(r);
}

/**
 * GET /api/team/members — OWNER + ACCOUNTANT.
 * Returns [{ id, name, email, role }]. Used by the Delegate modal for
 * the assignee picker.
 */
export async function listTeamMembers() {
  const r = await client.get('/api/team/members');
  return unwrap(r);
}
