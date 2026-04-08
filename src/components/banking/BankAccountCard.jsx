import { useTranslation } from "react-i18next";
import { formatMoney } from "../../utils/formatCurrency";
import { formatRelativeTime } from "../../utils/relativeTime";
import BankChip from "./BankChip";
import { useTenant } from "../shared/TenantContext";
import LtrText from "../shared/LtrText";

export default function BankAccountCard({ account, selected = false, onSelect }) {
  const { t } = useTranslation("bank-accounts");
  const { tenant } = useTenant();
  if (!account) return null;
  const bank = tenant.banks[0] || {};
  const showBankBranding = tenant.features?.showBankBranding !== false;
  const bankAbbr = bank.abbreviation || account.bankName;

  return (
    <div
      onClick={() => onSelect && onSelect(account)}
      onMouseEnter={(e) => {
        if (!selected) e.currentTarget.style.background = "rgba(255,255,255,0.06)";
      }}
      onMouseLeave={(e) => {
        if (!selected) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
      }}
      style={{
        flex: "1 1 260px",
        minWidth: 260,
        padding: 20,
        background: "rgba(255,255,255,0.04)",
        border: selected ? "1px solid #00C48C" : "1px solid rgba(255,255,255,0.10)",
        borderInlineStart: `3px solid ${account.accentColor}`,
        borderRadius: 10,
        cursor: "pointer",
        boxShadow: selected ? "0 0 24px rgba(0,196,140,0.15)" : "none",
        transition: "all 0.15s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <BankChip
          abbreviation={bankAbbr}
          brandColor={bank.brandColor || account.accentColor}
          show={showBankBranding}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              color: "#E6EDF3",
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {account.accountName}
          </div>
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              color: "#5B6570",
              marginTop: 2,
            }}
          >
            <LtrText>{account.accountNumberMasked}</LtrText>
          </div>
        </div>
      </div>

      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 24,
          color: "#E6EDF3",
          fontWeight: 500,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.1,
        }}
      >
        {formatMoney(account.currentBalance, account.currency)}
      </div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: "0.15em",
          color: "#5B6570",
          marginTop: 3,
        }}
      >
        {t("card.current_balance")}
      </div>

      <div
        style={{
          display: "flex",
          gap: 16,
          marginTop: 14,
          paddingTop: 12,
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.12em", color: "#5B6570" }}>
            {t("card.mtd_inflow")}
          </div>
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 12,
              color: "#00C48C",
              marginTop: 2,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            +{Number(account.mtdInflow).toLocaleString("en-US", { minimumFractionDigits: account.currency === "USD" ? 2 : 3, maximumFractionDigits: account.currency === "USD" ? 2 : 3 })}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.12em", color: "#5B6570" }}>
            {t("card.mtd_outflow")}
          </div>
          <div
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 12,
              color: "#FF5A5F",
              opacity: 0.85,
              marginTop: 2,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            -{Number(account.mtdOutflow).toLocaleString("en-US", { minimumFractionDigits: account.currency === "USD" ? 2 : 3, maximumFractionDigits: account.currency === "USD" ? 2 : 3 })}
          </div>
        </div>
      </div>

      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 10,
          color: "#5B6570",
          marginTop: 10,
        }}
      >
        {t("updated", { time: formatRelativeTime(account.lastUpdated) })}
      </div>
    </div>
  );
}
