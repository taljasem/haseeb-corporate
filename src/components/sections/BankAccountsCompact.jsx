import { useEffect, useState } from "react";
import SectionCard from "./SectionCard";
import { getBankAccounts } from "../../engine/mockEngine";
import { formatMoney } from "../../utils/formatCurrency";

export default function BankAccountsCompact() {
  const [accounts, setAccounts] = useState(null);
  useEffect(() => {
    getBankAccounts().then(setAccounts);
  }, []);

  return (
    <SectionCard label="BANK ACCOUNTS" delay={0.18}>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 4 }}>
        {(accounts || []).map((a) => (
          <div
            key={a.id}
            onClick={() => console.log("[owner] bank account click — full screen in Step 4b", a.id)}
            onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 10px",
              margin: "0 -10px",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
              cursor: "pointer",
              borderRadius: 4,
              transition: "background 0.12s ease",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: a.accentColor,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  color: "#E6EDF3",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {a.accountName}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "#5B6570",
                  fontFamily: "'DM Mono', monospace",
                  marginTop: 2,
                }}
              >
                {a.accountNumberMasked}
              </div>
            </div>
            <div
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 13,
                color: "#E6EDF3",
                fontWeight: 500,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatMoney(a.currentBalance, a.currency)}
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <a
          onClick={() => console.log("[owner] full Bank Accounts screen comes in Step 4b")}
          style={{
            fontSize: 12,
            color: "#00C48C",
            cursor: "pointer",
            letterSpacing: "0.04em",
          }}
        >
          View all accounts →
        </a>
      </div>
    </SectionCard>
  );
}
