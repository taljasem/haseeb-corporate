import { useEffect, useState } from "react";
import {
  getRevenueSummary,
  getExpenseSummary,
  getProfitability,
  getCashPosition,
} from "../engine/mockEngine";

function fmtCompact(n) {
  return Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function Kpi({ value, label, accent = false }) {
  return (
    <div style={{ padding: "0 24px", textAlign: "right" }}>
      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: accent ? 22 : 20,
          fontWeight: 500,
          color: accent ? "#00C48C" : "#8B98A5",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.12em",
          color: accent ? "rgba(0,196,140,0.4)" : "#5B6570",
          marginTop: 3,
        }}
      >
        {label}
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        width: 1,
        height: 20,
        background: "rgba(255,255,255,0.10)",
        alignSelf: "center",
      }}
    />
  );
}

export default function HeroBand() {
  const [data, setData] = useState(null);

  useEffect(() => {
    Promise.all([
      getRevenueSummary(),
      getExpenseSummary(),
      getProfitability(),
      getCashPosition(),
    ]).then(([rev, exp, prof, cash]) => {
      setData({ rev, exp, prof, cash });
    });
  }, []);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        padding: "20px 24px 18px",
        borderBottom: "1px solid rgba(255,255,255,0.10)",
        flexShrink: 0,
        gap: 24,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-end", gap: 18 }}>
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 6,
            }}
          >
            <span className="aminah-dot" />
            <span className="aminah-label">AMINAH ONLINE</span>
          </div>
          <h1
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 48,
              color: "#E6EDF3",
              lineHeight: 0.9,
              letterSpacing: "-1px",
              fontWeight: 700,
              margin: 0,
            }}
          >
            AL MANARA TRADING.
          </h1>
        </div>
        <div
          style={{
            width: 120,
            height: 2,
            background: "linear-gradient(90deg, #00C48C, transparent)",
            marginBottom: 8,
            boxShadow: "0 0 12px rgba(0,196,140,0.35)",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 0,
          paddingBottom: 4,
        }}
      >
        <Kpi
          value={data ? fmtCompact(data.rev.thisMonth) : "—"}
          label="REVENUE"
        />
        <Divider />
        <Kpi
          value={data ? fmtCompact(data.exp.thisMonth) : "—"}
          label="EXPENSES"
        />
        <Divider />
        <Kpi
          value={data ? fmtCompact(data.prof.netIncome) : "—"}
          label="NET INCOME"
          accent
        />
        <Divider />
        <Kpi
          value={data ? fmtCompact(data.cash.total) : "—"}
          label="CASH"
          accent
        />
      </div>
    </div>
  );
}
