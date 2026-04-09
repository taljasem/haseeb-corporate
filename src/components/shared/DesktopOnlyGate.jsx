import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Monitor } from "lucide-react";

const DESKTOP_MIN = 1024;

export default function DesktopOnlyGate() {
  const { t } = useTranslation("common");
  const [tooNarrow, setTooNarrow] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < DESKTOP_MIN : false
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onResize = () => setTooNarrow(window.innerWidth < DESKTOP_MIN);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (!tooNarrow) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "var(--bg-base)",
        color: "var(--text-primary)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 24px",
      }}
    >
      <div
        style={{
          maxWidth: 420,
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 12,
            background: "var(--accent-primary-subtle)",
            border: "1px solid var(--accent-primary-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--accent-primary)",
          }}
        >
          <Monitor size={26} strokeWidth={2} />
        </div>
        <div
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 42,
            lineHeight: 1.1,
            color: "var(--text-primary)",
            letterSpacing: "-0.5px",
          }}
        >
          HASEEB<span style={{ color: "var(--accent-primary)" }}>.</span>
        </div>
        <div
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 22,
            lineHeight: 1.3,
            color: "var(--text-primary)",
            letterSpacing: "-0.2px",
          }}
        >
          {t("desktop_gate.title")}
        </div>
        <div
          style={{
            fontSize: 14,
            lineHeight: 1.6,
            color: "var(--text-secondary)",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {t("desktop_gate.subtext")}
        </div>
      </div>
    </div>
  );
}
