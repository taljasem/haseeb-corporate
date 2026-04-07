const STYLES = {
  draft:       { bg: "rgba(212,168,75,0.10)",  fg: "#D4A84B", label: "DRAFT" },
  "in-review": { bg: "rgba(59,130,246,0.10)",  fg: "#3B82F6", label: "IN REVIEW" },
  approved:    { bg: "rgba(0,196,140,0.10)",   fg: "#00C48C", label: "APPROVED" },
  active:      { bg: "rgba(0,196,140,0.10)",   fg: "#00C48C", label: "ACTIVE" },
  closed:      { bg: "rgba(91,101,112,0.14)",  fg: "#8B98A5", label: "CLOSED" },
};
export default function BudgetStatusPill({ status }) {
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
      {s.label}
    </span>
  );
}
