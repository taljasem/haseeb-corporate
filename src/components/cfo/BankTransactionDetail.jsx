import { useState, useEffect } from "react";
import { formatKWD } from "../../utils/format";
import EngineConfidencePill from "./EngineConfidencePill";
import JournalEntryCard from "./JournalEntryCard";
import AminahTag from "../AminahTag";
import { suggestJournalEntryFromBankTransaction } from "../../engine/mockEngine";

function Field({ label, value }) {
  return (
    <div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: "0.15em",
          color: "#5B6570",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          color: "#E6EDF3",
          fontFamily: label === "AMOUNT" ? "'DM Mono', monospace" : "inherit",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function BankTransactionDetail({ tx, onOpenAminah, onConfirmed }) {
  const [suggestion, setSuggestion] = useState(null);
  const [posted, setPosted] = useState(false);

  useEffect(() => {
    setSuggestion(null);
    setPosted(false);
    if (tx) {
      suggestJournalEntryFromBankTransaction(tx).then(setSuggestion);
    }
  }, [tx]);

  if (!tx) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#5B6570",
          fontSize: 13,
        }}
      >
        Select a transaction to review.
      </div>
    );
  }

  const sug = tx.engineSuggestion || {};

  return (
    <div style={{ padding: "20px 22px", overflowY: "auto" }}>
      {/* Bank facts */}
      <div
        style={{
          background: "rgba(255,255,255,0.025)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 8,
          padding: "14px 16px",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.15em",
            color: "#5B6570",
            marginBottom: 12,
          }}
        >
          BANK FACTS · IMMUTABLE
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          <Field label="DATE" value={tx.date} />
          <Field label="SOURCE" value={tx.source} />
          <Field label="MERCHANT" value={tx.merchant} />
          <Field label="TERMINAL" value={tx.terminal || "—"} />
          <Field
            label="AMOUNT"
            value={
              <span style={{ color: tx.amount < 0 ? "#FF5A5F" : "#00C48C" }}>
                {formatKWD(Math.abs(tx.amount))}
              </span>
            }
          />
          <Field label="DIRECTION" value={tx.amount < 0 ? "Outflow" : "Inflow"} />
        </div>
      </div>

      {/* Engine suggests header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.15em",
            color: "#5B6570",
          }}
        >
          ENGINE SUGGESTS
        </div>
        <AminahTag />
      </div>
      <div style={{ marginBottom: 8 }}>
        <EngineConfidencePill confidence={sug.confidence || "NONE"} />
      </div>
      {sug.reasoning && (
        <div
          style={{
            fontSize: 12,
            fontStyle: "italic",
            color: "#8B98A5",
            lineHeight: 1.55,
            marginBottom: 8,
          }}
        >
          {sug.reasoning}
        </div>
      )}

      {/* Real JournalEntryCard in suggested (or posted) state */}
      {suggestion && (
        <JournalEntryCard
          entry={suggestion}
          state={posted ? "posted" : "suggested"}
          onConfirm={() => {
            setPosted(true);
            // Auto-advance after a brief moment
            setTimeout(() => {
              onConfirmed && onConfirmed(tx.id);
            }, 1100);
          }}
          onAskAminah={() =>
            onOpenAminah && onOpenAminah(`Bank tx ${tx.id} — ${tx.merchant}`)
          }
          showAssign
          assignItemType="bank-transaction"
        />
      )}
    </div>
  );
}
