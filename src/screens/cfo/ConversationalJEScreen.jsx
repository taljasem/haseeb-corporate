import { useState } from "react";
import AccountPicker from "../../components/cfo/AccountPicker";
import JournalEntryCard from "../../components/cfo/JournalEntryCard";

/**
 * Mocked conversational JE flow.
 * Three exchanges, scripted to demonstrate:
 *   1. Clarifying conversation with inline AccountPicker (twice) → draft JE
 *   2. Refusal — bank transaction
 *   3. Refusal — too vague
 */

function renderBold(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      const inner = p.slice(2, -2);
      const isNum = /\d/.test(inner);
      return (
        <span
          key={i}
          style={{
            color: "#E6EDF3",
            fontWeight: 500,
            fontFamily: isNum ? "'DM Mono', monospace" : "inherit",
          }}
        >
          {inner}
        </span>
      );
    }
    return <span key={i}>{p}</span>;
  });
}

function UserBubble({ children }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
      <div
        style={{
          maxWidth: "78%",
          background: "rgba(0,196,140,0.12)",
          border: "1px solid rgba(0,196,140,0.20)",
          borderRadius: 12,
          borderBottomRightRadius: 4,
          padding: "10px 14px",
          fontSize: 13,
          lineHeight: 1.55,
          color: "#E6EDF3",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function AminahBubble({ children, wide = false }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 10 }}>
      <div
        style={{
          maxWidth: wide ? "100%" : "88%",
          width: wide ? "100%" : "auto",
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 12,
          borderBottomLeftRadius: 4,
          padding: "12px 14px",
          fontSize: 13,
          lineHeight: 1.6,
          color: "#8B98A5",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ExchangeOne() {
  const [step, setStep] = useState(0);
  const [debit, setDebit] = useState(null);
  const [credit, setCredit] = useState(null);
  const [posted, setPosted] = useState(false);

  // Hard-coded amount/description for the demo
  const amount = 30.0;
  const draft = debit && credit && {
    id: "JE-0421",
    description: "Cash payment for cleaning",
    status: "Draft - Validated",
    lines: [
      { account: debit.name, code: debit.code, debit: amount, credit: null },
      { account: credit.name, code: credit.code, debit: null, credit: amount },
    ],
    totalDebit: amount,
    totalCredit: amount,
    balanced: true,
    mappingVersion: "v1.0",
    createdAt: new Date().toISOString(),
    hashChainStatus: "ready",
  };

  return (
    <div>
      <UserBubble>I paid the cleaning lady 30 KWD cash today</UserBubble>

      <AminahBubble>
        Got it — cash payment for cleaning. I need a couple of details before drafting the entry.
        Which expense account should I post this to?
      </AminahBubble>

      {step >= 0 && !debit && (
        <AminahBubble wide>
          <div style={{ marginBottom: 8, fontSize: 11, color: "#5B6570", letterSpacing: "0.10em", fontWeight: 600 }}>
            EXPENSE ACCOUNT
          </div>
          <AccountPicker
            filterCategories={["Operating Expenses"]}
            onSelect={(a) => {
              setDebit(a);
              setStep(1);
            }}
          />
        </AminahBubble>
      )}

      {debit && (
        <AminahBubble>
          Got it — <span style={{ color: "#E6EDF3", fontWeight: 500 }}>{debit.name}</span>. And which
          cash account did this come from?
        </AminahBubble>
      )}

      {debit && !credit && (
        <AminahBubble wide>
          <div style={{ marginBottom: 8, fontSize: 11, color: "#5B6570", letterSpacing: "0.10em", fontWeight: 600 }}>
            CASH ACCOUNT
          </div>
          <AccountPicker
            filterCategories={["Assets"]}
            onSelect={(a) => {
              setCredit(a);
              setStep(2);
            }}
          />
        </AminahBubble>
      )}

      {draft && (
        <>
          <AminahBubble>Drafting now…</AminahBubble>
          <div style={{ maxWidth: "100%" }}>
            <JournalEntryCard
              entry={draft}
              state={posted ? "posted" : "draft-validated"}
              onConfirm={() => setPosted(true)}
              onEdit={() => {}}
              onDiscard={() => {
                setDebit(null);
                setCredit(null);
                setPosted(false);
              }}
              showAssign
              assignItemType="journal-entry"
            />
          </div>
          {!posted && (
            <AminahBubble>Here's the draft. Review and confirm to post.</AminahBubble>
          )}
          {posted && (
            <AminahBubble>
              Posted. Hash chain extended. Entry visible in your ledger and audit trail.
            </AminahBubble>
          )}
        </>
      )}
    </div>
  );
}

function ExchangeTwo() {
  return (
    <div>
      <UserBubble>Record the Zain payment that came in today</UserBubble>
      <AminahBubble>
        That looks like a bank transaction — it came from your KIB feed. I can't create entries for
        bank-originated items via conversation. Please review it in Bank Transactions instead.{" "}
        <a
          style={{
            color: "#00C48C",
            fontWeight: 500,
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          Open Bank Transactions →
        </a>
      </AminahBubble>
    </div>
  );
}

function ExchangeThree() {
  return (
    <div>
      <UserBubble>Add the thing from yesterday</UserBubble>
      <AminahBubble>
        I can't draft this without more detail. Which transaction are you referring to? What was the
        amount and category?
      </AminahBubble>
    </div>
  );
}

export default function ConversationalJEScreen() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div
        style={{
          padding: "20px 28px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.10)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.15em",
            color: "#5B6570",
            marginBottom: 4,
          }}
        >
          CONVERSATIONAL JOURNAL ENTRY
        </div>
        <div style={{ fontSize: 12, color: "#8B98A5", fontStyle: "italic" }}>
          For non-bank transactions only. Bank transactions go through Bank Review.
        </div>
      </div>

      {/* Scrollable chat area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 0" }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 28px" }}>
          <ExchangeOne />
          <div style={{ height: 28 }} />
          <ExchangeTwo />
          <div style={{ height: 28 }} />
          <ExchangeThree />
        </div>
      </div>

      {/* Input bar */}
      <div
        style={{
          padding: "14px 28px 18px",
          borderTop: "1px solid rgba(255,255,255,0.10)",
          flexShrink: 0,
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto", position: "relative" }}>
          <input
            className="chat-input"
            placeholder="Describe a non-bank transaction…"
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.10)",
              borderRadius: 10,
              padding: "14px 50px 14px 16px",
              color: "#E6EDF3",
              fontSize: 13,
              fontFamily: "inherit",
              outline: "none",
            }}
          />
          <button
            className="send-btn"
            style={{
              position: "absolute",
              right: 7,
              top: "50%",
              transform: "translateY(-50%)",
              width: 34,
              height: 34,
              background: "#00C48C",
              border: "none",
              borderRadius: 8,
              color: "#fff",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
