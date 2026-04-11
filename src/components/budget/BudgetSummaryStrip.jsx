import { useTranslation } from "react-i18next";
import { formatKWD } from "../../utils/format";

function Stat({ label, value, sub, accent = false, varianceColor = null }) {
  return (
    <div
      style={{
        flex: "1 1 240px",
        minWidth: 240,
        padding: "16px 18px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
        borderRadius: 10,
      }}
    >
      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 22,
          fontWeight: 500,
          color: varianceColor || (accent ? "var(--accent-primary)" : "var(--text-primary)"),
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.12em",
          color: "var(--text-tertiary)",
          marginTop: 6,
        }}
      >
        {label}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export default function BudgetSummaryStrip({ summary, expenseVarianceTotal = null }) {
  const { t } = useTranslation("budget");
  if (!summary) return null;

  let varianceColor = null;
  let varianceValue = "—";
  let varianceSub = "";
  if (expenseVarianceTotal != null) {
    const abs = Math.abs(expenseVarianceTotal);
    const fmt = formatKWD(abs).replace("KWD ", "");
    if (Math.abs(expenseVarianceTotal) < 1) {
      varianceColor = "var(--text-secondary)";
      varianceValue = `KWD 0.000`;
      varianceSub = t("summary.tracking_exact");
    } else if (expenseVarianceTotal < 0) {
      varianceColor = "var(--accent-primary)";
      varianceValue = `−KWD ${fmt}`;
      varianceSub = t("summary.ahead_of_plan", { amount: fmt });
    } else {
      varianceColor = "var(--semantic-danger)";
      varianceValue = `+KWD ${fmt}`;
      varianceSub = t("summary.over_plan", { amount: fmt });
    }
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
      <Stat label={t("summary.total_revenue_budget")} value={formatKWD(summary.totalRevenue)} sub={summary.label} />
      <Stat
        label={t("summary.total_expense_budget")}
        value={formatKWD(summary.totalExpenses)}
        sub={t("summary.across_n_depts", { count: summary.expenseDepartmentCount })}
      />
      <Stat
        label={t("summary.projected_net_income")}
        value={formatKWD(summary.netIncome)}
        sub={t("summary.margin_sub", { pct: summary.margin })}
        accent
      />
      <Stat
        label={t("summary.vs_plan_ytd")}
        value={varianceValue}
        sub={varianceSub}
        varianceColor={varianceColor}
      />
    </div>
  );
}
