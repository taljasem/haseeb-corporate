import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import SectionCard from "./SectionCard";
import { getAminahNotes } from "../../engine/mockEngine";

function renderHighlighted(text) {
  const parts = text.split(/(\[[^\]]+\])/g);
  return parts.map((part, i) => {
    if (part.startsWith("[") && part.endsWith("]")) {
      const inner = part.slice(1, -1);
      const isNumeric = /[\d,.]/.test(inner) && /KWD|days|%/.test(inner);
      const isNeg = /overdue|over|\+\d+%/i.test(inner);
      const color = isNeg ? "var(--semantic-danger)" : "var(--text-primary)";
      return (
        <span
          key={i}
          style={{
            color,
            fontWeight: 500,
            fontFamily: isNumeric && inner.includes("KWD") ? "'DM Mono', monospace" : "inherit",
          }}
        >
          {inner}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export default function AminahNotes() {
  const { t } = useTranslation("owner-overview");
  const [notes, setNotes] = useState(null);
  useEffect(() => {
    getAminahNotes().then(setNotes);
  }, []);

  return (
    <SectionCard
      label={t("sections.aminahs_notes")}
      extra={notes ? <span className="tension-dot tension-dot--info">{notes.length}</span> : null}
      delay={0.3}
    >
      {notes
        ? notes.map((n) => (
            <div
              key={n.id}
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                lineHeight: 1.8,
                marginBottom: 6,
              }}
            >
              {renderHighlighted(n.text)}
            </div>
          ))
        : null}
    </SectionCard>
  );
}
