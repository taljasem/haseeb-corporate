import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { getSaraAccuracy } from "../../engine/mockEngine";

function StatusPill({ dotColor, label, pulse = false }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.12em",
        color: "#5B6570",
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.08)",
        padding: "5px 10px",
        borderRadius: 4,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: dotColor,
          animation: pulse ? "aminahAlive 2.5s ease-in-out infinite" : "none",
          boxShadow: pulse ? `0 0 6px ${dotColor}66` : "none",
        }}
      />
      {label}
    </span>
  );
}

function AccuracyPill({ value }) {
  const color = value >= 90 ? "#00C48C" : value >= 80 ? "#D4A84B" : "#FF5A5F";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.12em",
        color,
        background: `${color}14`,
        border: `1px solid ${color}55`,
        padding: "5px 10px",
        borderRadius: 4,
        fontFamily: "'DM Mono', monospace",
      }}
    >
      ACCURACY {value}%
    </span>
  );
}

export default function JuniorHeroBand({ onOpenAminah }) {
  const [accuracy, setAccuracy] = useState(null);
  useEffect(() => {
    getSaraAccuracy().then(setAccuracy);
  }, []);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 24,
        padding: "16px 24px 14px",
        borderBottom: "1px solid rgba(255,255,255,0.10)",
        flexShrink: 0,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        <h1
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 28,
            color: "#E6EDF3",
            lineHeight: 0.95,
            letterSpacing: "-0.5px",
            fontWeight: 700,
            margin: 0,
          }}
        >
          SARA AL-AHMADI.
        </h1>
        <div
          style={{
            width: 80,
            height: 2,
            background: "linear-gradient(90deg, #00C48C, transparent)",
            marginTop: 8,
            boxShadow: "0 0 12px rgba(0,196,140,0.35)",
          }}
        />
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.12em",
            color: "#5B6570",
            marginTop: 10,
          }}
        >
          SENIOR ACCOUNTANT · AL MANARA TRADING · MARCH 2026
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <StatusPill dotColor="#00C48C" label="ONLINE" pulse />
        {accuracy && <AccuracyPill value={accuracy.current} />}
        <button
          onClick={onOpenAminah}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            color: "#fff",
            background: "#00C48C",
            border: "none",
            padding: "6px 12px",
            borderRadius: 4,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <Sparkles size={14} strokeWidth={2.4} />
          AMINAH
        </button>
      </div>
    </div>
  );
}
