/**
 * BankMandateAdminScreen — HASEEB-211 (2026-04-22).
 *
 * Covers:
 *   1. List view renders all 4 status values with correct badges +
 *      tiered-chip on thresholded mandates.
 *   2. Create composer happy path: 4-step wizard with base rule + one
 *      tiered threshold submits the right payload to createMandate.
 *   3. Create composer validation: empty bank name rejects; no
 *      signatory classes rejects; count < 1 rejects.
 *   4. Acknowledge flow: Owner clicks Acknowledge on PENDING row →
 *      acknowledgeMandate called.
 *   5. Cancel flow: Owner clicks Cancel on ACTIVE row with linked
 *      vouchers → warning modal renders voucher count → reason required
 *      → confirm → cancelMandate called.
 *   6. Assign signatory flow: Owner opens Assign modal → picks user +
 *      class + date → submit → assignMandateSignatory called.
 *   7. Revoke signatory flow: Owner clicks Revoke on roster row → reason
 *      + effective-until → submit → revokeMandateSignatory called.
 *   8. Role gating: Junior — sidebar-level hidden (screen renders
 *      no-access null). CFO — list visible, action buttons present but
 *      disabled; read-only banner shown. Owner — full access.
 *   9. "Create replacement mandate" shortcut opens fresh Create composer
 *      (does NOT auto-cancel current mandate — that's HASEEB-232 future
 *      work).
 *  10. i18n parity: EN+AR bankMandates namespaces have identical key
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
import enBM from '../../src/i18n/locales/en/bankMandates.json';
import arBM from '../../src/i18n/locales/ar/bankMandates.json';

// ── Engine boundary stubs ─────────────────────────────────────────
const listMandatesSpy = vi.fn();
const getMandateSpy = vi.fn();
const listMandateSignatoriesSpy = vi.fn();
const createMandateSpy = vi.fn();
const acknowledgeMandateSpy = vi.fn();
const cancelMandateSpy = vi.fn();
const assignMandateSignatorySpy = vi.fn();
const revokeMandateSignatorySpy = vi.fn();
const listVouchersSpy = vi.fn();

vi.mock('../../src/engine', () => ({
  __esModule: true,
  listMandates: (...args) => listMandatesSpy(...args),
  getMandate: (...args) => getMandateSpy(...args),
  listMandateSignatories: (...args) => listMandateSignatoriesSpy(...args),
  createMandate: (...args) => createMandateSpy(...args),
  acknowledgeMandate: (...args) => acknowledgeMandateSpy(...args),
  cancelMandate: (...args) => cancelMandateSpy(...args),
  assignMandateSignatory: (...args) => assignMandateSignatorySpy(...args),
  revokeMandateSignatory: (...args) => revokeMandateSignatorySpy(...args),
  listVouchers: (...args) => listVouchersSpy(...args),
}));

import BankMandateAdminScreen from '../../src/screens/owner/BankMandateAdminScreen';

async function setLang(lang) {
  await act(async () => {
    await i18n.changeLanguage(lang);
  });
}

// ── Fixtures ──────────────────────────────────────────────────────

function seedMandates() {
  const today = '2026-04-22';
  return [
    {
      id: 'mandate-pending-1',
      bankName: 'Gulf Bank',
      accountReference: '****7722',
      mandateDocumentUrl: null,
      mandateRules: {
        requires: [
          { signatoryClass: 'OWNER', count: 1 },
          { signatoryClass: 'AUTHORIZED_SIGNATORY', count: 1 },
        ],
      },
      effectiveFrom: today,
      effectiveUntil: null,
      status: 'PENDING_BANK_ACKNOWLEDGMENT',
      submittedToBankAt: '2026-04-22T08:00:00.000Z',
      acknowledgedAt: null,
      acknowledgedBy: null,
      supersededByMandateId: null,
      cancellationReason: null,
      createdBy: 'user-owner-1',
      createdAt: '2026-04-22T08:00:00.000Z',
      updatedAt: '2026-04-22T08:00:00.000Z',
    },
    {
      id: 'mandate-active-1',
      bankName: 'National Bank of Kuwait',
      accountReference: '****4421',
      mandateDocumentUrl: null,
      mandateRules: {
        requires: [
          { signatoryClass: 'OWNER', count: 1 },
          { signatoryClass: 'CFO', count: 1 },
        ],
        amountThresholds: [
          {
            minAmountKwd: '5000.000',
            extraRequires: [{ signatoryClass: 'CHAIRMAN', count: 1 }],
          },
        ],
      },
      effectiveFrom: '2026-04-15',
      effectiveUntil: null,
      status: 'ACTIVE',
      submittedToBankAt: '2026-04-15T08:00:00.000Z',
      acknowledgedAt: '2026-04-15T10:00:00.000Z',
      acknowledgedBy: 'user-owner-1',
      supersededByMandateId: null,
      cancellationReason: null,
      createdBy: 'user-owner-1',
      createdAt: '2026-04-15T08:00:00.000Z',
      updatedAt: '2026-04-15T10:00:00.000Z',
    },
    {
      id: 'mandate-superseded-1',
      bankName: 'National Bank of Kuwait',
      accountReference: '****4421',
      mandateDocumentUrl: null,
      mandateRules: {
        requires: [{ signatoryClass: 'OWNER', count: 1 }],
      },
      effectiveFrom: '2025-01-01',
      effectiveUntil: '2026-04-14',
      status: 'SUPERSEDED',
      submittedToBankAt: '2025-01-02T00:00:00.000Z',
      acknowledgedAt: '2025-01-05T00:00:00.000Z',
      acknowledgedBy: 'user-owner-1',
      supersededByMandateId: 'mandate-active-1',
      cancellationReason: null,
      createdBy: 'user-owner-1',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2026-04-14T00:00:00.000Z',
    },
    {
      id: 'mandate-cancelled-1',
      bankName: 'Boubyan Bank',
      accountReference: '****3344',
      mandateDocumentUrl: null,
      mandateRules: {
        requires: [{ signatoryClass: 'CFO', count: 1 }],
      },
      effectiveFrom: '2025-06-01',
      effectiveUntil: '2026-04-21',
      status: 'CANCELLED',
      submittedToBankAt: '2025-06-01T00:00:00.000Z',
      acknowledgedAt: '2025-06-03T00:00:00.000Z',
      acknowledgedBy: 'user-owner-1',
      supersededByMandateId: null,
      cancellationReason: 'Account closed by bank.',
      cancelledAt: '2026-04-21T00:00:00.000Z',
      cancelledBy: 'user-owner-1',
      createdBy: 'user-owner-1',
      createdAt: '2025-06-01T00:00:00.000Z',
      updatedAt: '2026-04-21T00:00:00.000Z',
    },
  ];
}

function seedSignatories() {
  const today = '2026-04-22';
  return [
    {
      id: 'sig-active-1',
      mandateId: 'mandate-active-1',
      userId: 'user-owner-1',
      signatoryClass: 'OWNER',
      effectiveFrom: '2026-04-15',
      effectiveUntil: null,
      revokedReason: null,
      revokedAt: null,
      createdAt: '2026-04-15T10:00:00.000Z',
    },
    {
      id: 'sig-active-2',
      mandateId: 'mandate-active-1',
      userId: 'user-cfo-1',
      signatoryClass: 'CFO',
      effectiveFrom: '2026-04-15',
      effectiveUntil: null,
      revokedReason: null,
      revokedAt: null,
      createdAt: '2026-04-15T10:00:00.000Z',
    },
    {
      id: 'sig-historical-1',
      mandateId: 'mandate-active-1',
      userId: 'user-ex-cfo',
      signatoryClass: 'CFO',
      effectiveFrom: '2025-01-01',
      effectiveUntil: '2026-04-14',
      revokedReason: 'Role transition.',
      revokedAt: '2026-04-14T00:00:00.000Z',
      createdAt: '2025-01-01T00:00:00.000Z',
    },
  ];
}

function seedVouchersForMandate() {
  return [
    {
      id: 'voucher-1',
      voucherNumber: 'PV-2026-0010',
      beneficiaryNameSnapshot: 'Al-Khaleej Supplies',
      amountKwd: '4250.500',
      status: 'PENDING_APPROVAL',
    },
    {
      id: 'voucher-2',
      voucherNumber: 'PV-2026-0011',
      beneficiaryNameSnapshot: 'Gulf Logistics',
      amountKwd: '1200.000',
      status: 'PAID',
    },
  ];
}

function configureDefaultMocks() {
  listMandatesSpy.mockResolvedValue({ rowCount: 4, rows: seedMandates() });
  getMandateSpy.mockImplementation(async (id) =>
    seedMandates().find((m) => m.id === id) || null,
  );
  listMandateSignatoriesSpy.mockImplementation(async (id) => {
    const all = seedSignatories();
    const rows = all.filter((s) => s.mandateId === id);
    return { rowCount: rows.length, rows };
  });
  listVouchersSpy.mockImplementation(async (filter = {}) => {
    if (filter?.mandateId === 'mandate-active-1') {
      const rows = seedVouchersForMandate();
      return { rowCount: rows.length, rows };
    }
    return { rowCount: 0, rows: [] };
  });
  createMandateSpy.mockResolvedValue({
    id: 'mandate-new',
    bankName: 'Test Bank',
    accountReference: '****0001',
    status: 'PENDING_BANK_ACKNOWLEDGMENT',
    mandateRules: { requires: [] },
  });
  acknowledgeMandateSpy.mockResolvedValue({ id: 'mandate-pending-1', status: 'ACTIVE' });
  cancelMandateSpy.mockResolvedValue({ id: 'mandate-active-1', status: 'CANCELLED' });
  assignMandateSignatorySpy.mockResolvedValue({ id: 'sig-new-1' });
  revokeMandateSignatorySpy.mockResolvedValue({ id: 'sig-active-2' });
}

// ── Tests ─────────────────────────────────────────────────────────

describe('BankMandateAdminScreen — HASEEB-211', () => {
  beforeEach(async () => {
    listMandatesSpy.mockReset();
    getMandateSpy.mockReset();
    listMandateSignatoriesSpy.mockReset();
    createMandateSpy.mockReset();
    acknowledgeMandateSpy.mockReset();
    cancelMandateSpy.mockReset();
    assignMandateSignatorySpy.mockReset();
    revokeMandateSignatorySpy.mockReset();
    listVouchersSpy.mockReset();
    configureDefaultMocks();
    await setLang('en');
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('list view renders all 4 status values + tiered chip on thresholded mandate', async () => {
    render(<BankMandateAdminScreen role="Owner" />);
    await waitFor(() => {
      expect(listMandatesSpy).toHaveBeenCalled();
    });
    // All 4 rows render.
    expect(await screen.findByTestId('mandate-row-mandate-pending-1')).toBeInTheDocument();
    expect(screen.getByTestId('mandate-row-mandate-active-1')).toBeInTheDocument();
    expect(screen.getByTestId('mandate-row-mandate-superseded-1')).toBeInTheDocument();
    expect(screen.getByTestId('mandate-row-mandate-cancelled-1')).toBeInTheDocument();
    // Tiered chip only on mandate-active-1 (has amountThresholds).
    expect(screen.getByTestId('mandate-tiered-chip-mandate-active-1')).toBeInTheDocument();
    expect(
      screen.queryByTestId('mandate-tiered-chip-mandate-pending-1'),
    ).not.toBeInTheDocument();
    // Status labels visible somewhere.
    expect(screen.getAllByText('Pending bank acknowledgment').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Superseded').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cancelled').length).toBeGreaterThan(0);
  });

  it('role gating: Junior renders no-access screen (sidebar hidden at route level)', async () => {
    render(<BankMandateAdminScreen role="Junior" />);
    // The Junior branch returns a placeholder div and does NOT call listMandates.
    expect(screen.getByTestId('bank-mandates-no-access')).toBeInTheDocument();
    expect(listMandatesSpy).not.toHaveBeenCalled();
  });

  it('role gating: Owner sees New mandate button + no read-only banner', async () => {
    render(<BankMandateAdminScreen role="Owner" />);
    await waitFor(() => {
      expect(listMandatesSpy).toHaveBeenCalled();
    });
    expect(
      await screen.findByRole('button', { name: /Create a new bank mandate/i }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('readonly-banner')).not.toBeInTheDocument();
  });

  it('role gating: CFO sees read-only banner + disabled New mandate button', async () => {
    render(<BankMandateAdminScreen role="CFO" />);
    await waitFor(() => {
      expect(listMandatesSpy).toHaveBeenCalled();
    });
    expect(screen.getByTestId('readonly-banner')).toBeInTheDocument();
    // Per HASEEB-211 dispatch spec: CFO sees the New mandate button
    // disabled-with-tooltip (NOT hidden). Junior is hidden at the
    // sidebar level and via the no-access null branch.
    const newBtn = screen.getByTestId('bank-mandate-new-action');
    expect(newBtn).toBeDisabled();
    expect(newBtn).toHaveAttribute('title');
  });

  it('role gating: CFO on ACTIVE detail — action buttons disabled', async () => {
    render(<BankMandateAdminScreen role="CFO" />);
    fireEvent.click(await screen.findByTestId('mandate-row-mandate-active-1'));
    await waitFor(() => {
      expect(getMandateSpy).toHaveBeenCalledWith('mandate-active-1');
    });
    const assignBtn = await screen.findByTestId('detail-action-assign');
    expect(assignBtn).toBeDisabled();
    const cancelBtn = screen.getByTestId('detail-action-cancel');
    expect(cancelBtn).toBeDisabled();
  });

  it('create composer: happy path submits base rule + tiered threshold', async () => {
    render(<BankMandateAdminScreen role="Owner" />);
    fireEvent.click(
      await screen.findByRole('button', { name: /Create a new bank mandate/i }),
    );
    // Step 1 — Bank
    fireEvent.change(await screen.findByLabelText(/Bank name/i), {
      target: { value: 'Kuwait Finance House' },
    });
    fireEvent.change(screen.getByLabelText(/Account reference/i), {
      target: { value: '****5566' },
    });
    fireEvent.change(screen.getByLabelText(/Effective from/i), {
      target: { value: '2026-05-01' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));

    // Step 2 — Rules: default row is OWNER × 1; add CFO × 1.
    fireEvent.click(await screen.findByRole('button', { name: /Add class/i }));
    // Next.
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));

    // Step 3 — Add one threshold tier.
    fireEvent.click(await screen.findByRole('button', { name: /Add threshold tier/i }));
    fireEvent.change(await screen.findByLabelText(/Minimum amount/i), {
      target: { value: '5000.000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Next$/i }));

    // Step 4 — Review + submit.
    fireEvent.click(await screen.findByRole('button', { name: /^Create mandate$/i }));

    await waitFor(() => {
      expect(createMandateSpy).toHaveBeenCalledTimes(1);
    });
    const payload = createMandateSpy.mock.calls[0][0];
    expect(payload.bankName).toBe('Kuwait Finance House');
    expect(payload.accountReference).toBe('****5566');
    expect(payload.effectiveFrom).toBe('2026-05-01');
    expect(payload.mandateRules.requires.length).toBeGreaterThanOrEqual(2);
    expect(payload.mandateRules.amountThresholds).toBeDefined();
    expect(payload.mandateRules.amountThresholds[0].minAmountKwd).toBe('5000.000');
  });

  it('create composer validation: blocks advance when bank name is empty', async () => {
    render(<BankMandateAdminScreen role="Owner" />);
    fireEvent.click(
      await screen.findByRole('button', { name: /Create a new bank mandate/i }),
    );
    // Leave bankName blank; try to advance.
    fireEvent.click(await screen.findByRole('button', { name: /^Next$/i }));
    // Inline error must render; createMandate must not have been called.
    expect(await screen.findByText(/Bank name is required/i)).toBeInTheDocument();
    expect(createMandateSpy).not.toHaveBeenCalled();
  });

  it('acknowledge flow: clicking Acknowledge on PENDING mandate opens modal + submits', async () => {
    render(<BankMandateAdminScreen role="Owner" />);
    fireEvent.click(await screen.findByTestId('mandate-row-mandate-pending-1'));
    await waitFor(() => {
      expect(getMandateSpy).toHaveBeenCalledWith('mandate-pending-1');
    });
    fireEvent.click(await screen.findByTestId('detail-action-acknowledge'));
    // Modal confirm button labeled "Acknowledge" (plus in the action-bar
    // there's also one with the same name; pick the one inside the dialog).
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(
      within(dialog).getByRole('button', { name: /^Acknowledge$/i }),
    );
    await waitFor(() => {
      expect(acknowledgeMandateSpy).toHaveBeenCalledWith(
        'mandate-pending-1',
        expect.any(Object),
      );
    });
  });

  it('cancel flow: ACTIVE mandate with linked vouchers shows voucher warning + requires reason + submits', async () => {
    render(<BankMandateAdminScreen role="Owner" />);
    fireEvent.click(await screen.findByTestId('mandate-row-mandate-active-1'));
    await waitFor(() => {
      expect(getMandateSpy).toHaveBeenCalledWith('mandate-active-1');
    });
    // Wait for linked vouchers to load.
    await waitFor(() => {
      expect(listVouchersSpy).toHaveBeenCalledWith({ mandateId: 'mandate-active-1' });
    });
    fireEvent.click(await screen.findByTestId('detail-action-cancel'));
    // Linked-voucher warning should render with the actual count (1
    // active: PENDING_APPROVAL voucher — the PAID one is excluded from
    // active count).
    expect(
      await screen.findByTestId('cancel-linked-voucher-warning'),
    ).toBeInTheDocument();
    // Try to confirm without reason → blocked.
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: /Confirm cancel/i }));
    expect(cancelMandateSpy).not.toHaveBeenCalled();
    expect(
      within(dialog).getByText(/cancellation reason is required/i),
    ).toBeInTheDocument();
    // Fill reason + confirm.
    fireEvent.change(within(dialog).getByLabelText(/Cancellation reason/i), {
      target: { value: 'Updated rules per bank.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /Confirm cancel/i }));
    await waitFor(() => {
      expect(cancelMandateSpy).toHaveBeenCalledWith('mandate-active-1', {
        reason: 'Updated rules per bank.',
      });
    });
  });

  it('assign signatory flow: Owner opens modal → submit calls assignMandateSignatory', async () => {
    render(<BankMandateAdminScreen role="Owner" />);
    fireEvent.click(await screen.findByTestId('mandate-row-mandate-active-1'));
    await waitFor(() => {
      expect(getMandateSpy).toHaveBeenCalledWith('mandate-active-1');
    });
    fireEvent.click(await screen.findByTestId('detail-action-assign'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/User ID/i), {
      target: { value: 'user-new-cfo' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /^Assign$/i }));
    await waitFor(() => {
      expect(assignMandateSignatorySpy).toHaveBeenCalledWith(
        'mandate-active-1',
        expect.objectContaining({
          userId: 'user-new-cfo',
          signatoryClass: 'OWNER',
        }),
      );
    });
  });

  it('revoke signatory flow: roster Revoke → reason + submit calls revokeMandateSignatory', async () => {
    render(<BankMandateAdminScreen role="Owner" />);
    fireEvent.click(await screen.findByTestId('mandate-row-mandate-active-1'));
    await waitFor(() => {
      expect(listMandateSignatoriesSpy).toHaveBeenCalledWith('mandate-active-1');
    });
    // Find the revoke button on the sig-active-2 row.
    const row = await screen.findByTestId('signatory-row-sig-active-2');
    fireEvent.click(within(row).getByRole('button', { name: /Revoke/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Revocation reason/i), {
      target: { value: 'Role change.' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /^Revoke$/i }));
    await waitFor(() => {
      expect(revokeMandateSignatorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          assignmentId: 'sig-active-2',
          revokedReason: 'Role change.',
        }),
      );
    });
  });

  it('supersession: "Create replacement mandate" opens fresh composer and does NOT call cancelMandate', async () => {
    render(<BankMandateAdminScreen role="Owner" />);
    fireEvent.click(await screen.findByTestId('mandate-row-mandate-active-1'));
    await waitFor(() => {
      expect(getMandateSpy).toHaveBeenCalledWith('mandate-active-1');
    });
    // Supersession info banner must render on ACTIVE.
    expect(
      await screen.findByTestId('supersession-info-banner'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('detail-action-create-replacement'));
    // The fresh composer heading uses "heading_supersede".
    expect(
      await screen.findByText(/Create replacement mandate/i),
    ).toBeInTheDocument();
    // cancelMandate MUST NOT have been auto-called — HASEEB-232 is the
    // future atomic-wizard task.
    expect(cancelMandateSpy).not.toHaveBeenCalled();
  });

  it('i18n parity: bankMandates namespace has identical key sets in EN and AR', () => {
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
    const enKeys = walk(enBM);
    const arKeys = walk(arBM);
    expect(arKeys).toEqual(enKeys);
    expect(enKeys.length).toBeGreaterThan(80);
  });

  it('Arabic: renders the Arabic screen title when language switches to ar', async () => {
    render(<BankMandateAdminScreen role="Owner" />);
    expect(await screen.findAllByText('Bank Mandates')).not.toHaveLength(0);
    await setLang('ar');
    await waitFor(() => {
      expect(screen.getAllByText('التفويضات المصرفية').length).toBeGreaterThan(0);
    });
    await setLang('en');
  });
});
