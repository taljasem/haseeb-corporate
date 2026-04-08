import { useTranslation } from "react-i18next";
import SectionCard from "./SectionCard";
import LtrText from "../shared/LtrText";

export default function AIInsights() {
  const { t } = useTranslation("owner-overview");
  return (
    <SectionCard label={t("sections.ai_insights")} delay={0.35}>
      <div style={{ fontSize: 13, color: "#8B98A5", lineHeight: 1.7, marginBottom: 10 }}>
        {t("ai_insights.balance_up")}{" "}
        <span style={{ color: "#00C48C", fontWeight: 500 }}>
          <LtrText>+12%</LtrText>
        </span>{" "}
        {t("ai_insights.vs_avg")}
      </div>
      <div style={{ fontSize: 13, color: "#8B98A5", lineHeight: 1.7 }}>
        {t("ai_insights.pifss_due")}{" "}
        <span
          style={{
            fontFamily: "'DM Mono', monospace",
            color: "#E6EDF3",
            fontWeight: 500,
          }}
        >
          <LtrText>4,862.500 KWD</LtrText>
        </span>
      </div>
    </SectionCard>
  );
}
