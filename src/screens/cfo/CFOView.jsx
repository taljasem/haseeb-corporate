import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import CFOSidebar from "../../components/cfo/CFOSidebar";
import ErrorBoundary from "../../components/shared/ErrorBoundary";
import CFOHeroBand from "../../components/cfo/CFOHeroBand";
import AminahSlideOver from "../../components/cfo/AminahSlideOver";
import TodayScreen from "./TodayScreen";
import BankTransactionsScreen from "./BankTransactionsScreen";
import ConversationalJEScreen from "./ConversationalJEScreen";
import TaskboxScreen from "../../components/taskbox/TaskboxScreen";
import RulesScreen from "./RulesScreen";
import BankAccountsScreen from "../shared/BankAccountsScreen";
import BudgetScreen from "../../components/budget/BudgetScreen";
import ReconciliationScreen from "../../components/reconciliation/ReconciliationScreen";
import ManualJEScreen from "./ManualJEScreen";
import NewTaskModal from "../../components/taskbox/NewTaskModal";
import SettingsScreen from "../shared/SettingsScreen";
import AdministrationScreen from "../shared/AdministrationScreen";
import ProfileScreen from "../shared/ProfileScreen";
import FinancialStatementsScreen from "../shared/FinancialStatementsScreen";
import MonthEndCloseScreen from "../shared/MonthEndCloseScreen";
import ForecastScreen from "./ForecastScreen";
import VarianceAnalysisScreen from "./VarianceAnalysisScreen";
import AgingReportsScreen from "./AgingReportsScreen";
import SetupScreen from "./SetupScreen";
import ContactsScreen from "../shared/ContactsScreen";
import AuditBridgeScreen from "../owner/AuditBridgeScreen";
import PettyCashScreen from "./PettyCashScreen";
import BulkReclassScreen from "./BulkReclassScreen";
import OcrReviewScreen from "./OcrReviewScreen";
import InventoryCountScreen from "./InventoryCountScreen";
import SpinoffScreen from "./SpinoffScreen";
import IslamicFinanceScreen from "./IslamicFinanceScreen";
import PurchaseOrdersScreen from "./PurchaseOrdersScreen";
import InventoryNrvScreen from "./InventoryNrvScreen";
import MigrationWizardScreen from "./MigrationWizardScreen";
import { getOpenTaskCount, getOpenApprovalCount } from "../../engine/mockEngine";
import { subscribeTaskbox } from "../../utils/taskboxBus";

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
  const [forecastHighlight, setForecastHighlight] = useState(null);

  const openNewTask = (prefill = null) => {
    setNewTaskPrefill(prefill);
    setNewTaskOpen(true);
  };

  useEffect(() => {
    const reload = () => {
      getOpenApprovalCount("CFO").then(setPendingApprovals);
      getOpenTaskCount("CFO").then(setTaskboxOpen);
    };
    reload();
    const unsub = subscribeTaskbox(reload);
    return unsub;
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
        return <BudgetScreen role="CFO" onOpenAminah={openAminah} onViewInForecast={(code) => { setForecastHighlight(code); setActiveScreen("forecast"); }} />;
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
      case "settings":
        return <SettingsScreen role="CFO" />;
      case "administration":
        return <AdministrationScreen role="CFO" />;
      case "profile":
        return <ProfileScreen role="CFO" />;
      case "financial-statements":
        return <FinancialStatementsScreen role="CFO" onOpenAminah={openAminah} />;
      case "month-end-close":
        return <MonthEndCloseScreen role="CFO" onNavigate={setActive} onOpenAminah={openAminah} />;
      case "forecast":
        return <ForecastScreen onOpenAminah={openAminah} highlightCode={forecastHighlight} onHighlightConsumed={() => setForecastHighlight(null)} />;
      case "variance-analysis":
        return <VarianceAnalysisScreen onOpenAminah={openAminah} />;
      case "aging-reports":
        return <AgingReportsScreen onOpenAminah={openAminah} />;
      case "setup":
        return <SetupScreen role="CFO" />;
      case "contacts":
        return <ContactsScreen role="CFO" />;
      case "audit-bridge":
        return <AuditBridgeScreen onOpenAminah={openAminah} />;
      case "petty-cash":
        return <PettyCashScreen role="CFO" />;
      case "bulk-reclass":
        return <BulkReclassScreen role="CFO" />;
      case "ocr-review":
        return <OcrReviewScreen role="CFO" />;
      case "inventory-count":
        return <InventoryCountScreen role="CFO" />;
      case "spinoff":
        return <SpinoffScreen role="CFO" />;
      case "islamic-finance":
        return <IslamicFinanceScreen role="CFO" />;
      case "purchase-orders":
        return <PurchaseOrdersScreen role="CFO" />;
      case "inventory-nrv":
        return <InventoryNrvScreen role="CFO" />;
      case "migration":
        return <MigrationWizardScreen role="CFO" />;
      default:
        return (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
            {activeScreen}
          </div>
        );
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
        <ErrorBoundary key={activeScreen}>{renderScreen()}</ErrorBoundary>
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
