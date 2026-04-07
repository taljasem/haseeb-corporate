import { useEffect, useState } from "react";
import MonthlyInsights from "../../components/sections/MonthlyInsights";
import FinancialHealthSection from "../../components/sections/FinancialHealthSection";
import AminahNotes from "../../components/sections/AminahNotes";
import AIInsights from "../../components/sections/AIInsights";
import PendingApprovals from "../../components/sections/PendingApprovals";
import BudgetPerformance from "../../components/sections/BudgetPerformance";
import AuditReadiness from "../../components/sections/AuditReadiness";
import CloseStatus from "../../components/sections/CloseStatus";
import BankAccountsCompact from "../../components/sections/BankAccountsCompact";

export default function OwnerOverviewScreen({ setActiveScreen }) {
  const [wide, setWide] = useState(
    typeof window !== "undefined" ? window.innerWidth > 1400 : false
  );
  useEffect(() => {
    const onResize = () => setWide(window.innerWidth > 1400);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px 32px" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ marginBottom: 18 }}>
          <div
            style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 28,
              color: "#E6EDF3",
              letterSpacing: "-0.3px",
              lineHeight: 1,
            }}
          >
            OVERVIEW
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.15em",
              color: "#5B6570",
              marginTop: 6,
            }}
          >
            AL MANARA TRADING · MARCH 2026
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: wide ? "1fr 1fr" : "1fr",
            gap: 16,
          }}
        >
          <BankAccountsCompact
            onViewAll={() => setActiveScreen && setActiveScreen("bank-accounts")}
            onAccountClick={() => setActiveScreen && setActiveScreen("bank-accounts")}
          />
          <MonthlyInsights />
          <FinancialHealthSection />
          <PendingApprovals onViewAll={() => setActiveScreen && setActiveScreen("approvals")} />
          <BudgetPerformance />
          <AminahNotes />
          <CloseStatus />
          <AuditReadiness />
          <AIInsights />
        </div>
      </div>
    </div>
  );
}
