/**
 * Auth API module — thin wrappers over /api/auth/* endpoints.
 * Used by AuthContext and by the settings API module for profile / tenant info.
 *
 * The Corporate API response envelope is `{ success, data }` (see
 * memory-bank/auth-subsystem-reference.md §6). Callers here receive
 * the unwrapped `data` payload on success, or a rejected promise with
 * the normalized error envelope on failure.
 */
import client from './client';

function unwrap(response) {
  // The API uses `{ success, data }`. Some endpoints return raw objects.
  if (response && response.data && typeof response.data === 'object') {
    if ('data' in response.data) return response.data.data;
    return response.data;
  }
  return response?.data;
}

export async function getTenantBySlug(slug) {
  const r = await client.get(`/api/auth/tenant-by-slug/${encodeURIComponent(slug)}`);
  return unwrap(r);
}

export async function login({ tenantSlug, email, password }) {
  // NB: the API calls it `slug`, not `tenantSlug`. See auth-subsystem-reference §6.
  const r = await client.post('/api/auth/login', {
    slug: tenantSlug,
    email,
    password,
  });
  return unwrap(r); // { token, user, tenant }
}

export async function getMe() {
  const r = await client.get('/api/auth/me');
  return unwrap(r);
}

export async function getTenantInfo() {
  const r = await client.get('/api/auth/tenant-info');
  return unwrap(r);
}

export async function logout() {
  // The auth audit confirms DELETE /api/auth/sessions deletes the CURRENT session.
  // There is no `/sessions/current` alias — it's just DELETE /api/auth/sessions.
  const r = await client.delete('/api/auth/sessions');
  return unwrap(r);
}

export async function changePassword(currentPassword, newPassword) {
  const r = await client.post('/api/auth/change-password', {
    currentPassword,
    newPassword,
  });
  return unwrap(r); // { token, message } — new token returned
}

export async function listMembers() {
  const r = await client.get('/api/auth/members');
  return unwrap(r);
}
