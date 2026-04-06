import { useEffect, useState } from "react";
import SectionHeader from "./SectionHeader";
import {
  getMonthlyInsights,
  getHealthScore,
  getAminahNotes,
  getEngineAlerts,
} from "../engine/mockEngine";

/**
 * Render text with [bracketed] highlights.
 * Positive (contains +) → teal. Negative (contains - or "over") → red.
 * Otherwise → primary text.
 */
function renderHighlighted(text) {
  const parts = text.split(/(\[[^\]]+\])/g);
  return parts.map((part, i) => {
    if (part.startsWith("[") && part.endsWith("]")) {
      const inner = part.slice(1, -1);
      const isNeg =
        /(^-|over|overdue|\+\d+%\s+(over)?|91%)/i.test(inner) ||
        inner.includes("+23%") ||
        inner.includes("+91%");
      const isPos = !isNeg && /^\+/.test(inner);
      const color = isPos ? "#00C48C" : isNeg ? "#FF5A5F" : "#E6EDF3";
      return (
        <span
          key={i}
          style={{
            color,
            fontWeight: 500,
            fontFamily: /[\d,.]/.test(inner) && inner.includes("KWD") ? "'DM Mono', monospace" : "inherit",
          }}
        >
          {inner}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function HealthRing({ percent = 75 }) {
  const r = 26;
  const circumference = 2 * Math.PI * r;
  const filled = (percent / 100) * circumference;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64">
      <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="4" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke="#00C48C"
        strokeWidth="4"
        strokeDasharray={`${filled} ${circumference}`}
        strokeLinecap="round"
        transform="rotate(-90 32 32)"
      />
    </svg>
  );
}

export default function AminahStream() {
  const [data, setData] = useState({
    insights: null,
    health: null,
    notes: null,
    alerts: null,
  });

  useEffect(() => {
    Promise.all([
      getMonthlyInsights(),
      getHealthScore(),
      getAminahNotes(),
      getEngineAlerts(),
    ]).then(([insights, health, notes, alerts]) => {
      setData({ insights, health, notes, alerts });
    });
  }, []);

  const infoAlerts = data.alerts
    ? data.alerts.filter((a) => a.severity === "info")
    : [];

  return (
    <div
      style={{
        width: 300,
        flexShrink: 0,
        borderRight: "1px solid rgba(255,255,255,0.10)",
        padding: "20px 20px 0",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* SECTION 1 — Monthly insights */}
      <div className="ami-sec" style={{ animation: "fadeUp 0.4s ease 0.2s both" }}>
        <SectionHeader label="MONTHLY INSIGHTS" aminah />
        <div style={{ fontSize: 13, color: "#8B98A5", lineHeight: 1.7 }}>
          {data.insights ? renderHighlighted(data.insights.text) : "—"}
        </div>
      </div>

      {/* SECTION 2 — Financial health */}
      <div className="ami-sec" style={{ animation: "fadeUp 0.4s ease 0.3s both" }}>
        <SectionHeader label="FINANCIAL HEALTH" aminah />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 12,
          }}
        >
          <HealthRing percent={data.health ? data.health.score : 75} />
          <div>
            <div
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 26,
                fontWeight: 500,
                color: "#00C48C",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {data.health ? `${data.health.score}%` : "—"}
            </div>
            <div
              style={{
                fontSize: 10,
                color: "#5B6570",
                letterSpacing: "0.08em",
                marginTop: 2,
              }}
            >
              THIS MONTH
            </div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: "#8B98A5", lineHeight: 1.65 }}>
          {data.health
            ? `${data.health.status}. ${data.health.message}`
            : "—"}
        </div>
      </div>

      {/* SECTION 3 — Aminah's notes */}
      <div className="ami-sec" style={{ animation: "fadeUp 0.4s ease 0.4s both" }}>
        <SectionHeader
          label={
            <>
              AMINAH'S NOTES
              {data.notes && (
                <span className="tension-dot">{data.notes.length}</span>
              )}
            </>
          }
          aminah
        />
        {data.notes
          ? data.notes.map((n) => (
              <div
                key={n.id}
                style={{
                  fontSize: 13,
                  color: "#8B98A5",
                  lineHeight: 1.8,
                  marginBottom: 6,
                }}
              >
                {renderHighlighted(n.text)}
              </div>
            ))
          : null}
      </div>

      {/* SECTION 4 — AI insights */}
      <div
        className="ami-sec"
        style={{ borderBottom: "none", animation: "fadeUp 0.4s ease 0.5s both" }}
      >
        <SectionHeader label="AI INSIGHTS" aminah />
        {infoAlerts.length > 0 ? (
          infoAlerts.map((a) => (
            <div
              key={a.id}
              style={{
                fontSize: 13,
                color: "#8B98A5",
                lineHeight: 1.7,
                marginBottom: 10,
              }}
            >
              {a.message}
            </div>
          ))
        ) : (
          <>
            <div style={{ fontSize: 13, color: "#8B98A5", lineHeight: 1.7, marginBottom: 10 }}>
              KIB Operating balance up{" "}
              <span style={{ color: "#00C48C", fontWeight: 500 }}>+12%</span> vs.
              trailing 30-day average. Liquidity posture strong.
            </div>
            <div style={{ fontSize: 13, color: "#8B98A5", lineHeight: 1.7 }}>
              PIFSS contribution due end of month. Estimated:{" "}
              <span style={{ fontFamily: "'DM Mono', monospace", color: "#E6EDF3", fontWeight: 500 }}>
                4,862.500 KWD
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
