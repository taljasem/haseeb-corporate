import { useEffect, useState } from "react";
import { X } from "lucide-react";
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
        background: filled ? "#00C48C" : "transparent",
        border: `1px solid ${filled ? "#00C48C" : "rgba(255,255,255,0.20)"}`,
        marginRight: 8,
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
        color: "#5B6570",
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
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 8,
  padding: "10px 12px",
  color: "#E6EDF3",
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
  const [recipients, setRecipients] = useState([]);
  const [types, setTypes] = useState([]);
  const [recipient, setRecipient] = useState(null);
  const [type, setType] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
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
          background: "#0C0E12",
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
                color: "#5B6570",
              }}
            >
              NEW TASK
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22,
                color: "#E6EDF3",
                letterSpacing: "-0.2px",
                marginTop: 2,
              }}
            >
              CREATE TASK
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent",
              border: "none",
              color: "#5B6570",
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
            <FieldLabel filled={!!recipient}>TO</FieldLabel>
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
                    onClick={() => setRecipient(r)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 10px",
                      background: active ? "rgba(0,196,140,0.08)" : "rgba(255,255,255,0.02)",
                      border: active ? "1px solid rgba(0,196,140,0.30)" : "1px solid rgba(255,255,255,0.10)",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      textAlign: "left",
                    }}
                  >
                    <Avatar person={r} size={26} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: "#E6EDF3" }}>{r.name}</div>
                      <div style={{ fontSize: 10, color: "#5B6570", marginTop: 1 }}>{r.role}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2 — TYPE (gated by recipient) */}
          <div style={{ marginBottom: 14, opacity: recipient ? 1 : 0.4, pointerEvents: recipient ? "auto" : "none" }}>
            <FieldLabel filled={!!type}>TYPE</FieldLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {types.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
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
          </div>

          {/* 3 — SUBJECT (gated by type) */}
          <div style={{ marginBottom: 14, opacity: type ? 1 : 0.4, pointerEvents: type ? "auto" : "none" }}>
            <FieldLabel filled={!!subject.trim()}>SUBJECT</FieldLabel>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Short, specific subject"
              style={inputStyle}
            />
          </div>

          {/* 4 — DETAILS */}
          <div style={{ marginBottom: 14, opacity: type ? 1 : 0.4, pointerEvents: type ? "auto" : "none" }}>
            <FieldLabel filled={!!bodyText.trim()}>DETAILS</FieldLabel>
            <textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="What needs to happen, why it matters, and any context."
              rows={5}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </div>

          {/* 5 — LINKED ITEM */}
          <div style={{ marginBottom: 14, opacity: type ? 1 : 0.4, pointerEvents: type ? "auto" : "none" }}>
            <FieldLabel filled={!!linkedItem}>LINK TO ITEM (OPTIONAL)</FieldLabel>
            <select
              value={linkedItem ? linkedItem.id : ""}
              onChange={(e) => {
                const v = e.target.value;
                setLinkedItem(v ? LINK_OPTIONS.find((o) => o.id === v) : null);
              }}
              style={{ ...inputStyle, appearance: "none" }}
            >
              <option value="">No linked item</option>
              {LINK_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  [{o.type}] {o.id} — {o.preview}
                </option>
              ))}
            </select>
          </div>

          {/* 6 — DUE DATE */}
          <div style={{ marginBottom: 14, opacity: type ? 1 : 0.4, pointerEvents: type ? "auto" : "none" }}>
            <FieldLabel filled={!!dueDate}>DUE DATE (OPTIONAL)</FieldLabel>
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
              color: "#8B98A5",
              border: "1px solid rgba(255,255,255,0.15)",
              padding: "9px 16px",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "inherit",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!canSend || sending}
            style={{
              background: canSend ? "#00C48C" : "rgba(0,196,140,0.25)",
              color: "#fff",
              border: "none",
              padding: "9px 18px",
              borderRadius: 6,
              cursor: canSend ? "pointer" : "not-allowed",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            {sending ? "Sending..." : "Send task"}
          </button>
        </div>
      </div>
    </>
  );
}
