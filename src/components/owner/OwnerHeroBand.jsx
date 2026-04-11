import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
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
        color: "var(--text-tertiary)",
        background: "var(--bg-surface)",
        border: "1px solid var(--border-default)",
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
function AuditPill({ pass = 14, total = 15, label = "AUDIT" }) {
  const failing = total - pass;
  const color = failing === 0 ? "var(--accent-primary)" : failing <= 2 ? "var(--semantic-warning)" : "var(--semantic-danger)";
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
      }}
    >
      {label} <LtrText style={{ fontFamily: "'DM Mono', monospace" }}>{pass}/{total}</LtrText>
    </span>
  );
}

export default function OwnerHeroBand({ onOpenAminah }) {
  const { tenant } = useTenant();
  const { t } = useTranslation("hero");
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 24,
        padding: "16px 24px 14px",
        borderBottom: "1px solid var(--border-default)",
        flexShrink: 0,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
        <h1
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 28,
            color: "var(--text-primary)",
            lineHeight: 0.95,
            letterSpacing: "-0.5px",
            fontWeight: 700,
            margin: 0,
          }}
        >
          <LtrText>{tenant.company.name.toUpperCase()}.</LtrText>
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
            color: "var(--text-tertiary)",
            marginTop: 10,
          }}
        >
          {t("labels.owner_view")} · {t("labels.march_close")} · {t("labels.day_of", { day: 5, total: 8 })}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <StatusPill dotColor="var(--accent-primary)" label={t("status_pills.aminah_online")} pulse />
        <StatusPill dotColor="var(--semantic-info)" label={t("status_pills.engine_active")} pulse />
        <AuditPill pass={14} total={15} label={t("status_pills.audit")} />
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
            background: "var(--accent-primary)",
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
