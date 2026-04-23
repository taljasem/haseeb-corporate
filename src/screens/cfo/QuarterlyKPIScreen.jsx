/**
 * QuarterlyKPIScreen — AUDIT-ACC-055 (2026-04-23).
 *
 * Kuwait CORPORATE-FULL-TIER CFOs run on a quarterly rhythm for
 * business-KPI reviews (board prep, investor briefs, CBK regulatory
 * filings). The existing CFO TodayScreen surfaces AI-engine operational
 * metrics (categorization coverage, Aminah activity, close progress) —
 * useful for daily ops, NOT for the quarterly business-health review.
 *
 * This screen composes five canonical KPIs that the audit-readiness
 * memo (memory-bank/2026-04-21-accounting-readiness-audit.md, row
 * AUDIT-ACC-055) calls out:
 *
 *   1. Revenue growth  — current vs prior period, % change.
 *   2. Margin          — gross + operating margin from the IS.
 *   3. Cash cycle      — DSO (from AR aging) − DPO (from AP aging) = CCC.
 *                        DIO not readily available; we surface the two
 *                        constituents + the simplified cycle and tag it
 *                        explicitly so the reader understands the
 *                        simplification.
 *   4. Burn            — average monthly expense run-rate (IS expenses).
 *   5. Runway          — cash / monthly burn → months of runway.
 *
 * Data sources — all exist on the engine router today. No new backend
 * endpoints are introduced; the screen is a pure read-only composition
 * layer over primitives already in use on OwnerTodayScreen / CFOToday /
 * AgingReportsScreen / ForecastScreen:
 *
 *   • getBusinessPulse()  — revenue, expenses, netIncome (with
 *                           grossMargin + operatingMargin), cash.
 *   • getCashPosition()   — total cash across KIB accounts (confirm).
 *   • getAgingReport('AR')— dso.
 *   • getAgingReport('AP')— dpo.
 *   • getForecast()       — projected 12-month cash trajectory for
 *                           runway-extension-if-growth-holds narrative.
 *
 * Wall preservation: the screen renders server-computed numbers. The
 * frontend does NOT call any LLM directly; any narration is produced
 * by existing Aminah advisor endpoints only (this screen does not
 * currently pull advisor narration — numbers + deterministic prose
 * only).
 *
 * Role gating:
 *   - CFO + Senior      → full access.
 *   - Owner             → full access (read-only by design on CFO-owned
 *                         screens; OwnerView can mount this if Tarek
 *                         decides to add sidebar entry in a follow-up).
 *   - Junior            → role-gate panel.
 *
 * Period selector: Q1/Q2/Q3/Q4 toggle. The underlying data primitives
 * do NOT currently accept a period parameter (they report the most
 * recent computed values). The period toggle is wired but currently
 * renders the same base snapshot — HASEEB-NNN follow-up can parameterize
 * the primitives to read a specific fiscal-quarter slice. The screen
 * includes a pending-period-filter banner so the reader knows the
 * displayed figures are the latest snapshot, not a specific quarter.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  TrendingUp,
  Percent,
  Repeat,
  Flame,
  Clock,
  AlertTriangle,
  RefreshCw,
  Info,
} from "lucide-react";
import Decimal from "decimal.js";
import EmptyState from "../../components/shared/EmptyState";
import LtrText from "../../components/shared/LtrText";
import { normalizeRole, ROLES } from "../../utils/role";
import {
  getBusinessPulse,
  getCashPosition,
  getAgingReport,
  getForecast,
} from "../../engine";

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Decimal-safe KWD formatter. Backend / mock emit either numbers or
 * Decimal-safe strings. We never parseFloat on monetary values (wall
 * + HASEEB-140); Decimal.js carries precision through.
 */
function formatKwd(value) {
  if (value == null || value === "") return "—";
  try {
    const d = new Decimal(String(value));
    const fixed = d.toFixed(3);
    const [intPart, frac] = fixed.split(".");
    const sign = d.isNegative() ? "-" : "";
    const absInt = intPart.replace(/^-/, "");
    const grouped = absInt.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${sign}${grouped}.${frac}`;
  } catch {
    return "—";
  }
}

/** Format a percentage. `showSign` prepends +/- for delta values. */
function formatPercent(value, { showSign = false, digits = 1 } = {}) {
  if (value == null || value === "") return "—";
  try {
    const d = new Decimal(String(value));
    const sign = d.isNegative() ? "-" : showSign && d.isPositive() && !d.isZero() ? "+" : "";
    return `${sign}${d.abs().toFixed(digits)}%`;
  } catch {
    return "—";
  }
}

/** Format a plain integer with thousand separators. */
function formatInt(value) {
  if (value == null || value === "") return "—";
  try {
    const d = new Decimal(String(value));
    return d.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  } catch {
    return "—";
  }
}

/** Map a percent-change (or margin) to semantic color token. */
function trendColor(delta) {
  if (delta == null) return "var(--text-secondary)";
  try {
    const d = new Decimal(String(delta));
    if (d.isZero()) return "var(--text-secondary)";
    return d.isPositive() ? "var(--semantic-success)" : "var(--semantic-danger)";
  } catch {
    return "var(--text-secondary)";
  }
}

// ── KPI card primitive ────────────────────────────────────────────

/**
 * Local KPI card. The shared `MetricCard` primitive is 4 fields and
 * assumes a plain label/value/subtext/trend — insufficient for this
 * screen's secondary lines (e.g. gross + operating margin side-by-side;
 * DSO + DPO + CCC triad). We compose a small richer card here rather
 * than extend the shared primitive (single-use; would pollute the DS).
 */
function KPICard({ icon: Icon, label, value, delta, deltaLabel, secondary, tooltip, testId }) {
  return (
    <div
      data-testid={testId}
      style={{
        background: "var(--bg-surface-raised)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 12,
        padding: 18,
        boxShadow: "var(--shadow-sm)",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        minHeight: 160,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-secondary)" }}>
        {Icon && <Icon size={14} strokeWidth={1.8} aria-hidden="true" />}
        <div
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--text-secondary)",
          }}
        >
          {label}
        </div>
        {tooltip && (
          <span
            title={tooltip}
            aria-label={tooltip}
            style={{ color: "var(--text-tertiary)", display: "inline-flex", marginInlineStart: "auto" }}
          >
            <Info size={13} strokeWidth={1.8} aria-hidden="true" />
          </span>
        )}
      </div>
      <div
        style={{
          fontFamily: "'DM Mono', monospace",
          fontWeight: 700,
          fontSize: 32,
          lineHeight: 1.1,
          color: "var(--text-primary)",
        }}
      >
        <LtrText>{value}</LtrText>
      </div>
      {delta != null && (
        <div
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            fontWeight: 500,
            color: trendColor(delta),
          }}
        >
          <LtrText>{formatPercent(delta, { showSign: true })}</LtrText>{" "}
          <span style={{ color: "var(--text-tertiary)" }}>{deltaLabel}</span>
        </div>
      )}
      {secondary && (
        <div
          style={{
            display: "flex",
            gap: 16,
            marginTop: "auto",
            paddingTop: 8,
            borderTop: "1px dashed var(--border-subtle)",
          }}
        >
          {secondary.map((s, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <div
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-tertiary)",
                }}
              >
                {s.label}
              </div>
              <div
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 15,
                  fontWeight: 600,
                  color: s.color || "var(--text-primary)",
                }}
              >
                <LtrText>{s.value}</LtrText>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Role gate panel ───────────────────────────────────────────────

function RoleGate() {
  const { t } = useTranslation("quarterlyKpi");
  return (
    <div
      data-testid="quarterlykpi-role-gate"
      style={{
        padding: 32,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
      }}
    >
      <EmptyState
        icon={BarChart3}
        title={t("role_gate.title")}
        description={t("role_gate.description")}
      />
    </div>
  );
}

// ── Derived math helpers ──────────────────────────────────────────

/**
 * Average monthly expense run-rate. Uses the businessPulse.expenses
 * figure which is the period-current total expenses (COGS + OpEx).
 * The businessPulse period granularity is "current month" per the
 * mock, but the IS figures are the latest period's totals; for the
 * launch surface we treat `expenses.current` as the best available
 * proxy for monthly run-rate. Forecast-based burn (average over next
 * 3 months from getForecast()) can be surfaced as a secondary in a
 * follow-up when the forecast module stabilizes.
 */
function monthlyBurnFromPulse(pulse) {
  if (!pulse?.expenses) return null;
  try {
    return new Decimal(String(pulse.expenses.current || 0));
  } catch {
    return null;
  }
}

/**
 * Runway in months = cash / monthly burn. Clamps at 99 months (≈ 8
 * years) since anything above is "very healthy" and the distinction
 * above that is noise for a KPI card. Returns null if burn ≤ 0
 * (profitable, no burn) — the caller renders an "n/a" badge with the
 * "Profitable (no burn)" narrative.
 */
function computeRunwayMonths(cashTotal, monthlyBurn) {
  if (cashTotal == null || monthlyBurn == null) return null;
  try {
    const burn = new Decimal(String(monthlyBurn));
    if (burn.isZero() || burn.isNegative()) return { profitable: true };
    const cash = new Decimal(String(cashTotal));
    const months = cash.div(burn);
    return {
      profitable: false,
      months: months.greaterThan(99) ? 99 : Number(months.toFixed(1)),
      clamped: months.greaterThan(99),
    };
  } catch {
    return null;
  }
}

/**
 * Cash cycle (CCC) = DSO − DPO. Full CCC = DSO + DIO − DPO; we don't
 * have DIO on the current aging module, so we surface the simplified
 * two-component form and flag the simplification in a tooltip. This
 * is better than omitting the KPI entirely and better than fabricating
 * a DIO number — the reader sees DSO + DPO explicitly.
 */
function computeCashCycle(dso, dpo) {
  if (dso == null && dpo == null) return null;
  const s = dso != null ? Number(dso) : null;
  const p = dpo != null ? Number(dpo) : null;
  if (s != null && p != null) return s - p;
  return null;
}

// ── Period selector (quarterly) ───────────────────────────────────

function QuarterSelector({ value, onChange, t }) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const currentQ = Math.floor(now.getUTCMonth() / 3) + 1;
  const quarters = ["Q1", "Q2", "Q3", "Q4"];
  return (
    <div
      role="tablist"
      aria-label={t("period_selector_label")}
      style={{ display: "inline-flex", gap: 4, padding: 2, background: "var(--bg-surface-sunken)", borderRadius: 8, border: "1px solid var(--border-subtle)" }}
    >
      {quarters.map((q) => {
        const isCurrent = q === `Q${currentQ}`;
        const active = value === q;
        return (
          <button
            key={q}
            role="tab"
            aria-selected={active}
            data-testid={`quarterlykpi-tab-${q.toLowerCase()}`}
            onClick={() => onChange(q)}
            style={{
              background: active ? "var(--bg-surface-raised)" : "transparent",
              border: active ? "1px solid var(--border-default)" : "1px solid transparent",
              color: active ? "var(--text-primary)" : "var(--text-tertiary)",
              padding: "6px 14px",
              borderRadius: 6,
              fontFamily: "'DM Mono', monospace",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.05em",
              cursor: "pointer",
            }}
          >
            <LtrText>
              {q} {year}
            </LtrText>
            {isCurrent && (
              <span
                aria-label={t("current_quarter_aria")}
                style={{
                  marginInlineStart: 6,
                  color: "var(--accent-primary)",
                  fontSize: 9,
                }}
              >
                ●
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────

export default function QuarterlyKPIScreen({ role = "CFO" }) {
  const { t } = useTranslation("quarterlyKpi");
  const normRole = normalizeRole(role);
  const hasAccess =
    normRole === ROLES.CFO || normRole === ROLES.SENIOR || normRole === ROLES.OWNER;

  // Default to the current calendar quarter. This is a UI selector only
  // today — the underlying primitives don't yet accept a period filter
  // (see file-header comment). We surface the selector so the screen
  // reads correctly in a follow-up that does wire period-filtered reads.
  const now = new Date();
  const currentQ = `Q${Math.floor(now.getUTCMonth() / 3) + 1}`;
  const [quarter, setQuarter] = useState(currentQ);

  const [pulse, setPulse] = useState(null);
  const [cash, setCash] = useState(null);
  const [arAging, setArAging] = useState(null);
  const [apAging, setApAging] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Parallel reads. Each primitive already degrades gracefully in
      // LIVE mode via the engine router's mock_fallback path, so a
      // single endpoint outage does not collapse the whole screen.
      const [p, c, ar, ap, f] = await Promise.all([
        getBusinessPulse().catch(() => null),
        getCashPosition().catch(() => null),
        getAgingReport("AR").catch(() => null),
        getAgingReport("AP").catch(() => null),
        getForecast().catch(() => null),
      ]);
      setPulse(p);
      setCash(c);
      setArAging(ar);
      setApAging(ap);
      setForecast(f);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasAccess) return;
    load();
  }, [hasAccess, load]);

  // Derived KPI values — memoized so the render path stays cheap when
  // unrelated state (selector, toggles) changes.
  const kpi = useMemo(() => {
    const rev = pulse?.revenue || null;
    const exp = pulse?.expenses || null;
    const ni = pulse?.netIncome || null;
    const dso = arAging?.dso ?? null;
    const dpo = apAging?.dpo ?? null;
    const ccc = computeCashCycle(dso, dpo);
    const cashTotal =
      cash?.total != null ? cash.total : pulse?.cash?.total ?? null;
    const monthlyBurn = monthlyBurnFromPulse(pulse);
    const runway = computeRunwayMonths(cashTotal, monthlyBurn);
    return { rev, exp, ni, dso, dpo, ccc, cashTotal, monthlyBurn, runway };
  }, [pulse, cash, arAging, apAging]);

  // Next-3-month projected burn from forecast, shown as the card
  // secondary so the reader sees both current-run-rate + trend.
  const projectedBurn = useMemo(() => {
    if (!forecast?.months) return null;
    const next3 = forecast.months.slice(0, 3);
    if (next3.length === 0) return null;
    const total = next3.reduce(
      (acc, m) => acc.plus(new Decimal(String(m.expenses || 0))),
      new Decimal(0)
    );
    return total.div(next3.length);
  }, [forecast]);

  if (!hasAccess) return <RoleGate />;

  return (
    <div
      data-testid="quarterlykpi-screen"
      style={{
        flex: 1,
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        overflowY: "auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <BarChart3 size={20} strokeWidth={1.8} color="var(--text-primary)" />
            <h1
              style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 22,
                fontWeight: 600,
                color: "var(--text-primary)",
                margin: 0,
                letterSpacing: "-0.01em",
              }}
            >
              {t("title")}
            </h1>
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              lineHeight: 1.5,
              maxWidth: 720,
            }}
          >
            {t("description")}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <QuarterSelector value={quarter} onChange={setQuarter} t={t} />
          <button
            data-testid="quarterlykpi-reload"
            onClick={load}
            disabled={loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid var(--border-default)",
              background: "var(--bg-surface)",
              color: "var(--text-secondary)",
              fontSize: 12,
              cursor: loading ? "progress" : "pointer",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            <RefreshCw size={14} strokeWidth={2} />
            {t("reload")}
          </button>
        </div>
      </div>

      {/* Period-filter caveat banner — the underlying primitives don't
          yet accept a fiscal-quarter parameter. Readers see the latest
          snapshot; we flag the caveat explicitly. */}
      <div
        data-testid="quarterlykpi-period-caveat"
        style={{
          padding: "10px 14px",
          borderRadius: 8,
          border: "1px solid var(--border-subtle)",
          background: "var(--bg-surface-sunken)",
          color: "var(--text-secondary)",
          fontSize: 12,
          lineHeight: 1.5,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Info size={14} strokeWidth={1.8} aria-hidden="true" />
        <span>{t("period_caveat", { quarter })}</span>
      </div>

      {/* Error state */}
      {error && (
        <div
          data-testid="quarterlykpi-error"
          role="alert"
          style={{
            padding: "12px 14px",
            border: "1px solid var(--semantic-danger)",
            background: "var(--semantic-danger-subtle)",
            borderRadius: 8,
            color: "var(--semantic-danger)",
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <AlertTriangle size={14} strokeWidth={2} />
          <span>{t("errors.load_failed", { message: error })}</span>
        </div>
      )}

      {/* Loading state — first render only */}
      {loading && !pulse && !cash && !arAging && !apAging && !forecast && (
        <div
          data-testid="quarterlykpi-loading"
          style={{
            padding: 32,
            textAlign: "center",
            color: "var(--text-tertiary)",
            fontSize: 13,
          }}
        >
          {t("loading")}
        </div>
      )}

      {/* Empty state — every source returned null (unusual but possible
          in a freshly-seeded tenant with no transactions). */}
      {!loading && !pulse && !cash && !arAging && !apAging && !forecast && (
        <div
          data-testid="quarterlykpi-empty"
          style={{
            padding: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <EmptyState
            icon={BarChart3}
            title={t("empty.title")}
            description={t("empty.description")}
          />
        </div>
      )}

      {/* KPI grid */}
      {(pulse || cash || arAging || apAging || forecast) && (
        <div
          data-testid="quarterlykpi-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 14,
          }}
        >
          {/* 1. Revenue Growth */}
          <KPICard
            icon={TrendingUp}
            label={t("kpi.revenue_growth.label")}
            value={formatKwd(kpi.rev?.current)}
            delta={kpi.rev?.percentChange}
            deltaLabel={t("kpi.revenue_growth.vs_prior")}
            tooltip={t("kpi.revenue_growth.tooltip")}
            testId="quarterlykpi-card-revenue"
            secondary={[
              {
                label: t("kpi.revenue_growth.prior_label"),
                value: formatKwd(kpi.rev?.prior),
              },
            ]}
          />

          {/* 2. Margin (gross + operating) */}
          <KPICard
            icon={Percent}
            label={t("kpi.margin.label")}
            value={
              kpi.ni?.grossMargin != null
                ? formatPercent(kpi.ni.grossMargin)
                : "—"
            }
            tooltip={t("kpi.margin.tooltip")}
            testId="quarterlykpi-card-margin"
            secondary={[
              {
                label: t("kpi.margin.gross_label"),
                value:
                  kpi.ni?.grossMargin != null
                    ? formatPercent(kpi.ni.grossMargin)
                    : "—",
                color: trendColor(kpi.ni?.grossMargin),
              },
              {
                label: t("kpi.margin.operating_label"),
                value:
                  kpi.ni?.operatingMargin != null
                    ? formatPercent(kpi.ni.operatingMargin)
                    : "—",
                color: trendColor(kpi.ni?.operatingMargin),
              },
            ]}
          />

          {/* 3. Cash Cycle */}
          <KPICard
            icon={Repeat}
            label={t("kpi.cash_cycle.label")}
            value={
              kpi.ccc != null ? `${kpi.ccc} ${t("kpi.cash_cycle.unit")}` : "—"
            }
            tooltip={t("kpi.cash_cycle.tooltip")}
            testId="quarterlykpi-card-cash-cycle"
            secondary={[
              {
                label: t("kpi.cash_cycle.dso_label"),
                value:
                  kpi.dso != null
                    ? `${kpi.dso} ${t("kpi.cash_cycle.unit")}`
                    : "—",
              },
              {
                label: t("kpi.cash_cycle.dpo_label"),
                value:
                  kpi.dpo != null
                    ? `${kpi.dpo} ${t("kpi.cash_cycle.unit")}`
                    : "—",
              },
            ]}
          />

          {/* 4. Burn Rate */}
          <KPICard
            icon={Flame}
            label={t("kpi.burn.label")}
            value={
              kpi.monthlyBurn != null
                ? formatKwd(kpi.monthlyBurn.toString())
                : "—"
            }
            tooltip={t("kpi.burn.tooltip")}
            testId="quarterlykpi-card-burn"
            secondary={
              projectedBurn != null
                ? [
                    {
                      label: t("kpi.burn.projected_label"),
                      value: formatKwd(projectedBurn.toString()),
                    },
                  ]
                : undefined
            }
          />

          {/* 5. Runway */}
          <KPICard
            icon={Clock}
            label={t("kpi.runway.label")}
            value={
              kpi.runway == null
                ? "—"
                : kpi.runway.profitable
                  ? t("kpi.runway.profitable")
                  : kpi.runway.clamped
                    ? `${formatInt(kpi.runway.months)}+ ${t("kpi.runway.unit")}`
                    : `${kpi.runway.months} ${t("kpi.runway.unit")}`
            }
            tooltip={t("kpi.runway.tooltip")}
            testId="quarterlykpi-card-runway"
            secondary={[
              {
                label: t("kpi.runway.cash_label"),
                value: formatKwd(kpi.cashTotal),
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}
