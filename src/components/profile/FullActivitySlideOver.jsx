import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import { getUserFullActivity } from "../../engine/mockEngine";
import { formatRelativeTime } from "../../utils/relativeTime";

export default function FullActivitySlideOver({ open, onClose }) {
  const { t } = useTranslation("profile");
  useEscapeKey(onClose, open);
  const [items, setItems] = useState(null);

  useEffect(() => {
    if (!open) return;
    getUserFullActivity().then(setItems);
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div
        data-panel="aminah-slideover"
        style={{
          position: "fixed", top: 0, insetInlineEnd: 0, bottom: 0,
          width: 460, maxWidth: "calc(100vw - 32px)",
          background: "var(--bg-surface-raised)",
          borderInlineStart: "1px solid rgba(255,255,255,0.10)",
          zIndex: 301, display: "flex", flexDirection: "column",
          boxShadow: "-24px 0 60px rgba(0,0,0,0.7)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-primary)", letterSpacing: "-0.2px" }}>
            {t("full_activity.title")}
          </div>
          <button onClick={onClose} aria-label={t("full_activity.close")} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {!items ? (
            <div style={{ padding: 24, color: "var(--text-tertiary)", fontSize: 13 }}>{t("loading")}</div>
          ) : (
            items.map((a) => (
              <div
                key={a.id}
                style={{
                  padding: "12px 22px",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  display: "flex", alignItems: "flex-start", gap: 10,
                }}
              >
                <div style={{ flex: 1, fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5 }}>
                  {t(`activity.actions.${a.action}`, { target: a.target })}
                </div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "var(--text-tertiary)", flexShrink: 0 }}>
                  {formatRelativeTime(a.timestamp)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
