import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, AlertTriangle, Plus, Trash2 } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import { createCostAllocationRule } from "../../engine";

const DRIVER_TYPES = [
  "HEADCOUNT",
  "REVENUE_PERCENT",
  "FLOOR_SPACE",
  "EQUAL_SPLIT",
  "CUSTOM",
];

const inputStyle = {
  width: "100%",
  background: "var(--bg-surface-sunken)",
  border: "1px solid var(--border-default)",
  borderRadius: 8,
  padding: "10px 12px",
  color: "var(--text-primary)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function isValidWeight(v) {
  if (typeof v !== "string") v = String(v ?? "");
  return /^\d+(?:\.\d+)?$/.test(v.trim()) && Number(v) >= 0;
}

export default function CostAllocationRuleModal({
  open,
  accounts,
  onClose,
  onSaved,
}) {
  const { t } = useTranslation("setup");
  useEscapeKey(onClose, open);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [driverType, setDriverType] = useState("HEADCOUNT");
  const [targets, setTargets] = useState([
    { costCenterLabel: "", weight: "" },
    { costCenterLabel: "", weight: "" },
  ]);
  const [activeFrom, setActiveFrom] = useState(today());
  const [activeUntil, setActiveUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [submitError, setSubmitError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName("");
    setDescription("");
    setSourceAccountId("");
    setDriverType("HEADCOUNT");
    setTargets([
      { costCenterLabel: "", weight: "" },
      { costCenterLabel: "", weight: "" },
    ]);
    setActiveFrom(today());
    setActiveUntil("");
    setNotes("");
    setSubmitError(null);
  }, [open]);

  if (!open) return null;

  const updateTarget = (idx, field, value) => {
    setTargets((prev) => {
      const next = prev.slice();
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const addTarget = () => {
    if (targets.length >= 50) return;
    setTargets((prev) => [...prev, { costCenterLabel: "", weight: "" }]);
  };

  const removeTarget = (idx) => {
    if (targets.length <= 1) return;
    setTargets((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalWeight = targets.reduce(
    (a, t) => a + (isValidWeight(t.weight) ? Number(t.weight) : 0),
    0,
  );

  const handleSave = async () => {
    setSubmitError(null);
    if (!name.trim()) {
      setSubmitError(t("alloc_modal.error_name_required"));
      return;
    }
    if (!sourceAccountId) {
      setSubmitError(t("alloc_modal.error_source_required"));
      return;
    }
    const cleanTargets = targets.filter(
      (t) => t.costCenterLabel.trim() && String(t.weight).trim(),
    );
    if (cleanTargets.length < 1) {
      setSubmitError(t("alloc_modal.error_targets_required"));
      return;
    }
    for (const tgt of cleanTargets) {
      if (!isValidWeight(tgt.weight) || Number(tgt.weight) <= 0) {
        setSubmitError(t("alloc_modal.error_weight_format"));
        return;
      }
    }
    if (activeUntil && activeUntil <= activeFrom) {
      setSubmitError(t("alloc_modal.error_active_until_after_from"));
      return;
    }

    setSaving(true);
    try {
      await createCostAllocationRule({
        name: name.trim(),
        description: description.trim() || null,
        sourceAccountId,
        driverType,
        targets: cleanTargets.map((t) => ({
          costCenterLabel: t.costCenterLabel.trim(),
          weight: String(t.weight).trim(),
        })),
        activeFrom,
        activeUntil: activeUntil || null,
        notes: notes.trim() || null,
      });
      if (onSaved) onSaved();
      if (onClose) onClose();
    } catch (err) {
      setSubmitError(err?.message || t("alloc_modal.error_generic"));
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
          width: 600,
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
              {t("alloc_modal.add_label")}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22,
                color: "var(--text-primary)",
                marginTop: 2,
              }}
            >
              {t("alloc_modal.add_title")}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("alloc_modal.close")}
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

          <Field label={t("alloc_modal.field_name")}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={200}
              placeholder={t("alloc_modal.name_placeholder")}
              style={inputStyle}
            />
          </Field>

          <Field label={t("alloc_modal.field_description")}>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={2000}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </Field>

          <Field label={t("alloc_modal.field_source_account")}>
            <select
              value={sourceAccountId}
              onChange={(e) => setSourceAccountId(e.target.value)}
              style={inputStyle}
            >
              <option value="">{t("alloc_modal.source_placeholder")}</option>
              {(accounts || []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.nameEn || a.name}
                </option>
              ))}
            </select>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                marginTop: 4,
              }}
            >
              {t("alloc_modal.source_hint")}
            </div>
          </Field>

          <Field label={t("alloc_modal.field_driver_type")}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {DRIVER_TYPES.map((dt) => {
                const on = driverType === dt;
                return (
                  <button
                    key={dt}
                    onClick={() => setDriverType(dt)}
                    style={{
                      padding: "7px 14px",
                      borderRadius: 14,
                      background: on
                        ? "var(--accent-primary-subtle)"
                        : "var(--bg-surface-sunken)",
                      border: on
                        ? "1px solid rgba(0,196,140,0.30)"
                        : "1px solid var(--border-default)",
                      color: on
                        ? "var(--accent-primary)"
                        : "var(--text-secondary)",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {t(`alloc_modal.driver_${dt}`)}
                  </button>
                );
              })}
            </div>
          </Field>

          {/* Targets */}
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
                {t("alloc_modal.targets_heading")}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-tertiary)",
                  fontFamily: "'DM Mono', monospace",
                }}
              >
                {t("alloc_modal.total_weight", {
                  total: totalWeight.toFixed(3),
                })}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {targets.map((tgt, idx) => (
                <div
                  key={idx}
                  style={{ display: "flex", gap: 8, alignItems: "flex-start" }}
                >
                  <div style={{ flex: 2 }}>
                    <input
                      value={tgt.costCenterLabel}
                      onChange={(e) =>
                        updateTarget(idx, "costCenterLabel", e.target.value)
                      }
                      maxLength={200}
                      placeholder={t("alloc_modal.label_placeholder")}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={tgt.weight}
                      onChange={(e) =>
                        updateTarget(idx, "weight", e.target.value)
                      }
                      placeholder={t("alloc_modal.weight_placeholder")}
                      style={{
                        ...inputStyle,
                        fontFamily: "'DM Mono', monospace",
                      }}
                    />
                  </div>
                  <button
                    onClick={() => removeTarget(idx)}
                    disabled={targets.length <= 1}
                    aria-label={t("alloc_modal.remove_target")}
                    style={{
                      background: "transparent",
                      border: "1px solid var(--border-default)",
                      borderRadius: 6,
                      padding: 10,
                      cursor: targets.length <= 1 ? "not-allowed" : "pointer",
                      color: "var(--text-tertiary)",
                      opacity: targets.length <= 1 ? 0.4 : 1,
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addTarget}
              disabled={targets.length >= 50}
              style={{
                marginTop: 8,
                background: "transparent",
                color: "var(--accent-primary)",
                border: "1px dashed var(--border-default)",
                borderRadius: 6,
                padding: "8px 14px",
                cursor: targets.length >= 50 ? "not-allowed" : "pointer",
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "inherit",
                opacity: targets.length >= 50 ? 0.4 : 1,
              }}
            >
              <Plus
                size={12}
                style={{ verticalAlign: "middle", marginInlineEnd: 6 }}
              />
              {t("alloc_modal.add_target")}
            </button>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                marginTop: 6,
              }}
            >
              {t("alloc_modal.targets_hint")}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Field label={t("alloc_modal.field_active_from")}>
                <input
                  type="date"
                  value={activeFrom}
                  onChange={(e) => setActiveFrom(e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label={t("alloc_modal.field_active_until")}>
                <input
                  type="date"
                  value={activeUntil}
                  onChange={(e) => setActiveUntil(e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </div>
          </div>

          <Field label={t("alloc_modal.field_notes")}>
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
            {t("alloc_modal.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={btnPrimary(saving)}
          >
            {saving ? (
              <>
                <Spinner size={13} />
                &nbsp;{t("alloc_modal.saving")}
              </>
            ) : (
              t("alloc_modal.save")
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
