import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp } from "lucide-react";
import LtrText from "../shared/LtrText";
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
  const { t } = useTranslation("bank-accounts");
  const { t: tTx } = useTranslation("bank-transactions");
  const [je, setJe] = useState(null);
  useEffect(() => {
    if (expanded && !je) getTransactionJournalEntry(tx.id).then(setJe);
  }, [expanded, je, tx.id]);

  const cat = tx.categorization || {};
  const pillKey = METHOD_TO_PILL[cat.method] || "NONE";

  return (
    <div style={{ borderBottom: "1px solid var(--border-subtle)" }}>
      <div
        onClick={() => onToggle && onToggle(tx)}
        onMouseEnter={(e) => {
          if (!expanded) e.currentTarget.style.background = "var(--bg-surface-sunken)";
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
          background: expanded ? "var(--bg-surface-sunken)" : "transparent",
        }}
      >
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--text-tertiary)" }}>
          {fmtDate(tx.date)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-primary)",
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
              color: "var(--text-tertiary)",
              fontFamily: "'DM Mono', monospace",
              marginTop: 2,
            }}
          >
            <LtrText>{tx.reference}{tx.counterparty ? ` · ${tx.counterparty}` : ""}</LtrText>
          </div>
        </div>
        <div>
          {cat.method === "MANUAL" ? (
            <SimplePill label={tTx("confidence.manual")} color="var(--text-secondary)" bg="var(--bg-surface-sunken)" border="var(--border-strong)" />
          ) : cat.method === "PENDING" ? (
            <SimplePill label={tTx("confidence.pending")} color="var(--semantic-danger)" bg="var(--semantic-danger-subtle)" border="var(--semantic-danger-subtle)" />
          ) : (
            <EngineConfidencePill confidence={pillKey} />
          )}
          <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 4 }}>
            {cat.category || "—"}
          </div>
        </div>
        <div
          style={{
            textAlign: "end",
            fontFamily: "'DM Mono', monospace",
            fontSize: 13,
            fontWeight: 500,
            color: tx.amount < 0 ? "var(--semantic-danger)" : "var(--accent-primary)",
            opacity: tx.amount < 0 ? 0.85 : 1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {fmtAmount(tx.amount, currency)}
        </div>
        <div
          style={{
            textAlign: "end",
            fontFamily: "'DM Mono', monospace",
            fontSize: 12,
            color: "var(--text-secondary)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {Number(tx.runningBalance).toLocaleString("en-US", {
            minimumFractionDigits: currency === "USD" ? 2 : 3,
            maximumFractionDigits: currency === "USD" ? 2 : 3,
          })}
        </div>
        <div style={{ color: "var(--text-tertiary)" }}>
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
            borderTop: "1px solid var(--border-subtle)",
            background: "rgba(255,255,255,0.015)",
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.15em",
              color: "var(--text-tertiary)",
              width: 120,
              flexShrink: 0,
              paddingTop: 16,
            }}
          >
            {t("row.view_journal_entry")}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {je ? (
              <>
                <JournalEntryCard entry={je} state="posted" />
                <div style={{ display: "flex", gap: 14, marginTop: 4, fontSize: 11 }}>
                  {cat.ruleId && (
                    <a style={{ color: "var(--accent-primary)", cursor: "pointer" }}>
                      {t("row.view_rule", { id: cat.ruleId })}
                    </a>
                  )}
                  <a style={{ color: "var(--accent-primary)", cursor: "pointer" }}>{t("row.view_in_taskbox")}</a>
                </div>
              </>
            ) : (
              <div style={{ color: "var(--text-tertiary)", fontSize: 12, padding: 12 }}>{t("row.loading_je")}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
