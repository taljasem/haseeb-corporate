/**
 * Axios client for the Haseeb Corporate API.
 *
 * Wave 2 changes:
 *  - The bearer token is now a RUNTIME ref, not a build-time env var.
 *    AuthContext.login() calls `setAuthToken(...)` and `clearAuthToken()`
 *    is called on logout / 401.
 *  - The old `VITE_DEV_JWT` fallback is preserved: if no runtime token is
 *    set AND the env var is present, we use it. This keeps the Wave 1
 *    "mint a dev JWT and smoke test /health" path alive.
 *  - A 401 response dispatches a browser `CustomEvent('haseeb:session-expired')`
 *    that AuthContext listens for. The client itself stays framework-agnostic
 *    and does NOT redirect, alert, or manipulate the DOM. That's a
 *    responsibility of the UI layer.
 *
 * All errors are still normalized into:
 *    { ok: false, status, code, message }
 * with code ∈ { NETWORK_ERROR, UNAUTHORIZED, SERVER_ERROR, CLIENT_ERROR, UNKNOWN }.
 */
import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const devJwt = import.meta.env.VITE_DEV_JWT || '';

// Runtime token ref. AuthContext owns the value; this module owns the slot.
let _authToken = '';

export function setAuthToken(token) {
  _authToken = token || '';
}

export function clearAuthToken() {
  _authToken = '';
}

export function getAuthToken() {
  return _authToken || devJwt || '';
}

/**
 * Default per-request timeout for the shared axios client (ms).
 *
 * Kept tight (15s) so DB-read endpoints fail fast when the API is down.
 * AI-path endpoints — `/api/ai/chat` and `/api/ai/confirm` — need much
 * longer headroom because Aminah turns involve 1–N LLM round-trips plus
 * tool calls and can legitimately take 18–30s (see
 * `memory-bank/2026-04-22-aminah-latency-post-trim.md`). Those call sites
 * override this default via axios per-request `config.timeout`; see
 * `AI_CHAT_TIMEOUT_MS` in `src/api/chat.js`.
 */
export const DEFAULT_TIMEOUT_MS = 15000;

const client = axios.create({
  baseURL,
  timeout: DEFAULT_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach the current runtime token, or fall back
// to the build-time dev JWT if no runtime token has been set yet.
client.interceptors.request.use(
  (config) => {
    const token = _authToken || devJwt;
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: normalize errors, dispatch 401 event.
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) {
      return Promise.reject({
        ok: false,
        status: 0,
        code: 'NETWORK_ERROR',
        message:
          error.message ||
          `Network error: the Corporate API is unreachable. Is it running at ${baseURL}?`,
      });
    }

    const status = error.response.status;
    const data = error.response.data || {};
    const serverMessage =
      (data && (data.error?.message || data.message || data.error)) ||
      error.message ||
      'Request failed';

    let code = 'UNKNOWN';
    if (status === 401) code = 'UNAUTHORIZED';
    else if (status >= 500) code = 'SERVER_ERROR';
    else if (status >= 400) code = 'CLIENT_ERROR';

    // Fire-and-forget session-expired event on 401. AuthContext listens.
    if (status === 401 && typeof window !== 'undefined') {
      try {
        window.dispatchEvent(
          new CustomEvent('haseeb:session-expired', {
            detail: { message: serverMessage },
          })
        );
      } catch {
        // Some very old environments don't support CustomEvent; ignore.
      }
    }

    // Surface retry-after for 429s so the UI can show a countdown.
    let retryAfter;
    if (status === 429) {
      const header = error.response.headers?.['retry-after'];
      if (header) retryAfter = Number(header);
    }

    return Promise.reject({
      ok: false,
      status,
      code,
      message: serverMessage,
      ...(retryAfter ? { retryAfter } : {}),
    });
  }
);

export default client;
