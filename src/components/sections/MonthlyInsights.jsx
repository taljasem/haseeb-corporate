import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import SectionCard from "./SectionCard";
import { getMonthlyInsights } from "../../engine/mockEngine";

function renderHighlighted(text) {
  const parts = text.split(/(\[[^\]]+\])/g);
  return parts.map((part, i) => {
    if (part.startsWith("[") && part.endsWith("]")) {
      const inner = part.slice(1, -1);
      const isPos = /^\+/.test(inner) && !/over/i.test(inner);
      const isNeg = /over|overdue/i.test(inner) || (/^\+/.test(inner) && /over/i.test(inner));
      const color = isPos ? "#00C48C" : isNeg ? "#FF5A5F" : "#E6EDF3";
      return (
        <span key={i} style={{ color, fontWeight: 500 }}>
          {inner}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function MonthlyInsights() {
  const { t } = useTranslation("owner-overview");
  const [data, setData] = useState(null);
  useEffect(() => {
    getMonthlyInsights().then(setData);
  }, []);
  return (
    <SectionCard label={t("sections.monthly_insights")} delay={0.2}>
      <div style={{ fontSize: 13, color: "#8B98A5", lineHeight: 1.7 }}>
        {data ? renderHighlighted(data.text) : "—"}
      </div>
    </SectionCard>
  );
}
