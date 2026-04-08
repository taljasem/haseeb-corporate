import * as L from "lucide-react";
import { useTranslation } from "react-i18next";
import SidebarGroup from "../shared/SidebarGroup";
import LtrText from "../shared/LtrText";

function NavItem({ icon: Icon, label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      data-nav-active={active ? "true" : undefined}
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


export default function JuniorSidebar({ active, setActive, taskStats = { open: 0, overdue: 0 } }) {
  const { t } = useTranslation("sidebar");
  const is = (k) => active === k;
  const taskboxBadge =
    taskStats.overdue > 0
      ? { label: <LtrText>{taskStats.open}</LtrText>, bg: "#FF5A5F", fg: "#fff" }
      : taskStats.open > 0
        ? { label: <LtrText>{taskStats.open}</LtrText>, bg: "rgba(255,255,255,0.08)", fg: "#8B98A5", border: "1px solid rgba(255,255,255,0.12)" }
        : null;
  return (
    <aside
      style={{
        width: 220,
        flexShrink: 0,
        background: "rgba(255,255,255,0.02)",
        borderInlineEnd: "1px solid rgba(255,255,255,0.10)",
        padding: "20px 0",
        overflowY: "auto",
        position: "relative",
        zIndex: 1,
      }}
    >
      <NavItem icon={L.Home}  label={t("items.today")}   active={is("today")}   onClick={() => setActive("today")} />
      <NavItem icon={L.Inbox} label={t("items.taskbox")} active={is("taskbox")} onClick={() => setActive("taskbox")} badge={taskboxBadge} />

      <SidebarGroup label={t("groups.my_work")}>
        <NavItem icon={L.Landmark}       label={t("items.bank_transactions")} active={is("bank-transactions")} onClick={() => setActive("bank-transactions")} />
        <NavItem icon={L.MessageSquare}  label={t("items.conversational_je")} active={is("conversational-je")} onClick={() => setActive("conversational-je")} />
        <NavItem icon={L.BarChart3}      label={t("items.budget")}            active={is("budget")}            onClick={() => setActive("budget")} />
        <NavItem icon={L.CheckCircle}    label={t("items.reconciliation")}    active={is("reconciliation")}    onClick={() => setActive("reconciliation")} />
      </SidebarGroup>

      <SidebarGroup label={t("groups.reference")}>
        <NavItem icon={L.ListChecks} label={t("items.my_responsibilities")} active={is("responsibilities")} onClick={() => setActive("responsibilities")} />
        <NavItem icon={L.Building2}  label={t("items.bank_accounts")}       active={is("bank-accounts")}    onClick={() => setActive("bank-accounts")} />
      </SidebarGroup>

      <SidebarGroup label={t("groups.personal")}>
        <NavItem icon={L.User} label={t("items.profile")} active={is("profile")} onClick={() => setActive("profile")} />
      </SidebarGroup>
    </aside>
  );
}
