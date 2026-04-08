import { useTranslation } from "react-i18next";

export function StatusPill({ status }) {
  const { t } = useTranslation("rules");
  const map = {
    active:  { fg: "var(--accent-primary)", bg: "var(--accent-primary-subtle)",  border: "var(--accent-primary-border)",  key: "active" },
    muted:   { fg: "var(--semantic-warning)", bg: "var(--semantic-warning-subtle)", border: "var(--semantic-warning-subtle)", key: "muted" },
    deleted: { fg: "var(--semantic-danger)", bg: "var(--semantic-danger-subtle)",  border: "var(--semantic-danger-subtle)",  key: "deleted" },
  };
  const s = map[status] || map.active;
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.10em",
        color: s.fg,
        background: s.bg,
        border: `1px solid ${s.border}`,
        padding: "3px 8px",
        borderRadius: 3,
      }}
    >
      {t(`status_pill.${s.key}`)}
    </span>
  );
}

export function ModePill({ mode }) {
  const { t } = useTranslation("rules");
  const map = {
    "auto-apply":    { fg: "var(--bg-base)", bg: "var(--accent-primary)",             border: "var(--accent-primary)",             key: "auto_apply" },
    "suggest-only":  { fg: "var(--semantic-info)", bg: "var(--semantic-info-subtle)", border: "rgba(59,130,246,0.40)", key: "suggest" },
    "ask-each-time": { fg: "var(--semantic-warning)", bg: "var(--semantic-warning-subtle)", border: "rgba(212,168,75,0.40)", key: "ask_each" },
  };
  const s = map[mode] || map["suggest-only"];
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.10em",
        color: s.fg,
        background: s.bg,
        border: `1px solid ${s.border}`,
        padding: "3px 8px",
        borderRadius: 3,
      }}
    >
      {t(`mode_pill.${s.key}`)}
    </span>
  );
}
