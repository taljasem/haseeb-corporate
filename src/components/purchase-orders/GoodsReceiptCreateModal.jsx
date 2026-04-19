import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, AlertTriangle } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import LtrText from "../shared/LtrText";
import { createGoodsReceipt } from "../../engine";

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

export default function GoodsReceiptCreateModal({ open, po, onClose, onSaved }) {
  const { t } = useTranslation("purchase-orders");
  useEscapeKey(onClose, open);

  const [receiptNumber, setReceiptNumber] = useState("");
  const [receivedDate, setReceivedDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [lineQtys, setLineQtys] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !po) return;
    setReceiptNumber("");
    setReceivedDate(today());
    setNotes("");
    const nextRcv = {};
    for (const l of po.lines || []) {
      nextRcv[l.id] = "";
    }
    setLineQtys(nextRcv);
    setSubmitError(null);
  }, [open, po]);

  if (!open || !po) return null;

  const setLineQty = (lineId, value) => {
    setLineQtys((prev) => ({ ...prev, [lineId]: value }));
  };

  const handleSave = async () => {
    setSubmitError(null);
    if (!receiptNumber.trim()) return setSubmitError(t("gr_modal.error_number_required"));
    if (!receivedDate) return setSubmitError(t("gr_modal.error_date_required"));

    const lines = [];
    for (const l of po.lines || []) {
      const v = lineQtys[l.id];
      if (!v || v.trim() === "") continue;
      if (!isValidDecimalQty(v) || Number(v) <= 0) {
        return setSubmitError(t("gr_modal.error_line_qty", { desc: l.description }));
      }
      lines.push({
        purchaseOrderLineId: l.id,
        quantityReceived: String(v).trim(),
      });
    }
    if (lines.length === 0) {
      return setSubmitError(t("gr_modal.error_no_lines"));
    }

    setSaving(true);
    try {
      await createGoodsReceipt({
        receiptNumber: receiptNumber.trim(),
        purchaseOrderId: po.id,
        receivedDate,
        lines,
        notes: notes.trim() || null,
      });
      if (onSaved) onSaved();
      if (onClose) onClose();
    } catch (err) {
      setSubmitError(err?.message || t("gr_modal.error_generic"));
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
          width: 640,
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
              {t("gr_modal.label")}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22,
                color: "var(--text-primary)",
                marginTop: 2,
              }}
            >
              {t("gr_modal.title")}
            </div>
            <LtrText>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-tertiary)",
                  fontFamily: "'DM Mono', monospace",
                  marginTop: 2,
                }}
              >
                {po.poNumber}
              </div>
            </LtrText>
          </div>
          <button
            onClick={onClose}
            aria-label={t("gr_modal.close")}
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
            <Field label={t("gr_modal.field_receipt_number")}>
              <input
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                maxLength={100}
                placeholder="e.g. GR-2026-0001"
                style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }}
              />
            </Field>
            <Field label={t("gr_modal.field_received_date")}>
              <input
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                style={inputStyle}
              />
            </Field>
          </div>

          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.15em",
                color: "var(--text-tertiary)",
                marginBottom: 8,
              }}
            >
              {t("gr_modal.lines_heading")}
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
                  gridTemplateColumns: "1.8fr 80px 90px 110px",
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
                <div style={{ textAlign: "end" }}>{t("table.ordered")}</div>
                <div style={{ textAlign: "end" }}>{t("table.already_rcv")}</div>
                <div style={{ textAlign: "end" }}>{t("table.receive_now")}</div>
              </div>
              {(po.lines || []).map((l, idx) => {
                const alreadyRcv = outstandingForLine(po, l.id);
                const remaining = Math.max(0, Number(l.quantity) - alreadyRcv);
                return (
                  <div
                    key={l.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.8fr 80px 90px 110px",
                      gap: 8,
                      padding: "8px 12px",
                      borderBottom:
                        idx === po.lines.length - 1 ? "none" : "1px solid var(--border-subtle)",
                      alignItems: "center",
                      fontSize: 12,
                    }}
                  >
                    <div style={{ color: "var(--text-primary)" }}>{l.description}</div>
                    <LtrText>
                      <div
                        style={{
                          textAlign: "end",
                          fontFamily: "'DM Mono', monospace",
                          color: "var(--text-secondary)",
                        }}
                      >
                        {Number(l.quantity).toFixed(2)}
                      </div>
                    </LtrText>
                    <LtrText>
                      <div
                        style={{
                          textAlign: "end",
                          fontFamily: "'DM Mono', monospace",
                          color: remaining === 0 ? "var(--accent-primary)" : "var(--text-tertiary)",
                        }}
                      >
                        {alreadyRcv.toFixed(2)}
                      </div>
                    </LtrText>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={lineQtys[l.id] || ""}
                      onChange={(e) => setLineQty(l.id, e.target.value)}
                      placeholder="0.00"
                      style={{
                        ...inputStyle,
                        fontFamily: "'DM Mono', monospace",
                        textAlign: "end",
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 6 }}>
              {t("gr_modal.partial_hint")}
            </div>
          </div>

          <Field label={t("gr_modal.field_notes")}>
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
            {t("gr_modal.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={btnPrimary(saving)}
          >
            {saving ? (
              <>
                <Spinner size={13} />
                &nbsp;{t("gr_modal.saving")}
              </>
            ) : (
              t("gr_modal.save")
            )}
          </button>
        </div>
      </div>
    </>
  );
}

function outstandingForLine(po, lineId) {
  let rcv = 0;
  for (const g of po.receipts || []) {
    for (const rl of g.lines || []) {
      if (rl.purchaseOrderLineId === lineId) rcv += Number(rl.quantityReceived || 0);
    }
  }
  return rcv;
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
