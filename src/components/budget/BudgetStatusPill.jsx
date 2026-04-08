import { useTranslation } from "react-i18next";

const STYLES = {
  draft:              { bg: "var(--semantic-warning-subtle)",  fg: "var(--semantic-warning)", key: "draft" },
  "in-review":        { bg: "var(--semantic-info-subtle)",  fg: "var(--semantic-info)", key: "in_review" },
  approved:           { bg: "var(--accent-primary-subtle)",   fg: "var(--accent-primary)", key: "approved" },
  active:             { bg: "var(--accent-primary-subtle)",   fg: "var(--accent-primary)", key: "active" },
  closed:             { bg: "rgba(91,101,112,0.14)",  fg: "var(--text-secondary)", key: "closed" },
  delegated:          { bg: "var(--semantic-info-subtle)",  fg: "var(--semantic-info)", key: "delegated" },
  "pending-approval": { bg: "rgba(139,92,246,0.10)",  fg: "var(--role-owner)", key: "pending_approval" },
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
