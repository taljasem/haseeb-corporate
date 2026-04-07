import { useEffect, useState } from "react";
import SectionCard from "./SectionCard";
import { getPendingApprovals } from "../../engine/mockEngine";
import { formatKWD } from "../../utils/format";

const TYPE_STYLES = {
  EXPENSE: { bg: "rgba(0,196,140,0.10)",  fg: "#00C48C" },
  PO:      { bg: "rgba(59,130,246,0.10)", fg: "#3B82F6" },
  PAYMENT: { bg: "rgba(212,168,75,0.12)", fg: "#D4A84B" },
  JOURNAL: { bg: "rgba(139,92,246,0.10)", fg: "#8B5CF6" },
};

function TypePill({ type }) {
  const s = TYPE_STYLES[type] || TYPE_STYLES.EXPENSE;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: 9,
        fontWeight: 600,
        letterSpacing: "0.08em",
        color: s.fg,
        background: s.bg,
        padding: "3px 7px",
        borderRadius: 3,
        flexShrink: 0,
      }}
    >
      {type}
    </span>
  );
}

export default function PendingApprovals() {
  const [items, setItems] = useState(null);
  useEffect(() => {
    getPendingApprovals().then(setItems);
  }, []);

  return (
    <SectionCard
      label="PENDING APPROVALS"
      extra={items ? <span className="tension-dot">{items.length}</span> : null}
      delay={0.4}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {items
          ? items.map((it) => (
              <div
                key={it.id}
                className="tx-row"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px",
                  margin: "0 -10px",
                }}
              >
                <TypePill type={it.type} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      color: "#E6EDF3",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {it.description}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: "#5B6570",
                      marginTop: 2,
                    }}
                  >
                    from {it.requestedBy} · {it.timeAgo}
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#E6EDF3",
                    fontVariantNumeric: "tabular-nums",
                    flexShrink: 0,
                  }}
                >
                  {formatKWD(it.amount)}
                </div>
              </div>
            ))
          : null}
      </div>
      <div style={{ marginTop: 12 }}>
        <a
          style={{
            fontSize: 12,
            color: "#00C48C",
            cursor: "pointer",
            letterSpacing: "0.04em",
          }}
        >
          Review all →
        </a>
      </div>
    </SectionCard>
  );
}
