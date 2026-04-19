import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, AlertTriangle, Plus, Trash2 } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import LtrText from "../shared/LtrText";
import { createPurchaseOrder } from "../../engine";

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
function isValidDecimalQty(v) {
  if (v === "" || v == null) return false;
  return /^\d+(?:\.\d{1,2})?$/.test(String(v).trim());
}
function isValidDecimalKwd(v) {
  if (v === "" || v == null) return false;
  return /^\d+(?:\.\d{1,3})?$/.test(String(v).trim());
}

const EMPTY_LINE = { description: "", quantity: "", unitPriceKwd: "" };

export default function PurchaseOrderCreateModal({ open, vendors, onClose, onSaved }) {
  const { t } = useTranslation("purchase-orders");
  useEscapeKey(onClose, open);

  const [poNumber, setPoNumber] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [orderDate, setOrderDate] = useState(today());
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([{ ...EMPTY_LINE }]);
  const [submitError, setSubmitError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPoNumber("");
    setVendorId("");
    setOrderDate(today());
    setExpectedDeliveryDate("");
    setNotes("");
    setLines([{ ...EMPTY_LINE }]);
    setSubmitError(null);
  }, [open]);

  if (!open) return null;

  const updateLine = (idx, field, value) => {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };
  const addLine = () => {
    if (lines.length >= 500) return;
    setLines((prev) => [...prev, { ...EMPTY_LINE }]);
  };
  const removeLine = (idx) => {
    if (lines.length === 1) return;
    setLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const total = lines.reduce((s, l) => {
    const q = Number(l.quantity);
    const p = Number(l.unitPriceKwd);
    return s + (Number.isFinite(q) && Number.isFinite(p) ? q * p : 0);
  }, 0);

  const handleSave = async () => {
    setSubmitError(null);
    if (!poNumber.trim()) return setSubmitError(t("create_modal.error_number_required"));
    if (!vendorId) return setSubmitError(t("create_modal.error_vendor_required"));
    if (!orderDate) return setSubmitError(t("create_modal.error_date_required"));
    if (lines.length === 0) return setSubmitError(t("create_modal.error_lines_required"));
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.description.trim()) return setSubmitError(t("create_modal.error_line_description", { n: i + 1 }));
      if (!isValidDecimalQty(l.quantity) || Number(l.quantity) <= 0) {
        return setSubmitError(t("create_modal.error_line_qty", { n: i + 1 }));
      }
      if (!isValidDecimalKwd(l.unitPriceKwd) || Number(l.unitPriceKwd) < 0) {
        return setSubmitError(t("create_modal.error_line_price", { n: i + 1 }));
      }
    }
    setSaving(true);
    try {
      await createPurchaseOrder({
        poNumber: poNumber.trim(),
        vendorId,
        orderDate,
        expectedDeliveryDate: expectedDeliveryDate || null,
        lines: lines.map((l) => ({
          description: l.description.trim(),
          quantity: String(l.quantity).trim(),
          unitPriceKwd: String(l.unitPriceKwd).trim(),
        })),
        notes: notes.trim() || null,
      });
      if (onSaved) onSaved();
      if (onClose) onClose();
    } catch (err) {
      setSubmitError(err?.message || t("create_modal.error_generic"));
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
          width: 760,
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
              {t("create_modal.label")}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22,
                color: "var(--text-primary)",
                marginTop: 2,
              }}
            >
              {t("create_modal.title")}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("create_modal.close")}
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label={t("create_modal.field_number")}>
              <input
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                maxLength={100}
                placeholder="e.g. PO-2026-0001"
                style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }}
              />
            </Field>
            <Field label={t("create_modal.field_vendor")}>
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                style={inputStyle}
              >
                <option value="">{t("create_modal.vendor_placeholder")}</option>
                {(vendors || []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name || v.nameEn || v.id}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label={t("create_modal.field_order_date")}>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                style={inputStyle}
              />
            </Field>
            <Field label={t("create_modal.field_expected_delivery")}>
              <input
                type="date"
                value={expectedDeliveryDate}
                onChange={(e) => setExpectedDeliveryDate(e.target.value)}
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
                {t("create_modal.lines_heading", { count: lines.length })}
              </div>
              <button
                onClick={addLine}
                disabled={lines.length >= 500}
                style={{
                  ...btnMini,
                  color: "var(--accent-primary)",
                  borderColor: "var(--accent-primary-border)",
                }}
              >
                <Plus size={11} style={{ verticalAlign: "middle", marginInlineEnd: 4 }} />
                {t("create_modal.add_line")}
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
                  gridTemplateColumns: "1.6fr 100px 120px 100px 40px",
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
                <div>{t("table.description")}</div>
                <div style={{ textAlign: "end" }}>{t("table.quantity")}</div>
                <div style={{ textAlign: "end" }}>{t("table.unit_price")}</div>
                <div style={{ textAlign: "end" }}>{t("table.line_total")}</div>
                <div />
              </div>
              {lines.map((l, idx) => {
                const q = Number(l.quantity);
                const p = Number(l.unitPriceKwd);
                const lineTotal = Number.isFinite(q) && Number.isFinite(p) ? q * p : 0;
                return (
                  <div
                    key={idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.6fr 100px 120px 100px 40px",
                      gap: 8,
                      padding: "8px 12px",
                      borderBottom:
                        idx === lines.length - 1 ? "none" : "1px solid var(--border-subtle)",
                      alignItems: "center",
                    }}
                  >
                    <input
                      value={l.description}
                      onChange={(e) => updateLine(idx, "description", e.target.value)}
                      maxLength={500}
                      placeholder={t("create_modal.line_description_placeholder")}
                      style={inputStyle}
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      value={l.quantity}
                      onChange={(e) => updateLine(idx, "quantity", e.target.value)}
                      placeholder="0.00"
                      style={{
                        ...inputStyle,
                        fontFamily: "'DM Mono', monospace",
                        textAlign: "end",
                      }}
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      value={l.unitPriceKwd}
                      onChange={(e) => updateLine(idx, "unitPriceKwd", e.target.value)}
                      placeholder="0.000"
                      style={{
                        ...inputStyle,
                        fontFamily: "'DM Mono', monospace",
                        textAlign: "end",
                      }}
                    />
                    <LtrText>
                      <div
                        style={{
                          textAlign: "end",
                          fontFamily: "'DM Mono', monospace",
                          fontSize: 12,
                          color: "var(--text-secondary)",
                        }}
                      >
                        {lineTotal.toFixed(3)}
                      </div>
                    </LtrText>
                    <div style={{ textAlign: "end" }}>
                      {lines.length > 1 && (
                        <button
                          onClick={() => removeLine(idx)}
                          aria-label={t("table.remove")}
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
                );
              })}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.6fr 100px 120px 100px 40px",
                  gap: 8,
                  padding: "10px 12px",
                  background: "var(--bg-surface-sunken)",
                  borderTop: "1px solid var(--border-default)",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  color: "var(--text-primary)",
                }}
              >
                <div style={{ textTransform: "uppercase" }}>{t("create_modal.total")}</div>
                <div />
                <div />
                <LtrText>
                  <div
                    style={{
                      textAlign: "end",
                      fontFamily: "'DM Mono', monospace",
                      color: "var(--accent-primary)",
                    }}
                  >
                    {total.toFixed(3)} KWD
                  </div>
                </LtrText>
                <div />
              </div>
            </div>
          </div>

          <Field label={t("create_modal.field_notes")}>
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
            {t("create_modal.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={btnPrimary(saving)}
          >
            {saving ? (
              <>
                <Spinner size={13} />
                &nbsp;{t("create_modal.saving")}
              </>
            ) : (
              t("create_modal.save")
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

const btnMini = {
  background: "transparent",
  color: "var(--text-secondary)",
  border: "1px solid var(--border-strong)",
  padding: "5px 10px",
  borderRadius: 5,
  cursor: "pointer",
  fontSize: 10,
  fontFamily: "inherit",
  fontWeight: 600,
};
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
