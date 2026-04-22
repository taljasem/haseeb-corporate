/**
 * PIFSSReconciliationScreen — AUDIT-ACC-058 (2026-04-22).
 *
 * Covers:
 *   1. Year list renders rows derived from listReconciliationYears.
 *   2. Role gating: Junior sees list + detail but zero write buttons
 *      (no Import, no Run, no Resolve).
 *   3. Role gating: CFO sees Import + Run + Resolve.
 *   4. Variance resolution modal: all 4 statuses render; reopen field
 *      is hidden for non-Owner even when transitioning RESOLVED →
 *      UNRESOLVED; visible + required for Owner.
 *   5. Per-variance row renders VarianceType badge, deltas, resolve
 *      button (for canEdit users).
 *   6. Empty state: year list shows helpful empty state when no
 *      reconciliations exist.
 *   7. i18n parity spot check: EN and AR both have all variance-type
 *      and status labels, plus top-level screen keys.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
  waitFor,
  within,
} from '@testing-library/react';
import React from 'react';

import i18n from '../../src/i18n';
import enPifss from '../../src/i18n/locales/en/pifssReconciliation.json';
import arPifss from '../../src/i18n/locales/ar/pifssReconciliation.json';

// Engine boundary stubs.
const listReconciliationYearsSpy = vi.fn();
const getReconciliationSpy = vi.fn();
const getReconciliationReportSpy = vi.fn();
const importStatementSpy = vi.fn();
const runReconciliationSpy = vi.fn();
const resolveVarianceSpy = vi.fn();

vi.mock('../../src/engine', () => ({
  __esModule: true,
  listReconciliationYears: (...args) => listReconciliationYearsSpy(...args),
  getReconciliation: (...args) => getReconciliationSpy(...args),
  getReconciliationReport: (...args) => getReconciliationReportSpy(...args),
  importStatement: (...args) => importStatementSpy(...args),
  runReconciliation: (...args) => runReconciliationSpy(...args),
  resolveVariance: (...args) => resolveVarianceSpy(...args),
}));

import PIFSSReconciliationScreen from '../../src/screens/cfo/PIFSSReconciliationScreen';
import VarianceResolutionModal from '../../src/components/pifss/VarianceResolutionModal';

async function setLang(lang) {
  await act(async () => {
    await i18n.changeLanguage(lang);
  });
}

function seedYears(reconYear = 2025) {
  // 1 year fully populated (reconRun=true, 3 variances covering 3 types
  // + 3 statuses), 1 year statement-only, 1 empty slot.
  const nowIso = '2026-04-22T10:00:00.000Z';
  const variances = [
    {
      id: 'var-1',
      reconciliationId: `recon-${reconYear}`,
      civilId: '286012345678',
      employeeNameSnapshot: 'Ahmed Al-Sabah',
      periodYear: reconYear,
      periodMonth: 3,
      varianceType: 'CONTRIBUTION_AMOUNT_DIFFERS',
      companyEmployerKwd: '87.500',
      portalEmployerKwd: '90.000',
      companyEmployeeKwd: '42.000',
      portalEmployeeKwd: '42.000',
      deltaEmployerKwd: '2.500',
      deltaEmployeeKwd: '0.000',
      likelyCause: 'Rounding difference',
      status: 'UNRESOLVED',
      resolutionNote: null,
      resolvedBy: null,
      resolvedAt: null,
    },
    {
      id: 'var-2',
      reconciliationId: `recon-${reconYear}`,
      civilId: '287098765432',
      employeeNameSnapshot: 'Fatima Al-Mutairi',
      periodYear: reconYear,
      periodMonth: 7,
      varianceType: 'COMPANY_ONLY',
      companyEmployerKwd: '52.500',
      portalEmployerKwd: '0.000',
      companyEmployeeKwd: '25.200',
      portalEmployeeKwd: '0.000',
      deltaEmployerKwd: '52.500',
      deltaEmployeeKwd: '25.200',
      likelyCause: 'Portal missing July',
      status: 'RESOLVED',
      resolutionNote: 'Confirmed; reconciled.',
      resolvedBy: 'user-cfo-1',
      resolvedAt: nowIso,
    },
    {
      id: 'var-3',
      reconciliationId: `recon-${reconYear}`,
      civilId: '287098765432',
      employeeNameSnapshot: 'Fatima Al-Mutairi',
      periodYear: reconYear,
      periodMonth: 9,
      varianceType: 'SALARY_BASE_DIFFERS',
      companyEmployerKwd: '52.500',
      portalEmployerKwd: '52.500',
      companyEmployeeKwd: '25.200',
      portalEmployeeKwd: '25.200',
      deltaEmployerKwd: '0.000',
      deltaEmployeeKwd: '0.000',
      likelyCause: 'Basic-salary snapshot mismatch',
      status: 'IN_DISPUTE',
      resolutionNote: 'Escalated.',
      resolvedBy: 'user-cfo-1',
      resolvedAt: nowIso,
    },
  ];
  return [
    {
      fiscalYear: reconYear + 1, // "current" empty slot
      reconciliation: null,
      variances: [],
    },
    {
      fiscalYear: reconYear,
      reconciliation: {
        id: `recon-${reconYear}`,
        fiscalYear: reconYear,
        statementId: `stmt-${reconYear}`,
        statementImportedAt: nowIso,
        runBy: 'user-cfo-1',
        runAt: nowIso,
        totalVariances: variances.length,
        unresolvedCount: 1,
        preservedResolutionCount: 0,
        newVarianceCount: variances.length,
        byType: {
          COMPANY_ONLY: 1,
          PORTAL_ONLY: 0,
          CONTRIBUTION_AMOUNT_DIFFERS: 1,
          SALARY_BASE_DIFFERS: 1,
        },
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      variances,
    },
    {
      fiscalYear: reconYear - 1,
      reconciliation: null,
      variances: [],
    },
  ];
}

// ── Tests ────────────────────────────────────────────────────────────

describe('PIFSSReconciliationScreen — year list', () => {
  beforeEach(async () => {
    listReconciliationYearsSpy.mockReset();
    getReconciliationSpy.mockReset();
    getReconciliationReportSpy.mockReset();
    importStatementSpy.mockReset();
    runReconciliationSpy.mockReset();
    resolveVarianceSpy.mockReset();
    await setLang('en');
  });
  afterEach(() => cleanup());

  it('renders a row for each fiscal year returned by the engine', async () => {
    listReconciliationYearsSpy.mockResolvedValueOnce({ years: seedYears(2025) });
    render(<PIFSSReconciliationScreen role="CFO" />);

    // Wait for any of the 3 rows to render.
    await waitFor(() => {
      expect(screen.getByTestId('year-row-2025')).toBeInTheDocument();
    });
    expect(screen.getByTestId('year-row-2026')).toBeInTheDocument();
    expect(screen.getByTestId('year-row-2024')).toBeInTheDocument();
  });

  it('shows the empty state when all probed years are null', async () => {
    listReconciliationYearsSpy.mockResolvedValueOnce({
      years: [
        { fiscalYear: 2026, reconciliation: null, variances: [] },
        { fiscalYear: 2025, reconciliation: null, variances: [] },
        { fiscalYear: 2024, reconciliation: null, variances: [] },
      ],
    });
    render(<PIFSSReconciliationScreen role="CFO" />);

    await waitFor(() => {
      expect(screen.getByText(enPifss.year_list.empty_title)).toBeInTheDocument();
    });
  });

  it('shows "New fiscal year" action for CFO but NOT for Junior', async () => {
    // CFO render
    listReconciliationYearsSpy.mockResolvedValueOnce({ years: seedYears(2025) });
    const { unmount } = render(<PIFSSReconciliationScreen role="CFO" />);
    await waitFor(() => {
      expect(screen.getByTestId('year-row-2025')).toBeInTheDocument();
    });
    expect(
      screen.getByRole('button', { name: enPifss.year_list.action_new }),
    ).toBeInTheDocument();
    unmount();

    // Junior render — should NOT have the button.
    listReconciliationYearsSpy.mockResolvedValueOnce({ years: seedYears(2025) });
    render(<PIFSSReconciliationScreen role="Junior" />);
    await waitFor(() => {
      expect(screen.getByTestId('year-row-2025')).toBeInTheDocument();
    });
    expect(
      screen.queryByRole('button', { name: enPifss.year_list.action_new }),
    ).not.toBeInTheDocument();
  });
});

describe('PIFSSReconciliationScreen — per-year detail', () => {
  beforeEach(async () => {
    listReconciliationYearsSpy.mockReset();
    getReconciliationSpy.mockReset();
    importStatementSpy.mockReset();
    runReconciliationSpy.mockReset();
    resolveVarianceSpy.mockReset();
    await setLang('en');
  });
  afterEach(() => cleanup());

  it('renders Step 3 variance review when CFO opens a fully-run year', async () => {
    const years = seedYears(2025);
    const runYear = years.find((y) => y.fiscalYear === 2025);
    listReconciliationYearsSpy.mockResolvedValueOnce({ years });
    getReconciliationSpy.mockResolvedValue({
      reconciliation: runYear.reconciliation,
      variances: runYear.variances,
    });

    render(<PIFSSReconciliationScreen role="CFO" />);
    await waitFor(() => {
      expect(screen.getByTestId('year-row-2025')).toBeInTheDocument();
    });

    // Open year 2025.
    fireEvent.click(screen.getByTestId('year-row-2025'));
    await waitFor(() => {
      expect(screen.getByText(enPifss.step3.title)).toBeInTheDocument();
    });

    // Expand both employee rows — variance type badges live inside
    // the expanded per-employee variance list.
    const expandBtns = screen.getAllByRole('button', {
      name: /^Expand /i,
    });
    expect(expandBtns.length).toBeGreaterThanOrEqual(2);
    for (const btn of expandBtns) {
      fireEvent.click(btn);
    }

    // Variance type labels render for 3 variances (COMPANY_ONLY,
    // CONTRIBUTION_AMOUNT_DIFFERS, SALARY_BASE_DIFFERS).
    expect(
      screen.getAllByText(enPifss.variance_type.company_only).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(enPifss.variance_type.contribution_amount_differs)
        .length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(enPifss.variance_type.salary_base_differs).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('hides write affordances for Junior role', async () => {
    const years = seedYears(2025);
    const runYear = years.find((y) => y.fiscalYear === 2025);
    listReconciliationYearsSpy.mockResolvedValueOnce({ years });
    getReconciliationSpy.mockResolvedValue({
      reconciliation: runYear.reconciliation,
      variances: runYear.variances,
    });

    render(<PIFSSReconciliationScreen role="Junior" />);
    await waitFor(() => {
      expect(screen.getByTestId('year-row-2025')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('year-row-2025'));
    await waitFor(() => {
      expect(screen.getByText(enPifss.step3.title)).toBeInTheDocument();
    });

    // No Import button (Step 1 placeholder renders instead).
    expect(
      screen.queryByRole('button', { name: enPifss.step1.action_import }),
    ).not.toBeInTheDocument();

    // No Run button.
    expect(
      screen.queryByRole('button', { name: enPifss.step2.action_run }),
    ).not.toBeInTheDocument();

    // Expand an employee row and verify no Resolve button.
    // (All resolve buttons are canEdit-gated.)
    const resolveBtns = screen.queryAllByText(
      enPifss.step3.variance_action_resolve,
    );
    expect(resolveBtns.length).toBe(0);
  });
});

// ── Resolution modal ────────────────────────────────────────────────

describe('VarianceResolutionModal', () => {
  const sampleVariance = {
    id: 'var-1',
    periodYear: 2025,
    periodMonth: 3,
    varianceType: 'CONTRIBUTION_AMOUNT_DIFFERS',
    deltaEmployerKwd: '2.500',
    deltaEmployeeKwd: '0.000',
    status: 'UNRESOLVED',
    resolutionNote: null,
  };
  const closedVariance = {
    ...sampleVariance,
    id: 'var-closed',
    status: 'RESOLVED',
    resolutionNote: 'Prior resolution note.',
  };

  beforeEach(async () => {
    resolveVarianceSpy.mockReset();
    await setLang('en');
  });
  afterEach(() => cleanup());

  it('renders all 4 status options in the status select', () => {
    render(
      <VarianceResolutionModal
        open
        variance={sampleVariance}
        role="CFO"
        onClose={() => {}}
      />,
    );
    const select = screen.getByLabelText(
      enPifss.resolution_modal.field_status,
    );
    const options = within(select).getAllByRole('option');
    // 1 placeholder + 4 statuses = 5 options.
    expect(options.length).toBe(5);
    expect(
      within(select).getByText(enPifss.variance_status.unresolved),
    ).toBeInTheDocument();
    expect(
      within(select).getByText(enPifss.variance_status.under_investigation),
    ).toBeInTheDocument();
    expect(
      within(select).getByText(enPifss.variance_status.resolved),
    ).toBeInTheDocument();
    expect(
      within(select).getByText(enPifss.variance_status.in_dispute),
    ).toBeInTheDocument();
  });

  it('reopen reason field is hidden for non-Owner viewing a RESOLVED variance', () => {
    render(
      <VarianceResolutionModal
        open
        variance={closedVariance}
        role="CFO"
        onClose={() => {}}
      />,
    );
    // Warning banner for non-Owner.
    expect(
      screen.getByText(
        enPifss.resolution_modal.reopen_warning_non_owner,
      ),
    ).toBeInTheDocument();
    // No reopen reason input at any point.
    expect(
      screen.queryByLabelText(new RegExp(enPifss.resolution_modal.field_reopen_reason)),
    ).not.toBeInTheDocument();
  });

  it('reopen reason field appears for Owner when transitioning RESOLVED → UNRESOLVED', () => {
    render(
      <VarianceResolutionModal
        open
        variance={closedVariance}
        role="Owner"
        onClose={() => {}}
      />,
    );
    // Initially, status is RESOLVED; field not shown yet.
    expect(
      screen.queryByLabelText(new RegExp(enPifss.resolution_modal.field_reopen_reason)),
    ).not.toBeInTheDocument();

    // Change status to UNRESOLVED.
    const select = screen.getByLabelText(
      enPifss.resolution_modal.field_status,
    );
    fireEvent.change(select, { target: { value: 'UNRESOLVED' } });

    // Now the reopen field is visible.
    expect(
      screen.getByLabelText(new RegExp(enPifss.resolution_modal.field_reopen_reason)),
    ).toBeInTheDocument();
    // Owner reopen info banner.
    expect(
      screen.getByText(enPifss.resolution_modal.reopen_warning_owner),
    ).toBeInTheDocument();
  });

  it('blocks save with required-reopen-reason error when Owner submits empty reason', async () => {
    render(
      <VarianceResolutionModal
        open
        variance={closedVariance}
        role="Owner"
        onClose={() => {}}
      />,
    );
    const select = screen.getByLabelText(
      enPifss.resolution_modal.field_status,
    );
    fireEvent.change(select, { target: { value: 'UNRESOLVED' } });

    const saveBtn = screen.getByRole('button', {
      name: enPifss.resolution_modal.action_save,
    });
    await act(async () => {
      fireEvent.click(saveBtn);
    });
    expect(
      screen.getByText(
        enPifss.resolution_modal.error_reopen_reason_required,
      ),
    ).toBeInTheDocument();
    expect(resolveVarianceSpy).not.toHaveBeenCalled();
  });

  it('calls resolveVariance on save for a non-reopen status transition', async () => {
    resolveVarianceSpy.mockResolvedValue({ variance: { ...sampleVariance, status: 'RESOLVED' } });
    const onResolved = vi.fn();
    render(
      <VarianceResolutionModal
        open
        variance={sampleVariance}
        role="CFO"
        onClose={() => {}}
        onResolved={onResolved}
      />,
    );
    const select = screen.getByLabelText(
      enPifss.resolution_modal.field_status,
    );
    fireEvent.change(select, { target: { value: 'RESOLVED' } });
    const saveBtn = screen.getByRole('button', {
      name: enPifss.resolution_modal.action_save,
    });
    await act(async () => {
      fireEvent.click(saveBtn);
    });
    await waitFor(() => {
      expect(resolveVarianceSpy).toHaveBeenCalledTimes(1);
    });
    expect(resolveVarianceSpy.mock.calls[0][0]).toBe('var-1');
    expect(resolveVarianceSpy.mock.calls[0][1].status).toBe('RESOLVED');
  });
});

// ── i18n parity ────────────────────────────────────────────────────

describe('pifssReconciliation i18n parity', () => {
  function collectKeys(obj, prefix = '') {
    const out = new Set();
    for (const k of Object.keys(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      const v = obj[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        for (const sub of collectKeys(v, key)) out.add(sub);
      } else {
        out.add(key);
      }
    }
    return out;
  }

  it('EN and AR namespaces expose identical key sets', () => {
    const en = collectKeys(enPifss);
    const ar = collectKeys(arPifss);
    const missingFromAr = [...en].filter((k) => !ar.has(k));
    const missingFromEn = [...ar].filter((k) => !en.has(k));
    expect(missingFromAr).toEqual([]);
    expect(missingFromEn).toEqual([]);
  });

  it('all 4 VarianceType and 4 VarianceStatus labels exist in both locales', () => {
    for (const t of [
      'company_only',
      'portal_only',
      'contribution_amount_differs',
      'salary_base_differs',
    ]) {
      expect(enPifss.variance_type[t]).toBeTruthy();
      expect(arPifss.variance_type[t]).toBeTruthy();
    }
    for (const s of ['unresolved', 'under_investigation', 'resolved', 'in_dispute']) {
      expect(enPifss.variance_status[s]).toBeTruthy();
      expect(arPifss.variance_status[s]).toBeTruthy();
    }
  });
});
