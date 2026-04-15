/**
 * Engine router — thin abstraction between the mock engine and the real API.
 *
 * Why this exists:
 *   The Haseeb Corporate dashboard has historically run entirely off
 *   `mockEngine.js`, a single in-repo module with ~100 async functions
 *   that simulate the backend. Wave 1 of the API integration foundation
 *   adds the ability to toggle the data source via an env var WITHOUT
 *   touching every caller in the codebase.
 *
 * How it works:
 *   - If VITE_USE_MOCKS is unset or "true" (the default), this module
 *     re-exports the entire mockEngine surface verbatim. Existing
 *     callers that `import { getCashPosition } from '.../engine'` (or
 *     the equivalent via a direct mockEngine import) see identical
 *     behavior.
 *   - If VITE_USE_MOCKS is "false", this module:
 *       • Routes `getHealth()` to the real Corporate API via axios.
 *       • For every other mockEngine export, returns a stub that throws
 *         a clear "not yet implemented in LIVE mode" error so failures
 *         are obvious and actionable, never silent.
 *
 * Migration path:
 *   Callers currently import from `./engine/mockEngine` directly. We
 *   are intentionally NOT migrating those imports in Wave 1 (85 files
 *   touch mockEngine — out of scope). New code and Wave 2 migrations
 *   should import from `./engine` instead of `./engine/mockEngine`.
 *
 * Scope limits (Wave 1):
 *   - No real endpoints other than /health are wired.
 *   - No login flow — a dev JWT in VITE_DEV_JWT is sufficient.
 *   - No react-query / swr / etc.
 */
import * as mockEngine from './mockEngine';
import { getHealth as realGetHealth } from '../api/health';

const useMocks = import.meta.env.VITE_USE_MOCKS !== 'false';

export const ENGINE_MODE = useMocks ? 'MOCK' : 'LIVE';

/**
 * Build a LIVE-mode surface that mirrors mockEngine's shape.
 * Every named export becomes a stub that throws a clear error,
 * except for the ones we explicitly wire to the real API.
 */
function buildLiveSurface() {
  const surface = {};
  const realImpls = {
    getHealth: realGetHealth,
  };

  for (const key of Object.keys(mockEngine)) {
    if (realImpls[key]) {
      surface[key] = realImpls[key];
      continue;
    }
    const original = mockEngine[key];
    if (typeof original === 'function') {
      surface[key] = function notYetImplemented() {
        throw new Error(
          `API integration not yet implemented for ${key}(). ` +
            `Wave 2 will wire this up. ` +
            `Set VITE_USE_MOCKS=true to use mock data.`
        );
      };
    } else {
      // Non-function exports (e.g., constants) fall through to mock values
      // in LIVE mode too, since they carry no API semantics.
      surface[key] = original;
    }
  }

  // Ensure getHealth exists even if mockEngine never defined it.
  if (!surface.getHealth) {
    surface.getHealth = realGetHealth;
  }

  return surface;
}

const surface = useMocks ? { ...mockEngine, getHealth: mockEngine.getHealth || mockHealth } : buildLiveSurface();

/**
 * Mock health fallback for when mockEngine itself does not export one.
 * Keeps the engine surface consistent across modes.
 */
async function mockHealth() {
  return { ok: true, status: { status: 'ok', service: 'mock-engine', version: 'mock' } };
}

// Re-export everything on the surface as a module namespace-like object.
// Consumers can `import { getHealth, ENGINE_MODE } from '.../engine'`.
export default surface;

// Named exports for the two things we care about in Wave 1.
export const getHealth = surface.getHealth;
