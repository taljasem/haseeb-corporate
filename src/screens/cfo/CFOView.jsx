import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import CFOSidebar from "../../components/cfo/CFOSidebar";
import CFOHeroBand from "../../components/cfo/CFOHeroBand";
import AminahSlideOver from "../../components/cfo/AminahSlideOver";
import TodayScreen from "./TodayScreen";
import BankTransactionsScreen from "./BankTransactionsScreen";
import ConversationalJEScreen from "./ConversationalJEScreen";
import PlaceholderScreen from "./PlaceholderScreen";
import TaskboxScreen from "../../components/taskbox/TaskboxScreen";
import RulesScreen from "./RulesScreen";
import BankAccountsScreen from "../shared/BankAccountsScreen";
import BudgetScreen from "../../components/budget/BudgetScreen";
import ReconciliationScreen from "../../components/reconciliation/ReconciliationScreen";
import ManualJEScreen from "./ManualJEScreen";
import NewTaskModal from "../../components/taskbox/NewTaskModal";
import { getOpenTaskCount, getOpenApprovalCount } from "../../engine/mockEngine";

export default function CFOView({ registerNav }) {
  const { t } = useTranslation("common");
  const [activeScreen, setActiveScreen] = useState("today");
  const [aminahOpen, setAminahOpen] = useState(false);
  const [aminahContext, setAminahContext] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [taskboxOpen, setTaskboxOpen] = useState(0);
  const [initialTaskId, setInitialTaskId] = useState(null);
  const [initialTaskboxFilter, setInitialTaskboxFilter] = useState(null);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTaskPrefill, setNewTaskPrefill] = useState(null);

  const openNewTask = (prefill = null) => {
    setNewTaskPrefill(prefill);
    setNewTaskOpen(true);
  };

  useEffect(() => {
    getOpenApprovalCount("CFO").then(setPendingApprovals);
    getOpenTaskCount("CFO").then(setTaskboxOpen);
  }, [activeScreen]);

  const openAminah = (context = null) => {
    setAminahContext(context);
    setAminahOpen(true);
  };

  const navigateToTask = (taskId) => {
    setInitialTaskId(taskId);
    setActiveScreen("taskbox");
  };

  // Wrap setActiveScreen to intercept "approvals" → taskbox with approvals filter
  const setActive = (key) => {
    if (key === "approvals") {
      setInitialTaskboxFilter("approvals");
      setActiveScreen("taskbox");
      return;
    }
    setInitialTaskboxFilter(null);
    setActiveScreen(key);
  };

  const renderScreen = () => {
    switch (activeScreen) {
      case "today":
        return (
          <TodayScreen
            setActiveScreen={setActive}
            onOpenTask={navigateToTask}
            onCreateTask={openNewTask}
          />
        );
      case "bank-transactions":
        return (
          <BankTransactionsScreen
            onOpenAminah={openAminah}
            onOpenBankAccounts={() => setActive("bank-accounts")}
          />
        );
      case "conversational-je":
        return <ConversationalJEScreen />;
      case "rules":
        return <RulesScreen />;
      case "budget":
        return <BudgetScreen role="CFO" onOpenAminah={openAminah} />;
      case "bank-accounts":
        return <BankAccountsScreen role="CFO" />;
      case "reconciliation":
        return <ReconciliationScreen role="CFO" />;
      case "manual-je":
        return <ManualJEScreen onOpenAminah={openAminah} />;
      case "taskbox":
        return (
          <TaskboxScreen
            role="CFO"
            initialTaskId={initialTaskId}
            initialFilter={initialTaskboxFilter}
          />
        );
      default:
        return <PlaceholderScreen title={t(`placeholder.screens.${activeScreen}`, { defaultValue: activeScreen.toUpperCase() })} />;
    }
  };

  // Reset initialTaskId after switching away
  useEffect(() => {
    if (activeScreen !== "taskbox") setInitialTaskId(null);
  }, [activeScreen]);

  useEffect(() => {
    if (registerNav) registerNav({ setActiveScreen: setActive, openTask: navigateToTask });
  }, [registerNav]);

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
      <CFOSidebar
        active={activeScreen === "taskbox" && initialTaskboxFilter === "approvals" ? "approvals" : activeScreen}
        setActive={setActive}
        pendingApprovals={pendingApprovals}
        taskboxOpen={taskboxOpen}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <CFOHeroBand onOpenAminah={() => openAminah()} />
        {renderScreen()}
      </div>
      <AminahSlideOver
        open={aminahOpen}
        onClose={() => {
          setAminahOpen(false);
          setAminahContext(null);
        }}
        context={aminahContext}
        role="CFO"
      />
      <NewTaskModal
        open={newTaskOpen}
        role="CFO"
        onClose={() => { setNewTaskOpen(false); setNewTaskPrefill(null); }}
        prefilledLinkedItem={newTaskPrefill?.linkedItem}
      />
    </div>
  );
}
