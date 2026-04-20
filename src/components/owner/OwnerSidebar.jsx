import { Home, Inbox, Activity, Building2, FileText, BarChart3, Calendar, Shield, Users, Settings, User, Upload } from "lucide-react";
import { useTranslation } from "react-i18next";
import SidebarGroup from "../shared/SidebarGroup";
import LtrText from "../shared/LtrText";

function NavItem({ icon: Icon, label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      data-nav-active={active ? "true" : undefined}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "var(--bg-surface-sunken)";
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
        background: active ? "var(--bg-surface-sunken)" : "transparent",
        border: "none",
        cursor: "pointer",
        color: active ? "var(--text-primary)" : "var(--text-tertiary)",
        fontFamily: "inherit",
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.05em",
        textAlign: "start",
        boxShadow: active ? "inset 2px 0 0 #00C48C" : "none",
        transition: "all 0.12s ease",
      }}
    >
      <Icon size={16} strokeWidth={2} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge && (
        <span
          style={{
            background: badge.bg || "var(--semantic-danger)",
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


export default function OwnerSidebar({ active, setActive, taskboxOpen = 0, pendingApprovals = 0 }) {
  const { t } = useTranslation("sidebar");
  const is = (k) => active === k;
  const taskboxBadge =
    pendingApprovals > 0
      ? { label: <LtrText>{taskboxOpen}</LtrText>, bg: "var(--semantic-danger)", fg: "#fff" }
      : taskboxOpen > 0
        ? { label: <LtrText>{taskboxOpen}</LtrText>, bg: "var(--border-default)", fg: "var(--text-secondary)", border: "1px solid var(--border-default)" }
        : null;

  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        background: "var(--bg-surface)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderInlineEnd: "1px solid var(--border-default)",
        padding: "20px 0",
        overflowY: "auto",
        position: "relative",
        zIndex: 1,
      }}
    >
      <NavItem icon={Home}  label={t("items.today")}   active={is("today")}   onClick={() => setActive("today")} />
      <NavItem icon={Inbox} label={t("items.taskbox")} active={is("taskbox")} onClick={() => setActive("taskbox")} badge={taskboxBadge} />

      <SidebarGroup label={t("groups.intelligence")}>
        <NavItem icon={Activity}  label={t("items.overview")}             active={is("overview")}   onClick={() => setActive("overview")} />
        <NavItem icon={Building2} label={t("items.bank_accounts")}        active={is("bank-accounts")} onClick={() => setActive("bank-accounts")} />
        <NavItem icon={FileText}  label={t("items.financial_statements")} active={is("financial-statements")} onClick={() => setActive("financial-statements")} />
      </SidebarGroup>

      <SidebarGroup label={t("groups.planning")}>
        <NavItem icon={BarChart3} label={t("items.budget")} active={is("budget")} onClick={() => setActive("budget")} />
      </SidebarGroup>

      <SidebarGroup label={t("groups.operations")}>
        <NavItem icon={Calendar} label={t("items.month_end_close")} active={is("month-end-close")} onClick={() => setActive("month-end-close")} />
        <NavItem icon={Shield}   label={t("items.audit_bridge")}    active={is("audit-bridge")}    onClick={() => setActive("audit-bridge")} />
        <NavItem icon={Upload}   label={t("items.migration")}       active={is("migration")}       onClick={() => setActive("migration")} />
      </SidebarGroup>

      <SidebarGroup label={t("groups.management")}>
        <NavItem icon={Users}    label={t("items.team")}          active={is("team")}          onClick={() => setActive("team")} />
        <NavItem icon={User}     label={t("items.profile")}       active={is("profile")}       onClick={() => setActive("profile")} />
        <NavItem icon={Settings} label={t("items.settings")}      active={is("settings")}      onClick={() => setActive("settings")} />
        <NavItem icon={Shield}   label={t("items.administration")} active={is("administration")} onClick={() => setActive("administration")} />
      </SidebarGroup>
    </aside>
  );
}
