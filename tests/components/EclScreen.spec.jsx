/**
 * EclScreen — HASEEB-409 frontend (companion to backend HASEEB-408, FN-265).
 *
 * Covers:
 *   1. Matrix renders for CFO with real API data (mocked engine module).
 *   2. Owner can click a cell → input appears → save triggers PATCH.
 *   3. Non-OWNER cells are read-only (buttons disabled, no input shown).
 *   4. Role-gate panel shows for Junior; no engine reads fire.
 *   5. Run Compute button: calls computeEcl, renders summary + per-bucket
 *      breakdown.
 *   6. Bilingual EN + AR smoke: title localises via the `ecl` namespace.
 *   7. i18n parity: EN + AR ecl namespaces have identical key structure.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
  waitFor,
  within,
} from "@testing-library/react";
import React from "react";

import i18n from "../../src/i18n";
import enEcl from "../../src/i18n/locales/en/ecl.json";
import arEcl from "../../src/i18n/locales/ar/ecl.json";

// ── Engine boundary stubs ─────────────────────────────────────────
const getEclMatrixSpy = vi.fn();
const updateEclMatrixRowSpy = vi.fn();
const computeEclSpy = vi.fn();

vi.mock("../../src/engine", () => ({
  __esModule: true,
  getEclMatrix: (...args) => getEclMatrixSpy(...args),
  updateEclMatrixRow: (...args) => updateEclMatrixRowSpy(...args),
  computeEcl: (...args) => computeEclSpy(...args),
}));

import EclScreen from "../../src/screens/cfo/EclScreen";

async function setLang(lang) {
  await act(async () => {
    await i18n.changeLanguage(lang);
  });
}

// ── Fixtures ──────────────────────────────────────────────────────

const CLASSES = [
  "GOVERNMENT",
  "PRIVATE_CORPORATE",
  "PRIVATE_SME",
  "AFFILIATE",
  "RELATED_PARTY",
  "INDIVIDUAL",
];
const BUCKETS = [
  "CURRENT",
  "D1_30",
  "D31_60",
  "D61_90",
  "D91_180",
  "D181_365",
  "OVER_365",
];

function makeMatrix() {
  const rows = [];
  let counter = 0;
  for (const cls of CLASSES) {
    for (const bucket of BUCKETS) {
      const idx = ++counter;
      // Make one row have an adjusted rate so the "adjusted" state renders.
      const adjusted = cls === "PRIVATE_SME" && bucket === "D91_180" ? "0.120000" : null;
      rows.push({
        id: `row-${idx}`,
        customerClass: cls,
        agingBucket: bucket,
        historicalLossRate: (0.01 * idx).toFixed(6),
        adjustedLossRate: adjusted,
        effectiveFrom: "2026-01-01T00:00:00.000Z",
      });
    }
  }
  return rows;
}

function makeComputeResult({ persisted = false } = {}) {
  const buckets = [];
  for (const cls of CLASSES) {
    for (const bucket of BUCKETS) {
      buckets.push({
        customerClass: cls,
        agingBucket: bucket,
        exposureKwd: "10000.000",
        lossRate: "0.020000",
        rateSource: "HISTORICAL",
        eclKwd: "200.000",
      });
    }
  }
  const computation = {
    asOf: "2026-04-24T00:00:00.000Z",
    buckets,
    totalExposureKwd: "420000.000",
    totalComputedEclKwd: "8400.000",
    currentAllowanceKwd: "6720.000",
    adjustmentKwd: "1680.000",
    direction: "INCREASE",
  };
  if (persisted) {
    return {
      computation,
      persistedRowId: "ecl-qr-2026-Q2",
      jeId: "je-ecl-adj-2026-Q2",
    };
  }
  return { computation };
}

// ── Tests ─────────────────────────────────────────────────────────

describe("EclScreen — HASEEB-409", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    getEclMatrixSpy.mockResolvedValue(makeMatrix());
    updateEclMatrixRowSpy.mockResolvedValue({});
    computeEclSpy.mockResolvedValue(makeComputeResult());
    await setLang("en");
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the provision matrix for CFO with 42 cells", async () => {
    render(<EclScreen role="CFO" />);

    await waitFor(() => {
      expect(screen.getByTestId("ecl-matrix-table")).toBeInTheDocument();
    });

    // All 42 cells should render (6 classes × 7 buckets).
    const cells = screen.getAllByTestId(/^ecl-cell-row-/);
    expect(cells).toHaveLength(42);

    // The PRIVATE_SME / D91_180 row has adjustedLossRate set → the cell
    // button's data-has-adjustment attribute is "true".
    const adjustedCell = cells.find(
      (c) => c.getAttribute("data-has-adjustment") === "true",
    );
    expect(adjustedCell).toBeDefined();

    // Matrix loader fired once.
    expect(getEclMatrixSpy).toHaveBeenCalledTimes(1);
  });

  it("Owner role: cell edit opens input, save triggers PATCH", async () => {
    render(<EclScreen role="Owner" />);

    await waitFor(() => {
      expect(screen.getByTestId("ecl-matrix-table")).toBeInTheDocument();
    });

    // Click the first cell — should open edit input (OWNER is allowed).
    const firstCell = screen.getByTestId("ecl-cell-row-1");
    expect(firstCell).not.toBeDisabled();
    fireEvent.click(firstCell);

    const editPane = await screen.findByTestId("ecl-cell-editing-row-1");
    const input = within(editPane).getByRole("textbox");
    expect(input).toBeInTheDocument();

    // Type a value and save.
    fireEvent.change(input, { target: { value: "2.5" } });
    fireEvent.click(screen.getByTestId("ecl-cell-save-row-1"));

    await waitFor(() => {
      expect(updateEclMatrixRowSpy).toHaveBeenCalledTimes(1);
    });
    // Second arg is { adjustedLossRate: "0.025000" } — the percent input
    // is converted to a rate string with 6 dp.
    expect(updateEclMatrixRowSpy).toHaveBeenCalledWith("row-1", {
      adjustedLossRate: "0.025000",
    });

    // Matrix is reloaded after save (initial load + one reload = 2 calls).
    await waitFor(() => {
      expect(getEclMatrixSpy).toHaveBeenCalledTimes(2);
    });
  });

  it("Non-OWNER role (CFO): cells are read-only — no edit input opens on click", async () => {
    render(<EclScreen role="CFO" />);

    await waitFor(() => {
      expect(screen.getByTestId("ecl-matrix-table")).toBeInTheDocument();
    });

    const firstCell = screen.getByTestId("ecl-cell-row-1");
    // Button is disabled for non-OWNER
    expect(firstCell).toBeDisabled();

    // Attempting a click should NOT open an edit pane.
    fireEvent.click(firstCell);
    expect(screen.queryByTestId("ecl-cell-editing-row-1")).not.toBeInTheDocument();
    expect(updateEclMatrixRowSpy).not.toHaveBeenCalled();

    // Read-only hint is shown
    expect(screen.getByTestId("ecl-read-only-note")).toBeInTheDocument();
  });

  it("Junior role: role-gate panel shown; no engine reads fire", async () => {
    render(<EclScreen role="Junior" />);

    expect(screen.getByTestId("ecl-role-gate")).toBeInTheDocument();
    expect(screen.queryByTestId("ecl-matrix-table")).not.toBeInTheDocument();
    expect(getEclMatrixSpy).not.toHaveBeenCalled();
    expect(computeEclSpy).not.toHaveBeenCalled();
  });

  it("Run Compute: calls computeEcl, renders summary + buckets table", async () => {
    render(<EclScreen role="CFO" />);

    await waitFor(() => {
      expect(screen.getByTestId("ecl-matrix-table")).toBeInTheDocument();
    });

    // Before running, the summary card is the empty placeholder.
    expect(screen.getByTestId("ecl-compute-empty")).toBeInTheDocument();
    expect(screen.queryByTestId("ecl-compute-summary")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("ecl-run-compute"));

    await waitFor(() => {
      expect(screen.getByTestId("ecl-compute-summary")).toBeInTheDocument();
    });

    expect(computeEclSpy).toHaveBeenCalledTimes(1);
    // Dry-run by default — no fiscalYear / fiscalQuarter in the payload.
    expect(computeEclSpy).toHaveBeenCalledWith({});

    // Per-bucket table renders.
    expect(screen.getByTestId("ecl-buckets-table")).toBeInTheDocument();

    // Summary shows the adjustment figure formatted as KWD with 3 dp.
    const summary = screen.getByTestId("ecl-compute-summary");
    expect(summary.textContent).toMatch(/1,680\.000/);
  });

  it("Create Adjustment Entry button appears after a non-zero dry-run and persists on click", async () => {
    render(<EclScreen role="CFO" />);

    await waitFor(() => {
      expect(screen.getByTestId("ecl-matrix-table")).toBeInTheDocument();
    });

    // First run dry → summary + CREATE ADJUSTMENT ENTRY button visible.
    fireEvent.click(screen.getByTestId("ecl-run-compute"));
    await waitFor(() => {
      expect(screen.getByTestId("ecl-compute-summary")).toBeInTheDocument();
    });
    expect(screen.getByTestId("ecl-create-adjustment")).toBeInTheDocument();

    // Prepare the persisted-mode return shape for the next compute call.
    computeEclSpy.mockResolvedValueOnce(makeComputeResult({ persisted: true }));

    fireEvent.click(screen.getByTestId("ecl-create-adjustment"));

    await waitFor(() => {
      expect(screen.getByTestId("ecl-persisted-banner")).toBeInTheDocument();
    });

    // Second compute call was persisted (fiscalYear + fiscalQuarter present).
    expect(computeEclSpy).toHaveBeenCalledTimes(2);
    const secondCallArg = computeEclSpy.mock.calls[1][0];
    expect(secondCallArg).toHaveProperty("fiscalYear");
    expect(secondCallArg).toHaveProperty("fiscalQuarter");
    expect(Number.isInteger(secondCallArg.fiscalYear)).toBe(true);
    expect([1, 2, 3, 4]).toContain(secondCallArg.fiscalQuarter);
  });

  it("renders correctly in Arabic locale", async () => {
    await setLang("ar");
    render(<EclScreen role="CFO" />);

    await waitFor(() => {
      expect(screen.getByTestId("ecl-matrix-table")).toBeInTheDocument();
    });

    // Title is localized — should match the AR title.
    expect(screen.getByText(arEcl.title)).toBeInTheDocument();
    // AR class label for GOVERNMENT should also appear (sanity check).
    expect(screen.getByText(arEcl.matrix.class.GOVERNMENT)).toBeInTheDocument();
  });

  it("i18n parity — EN and AR ecl namespaces have identical key structure", () => {
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
    expect(collectKeys(enEcl)).toEqual(collectKeys(arEcl));
  });
});
