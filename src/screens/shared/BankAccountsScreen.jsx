import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import LtrText from "../../components/shared/LtrText";
import {
  getBankAccounts,
  getBankStatement,
  getBankAccountSummary,
} from "../../engine/mockEngine";
import BankAccountCard from "../../components/banking/BankAccountCard";
import BankAccountSummaryStrip from "../../components/banking/BankAccountSummaryStrip";
import BankStatementTable from "../../components/banking/BankStatementTable";
import FutureBankOperationsCard from "../../components/banking/FutureBankOperationsCard";
import { formatRelativeTime } from "../../utils/relativeTime";
import { useTenant } from "../../components/shared/TenantContext";

const RANGES = [
  { id: "today", key: "today" },
  { id: "week",  key: "week" },
  { id: "month", key: "month" },
  { id: "all",   key: "all" },
];
const TYPE_FILTERS = [
  { id: "All", key: "all" },
  { id: "Inflow", key: "inflow" },
  { id: "Outflow", key: "outflow" },
];

export default function BankAccountsScreen({ role = "CFO", readOnly = false, initialAccountId = null }) {
  const { t } = useTranslation("bank-accounts");
  const { tenant } = useTenant();
  const showFutureOps = tenant.features?.showFutureBankOperations !== false;
  const [accounts, setAccounts] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [range, setRange] = useState("month");
  const [typeFilter, setTypeFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [txs, setTxs] = useState(null);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    getBankAccounts().then((accs) => {
      setAccounts(accs);
      if (accs.length > 0) {
        const initial = initialAccountId && accs.find((a) => a.id === initialAccountId);
        setSelectedId(initial ? initial.id : accs[0].id);
      }
    });
  }, [initialAccountId]);

  useEffect(() => {
    if (!selectedId) return;
    setTxs(null);
    setSummary(null);
    getBankStatement(selectedId, range).then(setTxs);
    getBankAccountSummary(selectedId).then(setSummary);
  }, [selectedId, range]);

  const selected = accounts ? accounts.find((a) => a.id === selectedId) : null;

  const filteredTxs = (txs || []).filter((t) => {
    if (typeFilter === "Inflow" && t.amount <= 0) return false;
    if (typeFilter === "Outflow" && t.amount >= 0) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      return (
        t.description.toLowerCase().includes(q) ||
        (t.reference || "").toLowerCase().includes(q) ||
        (t.categorization?.category || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px 32px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        {readOnly && (
          <div
            style={{
              fontSize: 11,
              color: "#5B6570",
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderInlineStart: "2px solid #5B6570",
              borderRadius: 6,
              padding: "10px 14px",
              marginBottom: 16,
              fontStyle: "italic",
            }}
          >
            {t("read_only_banner")}
          </div>
        )}
        {/* Header */}
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
            {accounts ? t("accounts_count", { count: accounts.length }) : t("loading")}
          </div>
        </div>

        {/* Account cards row */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            marginBottom: 22,
          }}
        >
          {(accounts || []).map((a) => (
            <BankAccountCard
              key={a.id}
              account={a}
              selected={a.id === selectedId}
              onSelect={(x) => setSelectedId(x.id)}
            />
          ))}
        </div>

        {/* Selected account detail */}
        {selected && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: "'Bebas Neue', sans-serif",
                    fontSize: 20,
                    color: "#E6EDF3",
                    letterSpacing: "-0.2px",
                    lineHeight: 1,
                  }}
                >
                  {selected.accountName}
                </div>
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 11,
                    color: "#5B6570",
                    marginTop: 4,
                  }}
                >
                  <LtrText>{selected.accountNumberMasked}</LtrText>
                </div>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "#5B6570",
                }}
              >
                {t("last_updated", { time: formatRelativeTime(selected.lastUpdated) })}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <BankAccountSummaryStrip summary={summary} currency={selected.currency} />
            </div>

            {/* Filter row */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 6,
              }}
            >
              <div style={{ display: "flex", gap: 4 }}>
                {RANGES.map((r) => {
                  const on = range === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => setRange(r.id)}
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: "6px 12px",
                        borderRadius: 14,
                        background: on ? "rgba(0,196,140,0.10)" : "rgba(255,255,255,0.02)",
                        border: on ? "1px solid rgba(0,196,140,0.30)" : "1px solid rgba(255,255,255,0.10)",
                        color: on ? "#00C48C" : "#5B6570",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {t(`ranges.${r.key}`)}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ display: "flex", gap: 4 }}>
                  {TYPE_FILTERS.map((f) => {
                    const on = typeFilter === f.id;
                    return (
                      <button
                        key={f.id}
                        onClick={() => setTypeFilter(f.id)}
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "6px 12px",
                          borderRadius: 14,
                          background: on ? "rgba(0,196,140,0.10)" : "rgba(255,255,255,0.02)",
                          border: on ? "1px solid rgba(0,196,140,0.30)" : "1px solid rgba(255,255,255,0.10)",
                          color: on ? "#00C48C" : "#5B6570",
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        {t(`type_filters.${f.key}`)}
                      </button>
                    );
                  })}
                </div>
                <div style={{ position: "relative", width: 260, marginInlineStart: 10 }}>
                  <Search
                    size={13}
                    color="#5B6570"
                    style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}
                  />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("search_placeholder")}
                    style={{
                      width: "100%",
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.10)",
                      borderRadius: 8,
                      padding: "8px 12px 8px 30px",
                      color: "#E6EDF3",
                      fontSize: 12,
                      fontFamily: "inherit",
                      outline: "none",
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            <div
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                overflow: "hidden",
                marginTop: 12,
              }}
            >
              <BankStatementTable txs={filteredTxs} currency={selected.currency} />
            </div>

            {/* Export */}
            {!readOnly && <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              {["PDF", "CSV", "Excel"].map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => console.log(`[export] ${fmt} statement for ${selected.id}`)}
                  style={{
                    background: "transparent",
                    color: "#8B98A5",
                    border: "1px solid rgba(255,255,255,0.12)",
                    padding: "7px 14px",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    fontFamily: "inherit",
                  }}
                >
                  {t("export", { format: fmt })}
                </button>
              ))}
            </div>}

            {!readOnly && showFutureOps && <FutureBankOperationsCard />}
          </>
        )}
      </div>
    </div>
  );
}
