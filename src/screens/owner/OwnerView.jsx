import { useEffect, useState } from "react";
import OwnerSidebar from "../../components/owner/OwnerSidebar";
import OwnerHeroBand from "../../components/owner/OwnerHeroBand";
import AminahSlideOver from "../../components/cfo/AminahSlideOver";
import OwnerTodayScreen from "./OwnerTodayScreen";
import OwnerOverviewScreen from "./OwnerOverviewScreen";
import FinancialStatementsScreen from "./FinancialStatementsScreen";
import MonthEndCloseScreen from "./MonthEndCloseScreen";
import AuditBridgeScreen from "./AuditBridgeScreen";
import TeamScreen from "./TeamScreen";
import BankAccountsScreen from "../shared/BankAccountsScreen";
import BudgetScreen from "../../components/budget/BudgetScreen";
import TaskboxScreen from "../../components/taskbox/TaskboxScreen";
import { getOpenTaskCount, getOpenApprovalCount } from "../../engine/mockEngine";

function Placeholder({ label }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          maxWidth: 480,
          padding: "32px 36px",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.10)",
          borderRadius: 10,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 28,
            color: "#E6EDF3",
            letterSpacing: "-0.3px",
            marginBottom: 8,
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: 13, color: "#8B98A5" }}>Coming next.</div>
      </div>
    </div>
  );
}

export default function OwnerView({ registerNav }) {
  const [activeScreen, setActiveScreen] = useState("today");
  const [aminahOpen, setAminahOpen] = useState(false);
  const [aminahContext, setAminahContext] = useState(null);
  const [taskboxOpen, setTaskboxOpen] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [initialTaskId, setInitialTaskId] = useState(null);
  const [initialTaskboxFilter, setInitialTaskboxFilter] = useState(null);
  const [initialAccountId, setInitialAccountId] = useState(null);

  const navigateToBankAccount = (accountId) => {
    setInitialAccountId(accountId);
    setActiveScreen("bank-accounts");
  };

  useEffect(() => {
    getOpenTaskCount("Owner").then(setTaskboxOpen);
    getOpenApprovalCount("Owner").then(setPendingApprovals);
  }, [activeScreen]);

  const openAminah = (context = null) => {
    setAminahContext(context);
    setAminahOpen(true);
  };

  // Intercept "approvals" → taskbox with approvals filter
  const setActive = (key) => {
    if (key === "approvals") {
      setInitialTaskboxFilter("approvals");
      setActiveScreen("taskbox");
      return;
    }
    setInitialTaskboxFilter(null);
    setActiveScreen(key);
  };

  const navigateToTask = (taskId) => {
    setInitialTaskId(taskId);
    setActiveScreen("taskbox");
  };

  useEffect(() => {
    if (activeScreen !== "taskbox") setInitialTaskId(null);
    if (activeScreen !== "bank-accounts") setInitialAccountId(null);
  }, [activeScreen]);

  useEffect(() => {
    if (registerNav) registerNav({ setActiveScreen: setActive, openTask: navigateToTask });
  }, [registerNav]);

  const renderScreen = () => {
    switch (activeScreen) {
      case "today":
        return (
          <OwnerTodayScreen
            setActiveScreen={setActive}
            onOpenTask={navigateToTask}
            onOpenAminah={openAminah}
          />
        );
      case "taskbox":
        return (
          <TaskboxScreen
            role="Owner"
            initialTaskId={initialTaskId}
            initialFilter={initialTaskboxFilter}
          />
        );
      case "overview":
        return (
          <OwnerOverviewScreen
            setActiveScreen={setActive}
            onOpenBankAccount={navigateToBankAccount}
          />
        );
      case "bank-accounts":
        return <BankAccountsScreen role="Owner" initialAccountId={initialAccountId} />;
      case "financial-statements":
        return <FinancialStatementsScreen onOpenAminah={openAminah} />;
      case "month-end-close":
        return <MonthEndCloseScreen onNavigate={setActive} />;
      case "audit-bridge":
        return <AuditBridgeScreen />;
      case "team":
        return <TeamScreen />;
      case "budget":
        return <BudgetScreen role="Owner" onOpenAminah={openAminah} />;
      case "settings":
        return <Placeholder label="SETTINGS" />;
      default:
        return <Placeholder label={activeScreen.toUpperCase()} />;
    }
  };

  // Sidebar active highlight when taskbox is open via approvals intercept
  const sidebarActive =
    activeScreen === "taskbox" && initialTaskboxFilter === "approvals"
      ? "approvals"
      : activeScreen;

  return (
    <div
      className="view-enter"
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "row",
        position: "relative",
        zIndex: 1,
        overflow: "hidden",
      }}
    >
      <OwnerSidebar
        active={sidebarActive}
        setActive={setActive}
        taskboxOpen={taskboxOpen}
        pendingApprovals={pendingApprovals}
      />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        <OwnerHeroBand onOpenAminah={() => openAminah()} />
        {renderScreen()}
      </div>
      <AminahSlideOver
        open={aminahOpen}
        onClose={() => {
          setAminahOpen(false);
          setAminahContext(null);
        }}
        context={aminahContext}
        role="Owner"
      />
    </div>
  );
}
