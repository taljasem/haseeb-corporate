import SectionCard from "./SectionCard";

export default function AIInsights() {
  return (
    <SectionCard label="AI INSIGHTS" delay={0.35}>
      <div style={{ fontSize: 13, color: "#8B98A5", lineHeight: 1.7, marginBottom: 10 }}>
        KIB Operating balance up{" "}
        <span style={{ color: "#00C48C", fontWeight: 500 }}>+12%</span> vs.
        trailing 30-day average. Liquidity posture strong.
      </div>
      <div style={{ fontSize: 13, color: "#8B98A5", lineHeight: 1.7 }}>
        PIFSS contribution due end of month. Estimated:{" "}
        <span
          style={{
            fontFamily: "'DM Mono', monospace",
            color: "#E6EDF3",
            fontWeight: 500,
          }}
        >
          4,862.500 KWD
        </span>
      </div>
    </SectionCard>
  );
}
