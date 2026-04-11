import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import SectionCard from "./SectionCard";
import { getCloseStatus } from "../../engine/mockEngine";

export default function CloseStatus() {
  const { t } = useTranslation("owner-overview");
  const [d, setD] = useState(null);
  useEffect(() => {
    getCloseStatus().then(setD);
  }, []);

  return (
    <SectionCard label={t("sections.month_end_close")} delay={0.55}>
      <div
        style={{
          fontSize: 11,
          color: "var(--text-tertiary)",
          letterSpacing: "0.15em",
          fontWeight: 600,
          marginBottom: 8,
        }}
      >
        {d ? d.period.toUpperCase() : "—"}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <span
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 22,
            fontWeight: 500,
            color: "var(--text-primary)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {d ? `${d.tasksComplete} / ${d.tasksTotal}` : "—"}
        </span>
        <span
          style={{
            fontSize: 10,
            color: "var(--text-tertiary)",
            letterSpacing: "0.12em",
            fontWeight: 600,
          }}
        >
          {t("close.tasks_complete")}
        </span>
      </div>

      <div
        style={{
          width: "100%",
          height: 4,
          background: "var(--border-subtle)",
          borderRadius: 2,
          overflow: "hidden",
          marginBottom: 14,
        }}
      >
        <div
          style={{
            width: `${d ? d.percentComplete : 0}%`,
            height: "100%",
            background: "var(--accent-primary)",
            transition: "width 0.4s ease",
          }}
        />
      </div>

      {d && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {d.nextTasks.map((t, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: "var(--text-secondary)",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  border: "1px solid var(--border-strong)",
                  background: t.complete ? "var(--accent-primary)" : "transparent",
                  flexShrink: 0,
                }}
              />
              <span style={{ flex: 1 }}>{t.task}</span>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{t.assignee}</span>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
