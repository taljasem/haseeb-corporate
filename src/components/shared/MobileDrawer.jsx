import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";

/**
 * Mobile sidebar drawer. Renders a backdrop + sliding panel on
 * mobile viewports. Caller controls `open` state.
 * Closes on: backdrop click, X button, Escape key.
 * Body scroll is locked while open.
 */
export default function MobileDrawer({ open, onClose, children }) {
  const { t } = useTranslation("common");

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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            padding: "12px 12px 0",
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            aria-label={t("actions.close")}
            style={{
              width: 44,
              height: 44,
              background: "transparent",
              border: "none",
              color: "var(--text-primary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 6,
            }}
          >
            <X size={22} />
          </button>
        </div>
        <div
          style={{
            flex: "1 1 auto",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            minHeight: 0,
          }}
        >
          {children}
        </div>
      </aside>
    </>
  );
}
