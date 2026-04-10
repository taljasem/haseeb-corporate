/**
 * SortHeader — clickable column sort header with visible arrow indicators.
 *
 * Usage:
 *   <SortHeader field="date" activeField={sortField} direction={sortDir}
 *     onSort={handleSort} label="Date" />
 */
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";

export default function SortHeader({ field, activeField, direction, onSort, label, align = "left" }) {
  const isActive = field === activeField;

  return (
    <button
      onClick={() => onSort(field)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: align === "right" ? "flex-end" : "flex-start",
        gap: 4,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: isActive ? "var(--accent-primary)" : "var(--text-tertiary)",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        fontFamily: "inherit",
        padding: "6px 4px",
        borderRadius: 4,
        transition: "all 0.12s",
        userSelect: "none",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.04)";
        e.currentTarget.style.textDecoration = "underline";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.textDecoration = "none";
      }}
    >
      {label}
      {isActive ? (
        direction === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />
      ) : (
        <ArrowUpDown size={13} style={{ opacity: 0.4 }} />
      )}
    </button>
  );
}
