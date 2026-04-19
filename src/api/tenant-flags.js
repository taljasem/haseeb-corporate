/**
 * Tenant Flags API module (Phase 4 UX Dispatch — 2026-04-19).
 *
 *   GET   /api/tenant-flags                — read current flags
 *   PATCH /api/tenant-flags                — partial update
 *
 * Flag shape:
 *   {
 *     hasForeignActivity: boolean
 *     updatedBy?: string
 *     updatedAt?: string
 *   }
 *
 * BACKEND GAP: endpoint does not yet exist on the Corporate API. A spec
 * has been written to memory-bank/specs-for-swagat/2026-04-19-tenant-flags-api.md
 * for the backend team. Until it ships, this wrapper falls back to
 * localStorage (key: `haseeb-tenant-flags`) so the frontend three-surface
 * restructure can ship in parallel. Remove the localStorage branches once
 * the endpoint lands — normalised errors from client.js will surface
 * naturally.
 */
import client from './client';

const STORAGE_KEY = 'haseeb-tenant-flags';
const DEFAULT_FLAGS = Object.freeze({
  hasForeignActivity: false,
});

function unwrap(response) {
  if (response && response.data && typeof response.data === 'object') {
    if ('data' in response.data && 'success' in response.data) {
      return response.data.data;
    }
    return response.data;
  }
  return response?.data;
}

function readLocal() {
  try {
    const raw = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_FLAGS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_FLAGS, ...parsed };
  } catch {
    return { ...DEFAULT_FLAGS };
  }
}

function writeLocal(next) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    // silent — localStorage quota or disabled
  }
}

function isBackendMissing(err) {
  const status = err?.response?.status ?? err?.status;
  return status === 404 || err?.code === 'NETWORK_ERROR';
}

export async function getTenantFlags() {
  try {
    const r = await client.get('/api/tenant-flags');
    return unwrap(r);
  } catch (err) {
    if (isBackendMissing(err)) return readLocal();
    throw err;
  }
}

export async function updateTenantFlags(patch) {
  const sanitized = {};
  if (typeof patch?.hasForeignActivity === 'boolean') {
    sanitized.hasForeignActivity = patch.hasForeignActivity;
  }
  try {
    const r = await client.patch('/api/tenant-flags', sanitized);
    return unwrap(r);
  } catch (err) {
    if (isBackendMissing(err)) {
      const next = { ...readLocal(), ...sanitized, updatedAt: new Date().toISOString() };
      writeLocal(next);
      return next;
    }
    throw err;
  }
}
