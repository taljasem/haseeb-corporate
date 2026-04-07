import { useEffect, useState } from "react";
import MonthlyInsights from "./sections/MonthlyInsights";
import FinancialHealthSection from "./sections/FinancialHealthSection";
import AminahNotes from "./sections/AminahNotes";
import AIInsights from "./sections/AIInsights";
import PendingApprovals from "./sections/PendingApprovals";
import BudgetPerformance from "./sections/BudgetPerformance";
import AuditReadiness from "./sections/AuditReadiness";
import CloseStatus from "./sections/CloseStatus";
import TaskboxSummaryCard from "./taskbox/TaskboxSummaryCard";

export default function IntelligenceStream() {
  const [wide, setWide] = useState(
    typeof window !== "undefined" ? window.innerWidth > 1400 : false
  );
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth > 1400);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        padding: "20px 24px",
        overflowY: "auto",
        borderRight: "1px solid rgba(255,255,255,0.10)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: wide ? "1fr 1fr" : "1fr",
          gap: 16,
        }}
      >
        <MonthlyInsights />
        <FinancialHealthSection />
        <PendingApprovals />
        <TaskboxSummaryCard
          role="Owner"
          onViewAll={() => {
            // Owner full Taskbox screen comes in the owner restructure step
            console.log("[owner] full taskbox coming in owner view restructure");
          }}
          onTaskClick={() => {
            console.log("[owner] task click — full taskbox coming in owner view restructure");
          }}
          wrapperStyle={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 8,
            padding: "16px 18px",
            marginBottom: 0,
          }}
        />
        <BudgetPerformance />
        <AminahNotes />
        <CloseStatus />
        <AuditReadiness />
        <AIInsights />
      </div>
    </div>
  );
}
