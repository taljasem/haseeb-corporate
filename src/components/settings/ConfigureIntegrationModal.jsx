import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import { configureIntegration } from "../../engine/mockEngine";

const FREQ = ["hourly", "daily", "realtime"];

export default function ConfigureIntegrationModal({ open, integration, onClose, onSaved }) {
  const { t } = useTranslation("settings");
  useEscapeKey(onClose, open);
  const [syncFrequency, setSyncFrequency] = useState("hourly");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && integration) {
      setSyncFrequency(integration.config?.syncFrequency || "hourly");
      setNotes(integration.config?.notes || "");
    }
  }, [open, integration]);

  if (!open || !integration) return null;

  const handleSave = async () => {
    setSaving(true);
    const updated = await configureIntegration(integration.id, { syncFrequency, notes });
    setSaving(false);
    if (onSaved) onSaved(updated);
    if (onClose) onClose();
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div
        style={{
          position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          width: 460, maxWidth: "calc(100vw - 32px)",
          background: "var(--panel-bg)", border: "1px solid var(--border-default)",
          borderRadius: 12, zIndex: 301, display: "flex", flexDirection: "column",
          boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>
              {t("configure_integration_modal.label")}
            </div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-primary)", letterSpacing: "-0.2px", marginTop: 2 }}>
              {t("configure_integration_modal.title", { name: integration.name })}
            </div>
          </div>
          <button onClick={onClose} aria-label={t("configure_integration_modal.close")} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <Label>{t("configure_integration_modal.field_sync")}</Label>
            <div style={{ display: "flex", gap: 6 }}>
              {FREQ.map((f) => {
                const on = syncFrequency === f;
                return (
                  <button
                    key={f}
                    onClick={() => setSyncFrequency(f)}
                    style={{
                      flex: 1, padding: "9px 10px",
                      background: on ? "var(--accent-primary-subtle)" : "transparent",
                      border: on ? "1px solid rgba(0,196,140,0.30)" : "1px solid var(--border-default)",
                      color: on ? "var(--accent-primary)" : "var(--text-secondary)",
                      borderRadius: 6, cursor: "pointer",
                      fontSize: 11, fontWeight: 600, fontFamily: "inherit",
                    }}
                  >
                    {t(`configure_integration_modal.sync_${f}`)}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <Label>{t("configure_integration_modal.field_notes")}</Label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              style={{
                width: "100%", background: "var(--bg-surface-sunken)",
                border: "1px solid var(--border-default)", borderRadius: 8,
                padding: "10px 12px", color: "var(--text-primary)",
                fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical",
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid var(--border-subtle)" }}>
          <button onClick={onClose} style={btnSecondary}>{t("configure_integration_modal.cancel")}</button>
          <button onClick={handleSave} disabled={saving} style={btnPrimary(saving)}>
            {saving ? <><Spinner size={13} />&nbsp;{t("configure_integration_modal.saving")}</> : t("configure_integration_modal.save")}
          </button>
        </div>
      </div>
    </>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 6 }}>{children}</div>;
}
const btnSecondary = { background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-strong)", padding: "9px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit" };
const btnPrimary = (saving) => ({ background: "var(--accent-primary)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 6, cursor: saving ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" });
