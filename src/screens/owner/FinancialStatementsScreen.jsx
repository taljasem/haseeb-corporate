import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import AminahNarrationCard from "../../components/financial/AminahNarrationCard";
import StatementTable from "../../components/financial/StatementTable";
import {
  getIncomeStatement,
  getBalanceSheet,
  getCashFlowStatement,
} from "../../engine/mockEngine";

const TAB_IDS = ["income", "balance", "cash-flow"];
const PERIOD_IDS = ["month", "quarter", "ytd", "custom"];

export default function FinancialStatementsScreen({ onOpenAminah }) {
  const { t } = useTranslation("financial");
  const [tab, setTab] = useState("income");
  const [period, setPeriod] = useState("month");
  const [income, setIncome] = useState(null);
  const [balance, setBalance] = useState(null);
  const [cashFlow, setCashFlow] = useState(null);

  useEffect(() => {
    getIncomeStatement(period).then(setIncome);
    getBalanceSheet(period).then(setBalance);
    getCashFlowStatement(period).then(setCashFlow);
  }, [period]);

  const current = tab === "income" ? income : tab === "balance" ? balance : cashFlow;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px 32px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 18,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 28,
                color: "var(--text-primary)",
                letterSpacing: "-0.3px",
                lineHeight: 1,
              }}
            >
              {t("title")}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.15em",
                color: "var(--text-tertiary)",
                marginTop: 6,
              }}
            >
              {current?.period || t("period_default")}
            </div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {PERIOD_IDS.map((pid) => {
              const on = period === pid;
              return (
                <button
                  key={pid}
                  onClick={() => setPeriod(pid)}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "6px 12px",
                    borderRadius: 14,
                    background: on ? "var(--accent-primary-subtle)" : "var(--bg-surface)",
                    border: on ? "1px solid rgba(0,196,140,0.30)" : "1px solid rgba(255,255,255,0.10)",
                    color: on ? "var(--accent-primary)" : "var(--text-tertiary)",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {t(`periods.${pid}`)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab bar */}
        <div
          style={{
            display: "flex",
            gap: 4,
            marginBottom: 20,
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {TAB_IDS.map((tid) => {
            const on = tab === tid;
            return (
              <button
                key={tid}
                onClick={() => setTab(tid)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: on ? "var(--accent-primary)" : "var(--text-tertiary)",
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  padding: "12px 16px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  boxShadow: on ? "inset 0 -2px 0 #00C48C" : "none",
                }}
              >
                {t(`tabs.${tid}`)}
              </button>
            );
          })}
        </div>

        {current && (
          <>
            <AminahNarrationCard
              text={current.aminahNarration}
              onAsk={() =>
                onOpenAminah && onOpenAminah(`${t(`tabs.${tab}`)} — ${current.period}`)
              }
            />
            <StatementTable sections={current.sections} />
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              {["PDF", "Excel"].map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => {}}
                  style={{
                    background: "transparent",
                    color: "var(--text-secondary)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    padding: "7px 14px",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    fontFamily: "inherit",
                  }}
                >
                  {t("export", { format: fmt })}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
