/**
 * Axios client for the Haseeb Corporate API.
 *
 * This module is ONLY consulted when VITE_USE_MOCKS=false. In the default
 * mock mode, nothing in this file executes at runtime (the engine router
 * short-circuits before importing real endpoints). See src/engine/index.js.
 *
 * Conventions:
 *  - Base URL comes from VITE_API_BASE_URL (default http://localhost:3000)
 *  - Bearer token comes from VITE_DEV_JWT; if unset, no Authorization header
 *    is attached (public endpoints like /health still work).
 *  - All errors are normalized into a structured shape:
 *      { ok: false, status, code, message }
 *    so callers never have to branch on AxiosError vs network error.
 */
import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const devJwt = import.meta.env.VITE_DEV_JWT || '';

const client = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach dev JWT if configured.
client.interceptors.request.use(
  (config) => {
    if (devJwt) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${devJwt}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: normalize errors into a structured envelope.
client.interceptors.response.use(
  (response) => response,
  (error) => {
    // No response received — network / CORS / server down.
    if (!error.response) {
      return Promise.reject({
        ok: false,
        status: 0,
        code: 'NETWORK_ERROR',
        message:
          error.message ||
          'Network error: the Corporate API is unreachable. Is it running at ' +
            baseURL +
            '?',
      });
    }

    const status = error.response.status;
    const serverMessage =
      (error.response.data && (error.response.data.message || error.response.data.error)) ||
      error.message ||
      'Request failed';

    let code = 'UNKNOWN';
    if (status === 401) code = 'UNAUTHORIZED';
    else if (status >= 500) code = 'SERVER_ERROR';
    else if (status >= 400) code = 'CLIENT_ERROR';

    return Promise.reject({
      ok: false,
      status,
      code,
      message: serverMessage,
    });
  }
);

export default client;
