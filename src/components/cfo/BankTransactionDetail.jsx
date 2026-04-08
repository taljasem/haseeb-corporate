import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { formatKWD } from "../../utils/format";
import EngineConfidencePill from "./EngineConfidencePill";
import JournalEntryCard from "./JournalEntryCard";
import AminahTag from "../AminahTag";
import { suggestJournalEntryFromBankTransaction } from "../../engine/mockEngine";

function Field({ label, value, mono = false }) {
  return (
    <div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: "0.15em",
          color: "var(--text-tertiary)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          color: "var(--text-primary)",
          fontFamily: mono ? "'DM Mono', monospace" : "inherit",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function BankTransactionDetail({ tx, onOpenAminah, onConfirmed }) {
  const { t } = useTranslation("bank-transactions");
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
          color: "var(--text-tertiary)",
          fontSize: 13,
        }}
      >
        {t("detail.select_to_review")}
      </div>
    );
  }

  const sug = tx.engineSuggestion || {};

  return (
    <div style={{ padding: "20px 22px", overflowY: "auto" }}>
      {/* Bank facts */}
      <div
        style={{
          background: "var(--bg-surface)",
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
            color: "var(--text-tertiary)",
            marginBottom: 12,
          }}
        >
          {t("detail.bank_facts")}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          <Field label={t("detail.field_date")} value={tx.date} />
          <Field label={t("detail.field_source")} value={tx.source} />
          <Field label={t("detail.field_merchant")} value={tx.merchant} />
          <Field label={t("detail.field_terminal")} value={tx.terminal || t("detail.none")} />
          <Field
            label={t("detail.field_amount")}
            mono
            value={
              <span style={{ color: tx.amount < 0 ? "var(--semantic-danger)" : "var(--accent-primary)" }}>
                {formatKWD(Math.abs(tx.amount))}
              </span>
            }
          />
          <Field label={t("detail.field_direction")} value={tx.amount < 0 ? t("detail.direction_outflow") : t("detail.direction_inflow")} />
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
            color: "var(--text-tertiary)",
          }}
        >
          {t("detail.engine_suggests")}
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
            color: "var(--text-secondary)",
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
