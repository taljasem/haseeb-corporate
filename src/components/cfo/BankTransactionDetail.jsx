import { useState, useEffect } from "react";
import { formatKWD } from "../../utils/format";
import EngineConfidencePill from "./EngineConfidencePill";
import AccountPicker from "./AccountPicker";
import AminahTag from "../AminahTag";

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
      <div style={{ fontSize: 13, color: "#E6EDF3", fontFamily: label === "AMOUNT" ? "'DM Mono', monospace" : "inherit" }}>
        {value}
      </div>
    </div>
  );
}

export default function BankTransactionDetail({ tx, onOpenAminah }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [pickedAccount, setPickedAccount] = useState(null);

  // Reset state when selection changes
  useEffect(() => {
    setPickerOpen(false);
    setConfirmed(false);
    setPickedAccount(null);
  }, [tx?.id]);

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

  const sug = tx.engineSuggestion;

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

      {/* Engine suggestion */}
      {!pickerOpen && (
        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.10)",
            borderLeft: "2px solid #00C48C",
            borderRadius: 8,
            padding: "14px 16px",
            marginBottom: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
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

          {sug.account ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                <div style={{ fontSize: 18, color: "#E6EDF3", fontWeight: 500 }}>
                  {sug.account}
                </div>
                <EngineConfidencePill confidence={sug.confidence} />
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "#5B6570",
                  fontFamily: "'DM Mono', monospace",
                  marginBottom: 10,
                }}
              >
                ({sug.accountCode})
              </div>
            </>
          ) : (
            <div style={{ marginBottom: 10 }}>
              <EngineConfidencePill confidence="NONE" />
            </div>
          )}

          {sug.reasoning && (
            <div
              style={{
                fontSize: 12,
                fontStyle: "italic",
                color: "#8B98A5",
                lineHeight: 1.55,
                marginBottom: 14,
              }}
            >
              {sug.reasoning}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            {sug.account && (
              <button
                onClick={() => {
                  setConfirmed(true);
                  setPickedAccount({ name: sug.account, code: sug.accountCode });
                }}
                style={{
                  background: "#00C48C",
                  color: "#fff",
                  border: "none",
                  padding: "9px 16px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: "inherit",
                }}
              >
                Confirm
              </button>
            )}
            <button
              onClick={() => setPickerOpen(true)}
              style={{
                background: "transparent",
                color: "#8B98A5",
                border: "1px solid rgba(255,255,255,0.15)",
                padding: "9px 14px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "inherit",
              }}
            >
              Choose different account
            </button>
          </div>
        </div>
      )}

      {/* Account picker */}
      {pickerOpen && (
        <div style={{ marginBottom: 14 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.15em",
              color: "#5B6570",
              marginBottom: 8,
            }}
          >
            CHOOSE ACCOUNT
          </div>
          <AccountPicker
            onSelect={(a) => {
              setPickedAccount(a);
              setPickerOpen(false);
              setConfirmed(true);
            }}
          />
          <div style={{ marginTop: 8 }}>
            <a
              onClick={() => setPickerOpen(false)}
              style={{ fontSize: 11, color: "#5B6570", cursor: "pointer" }}
            >
              ← Back to suggestion
            </a>
          </div>
        </div>
      )}

      {confirmed && pickedAccount && (
        <div
          style={{
            background: "rgba(0,196,140,0.06)",
            border: "1px solid rgba(0,196,140,0.25)",
            borderRadius: 8,
            padding: "12px 14px",
            marginBottom: 14,
            fontSize: 12,
            color: "#8B98A5",
          }}
        >
          ✓ Posted to{" "}
          <span style={{ color: "#E6EDF3", fontWeight: 500 }}>{pickedAccount.name}</span>{" "}
          <span style={{ fontFamily: "'DM Mono', monospace", color: "#5B6570" }}>
            ({pickedAccount.code})
          </span>
        </div>
      )}

      <button
        onClick={() => onOpenAminah && onOpenAminah(tx)}
        style={{
          width: "100%",
          background: "rgba(139,92,246,0.08)",
          color: "#8B5CF6",
          border: "1px solid rgba(139,92,246,0.30)",
          padding: "11px 14px",
          borderRadius: 8,
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.05em",
          fontFamily: "inherit",
        }}
      >
        Ask Aminah about this transaction
      </button>
    </div>
  );
}
