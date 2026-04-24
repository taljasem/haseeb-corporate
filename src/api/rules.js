/**
 * Rules API module — Track B Dispatch 3a wire (2026-04-20) extended by
 * HASEEB-397 B3 (2026-04-24) with Fix-A CRUD wire-ups.
 *
 * ─────────────────────────────────────────────────────────────────────
 * Original scope (Dispatch 3a): `/api/rules/suggestions` read-only.
 *
 * Backs `GET /api/rules/suggestions?type=categorization|routing&limit=N`.
 * Role gate (backend): OWNER + ACCOUNTANT.
 *
 * Backend DTO:
 *   { id, rule, confidence, impact: { count, estimatedKwd } }
 *
 * Mock shape (consumed by SuggestedRuleRow on TodayScreen):
 *   categorization kind:
 *     { id, kind: 'categorization', count, merchant, target, context }
 *   routing kind:
 *     { id, kind: 'routing', count, description, context }
 *
 * Adaptation: the backend's `rule` string is prose like
 *   "Transactions at <merchant> → <account>"
 * which is close to what `description` holds in the routing mock shape.
 * For the categorization mock shape, the SuggestedRuleRow component
 * uses t('suggested.count_similar', { count, merchant, target }) so we
 * need to split the prose into merchant + target. We do a best-effort
 * split on the `→` arrow; when the parse fails we fall through to
 * surfacing the full `rule` string as `merchant` with `target` left
 * empty so the row still renders something sensible.
 *
 * ─────────────────────────────────────────────────────────────────────
 * HASEEB-397 B3 (2026-04-24) — CRUD wire-ups for LabelingRule +
 * RoutingRule. 8 engine entries backed by:
 *   GET    /api/rules                 — list categorization rules
 *   POST   /api/rules/:id/mute        — mute categorization rule
 *   POST   /api/rules/:id/unmute      — unmute categorization rule
 *   DELETE /api/rules/:id             — delete categorization rule
 *   GET    /api/routing-rules         — list routing rules
 *   POST   /api/routing-rules/:id/mute — mute routing rule
 *   POST   /api/routing-rules/:id/unmute — unmute routing rule
 *   DELETE /api/routing-rules/:id     — delete routing rule
 *
 * Shape adapters: the backend DTO is minimal (LabelingRuleDto /
 * RoutingRuleDto per rules.crud.service.ts) — the UI (RulesScreen,
 * CategorizationRuleRow, RoutingRuleRow, RuleDetailExpanded) consumes a
 * richer shape from mockEngine with fields the backend doesn't persist
 * today. Rather than fabricate those fields we expose stable defaults
 * with an inline comment per field, so the UI renders a "degraded
 * richness" view (empty audit trail, 0 applied count, "—" for cost
 * center) rather than fake data. Degradation is documented honestly.
 *
 * Fields the UI reads that the backend DOES NOT surface (defaulted):
 *   - `auditTrail`        → [] (backend has no audit-trail persistence
 *                              for rules; rule mutations log via
 *                              pino logger only, not exposed as a read)
 *   - `appliedCount`      → 0  (no counter on LabelingRule/RoutingRule
 *                              rows today; categorizer increments
 *                              aren't persisted back)
 *   - `lastAppliedAt`     → null
 *   - `mode`              → 'automatic' (backend LabelingRule is always
 *                              deterministic-auto today; no
 *                              suggest-only / ask-each-time setting)
 *   - `conditions`        → {} (backend model doesn't support the
 *                              amountMin/amountMax/sourceAccount
 *                              conditions surface yet)
 *   - `costCenter`        → null
 *   - `approvalThreshold` → null
 *
 * Fields resolved via lookups (fail-soft to code/id only):
 *   - `debitAccount.name` / `creditAccount.name` ← buildAccountLookup()
 *       (backend returns accountCode strings; UI wants {code, name})
 *   - `createdBy.name`    ← buildUserLookup()
 *       (backend returns a userId UUID; UI wants {name})
 *   - `action.assignTo.name` (routing only) ← buildUserLookup()
 *       (backend returns a reviewerUserId UUID; UI wants {name})
 *
 * Status synthesis: backend has isActive + mutedAt; UI wants a status
 * string ('active' | 'muted' | 'deleted'). We synthesise:
 *   - mutedAt != null   → 'muted'
 *   - isActive == false → 'muted' (defensive, e.g. if mutedAt missing)
 *   - else              → 'active'
 * 'deleted' is unreachable because backend hard-deletes on DELETE.
 */
import client from './client';
import { getAccountsFlat } from './accounts';
import { listMembers } from './auth';

function unwrap(response) {
  if (response && response.data && typeof response.data === 'object') {
    if ('data' in response.data) return response.data.data;
    return response.data;
  }
  return response?.data;
}

function parseRulePhrase(rule) {
  // Expected shape: "Transactions at <merchant> → <account>" (backend prose)
  // or any ASCII arrow: `->`. Both emitted historically.
  const str = String(rule || '');
  const arrowIdx = str.search(/→|->/);
  if (arrowIdx < 0) return { merchant: str, target: '' };
  const left = str.slice(0, arrowIdx).trim();
  const right = str.slice(arrowIdx + 1).replace(/^>\s*/, '').trim();
  // Strip the leading "Transactions at " if present.
  const merchant = left.replace(/^Transactions\s+at\s+/i, '').trim() || left;
  return { merchant, target: right };
}

function impactCtx(impact) {
  const count = Number(impact?.count || 0);
  if (!count) return '';
  return `Based on ${count} decision${count === 1 ? '' : 's'} in the last 90 days`;
}

/**
 * Fetch categorization-class suggestions. Returns the mock-compatible
 * shape SuggestedRuleRow consumes.
 */
export async function getSuggestedCategorizationRules(limit = 5) {
  const r = await client.get('/api/rules/suggestions', {
    params: { type: 'categorization', limit },
  });
  const data = unwrap(r);
  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => {
    const { merchant, target } = parseRulePhrase(row.rule);
    return {
      id: row.id,
      kind: 'categorization',
      count: Number(row.impact?.count || 0),
      merchant,
      target,
      context: impactCtx(row.impact),
      _confidence: Number(row.confidence || 0),
      _estimatedKwd: row.impact?.estimatedKwd || '0',
    };
  });
}

/**
 * Fetch routing-class suggestions. Routing mock shape uses
 * `description` + `context` (not merchant/target), so we pass the raw
 * `rule` prose through as the description.
 */
export async function getSuggestedRoutingRules(limit = 5) {
  const r = await client.get('/api/rules/suggestions', {
    params: { type: 'routing', limit },
  });
  const data = unwrap(r);
  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => ({
    id: row.id,
    kind: 'routing',
    count: Number(row.impact?.count || 0),
    description: row.rule || '',
    context: impactCtx(row.impact),
    _confidence: Number(row.confidence || 0),
    _estimatedKwd: row.impact?.estimatedKwd || '0',
  }));
}

// ─────────────────────────────────────────────────────────────────────
// HASEEB-397 B3 (2026-04-24) — CRUD wire-ups begin here.
// ─────────────────────────────────────────────────────────────────────

/**
 * Build a Map<accountCode, {code, name, nameAr}> from the flat CoA
 * list. Parallels `buildAccountLookup` in src/api/bank-transactions.js.
 * Fail-soft: returns an empty Map on error so rule rendering falls back
 * to `{code, name: code}`.
 */
async function buildAccountLookup() {
  try {
    const accounts = await getAccountsFlat();
    const m = new Map();
    for (const a of accounts || []) {
      if (a?.code) m.set(String(a.code), { code: a.code, name: a.name || '', nameAr: a.nameAr || '' });
    }
    return m;
  } catch {
    return new Map();
  }
}

/**
 * Build a Map<userId, {id, name, email}> from /api/auth/members.
 * Fail-soft: returns an empty Map on error so createdBy / assignTo fall
 * back to `{id: <uuid>, name: ''}`.
 */
async function buildUserLookup() {
  try {
    const members = await listMembers();
    const arr = Array.isArray(members)
      ? members
      : members?.members || members?.users || [];
    const m = new Map();
    for (const u of arr) {
      const id = u?.id || u?.userId;
      if (!id) continue;
      const name = u?.name || u?.fullName || u?.email || '';
      m.set(String(id), { id, name, email: u?.email || '' });
    }
    return m;
  } catch {
    return new Map();
  }
}

/**
 * Synthesize the UI status string from backend isActive + mutedAt.
 * Backend hard-deletes on DELETE, so 'deleted' is never observed.
 */
function synthStatus(row) {
  if (row?.mutedAt) return 'muted';
  if (row?.isActive === false) return 'muted';
  return 'active';
}

/**
 * Resolve an accountCode string → {code, name} object. Falls back to
 * `{code, name: code}` when the lookup is absent or the code isn't in
 * the CoA (rare; code may be pre-migration).
 */
function resolveAccount(code, accountLookup) {
  const c = code == null ? '' : String(code);
  if (!c) return { code: '', name: '' };
  const hit = accountLookup?.get(c);
  if (hit) return { code: hit.code, name: hit.name || hit.code };
  return { code: c, name: c };
}

/**
 * Resolve a userId UUID → {id, name} object. Falls back to
 * `{id, name: ''}` when the lookup is absent or the id isn't in the
 * member list (could be a deleted user, pre-migration rule, etc.).
 */
function resolveUser(id, userLookup) {
  if (!id) return null;
  const hit = userLookup?.get(String(id));
  if (hit) return { id: hit.id, name: hit.name || '' };
  return { id, name: '' };
}

/**
 * Adapt a backend LabelingRuleDto → UI CategorizationRule shape.
 *
 * Backend DTO:
 *   { id, merchantPattern, matchType, category, accountCode,
 *     counterAccount, isActive, mutedAt, mutedBy, createdBy, createdAt }
 *
 * UI shape (CategorizationRuleRow + RuleDetailExpanded):
 *   { id, name,
 *     merchantPattern: { type, value },
 *     debitAccount:  { code, name },
 *     creditAccount: { code, name },
 *     mode, conditions: { amountMin, amountMax, sourceAccount },
 *     costCenter, approvalThreshold,
 *     status, appliedCount, lastAppliedAt,
 *     createdBy: { id, name }, createdAt, auditTrail: [] }
 *
 * Defaulted fields are documented at the top of this file (mode,
 * conditions, costCenter, approvalThreshold, appliedCount, etc.).
 */
function adaptLabelingRuleForUI(row, accountLookup, userLookup) {
  if (!row) return null;
  return {
    id: row.id,
    // HASEEB-397 B3: backend doesn't store a display name today —
    // synthesise from merchantPattern + category to keep RulesScreen
    // search/filter by name functional.
    name: `${row.merchantPattern || ''} → ${row.category || ''}`.trim(),
    merchantPattern: {
      type: row.matchType || 'contains',
      value: row.merchantPattern || '',
    },
    debitAccount: resolveAccount(row.accountCode, accountLookup),
    creditAccount: resolveAccount(row.counterAccount, accountLookup),
    // HASEEB-397 B3: backend LabelingRule has no `mode` field (it is
    // always auto-apply deterministic). Surfaced as 'automatic' so the
    // ModePill renders a sensible string; a backend enhancement to
    // carry mode would replace this default.
    mode: 'automatic',
    // HASEEB-397 B3: backend LabelingRule has no conditions surface.
    conditions: { amountMin: null, amountMax: null, sourceAccount: null },
    // HASEEB-397 B3: backend LabelingRule has no cost-center /
    // approval-threshold fields.
    costCenter: null,
    approvalThreshold: null,
    status: synthStatus(row),
    // HASEEB-397 B3: backend doesn't count applications (no
    // appliedCount column on LabelingRule). UI renders "0" until the
    // backend surfaces this.
    appliedCount: 0,
    // HASEEB-397 B3: no persisted lastAppliedAt.
    lastAppliedAt: null,
    createdBy: resolveUser(row.createdBy, userLookup) || { id: '', name: '' },
    createdAt: row.createdAt || new Date().toISOString(),
    // HASEEB-397 B3: no audit-trail persistence. Empty array keeps the
    // RuleAuditTrail component from crashing.
    auditTrail: [],
    // Raw passthrough for future adapters / debugging.
    _raw: row,
  };
}

/**
 * Adapt a backend RoutingRuleDto → UI RoutingRule shape.
 *
 * Backend DTO:
 *   { id, category, accountCode, reviewerUserId, note, isActive,
 *     mutedAt, mutedBy, createdBy, createdAt }
 *
 * UI shape (RoutingRuleRow + RuleDetailExpanded):
 *   { id, name,
 *     trigger: { taskTypes, linkedItemTypes, conditions },
 *     action:  { assignTo: { id, name }, alsoNotify, priority },
 *     status, appliedCount, lastAppliedAt,
 *     createdBy: { id, name }, createdAt, auditTrail: [] }
 */
function adaptRoutingRuleForUI(row, userLookup) {
  if (!row) return null;
  const assignTo = resolveUser(row.reviewerUserId, userLookup) || { id: '', name: '' };
  return {
    id: row.id,
    // HASEEB-397 B3: backend has no display name; synthesise from
    // category + (optional) accountCode.
    name: row.accountCode
      ? `${row.category || ''} (${row.accountCode}) → ${assignTo.name || '—'}`
      : `${row.category || ''} → ${assignTo.name || '—'}`,
    // HASEEB-397 B3: backend has no trigger surface. Surface a minimal
    // "all" trigger with the category as a soft account-category
    // condition so the conditionSummary line renders non-empty.
    trigger: {
      taskTypes: ['all'],
      linkedItemTypes: [],
      conditions: row.category
        ? { accountCategory: row.category }
        : {},
    },
    action: {
      assignTo,
      // HASEEB-397 B3: backend has no alsoNotify surface.
      alsoNotify: null,
      // HASEEB-397 B3: backend has no priority field.
      priority: 'normal',
    },
    status: synthStatus(row),
    appliedCount: 0,
    lastAppliedAt: null,
    createdBy: resolveUser(row.createdBy, userLookup) || { id: '', name: '' },
    createdAt: row.createdAt || new Date().toISOString(),
    auditTrail: [],
    _raw: row,
  };
}

/**
 * Translate the mock's `filter` argument → backend's `includeInactive`
 * query param.
 *
 *   mock filter 'all'     → includeInactive=true  (include muted rows)
 *   mock filter 'active'  → includeInactive=false (isActive=true only)
 *   mock filter 'muted'   → includeInactive=true  (returns both; UI
 *                           filters status='muted' client-side)
 *   mock filter 'deleted' → includeInactive=true  (backend hard-deletes
 *                           so this returns whatever remains; screen
 *                           shows empty state)
 */
function filterToQuery(filter) {
  const f = filter || 'all';
  if (f === 'active') return { includeInactive: false };
  return { includeInactive: true };
}

// ─────────── LabelingRule (categorization) ───────────

/**
 * GET /api/rules — list categorization rules.
 *
 * Mock signature: `getCategorizationRules(filter = "all")`
 *   filter ∈ {"all", "active", "muted", "deleted"}.
 * Screen passes "all"; mute/unmute actions filter status client-side.
 */
export async function getCategorizationRules(filter = 'all') {
  const [accountLookup, userLookup] = await Promise.all([
    buildAccountLookup(),
    buildUserLookup(),
  ]);
  const r = await client.get('/api/rules', { params: filterToQuery(filter) });
  const data = unwrap(r);
  const rows = Array.isArray(data?.rows)
    ? data.rows
    : Array.isArray(data)
      ? data
      : [];
  return rows.map((row) => adaptLabelingRuleForUI(row, accountLookup, userLookup));
}

/**
 * POST /api/rules/:id/mute — mute a categorization rule.
 *
 * Screen calls `muteCategorizationRule(rule.id)` and refreshes the
 * list. We return the adapted UI row for consistency with the mock
 * (screen doesn't use the return value today, but future callers may).
 */
export async function muteCategorizationRule(id) {
  const [accountLookup, userLookup] = await Promise.all([
    buildAccountLookup(),
    buildUserLookup(),
  ]);
  const r = await client.post(`/api/rules/${encodeURIComponent(id)}/mute`);
  const row = unwrap(r);
  return adaptLabelingRuleForUI(row, accountLookup, userLookup);
}

/** POST /api/rules/:id/unmute — unmute a categorization rule. */
export async function unmuteCategorizationRule(id) {
  const [accountLookup, userLookup] = await Promise.all([
    buildAccountLookup(),
    buildUserLookup(),
  ]);
  const r = await client.post(`/api/rules/${encodeURIComponent(id)}/unmute`);
  const row = unwrap(r);
  return adaptLabelingRuleForUI(row, accountLookup, userLookup);
}

/**
 * DELETE /api/rules/:id — delete a categorization rule.
 *
 * Backend hard-deletes and returns `{ deleted: true, id }`. Screen
 * calls this then refreshes the list; it doesn't inspect the return
 * value. We surface `{ id, status: 'deleted' }` so any future inspector
 * sees a stable shape.
 */
export async function deleteCategorizationRule(id) {
  const r = await client.delete(`/api/rules/${encodeURIComponent(id)}`);
  const res = unwrap(r);
  return { id: res?.id || id, status: 'deleted' };
}

// ─────────── RoutingRule ───────────

/**
 * GET /api/routing-rules — list routing rules.
 *
 * Mock signature: `getRoutingRules(filter = "all")`.
 */
export async function getRoutingRules(filter = 'all') {
  const userLookup = await buildUserLookup();
  const r = await client.get('/api/routing-rules', { params: filterToQuery(filter) });
  const data = unwrap(r);
  const rows = Array.isArray(data?.rows)
    ? data.rows
    : Array.isArray(data)
      ? data
      : [];
  return rows.map((row) => adaptRoutingRuleForUI(row, userLookup));
}

/** POST /api/routing-rules/:id/mute — mute a routing rule. */
export async function muteRoutingRule(id) {
  const userLookup = await buildUserLookup();
  const r = await client.post(`/api/routing-rules/${encodeURIComponent(id)}/mute`);
  const row = unwrap(r);
  return adaptRoutingRuleForUI(row, userLookup);
}

/** POST /api/routing-rules/:id/unmute — unmute a routing rule. */
export async function unmuteRoutingRule(id) {
  const userLookup = await buildUserLookup();
  const r = await client.post(`/api/routing-rules/${encodeURIComponent(id)}/unmute`);
  const row = unwrap(r);
  return adaptRoutingRuleForUI(row, userLookup);
}

/** DELETE /api/routing-rules/:id — delete a routing rule (hard-delete). */
export async function deleteRoutingRule(id) {
  const r = await client.delete(`/api/routing-rules/${encodeURIComponent(id)}`);
  const res = unwrap(r);
  return { id: res?.id || id, status: 'deleted' };
}

// ─────────── Client-side suggestion-dismissal state ───────────

/**
 * HASEEB-397 B3 (2026-04-24). Sync-contract preserved: the RulesScreen
 * consumes `isSuggestionDismissed` *synchronously* inside
 *   .then(list => list.filter(s => !isSuggestionDismissed(s.id)))
 * so this cannot be promise-returning.
 *
 * Per architect Q2, resolved client-side: a module-local Set<string>
 * holds dismissed ids for the session. This is a process-local cache
 * (no persistence); dismissed suggestions re-appear on reload, which
 * is acceptable because the backend is expected to soft-dismiss when
 * `POST /api/rules/suggestions/:id/dismiss` lands (tracked in B3 as a
 * Fix-B deferral).
 */
const _dismissedSuggestionIds = new Set();

/** Record a suggestion as locally-dismissed. Used by the engine
 *  routing wrapper for `dismissSuggestedRule` (Fix-B coming-soon). */
export function markSuggestionDismissed(id) {
  if (id) _dismissedSuggestionIds.add(String(id));
}

/** Sync predicate — must return synchronously. */
export function isSuggestionDismissed(id) {
  if (!id) return false;
  return _dismissedSuggestionIds.has(String(id));
}
