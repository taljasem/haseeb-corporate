import { useEffect, useMemo, useState } from "react";
import useEscapeKey from "../../hooks/useEscapeKey";
import { useTranslation } from "react-i18next";
import {
  BookOpen, Calendar, Calculator, Coins, Plug, Cpu, Ban, Receipt,
  Plus, Search, Edit3, Trash2, RefreshCw, AlertTriangle, X as XIcon,
  Scale, Gavel, Clock, Percent, Split, Play, UserCheck, ShieldAlert, FileCode,
  UserMinus, Banknote,
} from "lucide-react";
import LtrText from "../../components/shared/LtrText";
import EmptyState from "../../components/shared/EmptyState";
import Spinner from "../../components/shared/Spinner";
import { useTenant } from "../../components/shared/TenantContext";
import { formatRelativeTime } from "../../utils/relativeTime";
import { normalizeRole, canEditAdmin } from "../../utils/role";
// Wave 2: COA tree pulls from the engine router (real /api/accounts in
// LIVE mode, mock in MOCK mode). Everything else on the setup screen
// (fiscal, tax, currencies, integrations, team access, engine rules) has
// no backend yet and stays on the mockEngine direct path — the router
// will fall back to mock in LIVE mode with a one-shot warn.
import {
  getSetupChartOfAccounts,
  getAccountsFlat,
  listDisallowanceRules,
  deactivateDisallowanceRule,
  listTaxLodgements,
  updateTaxLodgementStatus,
  getTaxLodgementTieOut,
  listWhtConfigs,
  deactivateWhtConfig,
  listWhtCertificates,
  listCostAllocationRules,
  deactivateCostAllocationRule,
  computeCostAllocation,
  listRelatedParties,
  deactivateRelatedParty,
  getRelatedPartyReport,
  listVendorsForRelatedParty,
  listCustomersForRelatedParty,
  listWarrantyPolicies,
  deactivateWarrantyPolicy,
  listBankFormats,
  deactivateBankFormat,
  listLeavePolicies,
  getActiveLeavePolicy,
  getLeaveProvisionSummary,
  listCbkRates,
  deleteCbkRate,
  getCbkRateStaleness,
} from "../../engine";
// HASEEB-280 — Wave 2 migration (residual). The rest of SetupScreen's
// imports already route via ../../engine; this block of ten
// fiscal/tax/currency/integration/engine-config helpers are mock-
// fallback until the corresponding backend wrappers land (tracked
// under HASEEB-279 follow-ups).
import {
  getFiscalYearConfig,
  getTaxConfiguration,
  updateTaxConfiguration,
  getCurrencyConfig,
  updateCurrencyConfig,
  updateExchangeRates,
  getIntegrationStatus,
  forceSyncIntegration,
  getIntegrationSyncLogs,
  getEngineConfiguration,
} from "../../engine";
import AccountModal from "../../components/setup/AccountModal";
import DeactivateAccountModal from "../../components/setup/DeactivateAccountModal";
import PeriodActionModal from "../../components/setup/PeriodActionModal";
import ChangeEngineRuleModal from "../../components/setup/ChangeEngineRuleModal";
import DisallowanceRuleModal from "../../components/setup/DisallowanceRuleModal";
import TaxLodgementModal from "../../components/setup/TaxLodgementModal";
import CitAssessmentSummaryWidget from "../../components/cfo/CitAssessmentSummaryWidget";
import WhtConfigModal from "../../components/setup/WhtConfigModal";
import CostAllocationRuleModal from "../../components/setup/CostAllocationRuleModal";
import RelatedPartyModal from "../../components/setup/RelatedPartyModal";
import WarrantyPolicyModal from "../../components/setup/WarrantyPolicyModal";
import BankFormatModal from "../../components/setup/BankFormatModal";
import LeavePolicyModal from "../../components/setup/LeavePolicyModal";
import CbkRateModal from "../../components/setup/CbkRateModal";

function fmtKWD(n) {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const ALL_SECTIONS = [
  { id: "chart",           icon: BookOpen,       foreignOnly: false },
  { id: "fiscal",          icon: Calendar,       foreignOnly: false },
  { id: "tax",             icon: Calculator,     foreignOnly: false },
  { id: "disallowance",    icon: Ban,            foreignOnly: true  },
  { id: "tax_lodgement",   icon: Receipt,        foreignOnly: true  },
  { id: "cit_assessment",  icon: Gavel,          foreignOnly: true  },
  { id: "wht",             icon: Percent,        foreignOnly: true  },
  { id: "cost_allocation", icon: Split,          foreignOnly: false },
  { id: "related_party",   icon: UserCheck,      foreignOnly: false },
  // Phase 5 (2026-04-21): Vendors + Customers (KYC admin) were moved
  // out of SetupScreen into a dedicated top-level Contacts surface
  // (src/screens/shared/ContactsScreen.jsx). SetupScreen is back to
  // pure accounting-config territory.
  { id: "warranty",        icon: ShieldAlert,    foreignOnly: false },
  { id: "bank_formats",    icon: FileCode,       foreignOnly: false },
  { id: "leave",           icon: UserMinus,      foreignOnly: false },
  { id: "cbk_rates",       icon: Banknote,       foreignOnly: false },
  { id: "currencies",      icon: Coins,          foreignOnly: false },
  { id: "integrations",    icon: Plug,           foreignOnly: false },
  { id: "engine_rules",    icon: Cpu,            foreignOnly: false },
];

export default function SetupScreen({ role: roleRaw = "CFO", onNavigate }) {
  const { t } = useTranslation("setup");
  const { tenant } = useTenant();
  const [active, setActive] = useState("chart");
  const [hasForeignActivity, setHasForeignActivity] = useState(false);

  // HASEEB-166: defense-in-depth role gating at the component level.
  // CFO + Senior can edit; Owner + Junior are read-only. Today the
  // primary gate is routing (OwnerView/JuniorView don't import
  // SetupScreen) — this guards against any future sidebar/deep-link
  // exposure from granting edit by accident. Backend is authoritative
  // on writes regardless; this is UI clarity + defense-in-depth.
  const role = normalizeRole(roleRaw);
  const readOnly = !canEditAdmin(role);

  useEffect(() => {
    let cancelled = false;
    import("../../engine").then(({ getTenantFlags }) => {
      if (!getTenantFlags) return;
      getTenantFlags()
        .then((f) => {
          if (!cancelled) setHasForeignActivity(!!f?.hasForeignActivity);
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const SECTIONS = hasForeignActivity
    ? ALL_SECTIONS
    : ALL_SECTIONS.filter((s) => !s.foreignOnly);

  useEffect(() => {
    if (!SECTIONS.find((s) => s.id === active)) setActive(SECTIONS[0].id);
  }, [SECTIONS, active]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div
        style={{
          padding: "22px 28px 18px",
          borderBottom: "1px solid var(--border-subtle)",
          background: "linear-gradient(180deg, rgba(0,196,140,0.10) 0%, transparent 100%)",
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--accent-primary)" }}>
          {t("view_label")}
        </div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, color: "var(--text-primary)", letterSpacing: "-0.3px", marginTop: 2, lineHeight: 1 }}>
          {t("title")}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginTop: 6 }}>
          {t("hero_subtitle", { tenant: tenant?.company?.shortName || "" })}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <aside style={{ width: 220, flexShrink: 0, background: "var(--bg-surface)", borderInlineEnd: "1px solid var(--border-default)", padding: "18px 0", overflowY: "auto" }}>
          {SECTIONS.map((s) => {
            const on = active === s.id;
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setActive(s.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  width: "100%", padding: "10px 20px",
                  background: on ? "var(--bg-surface-sunken)" : "transparent",
                  border: "none",
                  color: on ? "var(--text-primary)" : "var(--text-tertiary)",
                  fontFamily: "inherit", fontSize: 12, fontWeight: 600,
                  letterSpacing: "0.05em", textAlign: "start", cursor: "pointer",
                  boxShadow: on ? "inset 2px 0 0 var(--accent-primary)" : "none",
                }}
                onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = "var(--bg-surface-sunken)"; }}
                onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = "transparent"; }}
              >
                <Icon size={14} strokeWidth={2} />
                <span>{t(`sections.${s.id === "chart" ? "chart_of_accounts" : s.id === "fiscal" ? "fiscal_year" : s.id === "currencies" ? "currencies" : s.id === "integrations" ? "integrations" : s.id === "team_access" ? "team_access" : s.id === "engine_rules" ? "engine_rules" : s.id === "disallowance" ? "disallowance" : s.id === "tax_lodgement" ? "tax_lodgement" : s.id === "cit_assessment" ? "cit_assessment" : s.id === "wht" ? "wht" : s.id === "cost_allocation" ? "cost_allocation" : s.id === "related_party" ? "related_party" : s.id === "warranty" ? "warranty" : s.id === "bank_formats" ? "bank_formats" : s.id === "leave" ? "leave" : s.id === "cbk_rates" ? "cbk_rates" : s.id}`)}</span>
              </button>
            );
          })}
        </aside>

        <div style={{ flex: 1, overflowY: "auto", padding: "22px 28px 32px", minWidth: 0 }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            {readOnly && (
              <div
                role="status"
                style={{
                  marginBottom: 14,
                  padding: "10px 14px",
                  background: "var(--semantic-warning-subtle)",
                  border: "1px solid var(--semantic-warning)",
                  borderRadius: 8,
                  color: "var(--semantic-warning)",
                  fontSize: 12,
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <AlertTriangle size={14} />
                <span>{t("readonly_banner")}</span>
              </div>
            )}
            {active === "chart"         && <ChartSection readOnly={readOnly} />}
            {active === "fiscal"        && <FiscalSection readOnly={readOnly} />}
            {active === "tax"           && <TaxSection readOnly={readOnly} />}
            {active === "disallowance"  && <DisallowanceSection readOnly={readOnly} />}
            {active === "tax_lodgement" && <TaxLodgementSection readOnly={readOnly} />}
            {active === "cit_assessment" && <CitAssessmentSection readOnly={readOnly} onNavigate={onNavigate} />}
            {active === "wht"           && <WhtSection readOnly={readOnly} />}
            {active === "cost_allocation" && <CostAllocationSection readOnly={readOnly} />}
            {active === "related_party" && <RelatedPartySection readOnly={readOnly} />}
            {active === "warranty"      && <WarrantySection readOnly={readOnly} />}
            {active === "bank_formats"  && <BankFormatsSection readOnly={readOnly} />}
            {active === "leave"         && <LeaveSection readOnly={readOnly} />}
            {active === "cbk_rates"     && <CbkRatesSection readOnly={readOnly} />}
            {active === "currencies"    && <CurrenciesSection readOnly={readOnly} />}
            {active === "integrations"  && <IntegrationsSection readOnly={readOnly} />}
            {active === "engine_rules"  && <EngineRulesSection readOnly={readOnly} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ title, description, extra, children }) {
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 10, padding: "20px 22px", marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: description ? 4 : 14, gap: 10 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--text-primary)", letterSpacing: "-0.2px", lineHeight: 1.1 }}>{title}</div>
          {description && <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>{description}</div>}
        </div>
        {extra}
      </div>
      {description && <div style={{ height: 10 }} />}
      {children}
    </div>
  );
}

function Toast({ text, onClear }) {
  useEffect(() => { if (!text) return; const id = setTimeout(() => onClear && onClear(), 2500); return () => clearTimeout(id); }, [text, onClear]);
  if (!text) return null;
  return <div style={{ marginBottom: 14, background: "var(--accent-primary-subtle)", border: "1px solid var(--accent-primary-border)", color: "var(--accent-primary)", padding: "10px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500 }}>{text}</div>;
}

// ── Chart of Accounts ─────────────────────────────────────────────
function ChartSection({ readOnly = false }) {
  const { t } = useTranslation("setup");
  const [accounts, setAccounts] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [modalMode, setModalMode] = useState(null);
  const [activeAccount, setActiveAccount] = useState(null);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [menuOpenCode, setMenuOpenCode] = useState(null);

  // Wave 2: explicit loading/error state for the COA fetch.
  const [coaLoading, setCoaLoading] = useState(true);
  const [coaError, setCoaError] = useState(null);
  const reload = () => {
    setCoaLoading(true);
    setCoaError(null);
    return getSetupChartOfAccounts()
      .then((data) => {
        setAccounts(Array.isArray(data) ? data : []);
        setCoaLoading(false);
      })
      .catch((err) => {
        setCoaError({
          message:
            err?.code === "NETWORK_ERROR"
              ? "Can't reach the server. Check your connection and try again."
              : err?.message || "Something went wrong loading the chart of accounts.",
        });
        setCoaLoading(false);
      });
  };
  useEffect(() => { reload(); }, []);

  const filtered = useMemo(() => {
    let list = accounts;
    if (typeFilter !== "all") list = list.filter((a) => a.type === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) => a.code.includes(q) || a.name.toLowerCase().includes(q));
    }
    return list;
  }, [accounts, search, typeFilter]);

  const grouped = useMemo(() => {
    const byType = {};
    ["Assets", "Liabilities", "Equity", "Revenue", "Expenses"].forEach((k) => { byType[k] = []; });
    filtered.forEach((a) => { if (byType[a.type]) byType[a.type].push(a); });
    return byType;
  }, [filtered]);

  return (
    <Card
      title={t("chart.title")}
      description={t("chart.description")}
      extra={
        <button
          onClick={() => { setModalMode("add"); setActiveAccount(null); }}
          disabled={readOnly}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "var(--accent-primary)", color: "#fff", border: "none",
            padding: "9px 16px", borderRadius: 6,
            cursor: readOnly ? "not-allowed" : "pointer",
            opacity: readOnly ? 0.5 : 1,
            fontSize: 12, fontWeight: 600, fontFamily: "inherit",
          }}
        >
          <Plus size={14} /> {t("chart.add_account")}
        </button>
      }
    >
      <Toast text={toast} onClear={() => setToast(null)} />
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={13} color="var(--text-tertiary)" style={{ position: "absolute", insetInlineStart: 10, top: "50%", transform: "translateY(-50%)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("chart.search_placeholder")} style={{ width: "100%", background: "var(--bg-surface-sunken)", border: "1px solid var(--border-default)", borderRadius: 8, padding: "8px 12px 8px 30px", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ background: "var(--bg-surface-sunken)", border: "1px solid var(--border-default)", borderRadius: 6, padding: "8px 10px", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none" }}>
          <option value="all">{t("chart.filter_all")}</option>
          {["Assets", "Liabilities", "Equity", "Revenue", "Expenses"].map((tp) => <option key={tp} value={tp}>{t(`chart.types.${tp}`)}</option>)}
        </select>
      </div>
      {coaLoading && (
        <div role="status" aria-live="polite" style={{ padding: "18px 0", color: "var(--text-tertiary)", fontSize: 12 }}>
          Loading chart of accounts…
        </div>
      )}
      {coaError && !coaLoading && (
        <div role="alert" style={{ padding: "14px 16px", marginBottom: 10, background: "rgba(253,54,28,0.08)", border: "1px solid rgba(253,54,28,0.3)", color: "var(--semantic-danger)", borderRadius: 8, fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <span>{coaError.message}</span>
          <button onClick={reload} style={{ background: "transparent", border: "1px solid rgba(253,54,28,0.35)", color: "var(--semantic-danger)", padding: "5px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>Retry</button>
        </div>
      )}
      {!coaLoading && !coaError && accounts.length === 0 && (
        <EmptyState
          icon={BookOpen}
          title="Chart of accounts is being set up"
          description="Your chart of accounts is being provisioned. Please refresh in a moment — this usually takes a few seconds."
        />
      )}
      {Object.keys(grouped).map((tp) => {
        const list = grouped[tp];
        if (list.length === 0) return null;
        return (
          <div key={tp} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-tertiary)", padding: "8px 0", borderBottom: "1px solid var(--border-subtle)" }}>
              {t(`chart.types.${tp}`)} ({list.length})
            </div>
            {list.map((a) => (
              <div key={a.code} style={{ display: "grid", gridTemplateColumns: "80px 1fr 200px 140px 80px 40px", gap: 8, padding: "10px 0", borderBottom: "1px solid var(--border-subtle)", alignItems: "center", position: "relative" }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "var(--accent-primary)" }}><LtrText>{a.code}</LtrText></div>
                <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{a.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{a.subtype}</div>
                <div style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", textAlign: "end", color: a.balance < 0 ? "var(--semantic-danger)" : "var(--text-primary)" }}><LtrText>{fmtKWD(a.balance)}</LtrText></div>
                <div>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: a.status === "active" ? "var(--accent-primary)" : "var(--text-tertiary)", background: a.status === "active" ? "var(--accent-primary-subtle)" : "var(--bg-surface-sunken)", padding: "3px 8px", borderRadius: 4 }}>
                    {t(`chart.${a.status === "active" ? "status_active" : "status_inactive"}`)}
                  </span>
                </div>
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => setMenuOpenCode(menuOpenCode === a.code ? null : a.code)}
                    aria-label={t("chart.kebab.open")}
                    disabled={readOnly}
                    style={{
                      width: 24, height: 24, background: "transparent", border: "none",
                      cursor: readOnly ? "not-allowed" : "pointer",
                      opacity: readOnly ? 0.4 : 1,
                      color: "var(--text-tertiary)",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <Edit3 size={12} />
                  </button>
                  {menuOpenCode === a.code && !readOnly && (
                    <div style={{ position: "absolute", top: "calc(100% + 4px)", insetInlineEnd: 0, width: 180, background: "var(--bg-surface-raised)", border: "1px solid var(--border-default)", borderRadius: 8, boxShadow: "var(--panel-shadow)", zIndex: 150, padding: "6px 0" }}>
                      <MenuItem label={t("chart.kebab.edit")} onClick={() => { setActiveAccount(a); setModalMode("edit"); setMenuOpenCode(null); }} />
                      <MenuItem label={t("chart.kebab.deactivate")} onClick={() => { setActiveAccount(a); setDeactivateOpen(true); setMenuOpenCode(null); }} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      })}
      <AccountModal
        open={modalMode !== null}
        mode={modalMode}
        account={activeAccount}
        onClose={() => { setModalMode(null); setActiveAccount(null); }}
        onSaved={() => { reload(); setToast(t("account_modal.saved_toast")); }}
      />
      <DeactivateAccountModal
        open={deactivateOpen}
        account={activeAccount}
        onClose={() => setDeactivateOpen(false)}
        onSaved={() => { reload(); setToast(t("account_modal.saved_toast")); }}
      />
    </Card>
  );
}

function MenuItem({ label, onClick }) {
  return (
    <button onClick={onClick} style={{ width: "100%", background: "transparent", border: "none", textAlign: "start", padding: "9px 14px", fontSize: 12, fontFamily: "inherit", color: "var(--text-primary)", cursor: "pointer" }} onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-surface-sunken)"; }} onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
      {label}
    </button>
  );
}

// ── Fiscal Year ───────────────────────────────────────────────────
function FiscalSection({ readOnly = false }) {
  const { t } = useTranslation("setup");
  const [data, setData] = useState(null);
  const [periodAction, setPeriodAction] = useState(null);
  const reload = () => getFiscalYearConfig().then(setData);
  useEffect(() => { reload(); }, []);
  if (!data) return <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>…</div>;

  return (
    <>
      <Card title={t("fiscal.title")} description={t("fiscal.description")}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 18 }}>
          <Meta label={t("fiscal.current_fy")} value={data.currentFY} />
          <Meta label={t("fiscal.start_date")} value={data.startDate} />
          <Meta label={t("fiscal.end_date")} value={data.endDate} />
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 10 }}>{t("fiscal.periods_heading")}</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {data.periods.map((p) => {
            const pillColor = p.status === "hard_closed" ? "var(--text-tertiary)" : p.status === "open" ? "var(--accent-primary)" : p.status === "soft_closed" ? "var(--semantic-warning)" : "var(--border-default)";
            return (
              <div key={p.month} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-subtle)" }}>
                <div style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500 }}>{p.month}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: pillColor, background: `${pillColor}14`, border: `1px solid ${pillColor}55`, padding: "3px 8px", borderRadius: 4 }}>
                    {t(`fiscal.period_status.${p.status}`)}
                  </span>
                  {p.status === "open" && (
                    <button
                      onClick={() => setPeriodAction({ action: "close", month: p.month })}
                      disabled={readOnly}
                      style={{
                        ...btnMini,
                        cursor: readOnly ? "not-allowed" : "pointer",
                        opacity: readOnly ? 0.5 : 1,
                      }}
                    >
                      {t("fiscal.close_period")}
                    </button>
                  )}
                  {p.status === "hard_closed" && (
                    <button
                      onClick={() => setPeriodAction({ action: "open", month: p.month })}
                      disabled={readOnly}
                      style={{
                        ...btnMini,
                        cursor: readOnly ? "not-allowed" : "pointer",
                        opacity: readOnly ? 0.5 : 1,
                      }}
                    >
                      {t("fiscal.open_period")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginTop: 16, marginBottom: 8 }}>{t("fiscal.milestones_heading")}</div>
        {data.milestones.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-subtle)", fontSize: 12 }}>
            <div style={{ color: "var(--text-primary)" }}>{m.label}</div>
            <div style={{ color: "var(--text-tertiary)", fontFamily: "'DM Mono', monospace", fontSize: 11 }}>{new Date(m.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
          </div>
        ))}
      </Card>
      <PeriodActionModal
        open={!!periodAction}
        action={periodAction?.action}
        month={periodAction?.month}
        onClose={() => setPeriodAction(null)}
        onDone={reload}
      />
    </>
  );
}

function Meta({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", color: "var(--text-tertiary)" }}>{label}</div>
      <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 600, marginTop: 4 }}>{value}</div>
    </div>
  );
}

// ── Tax ─────────────────────────────────────────────────────────
function TaxSection({ readOnly = false }) {
  const { t } = useTranslation("setup");
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => { getTaxConfiguration().then(setCfg); }, []);
  if (!cfg) return <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>…</div>;

  const update = (k, v) => setCfg({ ...cfg, [k]: v });

  const handleSave = async () => {
    setSaving(true);
    await updateTaxConfiguration(cfg);
    setSaving(false);
    setToast(t("tax.saved_toast"));
  };

  return (
    <Card title={t("tax.title")} description={t("tax.description")}>
      <Toast text={toast} onClear={() => setToast(null)} />
      <FormRow label={t("tax.field_regime")}>
        <select value={cfg.regime} onChange={(e) => update("regime", e.target.value)} disabled={readOnly} style={selectStyle}>
          {["kuwait", "saudi", "uae", "bahrain"].map((r) => <option key={r} value={r}>{t(`tax.regime_${r}`)}</option>)}
        </select>
      </FormRow>
      {cfg.regime === "kuwait" && (
        <>
          <FormRow label={t("tax.field_zakat")}><input type="number" value={cfg.zakatRate} onChange={(e) => update("zakatRate", Number(e.target.value))} disabled={readOnly} style={inputStyle} /></FormRow>
          <FormRow label={t("tax.field_zakat_account")}><input value={cfg.zakatAccount} onChange={(e) => update("zakatAccount", e.target.value)} disabled={readOnly} style={inputStyle} /></FormRow>
          <FormRow label={t("tax.field_corporate")}><input type="number" value={cfg.corporateTaxRate} onChange={(e) => update("corporateTaxRate", Number(e.target.value))} disabled={readOnly} style={inputStyle} /></FormRow>
          <FormRow label={t("tax.field_pifss")}><input type="number" value={cfg.pifssRate} onChange={(e) => update("pifssRate", Number(e.target.value))} disabled={readOnly} style={inputStyle} /></FormRow>
          <FormRow label={t("tax.field_pifss_account")}><input value={cfg.pifssAccount} onChange={(e) => update("pifssAccount", e.target.value)} disabled={readOnly} style={inputStyle} /></FormRow>
        </>
      )}
      <FormRow label={t("tax.field_filing_frequency")}>
        <select value={cfg.filingFrequency} onChange={(e) => update("filingFrequency", e.target.value)} disabled={readOnly} style={selectStyle}>
          {["monthly", "quarterly", "annual"].map((f) => <option key={f} value={f}>{t(`tax.freq_${f}`)}</option>)}
        </select>
      </FormRow>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginTop: 14, marginBottom: 8 }}>{t("tax.exemptions_heading")}</div>
      {cfg.exemptions.map((e, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-subtle)", fontSize: 12 }}>
          <div style={{ color: "var(--text-primary)" }}>{e.partyName}</div>
          <div style={{ color: "var(--text-tertiary)" }}>{e.reason}</div>
        </div>
      ))}
      <div style={{ marginTop: 16 }}>
        <button
          onClick={handleSave}
          disabled={saving || readOnly}
          style={{ ...btnPrimary(saving), opacity: readOnly ? 0.5 : 1, cursor: readOnly ? "not-allowed" : btnPrimary(saving).cursor }}
        >
          {saving ? <><Spinner size={13} />&nbsp;{t("tax.saving")}</> : t("tax.save")}
        </button>
      </div>
    </Card>
  );
}

// ── Currencies ─────────────────────────────────────────────────────
function CurrenciesSection({ readOnly = false }) {
  const { t } = useTranslation("setup");
  const [cfg, setCfg] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => { getCurrencyConfig().then(setCfg); }, []);
  if (!cfg) return <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>…</div>;

  const toggle = async (code) => {
    const next = { ...cfg, enabled: { ...cfg.enabled, [code]: !cfg.enabled[code] } };
    setCfg(next);
    await updateCurrencyConfig({ enabled: next.enabled });
  };

  const handleUpdateRates = async () => {
    setUpdating(true);
    await updateExchangeRates();
    const refreshed = await getCurrencyConfig();
    setCfg(refreshed);
    setUpdating(false);
    setToast(t("currencies.rates_updated_toast"));
  };

  return (
    <Card title={t("currencies.title")} description={t("currencies.description")}>
      <Toast text={toast} onClear={() => setToast(null)} />
      <FormRow label={t("currencies.base_currency")}>
        <div style={{ ...inputStyle, background: "var(--bg-surface)", color: "var(--text-secondary)" }}>
          {cfg.base} <span style={{ fontSize: 10, color: "var(--text-tertiary)", marginInlineStart: 8 }}>({t("currencies.base_locked")})</span>
        </div>
      </FormRow>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginTop: 14, marginBottom: 8 }}>{t("currencies.enabled_heading")}</div>
      {Object.keys(cfg.enabled).map((c) => (
        <div key={c} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--border-subtle)" }}>
          <div style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: "'DM Mono', monospace" }}><LtrText>{c}</LtrText></div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "'DM Mono', monospace" }}><LtrText>{cfg.rates[c]?.toFixed(4)}</LtrText></div>
            <button
              onClick={() => toggle(c)}
              disabled={readOnly}
              style={{
                width: 36, height: 20, borderRadius: 10,
                background: cfg.enabled[c] ? "var(--accent-primary)" : "var(--border-default)",
                border: "none", padding: 2,
                cursor: readOnly ? "not-allowed" : "pointer",
                opacity: readOnly ? 0.5 : 1,
                position: "relative",
              }}
            >
              <span style={{ display: "block", width: 16, height: 16, borderRadius: "50%", background: "#fff", transform: cfg.enabled[c] ? "translateX(16px)" : "translateX(0)", transition: "transform 0.15s" }} />
            </button>
          </div>
        </div>
      ))}
      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={handleUpdateRates}
          disabled={updating || readOnly}
          style={{ ...btnPrimary(updating), opacity: readOnly ? 0.5 : 1, cursor: readOnly ? "not-allowed" : btnPrimary(updating).cursor }}
        >
          {updating ? <><Spinner size={13} />&nbsp;{t("currencies.updating")}</> : <><RefreshCw size={12} style={{ verticalAlign: "middle", marginInlineEnd: 6 }} />{t("currencies.update_rates")}</>}
        </button>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
          {t("currencies.last_updated", { time: formatRelativeTime(cfg.lastUpdated) })}
        </div>
      </div>
    </Card>
  );
}

// ── Integrations Status ────────────────────────────────────────────
function IntegrationsSection({ readOnly = false }) {
  const { t } = useTranslation("setup");
  const [items, setItems] = useState([]);
  const [syncLogsFor, setSyncLogsFor] = useState(null);
  const [logs, setLogs] = useState([]);
  const [syncingId, setSyncingId] = useState(null);
  const [toast, setToast] = useState(null);

  const reload = () => getIntegrationStatus().then(setItems);
  useEffect(() => { reload(); }, []);

  const handleSync = async (id) => {
    setSyncingId(id);
    await forceSyncIntegration(id);
    setSyncingId(null);
    setToast(t("integrations.synced_toast"));
    reload();
  };
  const handleViewLogs = async (id) => {
    setSyncLogsFor(id);
    const l = await getIntegrationSyncLogs(id, 10);
    setLogs(l);
  };

  return (
    <Card title={t("integrations.title")} description={t("integrations.description")}>
      <Toast text={toast} onClear={() => setToast(null)} />
      {items.map((i) => {
        const color = i.status === "connected" ? "var(--accent-primary)" : i.status === "error" ? "var(--semantic-danger)" : "var(--text-tertiary)";
        return (
          <div key={i.id} style={{ padding: "12px 0", borderBottom: "1px solid var(--border-subtle)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{i.name}</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4, display: "flex", gap: 10 }}>
                  <span style={{ color, fontWeight: 600 }}>{t(`integrations.status_${i.status}`)}</span>
                  <span>{i.lastSync ? formatRelativeTime(i.lastSync) : t("integrations.never_synced")}</span>
                  <span>{i.syncFrequency}</span>
                  <span><LtrText>{i.volumePerDay}</LtrText> tx/day</span>
                </div>
              </div>
              <button
                onClick={() => handleSync(i.id)}
                disabled={syncingId === i.id || i.status === "disconnected" || readOnly}
                style={{
                  ...btnMini,
                  opacity: readOnly ? 0.5 : 1,
                  cursor: readOnly ? "not-allowed" : btnMini.cursor,
                }}
              >
                {syncingId === i.id ? <><Spinner size={11} />&nbsp;{t("integrations.syncing")}</> : t("integrations.force_sync")}
              </button>
              <button onClick={() => handleViewLogs(i.id)} style={btnMini}>{t("integrations.view_logs")}</button>
            </div>
            {i.recentErrors?.length > 0 && (
              <div style={{ marginTop: 8, paddingInlineStart: 14 }}>
                {i.recentErrors.map((e, ei) => (
                  <div key={ei} style={{ fontSize: 11, color: "var(--semantic-danger)", display: "flex", gap: 8 }}>
                    <AlertTriangle size={11} />
                    <span>{e.message}</span>
                    <span style={{ color: "var(--text-tertiary)", fontFamily: "'DM Mono', monospace" }}>· {formatRelativeTime(e.timestamp)}</span>
                  </div>
                ))}
              </div>
            )}
            {syncLogsFor === i.id && logs.length > 0 && (
              <div style={{ marginTop: 10, background: "var(--bg-surface-sunken)", border: "1px solid var(--border-subtle)", borderRadius: 6, padding: "10px 12px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text-tertiary)", marginBottom: 6 }}>{t("integrations.sync_logs_heading")}</div>
                {logs.map((l, li) => (
                  <div key={li} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "4px 0" }}>
                    <span style={{ color: l.status === "error" ? "var(--semantic-danger)" : "var(--text-secondary)" }}>{l.details}</span>
                    <span style={{ color: "var(--text-tertiary)", fontFamily: "'DM Mono', monospace" }}>{formatRelativeTime(l.timestamp)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </Card>
  );
}

// ── Engine Rules ────────────────────────────────────────────────
function EngineRulesSection({ readOnly = false }) {
  const { t } = useTranslation("setup");
  const [cfg, setCfg] = useState(null);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState(null);

  const RULES = [
    { key: "jeApprovalThreshold",          label: "je_approval_threshold" },
    { key: "autoCategorizationConfidence", label: "auto_cat_confidence" },
    { key: "autoReconDateTolerance",       label: "auto_recon_tolerance" },
    { key: "materialityThreshold",         label: "materiality_threshold" },
    { key: "writeOffApprovalThreshold",    label: "writeoff_approval_threshold" },
  ];

  const reload = () => getEngineConfiguration().then(setCfg);
  useEffect(() => { reload(); }, []);
  if (!cfg) return <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>…</div>;

  return (
    <Card title={t("engine_rules.title")} description={t("engine_rules.description")}>
      <Toast text={toast} onClear={() => setToast(null)} />
      {RULES.map((r) => (
        <div key={r.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--border-subtle)" }}>
          <div>
            <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{t(`engine_rules.${r.label}`)}</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, color: "var(--accent-primary)", marginTop: 2 }}><LtrText>{cfg[r.key]}</LtrText></div>
          </div>
          <button
            onClick={() => setEditing(r.key)}
            disabled={readOnly}
            style={{
              ...btnMini,
              opacity: readOnly ? 0.5 : 1,
              cursor: readOnly ? "not-allowed" : btnMini.cursor,
            }}
          >
            {t("engine_rules.edit")}
          </button>
        </div>
      ))}
      <ChangeEngineRuleModal
        open={!!editing}
        ruleKey={editing}
        currentValue={editing ? cfg[editing] : 0}
        onClose={() => setEditing(null)}
        onSaved={() => { reload(); setToast(t("engine_rules.saved_toast")); }}
      />
    </Card>
  );
}

// ── Disallowance Rules (FN-222, 2026-04-19) ─────────────────────
// Kuwait CIT disallowance-rule register. OWNER-only write surface.
// Reads open to OWNER/ACCOUNTANT/VIEWER/AUDITOR. Rules drive
// DISALLOWED_EXPENSES tagging in the four-levy pipeline (FN-233).
function DisallowanceSection({ readOnly = false }) {
  const { t } = useTranslation("setup");
  const [rows, setRows] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [activeOnly, setActiveOnly] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [editingRule, setEditingRule] = useState(null);
  const [toast, setToast] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const reload = async () => {
    setLoadError(null);
    try {
      const list = await listDisallowanceRules({ activeOnly });
      setRows(list || []);
    } catch (err) {
      setRows([]);
      setLoadError(err?.message || t("disallowance.error_load"));
    }
  };

  useEffect(() => {
    reload();
    // accounts for the targetAccountId picker (COA leaves).
    getAccountsFlat()
      .then((arr) => {
        const adapted = (arr || []).map((a) => ({
          id: a.raw?.id || a.id || a.code,
          code: a.code,
          nameEn: a.name || a.nameEn,
          nameAr: a.nameAr,
        }));
        setAccounts(adapted);
      })
      .catch(() => setAccounts([]));
    // activeOnly is a dependency because the query param changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOnly]);

  const handleDeactivate = async (rule) => {
    try {
      await deactivateDisallowanceRule(rule.id);
      setToast(t("disallowance.deactivated_toast"));
      reload();
    } catch (err) {
      setToast(err?.message || t("disallowance.error_deactivate"));
    }
  };

  return (
    <Card
      title={t("disallowance.title")}
      description={t("disallowance.description")}
      extra={
        <button
          onClick={() => {
            setModalMode("create");
            setEditingRule(null);
            setModalOpen(true);
          }}
          disabled={readOnly}
          style={{ ...btnPrimary(false), opacity: readOnly ? 0.5 : 1, cursor: readOnly ? "not-allowed" : btnPrimary(false).cursor }}
        >
          <Plus size={13} style={{ verticalAlign: "middle", marginInlineEnd: 6 }} />
          {t("disallowance.add_rule")}
        </button>
      }
    >
      <Toast text={toast} onClear={() => setToast(null)} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <button
          onClick={() => setActiveOnly(false)}
          style={{
            ...btnMini,
            background: !activeOnly ? "var(--accent-primary-subtle)" : "transparent",
            borderColor: !activeOnly ? "var(--accent-primary-border)" : "var(--border-strong)",
            color: !activeOnly ? "var(--accent-primary)" : "var(--text-secondary)",
          }}
        >
          {t("disallowance.filter_all")}
        </button>
        <button
          onClick={() => setActiveOnly(true)}
          style={{
            ...btnMini,
            background: activeOnly ? "var(--accent-primary-subtle)" : "transparent",
            borderColor: activeOnly ? "var(--accent-primary-border)" : "var(--border-strong)",
            color: activeOnly ? "var(--accent-primary)" : "var(--text-secondary)",
          }}
        >
          {t("disallowance.filter_active_only")}
        </button>
      </div>

      {loadError && (
        <div
          role="alert"
          style={{
            display: "flex",
            gap: 8,
            padding: "10px 12px",
            background: "var(--semantic-danger-subtle)",
            border: "1px solid var(--semantic-danger)",
            borderRadius: 8,
            color: "var(--semantic-danger)",
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          <AlertTriangle size={14} /> {loadError}
        </div>
      )}

      {rows === null && (
        <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>…</div>
      )}

      {rows && rows.length === 0 && !loadError && (
        <EmptyState
          icon={Ban}
          title={t("disallowance.empty_title")}
          description={t("disallowance.empty_description")}
        />
      )}

      {rows && rows.length > 0 && (
        <div
          style={{
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {rows.map((rule, idx) => {
            const today = new Date().toISOString().slice(0, 10);
            const isActive =
              rule.activeFrom <= today &&
              (!rule.activeUntil || rule.activeUntil >= today);
            return (
              <div
                key={rule.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 14,
                  padding: "14px 18px",
                  borderBottom:
                    idx === rows.length - 1
                      ? "none"
                      : "1px solid var(--border-subtle)",
                  background: isActive ? "transparent" : "var(--bg-surface-sunken)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}
                    >
                      {rule.name}
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: isActive
                          ? "var(--accent-primary-subtle)"
                          : "var(--bg-surface)",
                        color: isActive
                          ? "var(--accent-primary)"
                          : "var(--text-tertiary)",
                        border: isActive
                          ? "1px solid var(--accent-primary-border)"
                          : "1px solid var(--border-default)",
                      }}
                    >
                      {isActive
                        ? t("disallowance.status_active")
                        : t("disallowance.status_inactive")}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: "var(--bg-surface)",
                        color: "var(--text-tertiary)",
                        border: "1px solid var(--border-default)",
                      }}
                    >
                      {t(`disallowance.rule_type_${rule.ruleType}`)}
                    </span>
                  </div>
                  {rule.description && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        marginTop: 4,
                      }}
                    >
                      {rule.description}
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 14,
                      marginTop: 6,
                      fontSize: 11,
                      color: "var(--text-tertiary)",
                    }}
                  >
                    <div>
                      {t("disallowance.label_percent")}:{" "}
                      <LtrText>
                        <span
                          style={{
                            color: "var(--text-secondary)",
                            fontFamily: "'DM Mono', monospace",
                          }}
                        >
                          {rule.disallowedPercent}%
                        </span>
                      </LtrText>
                    </div>
                    <div>
                      {t("disallowance.label_target")}:{" "}
                      <span style={{ color: "var(--text-secondary)" }}>
                        {rule.targetRole
                          ? rule.targetRole
                          : rule.targetAccountId
                          ? t("disallowance.target_account_short")
                          : "—"}
                      </span>
                    </div>
                    <div>
                      {t("disallowance.label_active_from")}:{" "}
                      <LtrText>
                        <span
                          style={{
                            color: "var(--text-secondary)",
                            fontFamily: "'DM Mono', monospace",
                          }}
                        >
                          {rule.activeFrom}
                        </span>
                      </LtrText>
                    </div>
                    {rule.activeUntil && (
                      <div>
                        {t("disallowance.label_active_until")}:{" "}
                        <LtrText>
                          <span
                            style={{
                              color: "var(--text-secondary)",
                              fontFamily: "'DM Mono', monospace",
                            }}
                          >
                            {rule.activeUntil}
                          </span>
                        </LtrText>
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <button
                    onClick={() => {
                      setModalMode("edit");
                      setEditingRule(rule);
                      setModalOpen(true);
                    }}
                    disabled={readOnly}
                    style={{
                      ...btnMini,
                      opacity: readOnly ? 0.5 : 1,
                      cursor: readOnly ? "not-allowed" : btnMini.cursor,
                    }}
                  >
                    <Edit3 size={11} style={{ verticalAlign: "middle", marginInlineEnd: 4 }} />
                    {t("disallowance.action_edit")}
                  </button>
                  {isActive && (
                    <button
                      onClick={() => handleDeactivate(rule)}
                      disabled={readOnly}
                      style={{
                        ...btnMini,
                        color: "var(--semantic-danger)",
                        borderColor: "var(--semantic-danger-border)",
                        opacity: readOnly ? 0.5 : 1,
                        cursor: readOnly ? "not-allowed" : btnMini.cursor,
                      }}
                    >
                      {t("disallowance.action_deactivate")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DisallowanceRuleModal
        open={modalOpen}
        mode={modalMode}
        rule={editingRule}
        accounts={accounts}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          reload();
          setToast(
            modalMode === "edit"
              ? t("disallowance.saved_edit_toast")
              : t("disallowance.saved_create_toast"),
          );
        }}
      />
    </Card>
  );
}

// ── Tax Lodgements (FN-268, 2026-04-19) ─────────────────────────
// Generic tax-lodgement register (CIT/WHT/VAT/KFAS/NLST/ZAKAT/OTHER)
// with GL tie-out drawer. OWNER writes; reads open to OWNER/ACCOUNTANT/
// VIEWER/AUDITOR; tie-out is OWNER/ACCOUNTANT/AUDITOR only.
const LODGEMENT_STATUSES = ["SUBMITTED", "ACKNOWLEDGED", "AMENDED", "VOIDED"];
const LODGEMENT_TYPES_FILTER = [
  "ALL",
  "CIT",
  "WHT",
  "VAT",
  "KFAS",
  "NLST",
  "ZAKAT",
  "OTHER",
];

function TaxLodgementSection({ readOnly = false }) {
  const { t } = useTranslation("setup");
  const [rows, setRows] = useState(null);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [modalOpen, setModalOpen] = useState(false);
  const [tieOutFor, setTieOutFor] = useState(null);
  const [tieOutData, setTieOutData] = useState(null);
  const [tieOutLoading, setTieOutLoading] = useState(false);
  const [tieOutError, setTieOutError] = useState(null);
  const [toast, setToast] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const reload = async () => {
    setLoadError(null);
    try {
      const filters =
        typeFilter === "ALL" ? {} : { lodgementType: typeFilter };
      const list = await listTaxLodgements(filters);
      setRows(list || []);
    } catch (err) {
      setRows([]);
      setLoadError(err?.message || t("tax_lodgement.error_load"));
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter]);

  const handleOpenTieOut = async (rule) => {
    setTieOutFor(rule);
    setTieOutData(null);
    setTieOutError(null);
    setTieOutLoading(true);
    try {
      const data = await getTaxLodgementTieOut(rule.id);
      setTieOutData(data);
    } catch (err) {
      setTieOutError(err?.message || t("tax_lodgement.error_tie_out"));
    } finally {
      setTieOutLoading(false);
    }
  };

  const handleTransition = async (rule, nextStatus) => {
    try {
      await updateTaxLodgementStatus(rule.id, { status: nextStatus });
      setToast(t("tax_lodgement.status_updated_toast"));
      reload();
    } catch (err) {
      setToast(err?.message || t("tax_lodgement.error_transition"));
    }
  };

  return (
    <Card
      title={t("tax_lodgement.title")}
      description={t("tax_lodgement.description")}
      extra={
        <button
          onClick={() => setModalOpen(true)}
          disabled={readOnly}
          style={{ ...btnPrimary(false), opacity: readOnly ? 0.5 : 1, cursor: readOnly ? "not-allowed" : btnPrimary(false).cursor }}
        >
          <Plus
            size={13}
            style={{ verticalAlign: "middle", marginInlineEnd: 6 }}
          />
          {t("tax_lodgement.record_lodgement")}
        </button>
      }
    >
      <Toast text={toast} onClear={() => setToast(null)} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        {LODGEMENT_TYPES_FILTER.map((tp) => {
          const on = typeFilter === tp;
          return (
            <button
              key={tp}
              onClick={() => setTypeFilter(tp)}
              style={{
                ...btnMini,
                background: on ? "var(--accent-primary-subtle)" : "transparent",
                borderColor: on
                  ? "var(--accent-primary-border)"
                  : "var(--border-strong)",
                color: on ? "var(--accent-primary)" : "var(--text-secondary)",
              }}
            >
              {t(`tax_lodgement.filter_${tp}`)}
            </button>
          );
        })}
      </div>

      {loadError && (
        <div
          role="alert"
          style={{
            display: "flex",
            gap: 8,
            padding: "10px 12px",
            background: "var(--semantic-danger-subtle)",
            border: "1px solid var(--semantic-danger)",
            borderRadius: 8,
            color: "var(--semantic-danger)",
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          <AlertTriangle size={14} /> {loadError}
        </div>
      )}

      {rows === null && (
        <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>…</div>
      )}

      {rows && rows.length === 0 && !loadError && (
        <EmptyState
          icon={Receipt}
          title={t("tax_lodgement.empty_title")}
          description={t("tax_lodgement.empty_description")}
        />
      )}

      {rows && rows.length > 0 && (
        <div
          style={{
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {rows.map((rule, idx) => {
            const statusColor =
              rule.status === "ACKNOWLEDGED"
                ? "var(--accent-primary)"
                : rule.status === "VOIDED"
                ? "var(--semantic-danger)"
                : rule.status === "AMENDED"
                ? "var(--semantic-warning)"
                : "var(--text-secondary)";
            const statusBg =
              rule.status === "ACKNOWLEDGED"
                ? "var(--accent-primary-subtle)"
                : rule.status === "VOIDED"
                ? "var(--semantic-danger-subtle)"
                : rule.status === "AMENDED"
                ? "var(--semantic-warning-subtle)"
                : "var(--bg-surface)";
            return (
              <div
                key={rule.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 14,
                  padding: "14px 18px",
                  borderBottom:
                    idx === rows.length - 1
                      ? "none"
                      : "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}
                    >
                      <LtrText>{rule.filingReference}</LtrText>
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: "var(--bg-surface)",
                        color: "var(--text-tertiary)",
                        border: "1px solid var(--border-default)",
                      }}
                    >
                      {t(`tax_lodgement.type_${rule.lodgementType}`)}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: statusBg,
                        color: statusColor,
                        border: "1px solid",
                      }}
                    >
                      {t(`tax_lodgement.status_${rule.status}`)}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 14,
                      marginTop: 6,
                      fontSize: 11,
                      color: "var(--text-tertiary)",
                    }}
                  >
                    <div>
                      {t("tax_lodgement.label_period")}:{" "}
                      <LtrText>
                        <span
                          style={{
                            color: "var(--text-secondary)",
                            fontFamily: "'DM Mono', monospace",
                          }}
                        >
                          {rule.periodFrom} → {rule.periodTo}
                        </span>
                      </LtrText>
                    </div>
                    <div>
                      {t("tax_lodgement.label_filed_on")}:{" "}
                      <LtrText>
                        <span
                          style={{
                            color: "var(--text-secondary)",
                            fontFamily: "'DM Mono', monospace",
                          }}
                        >
                          {rule.filedOnDate}
                        </span>
                      </LtrText>
                    </div>
                    <div>
                      {t("tax_lodgement.label_amount")}:{" "}
                      <LtrText>
                        <span
                          style={{
                            color: "var(--text-secondary)",
                            fontFamily: "'DM Mono', monospace",
                          }}
                        >
                          {rule.filedAmountKwd} KWD
                        </span>
                      </LtrText>
                    </div>
                    {rule.glAccountRole && (
                      <div>
                        {t("tax_lodgement.label_gl_role")}:{" "}
                        <LtrText>
                          <span
                            style={{
                              color: "var(--text-secondary)",
                              fontFamily: "'DM Mono', monospace",
                            }}
                          >
                            {rule.glAccountRole}
                          </span>
                        </LtrText>
                      </div>
                    )}
                  </div>
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <button
                    onClick={() => handleOpenTieOut(rule)}
                    style={btnMini}
                  >
                    <Scale
                      size={11}
                      style={{ verticalAlign: "middle", marginInlineEnd: 4 }}
                    />
                    {t("tax_lodgement.action_tie_out")}
                  </button>
                  {rule.status === "SUBMITTED" && (
                    <button
                      onClick={() => handleTransition(rule, "ACKNOWLEDGED")}
                      disabled={readOnly}
                      style={{
                        ...btnMini,
                        opacity: readOnly ? 0.5 : 1,
                        cursor: readOnly ? "not-allowed" : btnMini.cursor,
                      }}
                    >
                      {t("tax_lodgement.action_acknowledge")}
                    </button>
                  )}
                  {rule.status !== "VOIDED" && rule.status !== "AMENDED" && (
                    <button
                      onClick={() => handleTransition(rule, "VOIDED")}
                      disabled={readOnly}
                      style={{
                        ...btnMini,
                        color: "var(--semantic-danger)",
                        borderColor: "var(--semantic-danger-border)",
                        opacity: readOnly ? 0.5 : 1,
                        cursor: readOnly ? "not-allowed" : btnMini.cursor,
                      }}
                    >
                      {t("tax_lodgement.action_void")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tie-out drawer */}
      {tieOutFor && (
        <TieOutDrawer
          lodgement={tieOutFor}
          data={tieOutData}
          loading={tieOutLoading}
          error={tieOutError}
          onClose={() => {
            setTieOutFor(null);
            setTieOutData(null);
            setTieOutError(null);
          }}
        />
      )}

      <TaxLodgementModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          reload();
          setToast(t("tax_lodgement.recorded_toast"));
        }}
      />
    </Card>
  );
}

function TieOutDrawer({ lodgement, data, loading, error, onClose }) {
  const { t } = useTranslation("setup");
  useEscapeKey(onClose, !!lodgement);

  const statusColor =
    data?.status === "TIE_OK"
      ? "var(--accent-primary)"
      : data?.status === "VARIANCE"
      ? "var(--semantic-danger)"
      : "var(--text-secondary)";

  const statusBg =
    data?.status === "TIE_OK"
      ? "var(--accent-primary-subtle)"
      : data?.status === "VARIANCE"
      ? "var(--semantic-danger-subtle)"
      : "var(--bg-surface)";

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
          zIndex: 300,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: 0,
          insetInlineEnd: 0,
          height: "100vh",
          width: 480,
          background: "var(--panel-bg)",
          borderInlineStart: "1px solid var(--border-default)",
          zIndex: 301,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-24px 0 60px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 22px",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.15em",
                color: "var(--text-tertiary)",
              }}
            >
              {t("tax_lodgement.tie_out_label")}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22,
                color: "var(--text-primary)",
                marginTop: 2,
              }}
            >
              <LtrText>{lodgement.filingReference}</LtrText>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t("tax_lodgement.close")}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-tertiary)",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <XIcon size={18} />
          </button>
        </div>
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "18px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {loading && (
            <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>
              {t("tax_lodgement.tie_out_loading")}
            </div>
          )}
          {error && (
            <div
              role="alert"
              style={{
                display: "flex",
                gap: 8,
                padding: "10px 12px",
                background: "var(--semantic-danger-subtle)",
                border: "1px solid var(--semantic-danger)",
                borderRadius: 8,
                color: "var(--semantic-danger)",
                fontSize: 12,
              }}
            >
              <AlertTriangle size={14} /> {error}
            </div>
          )}
          {data && (
            <>
              <div
                style={{
                  padding: "10px 14px",
                  background: statusBg,
                  color: statusColor,
                  borderRadius: 8,
                  border: "1px solid",
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                }}
              >
                {t(`tax_lodgement.tie_out_status_${data.status}`)}
              </div>
              <DrawerField
                label={t("tax_lodgement.label_period")}
                value={
                  <LtrText>
                    <span style={{ fontFamily: "'DM Mono', monospace" }}>
                      {data.periodFrom} → {data.periodTo}
                    </span>
                  </LtrText>
                }
              />
              <DrawerField
                label={t("tax_lodgement.tie_out_filed_amount")}
                value={
                  <LtrText>
                    <span style={{ fontFamily: "'DM Mono', monospace" }}>
                      {data.filedAmountKwd} KWD
                    </span>
                  </LtrText>
                }
              />
              <DrawerField
                label={t("tax_lodgement.tie_out_gl_balance")}
                value={
                  <LtrText>
                    <span style={{ fontFamily: "'DM Mono', monospace" }}>
                      {data.glBalanceKwd} KWD
                    </span>
                  </LtrText>
                }
              />
              <DrawerField
                label={t("tax_lodgement.tie_out_variance")}
                value={
                  <LtrText>
                    <span
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        color:
                          data.status === "VARIANCE"
                            ? "var(--semantic-danger)"
                            : "var(--text-secondary)",
                      }}
                    >
                      {data.varianceKwd} KWD
                    </span>
                  </LtrText>
                }
              />
              <DrawerField
                label={t("tax_lodgement.tie_out_note")}
                value={
                  <span style={{ color: "var(--text-secondary)" }}>
                    {data.note}
                  </span>
                }
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}

function DrawerField({ label, value }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.15em",
          color: "var(--text-tertiary)",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{value}</div>
    </div>
  );
}

// ── CIT Assessment (FN-249, 2026-04-19; AUDIT-ACC-057 2026-04-22) ─
// Per-fiscal-year Kuwait CIT authority-case tracker. Full case
// management (year list, per-case detail, all 6 transitions + close +
// mark-statute-expired) lives in the standalone CITAssessmentScreen
// reachable from the Compliance sidebar entry. Setup preserves this
// section as a summary widget (most-recent + approaching-statute
// warning count + link to the full screen) so operators landing in
// Setup still see CIT status at a glance. The `cit_assessment`
// settings-category ID, Gavel icon, and `foreignOnly: true` gate are
// preserved intact per Tarek's Resolution (b).
function CitAssessmentSection({ readOnly: _readOnly = false, onNavigate }) {
  // readOnly was the legacy edit-gate when the full table lived here;
  // OWNER-only writes are now enforced inside CITAssessmentScreen via
  // the OwnerButton disabled-with-tooltip pattern, so this shell has
  // nothing to gate and reads the prop only for compatibility.
  const { t } = useTranslation("citAssessment");
  return (
    <Card
      title={t("summary.widget_title")}
      description={t("distinction_note")}
    >
      <CitAssessmentSummaryWidget
        onOpenScreen={
          onNavigate ? () => onNavigate("cit-assessment") : undefined
        }
      />
    </Card>
  );
}


// ── WHT — Withholding Tax (FN-250, 2026-04-19) ───────────────────
// Per-tenant WHT policy (effective-dated per-category basis-point
// rates + minimum-threshold) + read-only certificate register.
// OWNER-only config writes; OWNER/ACCOUNTANT/AUDITOR on both reads.
// Certificate creation is service-layer only via a future AP-flow
// splice — the UI is purposely read-only on the certificate side.
const WHT_CATEGORY_FILTERS = [
  "ALL",
  "SERVICE",
  "PROFESSIONAL",
  "RENTAL",
  "INTEREST",
  "CUSTOM",
];

function fmtBpsPercent(bps) {
  if (bps == null) return "—";
  return `${(bps / 100).toFixed(2)}%`;
}

function WhtSection({ readOnly = false }) {
  const { t } = useTranslation("setup");
  const [configs, setConfigs] = useState(null);
  const [certificates, setCertificates] = useState(null);
  const [activeOnly, setActiveOnly] = useState(false);
  const [certCategory, setCertCategory] = useState("ALL");
  const [modalState, setModalState] = useState({
    open: false,
    mode: "create",
    config: null,
  });
  const [toast, setToast] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const reload = async () => {
    setLoadError(null);
    try {
      const cfgFilters = activeOnly ? { activeOnly: true } : {};
      const certFilters =
        certCategory === "ALL" ? { limit: 100 } : { category: certCategory, limit: 100 };
      const [cfg, cert] = await Promise.all([
        listWhtConfigs(cfgFilters),
        listWhtCertificates(certFilters).catch(() => []),
      ]);
      setConfigs(cfg || []);
      setCertificates(cert || []);
    } catch (err) {
      setConfigs([]);
      setCertificates([]);
      setLoadError(err?.message || t("wht.error_load"));
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOnly, certCategory]);

  const handleDeactivate = async (cfg) => {
    try {
      await deactivateWhtConfig(cfg.id);
      setToast(t("wht.deactivated_toast"));
      reload();
    } catch (err) {
      setToast(err?.message || t("wht.error_deactivate"));
    }
  };

  return (
    <div>
      <Card
        title={t("wht.policy_title")}
        description={t("wht.policy_description")}
        extra={
          <button
            onClick={() =>
              setModalState({ open: true, mode: "create", config: null })
            }
            disabled={readOnly}
            style={{ ...btnPrimary(false), opacity: readOnly ? 0.5 : 1, cursor: readOnly ? "not-allowed" : btnPrimary(false).cursor }}
          >
            <Plus size={13} style={{ verticalAlign: "middle", marginInlineEnd: 6 }} />
            {t("wht.add_policy")}
          </button>
        }
      >
        <Toast text={toast} onClear={() => setToast(null)} />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <button
            onClick={() => setActiveOnly(false)}
            style={{
              ...btnMini,
              background: !activeOnly ? "var(--accent-primary-subtle)" : "transparent",
              borderColor: !activeOnly ? "var(--accent-primary-border)" : "var(--border-strong)",
              color: !activeOnly ? "var(--accent-primary)" : "var(--text-secondary)",
            }}
          >
            {t("wht.filter_all")}
          </button>
          <button
            onClick={() => setActiveOnly(true)}
            style={{
              ...btnMini,
              background: activeOnly ? "var(--accent-primary-subtle)" : "transparent",
              borderColor: activeOnly ? "var(--accent-primary-border)" : "var(--border-strong)",
              color: activeOnly ? "var(--accent-primary)" : "var(--text-secondary)",
            }}
          >
            {t("wht.filter_active_only")}
          </button>
        </div>

        {loadError && (
          <div
            role="alert"
            style={{
              display: "flex",
              gap: 8,
              padding: "10px 12px",
              background: "var(--semantic-danger-subtle)",
              border: "1px solid var(--semantic-danger)",
              borderRadius: 8,
              color: "var(--semantic-danger)",
              fontSize: 12,
              marginBottom: 12,
            }}
          >
            <AlertTriangle size={14} /> {loadError}
          </div>
        )}

        {configs === null && (
          <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>…</div>
        )}

        {configs && configs.length === 0 && !loadError && (
          <EmptyState
            icon={Percent}
            title={t("wht.empty_policy_title")}
            description={t("wht.empty_policy_description")}
          />
        )}

        {configs && configs.length > 0 && (
          <div
            style={{
              border: "1px solid var(--border-default)",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            {configs.map((cfg, idx) => {
              const today = new Date().toISOString().slice(0, 10);
              const isActive =
                cfg.activeFrom <= today &&
                (!cfg.activeUntil || cfg.activeUntil >= today);
              return (
                <div
                  key={cfg.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 14,
                    padding: "14px 18px",
                    borderBottom:
                      idx === configs.length - 1
                        ? "none"
                        : "1px solid var(--border-subtle)",
                    background: isActive ? "transparent" : "var(--bg-surface-sunken)",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          padding: "2px 8px",
                          borderRadius: 10,
                          background: isActive
                            ? "var(--accent-primary-subtle)"
                            : "var(--bg-surface)",
                          color: isActive
                            ? "var(--accent-primary)"
                            : "var(--text-tertiary)",
                          border: isActive
                            ? "1px solid var(--accent-primary-border)"
                            : "1px solid var(--border-default)",
                        }}
                      >
                        {isActive ? t("wht.status_active") : t("wht.status_inactive")}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--text-tertiary)",
                        }}
                      >
                        <LtrText>
                          <span style={{ fontFamily: "'DM Mono', monospace" }}>
                            {cfg.activeFrom}
                          </span>
                        </LtrText>{" "}
                        →{" "}
                        <LtrText>
                          <span style={{ fontFamily: "'DM Mono', monospace" }}>
                            {cfg.activeUntil || "…"}
                          </span>
                        </LtrText>
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 14,
                        marginTop: 8,
                        fontSize: 11,
                        color: "var(--text-tertiary)",
                      }}
                    >
                      <RateChip
                        label={t("wht.cat_SERVICE")}
                        bps={cfg.rateServicePercent}
                      />
                      <RateChip
                        label={t("wht.cat_PROFESSIONAL")}
                        bps={cfg.rateProfessionalPercent}
                      />
                      <RateChip
                        label={t("wht.cat_RENTAL")}
                        bps={cfg.rateRentalPercent}
                      />
                      <RateChip
                        label={t("wht.cat_INTEREST")}
                        bps={cfg.rateInterestPercent}
                      />
                      <RateChip
                        label={t("wht.cat_CUSTOM")}
                        bps={cfg.rateCustomPercent}
                      />
                      <RateChip
                        label={t("wht.min_threshold")}
                        raw={
                          cfg.minThresholdKwd
                            ? `${cfg.minThresholdKwd} KWD`
                            : "—"
                        }
                      />
                    </div>
                    {cfg.notes && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-secondary)",
                          marginTop: 6,
                          fontStyle: "italic",
                        }}
                      >
                        {cfg.notes}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <button
                      onClick={() =>
                        setModalState({ open: true, mode: "edit", config: cfg })
                      }
                      disabled={readOnly}
                      style={{ ...btnMini, opacity: readOnly ? 0.5 : 1, cursor: readOnly ? "not-allowed" : btnMini.cursor }}
                    >
                      <Edit3
                        size={11}
                        style={{ verticalAlign: "middle", marginInlineEnd: 4 }}
                      />
                      {t("wht.action_edit")}
                    </button>
                    {isActive && (
                      <button
                        onClick={() => handleDeactivate(cfg)}
                        disabled={readOnly}
                        style={{
                          ...btnMini,
                          color: "var(--semantic-danger)",
                          borderColor: "var(--semantic-danger-border)",
                          opacity: readOnly ? 0.5 : 1,
                          cursor: readOnly ? "not-allowed" : btnMini.cursor,
                        }}
                      >
                        {t("wht.action_deactivate")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <WhtConfigModal
          open={modalState.open}
          mode={modalState.mode}
          config={modalState.config}
          onClose={() =>
            setModalState({ open: false, mode: "create", config: null })
          }
          onSaved={() => {
            reload();
            setToast(
              modalState.mode === "edit"
                ? t("wht.saved_edit_toast")
                : t("wht.saved_create_toast"),
            );
          }}
        />
      </Card>

      <Card
        title={t("wht.certificates_title")}
        description={t("wht.certificates_description")}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 12,
            flexWrap: "wrap",
          }}
        >
          {WHT_CATEGORY_FILTERS.map((c) => {
            const on = certCategory === c;
            return (
              <button
                key={c}
                onClick={() => setCertCategory(c)}
                style={{
                  ...btnMini,
                  background: on ? "var(--accent-primary-subtle)" : "transparent",
                  borderColor: on
                    ? "var(--accent-primary-border)"
                    : "var(--border-strong)",
                  color: on ? "var(--accent-primary)" : "var(--text-secondary)",
                }}
              >
                {t(`wht.cert_filter_${c}`)}
              </button>
            );
          })}
        </div>

        {certificates === null && (
          <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>…</div>
        )}

        {certificates && certificates.length === 0 && (
          <EmptyState
            icon={Receipt}
            title={t("wht.empty_certificates_title")}
            description={t("wht.empty_certificates_description")}
          />
        )}

        {certificates && certificates.length > 0 && (
          <div
            style={{
              border: "1px solid var(--border-default)",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            {certificates.map((cert, idx) => (
              <div
                key={cert.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 14,
                  padding: "12px 18px",
                  borderBottom:
                    idx === certificates.length - 1
                      ? "none"
                      : "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                        fontFamily: "'DM Mono', monospace",
                      }}
                    >
                      <LtrText>{cert.certificateNumber}</LtrText>
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: "var(--bg-surface)",
                        color: "var(--text-tertiary)",
                        border: "1px solid var(--border-default)",
                      }}
                    >
                      {t(`wht.cat_${cert.category}`)}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 14,
                      marginTop: 6,
                      fontSize: 11,
                      color: "var(--text-tertiary)",
                    }}
                  >
                    <div>
                      {t("wht.label_gross")}:{" "}
                      <LtrText>
                        <span
                          style={{
                            color: "var(--text-secondary)",
                            fontFamily: "'DM Mono', monospace",
                          }}
                        >
                          {cert.grossAmountKwd} KWD
                        </span>
                      </LtrText>
                    </div>
                    <div>
                      {t("wht.label_rate")}:{" "}
                      <LtrText>
                        <span
                          style={{
                            color: "var(--text-secondary)",
                            fontFamily: "'DM Mono', monospace",
                          }}
                        >
                          {fmtBpsPercent(cert.ratePercent)}
                        </span>
                      </LtrText>
                    </div>
                    <div>
                      {t("wht.label_withheld")}:{" "}
                      <LtrText>
                        <span
                          style={{
                            color: "var(--semantic-danger)",
                            fontFamily: "'DM Mono', monospace",
                            fontWeight: 600,
                          }}
                        >
                          {cert.withheldAmountKwd} KWD
                        </span>
                      </LtrText>
                    </div>
                    <div>
                      {t("wht.label_net_paid")}:{" "}
                      <LtrText>
                        <span
                          style={{
                            color: "var(--accent-primary)",
                            fontFamily: "'DM Mono', monospace",
                            fontWeight: 600,
                          }}
                        >
                          {cert.netPaidAmountKwd} KWD
                        </span>
                      </LtrText>
                    </div>
                    <div>
                      {t("wht.label_payment_date")}:{" "}
                      <LtrText>
                        <span
                          style={{
                            color: "var(--text-secondary)",
                            fontFamily: "'DM Mono', monospace",
                          }}
                        >
                          {cert.paymentDate}
                        </span>
                      </LtrText>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Cost allocation (FN-243, 2026-04-19) ────────────────────────
// Shared-overhead allocation rules. Each rule has a source account
// + ordered targets (costCenterLabel, weight). Rules are immutable
// after create; compute preview is a separate API call.
function CostAllocationSection({ readOnly = false }) {
  const { t } = useTranslation("setup");
  const [rows, setRows] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [activeOnly, setActiveOnly] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [computeState, setComputeState] = useState({
    open: false,
    rule: null,
    periodFrom: "",
    periodTo: "",
    result: null,
    loading: false,
    error: null,
  });
  const [toast, setToast] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const reload = async () => {
    setLoadError(null);
    try {
      const filters = activeOnly ? { activeOnly: true } : {};
      const list = await listCostAllocationRules(filters);
      setRows(list || []);
    } catch (err) {
      setRows([]);
      setLoadError(err?.message || t("cost_allocation.error_load"));
    }
  };

  useEffect(() => {
    reload();
    getAccountsFlat()
      .then((arr) =>
        setAccounts(
          (arr || []).map((a) => ({
            id: a.raw?.id || a.id || a.code,
            code: a.code,
            nameEn: a.name || a.nameEn,
          })),
        ),
      )
      .catch(() => setAccounts([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOnly]);

  const handleDeactivate = async (rule) => {
    try {
      await deactivateCostAllocationRule(rule.id);
      setToast(t("cost_allocation.deactivated_toast"));
      reload();
    } catch (err) {
      setToast(err?.message || t("cost_allocation.error_deactivate"));
    }
  };

  const openCompute = (rule) => {
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    const todayIso = today.toISOString().slice(0, 10);
    setComputeState({
      open: true,
      rule,
      periodFrom: firstOfMonth,
      periodTo: todayIso,
      result: null,
      loading: false,
      error: null,
    });
  };

  const runCompute = async () => {
    if (!computeState.rule) return;
    setComputeState((s) => ({ ...s, loading: true, error: null, result: null }));
    try {
      const result = await computeCostAllocation(computeState.rule.id, {
        periodFrom: computeState.periodFrom,
        periodTo: computeState.periodTo,
      });
      setComputeState((s) => ({ ...s, loading: false, result }));
    } catch (err) {
      setComputeState((s) => ({
        ...s,
        loading: false,
        error: err?.message || t("cost_allocation.error_compute"),
      }));
    }
  };

  const accountLabel = (accountId) => {
    const acct = accounts.find((a) => a.id === accountId);
    return acct ? `${acct.code} — ${acct.nameEn}` : accountId;
  };

  return (
    <Card
      title={t("cost_allocation.title")}
      description={t("cost_allocation.description")}
      extra={
        <button
          onClick={() => setCreateOpen(true)}
          disabled={readOnly}
          style={{ ...btnPrimary(false), opacity: readOnly ? 0.5 : 1, cursor: readOnly ? "not-allowed" : btnPrimary(false).cursor }}
        >
          <Plus
            size={13}
            style={{ verticalAlign: "middle", marginInlineEnd: 6 }}
          />
          {t("cost_allocation.add_rule")}
        </button>
      }
    >
      <Toast text={toast} onClear={() => setToast(null)} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <button
          onClick={() => setActiveOnly(false)}
          style={{
            ...btnMini,
            background: !activeOnly
              ? "var(--accent-primary-subtle)"
              : "transparent",
            borderColor: !activeOnly
              ? "var(--accent-primary-border)"
              : "var(--border-strong)",
            color: !activeOnly
              ? "var(--accent-primary)"
              : "var(--text-secondary)",
          }}
        >
          {t("cost_allocation.filter_all")}
        </button>
        <button
          onClick={() => setActiveOnly(true)}
          style={{
            ...btnMini,
            background: activeOnly
              ? "var(--accent-primary-subtle)"
              : "transparent",
            borderColor: activeOnly
              ? "var(--accent-primary-border)"
              : "var(--border-strong)",
            color: activeOnly
              ? "var(--accent-primary)"
              : "var(--text-secondary)",
          }}
        >
          {t("cost_allocation.filter_active_only")}
        </button>
      </div>

      {loadError && (
        <div
          role="alert"
          style={{
            display: "flex",
            gap: 8,
            padding: "10px 12px",
            background: "var(--semantic-danger-subtle)",
            border: "1px solid var(--semantic-danger)",
            borderRadius: 8,
            color: "var(--semantic-danger)",
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          <AlertTriangle size={14} /> {loadError}
        </div>
      )}

      {rows === null && (
        <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>…</div>
      )}

      {rows && rows.length === 0 && !loadError && (
        <EmptyState
          icon={Split}
          title={t("cost_allocation.empty_title")}
          description={t("cost_allocation.empty_description")}
        />
      )}

      {rows && rows.length > 0 && (
        <div
          style={{
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {rows.map((rule, idx) => {
            const today = new Date().toISOString().slice(0, 10);
            const isActive =
              rule.activeFrom <= today &&
              (!rule.activeUntil || rule.activeUntil >= today);
            const totalWeight = (rule.targets || []).reduce(
              (a, t) => a + Number(t.weight || 0),
              0,
            );
            return (
              <div
                key={rule.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 14,
                  padding: "14px 18px",
                  borderBottom:
                    idx === rows.length - 1
                      ? "none"
                      : "1px solid var(--border-subtle)",
                  background: isActive ? "transparent" : "var(--bg-surface-sunken)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}
                    >
                      {rule.name}
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: isActive
                          ? "var(--accent-primary-subtle)"
                          : "var(--bg-surface)",
                        color: isActive
                          ? "var(--accent-primary)"
                          : "var(--text-tertiary)",
                        border: isActive
                          ? "1px solid var(--accent-primary-border)"
                          : "1px solid var(--border-default)",
                      }}
                    >
                      {isActive
                        ? t("cost_allocation.status_active")
                        : t("cost_allocation.status_inactive")}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: "var(--bg-surface)",
                        color: "var(--text-tertiary)",
                        border: "1px solid var(--border-default)",
                      }}
                    >
                      {t(`cost_allocation.driver_${rule.driverType}`)}
                    </span>
                  </div>
                  {rule.description && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        marginTop: 4,
                      }}
                    >
                      {rule.description}
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 14,
                      marginTop: 6,
                      fontSize: 11,
                      color: "var(--text-tertiary)",
                    }}
                  >
                    <div>
                      {t("cost_allocation.label_source")}:{" "}
                      <LtrText>
                        <span
                          style={{
                            color: "var(--text-secondary)",
                            fontFamily: "'DM Mono', monospace",
                          }}
                        >
                          {accountLabel(rule.sourceAccountId)}
                        </span>
                      </LtrText>
                    </div>
                    <div>
                      {t("cost_allocation.label_targets")}:{" "}
                      <span style={{ color: "var(--text-secondary)" }}>
                        {(rule.targets || []).length}
                      </span>
                    </div>
                    <div>
                      {t("cost_allocation.label_total_weight")}:{" "}
                      <LtrText>
                        <span
                          style={{
                            color: "var(--text-secondary)",
                            fontFamily: "'DM Mono', monospace",
                          }}
                        >
                          {totalWeight.toFixed(3)}
                        </span>
                      </LtrText>
                    </div>
                    <div>
                      {t("cost_allocation.label_active_from")}:{" "}
                      <LtrText>
                        <span
                          style={{
                            color: "var(--text-secondary)",
                            fontFamily: "'DM Mono', monospace",
                          }}
                        >
                          {rule.activeFrom}
                        </span>
                      </LtrText>
                    </div>
                  </div>
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <button onClick={() => openCompute(rule)} style={btnMini}>
                    <Play
                      size={11}
                      style={{ verticalAlign: "middle", marginInlineEnd: 4 }}
                    />
                    {t("cost_allocation.action_compute")}
                  </button>
                  {isActive && (
                    <button
                      onClick={() => handleDeactivate(rule)}
                      disabled={readOnly}
                      style={{
                        ...btnMini,
                        color: "var(--semantic-danger)",
                        borderColor: "var(--semantic-danger-border)",
                        opacity: readOnly ? 0.5 : 1,
                        cursor: readOnly ? "not-allowed" : btnMini.cursor,
                      }}
                    >
                      {t("cost_allocation.action_deactivate")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Compute drawer */}
      {computeState.open && (
        <ComputeDrawer
          state={computeState}
          setState={setComputeState}
          runCompute={runCompute}
        />
      )}

      <CostAllocationRuleModal
        open={createOpen}
        accounts={accounts}
        onClose={() => setCreateOpen(false)}
        onSaved={() => {
          reload();
          setToast(t("cost_allocation.created_toast"));
        }}
      />
    </Card>
  );
}

function ComputeDrawer({ state, setState, runCompute }) {
  const { t } = useTranslation("setup");
  const { rule, periodFrom, periodTo, result, loading, error } = state;
  const close = () =>
    setState({
      open: false,
      rule: null,
      periodFrom: "",
      periodTo: "",
      result: null,
      loading: false,
      error: null,
    });
  useEscapeKey(close, !!rule);

  return (
    <>
      <div
        onClick={close}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
          zIndex: 300,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: 0,
          insetInlineEnd: 0,
          height: "100vh",
          width: 520,
          background: "var(--panel-bg)",
          borderInlineStart: "1px solid var(--border-default)",
          zIndex: 301,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-24px 0 60px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.15em",
                color: "var(--text-tertiary)",
              }}
            >
              {t("cost_allocation.compute_label")}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22,
                color: "var(--text-primary)",
                marginTop: 2,
              }}
            >
              {rule?.name}
            </div>
          </div>
          <button
            onClick={close}
            aria-label={t("cost_allocation.close")}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-tertiary)",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <XIcon size={18} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "18px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.15em",
                  color: "var(--text-tertiary)",
                  marginBottom: 6,
                }}
              >
                {t("cost_allocation.field_period_from")}
              </div>
              <input
                type="date"
                value={periodFrom}
                onChange={(e) =>
                  setState((s) => ({ ...s, periodFrom: e.target.value }))
                }
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.15em",
                  color: "var(--text-tertiary)",
                  marginBottom: 6,
                }}
              >
                {t("cost_allocation.field_period_to")}
              </div>
              <input
                type="date"
                value={periodTo}
                onChange={(e) =>
                  setState((s) => ({ ...s, periodTo: e.target.value }))
                }
                style={inputStyle}
              />
            </div>
          </div>

          <button
            onClick={runCompute}
            disabled={loading || !periodFrom || !periodTo}
            style={btnPrimary(loading)}
          >
            {loading ? (
              <>
                <Spinner size={13} />
                &nbsp;{t("cost_allocation.computing")}
              </>
            ) : (
              t("cost_allocation.run_compute")
            )}
          </button>

          {error && (
            <div
              role="alert"
              style={{
                display: "flex",
                gap: 8,
                padding: "10px 12px",
                background: "var(--semantic-danger-subtle)",
                border: "1px solid var(--semantic-danger)",
                borderRadius: 8,
                color: "var(--semantic-danger)",
                fontSize: 12,
              }}
            >
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          {result && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div
                style={{
                  padding: "10px 12px",
                  background: "var(--bg-surface-sunken)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "var(--text-secondary)",
                }}
              >
                <div>
                  {t("cost_allocation.source_balance")}:{" "}
                  <LtrText>
                    <span style={{ fontFamily: "'DM Mono', monospace" }}>
                      {result.sourcePeriodBalanceKwd} KWD
                    </span>
                  </LtrText>
                </div>
                <div style={{ marginTop: 4 }}>
                  {t("cost_allocation.rounding_residual")}:{" "}
                  <LtrText>
                    <span
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        color:
                          Math.abs(Number(result.roundingResidualKwd)) > 0.001
                            ? "var(--semantic-warning)"
                            : "var(--text-secondary)",
                      }}
                    >
                      {result.roundingResidualKwd} KWD
                    </span>
                  </LtrText>
                </div>
                {result.note && (
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 11,
                      color: "var(--text-tertiary)",
                      fontStyle: "italic",
                    }}
                  >
                    {result.note}
                  </div>
                )}
              </div>

              <div
                style={{
                  border: "1px solid var(--border-default)",
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                {result.rows.map((row, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 14px",
                      borderBottom:
                        idx === result.rows.length - 1
                          ? "none"
                          : "1px solid var(--border-subtle)",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          color: "var(--text-primary)",
                          fontWeight: 500,
                        }}
                      >
                        {row.costCenterLabel}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text-tertiary)",
                          marginTop: 2,
                        }}
                      >
                        <LtrText>
                          <span style={{ fontFamily: "'DM Mono', monospace" }}>
                            {Number(row.weightPercent).toFixed(2)}% · {t("cost_allocation.weight_short")} {row.weight}
                          </span>
                        </LtrText>
                      </div>
                    </div>
                    <div
                      style={{
                        fontFamily: "'DM Mono', monospace",
                        fontSize: 14,
                        fontWeight: 700,
                        color: "var(--text-primary)",
                      }}
                    >
                      <LtrText>{row.amountKwd} KWD</LtrText>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Related-party register + IAS 24 report (FN-254, 2026-04-19) ─
// Register of related parties (vendors or customers) with IAS 24
// nature-of-relationship classification. Includes a period
// aggregation report over bills + invoices. Memo-only; no JE
// posting. OWNER-only mutations; reads open to OWNER/ACCOUNTANT/
// AUDITOR.
const RP_NATURE_FILTERS = [
  "ALL",
  "PARENT",
  "SUBSIDIARY",
  "ASSOCIATE",
  "JOINT_VENTURE",
  "KEY_MANAGEMENT_PERSONNEL",
  "CLOSE_FAMILY_MEMBER",
  "OTHER_RELATED_ENTITY",
  "OTHER",
];

function RelatedPartySection({ readOnly = false }) {
  const { t } = useTranslation("setup");
  const [rows, setRows] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [activeOnly, setActiveOnly] = useState(false);
  const [natureFilter, setNatureFilter] = useState("ALL");
  const [modalState, setModalState] = useState({
    open: false,
    mode: "create",
    entry: null,
  });
  const [reportState, setReportState] = useState({
    open: false,
    periodFrom: "",
    periodTo: "",
    result: null,
    loading: false,
    error: null,
  });
  const [toast, setToast] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const reload = async () => {
    setLoadError(null);
    try {
      const filters = {};
      if (activeOnly) filters.activeOnly = true;
      if (natureFilter !== "ALL")
        filters.natureOfRelationship = natureFilter;
      const list = await listRelatedParties(filters);
      setRows(list || []);
    } catch (err) {
      setRows([]);
      setLoadError(err?.message || t("related_party.error_load"));
    }
  };

  useEffect(() => {
    reload();
    Promise.all([
      listVendorsForRelatedParty().catch(() => []),
      listCustomersForRelatedParty().catch(() => []),
    ]).then(([v, c]) => {
      setVendors(v || []);
      setCustomers(c || []);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOnly, natureFilter]);

  const handleDeactivate = async (entry) => {
    try {
      await deactivateRelatedParty(entry.id);
      setToast(t("related_party.deactivated_toast"));
      reload();
    } catch (err) {
      setToast(err?.message || t("related_party.error_deactivate"));
    }
  };

  const openReport = () => {
    const today = new Date();
    const firstOfYear = new Date(today.getFullYear(), 0, 1)
      .toISOString()
      .slice(0, 10);
    const todayIso = today.toISOString().slice(0, 10);
    setReportState({
      open: true,
      periodFrom: firstOfYear,
      periodTo: todayIso,
      result: null,
      loading: false,
      error: null,
    });
  };

  const runReport = async () => {
    setReportState((s) => ({ ...s, loading: true, error: null, result: null }));
    try {
      const result = await getRelatedPartyReport({
        periodFrom: reportState.periodFrom,
        periodTo: reportState.periodTo,
      });
      setReportState((s) => ({ ...s, loading: false, result }));
    } catch (err) {
      setReportState((s) => ({
        ...s,
        loading: false,
        error: err?.message || t("related_party.error_report"),
      }));
    }
  };

  const counterpartyLabel = (entry) => {
    if (entry.counterpartyType === "VENDOR") {
      const v = vendors.find((x) => x.id === entry.counterpartyVendorId);
      return v ? v.nameEn || v.name || v.nameAr || v.id : entry.counterpartyVendorId;
    }
    const c = customers.find((x) => x.id === entry.counterpartyCustomerId);
    return c ? c.nameEn || c.name || c.nameAr || c.id : entry.counterpartyCustomerId;
  };

  return (
    <Card
      title={t("related_party.title")}
      description={t("related_party.description")}
      extra={
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={openReport} style={btnMini}>
            <Play
              size={11}
              style={{ verticalAlign: "middle", marginInlineEnd: 4 }}
            />
            {t("related_party.action_run_report")}
          </button>
          <button
            onClick={() =>
              setModalState({ open: true, mode: "create", entry: null })
            }
            disabled={readOnly}
            style={{ ...btnPrimary(false), opacity: readOnly ? 0.5 : 1, cursor: readOnly ? "not-allowed" : btnPrimary(false).cursor }}
          >
            <Plus
              size={13}
              style={{ verticalAlign: "middle", marginInlineEnd: 6 }}
            />
            {t("related_party.add_entry")}
          </button>
        </div>
      }
    >
      <Toast text={toast} onClear={() => setToast(null)} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 12,
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => setActiveOnly(false)}
          style={{
            ...btnMini,
            background: !activeOnly ? "var(--accent-primary-subtle)" : "transparent",
            borderColor: !activeOnly ? "var(--accent-primary-border)" : "var(--border-strong)",
            color: !activeOnly ? "var(--accent-primary)" : "var(--text-secondary)",
          }}
        >
          {t("related_party.filter_all")}
        </button>
        <button
          onClick={() => setActiveOnly(true)}
          style={{
            ...btnMini,
            background: activeOnly ? "var(--accent-primary-subtle)" : "transparent",
            borderColor: activeOnly ? "var(--accent-primary-border)" : "var(--border-strong)",
            color: activeOnly ? "var(--accent-primary)" : "var(--text-secondary)",
          }}
        >
          {t("related_party.filter_active_only")}
        </button>
        <select
          value={natureFilter}
          onChange={(e) => setNatureFilter(e.target.value)}
          style={{
            ...btnMini,
            padding: "6px 10px",
            marginInlineStart: 8,
          }}
        >
          {RP_NATURE_FILTERS.map((n) => (
            <option key={n} value={n}>
              {t(`related_party.nature_filter_${n}`)}
            </option>
          ))}
        </select>
      </div>

      {loadError && (
        <div
          role="alert"
          style={{
            display: "flex",
            gap: 8,
            padding: "10px 12px",
            background: "var(--semantic-danger-subtle)",
            border: "1px solid var(--semantic-danger)",
            borderRadius: 8,
            color: "var(--semantic-danger)",
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          <AlertTriangle size={14} /> {loadError}
        </div>
      )}

      {rows === null && (
        <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>…</div>
      )}

      {rows && rows.length === 0 && !loadError && (
        <EmptyState
          icon={UserCheck}
          title={t("related_party.empty_title")}
          description={t("related_party.empty_description")}
        />
      )}

      {rows && rows.length > 0 && (
        <div
          style={{
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {rows.map((entry, idx) => {
            const today = new Date().toISOString().slice(0, 10);
            const isActive =
              entry.activeFrom <= today &&
              (!entry.activeUntil || entry.activeUntil >= today);
            return (
              <div
                key={entry.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 14,
                  padding: "14px 18px",
                  borderBottom:
                    idx === rows.length - 1
                      ? "none"
                      : "1px solid var(--border-subtle)",
                  background: isActive ? "transparent" : "var(--bg-surface-sunken)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}
                    >
                      {counterpartyLabel(entry)}
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: "var(--bg-surface)",
                        color: "var(--text-tertiary)",
                        border: "1px solid var(--border-default)",
                      }}
                    >
                      {t(`related_party.type_${entry.counterpartyType}`)}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: isActive
                          ? "var(--accent-primary-subtle)"
                          : "var(--bg-surface)",
                        color: isActive
                          ? "var(--accent-primary)"
                          : "var(--text-tertiary)",
                        border: isActive
                          ? "1px solid var(--accent-primary-border)"
                          : "1px solid var(--border-default)",
                      }}
                    >
                      {isActive
                        ? t("related_party.status_active")
                        : t("related_party.status_inactive")}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: "var(--bg-surface)",
                        color: "var(--text-secondary)",
                        border: "1px solid var(--border-default)",
                      }}
                    >
                      {t(`related_party.nature_${entry.natureOfRelationship}`)}
                    </span>
                  </div>
                  {entry.disclosureNote && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        marginTop: 4,
                        fontStyle: "italic",
                      }}
                    >
                      {entry.disclosureNote}
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 14,
                      marginTop: 6,
                      fontSize: 11,
                      color: "var(--text-tertiary)",
                    }}
                  >
                    <div>
                      {t("related_party.label_active_from")}:{" "}
                      <LtrText>
                        <span
                          style={{
                            color: "var(--text-secondary)",
                            fontFamily: "'DM Mono', monospace",
                          }}
                        >
                          {entry.activeFrom}
                        </span>
                      </LtrText>
                    </div>
                    {entry.activeUntil && (
                      <div>
                        {t("related_party.label_active_until")}:{" "}
                        <LtrText>
                          <span
                            style={{
                              color: "var(--text-secondary)",
                              fontFamily: "'DM Mono', monospace",
                            }}
                          >
                            {entry.activeUntil}
                          </span>
                        </LtrText>
                      </div>
                    )}
                  </div>
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <button
                    onClick={() =>
                      setModalState({ open: true, mode: "edit", entry })
                    }
                    disabled={readOnly}
                    style={{ ...btnMini, opacity: readOnly ? 0.5 : 1, cursor: readOnly ? "not-allowed" : btnMini.cursor }}
                  >
                    <Edit3
                      size={11}
                      style={{ verticalAlign: "middle", marginInlineEnd: 4 }}
                    />
                    {t("related_party.action_edit")}
                  </button>
                  {isActive && (
                    <button
                      onClick={() => handleDeactivate(entry)}
                      disabled={readOnly}
                      style={{
                        ...btnMini,
                        color: "var(--semantic-danger)",
                        borderColor: "var(--semantic-danger-border)",
                        opacity: readOnly ? 0.5 : 1,
                        cursor: readOnly ? "not-allowed" : btnMini.cursor,
                      }}
                    >
                      {t("related_party.action_deactivate")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Report drawer */}
      {reportState.open && (
        <RelatedPartyReportDrawer
          state={reportState}
          setState={setReportState}
          runReport={runReport}
          counterpartyLabel={counterpartyLabel}
        />
      )}

      <RelatedPartyModal
        open={modalState.open}
        mode={modalState.mode}
        entry={modalState.entry}
        vendors={vendors}
        customers={customers}
        onClose={() =>
          setModalState({ open: false, mode: "create", entry: null })
        }
        onSaved={() => {
          reload();
          setToast(
            modalState.mode === "edit"
              ? t("related_party.saved_edit_toast")
              : t("related_party.saved_create_toast"),
          );
        }}
      />
    </Card>
  );
}

function RelatedPartyReportDrawer({ state, setState, runReport, counterpartyLabel }) {
  const { t } = useTranslation("setup");
  const { periodFrom, periodTo, result, loading, error } = state;
  const close = () =>
    setState({
      open: false,
      periodFrom: "",
      periodTo: "",
      result: null,
      loading: false,
      error: null,
    });
  useEscapeKey(close, state.open);

  return (
    <>
      <div
        onClick={close}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
          zIndex: 300,
        }}
      />
      <div
        style={{
          position: "fixed",
          top: 0,
          insetInlineEnd: 0,
          height: "100vh",
          width: 580,
          background: "var(--panel-bg)",
          borderInlineStart: "1px solid var(--border-default)",
          zIndex: 301,
          display: "flex",
          flexDirection: "column",
          boxShadow: "-24px 0 60px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.15em",
                color: "var(--text-tertiary)",
              }}
            >
              {t("related_party.report_label")}
            </div>
            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 22,
                color: "var(--text-primary)",
                marginTop: 2,
              }}
            >
              {t("related_party.report_title")}
            </div>
          </div>
          <button
            onClick={close}
            aria-label={t("related_party.close")}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-tertiary)",
              cursor: "pointer",
              padding: 4,
            }}
          >
            <XIcon size={18} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "18px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.15em",
                  color: "var(--text-tertiary)",
                  marginBottom: 6,
                }}
              >
                {t("related_party.field_period_from")}
              </div>
              <input
                type="date"
                value={periodFrom}
                onChange={(e) =>
                  setState((s) => ({ ...s, periodFrom: e.target.value }))
                }
                style={inputStyle}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.15em",
                  color: "var(--text-tertiary)",
                  marginBottom: 6,
                }}
              >
                {t("related_party.field_period_to")}
              </div>
              <input
                type="date"
                value={periodTo}
                onChange={(e) =>
                  setState((s) => ({ ...s, periodTo: e.target.value }))
                }
                style={inputStyle}
              />
            </div>
          </div>

          <button
            onClick={runReport}
            disabled={loading || !periodFrom || !periodTo}
            style={btnPrimary(loading)}
          >
            {loading ? (
              <>
                <Spinner size={13} />
                &nbsp;{t("related_party.running")}
              </>
            ) : (
              t("related_party.run_report")
            )}
          </button>

          {error && (
            <div
              role="alert"
              style={{
                display: "flex",
                gap: 8,
                padding: "10px 12px",
                background: "var(--semantic-danger-subtle)",
                border: "1px solid var(--semantic-danger)",
                borderRadius: 8,
                color: "var(--semantic-danger)",
                fontSize: 12,
              }}
            >
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          {result && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  padding: "12px 14px",
                  background: "var(--bg-surface-sunken)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 8,
                  fontSize: 12,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                  gap: 10,
                }}
              >
                <TotalCell
                  label={t("related_party.total_purchases")}
                  value={`${result.totals.purchasesKwd} KWD`}
                />
                <TotalCell
                  label={t("related_party.total_purchase_payments")}
                  value={`${result.totals.purchasePaymentsKwd} KWD`}
                />
                <TotalCell
                  label={t("related_party.total_sales")}
                  value={`${result.totals.salesKwd} KWD`}
                />
                <TotalCell
                  label={t("related_party.total_sales_receipts")}
                  value={`${result.totals.salesReceiptsKwd} KWD`}
                />
                <TotalCell
                  label={t("related_party.total_txn_count")}
                  value={String(result.totals.transactionCount)}
                />
              </div>

              {result.rows.length === 0 && (
                <div
                  style={{
                    padding: "20px",
                    textAlign: "center",
                    color: "var(--text-tertiary)",
                    fontSize: 12,
                  }}
                >
                  {t("related_party.report_empty")}
                </div>
              )}

              {result.rows.length > 0 && (
                <div
                  style={{
                    border: "1px solid var(--border-default)",
                    borderRadius: 8,
                    overflow: "hidden",
                  }}
                >
                  {result.rows.map((row, idx) => (
                    <div
                      key={row.relatedPartyId}
                      style={{
                        padding: "12px 14px",
                        borderBottom:
                          idx === result.rows.length - 1
                            ? "none"
                            : "1px solid var(--border-subtle)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--text-primary)",
                          }}
                        >
                          {counterpartyLabel({
                            counterpartyType: row.counterpartyType,
                            counterpartyVendorId:
                              row.counterpartyType === "VENDOR"
                                ? row.counterpartyId
                                : null,
                            counterpartyCustomerId:
                              row.counterpartyType === "CUSTOMER"
                                ? row.counterpartyId
                                : null,
                          })}
                        </div>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: "0.1em",
                            padding: "2px 8px",
                            borderRadius: 10,
                            background: "var(--bg-surface)",
                            color: "var(--text-secondary)",
                            border: "1px solid var(--border-default)",
                          }}
                        >
                          {t(
                            `related_party.nature_${row.natureOfRelationship}`,
                          )}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 14,
                          marginTop: 6,
                          fontSize: 11,
                          color: "var(--text-tertiary)",
                        }}
                      >
                        <div>
                          {t("related_party.label_purchases")}:{" "}
                          <LtrText>
                            <span
                              style={{
                                color: "var(--text-secondary)",
                                fontFamily: "'DM Mono', monospace",
                              }}
                            >
                              {row.purchasesKwd} KWD
                            </span>
                          </LtrText>
                        </div>
                        <div>
                          {t("related_party.label_sales")}:{" "}
                          <LtrText>
                            <span
                              style={{
                                color: "var(--text-secondary)",
                                fontFamily: "'DM Mono', monospace",
                              }}
                            >
                              {row.salesKwd} KWD
                            </span>
                          </LtrText>
                        </div>
                        <div>
                          {t("related_party.label_txns")}:{" "}
                          <LtrText>
                            <span
                              style={{
                                color: "var(--text-secondary)",
                                fontFamily: "'DM Mono', monospace",
                              }}
                            >
                              {row.transactionCount}
                            </span>
                          </LtrText>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Warranty Provision Policy (FN-256, 2026-04-19) ────────────────
// Per-tenant effective-dated warranty provision policy. Basis:
// REVENUE_PERCENT (bps of revenue) or PER_UNIT (KWD/unit). Consumed
// by a future period-end accrual runner. OWNER writes; OWNER/
// ACCOUNTANT/AUDITOR reads.
function WarrantySection({ readOnly = false }) {
  const { t } = useTranslation("setup");
  const [rows, setRows] = useState(null);
  const [activeOnly, setActiveOnly] = useState(false);
  const [modalState, setModalState] = useState({
    open: false,
    mode: "create",
    policy: null,
  });
  const [toast, setToast] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const reload = async () => {
    setLoadError(null);
    try {
      const filters = activeOnly ? { activeOnly: true } : {};
      const list = await listWarrantyPolicies(filters);
      setRows(list || []);
    } catch (err) {
      setRows([]);
      setLoadError(err?.message || t("warranty.error_load"));
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOnly]);

  const handleDeactivate = async (policy) => {
    try {
      await deactivateWarrantyPolicy(policy.id);
      setToast(t("warranty.deactivated_toast"));
      reload();
    } catch (err) {
      setToast(err?.message || t("warranty.error_deactivate"));
    }
  };

  const formatRateDisplay = (policy) => {
    if (policy.basis === "REVENUE_PERCENT") {
      const bps = policy.ratePercent;
      if (bps == null) return "—";
      return `${(bps / 100).toFixed(2)}% ${t("warranty.of_revenue")}`;
    }
    return `${policy.perUnitAmountKwd || "0.000"} KWD / ${t("warranty.per_unit_label")}`;
  };

  return (
    <Card
      title={t("warranty.title")}
      description={t("warranty.description")}
      extra={
        <button
          onClick={() =>
            setModalState({ open: true, mode: "create", policy: null })
          }
          disabled={readOnly}
          style={{ ...btnPrimary(false), opacity: readOnly ? 0.5 : 1, cursor: readOnly ? "not-allowed" : btnPrimary(false).cursor }}
        >
          <Plus
            size={13}
            style={{ verticalAlign: "middle", marginInlineEnd: 6 }}
          />
          {t("warranty.add_policy")}
        </button>
      }
    >
      <Toast text={toast} onClear={() => setToast(null)} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <button
          onClick={() => setActiveOnly(false)}
          style={{
            ...btnMini,
            background: !activeOnly
              ? "var(--accent-primary-subtle)"
              : "transparent",
            borderColor: !activeOnly
              ? "var(--accent-primary-border)"
              : "var(--border-strong)",
            color: !activeOnly
              ? "var(--accent-primary)"
              : "var(--text-secondary)",
          }}
        >
          {t("warranty.filter_all")}
        </button>
        <button
          onClick={() => setActiveOnly(true)}
          style={{
            ...btnMini,
            background: activeOnly
              ? "var(--accent-primary-subtle)"
              : "transparent",
            borderColor: activeOnly
              ? "var(--accent-primary-border)"
              : "var(--border-strong)",
            color: activeOnly
              ? "var(--accent-primary)"
              : "var(--text-secondary)",
          }}
        >
          {t("warranty.filter_active_only")}
        </button>
      </div>

      {loadError && (
        <div
          role="alert"
          style={{
            display: "flex",
            gap: 8,
            padding: "10px 12px",
            background: "var(--semantic-danger-subtle)",
            border: "1px solid var(--semantic-danger)",
            borderRadius: 8,
            color: "var(--semantic-danger)",
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          <AlertTriangle size={14} /> {loadError}
        </div>
      )}

      {rows === null && (
        <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>…</div>
      )}

      {rows && rows.length === 0 && !loadError && (
        <EmptyState
          icon={ShieldAlert}
          title={t("warranty.empty_title")}
          description={t("warranty.empty_description")}
        />
      )}

      {rows && rows.length > 0 && (
        <div
          style={{
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {rows.map((policy, idx) => {
            const today = new Date().toISOString().slice(0, 10);
            const isActive =
              policy.activeFrom <= today &&
              (!policy.activeUntil || policy.activeUntil >= today);
            return (
              <div
                key={policy.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 14,
                  padding: "14px 18px",
                  borderBottom:
                    idx === rows.length - 1
                      ? "none"
                      : "1px solid var(--border-subtle)",
                  background: isActive
                    ? "transparent"
                    : "var(--bg-surface-sunken)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: isActive
                          ? "var(--accent-primary-subtle)"
                          : "var(--bg-surface)",
                        color: isActive
                          ? "var(--accent-primary)"
                          : "var(--text-tertiary)",
                        border: isActive
                          ? "1px solid var(--accent-primary-border)"
                          : "1px solid var(--border-default)",
                      }}
                    >
                      {isActive
                        ? t("warranty.status_active")
                        : t("warranty.status_inactive")}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: "var(--bg-surface)",
                        color: "var(--text-tertiary)",
                        border: "1px solid var(--border-default)",
                      }}
                    >
                      {t(`warranty.basis_${policy.basis}`)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "var(--text-primary)",
                      fontFamily: "'DM Mono', monospace",
                      marginTop: 6,
                    }}
                  >
                    <LtrText>{formatRateDisplay(policy)}</LtrText>
                  </div>
                  {policy.notes && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        marginTop: 4,
                        fontStyle: "italic",
                      }}
                    >
                      {policy.notes}
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 14,
                      marginTop: 6,
                      fontSize: 11,
                      color: "var(--text-tertiary)",
                    }}
                  >
                    <div>
                      {t("warranty.label_pl_role")}:{" "}
                      <LtrText>
                        <span
                          style={{
                            color: "var(--text-secondary)",
                            fontFamily: "'DM Mono', monospace",
                          }}
                        >
                          {policy.plRoleCode || "—"}
                        </span>
                      </LtrText>
                    </div>
                    <div>
                      {t("warranty.label_liability_role")}:{" "}
                      <LtrText>
                        <span
                          style={{
                            color: "var(--text-secondary)",
                            fontFamily: "'DM Mono', monospace",
                          }}
                        >
                          {policy.liabilityRoleCode || "—"}
                        </span>
                      </LtrText>
                    </div>
                    <div>
                      {t("warranty.label_active_from")}:{" "}
                      <LtrText>
                        <span
                          style={{
                            color: "var(--text-secondary)",
                            fontFamily: "'DM Mono', monospace",
                          }}
                        >
                          {policy.activeFrom}
                        </span>
                      </LtrText>
                    </div>
                    {policy.activeUntil && (
                      <div>
                        {t("warranty.label_active_until")}:{" "}
                        <LtrText>
                          <span
                            style={{
                              color: "var(--text-secondary)",
                              fontFamily: "'DM Mono', monospace",
                            }}
                          >
                            {policy.activeUntil}
                          </span>
                        </LtrText>
                      </div>
                    )}
                  </div>
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <button
                    onClick={() =>
                      setModalState({ open: true, mode: "edit", policy })
                    }
                    disabled={readOnly}
                    style={{ ...btnMini, opacity: readOnly ? 0.5 : 1, cursor: readOnly ? "not-allowed" : btnMini.cursor }}
                  >
                    <Edit3
                      size={11}
                      style={{ verticalAlign: "middle", marginInlineEnd: 4 }}
                    />
                    {t("warranty.action_edit")}
                  </button>
                  {isActive && (
                    <button
                      onClick={() => handleDeactivate(policy)}
                      disabled={readOnly}
                      style={{
                        ...btnMini,
                        color: "var(--semantic-danger)",
                        borderColor: "var(--semantic-danger-border)",
                        opacity: readOnly ? 0.5 : 1,
                        cursor: readOnly ? "not-allowed" : btnMini.cursor,
                      }}
                    >
                      {t("warranty.action_deactivate")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <WarrantyPolicyModal
        open={modalState.open}
        mode={modalState.mode}
        policy={modalState.policy}
        onClose={() =>
          setModalState({ open: false, mode: "create", policy: null })
        }
        onSaved={() => {
          reload();
          setToast(
            modalState.mode === "edit"
              ? t("warranty.saved_edit_toast")
              : t("warranty.saved_create_toast"),
          );
        }}
      />
    </Card>
  );
}

// ── Bank Formats (FN-246, 2026-04-19) ─────────────────────────────
// Per-bank statement-parsing format registry. Effective-dated specs
// with {bankCode, formatVersion, formatType, spec JSON}. Consumed by
// statement-upload parser pipeline. OWNER writes; reads open to
// OWNER/ACCOUNTANT/AUDITOR. Specs are immutable post-create (only
// effectiveUntil + notes mutable via PATCH).
function BankFormatsSection({ readOnly = false }) {
  const { t } = useTranslation("setup");
  const [rows, setRows] = useState(null);
  const [bankCodeFilter, setBankCodeFilter] = useState("");
  const [modalState, setModalState] = useState({
    open: false,
    mode: "create",
    spec: null,
  });
  const [toast, setToast] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const reload = async () => {
    setLoadError(null);
    try {
      const filters = bankCodeFilter ? { bankCode: bankCodeFilter } : {};
      const list = await listBankFormats(filters);
      setRows(list || []);
    } catch (err) {
      setRows([]);
      setLoadError(err?.message || t("bank_formats.error_load"));
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankCodeFilter]);

  const handleDeactivate = async (spec) => {
    try {
      await deactivateBankFormat(spec.id);
      setToast(t("bank_formats.deactivated_toast"));
      reload();
    } catch (err) {
      setToast(err?.message || t("bank_formats.error_deactivate"));
    }
  };

  return (
    <Card
      title={t("bank_formats.title")}
      description={t("bank_formats.description")}
      extra={
        <button
          onClick={() =>
            setModalState({ open: true, mode: "create", spec: null })
          }
          disabled={readOnly}
          style={{ ...btnPrimary(false), opacity: readOnly ? 0.5 : 1, cursor: readOnly ? "not-allowed" : btnPrimary(false).cursor }}
        >
          <Plus
            size={13}
            style={{ verticalAlign: "middle", marginInlineEnd: 6 }}
          />
          {t("bank_formats.add_spec")}
        </button>
      }
    >
      <Toast text={toast} onClear={() => setToast(null)} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div style={{ position: "relative", width: 240 }}>
          <Search
            size={13}
            color="var(--text-tertiary)"
            style={{
              position: "absolute",
              insetInlineStart: 10,
              top: "50%",
              transform: "translateY(-50%)",
            }}
          />
          <input
            value={bankCodeFilter}
            onChange={(e) => setBankCodeFilter(e.target.value)}
            placeholder={t("bank_formats.filter_placeholder")}
            style={{
              ...inputStyle,
              paddingInlineStart: 30,
              fontFamily: "'DM Mono', monospace",
            }}
          />
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          style={{
            display: "flex",
            gap: 8,
            padding: "10px 12px",
            background: "var(--semantic-danger-subtle)",
            border: "1px solid var(--semantic-danger)",
            borderRadius: 8,
            color: "var(--semantic-danger)",
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          <AlertTriangle size={14} /> {loadError}
        </div>
      )}

      {rows === null && (
        <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>…</div>
      )}

      {rows && rows.length === 0 && !loadError && (
        <EmptyState
          icon={FileCode}
          title={t("bank_formats.empty_title")}
          description={t("bank_formats.empty_description")}
        />
      )}

      {rows && rows.length > 0 && (
        <div
          style={{
            border: "1px solid var(--border-default)",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {rows.map((spec, idx) => {
            const today = new Date().toISOString().slice(0, 10);
            const isActive =
              spec.effectiveFrom <= today &&
              (!spec.effectiveUntil || spec.effectiveUntil >= today);
            return (
              <div
                key={spec.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 14,
                  padding: "14px 18px",
                  borderBottom:
                    idx === rows.length - 1
                      ? "none"
                      : "1px solid var(--border-subtle)",
                  background: isActive
                    ? "transparent"
                    : "var(--bg-surface-sunken)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--text-primary)",
                        fontFamily: "'DM Mono', monospace",
                      }}
                    >
                      <LtrText>
                        {spec.bankCode} · {spec.formatVersion}
                      </LtrText>
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: "var(--bg-surface)",
                        color: "var(--text-secondary)",
                        border: "1px solid var(--border-default)",
                      }}
                    >
                      {spec.formatType}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: isActive
                          ? "var(--accent-primary-subtle)"
                          : "var(--bg-surface)",
                        color: isActive
                          ? "var(--accent-primary)"
                          : "var(--text-tertiary)",
                        border: isActive
                          ? "1px solid var(--accent-primary-border)"
                          : "1px solid var(--border-default)",
                      }}
                    >
                      {isActive
                        ? t("bank_formats.status_active")
                        : t("bank_formats.status_inactive")}
                    </span>
                  </div>
                  {spec.notes && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        marginTop: 4,
                        fontStyle: "italic",
                      }}
                    >
                      {spec.notes}
                    </div>
                  )}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 14,
                      marginTop: 6,
                      fontSize: 11,
                      color: "var(--text-tertiary)",
                    }}
                  >
                    <div>
                      {t("bank_formats.label_effective_from")}:{" "}
                      <LtrText>
                        <span
                          style={{
                            color: "var(--text-secondary)",
                            fontFamily: "'DM Mono', monospace",
                          }}
                        >
                          {spec.effectiveFrom}
                        </span>
                      </LtrText>
                    </div>
                    {spec.effectiveUntil && (
                      <div>
                        {t("bank_formats.label_effective_until")}:{" "}
                        <LtrText>
                          <span
                            style={{
                              color: "var(--text-secondary)",
                              fontFamily: "'DM Mono', monospace",
                            }}
                          >
                            {spec.effectiveUntil}
                          </span>
                        </LtrText>
                      </div>
                    )}
                    <div>
                      {t("bank_formats.label_spec_keys")}:{" "}
                      <LtrText>
                        <span
                          style={{
                            color: "var(--text-secondary)",
                            fontFamily: "'DM Mono', monospace",
                          }}
                        >
                          {Object.keys(spec.spec || {}).length}
                        </span>
                      </LtrText>
                    </div>
                  </div>
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <button
                    onClick={() =>
                      setModalState({ open: true, mode: "edit", spec })
                    }
                    disabled={readOnly}
                    style={{ ...btnMini, opacity: readOnly ? 0.5 : 1, cursor: readOnly ? "not-allowed" : btnMini.cursor }}
                  >
                    <Edit3
                      size={11}
                      style={{ verticalAlign: "middle", marginInlineEnd: 4 }}
                    />
                    {t("bank_formats.action_edit")}
                  </button>
                  {isActive && (
                    <button
                      onClick={() => handleDeactivate(spec)}
                      disabled={readOnly}
                      style={{
                        ...btnMini,
                        color: "var(--semantic-danger)",
                        borderColor: "var(--semantic-danger-border)",
                        opacity: readOnly ? 0.5 : 1,
                        cursor: readOnly ? "not-allowed" : btnMini.cursor,
                      }}
                    >
                      {t("bank_formats.action_deactivate")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <BankFormatModal
        open={modalState.open}
        mode={modalState.mode}
        spec={modalState.spec}
        onClose={() =>
          setModalState({ open: false, mode: "create", spec: null })
        }
        onSaved={() => {
          reload();
          setToast(
            modalState.mode === "edit"
              ? t("bank_formats.saved_edit_toast")
              : t("bank_formats.saved_create_toast"),
          );
        }}
      />
    </Card>
  );
}

// ── Leave Provision (FN-255, 2026-04-19) ───────────────────────────
// Per-tenant effective-dated leave accrual policy + read-only
// provision summary widget. Per-employee balance upsert + compute
// are service-layer-exposed but deferred from this ship pending an
// employee-picker primitive (tracked in Future-additions).
function LeaveSection({ readOnly = false }) {
  const { t } = useTranslation("setup");
  const [rows, setRows] = useState(null);
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState(null);
  const [modalState, setModalState] = useState({
    open: false,
    mode: "create",
    policy: null,
  });
  const [toast, setToast] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const reload = async () => {
    setLoadError(null);
    setSummaryError(null);
    try {
      const [list, sum] = await Promise.all([
        listLeavePolicies(),
        getLeaveProvisionSummary().catch((err) => {
          setSummaryError(err?.message || t("leave.error_summary"));
          return null;
        }),
      ]);
      setRows(list || []);
      setSummary(sum);
    } catch (err) {
      setRows([]);
      setLoadError(err?.message || t("leave.error_load"));
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      {/* Summary card */}
      <Card
        title={t("leave.summary_title")}
        description={t("leave.summary_description")}
      >
        {summaryError && (
          <div
            role="alert"
            style={{
              display: "flex",
              gap: 8,
              padding: "10px 12px",
              background: "var(--semantic-danger-subtle)",
              border: "1px solid var(--semantic-danger)",
              borderRadius: 8,
              color: "var(--semantic-danger)",
              fontSize: 12,
            }}
          >
            <AlertTriangle size={14} /> {summaryError}
          </div>
        )}
        {summary && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 12,
              }}
            >
              <SummaryPill
                label={t("leave.summary_employee_count")}
                value={String(summary.employeeCount)}
              />
              <SummaryPill
                label={t("leave.summary_accrued")}
                value={`${summary.totalAccruedDays} ${t("leave.days")}`}
              />
              <SummaryPill
                label={t("leave.summary_taken")}
                value={`${summary.totalTakenDays} ${t("leave.days")}`}
              />
              <SummaryPill
                label={t("leave.summary_outstanding")}
                value={`${summary.netOutstandingDays} ${t("leave.days")}`}
                tone={Number(summary.netOutstandingDays) > 0 ? "accent" : "default"}
              />
              <SummaryPill
                label={t("leave.summary_liability")}
                value={`${summary.estimatedLiabilityKwd} KWD`}
                tone="accent"
              />
            </div>
            {summary.note && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-tertiary)",
                  fontStyle: "italic",
                  marginTop: 10,
                }}
              >
                {summary.note}
              </div>
            )}
          </>
        )}
      </Card>

      {/* Policy list card */}
      <Card
        title={t("leave.policy_title")}
        description={t("leave.policy_description")}
        extra={
          <button
            onClick={() =>
              setModalState({ open: true, mode: "create", policy: null })
            }
            disabled={readOnly}
            style={{ ...btnPrimary(false), opacity: readOnly ? 0.5 : 1, cursor: readOnly ? "not-allowed" : btnPrimary(false).cursor }}
          >
            <Plus
              size={13}
              style={{ verticalAlign: "middle", marginInlineEnd: 6 }}
            />
            {t("leave.add_policy")}
          </button>
        }
      >
        <Toast text={toast} onClear={() => setToast(null)} />

        {loadError && (
          <div
            role="alert"
            style={{
              display: "flex",
              gap: 8,
              padding: "10px 12px",
              background: "var(--semantic-danger-subtle)",
              border: "1px solid var(--semantic-danger)",
              borderRadius: 8,
              color: "var(--semantic-danger)",
              fontSize: 12,
              marginBottom: 12,
            }}
          >
            <AlertTriangle size={14} /> {loadError}
          </div>
        )}

        {rows === null && (
          <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>…</div>
        )}

        {rows && rows.length === 0 && !loadError && (
          <EmptyState
            icon={UserMinus}
            title={t("leave.empty_title")}
            description={t("leave.empty_description")}
          />
        )}

        {rows && rows.length > 0 && (
          <div
            style={{
              border: "1px solid var(--border-default)",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            {rows.map((policy, idx) => {
              const today = new Date().toISOString().slice(0, 10);
              const isActive =
                policy.activeFrom <= today &&
                (!policy.activeUntil || policy.activeUntil >= today);
              return (
                <div
                  key={policy.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 14,
                    padding: "14px 18px",
                    borderBottom:
                      idx === rows.length - 1
                        ? "none"
                        : "1px solid var(--border-subtle)",
                    background: isActive
                      ? "transparent"
                      : "var(--bg-surface-sunken)",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          padding: "2px 8px",
                          borderRadius: 10,
                          background: isActive
                            ? "var(--accent-primary-subtle)"
                            : "var(--bg-surface)",
                          color: isActive
                            ? "var(--accent-primary)"
                            : "var(--text-tertiary)",
                          border: isActive
                            ? "1px solid var(--accent-primary-border)"
                            : "1px solid var(--border-default)",
                        }}
                      >
                        {isActive
                          ? t("leave.status_active")
                          : t("leave.status_inactive")}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: "var(--text-primary)",
                        fontFamily: "'DM Mono', monospace",
                        marginTop: 6,
                      }}
                    >
                      <LtrText>
                        {policy.accrualDaysPerMonth} {t("leave.days_per_month")}
                      </LtrText>
                    </div>
                    {policy.notes && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-secondary)",
                          marginTop: 4,
                          fontStyle: "italic",
                        }}
                      >
                        {policy.notes}
                      </div>
                    )}
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 14,
                        marginTop: 6,
                        fontSize: 11,
                        color: "var(--text-tertiary)",
                      }}
                    >
                      {policy.qualifyingMonthsBeforeAccrual != null && (
                        <div>
                          {t("leave.label_qualifying")}:{" "}
                          <LtrText>
                            <span
                              style={{
                                color: "var(--text-secondary)",
                                fontFamily: "'DM Mono', monospace",
                              }}
                            >
                              {policy.qualifyingMonthsBeforeAccrual}
                            </span>
                          </LtrText>
                        </div>
                      )}
                      {policy.maxCarryForwardDays != null && (
                        <div>
                          {t("leave.label_max_carry")}:{" "}
                          <LtrText>
                            <span
                              style={{
                                color: "var(--text-secondary)",
                                fontFamily: "'DM Mono', monospace",
                              }}
                            >
                              {policy.maxCarryForwardDays}
                            </span>
                          </LtrText>
                        </div>
                      )}
                      {policy.plRoleCode && (
                        <div>
                          {t("leave.label_pl_role")}:{" "}
                          <LtrText>
                            <span
                              style={{
                                color: "var(--text-secondary)",
                                fontFamily: "'DM Mono', monospace",
                              }}
                            >
                              {policy.plRoleCode}
                            </span>
                          </LtrText>
                        </div>
                      )}
                      {policy.liabilityRoleCode && (
                        <div>
                          {t("leave.label_liability_role")}:{" "}
                          <LtrText>
                            <span
                              style={{
                                color: "var(--text-secondary)",
                                fontFamily: "'DM Mono', monospace",
                              }}
                            >
                              {policy.liabilityRoleCode}
                            </span>
                          </LtrText>
                        </div>
                      )}
                      <div>
                        {t("leave.label_active_from")}:{" "}
                        <LtrText>
                          <span
                            style={{
                              color: "var(--text-secondary)",
                              fontFamily: "'DM Mono', monospace",
                            }}
                          >
                            {policy.activeFrom}
                          </span>
                        </LtrText>
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <button
                      onClick={() =>
                        setModalState({ open: true, mode: "edit", policy })
                      }
                      disabled={readOnly}
                      style={{ ...btnMini, opacity: readOnly ? 0.5 : 1, cursor: readOnly ? "not-allowed" : btnMini.cursor }}
                    >
                      <Edit3
                        size={11}
                        style={{
                          verticalAlign: "middle",
                          marginInlineEnd: 4,
                        }}
                      />
                      {t("leave.action_edit")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <LeavePolicyModal
          open={modalState.open}
          mode={modalState.mode}
          policy={modalState.policy}
          onClose={() =>
            setModalState({ open: false, mode: "create", policy: null })
          }
          onSaved={() => {
            reload();
            setToast(
              modalState.mode === "edit"
                ? t("leave.saved_edit_toast")
                : t("leave.saved_create_toast"),
            );
          }}
        />
      </Card>
    </div>
  );
}

// ── CBK Rates (FN-238, 2026-04-19) ────────────────────────────────
// Central Bank of Kuwait exchange-rate register. Manual entry only
// in this partial — the CbkRateSource enum reserves CBK_SCHEDULED
// and BANK_EMBEDDED for future wiring. Staleness indicator is
// purely passive: shows "last updated Nd ago" colored by a 7-day
// threshold, NO auto-refresh button (honest about manual-only nature
// per Q5 resolution). Consumers: FX revaluation + bilingual reports.
const CBK_COMMON_CURRENCIES = ["USD", "EUR", "GBP", "AED", "SAR"];

function CbkRatesSection({ readOnly = false }) {
  const { t } = useTranslation("setup");
  const [rows, setRows] = useState(null);
  const [staleness, setStaleness] = useState({});
  const [currencyFilter, setCurrencyFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPrefill, setModalPrefill] = useState(null);
  const [toast, setToast] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const reload = async () => {
    setLoadError(null);
    try {
      const filters = currencyFilter
        ? { currency: currencyFilter.toUpperCase(), limit: 200 }
        : { limit: 200 };
      const list = await listCbkRates(filters);
      setRows(list || []);

      // Fetch staleness for a small set of "common" currencies so the
      // summary strip shows them even when no rows are present.
      const currencies = new Set([
        ...CBK_COMMON_CURRENCIES,
        ...(list || []).map((r) => r.currency),
      ]);
      const next = {};
      for (const cur of currencies) {
        try {
          const s = await getCbkRateStaleness({
            currency: cur,
            staleThresholdDays: 7,
          });
          next[cur] = s;
        } catch {
          next[cur] = null;
        }
      }
      setStaleness(next);
    } catch (err) {
      setRows([]);
      setLoadError(err?.message || t("cbk_rates.error_load"));
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currencyFilter]);

  const handleDelete = async (row) => {
    try {
      await deleteCbkRate(row.id);
      setToast(t("cbk_rates.deleted_toast"));
      reload();
    } catch (err) {
      setToast(err?.message || t("cbk_rates.error_delete"));
    }
  };

  const handleReplaceRate = (row) => {
    setModalPrefill({
      currency: row.currency,
      rateDate: row.rateDate,
      rateKwd: row.rateKwd,
      notes: row.notes,
    });
    setModalOpen(true);
  };

  const stalenessSummary = Object.values(staleness).filter(
    (s) => s && s.latestRate,
  );
  const staleCount = stalenessSummary.filter((s) => s.isStale).length;

  return (
    <div>
      {/* Staleness strip */}
      <Card
        title={t("cbk_rates.staleness_title")}
        description={t("cbk_rates.staleness_description")}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 12,
          }}
        >
          {CBK_COMMON_CURRENCIES.map((cur) => {
            const s = staleness[cur];
            const color =
              !s || !s.latestRate
                ? "var(--text-tertiary)"
                : s.isStale
                ? "var(--semantic-warning)"
                : "var(--accent-primary)";
            const valueText = s?.latestRate
              ? s.latestRate.rateKwd
              : t("cbk_rates.no_rate");
            const ageText =
              s?.latestRate && s.ageInDays != null
                ? t("cbk_rates.age_days", { count: s.ageInDays })
                : "—";
            return (
              <div key={cur}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.15em",
                    color: "var(--text-tertiary)",
                    textTransform: "uppercase",
                    marginBottom: 3,
                  }}
                >
                  <LtrText>{cur}</LtrText>
                </div>
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 14,
                    fontWeight: 700,
                    color,
                  }}
                >
                  <LtrText>{valueText}</LtrText>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: color,
                    marginTop: 2,
                  }}
                >
                  <LtrText>{ageText}</LtrText>
                </div>
              </div>
            );
          })}
        </div>
        {staleCount > 0 && (
          <div
            role="status"
            style={{
              marginTop: 14,
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid var(--semantic-warning)",
              background: "var(--semantic-warning-subtle)",
              color: "var(--semantic-warning)",
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Clock size={14} />
            <span>
              {t("cbk_rates.stale_banner", { count: staleCount })}
            </span>
          </div>
        )}
      </Card>

      {/* Register card */}
      <Card
        title={t("cbk_rates.title")}
        description={t("cbk_rates.description")}
        extra={
          <button
            onClick={() => {
              setModalPrefill(null);
              setModalOpen(true);
            }}
            disabled={readOnly}
            style={{ ...btnPrimary(false), opacity: readOnly ? 0.5 : 1, cursor: readOnly ? "not-allowed" : btnPrimary(false).cursor }}
          >
            <Plus
              size={13}
              style={{ verticalAlign: "middle", marginInlineEnd: 6 }}
            />
            {t("cbk_rates.add_rate")}
          </button>
        }
      >
        <Toast text={toast} onClear={() => setToast(null)} />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <div style={{ position: "relative", width: 220 }}>
            <Search
              size={13}
              color="var(--text-tertiary)"
              style={{
                position: "absolute",
                insetInlineStart: 10,
                top: "50%",
                transform: "translateY(-50%)",
              }}
            />
            <input
              value={currencyFilter}
              onChange={(e) =>
                setCurrencyFilter(e.target.value.toUpperCase())
              }
              placeholder={t("cbk_rates.filter_placeholder")}
              maxLength={3}
              style={{
                ...inputStyle,
                paddingInlineStart: 30,
                fontFamily: "'DM Mono', monospace",
                textTransform: "uppercase",
              }}
            />
          </div>
        </div>

        {loadError && (
          <div
            role="alert"
            style={{
              display: "flex",
              gap: 8,
              padding: "10px 12px",
              background: "var(--semantic-danger-subtle)",
              border: "1px solid var(--semantic-danger)",
              borderRadius: 8,
              color: "var(--semantic-danger)",
              fontSize: 12,
              marginBottom: 12,
            }}
          >
            <AlertTriangle size={14} /> {loadError}
          </div>
        )}

        {rows === null && (
          <div style={{ color: "var(--text-tertiary)", fontSize: 12 }}>…</div>
        )}

        {rows && rows.length === 0 && !loadError && (
          <EmptyState
            icon={Banknote}
            title={t("cbk_rates.empty_title")}
            description={t("cbk_rates.empty_description")}
          />
        )}

        {rows && rows.length > 0 && (
          <div
            style={{
              border: "1px solid var(--border-default)",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            {rows.map((row, idx) => (
              <div
                key={row.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 14,
                  padding: "12px 18px",
                  borderBottom:
                    idx === rows.length - 1
                      ? "none"
                      : "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: "'DM Mono', monospace",
                        color: "var(--text-primary)",
                      }}
                    >
                      <LtrText>{row.currency}</LtrText>
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--text-tertiary)",
                        fontFamily: "'DM Mono', monospace",
                      }}
                    >
                      <LtrText>{row.rateDate}</LtrText>
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: "var(--bg-surface)",
                        color: "var(--text-tertiary)",
                        border: "1px solid var(--border-default)",
                      }}
                    >
                      {t(`cbk_rates.source_${row.source}`)}
                    </span>
                  </div>
                  {row.notes && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--text-secondary)",
                        marginTop: 4,
                        fontStyle: "italic",
                      }}
                    >
                      {row.notes}
                    </div>
                  )}
                </div>
                <div
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 14,
                    fontWeight: 700,
                    color: "var(--accent-primary)",
                    marginInlineEnd: 10,
                  }}
                >
                  <LtrText>{row.rateKwd}</LtrText>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => handleReplaceRate(row)}
                    disabled={readOnly}
                    style={{ ...btnMini, opacity: readOnly ? 0.5 : 1, cursor: readOnly ? "not-allowed" : btnMini.cursor }}
                  >
                    <Edit3
                      size={11}
                      style={{
                        verticalAlign: "middle",
                        marginInlineEnd: 4,
                      }}
                    />
                    {t("cbk_rates.action_replace")}
                  </button>
                  <button
                    onClick={() => handleDelete(row)}
                    disabled={readOnly}
                    style={{
                      ...btnMini,
                      color: "var(--semantic-danger)",
                      borderColor: "var(--semantic-danger-border)",
                      opacity: readOnly ? 0.5 : 1,
                      cursor: readOnly ? "not-allowed" : btnMini.cursor,
                    }}
                    aria-label={t("cbk_rates.action_delete")}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <CbkRateModal
          open={modalOpen}
          prefill={modalPrefill}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            reload();
            setToast(t("cbk_rates.saved_toast"));
          }}
        />
      </Card>
    </div>
  );
}

function SummaryPill({ label, value, tone }) {
  const color =
    tone === "accent" ? "var(--accent-primary)" : "var(--text-primary)";
  return (
    <div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.15em",
          color: "var(--text-tertiary)",
          textTransform: "uppercase",
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 14,
          fontWeight: 700,
          color,
        }}
      >
        <LtrText>{value}</LtrText>
      </div>
    </div>
  );
}

function TotalCell({ label, value }) {
  return (
    <div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          letterSpacing: "0.15em",
          color: "var(--text-tertiary)",
          textTransform: "uppercase",
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 13,
          fontWeight: 700,
          color: "var(--text-primary)",
        }}
      >
        <LtrText>{value}</LtrText>
      </div>
    </div>
  );
}

function RateChip({ label, bps, raw }) {
  const value = raw != null ? raw : bps != null ? fmtBpsPercent(bps) : "—";
  const hasValue = raw != null || bps != null;
  return (
    <div>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.1em",
          color: "var(--text-tertiary)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>{" "}
      <LtrText>
        <span
          style={{
            fontFamily: "'DM Mono', monospace",
            color: hasValue ? "var(--text-secondary)" : "var(--text-tertiary)",
          }}
        >
          {value}
        </span>
      </LtrText>
    </div>
  );
}

// Shared styles
const inputStyle = {
  width: "100%", background: "var(--bg-surface-sunken)",
  border: "1px solid var(--border-default)", borderRadius: 8,
  padding: "10px 12px", color: "var(--text-primary)",
  fontSize: 13, fontFamily: "inherit", outline: "none",
};
const selectStyle = { ...inputStyle, appearance: "none" };
const btnMini = {
  background: "transparent", color: "var(--text-secondary)",
  border: "1px solid var(--border-strong)", padding: "6px 12px",
  borderRadius: 5, cursor: "pointer", fontSize: 11, fontFamily: "inherit", fontWeight: 600,
};
const btnPrimary = (l) => ({ background: "var(--accent-primary)", color: "#fff", border: "none", padding: "9px 16px", borderRadius: 6, cursor: l ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" });

function FormRow({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}
