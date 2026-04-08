import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useTenant } from "../../components/shared/TenantContext";
import LtrText from "../../components/shared/LtrText";
import MonthlyInsights from "../../components/sections/MonthlyInsights";
import FinancialHealthSection from "../../components/sections/FinancialHealthSection";
import AminahNotes from "../../components/sections/AminahNotes";
import AIInsights from "../../components/sections/AIInsights";
import PendingApprovals from "../../components/sections/PendingApprovals";
import BudgetPerformance from "../../components/sections/BudgetPerformance";
import AuditReadiness from "../../components/sections/AuditReadiness";
import CloseStatus from "../../components/sections/CloseStatus";
import BankAccountsCompact from "../../components/sections/BankAccountsCompact";

export default function OwnerOverviewScreen({ setActiveScreen, onOpenBankAccount }) {
  const { t } = useTranslation("owner-overview");
  const { tenant } = useTenant();
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
            {t("title")}
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
            <LtrText>{(tenant?.company?.name || "Al Manara Trading").toUpperCase()}</LtrText> · {t("period_march")}
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
            onAccountClick={(a) => onOpenBankAccount && onOpenBankAccount(a.id)}
          />
          <MonthlyInsights />
          <FinancialHealthSection />
          <PendingApprovals onViewAll={() => setActiveScreen && setActiveScreen("approvals")} />
          <BudgetPerformance onViewAll={() => setActiveScreen && setActiveScreen("budget")} />
          <AminahNotes />
          <CloseStatus />
          <AuditReadiness />
          <AIInsights />
        </div>
      </div>
    </div>
  );
}
