/**
 * Tier D frontend surface spec — FOLLOW-UP-TIER-D-2-FRONTEND +
 * FOLLOW-UP-TIER-D-3-FRONTEND bundle.
 *
 * Verifies the two typed Aminah cards:
 *   - MissedRecurrencesCard extension for FX-normalized severity +
 *     UNKNOWN tier (Tier D Dispatch 2, backend corporate-api `a8772c8`).
 *   - CrossTenantContextCard new typed-card variant for
 *     `get_cross_tenant_recurrence_context` (Tier D Dispatch 3, backend
 *     corporate-api `5a8d2df`).
 *
 * Both cards are internal short-circuits in AminahSlideOver's
 * BlockRenderer; the component file exports them as named symbols for
 * this harness. Tests feed shaped `block.result` objects matching the
 * verified backend contracts.
 *
 * Harness conventions follow AminahChat.i18n.spec.jsx:
 *   - `i18n.changeLanguage('ar')` for AR parity assertions.
 *   - `cleanup()` in afterEach.
 *   - No auth context — the cards don't call useAuth.
 */

import { describe, it, expect, afterEach, beforeEach } from "vitest";
import {
  render,
  screen,
  within,
  cleanup,
  act,
} from "@testing-library/react";
import React from "react";

import {
  MissedRecurrencesCard,
  CrossTenantContextCard,
} from "../../src/components/cfo/AminahSlideOver";
import i18n from "../../src/i18n";

function t(key, opts) {
  return i18n.t(key, { ns: "aminah", ...(opts || {}) });
}

async function setLang(lang) {
  await act(async () => {
    await i18n.changeLanguage(lang);
  });
}

// ── Fixtures ──────────────────────────────────────────────────────────────

const KWD_NATIVE_ITEM = {
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

const NON_KWD_EXACT_ITEM = {
  patternId: "rp-usd-002",
  merchantNormalizedName: "AWS Cloud",
  expectedIntervalDays: 30,
  expectedAmountKwd: "384.615",
  lastSeenAt: "2026-03-05T08:00:00.000Z",
  nextExpectedAt: "2026-04-05T08:00:00.000Z",
  daysOverdue: 16,
  severity: "MEDIUM",
  severityScore: 60,
  nativeCurrency: "USD",
  nativeExpectedAmount: "1250.00",
  fxRateUsed: "0.30769",
  fxRateDate: "2026-04-05T00:00:00.000Z",
  fxRateSource: "exact",
};

const NON_KWD_FALLBACK_ITEM = {
  patternId: "rp-eur-003",
  merchantNormalizedName: "Stripe Europe",
  expectedIntervalDays: 30,
  expectedAmountKwd: "327.500",
  lastSeenAt: "2026-03-15T08:00:00.000Z",
  nextExpectedAt: "2026-04-15T08:00:00.000Z",
  daysOverdue: 6,
  severity: "LOW",
  severityScore: 20,
  nativeCurrency: "EUR",
  nativeExpectedAmount: "1000.00",
  fxRateUsed: "0.32750",
  fxRateDate: "2026-04-14T00:00:00.000Z",
  fxRateSource: "fallback",
};

const UNKNOWN_ITEM = {
  patternId: "rp-unk-004",
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

function missedBlock(items, note = "") {
  return {
    type: "tool_call",
    toolName: "get_missing_recurrences",
    status: "complete",
    callId: "call-1",
    result: {
      items,
      total: items.length,
      interactionHint: "operator_suspend",
      currencyNote:
        note ||
        "Amounts are FX-normalised to KWD using CBK rates at the expected cadence date. UNKNOWN severity indicates an unavailable FX rate.",
    },
  };
}

function crossTenantBlock(overrides = {}) {
  return {
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
      ...overrides,
    },
  };
}

const belowThresholdBlock = crossTenantBlock({
  distinctTenantCount: 0,
  medianExpectedAmountKwd: null,
  medianIntervalDays: 0,
  intervalClass: null,
  thresholdMet: false,
  note:
    "Not enough distinct tenants share this merchant for aggregate insight (privacy threshold: minimum 3 tenants).",
});

// ── MissedRecurrencesCard — Tier D Dispatch 2 extensions ─────────────────

describe("MissedRecurrencesCard — Tier D FX + UNKNOWN (Dispatch 2)", () => {
  beforeEach(async () => {
    await setLang("en");
  });
  afterEach(() => {
    cleanup();
  });

  it("UNKNOWN severity item renders neutral badge + fx_unavailable_badge and no KWD amount", () => {
    // Render with an empty currencyNote so the footer doesn't contain
    // "KWD" and pollute the assertion below.
    render(
      <MissedRecurrencesCard
        block={missedBlock([UNKNOWN_ITEM], "Intentionally blank for unit test.")}
        role="CFO"
        t={t}
      />,
    );

    // Neutral "Unknown" label present (not HIGH/MEDIUM/LOW).
    expect(screen.getByText(/Unknown/)).toBeInTheDocument();

    // FX-unavailable badge present.
    expect(screen.getByText(/FX rate unavailable/)).toBeInTheDocument();

    // Native amount present with non-KWD currency code.
    expect(screen.getByText(/9500000\.00 ARS/)).toBeInTheDocument();

    // No KWD amount for this item — expectedAmountKwd was null.
    // (The footer currencyNote is a fixed English sentence and does not
    // contain "KWD" in this render; assert the per-row amount strip has
    // no KWD text.)
    expect(screen.queryByText(/[0-9]+\.[0-9]+ KWD/)).toBeNull();
  });

  it("Non-KWD tenant (exact FX) renders primary KWD + secondary native + FX-rate subordinate line with 'exact match'", () => {
    render(
      <MissedRecurrencesCard
        block={missedBlock([NON_KWD_EXACT_ITEM])}
        role="CFO"
        t={t}
      />,
    );

    // Primary KWD amount.
    expect(screen.getByText(/384\.615 KWD/)).toBeInTheDocument();

    // Secondary native amount with ≈ prefix.
    expect(screen.getByText(/≈ 1250\.00 USD/)).toBeInTheDocument();

    // FX-rate subordinate line — rate, date (YYYY-MM-DD), and "exact match".
    expect(
      screen.getByText(/FX rate: 0\.30769 USD\/KWD · 2026-04-05 · exact match/),
    ).toBeInTheDocument();
  });

  it("Non-KWD tenant (fallback FX) labels the rate source as 'fallback rate'", () => {
    render(
      <MissedRecurrencesCard
        block={missedBlock([NON_KWD_FALLBACK_ITEM])}
        role="CFO"
        t={t}
      />,
    );

    expect(screen.getByText(/327\.500 KWD/)).toBeInTheDocument();
    expect(screen.getByText(/≈ 1000\.00 EUR/)).toBeInTheDocument();
    expect(
      screen.getByText(/FX rate: 0\.32750 EUR\/KWD · 2026-04-14 · fallback rate/),
    ).toBeInTheDocument();
  });

  it("KWD-native tenant (fxRateSource=none) renders only the KWD amount — no secondary line, no FX strip", () => {
    render(
      <MissedRecurrencesCard
        block={missedBlock([KWD_NATIVE_ITEM])}
        role="CFO"
        t={t}
      />,
    );

    expect(screen.getByText(/4200\.000 KWD/)).toBeInTheDocument();

    // No FX-rate subordinate line.
    expect(screen.queryByText(/FX rate:/)).toBeNull();

    // No ≈ secondary prefix.
    expect(screen.queryByText(/≈/)).toBeNull();
  });

  it("Severity order — HIGH → MEDIUM → LOW → UNKNOWN", () => {
    render(
      <MissedRecurrencesCard
        block={missedBlock([
          UNKNOWN_ITEM, // severity UNKNOWN
          NON_KWD_FALLBACK_ITEM, // severity LOW
          KWD_NATIVE_ITEM, // severity HIGH
          NON_KWD_EXACT_ITEM, // severity MEDIUM
        ])}
        role="CFO"
        t={t}
      />,
    );

    const merchants = screen.getAllByText(
      /(Office rent — Sharq|AWS Cloud|Stripe Europe|Latin America Freight)/,
    );

    const sequence = merchants.map((n) => n.textContent);
    expect(sequence).toEqual([
      "Office rent — Sharq", // HIGH
      "AWS Cloud", // MEDIUM
      "Stripe Europe", // LOW
      "Latin America Freight", // UNKNOWN
    ]);
  });

  it("Tolerates null/missing optional fields gracefully (no crash when nativeExpectedAmount is null on UNKNOWN)", () => {
    const minimalUnknown = {
      patternId: "rp-unk-min",
      merchantNormalizedName: "Mystery Vendor",
      expectedIntervalDays: 30,
      expectedAmountKwd: null,
      lastSeenAt: "2026-03-01T08:00:00.000Z",
      nextExpectedAt: "2026-04-01T08:00:00.000Z",
      daysOverdue: 10,
      severity: "UNKNOWN",
      severityScore: 0,
      nativeCurrency: "XOF",
      nativeExpectedAmount: null,
      fxRateUsed: null,
      fxRateDate: null,
      fxRateSource: "unavailable",
    };

    render(
      <MissedRecurrencesCard
        block={missedBlock([minimalUnknown])}
        role="CFO"
        t={t}
      />,
    );

    // Merchant still renders + Unknown badge + FX-unavailable tag.
    expect(screen.getByText("Mystery Vendor")).toBeInTheDocument();
    expect(screen.getByText(/FX rate unavailable/)).toBeInTheDocument();
  });

  it("Role gating — Junior sees the card but NO Suspend button", () => {
    render(
      <MissedRecurrencesCard
        block={missedBlock([NON_KWD_EXACT_ITEM])}
        role="Junior"
        t={t}
      />,
    );

    // FX fields still visible.
    expect(screen.getByText(/384\.615 KWD/)).toBeInTheDocument();
    expect(screen.getByText(/≈ 1250\.00 USD/)).toBeInTheDocument();

    // Suspend button absent.
    expect(
      screen.queryByLabelText(
        /Suspend recurrence pattern for AWS Cloud/i,
      ),
    ).toBeNull();
  });

  it("Role gating — CFO sees the Suspend button", () => {
    render(
      <MissedRecurrencesCard
        block={missedBlock([NON_KWD_EXACT_ITEM])}
        role="CFO"
        t={t}
      />,
    );

    expect(
      screen.getByLabelText(/Suspend recurrence pattern for AWS Cloud/i),
    ).toBeInTheDocument();
  });

  it("AR parity — renders the AR 'Unknown' and 'FX rate unavailable' strings in AR mode", async () => {
    await setLang("ar");
    render(
      <MissedRecurrencesCard
        block={missedBlock([UNKNOWN_ITEM])}
        role="CFO"
        t={t}
      />,
    );

    expect(screen.getByText(/غير معروف/)).toBeInTheDocument();
    expect(screen.getByText(/سعر الصرف غير متوفر/)).toBeInTheDocument();
  });
});

// ── CrossTenantContextCard — Tier D Dispatch 3 ───────────────────────────

describe("CrossTenantContextCard — Tier D Dispatch 3", () => {
  beforeEach(async () => {
    await setLang("en");
  });
  afterEach(() => {
    cleanup();
  });

  it("renders full content when thresholdMet=true (distinctCount + industry + median amount + typical interval)", () => {
    render(<CrossTenantContextCard block={crossTenantBlock()} t={t} />);

    // Header with merchant name.
    expect(screen.getByText(/Cross-tenant context · Zain Kuwait/)).toBeInTheDocument();

    // Tenant-count + industry line.
    expect(
      screen.getByText(/8 tenants in retail industry/),
    ).toBeInTheDocument();

    // Median amount.
    expect(screen.getByText(/Median amount/)).toBeInTheDocument();
    expect(screen.getByText(/624\.750 KWD/)).toBeInTheDocument();

    // Typical interval label + class.
    expect(screen.getByText(/Typical interval/)).toBeInTheDocument();
    expect(screen.getByText(/Monthly/)).toBeInTheDocument();
  });

  it("renders below-threshold empty state when thresholdMet=false — NO tenant count, NO median amount", () => {
    render(<CrossTenantContextCard block={belowThresholdBlock} t={t} />);

    expect(
      screen.getByText(/Not enough cross-tenant signal yet/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /A minimum of 3 tenants must share this merchant before aggregate insight is available/,
      ),
    ).toBeInTheDocument();

    // No tenant count surfaces.
    expect(screen.queryByText(/tenants in .* industry/)).toBeNull();

    // No median amount surfaces.
    expect(screen.queryByText(/Median amount/)).toBeNull();
  });

  it("Tolerates null/missing optional fields gracefully (null medianExpectedAmountKwd, null intervalClass)", () => {
    const partial = crossTenantBlock({
      medianExpectedAmountKwd: null,
      intervalClass: null,
      medianIntervalDays: 45,
    });
    render(<CrossTenantContextCard block={partial} t={t} />);

    // Header + tenant count still render.
    expect(
      screen.getByText(/Cross-tenant context · Zain Kuwait/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/8 tenants in retail industry/),
    ).toBeInTheDocument();

    // Median amount line hidden.
    expect(screen.queryByText(/Median amount/)).toBeNull();

    // Typical interval falls back to "~45 days" text.
    expect(screen.getByText(/~45 days/)).toBeInTheDocument();
  });

  it("AR parity — below-threshold explanation renders in AR mode", async () => {
    await setLang("ar");
    render(<CrossTenantContextCard block={belowThresholdBlock} t={t} />);

    expect(
      screen.getByText(/لا توجد بيانات كافية عبر المستأجرين بعد/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/ضمان الخصوصية/),
    ).toBeInTheDocument();
  });

  it("AR parity — above-threshold full card uses AR strings (title + interval class)", async () => {
    await setLang("ar");
    render(<CrossTenantContextCard block={crossTenantBlock()} t={t} />);

    expect(screen.getByText(/سياق عبر المستأجرين/)).toBeInTheDocument();
    expect(screen.getByText(/شهري/)).toBeInTheDocument();
  });
});
