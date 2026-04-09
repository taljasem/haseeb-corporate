import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import useEscapeKey from "../../hooks/useEscapeKey";
import Spinner from "../shared/Spinner";
import { runValidators, required, minLength, maxLength } from "../../utils/validation";
import {
  getRecipientsForRole,
  getTaskTypesForDirection,
  createTask,
} from "../../engine/mockEngine";
import Avatar from "./Avatar";
import TaskTypePill from "./TaskTypePill";

const ROLE_TO_SENDER_ID = { Owner: "owner", CFO: "cfo", Junior: "sara" };

function inferDirection(senderRole, recipientRole) {
  if (senderRole === "CFO" && recipientRole !== "Owner" && recipientRole !== "CFO") return "downward";
  if (recipientRole === "CFO" && senderRole !== "CFO") return "upward";
  return "lateral";
}

function FieldDot({ filled }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: filled ? "var(--accent-primary)" : "transparent",
        border: `1px solid ${filled ? "var(--accent-primary)" : "var(--border-strong)"}`,
        marginInlineEnd: 8,
        flexShrink: 0,
      }}
    />
  );
}

function FieldLabel({ filled, children }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.15em",
        color: "var(--text-tertiary)",
        marginBottom: 6,
      }}
    >
      <FieldDot filled={filled} />
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  background: "var(--bg-surface-sunken)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 8,
  padding: "10px 12px",
  color: "var(--text-primary)",
  fontSize: 13,
  fontFamily: "inherit",
  outline: "none",
};

const LINK_OPTIONS = [
  { type: "bank-transaction", id: "BT-4521", preview: "Unidentified Boubyan transfer · +2,462.500" },
  { type: "bank-transaction", id: "BT-4498", preview: "Al Shaya Trading · -24,500.000" },
  { type: "journal-entry",    id: "JE-0415", preview: "PIFSS accrual · 9,500.000 KWD" },
  { type: "journal-entry",    id: "JE-0418", preview: "Wire fee adjustment · 0.500 KWD" },
  { type: "account",          id: "1140",    preview: "Boubyan Bank Settlement Account" },
  { type: "report",           id: "RPT-Q1",  preview: "Q1 marketing spend report" },
];

export default function NewTaskModal({ open, role = "CFO", onClose, onSent, prefilledLinkedItem = null }) {
  const { t } = useTranslation("taskbox");
  const { t: tc } = useTranslation("common");
  useEscapeKey(onClose, open);
  const [recipients, setRecipients] = useState([]);
  const [types, setTypes] = useState([]);
  const [recipient, setRecipient] = useState(null);
  const [type, setType] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [errors, setErrors] = useState({});

  const validate = () => {
    const result = runValidators(
      { subject, bodyText, recipient, type },
      {
        subject: [required(), minLength(3), maxLength(200)],
        bodyText: [maxLength(500)],
        recipient: [required("validation.select_recipient")],
        type: [required()],
      }
    );
    setErrors(result);
    return Object.keys(result).length === 0;
  };

  const fieldError = (key) => {
    const e = errors[key];
    if (!e) return null;
    return (
      <div style={{ fontSize: 12, color: "var(--semantic-danger)", marginTop: 4 }}>
        {tc(e.key, e.values || {})}
      </div>
    );
  };

  const invalidBorder = (key) =>
    errors[key] ? { borderColor: "var(--semantic-danger)" } : null;
  const [linkedItem, setLinkedItem] = useState(prefilledLinkedItem);
  const [dueDate, setDueDate] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    getRecipientsForRole(role).then(setRecipients);
  }, [open, role]);

  useEffect(() => {
    if (!recipient) {
      setTypes([]);
      return;
    }
    const dir = inferDirection(role, recipient.role);
    getTaskTypesForDirection(dir).then(setTypes);
  }, [recipient, role]);

  useEffect(() => {
    if (open) setLinkedItem(prefilledLinkedItem);
  }, [open, prefilledLinkedItem]);

  if (!open) return null;

  const reset = () => {
    setRecipient(null);
    setType("");
    setSubject("");
    setBodyText("");
    setLinkedItem(null);
    setDueDate("");
  };

  const handleSend = async () => {
    if (!validate()) return;
    setSending(true);
    const task = await createTask({
      senderId: ROLE_TO_SENDER_ID[role] || "cfo",
      recipient,
      type,
      subject,
      body: bodyText,
      linkedItem,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
    });
    setSending(false);
    onSent && onSent(task);
    reset();
    onClose && onClose();
  };

  const canSend = recipient && type && subject.trim() && bodyText.trim();

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          zIndex: 300,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 560,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "calc(100vh - 80px)",
          background: "var(--bg-surface-raised)",
          border: "1px solid rgba(255,255,255,0.10)",
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
            borderBottom: "1px solid rgba(255,255,255,0.06)",
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
              {t("new_modal.label")}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22,
                color: "var(--text-primary)",
                letterSpacing: "-0.2px",
                marginTop: 2,
              }}
            >
              {t("new_modal.title")}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("new_modal.close")}
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
          }}
        >
          {/* 1 — TO */}
          <div style={{ marginBottom: 14 }}>
            <FieldLabel filled={!!recipient}>{t("new_modal.to")}</FieldLabel>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 6,
              }}
            >
              {recipients.map((r) => {
                const active = recipient && recipient.id === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => { setRecipient(r); if (errors.recipient) setErrors({ ...errors, recipient: null }); }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 10px",
                      background: active ? "var(--accent-primary-subtle)" : "var(--bg-surface)",
                      border: active ? "1px solid rgba(0,196,140,0.30)" : "1px solid rgba(255,255,255,0.10)",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      textAlign: "start",
                    }}
                  >
                    <Avatar person={r} size={26} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: "var(--text-primary)" }}>{r.name}</div>
                      <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 1 }}>{r.role}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            {fieldError("recipient")}
          </div>

          {/* 2 — TYPE (gated by recipient) */}
          <div style={{ marginBottom: 14, opacity: recipient ? 1 : 0.4, pointerEvents: recipient ? "auto" : "none" }}>
            <FieldLabel filled={!!type}>{t("new_modal.type")}</FieldLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {types.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setType(t.id); if (errors.type) setErrors({ ...errors, type: null }); }}
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    opacity: type === t.id ? 1 : 0.55,
                    transition: "opacity 0.15s ease",
                    outline: type === t.id ? "1px solid rgba(0,196,140,0.40)" : "none",
                    borderRadius: 5,
                  }}
                >
                  <TaskTypePill type={t.id} size="sm" />
                </button>
              ))}
            </div>
            {fieldError("type")}
          </div>

          {/* 3 — SUBJECT (gated by type) */}
          <div style={{ marginBottom: 14, opacity: type ? 1 : 0.4, pointerEvents: type ? "auto" : "none" }}>
            <FieldLabel filled={!!subject.trim()}>{t("new_modal.subject")}</FieldLabel>
            <input
              value={subject}
              onChange={(e) => { setSubject(e.target.value); if (errors.subject) setErrors({ ...errors, subject: null }); }}
              placeholder={t("new_modal.subject_placeholder")}
              style={{ ...inputStyle, ...invalidBorder("subject") }}
            />
            {fieldError("subject")}
          </div>

          {/* 4 — DETAILS */}
          <div style={{ marginBottom: 14, opacity: type ? 1 : 0.4, pointerEvents: type ? "auto" : "none" }}>
            <FieldLabel filled={!!bodyText.trim()}>{t("new_modal.details")}</FieldLabel>
            <textarea
              value={bodyText}
              onChange={(e) => { setBodyText(e.target.value); if (errors.bodyText) setErrors({ ...errors, bodyText: null }); }}
              placeholder={t("new_modal.details_placeholder")}
              rows={5}
              style={{ ...inputStyle, ...invalidBorder("bodyText"), resize: "vertical" }}
            />
            {fieldError("bodyText")}
          </div>

          {/* 5 — LINKED ITEM */}
          <div style={{ marginBottom: 14, opacity: type ? 1 : 0.4, pointerEvents: type ? "auto" : "none" }}>
            <FieldLabel filled={!!linkedItem}>{t("new_modal.link_to_item")}</FieldLabel>
            <select
              value={linkedItem ? linkedItem.id : ""}
              onChange={(e) => {
                const v = e.target.value;
                setLinkedItem(v ? LINK_OPTIONS.find((o) => o.id === v) : null);
              }}
              style={{ ...inputStyle, appearance: "none" }}
            >
              <option value="">{t("new_modal.no_linked_item")}</option>
              {LINK_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  [{o.type}] {o.id} — {o.preview}
                </option>
              ))}
            </select>
          </div>

          {/* 6 — DUE DATE */}
          <div style={{ marginBottom: 14, opacity: type ? 1 : 0.4, pointerEvents: type ? "auto" : "none" }}>
            <FieldLabel filled={!!dueDate}>{t("new_modal.due_date")}</FieldLabel>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={{ ...inputStyle, colorScheme: "dark" }}
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            padding: "14px 22px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              color: "var(--text-secondary)",
              border: "1px solid rgba(255,255,255,0.15)",
              padding: "9px 16px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "inherit",
            }}
          >
            {t("new_modal.cancel")}
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            style={{
              background: "var(--accent-primary)",
              color: "#fff",
              border: "none",
              padding: "9px 18px",
              borderRadius: 6,
              cursor: sending ? "not-allowed" : "pointer",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            {sending ? <><Spinner size={13} />&nbsp;{t("new_modal.sending")}</> : t("new_modal.send")}
          </button>
        </div>
      </div>
    </>
  );
}
