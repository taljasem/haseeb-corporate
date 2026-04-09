import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ClipboardList } from "lucide-react";
import AminahNarrationCard from "../../components/financial/AminahNarrationCard";
import EmptyState from "../../components/shared/EmptyState";
import RoutingRuleReadOnlyCard from "../../components/junior/RoutingRuleReadOnlyCard";
import { getRoutingRules, getJuniorDomainStats } from "../../engine/mockEngine";

function Stat({ label, value }) {
  return (
    <div
      style={{
        background: "var(--bg-surface)",
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
          color: "var(--text-primary)",
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
          color: "var(--text-tertiary)",
          marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  );
}

export default function MyResponsibilitiesScreen({ onContactCFO }) {
  const { t } = useTranslation("junior-today");
  const { t: tc } = useTranslation("common");
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
              color: "var(--text-primary)",
              letterSpacing: "-0.3px",
              lineHeight: 1,
            }}
          >
            {t("responsibilities.title")}
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.15em",
              color: "var(--text-tertiary)",
              marginTop: 6,
            }}
          >
            {t("responsibilities.subtitle")}
          </div>
        </div>

        <AminahNarrationCard
          text={t("responsibilities.aminah_summary", { rules: ruleCount, tasks: totalTasks })}
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 12,
            marginBottom: 24,
          }}
        >
          {rules && rules.length === 0 && (
            <EmptyState icon={ClipboardList} title={tc("empty_states.responsibilities_title")} description={tc("empty_states.responsibilities_desc")} />
          )}
          {rules && rules.map((r) => <RoutingRuleReadOnlyCard key={r.id} rule={r} />)}
        </div>

        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.15em",
            color: "var(--text-tertiary)",
            marginBottom: 10,
          }}
        >
          {t("responsibilities.domain_stats")}
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
            <Stat label={t("responsibilities.tasks_handled")} value={stats.tasksHandled} />
            <Stat label={t("responsibilities.accuracy_rate")} value={`${stats.accuracyRate}%`} />
            <Stat label={t("responsibilities.avg_completion")} value={`${stats.avgCompletionMinutes}m`} />
            <Stat label={t("responsibilities.pending_in_queue")} value={stats.pendingInQueue} />
          </div>
        )}

        <button
          onClick={onContactCFO}
          style={{
            background: "transparent",
            color: "var(--accent-primary)",
            border: "1px solid rgba(0,196,140,0.30)",
            padding: "10px 16px",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
            fontFamily: "inherit",
          }}
        >
          {t("responsibilities.contact_cfo")}
        </button>
      </div>
    </div>
  );
}
