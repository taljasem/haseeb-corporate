import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getSaraAccuracy } from "../../engine/mockEngine";
import { useTenant } from "../shared/TenantContext";
import LtrText from "../shared/LtrText";

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

function AccuracyPill({ value, previous = 91, label = "ACCURACY" }) {
  const color = value >= 90 ? "#00C48C" : value >= 80 ? "#D4A84B" : "#FF5A5F";
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!pinned) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setPinned(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [pinned]);
  const visible = hover || pinned;
  return (
    <span
      ref={ref}
      style={{ position: "relative", display: "inline-block" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          setPinned((p) => !p);
        }}
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
          cursor: "pointer",
        }}
      >
        {label} <LtrText style={{ fontFamily: "'DM Mono', monospace" }}>{value}%</LtrText>
      </button>
      {visible && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 280,
            background: "#0C0E12",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 8,
            padding: "12px 14px",
            boxShadow: "0 12px 32px rgba(0,0,0,0.6)",
            zIndex: 200,
          }}
        >
          <div
            style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: "0.15em",
              color: "#5B6570",
              marginBottom: 6,
            }}
          >
            ACCURACY THIS WEEK
          </div>
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 16,
              color,
              fontWeight: 500,
              marginBottom: 6,
            }}
          >
            {value}% — up from {previous}% last week
          </div>
          <div style={{ fontSize: 11, color: "#8B98A5", lineHeight: 1.5, marginBottom: 6 }}>
            Most common correction: <span style={{ color: "#E6EDF3" }}>cost center allocation</span>
          </div>
          <div style={{ fontSize: 11, color: "#5B6570", lineHeight: 1.5 }}>
            Calculated from <span style={{ fontFamily: "'DM Mono', monospace", color: "#E6EDF3" }}>47</span>{" "}
            categorizations and{" "}
            <span style={{ fontFamily: "'DM Mono', monospace", color: "#E6EDF3" }}>12</span> reconciliations
          </div>
          <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <a style={{ fontSize: 11, color: "#00C48C", cursor: "pointer" }}>
              How is this calculated? →
            </a>
          </div>
        </div>
      )}
    </span>
  );
}

export default function JuniorHeroBand({ onOpenAminah }) {
  const { tenant } = useTenant();
  const { t } = useTranslation("hero");
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
          <LtrText>SARA AL-AHMADI.</LtrText>
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
          {t("labels.senior_accountant")} · <LtrText>{tenant.company.name.toUpperCase()}</LtrText> · {t("labels.march_2026")}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <StatusPill dotColor="#00C48C" label={t("status_pills.online")} pulse />
        {accuracy && <AccuracyPill value={accuracy.current} previous={accuracy.previous} label={t("status_pills.accuracy")} />}
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
          {t("buttons.aminah")}
        </button>
      </div>
    </div>
  );
}
