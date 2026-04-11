import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import { runValidators, required, minLength } from "../../utils/validation";
import { sendAgingReminder } from "../../engine/mockEngine";

const inputStyle = {
  width: "100%", background: "var(--bg-surface-sunken)",
  border: "1px solid var(--border-default)", borderRadius: 8,
  padding: "10px 12px", color: "var(--text-primary)",
  fontSize: 13, fontFamily: "inherit", outline: "none",
};

const TEMPLATES = {
  friendly: { subject: "Friendly reminder: Invoice {{num}} due", body: "Hello,\n\nWe wanted to gently remind you that invoice {{num}} is past due. Please let us know if there's anything we can help with.\n\nBest regards" },
  firm:     { subject: "Overdue invoice {{num}} — action required", body: "Hello,\n\nInvoice {{num}} is now significantly overdue. Please arrange payment at your earliest convenience or contact us to discuss.\n\nRegards" },
  final:    { subject: "Final notice: Invoice {{num}}", body: "This is a final notice regarding invoice {{num}}. If payment is not received within 7 business days, we may escalate this matter.\n\nSincerely" },
};

export default function SendReminderModal({ open, invoice, onClose, onSent }) {
  const { t } = useTranslation("aging");
  const { t: tc } = useTranslation("common");
  useEscapeKey(onClose, open);
  const [template, setTemplate] = useState("friendly");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [cc, setCc] = useState("");
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open || !invoice) return;
    const tpl = TEMPLATES[template];
    setSubject(tpl.subject.replace("{{num}}", invoice.invoiceNumber));
    setBody(tpl.body.replace("{{num}}", invoice.invoiceNumber));
    setCc("");
    setErrors({});
  }, [open, invoice, template]);

  if (!open || !invoice) return null;

  const handleSend = async () => {
    const e = runValidators({ subject, body }, { subject: [required(), minLength(3)], body: [required(), minLength(10)] });
    setErrors(e);
    if (Object.keys(e).length) return;
    setSending(true);
    await sendAgingReminder([invoice.id], template, body, cc);
    setSending(false);
    if (onSent) onSent();
    if (onClose) onClose();
  };

  const err = (k) => errors[k] ? <div style={{ fontSize: 12, color: "var(--semantic-danger)", marginTop: 4 }}>{tc(errors[k].key, errors[k].values || {})}</div> : null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", zIndex: 300 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 560, maxWidth: "calc(100vw - 32px)", maxHeight: "calc(100vh - 80px)", background: "var(--panel-bg)", border: "1px solid var(--border-default)", borderRadius: 12, zIndex: 301, display: "flex", flexDirection: "column", boxShadow: "0 24px 60px rgba(0,0,0,0.7)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 22px", borderBottom: "1px solid var(--border-subtle)" }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>{t("reminder_modal.label")}</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "var(--text-primary)", marginTop: 2 }}>{t("reminder_modal.title")}</div>
          </div>
          <button onClick={onClose} aria-label={t("reminder_modal.close")} style={{ background: "transparent", border: "none", color: "var(--text-tertiary)", cursor: "pointer", padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: "18px 22px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label={t("reminder_modal.field_to")}>
            <div style={{ ...inputStyle, background: "var(--bg-surface)", color: "var(--text-secondary)" }}>{invoice.partyName}</div>
          </Field>
          <Field label={t("reminder_modal.field_template")}>
            <div style={{ display: "flex", gap: 6 }}>
              {["friendly", "firm", "final"].map((k) => {
                const on = template === k;
                return (
                  <button key={k} onClick={() => setTemplate(k)} style={{ flex: 1, padding: "9px 10px", background: on ? "var(--accent-primary-subtle)" : "transparent", border: on ? "1px solid rgba(0,196,140,0.30)" : "1px solid var(--border-default)", color: on ? "var(--accent-primary)" : "var(--text-secondary)", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600, fontFamily: "inherit" }}>
                    {t(`reminder_modal.template_${k}`)}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label={t("reminder_modal.field_cc")}>
            <input value={cc} onChange={(e) => setCc(e.target.value)} style={inputStyle} placeholder="cc@example.com" />
          </Field>
          <Field label={t("reminder_modal.field_subject")}>
            <input value={subject} onChange={(e) => { setSubject(e.target.value); if (errors.subject) setErrors({}); }} style={{ ...inputStyle, ...(errors.subject ? { borderColor: "var(--semantic-danger)" } : {}) }} />
            {err("subject")}
          </Field>
          <Field label={t("reminder_modal.field_body")}>
            <textarea value={body} onChange={(e) => { setBody(e.target.value); if (errors.body) setErrors({}); }} rows={7} style={{ ...inputStyle, resize: "vertical", ...(errors.body ? { borderColor: "var(--semantic-danger)" } : {}) }} />
            {err("body")}
          </Field>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", padding: "14px 22px", borderTop: "1px solid var(--border-subtle)" }}>
          <button onClick={onClose} style={btnSecondary}>{t("reminder_modal.cancel")}</button>
          <button onClick={handleSend} disabled={sending} style={btnPrimary(sending)}>
            {sending ? <><Spinner size={13} />&nbsp;{t("reminder_modal.sending")}</> : t("reminder_modal.send")}
          </button>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}
const btnSecondary = { background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-strong)", padding: "9px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit" };
const btnPrimary = (l) => ({ background: "var(--accent-primary)", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 6, cursor: l ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" });
