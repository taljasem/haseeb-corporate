/**
 * Settings API module — profile, tenant info, members, change password.
 *
 * The existing SettingsScreen calls `getUserProfile()` and expects a mock
 * shape with `{ id, name, email, role, tenantId, avatarColor, bio, joinedAt }`.
 * /api/auth/me returns a slimmer shape (see auth-subsystem-reference §G20):
 *   { id, email, nameEn, nameAr, role, phone, isActive, ... }
 *
 * The adapter here fills the fields the UI reads and leaves anything
 * missing as a sensible default.
 */
import * as auth from './auth';

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
