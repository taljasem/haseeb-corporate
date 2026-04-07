import { useEffect, useState } from "react";
import AminahNarrationCard from "../../components/financial/AminahNarrationCard";
import RoutingRuleReadOnlyCard from "../../components/junior/RoutingRuleReadOnlyCard";
import { getRoutingRules, getJuniorDomainStats } from "../../engine/mockEngine";

function Stat({ label, value }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 8,
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 24,
          fontWeight: 500,
          color: "#E6EDF3",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.12em",
          color: "#5B6570",
          marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  );
}

export default function MyResponsibilitiesScreen({ onContactCFO }) {
  const [rules, setRules] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    getRoutingRules("active").then((all) =>
      setRules(all.filter((r) => r.action.assignTo?.id === "sara"))
    );
    getJuniorDomainStats("sara").then(setStats);
  }, []);

  const totalTasks = stats?.tasksHandled || 0;
  const ruleCount = rules?.length || 0;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px 32px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 18 }}>
          <div
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 28,
              color: "#E6EDF3",
              letterSpacing: "-0.3px",
              lineHeight: 1,
            }}
          >
            MY RESPONSIBILITIES
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.15em",
              color: "#5B6570",
              marginTop: 6,
            }}
          >
            YOUR DOMAIN, SET BY THE CFO
          </div>
        </div>

        <AminahNarrationCard
          text={`You currently own [${ruleCount} routing rules] covering expense categorization, bank reconciliation, audit responses, and marketing investigations. You've handled [${totalTasks} tasks] through these rules this period. The CFO can adjust these at any time.`}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 12,
            marginBottom: 24,
          }}
        >
          {rules && rules.map((r) => <RoutingRuleReadOnlyCard key={r.id} rule={r} />)}
        </div>

        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.15em",
            color: "#5B6570",
            marginBottom: 10,
          }}
        >
          YOUR DOMAIN STATS
        </div>
        {stats && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <Stat label="TASKS HANDLED" value={stats.tasksHandled} />
            <Stat label="ACCURACY RATE" value={`${stats.accuracyRate}%`} />
            <Stat label="AVG COMPLETION" value={`${stats.avgCompletionMinutes}m`} />
            <Stat label="PENDING IN QUEUE" value={stats.pendingInQueue} />
          </div>
        )}

        <button
          onClick={onContactCFO}
          style={{
            background: "transparent",
            color: "#00C48C",
            border: "1px solid rgba(0,196,140,0.30)",
            padding: "10px 16px",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
            fontFamily: "inherit",
          }}
        >
          Contact CFO to adjust your responsibilities
        </button>
      </div>
    </div>
  );
}
