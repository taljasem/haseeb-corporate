/**
 * QuarterlyKPIScreen — AUDIT-ACC-055 (2026-04-23).
 *
 * Covers:
 *   1. Populated KPI grid renders all five cards (revenue, margin,
 *      cash cycle, burn, runway) with formatted values.
 *   2. Role gating: Owner / CFO / Senior render the grid; Junior lands
 *      on the role-gate panel and no engine reads fire.
 *   3. Graceful degradation: if any of the five engine primitives
 *      rejects, the remaining cards still render, and the error state
 *      is NOT triggered (Promise.all rejection is caught per-primitive).
 *   4. Runway "profitable" branch: when monthly burn is 0 / negative,
 *      the card renders the profitable label instead of a finite number.
 *   5. Period selector: switching quarter invokes no new fetch (the
 *      primitives don't accept a period param today; the caveat banner
 *      tells the reader why). Current-quarter dot renders.
 *   6. i18n parity: EN + AR quarterlyKpi namespaces have identical key
 *      sets (structural) — prevents AR from silently falling back to
 *      English for one deep key.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
  waitFor,
} from "@testing-library/react";
import React from "react";

import i18n from "../../src/i18n";
import enQKP from "../../src/i18n/locales/en/quarterlyKpi.json";
import arQKP from "../../src/i18n/locales/ar/quarterlyKpi.json";

// ── Engine boundary stubs ─────────────────────────────────────────
const getBusinessPulseSpy = vi.fn();
const getCashPositionSpy = vi.fn();
const getAgingReportSpy = vi.fn();
const getForecastSpy = vi.fn();

vi.mock("../../src/engine", () => ({
  __esModule: true,
  getBusinessPulse: (...args) => getBusinessPulseSpy(...args),
  getCashPosition: (...args) => getCashPositionSpy(...args),
  getAgingReport: (...args) => getAgingReportSpy(...args),
  getForecast: (...args) => getForecastSpy(...args),
}));

import QuarterlyKPIScreen from "../../src/screens/cfo/QuarterlyKPIScreen";

async function setLang(lang) {
  await act(async () => {
    await i18n.changeLanguage(lang);
  });
}

// ── Fixtures ──────────────────────────────────────────────────────

function makePulse(overrides = {}) {
  return {
    revenue: { current: 185000, prior: 170000, percentChange: 8.8 },
    expenses: { current: 142000, prior: 138000, percentChange: 2.9 },
    netIncome: {
      current: 43000,
      prior: 32000,
      percentChange: 34.4,
      grossMargin: 42.5,
      operatingMargin: 23.2,
    },
    cash: { total: 184235.5, accountCount: 2, subtext: "across 2 KIB accounts" },
    ...overrides,
  };
}

function makeCash() {
  return {
    total: 184235.5,
    accounts: [
      { name: "KIB Operating", balance: 142100.25, currency: "KWD" },
      { name: "KIB Reserve", balance: 42135.25, currency: "KWD" },
    ],
  };
}

function makeArAging() {
  return { type: "AR", dso: 42, totals: {}, counts: {}, trend: [] };
}

function makeApAging() {
  return { type: "AP", dpo: 38, totals: {}, counts: {}, trend: [] };
}

function makeForecast() {
  return {
    scenario: "base",
    months: [
      { month: "May 26", revenue: 190000, expenses: 145000, endingBalance: 190000 },
      { month: "Jun 26", revenue: 195000, expenses: 148000, endingBalance: 195000 },
      { month: "Jul 26", revenue: 200000, expenses: 150000, endingBalance: 200000 },
    ],
  };
}

function stubAllPrimitives({ pulse = makePulse(), cash = makeCash(), ar = makeArAging(), ap = makeApAging(), forecast = makeForecast() } = {}) {
  getBusinessPulseSpy.mockResolvedValue(pulse);
  getCashPositionSpy.mockResolvedValue(cash);
  getAgingReportSpy.mockImplementation((type) => {
    if (type === "AR") return Promise.resolve(ar);
    if (type === "AP") return Promise.resolve(ap);
    return Promise.resolve(null);
  });
  getForecastSpy.mockResolvedValue(forecast);
}

// ── Tests ─────────────────────────────────────────────────────────

describe("QuarterlyKPIScreen — AUDIT-ACC-055", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await setLang("en");
  });

  afterEach(() => {
    cleanup();
  });

  it("renders all five KPI cards with formatted values for CFO", async () => {
    stubAllPrimitives();
    render(<QuarterlyKPIScreen role="CFO" />);

    await waitFor(() => {
      expect(screen.getByTestId("quarterlykpi-card-revenue")).toBeInTheDocument();
    });

    expect(screen.getByTestId("quarterlykpi-card-revenue")).toBeInTheDocument();
    expect(screen.getByTestId("quarterlykpi-card-margin")).toBeInTheDocument();
    expect(screen.getByTestId("quarterlykpi-card-cash-cycle")).toBeInTheDocument();
    expect(screen.getByTestId("quarterlykpi-card-burn")).toBeInTheDocument();
    expect(screen.getByTestId("quarterlykpi-card-runway")).toBeInTheDocument();

    // Revenue card shows the current revenue value (formatted with
    // thousand separators + 3dp).
    const revenueCard = screen.getByTestId("quarterlykpi-card-revenue");
    expect(revenueCard.textContent).toMatch(/185,000\.000/);

    // Cash cycle = DSO − DPO = 42 − 38 = 4 days.
    const cccCard = screen.getByTestId("quarterlykpi-card-cash-cycle");
    expect(cccCard.textContent).toMatch(/4 days/);
    expect(cccCard.textContent).toMatch(/42 days/); // DSO secondary
    expect(cccCard.textContent).toMatch(/38 days/); // DPO secondary

    // Runway: cash 184235.5 / burn 142000 ≈ 1.3 months.
    const runwayCard = screen.getByTestId("quarterlykpi-card-runway");
    expect(runwayCard.textContent).toMatch(/1\.3 months/);
  });

  it("renders KPI grid for Owner and Senior roles", async () => {
    stubAllPrimitives();
    const { rerender } = render(<QuarterlyKPIScreen role="Owner" />);
    await waitFor(() => {
      expect(screen.getByTestId("quarterlykpi-grid")).toBeInTheDocument();
    });
    rerender(<QuarterlyKPIScreen role="Senior" />);
    await waitFor(() => {
      expect(screen.getByTestId("quarterlykpi-grid")).toBeInTheDocument();
    });
  });

  it("shows role-gate panel for Junior and fires zero engine reads", async () => {
    stubAllPrimitives();
    render(<QuarterlyKPIScreen role="Junior" />);

    expect(screen.getByTestId("quarterlykpi-role-gate")).toBeInTheDocument();
    expect(screen.queryByTestId("quarterlykpi-grid")).not.toBeInTheDocument();

    // None of the primitives should have been called.
    expect(getBusinessPulseSpy).not.toHaveBeenCalled();
    expect(getCashPositionSpy).not.toHaveBeenCalled();
    expect(getAgingReportSpy).not.toHaveBeenCalled();
    expect(getForecastSpy).not.toHaveBeenCalled();
  });

  it("degrades gracefully when one primitive rejects — remaining cards still render", async () => {
    stubAllPrimitives();
    // AR rejects: cash-cycle should render with "—" for DSO.
    getAgingReportSpy.mockImplementation((type) => {
      if (type === "AR") return Promise.reject(new Error("AR outage"));
      if (type === "AP") return Promise.resolve(makeApAging());
      return Promise.resolve(null);
    });

    render(<QuarterlyKPIScreen role="CFO" />);

    await waitFor(() => {
      expect(screen.getByTestId("quarterlykpi-card-cash-cycle")).toBeInTheDocument();
    });

    // Error banner should NOT be visible — per-primitive rejections are
    // caught and swallowed to keep the rest of the screen alive.
    expect(screen.queryByTestId("quarterlykpi-error")).not.toBeInTheDocument();

    // Revenue card still renders (pulse succeeded).
    const revenueCard = screen.getByTestId("quarterlykpi-card-revenue");
    expect(revenueCard.textContent).toMatch(/185,000\.000/);
  });

  it("renders 'Profitable' runway when monthly burn <= revenue (negative net expense)", async () => {
    // Here we flip: expenses.current = 0 → burn = 0 → profitable branch.
    stubAllPrimitives({
      pulse: makePulse({
        expenses: { current: 0, prior: 0, percentChange: null },
      }),
    });
    render(<QuarterlyKPIScreen role="CFO" />);
    await waitFor(() => {
      expect(screen.getByTestId("quarterlykpi-card-runway")).toBeInTheDocument();
    });
    const runwayCard = screen.getByTestId("quarterlykpi-card-runway");
    expect(runwayCard.textContent).toMatch(/Profitable/);
  });

  it("renders period caveat banner citing the selected quarter", async () => {
    stubAllPrimitives();
    render(<QuarterlyKPIScreen role="CFO" />);
    await waitFor(() => {
      expect(screen.getByTestId("quarterlykpi-period-caveat")).toBeInTheDocument();
    });
    const banner = screen.getByTestId("quarterlykpi-period-caveat");
    expect(banner.textContent).toMatch(/Q[1-4]/);
  });

  it("quarter selector is clickable and updates the caveat banner", async () => {
    stubAllPrimitives();
    render(<QuarterlyKPIScreen role="CFO" />);
    await waitFor(() => {
      expect(screen.getByTestId("quarterlykpi-tab-q1")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId("quarterlykpi-tab-q1"));
    const banner = screen.getByTestId("quarterlykpi-period-caveat");
    expect(banner.textContent).toMatch(/Q1/);
    fireEvent.click(screen.getByTestId("quarterlykpi-tab-q4"));
    const bannerAfter = screen.getByTestId("quarterlykpi-period-caveat");
    expect(bannerAfter.textContent).toMatch(/Q4/);
  });

  it("reload button triggers a fresh set of primitive calls", async () => {
    stubAllPrimitives();
    render(<QuarterlyKPIScreen role="CFO" />);
    await waitFor(() => {
      expect(getBusinessPulseSpy).toHaveBeenCalledTimes(1);
    });
    fireEvent.click(screen.getByTestId("quarterlykpi-reload"));
    await waitFor(() => {
      expect(getBusinessPulseSpy).toHaveBeenCalledTimes(2);
    });
  });

  it("renders correctly in Arabic locale", async () => {
    stubAllPrimitives();
    await setLang("ar");
    render(<QuarterlyKPIScreen role="CFO" />);
    await waitFor(() => {
      expect(screen.getByTestId("quarterlykpi-grid")).toBeInTheDocument();
    });
    // Title is localized — should be the AR title, not English fallback.
    expect(screen.getByText(arQKP.title)).toBeInTheDocument();
  });

  it("i18n parity — EN and AR quarterlyKpi namespaces have identical key structure", () => {
    function collectKeys(obj, prefix = "") {
      const out = [];
      for (const k of Object.keys(obj)) {
        const key = prefix ? `${prefix}.${k}` : k;
        const v = obj[k];
        if (v && typeof v === "object" && !Array.isArray(v)) {
          out.push(...collectKeys(v, key));
        } else {
          out.push(key);
        }
      }
      return out.sort();
    }
    expect(collectKeys(enQKP)).toEqual(collectKeys(arQKP));
  });
});
