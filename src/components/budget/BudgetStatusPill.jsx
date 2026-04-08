import { useTranslation } from "react-i18next";

const STYLES = {
  draft:              { bg: "rgba(212,168,75,0.10)",  fg: "#D4A84B", key: "draft" },
  "in-review":        { bg: "rgba(59,130,246,0.10)",  fg: "#3B82F6", key: "in_review" },
  approved:           { bg: "rgba(0,196,140,0.10)",   fg: "#00C48C", key: "approved" },
  active:             { bg: "rgba(0,196,140,0.10)",   fg: "#00C48C", key: "active" },
  closed:             { bg: "rgba(91,101,112,0.14)",  fg: "#8B98A5", key: "closed" },
  delegated:          { bg: "rgba(59,130,246,0.10)",  fg: "#3B82F6", key: "delegated" },
  "pending-approval": { bg: "rgba(139,92,246,0.10)",  fg: "#8B5CF6", key: "pending_approval" },
};
export default function BudgetStatusPill({ status }) {
  const { t } = useTranslation("budget");
  const s = STYLES[status] || STYLES.draft;
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.12em",
        color: s.fg,
        background: s.bg,
        border: `1px solid ${s.fg}55`,
        padding: "5px 10px",
        borderRadius: 4,
      }}
    >
      {t(`status_pill.${s.key}`)}
    </span>
  );
}
