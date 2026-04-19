import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
// Phase 4 Wave 1 Track B wire (2026-04-19): logPayment routes through the
// engine router. In LIVE mode it dispatches to POST /api/invoices/:id/payment
// for AR and POST /api/bills/:id/payment for AP, both of which require a
// bankAccountId (uuid) per their Zod schemas. The GL-account dropdown
// below populates from the engine's getChartOfAccounts wiring which, in
// LIVE mode, hits getAccountsFlat under the hood.
import { logPayment, getChartOfAccounts } from "../../engine";

const inputStyle = {
  width: "100%", background: "var(--bg-surface-sunken)",
  border: "1px solid var(--border-default)", borderRadius: 8,
  padding: "10px 12px", color: "var(--text-primary)",
  fontSize: 13, fontFamily: "inherit", outline: "none",
};

export default function LogPaymentModal({ open, invoice, onClose, onSaved }) {
  const { t } = useTranslation("aging");
  useEscapeKey(onClose, open);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [method, setMethod] = useState("bank");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  // Phase 4 Wave 1 B-03 fix: surface backend errors instead of swallowing
  // them silently. Pre-wire the mock never rejected; post-wire the live
  // endpoint can reject on 400 validation, 403 role-deny, 409 conflict,
  // 500, or network error. See HASEEB-070.
  const [submitError, setSubmitError] = useState(null);
  // Bank-account picker state. The Corporate API's recordPaymentSchema
  // requires bankAccountId (uuid). We populate candidates from the Chart
  // of Accounts filtered to Assets / Cash-like accounts (1xxx series)
  // that look postable.
  const [bankAccounts, setBankAccounts] = useState([]);
  const [bankAccountId, setBankAccountId] = useState("");

  useEffect(() => {
    if (!open || !invoice) return;
    setAmount(String(invoice.outstanding || invoice.amount || ""));
    setDate(new Date().toISOString().slice(0, 10));
    setMethod("bank");
    setReference("");
    setNotes("");
    setBankAccountId("");
    getChartOfAccounts()
      .then((accounts) => {
        // Cash-like asset accounts. The engine returns {code, name, type,
        // subtype, ...} where type is derived from code-prefix; cash-like
        // subtypes we look for include "Current Assets" and any code in
        // the 11xx range (petty cash / bank operating accounts).
        const cashLike = (accounts || []).filter(
          (a) =>
            a.type === "Assets" &&
            (String(a.code || "").startsWith("11") ||
              (a.subtype || "").toLowerCase().includes("cash")),
        );
        setBankAccounts(cashLike);
        // Default to the first candidate so the required-field gate
        // doesn't trip in MOCK mode (where the mockEngine.logPayment
        // signature ignores bankAccountId anyway).
        if (cashLike.length > 0) {
          // Prefer the raw UUID (LIVE mode) or fall back to the code
          // (MOCK mode; the mockEngine doesn't use it).
          const first = cashLike[0];
          setBankAccountId(first.raw?.id || first.code || "");
        }
      })
      .catch(() => {
        // Silently fail; the modal still submits in MOCK mode where
        // bankAccountId is ignored.
        setBankAccounts([]);
      });
  }, [open, invoice]);

  if (!open || !invoice) return null;

  const handleSave = async () => {
    setSaving(true);
    setSubmitError(null);
    try {
      // Extended signature (Phase 4 Wave 1): pass invoice.type and
      // bankAccountId so the LIVE adapter can dispatch to AR vs AP and
      // satisfy the required bankAccountId uuid. The mockEngine variant
      // ignores the trailing args (legacy `...args` tolerance).
      await logPayment(
        invoice.id,
        Number(amount),
        date,
        method,
        reference,
        notes,
        invoice.type,
        bankAccountId,
      );
      if (onSaved) onSaved();
      if (onClose) onClose();
    } catch (err) {
      // HASEEB-070 fix: surface backend error to the user instead of
      // silently leaving the modal open with no feedback.
      const msg = err?.message || err?.error?.message || String(err) || "Failed to log payment";
      setSubmitError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 480, background: "var(--panel-bg)", border: "1px solid var(--border-default)", borderRadius: 12, zIndex: 301, boxShadow: "0 24px 60px rgba(0,0,0,0.7)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>{t("log_payment_modal.label")}</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-primary)", marginTop: 2 }}>{t("log_payment_modal.title")}</div>
          </div>
          <button onClick={onClose} aria-label={t("log_payment_modal.close")} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{invoice.invoiceNumber} · {invoice.partyName}</div>
          <Field label={t("log_payment_modal.field_amount")}><input value={amount} onChange={(e) => setAmount(e.target.value)} style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }} inputMode="decimal" /></Field>
          <Field label={t("log_payment_modal.field_date")}><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, colorScheme: "dark" }} /></Field>
          <Field label={t("log_payment_modal.field_method")}>
            <select value={method} onChange={(e) => setMethod(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
              {["bank", "check", "cash", "card", "other"].map((m) => (
                <option key={m} value={m}>{t(`log_payment_modal.method_${m}`)}</option>
              ))}
            </select>
          </Field>
          <Field label={t("log_payment_modal.field_bank_account")}>
            <select
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              style={{ ...inputStyle, appearance: "none" }}
            >
              {bankAccounts.length === 0 ? (
                <option value="">{t("log_payment_modal.bank_account_empty")}</option>
              ) : (
                bankAccounts.map((a) => {
                  const id = a.raw?.id || a.code || "";
                  return (
                    <option key={id} value={id}>
                      {a.code} — {a.name}
                    </option>
                  );
                })
              )}
            </select>
          </Field>
          <Field label={t("log_payment_modal.field_reference")}><input value={reference} onChange={(e) => setReference(e.target.value)} style={inputStyle} /></Field>
          <Field label={t("log_payment_modal.field_notes")}><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} /></Field>
        </div>
        {submitError && (
          <div
            role="alert"
            style={{
              margin: "0 22px 12px",
              padding: "10px 12px",
              background: "var(--semantic-danger-subtle)",
              border: "1px solid var(--semantic-danger)",
              borderRadius: 6,
              color: "var(--semantic-danger)",
              fontSize: 12,
              lineHeight: 1.4,
            }}
          >
            {submitError}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid var(--border-subtle)" }}>
          <button onClick={onClose} style={btnSecondary}>{t("log_payment_modal.cancel")}</button>
          <button onClick={handleSave} disabled={saving} style={btnPrimary(saving)}>
            {saving ? <><Spinner size={13} />&nbsp;{t("log_payment_modal.saving")}</> : t("log_payment_modal.save")}
          </button>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }) {
  return <div><div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 6 }}>{label}</div>{children}</div>;
}
const btnSecondary = { background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-strong)", padding: "9px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit" };
const btnPrimary = (l) => ({ background: "var(--accent-primary)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 6, cursor: l ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" });
