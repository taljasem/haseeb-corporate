import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X, AlertTriangle } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import { runValidators, required, minLength } from "../../utils/validation";
import { createWriteOffJE, getChartOfAccounts } from "../../engine/mockEngine";
import { emitTaskboxChange } from "../../utils/taskboxBus";

const inputStyle = {
  width: "100%", background: "var(--bg-surface-sunken)",
  border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8,
  padding: "10px 12px", color: "var(--text-primary)",
  fontSize: 13, fontFamily: "inherit", outline: "none",
};

const CATEGORIES = ["bad_debt", "goodwill", "settlement", "other"];

export default function WriteOffModal({ open, invoice, onClose, onSubmitted }) {
  const { t } = useTranslation("aging");
  const { t: tc } = useTranslation("common");
  useEscapeKey(onClose, open);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("bad_debt");
  const [description, setDescription] = useState("");
  const [glAccount, setGlAccount] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !invoice) return;
    setAmount(String(invoice.outstanding || invoice.amount || ""));
    setCategory("bad_debt");
    setDescription("");
    setGlAccount("8300 Bad Debt Write-off");
    setErrors({});
    getChartOfAccounts().then(setAccounts);
  }, [open, invoice]);

  if (!open || !invoice) return null;

  const handleSubmit = async () => {
    const e = runValidators({ description }, { description: [required(), minLength(10)] });
    setErrors(e);
    if (Object.keys(e).length) return;
    setSubmitting(true);
    await createWriteOffJE(invoice.id, Number(amount), `${category}: ${description}`, glAccount);
    emitTaskboxChange();
    setSubmitting(false);
    if (onSubmitted) onSubmitted();
    if (onClose) onClose();
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 520, maxHeight: "calc(100vh - 80px)", background: "var(--bg-surface-raised)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 12, zIndex: 301, display: "flex", flexDirection: "column", boxShadow: "0 24px 60px rgba(0,0,0,0.7)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>{t("writeoff_modal.label")}</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-primary)", marginTop: 2 }}>{t("writeoff_modal.title")}</div>
          </div>
          <button onClick={onClose} aria-label={t("writeoff_modal.close")} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: "18px 22px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{invoice.invoiceNumber} · {invoice.partyName}</div>
          <div style={{ display: "flex", gap: 10, padding: "12px 14px", background: "var(--semantic-warning-subtle)", border: "1px solid rgba(212,168,75,0.30)", borderRadius: 8, color: "var(--semantic-warning)", fontSize: 12, lineHeight: 1.5 }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <div>{t("writeoff_modal.warning")}</div>
          </div>
          <Field label={t("writeoff_modal.field_amount")}>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" style={{ ...inputStyle, fontFamily: "'DM Mono', monospace" }} />
          </Field>
          <Field label={t("writeoff_modal.field_category")}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {CATEGORIES.map((c) => {
                const on = category === c;
                return (
                  <button key={c} onClick={() => setCategory(c)} style={{ padding: "7px 14px", borderRadius: 14, background: on ? "var(--accent-primary-subtle)" : "var(--bg-surface-sunken)", border: on ? "1px solid rgba(0,196,140,0.30)" : "1px solid rgba(255,255,255,0.10)", color: on ? "var(--accent-primary)" : "var(--text-secondary)", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    {t(`writeoff_modal.cat_${c}`)}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label={t("writeoff_modal.field_description")}>
            <textarea value={description} onChange={(e) => { setDescription(e.target.value); if (errors.description) setErrors({}); }} rows={3} style={{ ...inputStyle, resize: "vertical", ...(errors.description ? { borderColor: "var(--semantic-danger)" } : {}) }} />
            {errors.description && <div style={{ fontSize: 12, color: "var(--semantic-danger)", marginTop: 4 }}>{tc(errors.description.key, errors.description.values || {})}</div>}
          </Field>
          <Field label={t("writeoff_modal.field_gl")}>
            <select value={glAccount} onChange={(e) => setGlAccount(e.target.value)} style={{ ...inputStyle, appearance: "none" }}>
              {accounts.filter((a) => a.type === "Expenses").map((a) => (
                <option key={a.code} value={`${a.code} ${a.name}`}>{a.code} — {a.name}</option>
              ))}
            </select>
          </Field>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={onClose} style={btnSecondary}>{t("writeoff_modal.cancel")}</button>
          <button onClick={handleSubmit} disabled={submitting} style={{ background: "var(--semantic-danger)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 6, cursor: submitting ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
            {submitting ? <><Spinner size={13} />&nbsp;{t("writeoff_modal.submitting")}</> : t("writeoff_modal.submit")}
          </button>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }) {
  return <div><div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 6 }}>{label}</div>{children}</div>;
}
const btnSecondary = { background: "transparent", color: "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.15)", padding: "9px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit" };
