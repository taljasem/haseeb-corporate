/**
 * Health endpoint wrapper.
 *
 * The Corporate API exposes a public `GET /health` endpoint that
 * does not require authentication. This is the first endpoint wired
 * up in the Wave 1 API integration — it lets us verify reachability
 * and the axios pipeline end-to-end without needing a JWT.
 */
import client from './client';

/**
 * Call the Corporate API /health endpoint.
 * Returns `{ ok: true, status: <payload> }` on success,
 * or the normalized error envelope `{ ok: false, status, code, message }`
 * produced by the response interceptor on failure.
 */
export async function getHealth() {
  try {
    const res = await client.get('/health');
    return { ok: true, status: res.data };
  } catch (err) {
    // Interceptor already normalized the error shape.
    return err;
  }
}
