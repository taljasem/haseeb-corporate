import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import SectionCard from "./SectionCard";
import { getHealthScore } from "../../engine/mockEngine";

function HealthRing({ percent = 75 }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const filled = (percent / 100) * c;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64">
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--bg-surface-sunken)" strokeWidth="4" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke="var(--accent-primary)"
        strokeWidth="4"
        strokeDasharray={`${filled} ${c}`}
        strokeLinecap="round"
        transform="rotate(-90 32 32)"
      />
    </svg>
  );
}

export default function FinancialHealthSection() {
  const { t } = useTranslation("owner-overview");
  const [h, setH] = useState(null);
  useEffect(() => {
    getHealthScore().then(setH);
  }, []);

  return (
    <SectionCard label={t("sections.financial_health")} delay={0.25}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
        <HealthRing percent={h ? h.score : 75} />
        <div>
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 26,
              fontWeight: 500,
              color: "var(--accent-primary)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {h ? `${h.score}%` : "—"}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-tertiary)", letterSpacing: "0.08em", marginTop: 2 }}>
            {t("financial_health.this_month")}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.65 }}>
        {h ? `${h.status}. ${h.message}` : "—"}
      </div>
    </SectionCard>
  );
}
