import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, AlertTriangle, Plus, Trash2 } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import LtrText from "../shared/LtrText";
import { createNrvPolicy } from "../../engine";

const inputStyle = {
  width: "100%",
  background: "var(--bg-surface-sunken)",
  border: "1px solid var(--border-default)",
  borderRadius: 8,
  padding: "8px 10px",
  color: "var(--text-primary)",
  fontSize: 12,
  fontFamily: "inherit",
  outline: "none",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function isValidPercent(v) {
  if (v === "" || v == null) return false;
  return /^\d+(?:\.\d{1,2})?$/.test(String(v).trim());
}

const DEFAULT_BANDS = [
  { minAgeDays: "30", maxAgeDays: "90", writedownPercent: "10", label: "30-90 days" },
  { minAgeDays: "90", maxAgeDays: "180", writedownPercent: "25", label: "90-180 days" },
  { minAgeDays: "180", maxAgeDays: "365", writedownPercent: "50", label: "180-365 days" },
  { minAgeDays: "365", maxAgeDays: "", writedownPercent: "100", label: "> 1 year" },
];

export default function NrvPolicyCreateModal({ open, onClose, onSaved }) {
  const { t } = useTranslation("inventory-nrv");
  useEscapeKey(onClose, open);

  const [activeFrom, setActiveFrom] = useState(today());
  const [activeUntil, setActiveUntil] = useState("");
  const [plRoleCode, setPlRoleCode] = useState("");
  const [liabilityRoleCode, setLiabilityRoleCode] = useState("");
  const [notes, setNotes] = useState("");
  const [bands, setBands] = useState(DEFAULT_BANDS.map((b) => ({ ...b })));
  const [submitError, setSubmitError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setActiveFrom(today());
    setActiveUntil("");
    setPlRoleCode("");
    setLiabilityRoleCode("");
    setNotes("");
    setBands(DEFAULT_BANDS.map((b) => ({ ...b })));
    setSubmitError(null);
  }, [open]);

  if (!open) return null;

  const updateBand = (idx, field, value) =>
    setBands((prev) => prev.map((b, i) => (i === idx ? { ...b, [field]: value } : b)));

  const addBand = () => {
    if (bands.length >= 20) return;
    setBands((prev) => [
      ...prev,
      { minAgeDays: "", maxAgeDays: "", writedownPercent: "", label: "" },
    ]);
  };

  const removeBand = (idx) => {
    if (bands.length === 1) return;
    setBands((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setSubmitError(null);
    if (!activeFrom) return setSubmitError(t("modal.error_active_from_required"));
    if (activeUntil && activeUntil <= activeFrom) {
      return setSubmitError(t("modal.error_until_after_from"));
    }
    if (bands.length === 0) return setSubmitError(t("modal.error_bands_required"));

    const bandsPayload = [];
    for (let i = 0; i < bands.length; i++) {
      const b = bands[i];
      if (!b.label.trim()) return setSubmitError(t("modal.error_band_label", { n: i + 1 }));
      const minAge = parseInt(b.minAgeDays, 10);
      if (!Number.isInteger(minAge) || minAge < 0 || minAge > 10000) {
        return setSubmitError(t("modal.error_band_min_age", { n: i + 1 }));
      }
      let maxAge = null;
      if (b.maxAgeDays !== "" && b.maxAgeDays != null) {
        maxAge = parseInt(b.maxAgeDays, 10);
        if (!Number.isInteger(maxAge) || maxAge < minAge || maxAge > 10000) {
          return setSubmitError(t("modal.error_band_max_age", { n: i + 1 }));
        }
      }
      if (!isValidPercent(b.writedownPercent)) {
        return setSubmitError(t("modal.error_band_percent", { n: i + 1 }));
      }
      const pctNum = Number(b.writedownPercent);
      if (pctNum < 0 || pctNum > 100) {
        return setSubmitError(t("modal.error_band_percent", { n: i + 1 }));
      }
      bandsPayload.push({
        minAgeDays: minAge,
        maxAgeDays: maxAge,
        writedownPercent: Math.round(pctNum * 100),
        label: b.label.trim(),
      });
    }

    setSaving(true);
    try {
      await createNrvPolicy({
        plRoleCode: plRoleCode.trim() || undefined,
        liabilityRoleCode: liabilityRoleCode.trim() || undefined,
        notes: notes.trim() || null,
        activeFrom,
        activeUntil: activeUntil || null,
        bands: bandsPayload,
      });
      if (onSaved) onSaved();
      if (onClose) onClose();
    } catch (err) {
      setSubmitError(err?.message || t("modal.error_generic"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
          zIndex: 300,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 720,
          maxHeight: "calc(100vh - 80px)",
          background: "var(--panel-bg)",
          border: "1px solid var(--border-default)",
          borderRadius: 12,
          zIndex: 301,
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 60px rgba(0,0,0,0.7)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 22px",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.15em",
                color: "var(--text-tertiary)",
              }}
            >
              {t("modal.label")}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22,
                color: "var(--text-primary)",
                marginTop: 2,
              }}
            >
              {t("modal.title")}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("modal.close")}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-tertiary)",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>
        <div
          style={{
            padding: "18px 22px",
            overflowY: "auto",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          {submitError && (
            <div
              role="alert"
              style={{
                display: "flex",
                gap: 8,
                padding: "10px 12px",
                background: "var(--semantic-danger-subtle)",
                border: "1px solid var(--semantic-danger)",
                borderRadius: 8,
                color: "var(--semantic-danger)",
                fontSize: 12,
              }}
            >
              <AlertTriangle size={14} /> {submitError}
            </div>
          )}

          <div
            style={{
              fontSize: 11,
              color: "var(--text-tertiary)",
              padding: "10px 12px",
              background: "var(--bg-surface-sunken)",
              borderRadius: 8,
              border: "1px solid var(--border-default)",
            }}
          >
            {t("modal.hint")}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label={t("modal.field_active_from")}>
              <input
                type="date"
                value={activeFrom}
                onChange={(e) => setActiveFrom(e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label={t("modal.field_active_until")}>
              <input
                type="date"
                value={activeUntil}
                onChange={(e) => setActiveUntil(e.target.value)}
                style={inputStyle}
              />
            </Field>
          </div>

          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.15em",
                  color: "var(--text-tertiary)",
                }}
              >
                {t("modal.bands_heading", { count: bands.length })}
              </div>
              <button
                onClick={addBand}
                disabled={bands.length >= 20}
                style={{
                  background: "transparent",
                  color: "var(--accent-primary)",
                  border: "1px solid var(--accent-primary-border)",
                  padding: "5px 10px",
                  borderRadius: 5,
                  cursor: bands.length >= 20 ? "not-allowed" : "pointer",
                  fontSize: 10,
                  fontFamily: "inherit",
                  fontWeight: 600,
                  opacity: bands.length >= 20 ? 0.5 : 1,
                }}
              >
                <Plus size={11} style={{ verticalAlign: "middle", marginInlineEnd: 4 }} />
                {t("modal.add_band")}
              </button>
            </div>

            <div
              style={{
                border: "1px solid var(--border-default)",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.4fr 80px 80px 100px 40px",
                  gap: 8,
                  padding: "8px 12px",
                  background: "var(--bg-surface-sunken)",
                  borderBottom: "1px solid var(--border-default)",
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  color: "var(--text-tertiary)",
                  textTransform: "uppercase",
                }}
              >
                <div>{t("table.label")}</div>
                <div style={{ textAlign: "end" }}>{t("table.min_age")}</div>
                <div style={{ textAlign: "end" }}>{t("table.max_age")}</div>
                <div style={{ textAlign: "end" }}>{t("table.writedown_pct")}</div>
                <div />
              </div>
              {bands.map((b, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.4fr 80px 80px 100px 40px",
                    gap: 8,
                    padding: "8px 12px",
                    borderBottom:
                      idx === bands.length - 1 ? "none" : "1px solid var(--border-subtle)",
                    alignItems: "center",
                  }}
                >
                  <input
                    value={b.label}
                    onChange={(e) => updateBand(idx, "label", e.target.value)}
                    maxLength={120}
                    placeholder={t("modal.band_label_placeholder")}
                    style={inputStyle}
                  />
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    value={b.minAgeDays}
                    onChange={(e) => updateBand(idx, "minAgeDays", e.target.value)}
                    placeholder="0"
                    style={{
                      ...inputStyle,
                      fontFamily: "'DM Mono', monospace",
                      textAlign: "end",
                    }}
                  />
                  <input
                    type="number"
                    min={0}
                    max={10000}
                    value={b.maxAgeDays}
                    onChange={(e) => updateBand(idx, "maxAgeDays", e.target.value)}
                    placeholder={t("modal.max_age_open")}
                    style={{
                      ...inputStyle,
                      fontFamily: "'DM Mono', monospace",
                      textAlign: "end",
                    }}
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    value={b.writedownPercent}
                    onChange={(e) => updateBand(idx, "writedownPercent", e.target.value)}
                    placeholder="0.00"
                    style={{
                      ...inputStyle,
                      fontFamily: "'DM Mono', monospace",
                      textAlign: "end",
                    }}
                  />
                  <div style={{ textAlign: "end" }}>
                    {bands.length > 1 && (
                      <button
                        onClick={() => removeBand(idx)}
                        aria-label={t("modal.remove_band")}
                        style={{
                          background: "transparent",
                          border: "1px solid var(--border-default)",
                          borderRadius: 4,
                          padding: 4,
                          cursor: "pointer",
                          color: "var(--semantic-danger)",
                        }}
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 6 }}>
              {t("modal.bands_hint")}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label={t("modal.field_pl_role")}>
              <input
                value={plRoleCode}
                onChange={(e) => setPlRoleCode(e.target.value)}
                maxLength={120}
                placeholder="INVENTORY_OBSOLESCENCE_EXPENSE"
                style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }}
              />
            </Field>
            <Field label={t("modal.field_liability_role")}>
              <input
                value={liabilityRoleCode}
                onChange={(e) => setLiabilityRoleCode(e.target.value)}
                maxLength={120}
                placeholder="INVENTORY_OBSOLESCENCE_PROVISION"
                style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }}
              />
            </Field>
          </div>

          <Field label={t("modal.field_notes")}>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={2000}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </Field>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            padding: "14px 22px",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          <button onClick={onClose} style={btnSecondary}>
            {t("modal.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={btnPrimary(saving)}
          >
            {saving ? (
              <>
                <Spinner size={13} />
                &nbsp;{t("modal.saving")}
              </>
            ) : (
              t("modal.save")
            )}
          </button>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.15em",
          color: "var(--text-tertiary)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      {children}
    </div>
  );
}

const btnSecondary = {
  background: "transparent",
  color: "var(--text-secondary)",
  border: "1px solid var(--border-strong)",
  padding: "9px 16px",
  borderRadius: 6,
  cursor: "pointer",
  fontSize: 12,
  fontFamily: "inherit",
};
const btnPrimary = (l) => ({
  background: "var(--accent-primary)",
  color: "#fff",
  border: "none",
  padding: "9px 18px",
  borderRadius: 6,
  cursor: l ? "not-allowed" : "pointer",
  fontSize: 12,
  fontWeight: 600,
  fontFamily: "inherit",
});
