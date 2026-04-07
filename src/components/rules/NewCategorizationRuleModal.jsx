import { useState, useEffect } from "react";
import { X } from "lucide-react";
import AccountPicker from "../cfo/AccountPicker";
import { createCategorizationRule, updateCategorizationRule } from "../../engine/mockEngine";

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

function SegBtn({ on, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "8px 10px",
        background: on ? "rgba(0,196,140,0.08)" : "transparent",
        border: on ? "1px solid rgba(0,196,140,0.30)" : "1px solid rgba(255,255,255,0.10)",
        color: on ? "#00C48C" : "#8B98A5",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.04em",
        cursor: "pointer",
        borderRadius: 6,
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}

const MODES = [
  { id: "auto-apply",    label: "Auto-apply",     desc: "Apply automatically to every matching transaction." },
  { id: "suggest-only",  label: "Suggest only",   desc: "Show the suggestion — user must confirm before posting." },
  { id: "ask-each-time", label: "Ask each time",  desc: "Always prompt the user; never apply silently." },
];

export default function NewCategorizationRuleModal({ open, onClose, onCreated, prefill = null, editingRule = null }) {
  const [name, setName] = useState("");
  const [patternType, setPatternType] = useState("contains");
  const [patternValue, setPatternValue] = useState("");
  const [debitAccount, setDebitAccount] = useState(null);
  const [creditAccount, setCreditAccount] = useState(null);
  const [mode, setMode] = useState("auto-apply");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [approvalThreshold, setApprovalThreshold] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingRule) {
      setName(editingRule.name || "");
      setPatternType(editingRule.merchantPattern?.type || "contains");
      setPatternValue(editingRule.merchantPattern?.value || "");
      setDebitAccount(editingRule.debitAccount || null);
      setCreditAccount(editingRule.creditAccount || null);
      setMode(editingRule.mode || "auto-apply");
      setAmountMin(editingRule.conditions?.amountMin != null ? String(editingRule.conditions.amountMin) : "");
      setAmountMax(editingRule.conditions?.amountMax != null ? String(editingRule.conditions.amountMax) : "");
      setApprovalThreshold(editingRule.approvalThreshold != null ? String(editingRule.approvalThreshold) : "");
    } else if (prefill) {
      setName(prefill.name || "");
      setPatternValue(prefill.merchant || "");
    } else {
      setName("");
      setPatternType("contains");
      setPatternValue("");
      setDebitAccount(null);
      setCreditAccount(null);
      setMode("auto-apply");
      setAmountMin("");
      setAmountMax("");
      setApprovalThreshold("");
    }
  }, [open, editingRule, prefill]);

  if (!open) return null;

  const canCreate = name.trim() && patternValue.trim() && debitAccount && creditAccount;

  const handleCreate = async () => {
    setSending(true);
    const params = {
      name,
      merchantPattern: { type: patternType, value: patternValue },
      debitAccount: { code: debitAccount.code, name: debitAccount.name },
      creditAccount: { code: creditAccount.code, name: creditAccount.name },
      mode,
      conditions: {
        amountMin: amountMin ? Number(amountMin) : null,
        amountMax: amountMax ? Number(amountMax) : null,
        sourceAccount: null,
      },
      approvalThreshold: approvalThreshold ? Number(approvalThreshold) : null,
    };
    const rule = editingRule
      ? await updateCategorizationRule(editingRule.id, params)
      : await createCategorizationRule(params);
    setSending(false);
    onCreated && onCreated(rule);
    onClose && onClose();
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
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "#5B6570" }}>
              {editingRule ? "EDIT CATEGORIZATION RULE" : "NEW CATEGORIZATION RULE"}
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
              {editingRule ? "UPDATE RULE" : "CREATE RULE"}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: "transparent", border: "none", color: "#5B6570", cursor: "pointer", padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "18px 22px", overflowY: "auto", flex: 1 }}>
          <div style={{ marginBottom: 14 }}>
            <FieldLabel filled={!!name.trim()}>RULE NAME</FieldLabel>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. KNPC Fuel Station auto-categorization"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <FieldLabel filled={!!patternValue.trim()}>MERCHANT PATTERN</FieldLabel>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              <SegBtn on={patternType === "exact"}    onClick={() => setPatternType("exact")}>Exact</SegBtn>
              <SegBtn on={patternType === "contains"} onClick={() => setPatternType("contains")}>Contains</SegBtn>
              <SegBtn on={patternType === "regex"}    onClick={() => setPatternType("regex")}>Regex</SegBtn>
            </div>
            <input
              value={patternValue}
              onChange={(e) => setPatternValue(e.target.value)}
              placeholder="e.g. KNPC"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <FieldLabel filled={!!debitAccount}>DEBIT ACCOUNT</FieldLabel>
            <AccountPicker onSelect={setDebitAccount} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <FieldLabel filled={!!creditAccount}>CREDIT ACCOUNT</FieldLabel>
            <AccountPicker onSelect={setCreditAccount} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <FieldLabel filled={true}>MODE</FieldLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {MODES.map((m) => {
                const on = mode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: "10px 12px",
                      background: on ? "rgba(0,196,140,0.06)" : "rgba(255,255,255,0.02)",
                      border: on ? "1px solid rgba(0,196,140,0.30)" : "1px solid rgba(255,255,255,0.10)",
                      borderRadius: 8,
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "inherit",
                    }}
                  >
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        border: `2px solid ${on ? "#00C48C" : "rgba(255,255,255,0.20)"}`,
                        background: on ? "#00C48C" : "transparent",
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: "#E6EDF3", fontWeight: 500 }}>{m.label}</div>
                      <div style={{ fontSize: 11, color: "#5B6570", marginTop: 2 }}>{m.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <details style={{ marginBottom: 14 }}>
            <summary
              style={{
                fontSize: 11,
                color: "#00C48C",
                cursor: "pointer",
                padding: "8px 0",
                listStyle: "none",
              }}
            >
              + Conditions (optional)
            </summary>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              <div>
                <FieldLabel filled={!!amountMin}>MIN AMOUNT (KWD)</FieldLabel>
                <input
                  value={amountMin}
                  onChange={(e) => setAmountMin(e.target.value)}
                  placeholder="0"
                  style={inputStyle}
                />
              </div>
              <div>
                <FieldLabel filled={!!amountMax}>MAX AMOUNT (KWD)</FieldLabel>
                <input
                  value={amountMax}
                  onChange={(e) => setAmountMax(e.target.value)}
                  placeholder="∞"
                  style={inputStyle}
                />
              </div>
            </div>
          </details>

          <div style={{ marginBottom: 14 }}>
            <FieldLabel filled={!!approvalThreshold}>APPROVAL THRESHOLD (OPTIONAL)</FieldLabel>
            <input
              value={approvalThreshold}
              onChange={(e) => setApprovalThreshold(e.target.value)}
              placeholder="Route to CFO for approval if amount exceeds..."
              style={inputStyle}
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
            onClick={handleCreate}
            disabled={!canCreate || sending}
            style={{
              background: canCreate ? "#00C48C" : "rgba(0,196,140,0.25)",
              color: "#fff",
              border: "none",
              padding: "9px 18px",
              borderRadius: 6,
              cursor: canCreate ? "pointer" : "not-allowed",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
            }}
          >
            {sending ? "Saving..." : editingRule ? "Save Changes" : "Create Rule"}
          </button>
        </div>
      </div>
    </>
  );
}
