/**
 * Tier D frontend-bundle screenshot harness.
 *
 * Mounts MissedRecurrencesCard + CrossTenantContextCard in four panels
 * on a single page so Playwright can capture EN/AR × dark/light
 * screenshots of each scenario. Harness reads ?scenario=<id> from the
 * query string to pick which card(s) to render; defaults to 'mixed'.
 */
import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import i18n from "../../src/i18n";
import "../../src/styles/themes.css";
import "../../src/styles/tokens.css";
import "../../src/styles/a11y.css";
import "../../src/index.css";
import {
  MissedRecurrencesCard,
  CrossTenantContextCard,
} from "../../src/components/cfo/AminahSlideOver";

const KWD_NATIVE_HIGH = {
  patternId: "rp-kwd-001",
  merchantNormalizedName: "Office rent — Sharq",
  expectedIntervalDays: 30,
  expectedAmountKwd: "4200.000",
  lastSeenAt: "2026-02-01T08:00:00.000Z",
  nextExpectedAt: "2026-04-01T08:00:00.000Z",
  daysOverdue: 20,
  severity: "HIGH",
  severityScore: 95,
  nativeCurrency: "KWD",
  nativeExpectedAmount: "4200.000",
  fxRateUsed: null,
  fxRateDate: null,
  fxRateSource: "none",
};

const KWD_NATIVE_MEDIUM = {
  patternId: "rp-kwd-002",
  merchantNormalizedName: "Zain Kuwait",
  expectedIntervalDays: 30,
  expectedAmountKwd: "624.750",
  lastSeenAt: "2026-03-05T08:00:00.000Z",
  nextExpectedAt: "2026-04-05T08:00:00.000Z",
  daysOverdue: 16,
  severity: "MEDIUM",
  severityScore: 60,
  nativeCurrency: "KWD",
  nativeExpectedAmount: "624.750",
  fxRateUsed: null,
  fxRateDate: null,
  fxRateSource: "none",
};

const NON_KWD_EXACT = {
  patternId: "rp-usd-003",
  merchantNormalizedName: "AWS Cloud",
  expectedIntervalDays: 30,
  expectedAmountKwd: "384.615",
  lastSeenAt: "2026-03-05T08:00:00.000Z",
  nextExpectedAt: "2026-04-05T08:00:00.000Z",
  daysOverdue: 16,
  severity: "MEDIUM",
  severityScore: 62,
  nativeCurrency: "USD",
  nativeExpectedAmount: "1250.00",
  fxRateUsed: "0.30769",
  fxRateDate: "2026-04-05T00:00:00.000Z",
  fxRateSource: "exact",
};

const NON_KWD_FALLBACK = {
  patternId: "rp-eur-004",
  merchantNormalizedName: "Stripe Europe",
  expectedIntervalDays: 30,
  expectedAmountKwd: "1127.500",
  lastSeenAt: "2026-03-15T08:00:00.000Z",
  nextExpectedAt: "2026-04-15T08:00:00.000Z",
  daysOverdue: 6,
  severity: "HIGH",
  severityScore: 91,
  nativeCurrency: "EUR",
  nativeExpectedAmount: "3500.00",
  fxRateUsed: "0.32214",
  fxRateDate: "2026-04-14T00:00:00.000Z",
  fxRateSource: "fallback",
};

const UNKNOWN_ITEM = {
  patternId: "rp-unk-005",
  merchantNormalizedName: "Latin America Freight",
  expectedIntervalDays: 30,
  expectedAmountKwd: null,
  lastSeenAt: "2026-03-01T08:00:00.000Z",
  nextExpectedAt: "2026-04-01T08:00:00.000Z",
  daysOverdue: 20,
  severity: "UNKNOWN",
  severityScore: 0,
  nativeCurrency: "ARS",
  nativeExpectedAmount: "9500000.00",
  fxRateUsed: null,
  fxRateDate: null,
  fxRateSource: "unavailable",
};

const MIXED_BLOCK = {
  type: "tool_call",
  toolName: "get_missing_recurrences",
  status: "complete",
  callId: "call-1",
  result: {
    items: [KWD_NATIVE_HIGH, NON_KWD_EXACT, NON_KWD_FALLBACK, UNKNOWN_ITEM],
    total: 4,
    interactionHint: "operator_suspend",
    currencyNote:
      "Amounts are FX-normalised to KWD using CBK rates at the expected cadence date. UNKNOWN severity indicates an unavailable FX rate at that date.",
  },
};

const KWD_ONLY_BLOCK = {
  type: "tool_call",
  toolName: "get_missing_recurrences",
  status: "complete",
  callId: "call-1",
  result: {
    items: [KWD_NATIVE_HIGH, KWD_NATIVE_MEDIUM],
    total: 2,
    interactionHint: "operator_suspend",
    currencyNote:
      "Amounts are in KWD at the expected recurring cadence. Tenant base currency is KWD; no FX normalisation required.",
  },
};

const ABOVE_THRESHOLD_BLOCK = {
  type: "tool_call",
  toolName: "get_cross_tenant_recurrence_context",
  status: "complete",
  callId: "call-2",
  result: {
    merchantNormalizedName: "Zain Kuwait",
    distinctTenantCount: 8,
    medianExpectedAmountKwd: "624.750",
    medianIntervalDays: 30,
    industryBucket: "retail",
    intervalClass: "monthly",
    note:
      "Aggregate computed across 8 tenants in the retail industry. Individual tenant amounts are not disclosed (privacy threshold: minimum 3 tenants).",
    thresholdMet: true,
  },
};

const BELOW_THRESHOLD_BLOCK = {
  type: "tool_call",
  toolName: "get_cross_tenant_recurrence_context",
  status: "complete",
  callId: "call-2",
  result: {
    merchantNormalizedName: "Boutique Vendor LLC",
    distinctTenantCount: 0,
    medianExpectedAmountKwd: null,
    medianIntervalDays: 0,
    industryBucket: "retail",
    intervalClass: null,
    note:
      "Not enough distinct tenants share this merchant for aggregate insight (privacy threshold: minimum 3 tenants).",
    thresholdMet: false,
  },
};

function Panel({ title, children }) {
  return (
    <div
      style={{
        maxWidth: 460,
        padding: 16,
        marginBottom: 20,
        background: "var(--panel-bg, var(--bg-surface))",
        borderRadius: 12,
        border: "1px solid var(--border-default)",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          color: "var(--text-tertiary)",
          marginBottom: 10,
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function App() {
  const { t } = useTranslation("aminah");
  const params = new URLSearchParams(window.location.search);
  const scenario = params.get("scenario") || "mixed";
  const lang = params.get("lang") || "en";

  useEffect(() => {
    i18n.changeLanguage(lang);
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
  }, [lang]);

  let body;
  if (scenario === "mixed-severities") {
    body = (
      <Panel title="MissedRecurrencesCard — mixed severities (non-KWD tenant)">
        <MissedRecurrencesCard block={MIXED_BLOCK} role="CFO" t={t} />
      </Panel>
    );
  } else if (scenario === "kwd-native") {
    body = (
      <Panel title="MissedRecurrencesCard — KWD-native tenant (no FX fields)">
        <MissedRecurrencesCard block={KWD_ONLY_BLOCK} role="CFO" t={t} />
      </Panel>
    );
  } else if (scenario === "cross-tenant-above") {
    body = (
      <Panel title="CrossTenantContextCard — above threshold (≥3 tenants)">
        <CrossTenantContextCard block={ABOVE_THRESHOLD_BLOCK} t={t} />
      </Panel>
    );
  } else if (scenario === "cross-tenant-below") {
    body = (
      <Panel title="CrossTenantContextCard — below threshold (privacy)">
        <CrossTenantContextCard block={BELOW_THRESHOLD_BLOCK} t={t} />
      </Panel>
    );
  } else {
    body = (
      <>
        <Panel title="Mixed severities (non-KWD tenant)">
          <MissedRecurrencesCard block={MIXED_BLOCK} role="CFO" t={t} />
        </Panel>
        <Panel title="KWD-native tenant">
          <MissedRecurrencesCard block={KWD_ONLY_BLOCK} role="CFO" t={t} />
        </Panel>
        <Panel title="Cross-tenant context — above threshold">
          <CrossTenantContextCard block={ABOVE_THRESHOLD_BLOCK} t={t} />
        </Panel>
        <Panel title="Cross-tenant context — below threshold">
          <CrossTenantContextCard block={BELOW_THRESHOLD_BLOCK} t={t} />
        </Panel>
      </>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-base, #0B0F14)",
        color: "var(--text-primary)",
        padding: "32px 24px",
        fontFamily:
          lang === "ar" ? "'Noto Sans Arabic', sans-serif" : "'DM Sans', sans-serif",
      }}
    >
      {body}
    </div>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);
