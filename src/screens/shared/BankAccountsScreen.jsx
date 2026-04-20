import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, Building2 } from "lucide-react";
import LtrText from "../../components/shared/LtrText";
import EmptyState from "../../components/shared/EmptyState";
import {
  listBankAccounts,
  getBankAccountStatement,
  getBankAccountSummary,
} from "../../engine";
import BankAccountCard from "../../components/banking/BankAccountCard";
import BankAccountSummaryStrip from "../../components/banking/BankAccountSummaryStrip";
import BankStatementTable from "../../components/banking/BankStatementTable";
import FutureBankOperationsCard from "../../components/banking/FutureBankOperationsCard";
import { formatRelativeTime } from "../../utils/relativeTime";
import { useTenant } from "../../components/shared/TenantContext";

// Calendar-window ranges per HASEEB-148 (2026-04-20): the backend maps
// each id to a calendar window (month = current calendar month 1st→last,
// quarter = current calendar quarter, year = current calendar year,
// all = no bounds). Labels updated to match — the previous "Today /
// This Week" rolling labels would be misleading under calendar semantics.
const RANGES = [
  { id: "month",   key: "month" },
  { id: "quarter", key: "quarter" },
  { id: "year",    key: "year" },
  { id: "all",     key: "all" },
];
const TYPE_FILTERS = [
  { id: "All", key: "all" },
  { id: "Inflow", key: "inflow" },
  { id: "Outflow", key: "outflow" },
];

export default function BankAccountsScreen({ role = "CFO", readOnly = false, initialAccountId = null }) {
  const { t } = useTranslation("bank-accounts");
  const { t: tc } = useTranslation("common");
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
    let cancelled = false;
    listBankAccounts()
      .then((accs) => {
        if (cancelled) return;
        const list = Array.isArray(accs) ? accs : [];
        setAccounts(list);
        if (list.length > 0) {
          const initial = initialAccountId && list.find((a) => a.id === initialAccountId);
          setSelectedId(initial ? initial.id : list[0].id);
        }
      })
      .catch(() => {
        if (!cancelled) setAccounts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [initialAccountId]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    setTxs(null);
    setSummary(null);
    // Calendar-range options (HASEEB-148). The backend reads `range` and
    // computes the window server-side; we don't pass from/to here.
    getBankAccountStatement(selectedId, { range })
      .then((rows) => { if (!cancelled) setTxs(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (!cancelled) setTxs([]); });
    getBankAccountSummary(selectedId, { range })
      .then((s) => { if (!cancelled) setSummary(s || null); })
      .catch(() => { if (!cancelled) setSummary(null); });
    return () => {
      cancelled = true;
    };
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
              color: "var(--text-tertiary)",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-default)",
              borderInlineStart: "2px solid var(--text-tertiary)",
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
              color: "var(--text-primary)",
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
              color: "var(--text-tertiary)",
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
          {accounts && accounts.length === 0 && (
            <EmptyState icon={Building2} title={tc("empty_states.bank_accounts_title")} description={tc("empty_states.bank_accounts_desc")} />
          )}
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
                    color: "var(--text-primary)",
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
                    color: "var(--text-tertiary)",
                    marginTop: 4,
                  }}
                >
                  <LtrText>{selected.accountNumberMasked}</LtrText>
                </div>
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-tertiary)",
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
                        background: on ? "var(--accent-primary-subtle)" : "var(--bg-surface)",
                        border: on ? "1px solid var(--accent-primary-border)" : "1px solid var(--border-default)",
                        color: on ? "var(--accent-primary)" : "var(--text-tertiary)",
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
                          background: on ? "var(--accent-primary-subtle)" : "var(--bg-surface)",
                          border: on ? "1px solid var(--accent-primary-border)" : "1px solid var(--border-default)",
                          color: on ? "var(--accent-primary)" : "var(--text-tertiary)",
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
                    color="var(--text-tertiary)"
                    style={{ position: "absolute", insetInlineStart: 10, top: "50%", transform: "translateY(-50%)" }}
                  />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("search_placeholder")}
                    style={{
                      width: "100%",
                      background: "var(--bg-surface-sunken)",
                      border: "1px solid var(--border-default)",
                      borderRadius: 8,
                      padding: "8px 12px",
                      paddingInlineStart: 30,
                      color: "var(--text-primary)",
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
                border: "1px solid var(--border-default)",
                borderRadius: 8,
                overflow: "hidden",
                marginTop: 12,
              }}
            >
              <BankStatementTable txs={filteredTxs} currency={selected.currency} />
            </div>

            {/* Export buttons hidden pending HASEEB-180 backend endpoint (GET /:id/export?format=csv|pdf|xlsx). */}

            {!readOnly && showFutureOps && <FutureBankOperationsCard />}
          </>
        )}
      </div>
    </div>
  );
}
