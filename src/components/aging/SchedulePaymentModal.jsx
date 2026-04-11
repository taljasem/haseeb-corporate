import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import { scheduleVendorPayment } from "../../engine/mockEngine";

const inputStyle = {
  width: "100%", background: "var(--bg-surface-sunken)",
  border: "1px solid var(--border-default)", borderRadius: 8,
  padding: "10px 12px", color: "var(--text-primary)",
  fontSize: 13, fontFamily: "inherit", outline: "none",
};

export default function SchedulePaymentModal({ open, invoice, onClose, onScheduled }) {
  const { t } = useTranslation("aging");
  useEscapeKey(onClose, open);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [method, setMethod] = useState("bank");
  const [fromAccount, setFromAccount] = useState("1120 KIB Operating Account");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !invoice) return;
    setAmount(String(invoice.outstanding || invoice.amount || ""));
    setDate(invoice.dueDate ? invoice.dueDate.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setMethod("bank");
    setFromAccount("1120 KIB Operating Account");
    setNotes("");
  }, [open, invoice]);

  if (!open || !invoice) return null;

  const handleSave = async () => {
    setSaving(true);
    await scheduleVendorPayment(invoice.id, Number(amount), date, method, fromAccount, notes);
    setSaving(false);
    if (onScheduled) onScheduled();
    if (onClose) onClose();
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 480, background: "var(--panel-bg)", border: "1px solid var(--border-default)", borderRadius: 12, zIndex: 301, boxShadow: "0 24px 60px rgba(0,0,0,0.7)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>{t("schedule_modal.label")}</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-primary)", marginTop: 2 }}>{t("schedule_modal.title")}</div>
          </div>
          <button onClick={onClose} aria-label={t("schedule_modal.close")} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: "18px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{invoice.invoiceNumber} · {invoice.partyName}</div>
          <Field label={t("schedule_modal.field_amount")}><input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }} /></Field>
          <Field label={t("schedule_modal.field_date")}><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...inputStyle, colorScheme: "dark" }} /></Field>
          <Field label={t("schedule_modal.field_method")}>
            <select value={method} onChange={(e) => setMethod(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
              {["bank", "check", "cash", "other"].map((m) => (
                <option key={m} value={m}>{t(`log_payment_modal.method_${m}`)}</option>
              ))}
            </select>
          </Field>
          <Field label={t("schedule_modal.field_from")}><input value={fromAccount} onChange={(e) => setFromAccount(e.target.value)} style={inputStyle} /></Field>
          <Field label={t("schedule_modal.field_notes")}><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical" }} /></Field>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid var(--border-subtle)" }}>
          <button onClick={onClose} style={btnSecondary}>{t("schedule_modal.cancel")}</button>
          <button onClick={handleSave} disabled={saving} style={btnPrimary(saving)}>
            {saving ? <><Spinner size={13} />&nbsp;{t("schedule_modal.saving")}</> : t("schedule_modal.save")}
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
