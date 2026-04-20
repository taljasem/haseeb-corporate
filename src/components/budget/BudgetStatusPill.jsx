import { useTranslation } from "react-i18next";

// CHANGES_REQUESTED / LOCKED / REJECTED entries added 2026-04-21.
// REJECTED is a proper terminal state (backend enum addition) and
// renders with the danger-red tokens — distinct from CHANGES_REQUESTED
// which uses the warning-orange family. LOCKED uses the neutral/closed
// slate tone because it is a post-approval freeze, not an alert state.
//
// Backend emits UPPER_SNAKE (LOCKED / REJECTED / CHANGES_REQUESTED); mock
// emits kebab-lower (locked / rejected / changes-requested). Both paths
// keyed below so the pill renders identically regardless of source.
const STYLES = {
  draft:                { bg: "var(--semantic-warning-subtle)", fg: "var(--semantic-warning)", key: "draft" },
  "in-review":          { bg: "var(--semantic-info-subtle)",    fg: "var(--semantic-info)",    key: "in_review" },
  approved:             { bg: "var(--accent-primary-subtle)",   fg: "var(--accent-primary)",   key: "approved" },
  active:               { bg: "var(--accent-primary-subtle)",   fg: "var(--accent-primary)",   key: "active" },
  closed:               { bg: "rgba(91,101,112,0.14)",          fg: "var(--text-secondary)",   key: "closed" },
  delegated:            { bg: "var(--semantic-info-subtle)",    fg: "var(--semantic-info)",    key: "delegated" },
  "pending-approval":   { bg: "rgba(139,92,246,0.10)",          fg: "var(--role-owner)",       key: "pending_approval" },
  "changes-requested":  { bg: "var(--semantic-warning-subtle)", fg: "var(--semantic-warning)", key: "changes_requested" },
  locked:               { bg: "var(--bg-surface-sunken)",       fg: "var(--text-secondary)",   key: "locked" },
  rejected:             { bg: "var(--semantic-danger-subtle)",  fg: "var(--semantic-danger)",  key: "rejected" },
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
