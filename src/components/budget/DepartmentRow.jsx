import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatKWD } from "../../utils/format";
import BudgetVarianceBar from "./BudgetVarianceBar";
import { getBudgetVarianceByLineItem } from "../../engine/mockEngine";

const STATUS_PILL = {
  // expense
  under:      { fg: "#00C48C", bg: "rgba(0,196,140,0.10)",  label: "UNDER" },
  "on-track": { fg: "#00C48C", bg: "rgba(0,196,140,0.10)",  label: "ON TRACK" },
  over:       { fg: "#D4A84B", bg: "rgba(212,168,75,0.10)", label: "APPROACHING" },
  critical:   { fg: "#FF5A5F", bg: "rgba(255,90,95,0.10)",  label: "OVER" },
  // revenue
  behind:     { fg: "#FF5A5F", bg: "rgba(255,90,95,0.10)",  label: "BEHIND" },
  ahead:      { fg: "#00C48C", bg: "rgba(0,196,140,0.10)",  label: "AHEAD" },
};

const COLS = "minmax(160px, 1.4fr) minmax(140px, 1fr) 130px 130px 130px 130px 180px 110px 18px";

function fmtSigned(n) {
  if (n == null || isNaN(n)) return "—";
  const abs = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  if (n === 0) return "0.000";
  return n > 0 ? `+${abs}` : `-${abs}`;
}

export default function DepartmentRow({ row, expanded, onToggle, ownerName }) {
  const [lines, setLines] = useState(null);
  const status = STATUS_PILL[row.status] || STATUS_PILL["on-track"];
  useEffect(() => {
    if (expanded && !lines) getBudgetVarianceByLineItem(row.id).then(setLines);
  }, [expanded, lines, row.id]);

  return (
    <div style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div
        onClick={() => onToggle && onToggle(row)}
        onMouseEnter={(e) => {
          if (!expanded) e.currentTarget.style.background = "rgba(255,255,255,0.03)";
        }}
        onMouseLeave={(e) => {
          if (!expanded) e.currentTarget.style.background = "transparent";
        }}
        style={{
          display: "grid",
          gridTemplateColumns: COLS,
          gap: 12,
          alignItems: "center",
          padding: "14px 18px",
          cursor: "pointer",
          background: expanded ? "rgba(255,255,255,0.03)" : "transparent",
          transition: "background 0.12s ease",
        }}
      >
        <div style={{ fontSize: 13, color: "#E6EDF3", fontWeight: 500 }}>{row.name}</div>
        <div style={{ fontSize: 12, color: "#5B6570" }}>{ownerName || "—"}</div>
        <div
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 13,
            color: "#E6EDF3",
            textAlign: "right",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatKWD(row.budgetAnnual)}
        </div>
        <div
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 12,
            color: "#5B6570",
            textAlign: "right",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatKWD(row.budgetYtd)}
        </div>
        <div
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 13,
            color: "#E6EDF3",
            textAlign: "right",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatKWD(row.actualYtd)}
        </div>
        <div
          style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: 12,
            color: row.category === "revenue"
              ? (row.varianceAmount < 0 ? "#FF5A5F" : "#00C48C")
              : (row.varianceAmount > 0 ? "#FF5A5F" : "#00C48C"),
            textAlign: "right",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {fmtSigned(row.varianceAmount)}
        </div>
        <BudgetVarianceBar percent={row.variancePercent} status={row.status} />
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.10em",
            color: status.fg,
            background: status.bg,
            border: `1px solid ${status.fg}55`,
            padding: "3px 8px",
            borderRadius: 3,
            textAlign: "center",
          }}
        >
          {status.label}
        </span>
        <span style={{ color: "#5B6570" }}>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </div>

      {expanded && (
        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            borderTop: "1px solid rgba(255,255,255,0.04)",
            padding: "8px 0 14px",
          }}
        >
          {!lines ? (
            <div style={{ padding: "10px 32px", color: "#5B6570", fontSize: 12 }}>Loading…</div>
          ) : (
            lines.map((l) => {
              const s = STATUS_PILL[l.status] || STATUS_PILL["on-track"];
              return (
                <div
                  key={l.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: COLS,
                    gap: 12,
                    alignItems: "center",
                    padding: "8px 18px 8px 36px",
                    fontSize: 12,
                  }}
                >
                  <div style={{ color: "#8B98A5" }}>
                    <span style={{ fontFamily: "'DM Mono', monospace", color: "#5B6570", marginRight: 8 }}>
                      {l.glAccountCode}
                    </span>
                    {l.glAccountName}
                  </div>
                  <div />
                  <div
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      color: "#8B98A5",
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatKWD(l.budgetAnnual)}
                  </div>
                  <div
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      color: "#5B6570",
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatKWD(l.budgetYtd)}
                  </div>
                  <div
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      color: "#8B98A5",
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatKWD(l.actualYtd)}
                  </div>
                  <div
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      color: l.varianceAmount > 0 ? "#FF5A5F" : "#00C48C",
                      textAlign: "right",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {fmtSigned(l.varianceAmount)}
                  </div>
                  <BudgetVarianceBar percent={l.variancePercent} status={l.status} />
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 700,
                      letterSpacing: "0.10em",
                      color: s.fg,
                      background: s.bg,
                      border: `1px solid ${s.fg}55`,
                      padding: "2px 6px",
                      borderRadius: 3,
                      textAlign: "center",
                    }}
                  >
                    {s.label}
                  </span>
                  <span />
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
