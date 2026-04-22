import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import OwnerSidebar from "../../components/owner/OwnerSidebar";
import ErrorBoundary from "../../components/shared/ErrorBoundary";
import OwnerHeroBand from "../../components/owner/OwnerHeroBand";
import AminahSlideOver from "../../components/cfo/AminahSlideOver";
import OwnerTodayScreen from "./OwnerTodayScreen";
import OwnerOverviewScreen from "./OwnerOverviewScreen";
import FinancialStatementsScreen from "../shared/FinancialStatementsScreen";
import MonthEndCloseScreen from "../shared/MonthEndCloseScreen";
import AuditBridgeScreen from "./AuditBridgeScreen";
import TeamScreen from "./TeamScreen";
import BankAccountsScreen from "../shared/BankAccountsScreen";
import BudgetScreen from "../../components/budget/BudgetScreen";
import TaskboxScreen from "../../components/taskbox/TaskboxScreen";
import SettingsScreen from "../shared/SettingsScreen";
import AdministrationScreen from "../shared/AdministrationScreen";
import ProfileScreen from "../shared/ProfileScreen";
import ContactsScreen from "../shared/ContactsScreen";
import MigrationWizardScreen from "../cfo/MigrationWizardScreen";
import PayrollScreen from "../cfo/PayrollScreen";
import PaymentVoucherScreen from "../cfo/PaymentVoucherScreen";
import PIFSSReconciliationScreen from "../cfo/PIFSSReconciliationScreen";
import CITAssessmentScreen from "../cfo/CITAssessmentScreen";
import YearEndCloseScreen from "../cfo/YearEndCloseScreen";
import { getOpenTaskCount, getOpenApprovalCount } from "../../engine/mockEngine";
import { subscribeTaskbox } from "../../utils/taskboxBus";

function Placeholder({ label }) {
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
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{t("placeholder.coming_next")}</div>
      </div>
    </div>
  );
}

export default function OwnerView({ registerNav }) {
  const { t: tc } = useTranslation("common");
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
    const reload = () => {
      getOpenTaskCount("Owner").then(setTaskboxOpen);
      getOpenApprovalCount("Owner").then(setPendingApprovals);
    };
    reload();
    // Refresh counts whenever any taskbox mutation happens anywhere in the
    // app, not just on screen change.
    const unsub = subscribeTaskbox(reload);
    return unsub;
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
        return <FinancialStatementsScreen role="Owner" onOpenAminah={openAminah} />;
      case "month-end-close":
        return <MonthEndCloseScreen role="Owner" onNavigate={setActive} onOpenAminah={openAminah} />;
      case "audit-bridge":
        return <AuditBridgeScreen />;
      case "team":
        return <TeamScreen />;
      case "budget":
        return <BudgetScreen role="Owner" onOpenAminah={openAminah} />;
      case "settings":
        return <SettingsScreen role="Owner" />;
      case "administration":
        return <AdministrationScreen role="Owner" />;
      case "profile":
        return <ProfileScreen role="Owner" />;
      case "contacts":
        return <ContactsScreen role="Owner" />;
      case "migration":
        return <MigrationWizardScreen role="Owner" />;
      case "payroll":
        return <PayrollScreen role="Owner" />;
      case "payment-voucher":
        return <PaymentVoucherScreen role="Owner" />;
      case "pifss-reconciliation":
        return <PIFSSReconciliationScreen role="Owner" />;
      case "cit-assessment":
        return <CITAssessmentScreen role="Owner" />;
      case "year-end-close":
        return <YearEndCloseScreen role="Owner" />;
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
        <ErrorBoundary key={activeScreen}>{renderScreen()}</ErrorBoundary>
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
