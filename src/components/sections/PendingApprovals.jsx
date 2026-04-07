import { useEffect, useState } from "react";
import SectionCard from "./SectionCard";
import { getTaskbox } from "../../engine/mockEngine";

export default function PendingApprovals() {
  const [tasks, setTasks] = useState(null);
  useEffect(() => {
    getTaskbox("Owner", "approvals").then(setTasks);
  }, []);

  const open = (tasks || []).filter((t) => t.status !== "completed" && t.status !== "rejected");
  const bySender = {};
  open.forEach((t) => {
    const name = t.sender.name.replace("You (", "").replace(")", "");
    bySender[name] = (bySender[name] || 0) + 1;
  });
  const breakdown = Object.entries(bySender)
    .map(([name, count]) => `${count} from ${name}`)
    .join(" · ");

  return (
    <SectionCard label="PENDING APPROVALS" delay={0.4}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
        <span
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 32,
            fontWeight: 500,
            color: "#E6EDF3",
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          {tasks ? open.length : "—"}
        </span>
        <span
          style={{
            fontSize: 10,
            color: "#5B6570",
            letterSpacing: "0.15em",
            fontWeight: 600,
          }}
        >
          PENDING APPROVALS
        </span>
      </div>
      {breakdown && (
        <div style={{ fontSize: 12, color: "#8B98A5", marginTop: 8 }}>
          {breakdown}
        </div>
      )}
      <div style={{ marginTop: 14 }}>
        <a
          onClick={() => console.log("[owner] full Taskbox coming in owner view restructure")}
          style={{
            fontSize: 12,
            color: "#00C48C",
            cursor: "pointer",
            letterSpacing: "0.04em",
          }}
        >
          View all in Taskbox →
        </a>
      </div>
    </SectionCard>
  );
}
