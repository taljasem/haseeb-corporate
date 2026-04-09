/**
 * Mock async wrapper. Lets us simulate network latency for loading-state UX
 * before real backend lands. Set MOCK_DELAY_MS to 0 to disable.
 */
export const MOCK_DELAY_MS = 0;

/**
 * Wraps a value (or promise) in a delayed promise. Useful for screens that
 * want to flicker a skeleton loader during dev.
 *
 *   const data = await mockAsync(getBankAccounts());
 */
export function mockAsync(value, delay = MOCK_DELAY_MS) {
  return new Promise((resolve) => {
    if (delay > 0) {
      setTimeout(() => resolve(value), delay);
    } else {
      resolve(value);
    }
  });
}
