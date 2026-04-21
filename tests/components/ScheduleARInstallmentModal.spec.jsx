/**
 * ScheduleARInstallmentModal — AUDIT-ACC-005 (2026-04-22) regression.
 *
 * Asserts:
 *   1. Submit dispatches via engine.scheduleInvoicePaymentPlan.
 *   2. Default installments populate with amounts summing to outstanding
 *      (within 0.001 KWD) — happy path for 2 and 3 installments.
 *   3. Sum-mismatch blocks submit + renders a warning.
 *   4. Editing one row to a partial amount + adjusting another to match
 *      restores submit eligibility.
 *   5. Backend rejection surfaces inline without closing.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act, waitFor } from '@testing-library/react';
import React from 'react';

import i18n from '../../src/i18n';

const scheduleSpy = vi.fn();
vi.mock('../../src/engine', () => ({
  __esModule: true,
  scheduleInvoicePaymentPlan: (...args) => scheduleSpy(...args),
}));

import ScheduleARInstallmentModal from '../../src/components/aging/ScheduleARInstallmentModal';

async function setLang(lang) {
  await act(async () => { await i18n.changeLanguage(lang); });
}

// Use a future due date so installment defaults (dueDate + N months) all
// land in the future and pass the "dueDate >= today" gate.
function futureYmd(monthsFromNow) {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsFromNow);
  return d.toISOString().slice(0, 10);
}

const SAMPLE_INVOICE = {
  id: 'inv-99',
  invoiceNumber: 'INV-2026-0099',
  partyName: 'Gulf Trading',
  outstanding: 3000, // 3000.000 KWD exactly
  dueDate: futureYmd(1),
};

function renderOpen(overrides = {}) {
  const props = {
    open: true,
    invoice: SAMPLE_INVOICE,
    onClose: vi.fn(),
    onScheduled: vi.fn(),
    ...overrides,
  };
  return { ...render(<ScheduleARInstallmentModal {...props} />), ...props };
}

describe('ScheduleARInstallmentModal — AUDIT-ACC-005', () => {
  beforeEach(async () => {
    scheduleSpy.mockReset();
    await setLang('en');
  });

  afterEach(() => cleanup());

  it('auto-populates 3 equal installments summing to outstanding', async () => {
    renderOpen();
    // Default count is 3 → 3 rows with amounts 1000.000 each.
    const amountInputs = screen.getAllByLabelText(/^Amount \(KWD\)/i);
    expect(amountInputs).toHaveLength(3);
    // All three rows 1000.000.
    expect(amountInputs[0]).toHaveValue('1000.000');
    expect(amountInputs[1]).toHaveValue('1000.000');
    expect(amountInputs[2]).toHaveValue('1000.000');
    // Sum-matches indicator should render (look for "matches the outstanding" text).
    expect(screen.getByRole('status')).toHaveTextContent(/matches the outstanding/i);
  });

  it('submits a 3-installment plan and closes on success', async () => {
    scheduleSpy.mockResolvedValue({ invoice: {}, paymentPlan: {} });
    const { onClose, onScheduled } = renderOpen();
    fireEvent.click(screen.getByText(/^Schedule plan$/i));
    await waitFor(() => expect(scheduleSpy).toHaveBeenCalled());
    const [invoiceId, body] = scheduleSpy.mock.calls[0];
    expect(invoiceId).toBe('inv-99');
    expect(body.installments).toHaveLength(3);
    expect(body.installments.every((i) => /^\d+\.\d{3}$/.test(i.amount))).toBe(true);
    expect(body.installments.every((i) => /^\d{4}-\d{2}-\d{2}$/.test(i.dueDate))).toBe(true);
    const total = body.installments.reduce(
      (acc, i) => acc + Math.round(Number(i.amount) * 1000),
      0,
    );
    expect(total).toBe(3000 * 1000);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onScheduled).toHaveBeenCalled();
  });

  it('submits a 2-installment plan when count=2 is selected', async () => {
    scheduleSpy.mockResolvedValue({ invoice: {}, paymentPlan: {} });
    renderOpen();
    const countSelect = screen.getByDisplayValue('3');
    fireEvent.change(countSelect, { target: { value: '2' } });
    // Wait for default repopulation to produce 2 rows.
    await waitFor(() => {
      expect(screen.getAllByLabelText(/^Amount \(KWD\)/i)).toHaveLength(2);
    });
    fireEvent.click(screen.getByText(/^Schedule plan$/i));
    await waitFor(() => expect(scheduleSpy).toHaveBeenCalled());
    expect(scheduleSpy.mock.calls[0][1].installments).toHaveLength(2);
  });

  it('disables submit when the installment sum does not match outstanding', async () => {
    renderOpen();
    const amountInputs = screen.getAllByLabelText(/^Amount \(KWD\)/i);
    // Zero out the first installment — total no longer equals outstanding.
    fireEvent.change(amountInputs[0], { target: { value: '0.000' } });
    fireEvent.click(screen.getByText(/^Schedule plan$/i));
    expect(scheduleSpy).not.toHaveBeenCalled();
    // The mismatch warning in the status line shows the delta.
    expect(screen.getByRole('status')).toHaveTextContent(/delta/i);
  });

  it('allows partial-amount edit when the operator rebalances other rows', async () => {
    scheduleSpy.mockResolvedValue({ invoice: {}, paymentPlan: {} });
    renderOpen();
    const amountInputs = screen.getAllByLabelText(/^Amount \(KWD\)/i);
    // Row 0 -> 500.000; row 2 absorbs the residual -> 1500.000.
    fireEvent.change(amountInputs[0], { target: { value: '500.000' } });
    fireEvent.change(amountInputs[2], { target: { value: '1500.000' } });
    // Sum is now 500 + 1000 + 1500 = 3000 — matches outstanding.
    fireEvent.click(screen.getByText(/^Schedule plan$/i));
    await waitFor(() => expect(scheduleSpy).toHaveBeenCalled());
    const amounts = scheduleSpy.mock.calls[0][1].installments.map((i) => i.amount);
    expect(amounts).toEqual(['500.000', '1000.000', '1500.000']);
  });

  it('surfaces backend error inline on 409 conflict without closing', async () => {
    scheduleSpy.mockRejectedValueOnce({
      message: 'Invoice already has an active payment plan',
      status: 409,
    });
    const { onClose } = renderOpen();
    fireEvent.click(screen.getByText(/^Schedule plan$/i));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/active payment plan/i);
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
