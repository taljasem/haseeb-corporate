import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import EngineConfidencePill from "../cfo/EngineConfidencePill";
import JournalEntryCard from "../cfo/JournalEntryCard";
import { getTransactionJournalEntry } from "../../engine/mockEngine";

function fmtAmount(n, currency) {
  const abs = Math.abs(n);
  const digits = currency === "USD" ? 2 : 3;
  const str = abs.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return n < 0 ? `-${str}` : `+${str}`;
}
function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

// Normalize a bank statement method → EngineConfidencePill key
const METHOD_TO_PILL = {
  RULE: "RULE",
  PATTERN: "PATTERN",
  AI: "AI",
  MANUAL: "MANUAL",
  PENDING: "NONE",
};

function SimplePill({ label, color, bg, border }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.10em",
        color,
        background: bg,
        border: `1px solid ${border}`,
        padding: "3px 8px",
        borderRadius: 3,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

export default function BankStatementRow({ tx, expanded, onToggle, currency = "KWD" }) {
  const [je, setJe] = useState(null);
  useEffect(() => {
    if (expanded && !je) getTransactionJournalEntry(tx.id).then(setJe);
  }, [expanded, je, tx.id]);

  const cat = tx.categorization || {};
  const pillKey = METHOD_TO_PILL[cat.method] || "NONE";

  return (
    <div style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div
        onClick={() => onToggle && onToggle(tx)}
        onMouseEnter={(e) => {
          if (!expanded) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
        }}
        onMouseLeave={(e) => {
          if (!expanded) e.currentTarget.style.background = "transparent";
        }}
        style={{
          display: "grid",
          gridTemplateColumns: "72px 1fr 160px 140px 140px 20px",
          gap: 12,
          alignItems: "center",
          padding: "12px 18px",
          cursor: "pointer",
          transition: "background 0.12s ease",
          background: expanded ? "rgba(255,255,255,0.03)" : "transparent",
        }}
      >
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#5B6570" }}>
          {fmtDate(tx.date)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              color: "#E6EDF3",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {tx.description}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "#5B6570",
              fontFamily: "'DM Mono', monospace",
              marginTop: 2,
            }}
          >
            {tx.reference}
            {tx.counterparty ? ` · ${tx.counterparty}` : ""}
          </div>
        </div>
        <div>
          {cat.method === "MANUAL" ? (
            <SimplePill label="MANUAL" color="#8B98A5" bg="rgba(255,255,255,0.04)" border="rgba(255,255,255,0.15)" />
          ) : cat.method === "PENDING" ? (
            <SimplePill label="PENDING" color="#FF5A5F" bg="rgba(255,90,95,0.08)" border="rgba(255,90,95,0.30)" />
          ) : (
            <EngineConfidencePill confidence={pillKey} />
          )}
          <div style={{ fontSize: 10, color: "#5B6570", marginTop: 4 }}>
            {cat.category || "—"}
          </div>
        </div>
        <div
          style={{
            textAlign: "right",
            fontFamily: "'DM Mono', monospace",
            fontSize: 13,
            fontWeight: 500,
            color: tx.amount < 0 ? "#FF5A5F" : "#00C48C",
            opacity: tx.amount < 0 ? 0.85 : 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {fmtAmount(tx.amount, currency)}
        </div>
        <div
          style={{
            textAlign: "right",
            fontFamily: "'DM Mono', monospace",
            fontSize: 12,
            color: "#8B98A5",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {Number(tx.runningBalance).toLocaleString("en-US", {
            minimumFractionDigits: currency === "USD" ? 2 : 3,
            maximumFractionDigits: currency === "USD" ? 2 : 3,
          })}
        </div>
        <div style={{ color: "#5B6570" }}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {expanded && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 18,
            padding: "14px 18px 18px",
            borderTop: "1px solid rgba(255,255,255,0.04)",
            background: "rgba(255,255,255,0.015)",
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.15em",
              color: "#5B6570",
              width: 120,
              flexShrink: 0,
              paddingTop: 16,
            }}
          >
            VIEW JOURNAL ENTRY
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {je ? (
              <>
                <JournalEntryCard entry={je} state="posted" />
                <div style={{ display: "flex", gap: 14, marginTop: 4, fontSize: 11 }}>
                  {cat.ruleId && (
                    <a style={{ color: "#00C48C", cursor: "pointer" }}>
                      View rule ({cat.ruleId}) →
                    </a>
                  )}
                  <a style={{ color: "#00C48C", cursor: "pointer" }}>View in Taskbox →</a>
                </div>
              </>
            ) : (
              <div style={{ color: "#5B6570", fontSize: 12, padding: 12 }}>Loading…</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
