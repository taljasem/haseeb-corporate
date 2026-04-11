import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, ShieldCheck } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import LtrText from "../shared/LtrText";
import { enableTwoFactor } from "../../engine/mockEngine";

export default function EnableTwoFactorModal({ open, onClose, onEnabled }) {
  const { t } = useTranslation("settings");
  const { t: tc } = useTranslation("common");
  useEscapeKey(onClose, open);
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [backupCodes, setBackupCodes] = useState(null);

  useEffect(() => {
    if (open) {
      setCode("");
      setError(null);
      setBackupCodes(null);
    }
  }, [open]);

  if (!open) return null;

  const handleEnable = async () => {
    if (code.length !== 6) {
      setError("validation.invalid_code");
      return;
    }
    setSaving(true);
    const r = await enableTwoFactor("totp", code);
    setSaving(false);
    if (!r.success) {
      setError(r.error || "validation.invalid_code");
      return;
    }
    setBackupCodes(r.backupCodes);
    if (onEnabled) onEnabled();
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div
        style={{
          position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          width: 500, maxWidth: "calc(100vw - 32px)",
          background: "var(--panel-bg)", border: "1px solid var(--border-default)",
          borderRadius: 12, zIndex: 301, display: "flex", flexDirection: "column",
          boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>
              {t("enable_2fa_modal.label")}
            </div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-primary)", letterSpacing: "-0.2px", marginTop: 2 }}>
              {t("enable_2fa_modal.title")}
            </div>
          </div>
          <button onClick={onClose} aria-label={t("enable_2fa_modal.close")} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "18px 22px" }}>
          {!backupCodes ? (
            <>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 14, lineHeight: 1.5 }}>
                {t("enable_2fa_modal.step_scan")}
              </div>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
                <FakeQR />
              </div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10, lineHeight: 1.5 }}>
                {t("enable_2fa_modal.step_code")}
              </div>
              <input
                value={code}
                onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(null); }}
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                style={{
                  width: "100%", background: "var(--bg-surface-sunken)",
                  border: `1px solid ${error ? "var(--semantic-danger)" : "var(--border-default)"}`,
                  borderRadius: 8, padding: "10px 12px", color: "var(--text-primary)",
                  fontSize: 18, fontFamily: "'DM Mono', monospace", letterSpacing: "0.3em",
                  outline: "none", textAlign: "center",
                }}
              />
              {error && <div style={{ fontSize: 12, color: "var(--semantic-danger)", marginTop: 6 }}>{tc(error)}</div>}
            </>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, color: "var(--accent-primary)" }}>
                <ShieldCheck size={18} />
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t("enable_2fa_modal.enabled_toast")}</div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 6 }}>
                {t("enable_2fa_modal.backup_title")}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.5 }}>
                {t("enable_2fa_modal.backup_sub")}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {backupCodes.map((c) => (
                  <div key={c} style={{
                    fontFamily: "'DM Mono', monospace", fontSize: 13,
                    background: "var(--bg-surface-sunken)",
                    border: "1px solid var(--border-default)",
                    padding: "9px 12px", borderRadius: 6, textAlign: "center",
                    color: "var(--text-primary)",
                  }}>
                    <LtrText>{c}</LtrText>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid var(--border-subtle)" }}>
          {!backupCodes ? (
            <>
              <button onClick={onClose} style={btnSecondary}>{t("enable_2fa_modal.cancel")}</button>
              <button onClick={handleEnable} disabled={saving} style={btnPrimary(saving)}>
                {saving ? <><Spinner size={13} />&nbsp;{t("enable_2fa_modal.enabling")}</> : t("enable_2fa_modal.enable")}
              </button>
            </>
          ) : (
            <button onClick={onClose} style={btnPrimary(false)}>{t("enable_2fa_modal.done")}</button>
          )}
        </div>
      </div>
    </>
  );
}

function FakeQR() {
  // A decorative 11x11 pseudo-QR built from a deterministic seed.
  const size = 11;
  const cells = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const finder = (x < 3 && y < 3) || (x > size - 4 && y < 3) || (x < 3 && y > size - 4);
      const on = finder || ((x * 31 + y * 17) % 3 === 0);
      cells.push({ x, y, on });
    }
  }
  const cell = 12;
  return (
    <div style={{ background: "#fff", padding: 10, borderRadius: 6 }}>
      <svg width={size * cell} height={size * cell}>
        {cells.map((c, i) => (
          <rect key={i} x={c.x * cell} y={c.y * cell} width={cell} height={cell} fill={c.on ? "#000" : "#fff"} />
        ))}
      </svg>
    </div>
  );
}

const btnSecondary = {
  background: "transparent", color: "var(--text-secondary)",
  border: "1px solid var(--border-strong)", padding: "9px 16px",
  borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit",
};
const btnPrimary = (saving) => ({
  background: "var(--accent-primary)", color: "#fff", border: "none",
  padding: "9px 18px", borderRadius: 6, cursor: saving ? "not-allowed" : "pointer",
  fontSize: 12, fontWeight: 600, fontFamily: "inherit",
});
