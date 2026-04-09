/**
 * Returns an onKeyDown handler that activates `handler` on Enter or Space.
 * Use sparingly — converting to a real <button> is always preferred.
 */
export const activateOnEnter = (handler) => (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    handler && handler(e);
  }
};
