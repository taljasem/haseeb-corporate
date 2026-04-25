/**
 * AuthContext — runtime auth state for the Haseeb Corporate dashboard.
 *
 * Wave 2 owns:
 *   - Bootstrapping from localStorage (token + expiresAt persisted as
 *     `haseeb_corp_token` + `haseeb_corp_token_exp`).
 *   - Calling /api/auth/me + /api/auth/tenant-info after a token is present.
 *   - login(slug, email, password) sequence: POST /api/auth/login → store →
 *     fetch profile → fetch tenant info → mark authenticated.
 *   - logout(): DELETE /api/auth/sessions, clear localStorage, clear state.
 *   - Listening for `haseeb:session-expired` events from the axios
 *     interceptor and force-logging out on 401.
 *
 * Hard limitations (documented, intentional):
 *   - No refresh token flow. 24h hard logout is the reality. See auth audit §R3.
 *   - No password reset. Settings shows a "contact your administrator" note
 *     if the user hits the forgot-password link. See §G15.
 *   - `localStorage` is used even though §R2 flags XSS. This is a deliberate
 *     Wave 2 trade-off — the task spec explicitly asks for localStorage,
 *     and the CFO-facing dashboard is served over authenticated HTTPS with
 *     CSP elsewhere. Revisit in Wave 3.
 */
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import * as authApi from '../api/auth';
import { setAuthToken, clearAuthToken } from '../api/client';

const TOKEN_KEY = 'haseeb_corp_token';
const TOKEN_EXP_KEY = 'haseeb_corp_token_exp';

// HASEEB-482 (2026-04-24) — exported so consumers can read auth state
// safely with `useContext(AuthContext)` (returns null when no provider
// is mounted, e.g. component tests without AuthProvider). Existing
// callers continue to use `useAuth()` which adds the missing-provider
// guard for the standard app path.
export const AuthContext = createContext(null);

function readStoredToken() {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const exp = localStorage.getItem(TOKEN_EXP_KEY);
    if (!token) return null;
    if (exp) {
      const t = Number(exp);
      if (Number.isFinite(t) && t < Date.now()) {
        // expired — purge.
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(TOKEN_EXP_KEY);
        return null;
      }
    }
    return token;
  } catch {
    return null;
  }
}

function persistToken(token, expiresAt) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      if (expiresAt) localStorage.setItem(TOKEN_EXP_KEY, String(expiresAt));
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(TOKEN_EXP_KEY);
    }
  } catch {
    // localStorage unavailable (private mode, etc.) — degrade to in-memory only.
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpiredFlash, setSessionExpiredFlash] = useState(false);
  const bootstrapRan = useRef(false);

  const clearSession = useCallback(() => {
    clearAuthToken();
    persistToken(null);
    setToken(null);
    setUser(null);
    setTenant(null);
  }, []);

  // Bootstrap from localStorage on mount.
  useEffect(() => {
    if (bootstrapRan.current) return;
    bootstrapRan.current = true;

    let cancelled = false;
    const stored = readStoredToken();
    if (!stored) {
      setIsLoading(false);
      return;
    }

    setAuthToken(stored);
    setToken(stored);

    (async () => {
      try {
        const [me, tInfo] = await Promise.all([authApi.getMe(), authApi.getTenantInfo()]);
        if (cancelled) return;
        setUser(me?.user || me || null);
        setTenant(tInfo?.tenant || tInfo || null);
      } catch (err) {
        if (cancelled) return;
        // 401 or network failure during bootstrap → drop the stale token.
        clearSession();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clearSession]);

  // Listen for the 401 custom event dispatched by the axios interceptor.
  useEffect(() => {
    function onSessionExpired() {
      clearSession();
      setSessionExpiredFlash(true);
    }
    window.addEventListener('haseeb:session-expired', onSessionExpired);
    return () => window.removeEventListener('haseeb:session-expired', onSessionExpired);
  }, [clearSession]);

  const login = useCallback(async ({ tenantSlug, email, password }) => {
    setIsLoading(true);
    setSessionExpiredFlash(false);
    try {
      const result = await authApi.login({ tenantSlug, email, password });
      const newToken = result?.token;
      if (!newToken) throw { ok: false, code: 'UNKNOWN', message: 'Login response missing token.' };
      // 24h hard expiry.
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
      persistToken(newToken, expiresAt);
      setAuthToken(newToken);
      setToken(newToken);

      // Hydrate profile and tenant in parallel.
      const [me, tInfo] = await Promise.all([
        authApi.getMe().catch(() => null),
        authApi.getTenantInfo().catch(() => null),
      ]);
      setUser(me?.user || me || result?.user || null);
      setTenant(tInfo?.tenant || tInfo || result?.tenant || null);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        code: err?.code || 'UNKNOWN',
        status: err?.status,
        message: err?.message || 'Login failed.',
        retryAfter: err?.retryAfter,
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Even if the DELETE fails (network, already-deleted), clear locally.
    }
    clearSession();
  }, [clearSession]);

  const refreshMe = useCallback(async () => {
    try {
      const me = await authApi.getMe();
      setUser(me?.user || me || null);
      return true;
    } catch {
      return false;
    }
  }, []);

  const value = {
    user,
    tenant,
    token,
    isAuthenticated: Boolean(token && user),
    isLoading,
    sessionExpiredFlash,
    clearSessionExpiredFlash: () => setSessionExpiredFlash(false),
    login,
    logout,
    refreshMe,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
