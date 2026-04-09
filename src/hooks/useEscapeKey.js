import { useEffect } from "react";

/**
 * Calls `handler` when the Escape key is pressed.
 * Active only when `enabled` is true (default true).
 * Use inside modals, slide-overs, and dismissable popovers.
 */
export default function useEscapeKey(handler, enabled = true) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const onKey = (e) => {
      if (e.key === "Escape" || e.key === "Esc") {
        handler && handler(e);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handler, enabled]);
}
