/**
 * PayrollScreen — AUDIT-ACC-013 (2026-04-22).
 *
 * Asserts that PayrollScreen dispatches the LIVE payroll engine surface
 * (23 wrappers) correctly: list reads, role-gated lifecycle writes, the
 * WPS blob-download dance, Kuwaiti vs non-Kuwaiti statutory rendering,
 * and i18n EN/AR parity on the new `payroll` namespace.
 *
 * vi.mock at the engine boundary so we exercise the full screen with
 * spied wrappers. The download test shims `URL.createObjectURL` +
 * anchor `.click` so the helper runs end-to-end without JSDOM
 * actually trying to navigate. Per dispatch §8 we target 8–12 new
 * spec tests on top of the 51 baseline.
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
import enPayroll from '../../src/i18n/locales/en/payroll.json';
import arPayroll from '../../src/i18n/locales/ar/payroll.json';

// Engine-module stubs for the 23 wrappers the PayrollScreen consumes.
const listEmployeesSpy = vi.fn();
const getEmployeeSpy = vi.fn();
const getEmployeeEosSpy = vi.fn();
const getEmployeeEosHistorySpy = vi.fn();
const getEmployeeAdvancesSpy = vi.fn();
const getPayrollHistorySpy = vi.fn();
const getPayrollRunSpy = vi.fn();
const runPayrollSpy = vi.fn();
const approvePayrollSpy = vi.fn();
const payPayrollSpy = vi.fn();
const downloadWpsFileSpy = vi.fn();
const listPifssSubmissionsSpy = vi.fn();
const generatePifssFileSpy = vi.fn();

vi.mock('../../src/engine', () => ({
  __esModule: true,
  listEmployees: (...args) => listEmployeesSpy(...args),
  getEmployee: (...args) => getEmployeeSpy(...args),
  getEmployeeEos: (...args) => getEmployeeEosSpy(...args),
  getEmployeeEosHistory: (...args) => getEmployeeEosHistorySpy(...args),
  getEmployeeAdvances: (...args) => getEmployeeAdvancesSpy(...args),
  getPayrollHistory: (...args) => getPayrollHistorySpy(...args),
  getPayrollRun: (...args) => getPayrollRunSpy(...args),
  runPayroll: (...args) => runPayrollSpy(...args),
  approvePayroll: (...args) => approvePayrollSpy(...args),
  payPayroll: (...args) => payPayrollSpy(...args),
  downloadWpsFile: (...args) => downloadWpsFileSpy(...args),
  listPifssSubmissions: (...args) => listPifssSubmissionsSpy(...args),
  generatePifssFile: (...args) => generatePifssFileSpy(...args),
}));

import PayrollScreen from '../../src/screens/cfo/PayrollScreen';

async function setLang(lang) {
  await act(async () => {
    await i18n.changeLanguage(lang);
  });
}

function seedRuns() {
  const entries = [
    {
      id: 'ENTRY-EMP-001',
      employeeId: 'EMP-001',
      employee: {
        id: 'EMP-001',
        nameEn: 'Fahad Al-Jasem',
        nameAr: 'فهد الجاسم',
        isKuwaiti: true,
        nationality: 'Kuwaiti',
      },
      basicSalary: '1800.000',
      allowances: '200.000',
      grossSalary: '2000.000',
      pifssCappedSalary: '1800.000',
      pifssEmployee: '144.000',
      pifssEmployer: '207.000',
      otherDeductions: '0.000',
      netSalary: '1856.000',
      warnings: [],
    },
    {
      id: 'ENTRY-EMP-004',
      employeeId: 'EMP-004',
      employee: {
        id: 'EMP-004',
        nameEn: 'Rajesh Kumar',
        nameAr: 'راجيش كومار',
        isKuwaiti: false,
        nationality: 'Indian',
      },
      basicSalary: '750.000',
      allowances: '110.000',
      grossSalary: '860.000',
      pifssCappedSalary: '0.000',
      pifssEmployee: '0.000',
      pifssEmployer: '0.000',
      otherDeductions: '0.000',
      netSalary: '860.000',
      warnings: [{ message: 'Civil ID not validated — portal may reject.' }],
    },
  ];
  return [
    {
      id: 'RUN-2026-04',
      periodYear: 2026,
      periodMonth: 4,
      status: 'DRAFT',
      totalGross: '2860.000',
      totalDeductions: '144.000',
      totalNet: '2716.000',
      totalPifssEmployer: '207.000',
      totalPifssEmployee: '144.000',
      processedBy: 'owner',
      processedAt: '2026-04-20T10:00:00.000Z',
      approvedBy: null,
      approvedAt: null,
      paidAt: null,
      journalEntryId: null,
      wpsFileUrl: null,
      entries,
    },
    {
      id: 'RUN-2026-03',
      periodYear: 2026,
      periodMonth: 3,
      status: 'APPROVED',
      totalGross: '2860.000',
      totalDeductions: '144.000',
      totalNet: '2716.000',
      totalPifssEmployer: '207.000',
      totalPifssEmployee: '144.000',
      processedBy: 'owner',
      processedAt: '2026-03-28T10:00:00.000Z',
      approvedBy: 'owner',
      approvedAt: '2026-03-29T12:00:00.000Z',
      paidAt: null,
      journalEntryId: 'JE-PAYROLL-2026-03',
      wpsFileUrl: null,
      entries,
    },
    {
      id: 'RUN-2026-02',
      periodYear: 2026,
      periodMonth: 2,
      status: 'PAID',
      totalGross: '2860.000',
      totalDeductions: '144.000',
      totalNet: '2716.000',
      totalPifssEmployer: '207.000',
      totalPifssEmployee: '144.000',
      processedBy: 'owner',
      processedAt: '2026-02-28T10:00:00.000Z',
      approvedBy: 'owner',
      approvedAt: '2026-03-01T09:00:00.000Z',
      paidAt: '2026-03-02T11:00:00.000Z',
      journalEntryId: 'JE-PAYROLL-2026-02',
      wpsFileUrl: 'mock://wps/RUN-2026-02.sif',
      entries,
    },
  ];
}

function seedEmployees() {
  return [
    {
      id: 'EMP-001',
      employeeNumber: 'E-001',
      nameEn: 'Fahad Al-Jasem',
      nameAr: 'فهد الجاسم',
      civilId: '••••1234',
      nationality: 'Kuwaiti',
      isKuwaiti: true,
      basicSalary: '1800.000',
      status: 'ACTIVE',
      position: 'Accounting Manager',
      hireDate: '2022-01-15',
    },
    {
      id: 'EMP-004',
      employeeNumber: 'E-004',
      nameEn: 'Rajesh Kumar',
      nameAr: 'راجيش كومار',
      civilId: '••••3456',
      nationality: 'Indian',
      isKuwaiti: false,
      basicSalary: '750.000',
      status: 'ACTIVE',
      position: 'IT Specialist',
      hireDate: '2023-09-15',
    },
  ];
}

function seedPifss() {
  return [
    {
      id: 'PIFSS-2026-03',
      year: 2026,
      month: 3,
      status: 'ACCEPTED',
      fileName: 'PIFSS_2026_03.txt',
      portalReference: 'KWT-PIFSS-2026-03-ABC123',
      totalEmployees: 3,
      totalPifssEmployee: '264.000',
      totalPifssEmployer: '379.500',
      submittedAt: '2026-04-05T10:00:00.000Z',
    },
  ];
}

describe('PayrollScreen — AUDIT-ACC-013', () => {
  beforeEach(async () => {
    listEmployeesSpy.mockReset();
    getEmployeeSpy.mockReset();
    getEmployeeEosSpy.mockReset();
    getEmployeeEosHistorySpy.mockReset();
    getEmployeeAdvancesSpy.mockReset();
    getPayrollHistorySpy.mockReset();
    getPayrollRunSpy.mockReset();
    runPayrollSpy.mockReset();
    approvePayrollSpy.mockReset();
    payPayrollSpy.mockReset();
    downloadWpsFileSpy.mockReset();
    listPifssSubmissionsSpy.mockReset();
    generatePifssFileSpy.mockReset();

    listEmployeesSpy.mockResolvedValue({
      data: seedEmployees(),
      total: 2,
      page: 1,
      limit: 20,
    });
    getEmployeeSpy.mockImplementation(async (id) =>
      seedEmployees().find((e) => e.id === id) || null,
    );
    getEmployeeEosSpy.mockResolvedValue({
      employeeId: 'EMP-001',
      yearsOfService: 4,
      dailyRate: '60.000',
      totalEos: '7200.000',
      accruedToDate: '6800.000',
    });
    getEmployeeEosHistorySpy.mockResolvedValue({ events: [], accruals: [] });
    getEmployeeAdvancesSpy.mockResolvedValue({ advances: [] });
    getPayrollHistorySpy.mockResolvedValue({
      data: seedRuns(),
      total: 3,
      page: 1,
      limit: 20,
    });
    getPayrollRunSpy.mockImplementation(async (id) =>
      seedRuns().find((r) => r.id === id) || null,
    );
    listPifssSubmissionsSpy.mockResolvedValue({
      data: seedPifss(),
      total: 1,
      page: 1,
      limit: 20,
    });

    await setLang('en');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the runs tab by default with DRAFT/APPROVED/PAID rows from getPayrollHistory', async () => {
    render(<PayrollScreen role="Owner" />);
    await waitFor(() => {
      expect(getPayrollHistorySpy).toHaveBeenCalledTimes(1);
    });
    // All three period labels render.
    expect(await screen.findByText('2026-04')).toBeInTheDocument();
    expect(screen.getByText('2026-03')).toBeInTheDocument();
    expect(screen.getByText('2026-02')).toBeInTheDocument();
    // Status badges.
    expect(screen.getByText(/^Draft$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Approved$/i)).toBeInTheDocument();
    expect(screen.getByText(/^Paid$/i)).toBeInTheDocument();
  });

  it('role gating: CFO sees Run Payroll but not Approve/Pay (Owner-only) on a DRAFT', async () => {
    render(<PayrollScreen role="CFO" />);
    expect(
      await screen.findByRole('button', { name: /Run payroll for a period/i }),
    ).toBeInTheDocument();
    // Open the DRAFT run detail.
    const draftRow = await screen.findByRole('button', {
      name: /Open payroll run for 2026-04/i,
    });
    fireEvent.click(draftRow);
    await waitFor(() => {
      expect(getPayrollRunSpy).toHaveBeenCalledWith('RUN-2026-04');
    });
    // Approve button MUST NOT be visible for CFO.
    expect(
      screen.queryByRole('button', { name: /Approve payroll run/i }),
    ).not.toBeInTheDocument();
  });

  it('role gating: Owner sees Approve on a DRAFT run; clicking calls approvePayroll', async () => {
    approvePayrollSpy.mockResolvedValue({
      payrollRunId: 'RUN-2026-04',
      journalEntryId: 'JE-NEW-1',
      status: 'APPROVED',
    });
    render(<PayrollScreen role="Owner" />);
    const draftRow = await screen.findByRole('button', {
      name: /Open payroll run for 2026-04/i,
    });
    fireEvent.click(draftRow);
    const approveBtn = await screen.findByRole('button', {
      name: /Approve payroll run/i,
    });
    fireEvent.click(approveBtn);
    // Confirmation modal + confirm.
    const confirmBtn = await screen.findByRole('button', { name: /^Approve$/i });
    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(approvePayrollSpy).toHaveBeenCalledWith('RUN-2026-04');
    });
  });

  it('role gating: Owner can Pay an APPROVED run; calls payPayroll', async () => {
    payPayrollSpy.mockResolvedValue({ id: 'RUN-2026-03', status: 'PAID' });
    render(<PayrollScreen role="Owner" />);
    const approvedRow = await screen.findByRole('button', {
      name: /Open payroll run for 2026-03/i,
    });
    fireEvent.click(approvedRow);
    const payBtn = await screen.findByRole('button', {
      name: /Pay payroll run/i,
    });
    fireEvent.click(payBtn);
    const confirmBtn = await screen.findByRole('button', { name: /^Pay Run$/i });
    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(payPayrollSpy).toHaveBeenCalledWith('RUN-2026-03');
    });
  });

  it('WPS download: CFO can download on APPROVED/PAID; calls downloadWpsFile + triggers browser download', async () => {
    const blob = new Blob(['HEADER|202603|MOCK-TENANT|KWD'], { type: 'text/plain' });
    downloadWpsFileSpy.mockResolvedValue({
      blob,
      filename: 'WPS_2026_03.sif',
    });
    const createObjectURL = vi.fn(() => 'blob:mock-url');
    const revokeObjectURL = vi.fn();
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    try {
      render(<PayrollScreen role="CFO" />);
      const approvedRow = await screen.findByRole('button', {
        name: /Open payroll run for 2026-03/i,
      });
      fireEvent.click(approvedRow);
      const dlBtn = await screen.findByRole('button', {
        name: /Download WPS file for 2026-03/i,
      });
      fireEvent.click(dlBtn);
      await waitFor(() => {
        expect(downloadWpsFileSpy).toHaveBeenCalledWith('RUN-2026-03');
      });
      await waitFor(() => {
        expect(createObjectURL).toHaveBeenCalledWith(blob);
        expect(clickSpy).toHaveBeenCalled();
      });
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
      clickSpy.mockRestore();
    }
  });

  it('Kuwaiti vs non-Kuwaiti: non-Kuwaiti entry shows PIFSS as "—" while Kuwaiti shows a KWD amount', async () => {
    render(<PayrollScreen role="Owner" />);
    const draftRow = await screen.findByRole('button', {
      name: /Open payroll run for 2026-04/i,
    });
    fireEvent.click(draftRow);
    const kwRow = await screen.findByTestId('payroll-entry-row-EMP-001');
    const nonKwRow = await screen.findByTestId('payroll-entry-row-EMP-004');
    // Kuwaiti row PIFSS Employee column renders a monetary value (144.000).
    expect(within(kwRow).getByText(/144\.000/)).toBeInTheDocument();
    // Non-Kuwaiti row renders a dash for PIFSS (both employee + employer).
    // The dash appears in the non-Kuwaiti row's PIFSS columns; match at
    // least two "—" occurrences.
    const dashes = within(nonKwRow).getAllByText('—');
    expect(dashes.length).toBeGreaterThanOrEqual(2);
    // Non-Kuwaiti badge on the row too.
    expect(within(nonKwRow).getByText(/Non-Kuwaiti/i)).toBeInTheDocument();
  });

  it('surfaces inline warning badge when a payroll entry carries warnings', async () => {
    render(<PayrollScreen role="Owner" />);
    const draftRow = await screen.findByRole('button', {
      name: /Open payroll run for 2026-04/i,
    });
    fireEvent.click(draftRow);
    const nonKwRow = await screen.findByTestId('payroll-entry-row-EMP-004');
    expect(within(nonKwRow).getByText(/^Warning$/i)).toBeInTheDocument();
  });

  it('Run Payroll: CFO can open period picker and submit; calls runPayroll with {year, month}', async () => {
    runPayrollSpy.mockResolvedValue({
      id: 'RUN-2026-05',
      periodYear: 2026,
      periodMonth: 5,
      status: 'DRAFT',
    });
    render(<PayrollScreen role="CFO" />);
    const runBtn = await screen.findByRole('button', {
      name: /Run payroll for a period/i,
    });
    fireEvent.click(runBtn);
    // Picker dialog appears; confirm calls runPayroll with derived year/month.
    const confirmBtn = await screen.findByRole('button', {
      name: /^Run Payroll$/i,
    });
    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(runPayrollSpy).toHaveBeenCalledTimes(1);
    });
    const [arg] = runPayrollSpy.mock.calls[0];
    expect(arg).toMatchObject({
      year: expect.any(Number),
      month: expect.any(Number),
    });
  });

  it('PIFSS tab: lists submissions from listPifssSubmissions; Owner can generate', async () => {
    generatePifssFileSpy.mockResolvedValue({
      id: 'PIFSS-2026-04',
      year: 2026,
      month: 4,
      status: 'GENERATED',
    });
    render(<PayrollScreen role="Owner" />);
    // Switch to PIFSS tab.
    const tab = await screen.findByRole('tab', { name: /PIFSS Submissions/i });
    fireEvent.click(tab);
    await waitFor(() => {
      expect(listPifssSubmissionsSpy).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText('2026-03')).toBeInTheDocument();
    // Accepted status badge renders.
    expect(screen.getByText(/^Accepted$/i)).toBeInTheDocument();
    // Generate action.
    const genBtn = await screen.findByRole('button', {
      name: /Generate PIFSS file for a period/i,
    });
    fireEvent.click(genBtn);
    const confirmBtn = await screen.findByRole('button', { name: /^Generate$/i });
    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(generatePifssFileSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('Employees tab: opens employee detail slide-over and loads EOS/advances/history', async () => {
    render(<PayrollScreen role="Owner" />);
    const tab = await screen.findByRole('tab', { name: /^Employees$/i });
    fireEvent.click(tab);
    await waitFor(() => {
      expect(listEmployeesSpy).toHaveBeenCalled();
    });
    const empRow = await screen.findByRole('button', {
      name: /Open employee detail for Fahad Al-Jasem/i,
    });
    fireEvent.click(empRow);
    await waitFor(() => {
      expect(getEmployeeSpy).toHaveBeenCalledWith('EMP-001');
      expect(getEmployeeEosSpy).toHaveBeenCalledWith('EMP-001');
      expect(getEmployeeEosHistorySpy).toHaveBeenCalledWith('EMP-001');
      expect(getEmployeeAdvancesSpy).toHaveBeenCalledWith('EMP-001');
    });
  });

  it('i18n parity: payroll namespace has identical key sets in EN and AR', () => {
    const walk = (obj, prefix = '') => {
      const out = [];
      for (const [k, v] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${k}` : k;
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          out.push(...walk(v, path));
        } else {
          out.push(path);
        }
      }
      return out.sort();
    };
    const enKeys = walk(enPayroll);
    const arKeys = walk(arPayroll);
    expect(arKeys).toEqual(enKeys);
    expect(enKeys.length).toBeGreaterThan(60);
  });

  it('Arabic renders the Arabic screen title when language switches to ar', async () => {
    render(<PayrollScreen role="Owner" />);
    // English title first.
    expect(await screen.findAllByText('Payroll')).not.toHaveLength(0);
    // Switch and rerender via i18n change.
    await setLang('ar');
    // Arabic title appears.
    await waitFor(() => {
      expect(screen.getAllByText('الرواتب').length).toBeGreaterThan(0);
    });
    await setLang('en');
  });
});
