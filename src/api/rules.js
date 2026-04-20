/**
 * Rules API module — Track B Dispatch 3a wire (2026-04-20).
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
 */
import client from './client';

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
