import { useEffect, useState } from "react";
import SectionCard from "./SectionCard";
import { getBudgetSummary } from "../../engine/mockEngine";

const STATUS_COLOR = {
  good: "#00C48C",
  warning: "#D4A84B",
  over: "#FF5A5F",
};

export default function BudgetPerformance() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    getBudgetSummary().then(setRows);
  }, []);

  return (
    <SectionCard label="BUDGET PERFORMANCE" delay={0.45}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {rows
          ? rows.map((r) => {
              const color = STATUS_COLOR[r.status] || "#00C48C";
              return (
                <div key={r.department}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontSize: 13, color: "#E6EDF3" }}>
                      {r.department}
                    </span>
                    <span
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 12,
                        fontWeight: 500,
                        color,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {r.used}% used
                    </span>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: 4,
                      background: "rgba(255,255,255,0.05)",
                      borderRadius: 2,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(r.used, 100)}%`,
                        height: "100%",
                        background: color,
                        transition: "width 0.4s ease",
                      }}
                    />
                  </div>
                </div>
              );
            })
          : null}
      </div>
      <div style={{ marginTop: 14 }}>
        <a
          style={{
            fontSize: 12,
            color: "#00C48C",
            cursor: "pointer",
            letterSpacing: "0.04em",
          }}
        >
          View all departments →
        </a>
      </div>
    </SectionCard>
  );
}
