import { useEffect, useState } from "react";
import SectionCard from "./SectionCard";
import { getAminahNotes } from "../../engine/mockEngine";

function renderHighlighted(text) {
  const parts = text.split(/(\[[^\]]+\])/g);
  return parts.map((part, i) => {
    if (part.startsWith("[") && part.endsWith("]")) {
      const inner = part.slice(1, -1);
      const isNumeric = /[\d,.]/.test(inner) && /KWD|days|%/.test(inner);
      const isNeg = /overdue|over|\+\d+%/i.test(inner);
      const color = isNeg ? "#FF5A5F" : "#E6EDF3";
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
  const [notes, setNotes] = useState(null);
  useEffect(() => {
    getAminahNotes().then(setNotes);
  }, []);

  return (
    <SectionCard
      label="AMINAH'S NOTES"
      extra={notes ? <span className="tension-dot tension-dot--info">{notes.length}</span> : null}
      delay={0.3}
    >
      {notes
        ? notes.map((n) => (
            <div
              key={n.id}
              style={{
                fontSize: 13,
                color: "#8B98A5",
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
