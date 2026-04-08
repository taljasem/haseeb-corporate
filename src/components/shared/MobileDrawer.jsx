import { useEffect } from "react";

/**
 * Mobile sidebar drawer. Renders a backdrop + sliding panel on
 * mobile viewports. Caller controls `open` state.
 * Closes on: backdrop click, Escape key.
 * Body scroll is locked while open.
 */
export default function MobileDrawer({ open, onClose, children }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") onClose && onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="mobile-drawer-backdrop" onClick={onClose} />
      <aside className="mobile-drawer" data-mobile-drawer="true">
        {children}
      </aside>
    </>
  );
}
