import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Plug } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";

// Demo catalog of available integrations the user can add. Matches the
// integrations returned by getIntegrations() so "adding" flips an existing
// row to connected.
const CATALOG = [
  { id: "int-deliv", name: "Deliveroo",         category: "Delivery" },
  { id: "int-qb",    name: "QuickBooks Export", category: "Accounting" },
  { id: "int-zid",   name: "Zid E-commerce",    category: "E-commerce" },
];

export default function AddIntegrationModal({ open, onClose, onAdd }) {
  const { t } = useTranslation("settings");
  useEscapeKey(onClose, open);
  const [connecting, setConnecting] = useState(null);

  if (!open) return null;

  const handleConnect = async (id) => {
    setConnecting(id);
    await onAdd(id);
    setConnecting(null);
    if (onClose) onClose();
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div
        style={{
          position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          width: 480, maxWidth: "calc(100vw - 32px)",
          background: "var(--bg-surface-raised)", border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 12, zIndex: 301, display: "flex", flexDirection: "column",
          boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>
              {t("add_integration_modal.label")}
            </div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-primary)", letterSpacing: "-0.2px", marginTop: 2 }}>
              {t("add_integration_modal.title")}
            </div>
          </div>
          <button onClick={onClose} aria-label={t("add_integration_modal.close")} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "18px 22px" }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 14 }}>
            {t("add_integration_modal.sub")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {CATALOG.map((i) => (
              <div
                key={i.id}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px",
                  background: "var(--bg-surface)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                }}
              >
                <Plug size={16} color="var(--text-tertiary)" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{i.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{i.category}</div>
                </div>
                <button
                  onClick={() => handleConnect(i.id)}
                  disabled={connecting === i.id}
                  style={{
                    background: "var(--accent-primary)", color: "#fff", border: "none",
                    padding: "7px 14px", borderRadius: 6, cursor: "pointer",
                    fontSize: 11, fontWeight: 600, fontFamily: "inherit",
                  }}
                >
                  {connecting === i.id ? <><Spinner size={11} />&nbsp;{t("add_integration_modal.connecting")}</> : t("add_integration_modal.connect")}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={onClose} style={{ background: "transparent", color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.15)", padding: "9px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit" }}>
            {t("add_integration_modal.cancel")}
          </button>
        </div>
      </div>
    </>
  );
}
