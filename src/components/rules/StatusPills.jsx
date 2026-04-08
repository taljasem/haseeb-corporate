import { useTranslation } from "react-i18next";

export function StatusPill({ status }) {
  const { t } = useTranslation("rules");
  const map = {
    active:  { fg: "#00C48C", bg: "rgba(0,196,140,0.08)",  border: "rgba(0,196,140,0.30)",  key: "active" },
    muted:   { fg: "#D4A84B", bg: "rgba(212,168,75,0.08)", border: "rgba(212,168,75,0.30)", key: "muted" },
    deleted: { fg: "#FF5A5F", bg: "rgba(255,90,95,0.08)",  border: "rgba(255,90,95,0.30)",  key: "deleted" },
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
    "auto-apply":    { fg: "#05070A", bg: "#00C48C",             border: "#00C48C",             key: "auto_apply" },
    "suggest-only":  { fg: "#3B82F6", bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.40)", key: "suggest" },
    "ask-each-time": { fg: "#D4A84B", bg: "rgba(212,168,75,0.08)", border: "rgba(212,168,75,0.40)", key: "ask_each" },
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
