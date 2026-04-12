import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import SectionCard from "./SectionCard";
import { getTaskbox } from "../../engine/mockEngine";

export default function PendingApprovals({ onViewAll }) {
  const { t } = useTranslation("owner-overview");
  const [tasks, setTasks] = useState(null);
  useEffect(() => {
    getTaskbox("Owner", "approvals").then(setTasks);
  }, []);

  const open = (tasks || []).filter((t) => t.status !== "completed" && t.status !== "rejected");
  const bySenderId = {};
  const senderNames = {};
  open.forEach((task) => {
    const sid = task.sender.id;
    bySenderId[sid] = (bySenderId[sid] || 0) + 1;
    if (!senderNames[sid]) {
      if (sid === "owner") {
        senderNames[sid] = t("pending_approvals.you_role", { role: t("pending_approvals.role_owner") });
      } else {
        const raw = task.sender.name;
        senderNames[sid] = raw.replace(/^You \(.*?\)$/, task.sender.role || raw);
      }
    }
  });
  const breakdown = Object.entries(bySenderId)
    .map(([sid, count]) => t("pending_approvals.from", { count, name: senderNames[sid] }))
    .join(" · ");

  return (
    <SectionCard label={t("pending_approvals.label")} delay={0.4}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
        <span
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 32,
            fontWeight: 500,
            color: "var(--text-primary)",
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          {tasks ? open.length : "—"}
        </span>
        <span
          style={{
            fontSize: 10,
            color: "var(--text-tertiary)",
            letterSpacing: "0.15em",
            fontWeight: 600,
          }}
        >
          {t("pending_approvals.label")}
        </span>
      </div>
      {breakdown && (
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>
          {breakdown}
        </div>
      )}
      <div style={{ marginTop: 14 }}>
        <a
          onClick={onViewAll}
          style={{
            fontSize: 12,
            color: "var(--accent-primary)",
            cursor: "pointer",
            letterSpacing: "0.04em",
          }}
        >
          {t("pending_approvals.view_all")}
        </a>
      </div>
    </SectionCard>
  );
}
