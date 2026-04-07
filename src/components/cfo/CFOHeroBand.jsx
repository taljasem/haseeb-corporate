import { useTenant } from "../shared/TenantContext";

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

function AuditPill({ pass = 14, total = 15 }) {
  const failing = total - pass;
  const color = failing === 0 ? "#00C48C" : failing <= 2 ? "#D4A84B" : "#FF5A5F";
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
      AUDIT {pass}/{total}
    </span>
  );
}

function SparkleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </svg>
  );
}

export default function CFOHeroBand({ onOpenAminah }) {
  const { tenant } = useTenant();
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
          {tenant.company.name.toUpperCase()}.
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
          CFO VIEW · MARCH 2026 CLOSE · DAY 5 OF 8
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <StatusPill dotColor="#00C48C" label="AMINAH ONLINE" pulse />
        <StatusPill dotColor="#3B82F6" label="ENGINE ACTIVE" pulse />
        <AuditPill pass={14} total={15} />
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
          <SparkleIcon />
          AMINAH
        </button>
      </div>
    </div>
  );
}
