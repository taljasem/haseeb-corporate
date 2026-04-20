/**
 * Settings API module — profile, tenant info, members, change password,
 * notifications, sessions, 2FA, personal activity.
 *
 * The existing SettingsScreen calls `getUserProfile()` and expects a mock
 * shape with `{ id, name, email, role, tenantId, avatarColor, bio, joinedAt }`.
 * /api/auth/me returns a slimmer shape (see auth-subsystem-reference §G20):
 *   { id, email, nameEn, nameAr, role, phone, isActive, ... }
 *
 * The adapter here fills the fields the UI reads and leaves anything
 * missing as a sensible default.
 *
 * Track B Dispatch 2 (2026-04-20) additions:
 *   - GET/POST /api/settings/notifications  (role-appropriate defaults when no row)
 *   - GET       /api/settings/sessions
 *   - DELETE    /api/settings/sessions/:id  (404 if foreign)
 *   - POST      /api/settings/sessions/signout-others
 *   - GET       /api/settings/2fa
 *   - POST      /api/settings/2fa/disable   (400 "2FA is not enabled" until
 *               2FA ENABLE ships; 503 TOTP_PRIMITIVE_PENDING if ever reached
 *               on an enabled user — both surfaced as clean toasts by the UI)
 *   - GET       /api/settings/my-activity?action=...&limit=...
 *               (personal-scope activity; differs from the tenant-wide
 *                /api/admin/audit-log wired in dispatch 2 via
 *                admin-audit-log.js)
 *
 * Errors are normalised by client.js into `{ ok:false, status, code, message }`
 * and surface to callers — callers decide whether to toast or silently degrade.
 */
import client from './client';
import * as auth from './auth';

function unwrap(response) {
  if (response && response.data && typeof response.data === 'object') {
    if ('data' in response.data && 'success' in response.data) {
      return response.data.data;
    }
    return response.data;
  }
  return response?.data;
}

const BACKEND_MY_ACTIVITY_MAX_LIMIT = 500;

export async function getTenantInfo() {
  return auth.getTenantInfo();
}

export async function getCurrentUser() {
  return auth.getMe();
}

export async function listMembers() {
  const data = await auth.listMembers();
  return Array.isArray(data) ? data : data?.members || [];
}

export async function changePassword(currentPassword, newPassword) {
  try {
    const data = await auth.changePassword(currentPassword, newPassword);
    return { success: true, token: data?.token || null, message: data?.message || 'OK' };
  } catch (err) {
    // Normalize to the shape ChangePasswordModal expects (mock returns
    // `{ success: false, error: "..." }`).
    return {
      success: false,
      error: err?.code === 'UNAUTHORIZED'
        ? 'validation.old_password_required'
        : err?.message || 'validation.invalid_format',
    };
  }
}

/**
 * Drop-in replacement for mockEngine.getUserProfile().
 */
export async function getUserProfile() {
  const me = await auth.getMe();
  const user = me?.user || me || {};
  return {
    id: user.id || '',
    name: user.nameEn || user.name || user.email || 'User',
    nameAr: user.nameAr || '',
    email: user.email || '',
    role: (user.role || 'VIEWER').toString(),
    tenantId: user.tenantId || null,
    avatarColor: '#00C48C',
    bio: '',
    joinedAt: user.createdAt || user.joinedAt || null,
    phone: user.phone || '',
    raw: user,
  };
}

// ───────────────────────────────────────────────────────────────────────
// Track B Dispatch 2 — notifications, sessions, 2FA, personal activity.
// ───────────────────────────────────────────────────────────────────────

/**
 * GET /api/settings/notifications
 *
 * Returns role-appropriate defaults if no persisted row exists. Role is
 * derived from the JWT on the backend; no role argument needed.
 *
 * Shape:
 *   {
 *     email_enabled: boolean,
 *     in_app_enabled: boolean,
 *     categories: {
 *       task_assignments, approval_requests, mentions,
 *       daily_digest, weekly_summary,
 *       audit_alerts?, reconciliation_alerts?, budget_alerts?
 *     }
 *   }
 */
export async function getNotificationPreferences() {
  const r = await client.get('/api/settings/notifications');
  return unwrap(r);
}

/**
 * POST /api/settings/notifications — upsert-on-first-write.
 * Role-unsafe categories are pruned by the backend; we send the full
 * preference object and let the server enforce role rules.
 */
export async function updateNotificationPreferences(prefs) {
  const r = await client.post('/api/settings/notifications', prefs || {});
  return unwrap(r);
}

/**
 * GET /api/settings/sessions
 * Array of { id, device, browser, location, lastActive, isCurrent }.
 */
export async function getActiveSessions() {
  const r = await client.get('/api/settings/sessions');
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

/**
 * DELETE /api/settings/sessions/:id — 404 if the caller doesn't own the
 * session. The UI catches and re-fetches on that path.
 */
export async function signOutSession(id) {
  const r = await client.delete(
    `/api/settings/sessions/${encodeURIComponent(id)}`
  );
  return unwrap(r);
}

/**
 * POST /api/settings/sessions/signout-others — returns `{ count: int }`.
 */
export async function signOutAllOtherSessions() {
  const r = await client.post('/api/settings/sessions/signout-others');
  return unwrap(r);
}

/**
 * GET /api/settings/2fa — `{ enabled: boolean, lastChanged: iso|null }`.
 */
export async function getTwoFactorStatus() {
  const r = await client.get('/api/settings/2fa');
  return unwrap(r);
}

/**
 * POST /api/settings/2fa/disable — body `{ code: string }`.
 *
 * Dispatch 2 note: returns 400 "2FA is not enabled" until 2FA ENABLE ships
 * in a future dispatch (verify handled as a clean error by the UI). If
 * ever reached on an enabled user, returns 503 TOTP_PRIMITIVE_PENDING —
 * also clean-error-handled.
 */
export async function disableTwoFactor(code) {
  const r = await client.post('/api/settings/2fa/disable', {
    code: String(code || ''),
  });
  return unwrap(r);
}

/**
 * GET /api/settings/my-activity?action=all|<action>&limit=100
 *
 * Personal-scope activity log for the current user. Distinct from the
 * tenant-wide /api/admin/audit-log surface (see admin-audit-log.js).
 *
 * Entry shape:
 *   { id, timestamp, actor, action, target, ipAddress }
 *
 * @param {{action?: string, limit?: number}} [opts]
 */
export async function getMyActivity(opts = {}) {
  const { action, limit } = opts || {};
  const params = {};
  if (action && action !== 'all') params.action = action;
  if (Number.isFinite(limit)) {
    params.limit = Math.max(
      1,
      Math.min(BACKEND_MY_ACTIVITY_MAX_LIMIT, Math.floor(limit))
    );
  }
  const r = await client.get('/api/settings/my-activity', { params });
  const data = unwrap(r);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}
