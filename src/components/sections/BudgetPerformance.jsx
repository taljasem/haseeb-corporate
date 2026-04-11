import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import SectionCard from "./SectionCard";
import { getBudgetVarianceByDepartment } from "../../engine/mockEngine";

const STATUS_COLOR = {
  under:      "var(--accent-primary)",
  "on-track": "var(--accent-primary)",
  over:       "var(--semantic-warning)",
  critical:   "var(--semantic-danger)",
};

export default function BudgetPerformance({ onViewAll }) {
  const { t } = useTranslation("owner-overview");
  const [rows, setRows] = useState(null);
  useEffect(() => {
    getBudgetVarianceByDepartment().then((all) => {
      // Owner intelligence card focuses on expense departments only
      setRows(all.filter((d) => d.category === "expense"));
    });
  }, []);

  return (
    <SectionCard label={t("sections.budget_performance")} delay={0.45}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {rows
          ? rows.map((r) => {
              const color = STATUS_COLOR[r.status] || "var(--accent-primary)";
              const used = r.variancePercent;
              return (
                <div key={r.id}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 6,
                    }}
                  >
                    <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{r.name}</span>
                    <span
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 12,
                        fontWeight: 500,
                        color,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {t("budget_performance.used_pct", { pct: used.toFixed(0) })}
                    </span>
                  </div>
                  <div
                    style={{
                      width: "100%",
                      height: 4,
                      background: "var(--border-subtle)",
                      borderRadius: 2,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(used, 100)}%`,
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
          onClick={onViewAll}
          style={{
            fontSize: 12,
            color: "var(--accent-primary)",
            cursor: "pointer",
            letterSpacing: "0.04em",
          }}
        >
          {t("budget_performance.view_all")}
        </a>
      </div>
    </SectionCard>
  );
}
