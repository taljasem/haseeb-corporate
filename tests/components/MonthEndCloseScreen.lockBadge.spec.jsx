/**
 * MonthEndCloseScreen lock-strength badge — AUDIT-ACC-073 (2026-04-23).
 *
 * Covers the explicit period-lock badge that was added to the
 * CFO-hero and Owner-header rows. Before this, the SOFT (pending-
 * approval) vs HARD (approved) vs OPEN distinction was implicit in
 * button visibility; the audit memo flagged that accountants learned
 * the distinction by trial and auditors had no at-a-glance assurance.
 *
 * The three cases exercised here:
 *   1. OPEN (in_progress):           lock-strength-badge-open
 *   2. SOFT LOCK (pending_approval): lock-strength-badge-soft_lock
 *   3. HARD LOCK (approved):         lock-strength-badge-hard_lock
 *
 * Also exercises i18n parity for the three new locale keys.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  render,
  screen,
  cleanup,
  act,
  waitFor,
} from "@testing-library/react";
import React from "react";

import i18n from "../../src/i18n";
import enClose from "../../src/i18n/locales/en/close.json";
import arClose from "../../src/i18n/locales/ar/close.json";

// ── Engine boundary + context stubs ───────────────────────────────
// Per vitest hoisting rules, the mock factory is hoisted above any
// top-level `const` (including the stub map). We declare the spies
// via `vi.hoisted()` so they're available inside the factory.
const engineStubs = vi.hoisted(() => ({
  getMonthEndCloseTasks: vi.fn(),
  getCloseStatusDetail: vi.fn(),
  markCloseItemComplete: vi.fn(),
  runPreCloseValidations: vi.fn(),
  approveCloseAndSyncTask: vi.fn(),
  rejectCloseWithReason: vi.fn(),
  getCloseSummary: vi.fn(),
  exportClosePackage: vi.fn(),
  reopenPeriodClose: vi.fn(),
  recalculateCloseChecks: vi.fn(),
  overrideCloseCheck: vi.fn(),
  addCloseCheckNote: vi.fn(),
  getCloseCheckNotes: vi.fn(),
  attachCloseCheckFile: vi.fn(),
  getCloseCheckAttachments: vi.fn(),
}));

vi.mock("../../src/engine", () => ({
  __esModule: true,
  ...Object.fromEntries(
    Object.entries(engineStubs).map(([k, fn]) => [k, (...a) => fn(...a)])
  ),
}));

vi.mock("../../src/components/shared/TenantContext", () => ({
  __esModule: true,
  useTenant: () => ({ tenant: { id: "almanara", name: "Almanara" } }),
}));

vi.mock("../../src/contexts/AuthContext", () => ({
  __esModule: true,
  useAuth: () => ({ user: { id: "u-cfo", userId: "u-cfo", name: "CFO" } }),
}));

vi.mock("../../src/utils/taskboxBus", () => ({
  __esModule: true,
  emitTaskboxChange: vi.fn(),
}));

// Minimal structured-checklist stub so the screen mounts without
// depending on the full FN-227 data path.
vi.mock("../../src/components/month-end/ChecklistInstancePanel", () => ({
  __esModule: true,
  default: () => null,
}));

import MonthEndCloseScreen from "../../src/screens/shared/MonthEndCloseScreen";

async function setLang(lang) {
  await act(async () => {
    await i18n.changeLanguage(lang);
  });
}

function makeTasks() {
  const assignee = { id: "p-cfo", name: "CFO", avatar: null };
  return {
    period: "March 2026",
    status: "in-progress",
    aminahSummary: "All good.",
    tasks: [
      { id: "t1", name: "Recon bank", status: "complete", assignee },
      { id: "t2", name: "Accruals", status: "in-progress", assignee },
    ],
  };
}

function makeStatus(status) {
  return {
    period: "March 2026",
    status,
    day: 5,
    totalDays: 8,
    completedItems: 2,
    totalItems: 4,
    lastUpdated: new Date().toISOString(),
    blockers: [],
  };
}

describe("MonthEndCloseScreen lock-strength badge — AUDIT-ACC-073", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await setLang("en");
    engineStubs.getMonthEndCloseTasks.mockResolvedValue(makeTasks());
  });

  afterEach(() => {
    cleanup();
  });

  it("renders OPEN badge when close status is in_progress", async () => {
    engineStubs.getCloseStatusDetail.mockResolvedValue(makeStatus("in_progress"));
    render(<MonthEndCloseScreen role="CFO" />);
    await waitFor(() => {
      expect(screen.getByTestId("lock-strength-badge-open")).toBeInTheDocument();
    });
    const badge = screen.getByTestId("lock-strength-badge-open");
    expect(badge.textContent).toMatch(/OPEN/);
  });

  it("renders SOFT LOCK badge when close status is pending_approval", async () => {
    engineStubs.getCloseStatusDetail.mockResolvedValue(
      makeStatus("pending_approval")
    );
    render(<MonthEndCloseScreen role="CFO" />);
    await waitFor(() => {
      expect(
        screen.getByTestId("lock-strength-badge-soft_lock")
      ).toBeInTheDocument();
    });
    const badge = screen.getByTestId("lock-strength-badge-soft_lock");
    expect(badge.textContent).toMatch(/SOFT LOCK/);
    // Tooltip carries the longer description for first-time auditors.
    expect(badge.getAttribute("title")).toMatch(/awaiting Owner approval/i);
  });

  it("renders HARD LOCK badge when close status is approved", async () => {
    engineStubs.getCloseStatusDetail.mockResolvedValue(makeStatus("approved"));
    render(<MonthEndCloseScreen role="CFO" />);
    await waitFor(() => {
      expect(
        screen.getByTestId("lock-strength-badge-hard_lock")
      ).toBeInTheDocument();
    });
    const badge = screen.getByTestId("lock-strength-badge-hard_lock");
    expect(badge.textContent).toMatch(/HARD LOCK/);
    expect(badge.getAttribute("title")).toMatch(/permanently locked/i);
  });

  it("renders OPEN badge on Owner header as well (not CFO-only)", async () => {
    engineStubs.getCloseStatusDetail.mockResolvedValue(makeStatus("in_progress"));
    render(<MonthEndCloseScreen role="Owner" />);
    await waitFor(() => {
      expect(screen.getByTestId("lock-strength-badge-open")).toBeInTheDocument();
    });
  });

  it("i18n parity — EN and AR close.lock_strength have identical key set", () => {
    const enKeys = Object.keys(enClose.lock_strength).sort();
    const arKeys = Object.keys(arClose.lock_strength).sort();
    expect(enKeys).toEqual(arKeys);
    // AR values must be non-empty + not identical to the English fallback
    // (catches silent AR translation drift).
    for (const k of enKeys) {
      expect(arClose.lock_strength[k]).toBeTruthy();
      expect(arClose.lock_strength[k]).not.toBe(enClose.lock_strength[k]);
    }
  });
});
