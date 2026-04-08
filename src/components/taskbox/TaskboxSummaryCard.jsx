import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { getTaskbox } from "../../engine/mockEngine";
import SectionHeader from "../SectionHeader";
import TaskRow from "./TaskRow";

export default function TaskboxSummaryCard({
  role = "CFO",
  onViewAll,
  onTaskClick,
  wrapperStyle = null,
}) {
  const { t } = useTranslation("taskbox");
  const [tasks, setTasks] = useState(null);
  useEffect(() => {
    getTaskbox(role, "all").then(setTasks);
  }, [role]);

  const open = (tasks || []).filter((t) => t.status !== "completed").slice(0, 4);
  const openCount = (tasks || []).filter((t) => t.status !== "completed").length;

  return (
    <div
      style={
        wrapperStyle || {
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 8,
          padding: "18px 20px",
          marginBottom: 16,
        }
      }
    >
      <SectionHeader
        label={
          <>
            {t("summary_card.title")}
            {openCount > 0 && (
              <span
                style={{
                  marginLeft: 8,
                  color: "#8B98A5",
                  fontWeight: 600,
                  fontSize: 10,
                  letterSpacing: "0.12em",
                }}
              >
                · {t("summary_card.open_suffix", { count: openCount })}
              </span>
            )}
          </>
        }
        aminah
      />
      <div style={{ marginTop: 4, marginInline: -10 }}>
        {tasks === null ? (
          <div style={{ padding: 16, color: "#5B6570", fontSize: 12 }}>{t("summary_card.loading")}</div>
        ) : open.length === 0 ? (
          <div style={{ padding: 16, color: "#5B6570", fontSize: 12 }}>
            {t("summary_card.inbox_zero")}
          </div>
        ) : (
          open.map((t) => (
            <TaskRow key={t.id} task={t} compact onClick={onTaskClick} />
          ))
        )}
      </div>
      <div style={{ marginTop: 10 }}>
        <a
          onClick={onViewAll}
          style={{
            fontSize: 12,
            color: "#00C48C",
            cursor: "pointer",
            letterSpacing: "0.04em",
          }}
        >
          {t("summary_card.view_all")}
        </a>
      </div>
    </div>
  );
}
