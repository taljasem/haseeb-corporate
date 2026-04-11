import { Home, Inbox, Landmark, MessageSquare, BarChart3, CheckCircle, ListChecks, Building2, User, Settings } from "lucide-react";
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


export default function JuniorSidebar({ active, setActive, taskStats = { open: 0, overdue: 0 } }) {
  const { t } = useTranslation("sidebar");
  const is = (k) => active === k;
  const taskboxBadge =
    taskStats.overdue > 0
      ? { label: <LtrText>{taskStats.open}</LtrText>, bg: "var(--semantic-danger)", fg: "#fff" }
      : taskStats.open > 0
        ? { label: <LtrText>{taskStats.open}</LtrText>, bg: "var(--border-default)", fg: "var(--text-secondary)", border: "1px solid var(--border-default)" }
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

      <SidebarGroup label={t("groups.my_work")}>
        <NavItem icon={Landmark}       label={t("items.bank_transactions")} active={is("bank-transactions")} onClick={() => setActive("bank-transactions")} />
        <NavItem icon={MessageSquare}  label={t("items.conversational_je")} active={is("conversational-je")} onClick={() => setActive("conversational-je")} />
        <NavItem icon={BarChart3}      label={t("items.budget")}            active={is("budget")}            onClick={() => setActive("budget")} />
        <NavItem icon={CheckCircle}    label={t("items.reconciliation")}    active={is("reconciliation")}    onClick={() => setActive("reconciliation")} />
      </SidebarGroup>

      <SidebarGroup label={t("groups.reference")}>
        <NavItem icon={ListChecks} label={t("items.my_responsibilities")} active={is("responsibilities")} onClick={() => setActive("responsibilities")} />
        <NavItem icon={Building2}  label={t("items.bank_accounts")}       active={is("bank-accounts")}    onClick={() => setActive("bank-accounts")} />
      </SidebarGroup>

      <SidebarGroup label={t("groups.personal")}>
        <NavItem icon={User}     label={t("items.profile")}  active={is("profile")}  onClick={() => setActive("profile")} />
        <NavItem icon={Settings} label={t("items.settings")} active={is("settings")} onClick={() => setActive("settings")} />
      </SidebarGroup>
    </aside>
  );
}
