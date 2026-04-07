import { useEffect, useState } from "react";
import CFOSidebar from "../../components/cfo/CFOSidebar";
import CFOHeroBand from "../../components/cfo/CFOHeroBand";
import AminahSlideOver from "../../components/cfo/AminahSlideOver";
import TodayScreen from "./TodayScreen";
import BankTransactionsScreen from "./BankTransactionsScreen";
import ConversationalJEScreen from "./ConversationalJEScreen";
import PlaceholderScreen from "./PlaceholderScreen";
import { getCFOTodayQueue } from "../../engine/mockEngine";

const SCREEN_TITLES = {
  approvals:             "APPROVALS",
  "manual-je":           "MANUAL JOURNAL ENTRY",
  reconciliation:        "RECONCILIATION",
  "financial-statements": "FINANCIAL STATEMENTS",
  "aging-reports":       "AGING REPORTS",
  "variance-analysis":   "VARIANCE ANALYSIS",
  "month-end-close":     "MONTH-END CLOSE",
  "audit-bridge":        "AUDIT BRIDGE",
  setup:                 "SETUP",
};

export default function CFOView() {
  const [activeScreen, setActiveScreen] = useState("today");
  const [aminahOpen, setAminahOpen] = useState(false);
  const [aminahContext, setAminahContext] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState(0);

  useEffect(() => {
    getCFOTodayQueue().then((q) => setPendingApprovals(q.pendingApprovals));
  }, []);

  const openAminah = (context = null) => {
    setAminahContext(context);
    setAminahOpen(true);
  };

  const renderScreen = () => {
    switch (activeScreen) {
      case "today":
        return <TodayScreen setActiveScreen={setActiveScreen} />;
      case "bank-transactions":
        return <BankTransactionsScreen onOpenAminah={openAminah} />;
      case "conversational-je":
        return <ConversationalJEScreen />;
      default:
        return <PlaceholderScreen title={SCREEN_TITLES[activeScreen] || activeScreen.toUpperCase()} />;
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
      <CFOSidebar
        active={activeScreen}
        setActive={setActiveScreen}
        pendingApprovals={pendingApprovals}
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
      />
    </div>
  );
}
