import { useState } from "react";
import { useTranslation } from "react-i18next";
import BankStatementRow from "./BankStatementRow";

export default function BankStatementTable({ txs, currency = "KWD" }) {
  const { t } = useTranslation("bank-accounts");
  const [expandedId, setExpandedId] = useState(null);

  if (!txs) {
    return <div style={{ padding: 24, color: "var(--text-tertiary)", fontSize: 12 }}>{t("table.loading")}</div>;
  }
  if (txs.length === 0) {
    return (
      <div
        style={{
          padding: "60px 24px",
          textAlign: "center",
          color: "var(--text-tertiary)",
          fontSize: 13,
        }}
      >
        {t("table.empty")}
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "72px 1fr 160px 140px 140px 20px",
          gap: 12,
          padding: "10px 18px",
          background: "var(--bg-surface)",
          borderTop: "1px solid var(--border-subtle)",
          borderBottom: "1px solid var(--border-subtle)",
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: "0.15em",
          color: "var(--text-tertiary)",
        }}
      >
        <div>{t("table.col_date")}</div>
        <div>{t("table.col_description")}</div>
        <div>{t("table.col_categorization")}</div>
        <div style={{ textAlign: "end" }}>{t("table.col_amount")}</div>
        <div style={{ textAlign: "end" }}>{t("table.col_balance")}</div>
        <div />
      </div>
      {txs.map((t) => (
        <BankStatementRow
          key={t.id}
          tx={t}
          currency={currency}
          expanded={expandedId === t.id}
          onToggle={(x) => setExpandedId(expandedId === x.id ? null : x.id)}
        />
      ))}
    </div>
  );
}
