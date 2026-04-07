import { useEffect, useState } from "react";
import AminahNarrationCard from "../../components/financial/AminahNarrationCard";
import StatementTable from "../../components/financial/StatementTable";
import {
  getIncomeStatement,
  getBalanceSheet,
  getCashFlowStatement,
} from "../../engine/mockEngine";

const TABS = [
  { id: "income",       label: "INCOME STATEMENT" },
  { id: "balance",      label: "BALANCE SHEET" },
  { id: "cash-flow",    label: "CASH FLOW STATEMENT" },
];
const PERIODS = [
  { id: "month",   label: "This Month" },
  { id: "quarter", label: "This Quarter" },
  { id: "ytd",     label: "YTD" },
  { id: "custom",  label: "Custom" },
];

export default function FinancialStatementsScreen({ onOpenAminah }) {
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
                color: "#E6EDF3",
                letterSpacing: "-0.3px",
                lineHeight: 1,
              }}
            >
              FINANCIAL STATEMENTS
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.15em",
                color: "#5B6570",
                marginTop: 6,
              }}
            >
              {current?.period || "MARCH 2026"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {PERIODS.map((p) => {
              const on = period === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "6px 12px",
                    borderRadius: 14,
                    background: on ? "rgba(0,196,140,0.10)" : "rgba(255,255,255,0.02)",
                    border: on ? "1px solid rgba(0,196,140,0.30)" : "1px solid rgba(255,255,255,0.10)",
                    color: on ? "#00C48C" : "#5B6570",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {p.label}
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
          {TABS.map((t) => {
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: on ? "#00C48C" : "#5B6570",
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  padding: "12px 16px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  boxShadow: on ? "inset 0 -2px 0 #00C48C" : "none",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {current && (
          <>
            <AminahNarrationCard
              text={current.aminahNarration}
              onAsk={() =>
                onOpenAminah && onOpenAminah(`${TABS.find((t) => t.id === tab).label} — ${current.period}`)
              }
            />
            <StatementTable sections={current.sections} />
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              {["PDF", "Excel"].map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => console.log(`[export] ${fmt} ${tab} ${period}`)}
                  style={{
                    background: "transparent",
                    color: "#8B98A5",
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
                  Export {fmt}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
