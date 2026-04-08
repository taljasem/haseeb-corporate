import { useState } from "react";
import { useTranslation } from "react-i18next";
import BankStatementRow from "./BankStatementRow";

export default function BankStatementTable({ txs, currency = "KWD" }) {
  const { t } = useTranslation("bank-accounts");
  const [expandedId, setExpandedId] = useState(null);

  if (!txs) {
    return <div style={{ padding: 24, color: "#5B6570", fontSize: 12 }}>{t("table.loading")}</div>;
  }
  if (txs.length === 0) {
    return (
      <div
        style={{
          padding: "60px 24px",
          textAlign: "center",
          color: "#5B6570",
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
          background: "rgba(255,255,255,0.02)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: "0.15em",
          color: "#5B6570",
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
