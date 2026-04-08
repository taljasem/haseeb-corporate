import { useState } from "react";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";

export default function SidebarGroup({ label, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const Chev = open ? ChevronDown : ChevronRight;
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          padding: "16px 20px 8px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.15em",
          color: "#5B6570",
          textAlign: "start",
        }}
      >
        <span style={{ flex: 1 }}>{label}</span>
        <Chev size={12} strokeWidth={2.4} />
      </button>
      <div
        style={{
          maxHeight: open ? 600 : 0,
          overflow: "hidden",
          transition: "max-height 0.2s ease",
        }}
      >
        {children}
      </div>
    </div>
  );
}
