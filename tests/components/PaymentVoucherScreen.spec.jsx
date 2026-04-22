/**
 * PaymentVoucherScreen — AUDIT-ACC-002 (2026-04-22).
 *
 * Covers:
 *   1. List view: each of the 4 filter tabs surfaces the right voucher
 *      rows from the engine's listVouchers mock.
 *   2. Role gating: Junior sees zero action buttons; CFO sees the
 *      composer "New voucher" button; Owner sees it too.
 *   3. Composer validation: amount regex + mandate-required warning
 *      banner (HASEEB-274) when cheque + Σcount < 2.
 *   4. Composer: compliant mandate (count=2) renders no warning.
 *   5. Detail: signatory progress block renders for cheque method; does
 *      NOT render for cash/transfer methods.
 *   6. SoD defense-in-depth: Review button hidden when current user id
 *      === preparedBy.
 *   7. i18n parity: EN/AR paymentVouchers namespaces have identical key
 *      sets.
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
import enPV from '../../src/i18n/locales/en/paymentVouchers.json';
import arPV from '../../src/i18n/locales/ar/paymentVouchers.json';

// Engine boundary stubs.
const listVouchersSpy = vi.fn();
const getVoucherSpy = vi.fn();
const createVoucherSpy = vi.fn();
const submitVoucherSpy = vi.fn();
const reviewVoucherSpy = vi.fn();
const approveVoucherSpy = vi.fn();
const assignSignatoriesSpy = vi.fn();
const signVoucherSpy = vi.fn();
const markVoucherPaidSpy = vi.fn();
const rejectVoucherSpy = vi.fn();
const cancelVoucherSpy = vi.fn();
const listMandatesSpy = vi.fn();
const getMandateSpy = vi.fn();

vi.mock('../../src/engine', () => ({
  __esModule: true,
  listVouchers: (...args) => listVouchersSpy(...args),
  getVoucher: (...args) => getVoucherSpy(...args),
  createVoucher: (...args) => createVoucherSpy(...args),
  submitVoucher: (...args) => submitVoucherSpy(...args),
  reviewVoucher: (...args) => reviewVoucherSpy(...args),
  approveVoucher: (...args) => approveVoucherSpy(...args),
  assignSignatories: (...args) => assignSignatoriesSpy(...args),
  signVoucher: (...args) => signVoucherSpy(...args),
  markVoucherPaid: (...args) => markVoucherPaidSpy(...args),
  rejectVoucher: (...args) => rejectVoucherSpy(...args),
  cancelVoucher: (...args) => cancelVoucherSpy(...args),
  listMandates: (...args) => listMandatesSpy(...args),
  getMandate: (...args) => getMandateSpy(...args),
}));

import PaymentVoucherScreen from '../../src/screens/cfo/PaymentVoucherScreen';

async function setLang(lang) {
  await act(async () => {
    await i18n.changeLanguage(lang);
  });
}

function seedVouchers() {
  const nowIso = '2026-04-22T10:00:00.000Z';
  const today = '2026-04-22';
  return [
    {
      id: 'pv-draft-1',
      voucherNumber: 'PV-2026-0001',
      beneficiaryType: 'Vendor',
      beneficiaryId: 'vendor-1',
      beneficiaryNameSnapshot: 'Al-Khaleej Supplies',
      amountKwd: '4250.500',
      paymentMethod: 'CHEQUE_IMMEDIATE',
      chequeId: null,
      issueDate: today,
      description: null,
      status: 'DRAFT',
      preparedBy: 'user-cfo-1',
      preparedAt: nowIso,
      reviewedBy: null,
      reviewedAt: null,
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      cancelledBy: null,
      cancelledAt: null,
      cancellationReason: null,
      paidAt: null,
      linkedJournalEntryId: null,
      linkedApprovalEventId: null,
      bankAccountMandateId: 'mandate-1',
      signatories: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'pv-review-1',
      voucherNumber: 'PV-2026-0002',
      beneficiaryType: 'Vendor',
      beneficiaryId: 'vendor-2',
      beneficiaryNameSnapshot: 'Gulf Logistics',
      amountKwd: '1200.000',
      paymentMethod: 'BANK_TRANSFER_KNET',
      chequeId: null,
      issueDate: today,
      description: null,
      status: 'PENDING_REVIEW',
      preparedBy: 'user-cfo-1',
      preparedAt: nowIso,
      reviewedBy: null,
      reviewedAt: null,
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      cancelledBy: null,
      cancelledAt: null,
      cancellationReason: null,
      paidAt: null,
      linkedJournalEntryId: null,
      linkedApprovalEventId: null,
      bankAccountMandateId: 'mandate-1',
      signatories: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'pv-signatories-1',
      voucherNumber: 'PV-2026-0003',
      beneficiaryType: 'Vendor',
      beneficiaryId: 'vendor-3',
      beneficiaryNameSnapshot: 'Burgan Electric Works',
      amountKwd: '8750.000',
      paymentMethod: 'CHEQUE_POST_DATED',
      chequeId: 'cheque-1',
      issueDate: today,
      description: null,
      status: 'PENDING_SIGNATORIES',
      preparedBy: 'user-cfo-1',
      preparedAt: nowIso,
      reviewedBy: 'user-senior-1',
      reviewedAt: nowIso,
      approvedBy: 'user-owner-1',
      approvedAt: nowIso,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      cancelledBy: null,
      cancelledAt: null,
      cancellationReason: null,
      paidAt: null,
      linkedJournalEntryId: null,
      linkedApprovalEventId: 'approval-1',
      bankAccountMandateId: 'mandate-1',
      signatories: [
        {
          userId: 'user-owner-1',
          signatoryClass: 'CLASS_A',
          assignedAt: nowIso,
          signedAt: nowIso,
          signedBy: 'user-owner-1',
        },
        {
          userId: 'user-cfo-1',
          signatoryClass: 'CLASS_B',
          assignedAt: nowIso,
        },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'pv-paid-1',
      voucherNumber: 'PV-2026-0004',
      beneficiaryType: 'Employee',
      beneficiaryId: 'emp-1',
      beneficiaryNameSnapshot: 'Fahad Al-Jasem',
      amountKwd: '350.000',
      paymentMethod: 'CASH',
      chequeId: null,
      issueDate: today,
      description: null,
      status: 'PAID',
      preparedBy: 'user-cfo-1',
      preparedAt: nowIso,
      reviewedBy: 'user-senior-1',
      reviewedAt: nowIso,
      approvedBy: 'user-owner-1',
      approvedAt: nowIso,
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      cancelledBy: null,
      cancelledAt: null,
      cancellationReason: null,
      paidAt: nowIso,
      linkedJournalEntryId: 'je-pv-0004',
      linkedApprovalEventId: null,
      bankAccountMandateId: null,
      signatories: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];
}

const compliantMandate = {
  id: 'mandate-1',
  bankName: 'NBK',
  accountReference: '****4421',
  mandateRules: {
    requires: [
      { signatoryClass: 'CLASS_A', count: 1 },
      { signatoryClass: 'CLASS_B', count: 1 },
    ],
  },
  status: 'ACTIVE',
};
const nonCompliantMandate = {
  id: 'mandate-2',
  bankName: 'Burgan Bank',
  accountReference: '****9813',
  mandateRules: {
    requires: [{ signatoryClass: 'CLASS_A', count: 1 }],
  },
  status: 'ACTIVE',
};

describe('PaymentVoucherScreen — AUDIT-ACC-002', () => {
  beforeEach(async () => {
    listVouchersSpy.mockReset();
    getVoucherSpy.mockReset();
    createVoucherSpy.mockReset();
    submitVoucherSpy.mockReset();
    reviewVoucherSpy.mockReset();
    approveVoucherSpy.mockReset();
    assignSignatoriesSpy.mockReset();
    signVoucherSpy.mockReset();
    markVoucherPaidSpy.mockReset();
    rejectVoucherSpy.mockReset();
    cancelVoucherSpy.mockReset();
    listMandatesSpy.mockReset();
    getMandateSpy.mockReset();

    listVouchersSpy.mockResolvedValue({ rowCount: 4, rows: seedVouchers() });
    getVoucherSpy.mockImplementation(async (id) =>
      seedVouchers().find((v) => v.id === id) || null,
    );
    listMandatesSpy.mockResolvedValue({
      rowCount: 2,
      rows: [compliantMandate, nonCompliantMandate],
    });
    getMandateSpy.mockImplementation(async (id) => {
      if (id === 'mandate-1') return compliantMandate;
      if (id === 'mandate-2') return nonCompliantMandate;
      return null;
    });

    await setLang('en');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the list view with the DRAFT row on the Drafts tab by default', async () => {
    render(<PaymentVoucherScreen role="CFO" />);
    await waitFor(() => {
      expect(listVouchersSpy).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText('PV-2026-0001')).toBeInTheDocument();
    // PAID should not be visible on the default (Drafts) tab.
    expect(screen.queryByText('PV-2026-0004')).not.toBeInTheDocument();
  });

  it('Awaiting Action tab bundles PENDING_REVIEW + PENDING_APPROVAL + PENDING_SIGNATORIES', async () => {
    render(<PaymentVoucherScreen role="CFO" />);
    await waitFor(() => {
      expect(listVouchersSpy).toHaveBeenCalled();
    });
    const awaitingTab = await screen.findByRole('tab', {
      name: /Awaiting Action/i,
    });
    fireEvent.click(awaitingTab);
    expect(await screen.findByText('PV-2026-0002')).toBeInTheDocument();
    expect(screen.getByText('PV-2026-0003')).toBeInTheDocument();
    expect(screen.queryByText('PV-2026-0001')).not.toBeInTheDocument();
  });

  it('role gating: Junior sees zero action buttons — no New voucher affordance', async () => {
    render(<PaymentVoucherScreen role="Junior" />);
    await waitFor(() => {
      expect(listVouchersSpy).toHaveBeenCalled();
    });
    // Junior cannot create vouchers — the composer button must not render.
    expect(
      screen.queryByRole('button', { name: /Create a new payment voucher/i }),
    ).not.toBeInTheDocument();
  });

  it('role gating: CFO sees the New voucher composer button', async () => {
    render(<PaymentVoucherScreen role="CFO" />);
    await waitFor(() => {
      expect(listVouchersSpy).toHaveBeenCalled();
    });
    expect(
      await screen.findByRole('button', {
        name: /Create a new payment voucher/i,
      }),
    ).toBeInTheDocument();
  });

  it('role gating: Owner also sees the New voucher button', async () => {
    render(<PaymentVoucherScreen role="Owner" />);
    expect(
      await screen.findByRole('button', {
        name: /Create a new payment voucher/i,
      }),
    ).toBeInTheDocument();
  });

  it('composer: HASEEB-274 warning banner appears for cheque + mandate with Σcount<2', async () => {
    render(<PaymentVoucherScreen role="CFO" />);
    fireEvent.click(
      await screen.findByRole('button', {
        name: /Create a new payment voucher/i,
      }),
    );
    // Mandates load on mount; select the non-compliant one.
    const mandateSelect = await screen.findByLabelText(/Bank mandate/i);
    fireEvent.change(mandateSelect, { target: { value: 'mandate-2' } });
    // Payment method defaults to CHEQUE_IMMEDIATE, so banner shows.
    await waitFor(() => {
      expect(
        screen.getByTestId('composer-low-signatory-warning'),
      ).toBeInTheDocument();
    });
  });

  it('composer: compliant mandate (count=2) does NOT render the HASEEB-274 banner', async () => {
    render(<PaymentVoucherScreen role="CFO" />);
    fireEvent.click(
      await screen.findByRole('button', {
        name: /Create a new payment voucher/i,
      }),
    );
    const mandateSelect = await screen.findByLabelText(/Bank mandate/i);
    fireEvent.change(mandateSelect, { target: { value: 'mandate-1' } });
    await waitFor(() => {
      expect(
        screen.getByTestId('composer-mandate-required-count'),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByTestId('composer-low-signatory-warning'),
    ).not.toBeInTheDocument();
  });

  it('composer: amount regex rejects non-KWD shapes', async () => {
    render(<PaymentVoucherScreen role="CFO" />);
    fireEvent.click(
      await screen.findByRole('button', {
        name: /Create a new payment voucher/i,
      }),
    );
    // Fill required text fields but give amount a 4-decimal value.
    fireEvent.change(await screen.findByLabelText(/Beneficiary$/i), {
      target: { value: 'vendor-99' },
    });
    fireEvent.change(screen.getByLabelText(/Beneficiary name/i), {
      target: { value: 'Test Vendor' },
    });
    fireEvent.change(screen.getByLabelText(/Amount \(KWD\)/i), {
      target: { value: '100.1234' },
    });
    const mandateSelect = screen.getByLabelText(/Bank mandate/i);
    fireEvent.change(mandateSelect, { target: { value: 'mandate-1' } });
    fireEvent.click(screen.getByRole('button', { name: /^Create voucher$/i }));
    // Validation error should appear inline; createVoucher must NOT be called.
    await waitFor(() => {
      expect(createVoucherSpy).not.toHaveBeenCalled();
    });
  });

  it('detail: signatory progress block renders for cheque method', async () => {
    render(<PaymentVoucherScreen role="CFO" />);
    // Switch to Awaiting Action to find the PENDING_SIGNATORIES row.
    fireEvent.click(
      await screen.findByRole('tab', { name: /Awaiting Action/i }),
    );
    const row = await screen.findByTestId('voucher-row-pv-signatories-1');
    fireEvent.click(row);
    await waitFor(() => {
      expect(getVoucherSpy).toHaveBeenCalledWith('pv-signatories-1');
    });
    expect(
      await screen.findByTestId('detail-signatory-block'),
    ).toBeInTheDocument();
  });

  it('detail: signatory progress block is NOT rendered for cash method', async () => {
    render(<PaymentVoucherScreen role="CFO" />);
    fireEvent.click(
      await screen.findByRole('tab', { name: /Terminal/i }),
    );
    const row = await screen.findByTestId('voucher-row-pv-paid-1');
    fireEvent.click(row);
    await waitFor(() => {
      expect(getVoucherSpy).toHaveBeenCalledWith('pv-paid-1');
    });
    expect(screen.queryByTestId('detail-signatory-block')).not.toBeInTheDocument();
  });

  it('SoD: Review button is hidden when currentUserId === preparedBy', async () => {
    render(
      <PaymentVoucherScreen role="CFO" currentUserId="user-cfo-1" />,
    );
    fireEvent.click(
      await screen.findByRole('tab', { name: /Awaiting Action/i }),
    );
    const row = await screen.findByTestId('voucher-row-pv-review-1');
    fireEvent.click(row);
    await waitFor(() => {
      expect(getVoucherSpy).toHaveBeenCalledWith('pv-review-1');
    });
    // Review button must not render since preparedBy === currentUserId.
    expect(
      screen.queryByTestId('detail-action-review'),
    ).not.toBeInTheDocument();
  });

  it('i18n parity: paymentVouchers namespace has identical key sets in EN and AR', () => {
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
    const enKeys = walk(enPV);
    const arKeys = walk(arPV);
    expect(arKeys).toEqual(enKeys);
    expect(enKeys.length).toBeGreaterThan(80);
  });

  it('Arabic: renders the Arabic screen title when language switches to ar', async () => {
    render(<PaymentVoucherScreen role="CFO" />);
    expect(await screen.findAllByText('Payment Vouchers')).not.toHaveLength(0);
    await setLang('ar');
    await waitFor(() => {
      expect(screen.getAllByText('سندات الصرف').length).toBeGreaterThan(0);
    });
    await setLang('en');
  });
});
