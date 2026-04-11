/**
 * FilterDropdown — multi-select dropdown with chevron indicator.
 *
 * Usage:
 *   <FilterDropdown label="Category" options={categories} selected={selected}
 *     onChange={setSelected} placeholder="All categories" />
 */
import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

export default function FilterDropdown({ label, options = [], selected = [], onChange, placeholder = "All", maxHeight = 320, align = "start" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const active = selected.length > 0;

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const toggle = (id) => {
    const next = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
    onChange(next);
  };

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          fontWeight: 600,
          padding: "5px 10px",
          borderRadius: 14,
          background: active ? "rgba(0,196,140,0.08)" : "var(--bg-surface)",
          border: active ? "1px solid rgba(0,196,140,0.25)" : "1px solid var(--border-default)",
          color: active ? "var(--accent-primary)" : "var(--text-tertiary)",
          cursor: "pointer",
          fontFamily: "inherit",
          transition: "all 0.12s",
        }}
      >
        {label}{active ? ` (${selected.length})` : `: ${placeholder}`}
        <ChevronDown size={12} style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0)" }} />
      </button>

      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 4px)",
          [align === "end" ? "insetInlineEnd" : "insetInlineStart"]: 0,
          width: 240,
          maxHeight,
          overflowY: "auto",
          background: "var(--bg-surface-raised)",
          border: "1px solid var(--border-default)",
          borderRadius: 8,
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          zIndex: 201,
          padding: "6px 0",
        }}>
          {options.map((opt) => {
            const isSelected = selected.includes(opt.id);
            return (
              <button
                key={opt.id}
                onClick={() => toggle(opt.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "7px 12px",
                  background: isSelected ? "rgba(0,196,140,0.06)" : "transparent",
                  border: "none",
                  color: "var(--text-primary)",
                  fontSize: 11,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "start",
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--border-subtle)"; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
              >
                <input type="checkbox" checked={isSelected} readOnly style={{ width: 13, height: 13, accentColor: "var(--accent-primary)", pointerEvents: "none" }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opt.label}</span>
              </button>
            );
          })}
          {active && (
            <button
              onClick={() => { onChange([]); setOpen(false); }}
              style={{ width: "100%", padding: "8px 12px", borderTop: "1px solid var(--border-subtle)", background: "transparent", border: "none", color: "var(--text-tertiary)", fontSize: 10, cursor: "pointer", fontFamily: "inherit", textAlign: "center", marginTop: 2 }}
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
