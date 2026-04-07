import { useEffect, useState } from "react";
import JuniorSidebar from "../../components/junior/JuniorSidebar";
import JuniorHeroBand from "../../components/junior/JuniorHeroBand";
import AminahSlideOver from "../../components/cfo/AminahSlideOver";
import JuniorTodayScreen from "./JuniorTodayScreen";
import MyResponsibilitiesScreen from "./MyResponsibilitiesScreen";
import TaskboxScreen from "../../components/taskbox/TaskboxScreen";
import BankAccountsScreen from "../shared/BankAccountsScreen";
import BankTransactionsScreen from "../cfo/BankTransactionsScreen";
import ConversationalJEScreen from "../cfo/ConversationalJEScreen";
import BudgetScreen from "../../components/budget/BudgetScreen";
import NewTaskModal from "../../components/taskbox/NewTaskModal";
import { getSaraTaskStats } from "../../engine/mockEngine";

function Placeholder({ label, sub }) {
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
        <div style={{ fontSize: 13, color: "#8B98A5", marginBottom: 10 }}>
          Coming next.
        </div>
        {sub && (
          <div style={{ fontSize: 12, color: "#5B6570", fontStyle: "italic", lineHeight: 1.55 }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

export default function JuniorView({ registerNav }) {
  const [activeScreen, setActiveScreen] = useState("today");
  const [aminahOpen, setAminahOpen] = useState(false);
  const [aminahContext, setAminahContext] = useState(null);
  const [taskStats, setTaskStats] = useState({ open: 0, overdue: 0, dueSoon: 0 });
  const [initialTaskId, setInitialTaskId] = useState(null);
  const [newTaskOpen, setNewTaskOpen] = useState(false);

  useEffect(() => {
    getSaraTaskStats().then(setTaskStats);
  }, [activeScreen]);

  useEffect(() => {
    if (activeScreen !== "taskbox") setInitialTaskId(null);
  }, [activeScreen]);

  useEffect(() => {
    if (registerNav) registerNav({ setActiveScreen, openTask: navigateToTask });
  }, [registerNav]);

  const openAminah = (context = null) => {
    setAminahContext(context);
    setAminahOpen(true);
  };
  const navigateToTask = (taskId) => {
    setInitialTaskId(taskId);
    setActiveScreen("taskbox");
  };

  const renderScreen = () => {
    switch (activeScreen) {
      case "today":
        return (
          <JuniorTodayScreen
            setActiveScreen={setActiveScreen}
            onOpenTask={navigateToTask}
          />
        );
      case "taskbox":
        return <TaskboxScreen role="Junior" initialTaskId={initialTaskId} />;
      case "bank-transactions":
        return (
          <BankTransactionsScreen
            role="Junior"
            filterByAssignee="sara"
            onOpenAminah={openAminah}
            onOpenBankAccounts={() => setActiveScreen("bank-accounts")}
          />
        );
      case "conversational-je":
        return <ConversationalJEScreen role="Junior" onNavigate={setActiveScreen} />;
      case "budget":
        return <BudgetScreen role="Junior" juniorOnlyId="sara" onOpenAminah={openAminah} />;
      case "reconciliation":
        return (
          <Placeholder
            label="RECONCILIATION"
            sub="Reconciliation workspace will appear here."
          />
        );
      case "responsibilities":
        return <MyResponsibilitiesScreen onContactCFO={() => setNewTaskOpen(true)} />;
      case "bank-accounts":
        return <BankAccountsScreen role="Junior" readOnly />;
      case "profile":
        return (
          <Placeholder
            label="PROFILE"
            sub="Your profile, notification preferences, and settings will appear here."
          />
        );
      default:
        return <Placeholder label={activeScreen.toUpperCase()} />;
    }
  };

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
      <JuniorSidebar active={activeScreen} setActive={setActiveScreen} taskStats={taskStats} />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          minWidth: 0,
        }}
      >
        <JuniorHeroBand onOpenAminah={() => openAminah()} />
        {renderScreen()}
      </div>
      <AminahSlideOver
        open={aminahOpen}
        onClose={() => {
          setAminahOpen(false);
          setAminahContext(null);
        }}
        context={aminahContext}
        role="Junior"
      />
      <NewTaskModal
        open={newTaskOpen}
        role="Junior"
        onClose={() => setNewTaskOpen(false)}
      />
    </div>
  );
}
