// Lightweight pub/sub so role views can refresh taskbox/approval counters
// whenever taskbox mutations happen, without touching NavContext or engine
// function signatures.

const _listeners = new Set();

export function subscribeTaskbox(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function emitTaskboxChange() {
  for (const fn of _listeners) {
    try {
      fn();
    } catch (e) {
      /* ignore listener errors */
    }
  }
}
