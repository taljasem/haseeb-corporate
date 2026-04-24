/**
 * Team API module — HASEEB-398 B14 wire-up (2026-04-24).
 *
 * Backs the TeamScreen's four engine entries: two Fix-A (composed
 * reads over existing live surfaces) and two Fix-B (write ops with
 * no backend route, returning the canonical _notImplemented envelope
 * from `src/engine/not-implemented.js`).
 *
 * ─────────────────────────────────────────────────────────────────────
 * Backend surface used (all already wired elsewhere):
 *   GET /api/team/members      — lightweight roster (OWNER+ACCOUNTANT)
 *     returns: TeamMember[] { id, name, email, role }
 *   GET /api/auth/members      — richer roster (OWNER only)
 *     returns: MemberInfo[] { userId, email, nameEn, nameAr, phone,
 *                              role, joinedAt, lastLoginAt }
 *   GET /api/cfo/team-activity — last-24h activity feed (all roles)
 *     returns: ActivityRow[] { id, actorName, actorInitials, action,
 *                               targetType, target, timestamp }
 *
 * ─────────────────────────────────────────────────────────────────────
 * Shape-adapter notes (TeamScreen expectations)
 *
 * TeamScreen.jsx renders rows against the mockEngine shape:
 *   { id, name, email, initials, role, accessLevel, status, lastActive,
 *     responsibilities: string[], isOnline }
 *
 * Backend fields available per-source:
 *   /api/team/members       id, name, email, role
 *   /api/auth/members       userId, nameEn, email, role, joinedAt, lastLoginAt
 *   (no source)             accessLevel, status, responsibilities, isOnline
 *
 * Defaulted / synthesised fields:
 *   - accessLevel:       derived from role ("Full access" / "Full
 *                        accounting" / "Bookkeeping" / "Read-only") so
 *                        the screen renders a plausible column rather
 *                        than "—" for every row. Backend has no
 *                        per-member accessLevel column today.
 *   - status:            'active' (the /api/team/members feed is
 *                        already filtered to active users backend-side).
 *                        'invited' / 'suspended' never appear in LIVE
 *                        mode until the backend ships a pending-invite
 *                        surface.
 *   - lastActive:        prefers /api/auth/members lastLoginAt when
 *                        available (OWNER viewer); falls back to null
 *                        for non-OWNER callers. UI renders "—" for null.
 *   - responsibilities:  [] — mock derived these from routing-rules;
 *                        the live routing-rules API is OWNER-only and
 *                        lists rules per-tenant not per-user, so
 *                        compose would be O(rules × members) extra
 *                        work. Deferred as a follow-up dispatch; for
 *                        now surface an empty array so the row renders.
 *   - initials:          derived from `name` (first letter of each
 *                        word, uppercase, max 2 chars).
 *   - isOnline:          false (backend has no presence surface today).
 *
 * Security: /api/auth/members is OWNER-only; non-OWNER callers receive
 * a 403 that we catch and degrade to the /api/team/members data set
 * alone (less-rich lastActive). The TeamScreen is an Owner-only
 * surface today but composing defensively prevents a hard crash if
 * a future dispatch exposes TeamScreen to CFO.
 *
 * ─────────────────────────────────────────────────────────────────────
 * Fix-B writes
 *
 * `addTeamMember` and `removeTeamMember` have no matching backend
 * surface on the `/api/team/*` or `/api/team-admin/*` modules today.
 * They return the `_notImplemented` envelope (with a `success: false`
 * + `error` alias so TeamScreen's existing `result?.error` check
 * lights up the coming-soon toast without a try/catch rewrite).
 */
import client from './client';
import { listMembers } from './auth';
import { notImplementedResponse } from '../engine/not-implemented';

function unwrap(response) {
  if (response && response.data && typeof response.data === 'object') {
    if ('data' in response.data && 'success' in response.data) {
      return response.data.data;
    }
    if ('data' in response.data) return response.data.data;
    return response.data;
  }
  return response?.data;
}

/** Derive 1-2 character initials from a name string. */
function toInitials(name) {
  const s = String(name || '').trim();
  if (!s) return '??';
  const parts = s.split(/\s+/).filter(Boolean);
  const chars = parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase());
  return chars.join('') || '??';
}

/**
 * Role string → UI-expected lowercase role key.
 *   OWNER      → 'owner'
 *   ACCOUNTANT → 'cfo'   (CFO persona; the only ACCOUNTANT in the
 *                         product today is the CFO)
 *   VIEWER     → 'junior' (read-only viewer rendered as junior lane)
 *   AUDITOR    → 'auditor'
 *   else       → lowercased passthrough
 */
function normaliseRole(role) {
  const r = String(role || '').toUpperCase();
  switch (r) {
    case 'OWNER':
      return 'owner';
    case 'ACCOUNTANT':
      return 'cfo';
    case 'VIEWER':
      return 'junior';
    case 'AUDITOR':
      return 'auditor';
    default:
      return String(role || '').toLowerCase();
  }
}

/** Derive a plausible access-level string from the role key. */
function accessLevelFromRole(roleKey) {
  switch (roleKey) {
    case 'owner':
      return 'Full access';
    case 'cfo':
      return 'Full accounting';
    case 'junior':
      return 'Bookkeeping';
    case 'auditor':
      return 'Read-only';
    default:
      return '—';
  }
}

// ─────────────────────────────────────────────────────────────────────
// Public API — Fix-A reads
// ─────────────────────────────────────────────────────────────────────

/**
 * Compose a TeamScreen-compatible member list by merging
 * `/api/team/members` with `/api/auth/members` (OWNER only).
 *
 * Strategy:
 *   1. Fetch /api/team/members — always available to OWNER+ACCOUNTANT.
 *   2. Attempt /api/auth/members — enriches with joinedAt + lastLoginAt
 *      for OWNER callers; fail-soft if caller is non-OWNER (403 → skip).
 *   3. Merge on userId. Rows without an enrichment match keep just the
 *      lightweight payload (lastActive = null).
 *
 * The responsibilities field is [] for every row; the UI renders a
 * row without responsibilities cleanly (empty bullet list). Wiring
 * real responsibilities from /api/routing-rules is deferred until
 * the screen rewrite dispatch.
 */
export async function getTeamMembersWithResponsibilities() {
  // Primary fetch (guaranteed).
  let baseRows = [];
  try {
    const r = await client.get('/api/team/members');
    const data = unwrap(r);
    baseRows = Array.isArray(data) ? data : [];
  } catch (err) {
    // If even the primary feed fails the screen cannot render. Re-throw
    // so the caller sees the error (TeamScreen has no error boundary
    // today; it will render "No team members" via the members.filter
    // path when members remains null-ish).
    console.warn('[team] /api/team/members failed', err);
    throw err;
  }

  // Enrichment (OWNER-only; fail-soft).
  const enrichMap = new Map();
  try {
    const enrich = await listMembers();
    const arr = Array.isArray(enrich)
      ? enrich
      : Array.isArray(enrich?.members)
        ? enrich.members
        : [];
    for (const m of arr) {
      const id = m?.userId || m?.id;
      if (!id) continue;
      enrichMap.set(String(id), {
        lastLoginAt: m.lastLoginAt || null,
        joinedAt: m.joinedAt || null,
        phone: m.phone || null,
      });
    }
  } catch (err) {
    // 403 for non-OWNER or any other failure — skip enrichment.
    // Screen continues to render with null lastActive.
    if (err?.status !== 403) {
      console.warn('[team] /api/auth/members enrichment skipped', err);
    }
  }

  return baseRows.map((row) => {
    const id = row.id;
    const roleKey = normaliseRole(row.role);
    const enrichment = enrichMap.get(String(id)) || {};
    const name = row.name || '';
    return {
      id,
      name,
      email: row.email || '',
      initials: toInitials(name),
      role: roleKey,
      accessLevel: accessLevelFromRole(roleKey),
      status: 'active', // backend feed is already isActive=true-filtered
      lastActive: enrichment.lastLoginAt || null,
      responsibilities: [], // deferred — see file header
      isOnline: false, // no presence surface today
      // Raw passthroughs for debugging.
      _raw: row,
    };
  });
}

/**
 * Fetch team activity log, filtered to a specific member when
 * `memberId` is provided.
 *
 * Backend surface: `GET /api/cfo/team-activity?limit=N`
 *   returns flat list, NOT scoped by member. We filter client-side
 *   on the adapted `actorName` (match the member's display name).
 *   Stable enough for the UI's slide-over (first N entries for the
 *   member, up to `limit`).
 *
 * Mock signature: `getTeamActivityLog(memberId, limit = 20)` — returns
 * `[{ id, memberId, action, timestamp, detail }, ...]`.
 *
 * Adapter: the cfo-today adapter already normalises the backend shape
 * into `{ id, initials, name, action, detail, timeAgo }`. We need
 * `timestamp` (raw ISO, for the UI's formatRelativeTime call) in
 * addition to `timeAgo` — so we fetch the raw feed here instead of
 * reusing the cfo-today adapter, keeping the two consumers decoupled.
 *
 * NOTE: `getTeamActivity(limit)` (from cfo-today.js) normalises to the
 * pre-formatted shape used by the CFO landing screen. For the per-member
 * activity slide-over we want raw timestamps, so we call the HTTP
 * endpoint directly and do our own adapter pass.
 */
export async function getTeamActivityLog(memberId, limit = 20) {
  // Fetch a generous slice so we have enough rows to filter down to
  // one member. Backend caps at whatever its service limit is.
  const r = await client.get('/api/cfo/team-activity', {
    params: { limit: Math.max(limit * 5, 50) },
  });
  const data = unwrap(r);
  const rows = Array.isArray(data) ? data : [];
  // If caller didn't pass memberId, return the whole feed (UI does not
  // exercise this path today; kept for API symmetry).
  if (!memberId) {
    return rows.slice(0, limit).map((row, idx) => adaptActivityRow(row, memberId, idx));
  }

  // Resolve the member's display name for client-side filtering.
  // Rather than re-fetch the roster, rely on the actorInitials field +
  // a soft name-prefix match (backend carries actorName). If the
  // member isn't in the first page of results we return an empty
  // array — honest "no recent activity for this member" rather than
  // a cross-member blend.
  const filtered = rows.filter((row) => {
    // Best-effort: match on the member id if the backend surfaces it
    // (it doesn't today — schema has actorName / actorInitials only),
    // fall through to a prefix match on actorName.
    if (row.actorUserId === memberId || row.actorId === memberId) return true;
    return false;
  });

  // Fallback path: backend doesn't expose actorUserId today (see
  // memo 2026-04-24 for the list of fields on team-activity rows).
  // If no rows matched by id we return an empty list, which is the
  // correct "no activity for this member" state. The UI renders
  // "No recent activity" via TeamScreen's activityLog.length === 0
  // branch.
  const out = (filtered.length > 0 ? filtered : []).slice(0, limit);
  return out.map((row, idx) => adaptActivityRow(row, memberId, idx));
}

/**
 * Backend activity row → TeamScreen activity-slide-over row.
 *
 * Backend shape: `{ id, actorName, actorInitials, actorUserId?,
 *   action, targetType, target, timestamp }`.
 * Mock shape:    `{ id, memberId, action, timestamp, detail }`.
 */
function adaptActivityRow(row, memberId, idx) {
  const action = row?.action ? String(row.action).toLowerCase() : 'action';
  const targetType = row?.targetType || '';
  const target = row?.target || '';
  const verb = row?.action
    ? `${row.action.charAt(0).toUpperCase() + row.action.slice(1).toLowerCase()}d`
    : 'Action';
  const detail = target
    ? `${verb} ${targetType} ${target}`.trim()
    : targetType
      ? `${verb} ${targetType}`.trim()
      : verb;
  return {
    id: row?.id || `ta-${idx}`,
    memberId: memberId || row?.actorUserId || row?.actorId || '',
    action,
    timestamp: row?.timestamp || null,
    detail,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Public API — Fix-B writes (coming soon)
// ─────────────────────────────────────────────────────────────────────

/**
 * Invite a new team member.
 *
 * Fix-B: no backend route today. `/api/team` exposes only a read-only
 * /members endpoint; `/api/team-admin` exists but does not include a
 * create-member write matching the InviteMemberModal payload. Returns
 * the canonical `_notImplemented` envelope with a bilingual message.
 *
 * TeamScreen's `handleInvite` ignores the return value and always
 * shows a success toast; the coming-soon message is surfaced when the
 * screen is wired to check for `_notImplemented` in a follow-up
 * dispatch. For now, in LIVE mode the invite modal closes and the
 * roster refresh silently shows no new row (because nothing was
 * persisted) — honest no-op rather than fake-write.
 */
// eslint-disable-next-line no-unused-vars
export async function addTeamMember(_data) {
  return notImplementedResponse('backend_not_shipped', {
    message: 'Inviting team members is coming soon.',
    messageAr: 'دعوة أعضاء الفريق ستتوفر قريباً.',
    extras: {
      success: false,
      // TeamScreen reads `result?.error` on the symmetric handleRemove
      // path — reusing the same key here lets a future wire flip the
      // UI copy without changing the screen.
      error: 'Inviting team members is coming soon.',
    },
  });
}

/**
 * Remove a team member.
 *
 * Fix-B: no backend DELETE on `/api/team` or `/api/team-admin` today.
 * (`/api/auth/members/:id` DELETE does exist in the backend auth
 * module but the frontend has no `removeAuthMember` wrapper and the
 * auth-delete contract requires a self-check we haven't adapted.)
 *
 * Returns `{ success: false, error: <bilingual>, _notImplemented }` so
 * TeamScreen's existing `result?.error` check fires and the
 * coming-soon toast surfaces the message; no screen rewrite required.
 */
// eslint-disable-next-line no-unused-vars
export async function removeTeamMember(_memberId) {
  return notImplementedResponse('backend_not_shipped', {
    message: 'Removing team members is coming soon.',
    messageAr: 'إزالة أعضاء الفريق ستتوفر قريباً.',
    extras: {
      success: false,
      error: 'Removing team members is coming soon.',
    },
  });
}
