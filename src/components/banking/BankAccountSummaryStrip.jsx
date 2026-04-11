import { useTranslation } from "react-i18next";
import { formatMoney } from "../../utils/formatCurrency";

function Stat({ label, value, color = "var(--text-primary)" }) {
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
          fontFamily: "'DM Mono', monospace",
          fontSize: 16,
          fontWeight: 500,
          color,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function BankAccountSummaryStrip({ summary, currency = "KWD" }) {
  const { t } = useTranslation("bank-accounts");
  if (!summary) return null;
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 32,
        padding: "14px 18px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 8,
      }}
    >
      <Stat label={t("summary.opening_balance")} value={formatMoney(summary.openingBalance, currency)} />
      <Stat label={t("summary.closing_balance")} value={formatMoney(summary.closingBalance, currency)} />
      <Stat label={t("summary.total_inflow")}    value={`+${formatMoney(summary.totalInflow,  currency).replace(/^(KWD|USD) /, "")}`} color="var(--accent-primary)" />
      <Stat label={t("summary.total_outflow")}   value={`-${formatMoney(summary.totalOutflow, currency).replace(/^(KWD|USD) /, "")}`} color="var(--semantic-danger)" />
      <Stat label={t("summary.transactions")}    value={String(summary.transactionCount)} />
    </div>
  );
}
