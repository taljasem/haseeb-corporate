import { useEffect, useState } from "react";
import SectionCard from "./SectionCard";
import { getAuditReadiness } from "../../engine/mockEngine";

export default function AuditReadiness() {
  const [d, setD] = useState(null);
  useEffect(() => {
    getAuditReadiness().then(setD);
  }, []);

  return (
    <SectionCard label="AUDIT READINESS" delay={0.5}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 18,
            fontWeight: 500,
            color: "#E6EDF3",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {d ? `${d.passing} / ${d.totalChecks}` : "—"}
        </span>
        <span
          style={{
            fontSize: 10,
            color: "#5B6570",
            letterSpacing: "0.12em",
            fontWeight: 600,
          }}
        >
          CHECKS PASSING
        </span>
      </div>

      <div
        style={{
          display: "flex",
          gap: 5,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        {(d ? d.checks : Array(15).fill(true)).map((ok, i) => (
          <span
            key={i}
            title={ok ? "Pass" : "Fail"}
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: ok ? "#00C48C" : "#FF5A5F",
              boxShadow: ok ? "none" : "0 0 6px rgba(255,90,95,0.5)",
              display: "inline-block",
            }}
          />
        ))}
      </div>

      {d && d.failing > 0 && (
        <div style={{ fontSize: 13, color: "#8B98A5", lineHeight: 1.6 }}>
          <span style={{ color: "#FF5A5F", fontWeight: 500 }}>
            {d.failing} check failing:
          </span>{" "}
          {d.failingCheck} —{" "}
          <span style={{ color: "#E6EDF3", fontWeight: 500 }}>
            {d.failingDetail}
          </span>
        </div>
      )}
    </SectionCard>
  );
}
