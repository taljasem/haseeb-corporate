import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import JuniorSidebar from "../../components/junior/JuniorSidebar";
import ErrorBoundary from "../../components/shared/ErrorBoundary";
import JuniorHeroBand from "../../components/junior/JuniorHeroBand";
import AminahSlideOver from "../../components/cfo/AminahSlideOver";
import JuniorTodayScreen from "./JuniorTodayScreen";
import MyResponsibilitiesScreen from "./MyResponsibilitiesScreen";
import TaskboxScreen from "../../components/taskbox/TaskboxScreen";
import BankAccountsScreen from "../shared/BankAccountsScreen";
import BankTransactionsScreen from "../cfo/BankTransactionsScreen";
import ConversationalJEScreen from "../cfo/ConversationalJEScreen";
import BudgetScreen from "../../components/budget/BudgetScreen";
import ReconciliationScreen from "../../components/reconciliation/ReconciliationScreen";
import NewTaskModal from "../../components/taskbox/NewTaskModal";
import SettingsScreen from "../shared/SettingsScreen";
import ProfileScreen from "../shared/ProfileScreen";
import { getSaraTaskStats } from "../../engine/mockEngine";
import { subscribeTaskbox } from "../../utils/taskboxBus";
// HASEEB-179 — filterByAssignee and juniorOnlyId now come from the
// authenticated user's id, not the seed Junior ("sara"). Downstream
// screens receive `null` pre-auth which they already handle as
// "unfiltered" (matches the pre-HASEEB-179 default when auth was
// unhydrated — the id was "sara" but mock mode's sara WAS the
// authenticated demo user in practice).
import { useAuth } from "../../contexts/AuthContext";

function Placeholder({ label, sub }) {
  const { t } = useTranslation("common");
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
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: 10,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 28,
            color: "var(--text-primary)",
            letterSpacing: "-0.3px",
            marginBottom: 8,
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 10 }}>
          {t("placeholder.coming_next")}
        </div>
        {sub && (
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontStyle: "italic", lineHeight: 1.55 }}>
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}

export default function JuniorView({ registerNav }) {
  const { t } = useTranslation("common");
  // HASEEB-179 — the Junior's own id drives "my view" filters.
  const { user: authUser } = useAuth();
  const juniorUserId = authUser?.id ?? null;
  const [activeScreen, setActiveScreen] = useState("today");
  const [aminahOpen, setAminahOpen] = useState(false);
  const [aminahContext, setAminahContext] = useState(null);
  const [taskStats, setTaskStats] = useState({ open: 0, overdue: 0, dueSoon: 0 });
  const [initialTaskId, setInitialTaskId] = useState(null);
  const [newTaskOpen, setNewTaskOpen] = useState(false);

  useEffect(() => {
    const reload = () => {
      getSaraTaskStats().then(setTaskStats);
    };
    reload();
    const unsub = subscribeTaskbox(reload);
    return unsub;
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
            filterByAssignee={juniorUserId}
            onOpenAminah={openAminah}
            onOpenBankAccounts={() => setActiveScreen("bank-accounts")}
          />
        );
      case "conversational-je":
        return <ConversationalJEScreen role="Junior" onNavigate={setActiveScreen} />;
      case "budget":
        return <BudgetScreen role="Junior" juniorOnlyId={juniorUserId} onOpenAminah={openAminah} />;
      case "reconciliation":
        return <ReconciliationScreen role="Junior" />;
      case "responsibilities":
        return <MyResponsibilitiesScreen onContactCFO={() => setNewTaskOpen(true)} />;
      case "bank-accounts":
        return <BankAccountsScreen role="Junior" readOnly />;
      case "profile":
        return <ProfileScreen role="Junior" />;
      case "settings":
        return <SettingsScreen role="Junior" />;
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
        <ErrorBoundary key={activeScreen}>{renderScreen()}</ErrorBoundary>
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
