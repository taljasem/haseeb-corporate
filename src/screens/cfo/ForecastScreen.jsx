import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Save, GitCompare, TrendingUp, AlertTriangle } from "lucide-react";
import LtrText from "../../components/shared/LtrText";
import Spinner from "../../components/shared/Spinner";
import { useTenant } from "../../components/shared/TenantContext";
import AminahNarrationCard from "../../components/financial/AminahNarrationCard";
import SaveScenarioModal from "../../components/forecast/SaveScenarioModal";
import CompareScenariosSlideOver from "../../components/forecast/CompareScenariosSlideOver";
// HASEEB-280 — Wave 2 migration. Engine router selects MOCK vs LIVE
// per function; all four of these are mock-fallback today (no backend
// yet — tracked under HASEEB-279 follow-up list).
import {
  getForecast,
  recalculateForecast,
  getSavedForecastScenarios,
  getForecastNarration,
} from "../../engine";

const SCENARIOS = ["conservative", "base", "aggressive"];
const SCENARIO_COLOR = {
  conservative: "var(--semantic-warning)",
  base:         "var(--accent-primary)",
  aggressive:   "var(--role-owner)",
};

const ASSUMPTION_KEYS = [
  "revenueGrowth", "churnRate", "avgDealSize", "hiringPlan",
  "salaryInflation", "marketingRatio", "taxRate",
];

function fmtKWD(n) {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtDelta(n) {
  if (n == null || n === 0) return "0";
  const sign = n > 0 ? "+" : "";
  return `${sign}${Math.round(n).toLocaleString("en-US")}`;
}

function csvExport(filename, rows) {
  const csv = rows
    .map((r) => r.map((c) => {
      const v = String(c == null ? "" : c);
      if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
      return v;
    }).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ForecastScreen({ onOpenAminah }) {
  const { t } = useTranslation("forecast");
  const { tenant } = useTenant();
  const [scenario, setScenario] = useState("base");
  const [baseProjection, setBaseProjection] = useState(null);
  const [projection, setProjection] = useState(null);
  const [customAssumptions, setCustomAssumptions] = useState(null);
  const [narration, setNarration] = useState(null);
  const [saved, setSaved] = useState([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [expandedRevenue, setExpandedRevenue] = useState(false);
  const [expandedExpenses, setExpandedExpenses] = useState(false);
  const [applying, setApplying] = useState(false);
  const [toast, setToast] = useState(null);

  const reloadSaved = useCallback(() => getSavedForecastScenarios().then(setSaved), []);

  useEffect(() => {
    getForecast("base").then(setBaseProjection);
    reloadSaved();
  }, [reloadSaved]);

  useEffect(() => {
    setCustomAssumptions(null);
    getForecast(scenario).then(setProjection);
    getForecastNarration(scenario).then(setNarration);
  }, [scenario]);

  const showToast = (text) => {
    setToast(text);
    setTimeout(() => setToast(null), 2500);
  };

  const applyAssumptions = async (next) => {
    setApplying(true);
    const p = await recalculateForecast(scenario, next);
    setApplying(false);
    setProjection(p);
    setCustomAssumptions(next);
    showToast(t("assumptions.applied_toast"));
  };

  const resetAssumptions = () => {
    setCustomAssumptions(null);
    getForecast(scenario).then(setProjection);
    showToast(t("assumptions.reset_toast"));
  };

  const loadSaved = async (s) => {
    setScenario(s.scenario);
    const p = await recalculateForecast(s.scenario, s.assumptions);
    setProjection(p);
    setCustomAssumptions(s.assumptions);
  };

  const handleExport = () => {
    if (!projection) return;
    const tn = (tenant?.company?.shortName || "tenant").toLowerCase().replace(/\s+/g, "-");
    const rows = [["Month", "Revenue", "Expenses", "Net Income", "Ending Balance", "Confidence"]];
    projection.months.forEach((m) => rows.push([m.month, m.revenue, m.expenses, m.netIncome, m.endingBalance, m.confidence]));
    rows.push(["TOTAL", projection.totals.revenue, projection.totals.expenses, projection.totals.netIncome, projection.totals.endingCash, ""]);
    csvExport(`${tn}_forecast_${scenario}.csv`, rows);
    showToast(t("export", { format: "CSV" }));
  };

  if (!projection || !baseProjection) {
    return <div style={{ padding: 28, color: "var(--text-tertiary)" }}>{t("loading")}</div>;
  }

  const activeAssumptions = customAssumptions || projection.assumptions;
  const heroAccent = SCENARIO_COLOR[scenario];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Hero */}
      <div
        style={{
          padding: "22px 28px 18px",
          borderBottom: "1px solid var(--border-subtle)",
          background: `linear-gradient(180deg, ${heroAccent}1A 0%, transparent 100%)`,
          flexShrink: 0,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.15em", color: "var(--accent-primary)" }}>
            {t("view_label")}
          </div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, color: "var(--text-primary)", letterSpacing: "-0.3px", marginTop: 2, lineHeight: 1 }}>
            {t("title")}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.15em", color: "var(--text-tertiary)", marginTop: 6 }}>
            {t("hero_subtitle", { tenant: tenant?.company?.shortName || "", scenario: t(`scenarios.${scenario}`) })}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {SCENARIOS.map((s) => {
            const on = scenario === s;
            const color = SCENARIO_COLOR[s];
            return (
              <button
                key={s}
                onClick={() => setScenario(s)}
                style={{
                  fontSize: 11, fontWeight: 600, padding: "7px 14px",
                  borderRadius: 14,
                  background: on ? `${color}14` : "var(--bg-surface)",
                  border: on ? `1px solid ${color}66` : "1px solid var(--border-default)",
                  color: on ? color : "var(--text-tertiary)",
                  cursor: "pointer", fontFamily: "inherit",
                }}
              >
                {t(`scenarios.${s}`)}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "22px 28px 32px" }}>
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          {toast && (
            <div style={{ marginBottom: 14, background: "var(--accent-primary-subtle)", border: "1px solid var(--accent-primary-border)", color: "var(--accent-primary)", padding: "10px 14px", borderRadius: 8, fontSize: 12, fontWeight: 500 }}>
              {toast}
            </div>
          )}

          {/* KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 14 }}>
            <KpiCard label={t("kpis.revenue")}   value={projection.totals.revenue}    delta={projection.totals.revenue   - baseProjection.totals.revenue} />
            <KpiCard label={t("kpis.expenses")}  value={projection.totals.expenses}   delta={projection.totals.expenses  - baseProjection.totals.expenses} invert />
            <KpiCard label={t("kpis.net_income")} value={projection.totals.netIncome}  delta={projection.totals.netIncome - baseProjection.totals.netIncome} />
            <KpiCard label={t("kpis.ending_cash")} value={projection.totals.endingCash} delta={projection.totals.endingCash - baseProjection.totals.endingCash} />
          </div>

          {narration && (
            <AminahNarrationCard text={narration.narration} onAsk={() => onOpenAminah && onOpenAminah(`Forecast — ${t(`scenarios.${scenario}`)}`)} />
          )}

          {narration && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <NarrationList label={t("narration.highlights_label")} items={narration.highlights} color="var(--accent-primary)" Icon={TrendingUp} />
              <NarrationList label={t("narration.risks_label")} items={narration.risks} color="var(--semantic-warning)" Icon={AlertTriangle} />
            </div>
          )}

          {/* Monthly breakdown table */}
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 10, padding: "16px 18px", marginBottom: 14, overflowX: "auto" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 10 }}>
              <div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--text-primary)" }}>{t("table.title")}</div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{t("table.subtitle")}</div>
              </div>
              <button onClick={handleExport} style={exportBtn}>{t("export", { format: "CSV" })}</button>
            </div>
            <MonthlyTable
              projection={projection}
              expandedRevenue={expandedRevenue}
              expandedExpenses={expandedExpenses}
              onToggleRevenue={() => setExpandedRevenue((o) => !o)}
              onToggleExpenses={() => setExpandedExpenses((o) => !o)}
            />
          </div>

          {/* Assumptions */}
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 10, padding: "18px 20px", marginBottom: 14 }}>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--text-primary)" }}>{t("assumptions.title")}</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{t("assumptions.subtitle")}</div>
            </div>
            <AssumptionGrid
              assumptions={activeAssumptions}
              onApply={applyAssumptions}
              applying={applying}
            />
            <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
              <button onClick={resetAssumptions} style={btnSecondary}>{t("assumptions.reset")}</button>
              <button onClick={() => setSaveOpen(true)} style={btnPrimary(false)}>
                <Save size={12} style={{ verticalAlign: "middle", marginInlineEnd: 6 }} />
                {t("saved.save_current")}
              </button>
              <button onClick={() => setCompareOpen(true)} style={btnSecondary}>
                <GitCompare size={12} style={{ verticalAlign: "middle", marginInlineEnd: 6 }} />
                {t("saved.compare")}
              </button>
            </div>
          </div>

          {/* Saved scenarios */}
          <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 10, padding: "18px 20px" }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: "var(--text-primary)", marginBottom: 10 }}>{t("saved.title")}</div>
            {saved.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{t("saved.empty")}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {saved.map((s) => (
                  <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--bg-surface-sunken)", border: "1px solid var(--border-subtle)", borderRadius: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>{s.name}</div>
                      <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>{t(`scenarios.${s.scenario}`)} · {s.author}</div>
                    </div>
                    <button onClick={() => loadSaved(s)} style={btnSecondary}>{t("saved.load")}</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <SaveScenarioModal
        open={saveOpen}
        scenario={scenario}
        assumptions={activeAssumptions}
        onClose={() => setSaveOpen(false)}
        onSaved={() => reloadSaved()}
      />
      <CompareScenariosSlideOver open={compareOpen} onClose={() => setCompareOpen(false)} />
    </div>
  );
}

function KpiCard({ label, value, delta, invert }) {
  const deltaColor = (invert ? -delta : delta) >= 0 ? "var(--accent-primary)" : "var(--semantic-danger)";
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 10, padding: "16px 18px" }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color: "var(--text-tertiary)" }}>{label}</div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 24, fontWeight: 500, color: "var(--text-primary)", marginTop: 8, fontVariantNumeric: "tabular-nums" }}>
        <LtrText>{fmtKWD(value)}</LtrText>
      </div>
      <div style={{ fontSize: 11, color: deltaColor, fontWeight: 600, marginTop: 4, fontFamily: "'DM Mono', monospace" }}>
        <LtrText>{fmtDelta(delta)}</LtrText>
      </div>
    </div>
  );
}

function NarrationList({ label, items, color, Icon }) {
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", color, marginBottom: 8 }}>
        <Icon size={12} /> {label}
      </div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((it, i) => (
          <li key={i} style={{ fontSize: 12, color: "var(--text-secondary)", paddingInlineStart: 12, position: "relative", lineHeight: 1.5 }}>
            <span style={{ position: "absolute", left: 0, top: 8, width: 4, height: 4, borderRadius: "50%", background: color }} />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MonthlyTable({ projection, expandedRevenue, expandedExpenses, onToggleRevenue, onToggleExpenses }) {
  const { t } = useTranslation("forecast");
  const months = projection.months;
  const cols = `160px repeat(${months.length}, minmax(70px, 1fr)) 90px`;
  const totalR = projection.totals.revenue;
  const totalE = projection.totals.expenses;
  const totalN = projection.totals.netIncome;

  return (
    <div style={{ minWidth: 900 }}>
      <div style={{ display: "grid", gridTemplateColumns: cols, gap: 6, padding: "8px 0", borderBottom: "1px solid var(--border-default)", fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", color: "var(--text-tertiary)" }}>
        <div>{t("table.col_row")}</div>
        {months.map((m) => (
          <div key={m.month} style={{ textAlign: "end" }}>
            <LtrText>{m.month}</LtrText>
            <div style={{ fontSize: 8, color: confColor(m.confidence), marginTop: 2 }}>
              {t(`table.confidence_${m.confidence}`)}
            </div>
          </div>
        ))}
        <div style={{ textAlign: "end" }}>{t("table.col_total")}</div>
      </div>

      <TableRow
        label={t("table.row_revenue")}
        values={months.map((m) => m.revenue)}
        total={totalR}
        expandable
        expanded={expandedRevenue}
        onToggle={onToggleRevenue}
        cols={cols}
      />
      {expandedRevenue && Object.keys(months[0].revenueBreakdown).map((k) => (
        <TableRow
          key={k}
          label={k}
          values={months.map((m) => m.revenueBreakdown[k])}
          total={months.reduce((s, m) => s + (m.revenueBreakdown[k] || 0), 0)}
          sub
          cols={cols}
        />
      ))}
      <TableRow
        label={t("table.row_expenses")}
        values={months.map((m) => m.expenses)}
        total={totalE}
        expandable
        expanded={expandedExpenses}
        onToggle={onToggleExpenses}
        cols={cols}
      />
      {expandedExpenses && Object.keys(months[0].expenseBreakdown).map((k) => (
        <TableRow
          key={k}
          label={k}
          values={months.map((m) => m.expenseBreakdown[k])}
          total={months.reduce((s, m) => s + (m.expenseBreakdown[k] || 0), 0)}
          sub
          cols={cols}
        />
      ))}
      <TableRow
        label={t("table.row_net_income")}
        values={months.map((m) => m.netIncome)}
        total={totalN}
        bold
        cols={cols}
      />
      <TableRow
        label={t("table.row_ending")}
        values={months.map((m) => m.endingBalance)}
        total={months[months.length - 1].endingBalance}
        bold
        accent
        cols={cols}
      />
    </div>
  );
}

function TableRow({ label, values, total, expandable, expanded, onToggle, sub, bold, accent, cols }) {
  return (
    <div
      onClick={expandable ? onToggle : undefined}
      style={{
        display: "grid",
        gridTemplateColumns: cols,
        gap: 6,
        padding: "9px 0",
        borderBottom: "1px solid var(--border-subtle)",
        alignItems: "baseline",
        cursor: expandable ? "pointer" : "default",
      }}
    >
      <div style={{ fontSize: sub ? 11 : 12, color: sub ? "var(--text-tertiary)" : "var(--text-primary)", fontWeight: bold ? 600 : 400, paddingInlineStart: sub ? 16 : 0, display: "flex", alignItems: "center", gap: 6 }}>
        {expandable && <span style={{ fontSize: 9, color: "var(--text-tertiary)" }}>{expanded ? "▾" : "▸"}</span>}
        {label}
      </div>
      {values.map((v, i) => (
        <div key={i} style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, textAlign: "end", color: accent ? "var(--accent-primary)" : sub ? "var(--text-tertiary)" : "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
          <LtrText>{fmtKWD(v)}</LtrText>
        </div>
      ))}
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, textAlign: "end", color: accent ? "var(--accent-primary)" : "var(--text-primary)", fontWeight: bold ? 600 : 400 }}>
        <LtrText>{fmtKWD(total)}</LtrText>
      </div>
    </div>
  );
}

function AssumptionGrid({ assumptions, onApply, applying }) {
  const { t } = useTranslation("forecast");
  const [draft, setDraft] = useState(assumptions);

  useEffect(() => { setDraft(assumptions); }, [assumptions]);

  const update = (k, v) => setDraft({ ...draft, [k]: v });
  const apply = () => onApply(draft);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
        {ASSUMPTION_KEYS.map((k) => (
          <div key={k}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", color: "var(--text-tertiary)", marginBottom: 6 }}>
              {t(`assumptions.${k}`)}
            </div>
            <input
              type="number"
              value={draft[k]}
              onChange={(e) => update(k, Number(e.target.value))}
              style={{
                width: "100%",
                background: "var(--bg-surface-sunken)",
                border: "1px solid var(--border-default)",
                borderRadius: 8,
                padding: "9px 12px",
                color: "var(--text-primary)",
                fontSize: 13, fontFamily: "'DM Mono', monospace",
                outline: "none",
              }}
            />
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <button onClick={apply} disabled={applying} style={btnPrimary(applying)}>
          {applying ? <><Spinner size={13} />&nbsp;…</> : t("assumptions.apply")}
        </button>
      </div>
    </div>
  );
}

function confColor(c) {
  return c === "high" ? "var(--accent-primary)" : c === "medium" ? "var(--semantic-warning)" : "var(--text-tertiary)";
}

const btnPrimary = (loading) => ({
  background: "var(--accent-primary)", color: "#fff", border: "none",
  padding: "9px 16px", borderRadius: 6, cursor: loading ? "not-allowed" : "pointer",
  fontSize: 12, fontWeight: 600, fontFamily: "inherit",
});
const btnSecondary = {
  background: "transparent", color: "var(--text-secondary)",
  border: "1px solid var(--border-strong)", padding: "9px 16px",
  borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit",
};
const exportBtn = {
  background: "transparent", color: "var(--text-secondary)",
  border: "1px solid var(--border-default)", padding: "7px 14px",
  borderRadius: 6, cursor: "pointer",
  fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", fontFamily: "inherit",
};
