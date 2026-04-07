import * as L from "lucide-react";

function NavItem({ icon: Icon, label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        height: 36,
        padding: "0 16px 0 20px",
        background: active ? "rgba(255,255,255,0.04)" : "transparent",
        border: "none",
        cursor: "pointer",
        color: active ? "#E6EDF3" : "#5B6570",
        fontFamily: "inherit",
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.05em",
        textAlign: "left",
        boxShadow: active ? "inset 2px 0 0 #00C48C" : "none",
        transition: "all 0.12s ease",
      }}
    >
      <Icon size={16} strokeWidth={2} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge && (
        <span
          style={{
            background: badge.bg || "#FF5A5F",
            color: badge.fg || "#fff",
            fontSize: 9,
            fontWeight: 700,
            fontFamily: "'DM Mono', monospace",
            padding: "2px 6px",
            borderRadius: 8,
            border: badge.border || "none",
          }}
        >
          {badge.label}
        </span>
      )}
    </button>
  );
}

function GroupLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.15em",
        color: "#5B6570",
        padding: "16px 20px 8px",
      }}
    >
      {children}
    </div>
  );
}

export default function OwnerSidebar({ active, setActive, taskboxOpen = 0, pendingApprovals = 0 }) {
  const is = (k) => active === k;
  const taskboxBadge =
    pendingApprovals > 0
      ? { label: taskboxOpen, bg: "#FF5A5F", fg: "#fff" }
      : taskboxOpen > 0
        ? { label: taskboxOpen, bg: "rgba(255,255,255,0.08)", fg: "#8B98A5", border: "1px solid rgba(255,255,255,0.12)" }
        : null;

  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        background: "rgba(255,255,255,0.02)",
        borderRight: "1px solid rgba(255,255,255,0.10)",
        padding: "20px 0",
        overflowY: "auto",
        position: "relative",
        zIndex: 1,
      }}
    >
      <NavItem icon={L.Home}  label="Today"   active={is("today")}   onClick={() => setActive("today")} />
      <NavItem icon={L.Inbox} label="Taskbox" active={is("taskbox")} onClick={() => setActive("taskbox")} badge={taskboxBadge} />

      <GroupLabel>INTELLIGENCE</GroupLabel>
      <NavItem icon={L.Activity}  label="Overview"             active={is("overview")}   onClick={() => setActive("overview")} />
      <NavItem icon={L.Building2} label="Bank Accounts"        active={is("bank-accounts")} onClick={() => setActive("bank-accounts")} />
      <NavItem icon={L.FileText}  label="Financial Statements" active={is("financial-statements")} onClick={() => setActive("financial-statements")} />

      <GroupLabel>OPERATIONS</GroupLabel>
      <NavItem icon={L.Calendar} label="Month-End Close" active={is("month-end-close")} onClick={() => setActive("month-end-close")} />
      <NavItem icon={L.Shield}   label="Audit Bridge"    active={is("audit-bridge")}    onClick={() => setActive("audit-bridge")} />

      <GroupLabel>MANAGEMENT</GroupLabel>
      <NavItem icon={L.Users}    label="Team"     active={is("team")}    onClick={() => setActive("team")} />
      <NavItem icon={L.Settings} label="Settings" active={is("settings")} onClick={() => setActive("settings")} />
    </aside>
  );
}
