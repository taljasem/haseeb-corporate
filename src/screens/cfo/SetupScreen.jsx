import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BookOpen, Calendar, Calculator, Coins, Plug, Users, Cpu,
  Plus, Search, Edit3, Trash2, RefreshCw, AlertTriangle, Check, X as XIcon,
} from "lucide-react";
import LtrText from "../../components/shared/LtrText";
import EmptyState from "../../components/shared/EmptyState";
import Spinner from "../../components/shared/Spinner";
import { useTenant } from "../../components/shared/TenantContext";
import { formatRelativeTime } from "../../utils/relativeTime";
import {
  getSetupChartOfAccounts,
  getFiscalYearConfig,
  getTaxConfiguration,
  updateTaxConfiguration,
  getCurrencyConfig,
  updateCurrencyConfig,
  updateExchangeRates,
  getIntegrationStatus,
  forceSyncIntegration,
  getIntegrationSyncLogs,
  getTeamAccessMatrix,
  updateTeamMemberPermissions,
  getEngineConfiguration,
} from "../../engine/mockEngine";
import AccountModal from "../../components/setup/AccountModal";
import DeactivateAccountModal from "../../components/setup/DeactivateAccountModal";
import PeriodActionModal from "../../components/setup/PeriodActionModal";
import ApplyRoleTemplateModal from "../../components/setup/ApplyRoleTemplateModal";
import ChangeEngineRuleModal from "../../components/setup/ChangeEngineRuleModal";

function fmtKWD(n) {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const SECTIONS = [
  { id: "chart",         icon: BookOpen },
  { id: "fiscal",        icon: Calendar },
  { id: "tax",           icon: Calculator },
  { id: "currencies",    icon: Coins },
  { id: "integrations",  icon: Plug },
  { id: "team_access",   icon: Users },
  { id: "engine_rules",  icon: Cpu },
];

export default function SetupScreen() {
  const { t } = useTranslation("setup");
  const { tenant } = useTenant();
  const [active, setActive] = useState("chart");

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div
        style={{
          padding: "22px 28px 18px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
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
        <aside style={{ width: 220, flexShrink: 0, background: "var(--bg-surface)", borderInlineEnd: "1px solid rgba(255,255,255,0.08)", padding: "18px 0", overflowY: "auto" }}>
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
                <span>{t(`sections.${s.id === "chart" ? "chart_of_accounts" : s.id === "fiscal" ? "fiscal_year" : s.id === "currencies" ? "currencies" : s.id === "integrations" ? "integrations" : s.id === "team_access" ? "team_access" : s.id === "engine_rules" ? "engine_rules" : s.id}`)}</span>
              </button>
            );
          })}
        </aside>

        <div style={{ flex: 1, overflowY: "auto", padding: "22px 28px 32px", minWidth: 0 }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            {active === "chart"         && <ChartSection />}
            {active === "fiscal"        && <FiscalSection />}
            {active === "tax"           && <TaxSection />}
            {active === "currencies"    && <CurrenciesSection />}
            {active === "integrations"  && <IntegrationsSection />}
            {active === "team_access"   && <TeamAccessSection />}
            {active === "engine_rules"  && <EngineRulesSection />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ title, description, extra, children }) {
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "20px 22px", marginBottom: 14 }}>
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
  return <div style={{ marginBottom: 14, background: "var(--accent-primary-subtle)", border: "1px solid rgba(0,196,140,0.30)", color: "var(--accent-primary)", padding: "10px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500 }}>{text}</div>;
}

// ── Chart of Accounts ─────────────────────────────────────────────
function ChartSection() {
  const { t } = useTranslation("setup");
  const [accounts, setAccounts] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [modalMode, setModalMode] = useState(null);
  const [activeAccount, setActiveAccount] = useState(null);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [menuOpenCode, setMenuOpenCode] = useState(null);

  const reload = () => getSetupChartOfAccounts().then(setAccounts);
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
        <button onClick={() => { setModalMode("add"); setActiveAccount(null); }} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--accent-primary)", color: "#fff", border: "none", padding: "9px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
          <Plus size={14} /> {t("chart.add_account")}
        </button>
      }
    >
      <Toast text={toast} onClear={() => setToast(null)} />
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={13} color="var(--text-tertiary)" style={{ position: "absolute", insetInlineStart: 10, top: "50%", transform: "translateY(-50%)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("chart.search_placeholder")} style={{ width: "100%", background: "var(--bg-surface-sunken)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, padding: "8px 12px 8px 30px", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none" }} />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ background: "var(--bg-surface-sunken)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 6, padding: "8px 10px", color: "var(--text-primary)", fontSize: 12, fontFamily: "inherit", outline: "none" }}>
          <option value="all">{t("chart.filter_all")}</option>
          {["Assets", "Liabilities", "Equity", "Revenue", "Expenses"].map((tp) => <option key={tp} value={tp}>{t(`chart.types.${tp}`)}</option>)}
        </select>
      </div>
      {Object.keys(grouped).map((tp) => {
        const list = grouped[tp];
        if (list.length === 0) return null;
        return (
          <div key={tp} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-tertiary)", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {t(`chart.types.${tp}`)} ({list.length})
            </div>
            {list.map((a) => (
              <div key={a.code} style={{ display: "grid", gridTemplateColumns: "80px 1fr 200px 140px 80px 40px", gap: 8, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", alignItems: "center", position: "relative" }}>
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
                  <button onClick={() => setMenuOpenCode(menuOpenCode === a.code ? null : a.code)} aria-label={t("chart.kebab.open")} style={{ width: 24, height: 24, background: "transparent", border: "none", cursor: "pointer", color: "var(--text-tertiary)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                    <Edit3 size={12} />
                  </button>
                  {menuOpenCode === a.code && (
                    <div style={{ position: "absolute", top: "calc(100% + 4px)", insetInlineEnd: 0, width: 180, background: "var(--bg-surface-raised)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8, boxShadow: "0 12px 32px rgba(0,0,0,0.6)", zIndex: 150, padding: "6px 0" }}>
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
function FiscalSection() {
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
              <div key={p.month} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500 }}>{p.month}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: pillColor, background: `${pillColor}14`, border: `1px solid ${pillColor}55`, padding: "3px 8px", borderRadius: 4 }}>
                    {t(`fiscal.period_status.${p.status}`)}
                  </span>
                  {p.status === "open" && (
                    <button onClick={() => setPeriodAction({ action: "close", month: p.month })} style={btnMini}>{t("fiscal.close_period")}</button>
                  )}
                  {p.status === "hard_closed" && (
                    <button onClick={() => setPeriodAction({ action: "open", month: p.month })} style={btnMini}>{t("fiscal.open_period")}</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginTop: 16, marginBottom: 8 }}>{t("fiscal.milestones_heading")}</div>
        {data.milestones.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 12 }}>
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
function TaxSection() {
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
        <select value={cfg.regime} onChange={(e) => update("regime", e.target.value)} style={selectStyle}>
          {["kuwait", "saudi", "uae", "bahrain"].map((r) => <option key={r} value={r}>{t(`tax.regime_${r}`)}</option>)}
        </select>
      </FormRow>
      {cfg.regime === "kuwait" && (
        <>
          <FormRow label={t("tax.field_zakat")}><input type="number" value={cfg.zakatRate} onChange={(e) => update("zakatRate", Number(e.target.value))} style={inputStyle} /></FormRow>
          <FormRow label={t("tax.field_zakat_account")}><input value={cfg.zakatAccount} onChange={(e) => update("zakatAccount", e.target.value)} style={inputStyle} /></FormRow>
          <FormRow label={t("tax.field_corporate")}><input type="number" value={cfg.corporateTaxRate} onChange={(e) => update("corporateTaxRate", Number(e.target.value))} style={inputStyle} /></FormRow>
          <FormRow label={t("tax.field_pifss")}><input type="number" value={cfg.pifssRate} onChange={(e) => update("pifssRate", Number(e.target.value))} style={inputStyle} /></FormRow>
          <FormRow label={t("tax.field_pifss_account")}><input value={cfg.pifssAccount} onChange={(e) => update("pifssAccount", e.target.value)} style={inputStyle} /></FormRow>
        </>
      )}
      <FormRow label={t("tax.field_filing_frequency")}>
        <select value={cfg.filingFrequency} onChange={(e) => update("filingFrequency", e.target.value)} style={selectStyle}>
          {["monthly", "quarterly", "annual"].map((f) => <option key={f} value={f}>{t(`tax.freq_${f}`)}</option>)}
        </select>
      </FormRow>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginTop: 14, marginBottom: 8 }}>{t("tax.exemptions_heading")}</div>
      {cfg.exemptions.map((e, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 12 }}>
          <div style={{ color: "var(--text-primary)" }}>{e.partyName}</div>
          <div style={{ color: "var(--text-tertiary)" }}>{e.reason}</div>
        </div>
      ))}
      <div style={{ marginTop: 16 }}>
        <button onClick={handleSave} disabled={saving} style={btnPrimary(saving)}>
          {saving ? <><Spinner size={13} />&nbsp;{t("tax.saving")}</> : t("tax.save")}
        </button>
      </div>
    </Card>
  );
}

// ── Currencies ─────────────────────────────────────────────────────
function CurrenciesSection() {
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
        <div key={c} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: "'DM Mono', monospace" }}><LtrText>{c}</LtrText></div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "'DM Mono', monospace" }}><LtrText>{cfg.rates[c]?.toFixed(4)}</LtrText></div>
            <button
              onClick={() => toggle(c)}
              style={{
                width: 36, height: 20, borderRadius: 10,
                background: cfg.enabled[c] ? "var(--accent-primary)" : "var(--border-default)",
                border: "none", padding: 2, cursor: "pointer", position: "relative",
              }}
            >
              <span style={{ display: "block", width: 16, height: 16, borderRadius: "50%", background: "#fff", transform: cfg.enabled[c] ? "translateX(16px)" : "translateX(0)", transition: "transform 0.15s" }} />
            </button>
          </div>
        </div>
      ))}
      <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={handleUpdateRates} disabled={updating} style={btnPrimary(updating)}>
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
function IntegrationsSection() {
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
          <div key={i.id} style={{ padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
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
              <button onClick={() => handleSync(i.id)} disabled={syncingId === i.id || i.status === "disconnected"} style={btnMini}>
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
              <div style={{ marginTop: 10, background: "var(--bg-surface-sunken)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, padding: "10px 12px" }}>
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

// ── Team Access ─────────────────────────────────────────────────
function TeamAccessSection() {
  const { t } = useTranslation("setup");
  const [members, setMembers] = useState([]);
  const [templateFor, setTemplateFor] = useState(null);
  const [toast, setToast] = useState(null);

  const permKeys = ["view_financials", "post_je", "approve_je", "edit_budget", "close_periods", "configure_setup", "approve_writeoffs"];

  const reload = () => getTeamAccessMatrix().then(setMembers);
  useEffect(() => { reload(); }, []);

  const togglePerm = async (memberId, perm) => {
    const m = members.find((x) => x.memberId === memberId);
    if (!m) return;
    const newVal = !m.permissions[perm];
    setMembers(members.map((x) => x.memberId === memberId ? { ...x, permissions: { ...x.permissions, [perm]: newVal } } : x));
    await updateTeamMemberPermissions(memberId, { [perm]: newVal });
    setToast(t("team_access.saved_toast"));
  };

  return (
    <Card title={t("team_access.title")} description={t("team_access.description")}>
      <Toast text={toast} onClear={() => setToast(null)} />
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 10, fontStyle: "italic" }}>{t("team_access.sensitive_note")}</div>
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 900 }}>
          <div style={{ display: "grid", gridTemplateColumns: `180px 120px repeat(${permKeys.length}, 1fr) 110px`, gap: 8, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.08)", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text-tertiary)" }}>
            <div>{t("team_access.col_member")}</div>
            <div>{t("team_access.col_role")}</div>
            {permKeys.map((p) => <div key={p} style={{ textAlign: "center", fontSize: 9 }}>{t(`team_access.permissions.${p}`)}</div>)}
            <div>{t("team_access.col_template")}</div>
          </div>
          {members.map((m) => (
            <div key={m.memberId} style={{ display: "grid", gridTemplateColumns: `180px 120px repeat(${permKeys.length}, 1fr) 110px`, gap: 8, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", alignItems: "center" }}>
              <div style={{ fontSize: 12, color: "var(--text-primary)", fontWeight: 500 }}>{m.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{m.role}</div>
              {permKeys.map((p) => (
                <div key={p} style={{ textAlign: "center" }}>
                  <button onClick={() => togglePerm(m.memberId, p)} style={{ background: "transparent", border: "none", cursor: "pointer", color: m.permissions[p] ? "var(--accent-primary)" : "var(--text-tertiary)", padding: 0 }}>
                    {m.permissions[p] ? <Check size={16} /> : <XIcon size={14} />}
                  </button>
                </div>
              ))}
              <div>
                <button onClick={() => setTemplateFor(m)} style={btnMini}>{t("team_access.apply_template")}</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <ApplyRoleTemplateModal open={!!templateFor} member={templateFor} onClose={() => setTemplateFor(null)} onApplied={() => { reload(); setToast(t("apply_template_modal.applied_toast")); }} />
    </Card>
  );
}

// ── Engine Rules ────────────────────────────────────────────────
function EngineRulesSection() {
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
        <div key={r.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <div>
            <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{t(`engine_rules.${r.label}`)}</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, color: "var(--accent-primary)", marginTop: 2 }}><LtrText>{cfg[r.key]}</LtrText></div>
          </div>
          <button onClick={() => setEditing(r.key)} style={btnMini}>{t("engine_rules.edit")}</button>
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

// Shared styles
const inputStyle = {
  width: "100%", background: "var(--bg-surface-sunken)",
  border: "1px solid rgba(255,255,255,0.10)", borderRadius: 8,
  padding: "10px 12px", color: "var(--text-primary)",
  fontSize: 13, fontFamily: "inherit", outline: "none",
};
const selectStyle = { ...inputStyle, appearance: "none" };
const btnMini = {
  background: "transparent", color: "var(--text-secondary)",
  border: "1px solid rgba(255,255,255,0.15)", padding: "6px 12px",
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
