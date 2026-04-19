import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, AlertTriangle } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import { recordPettyCashTx } from "../../engine";

const TX_TYPES = ["EXPENSE", "REPLENISH", "ADJUSTMENT"];

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

function isValidDecimal(v) {
  if (typeof v !== "string") v = String(v ?? "");
  return /^\d+(?:\.\d{1,3})?$/.test(v.trim());
}

export default function PettyCashTxModal({
  open,
  box,
  defaultType = "EXPENSE",
  accounts = [],
  onClose,
  onSaved,
}) {
  const { t } = useTranslation("petty-cash");
  useEscapeKey(onClose, open);

  const [type, setType] = useState(defaultType);
  const [txDate, setTxDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [receiptRef, setReceiptRef] = useState("");
  const [expenseAccountId, setExpenseAccountId] = useState("");
  const [submitError, setSubmitError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType(defaultType || "EXPENSE");
    setTxDate(today());
    setAmount("");
    setDescription("");
    setReceiptRef("");
    setExpenseAccountId("");
    setSubmitError(null);
  }, [open, defaultType]);

  if (!open || !box) return null;

  const handleSave = async () => {
    setSubmitError(null);
    if (!txDate) {
      setSubmitError(t("tx_modal.error_date_required"));
      return;
    }
    if (!isValidDecimal(amount)) {
      setSubmitError(t("tx_modal.error_amount_format"));
      return;
    }
    if (Number(amount) <= 0) {
      setSubmitError(t("tx_modal.error_amount_positive"));
      return;
    }
    if (!description.trim()) {
      setSubmitError(t("tx_modal.error_description_required"));
      return;
    }

    setSaving(true);
    try {
      await recordPettyCashTx(box.id, {
        txDate,
        type,
        amountKwd: String(amount).trim(),
        description: description.trim(),
        receiptRef: receiptRef.trim() || null,
        expenseAccountId:
          type === "EXPENSE" && expenseAccountId
            ? expenseAccountId
            : null,
      });
      if (onSaved) onSaved();
      if (onClose) onClose();
    } catch (err) {
      setSubmitError(err?.message || t("tx_modal.error_generic"));
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
          width: 540,
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
              {t("tx_modal.add_label")}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22,
                color: "var(--text-primary)",
                marginTop: 2,
              }}
            >
              {t("tx_modal.add_title", { box: box.label })}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("tx_modal.close")}
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

          <Field label={t("tx_modal.field_type")}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {TX_TYPES.map((tp) => {
                const on = type === tp;
                return (
                  <button
                    key={tp}
                    onClick={() => setType(tp)}
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
                    {t(`tx_modal.type_${tp}`)}
                  </button>
                );
              })}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                marginTop: 6,
              }}
            >
              {t(`tx_modal.type_hint_${type}`)}
            </div>
          </Field>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Field label={t("tx_modal.field_tx_date")}>
                <input
                  type="date"
                  value={txDate}
                  onChange={(e) => setTxDate(e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label={t("tx_modal.field_amount")}>
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.000"
                  style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }}
                />
              </Field>
            </div>
          </div>

          <Field label={t("tx_modal.field_description")}>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              placeholder={t("tx_modal.description_placeholder")}
              style={inputStyle}
            />
          </Field>

          <Field label={t("tx_modal.field_receipt_ref")}>
            <input
              value={receiptRef}
              onChange={(e) => setReceiptRef(e.target.value)}
              maxLength={200}
              placeholder={t("tx_modal.receipt_placeholder")}
              style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }}
            />
          </Field>

          {type === "EXPENSE" && accounts.length > 0 && (
            <Field label={t("tx_modal.field_expense_account")}>
              <select
                value={expenseAccountId}
                onChange={(e) => setExpenseAccountId(e.target.value)}
                style={inputStyle}
              >
                <option value="">{t("tx_modal.expense_account_none")}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.nameEn || a.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
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
            {t("tx_modal.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={btnPrimary(saving)}
          >
            {saving ? (
              <>
                <Spinner size={13} />
                &nbsp;{t("tx_modal.saving")}
              </>
            ) : (
              t("tx_modal.save")
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
