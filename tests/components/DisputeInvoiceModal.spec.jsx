/**
 * DisputeInvoiceModal — AUDIT-ACC-005 (2026-04-22) regression.
 *
 * Asserts:
 *   1. Submit dispatches via engine.disputeInvoice (NOT the old mock
 *      markInvoiceDisputed, which has been deleted).
 *   2. Happy path closes + fires onSaved(result).
 *   3. disputedAmount is optional — empty submit sends {reason} only.
 *   4. disputedAmount filled sends {reason, disputedAmount}.
 *   5. Invalid disputedAmount (non-3dp-KWD) blocks submit inline.
 *   6. Backend rejection surfaces inline (submitError) without closing.
 *   7. reason minLength-10 validation blocks submit.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act, waitFor } from '@testing-library/react';
import React from 'react';

import i18n from '../../src/i18n';

const disputeInvoiceSpy = vi.fn();
vi.mock('../../src/engine', () => ({
  __esModule: true,
  disputeInvoice: (...args) => disputeInvoiceSpy(...args),
}));

import DisputeInvoiceModal from '../../src/components/aging/DisputeInvoiceModal';

async function setLang(lang) {
  await act(async () => { await i18n.changeLanguage(lang); });
}

const SAMPLE_INVOICE = {
  id: 'inv-42',
  invoiceNumber: 'INV-2026-0042',
  partyName: 'Beacon LLC',
  outstanding: 3000,
};

function renderOpen(overrides = {}) {
  const props = {
    open: true,
    invoice: SAMPLE_INVOICE,
    onClose: vi.fn(),
    onSaved: vi.fn(),
    ...overrides,
  };
  return { ...render(<DisputeInvoiceModal {...props} />), ...props };
}

describe('DisputeInvoiceModal — AUDIT-ACC-005 rewire', () => {
  beforeEach(async () => {
    disputeInvoiceSpy.mockReset();
    await setLang('en');
  });

  afterEach(() => cleanup());

  it('blocks submit until reason is at least 10 characters', () => {
    renderOpen();
    fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: 'short' } });
    fireEvent.click(screen.getByText(/Mark disputed/i));
    expect(disputeInvoiceSpy).not.toHaveBeenCalled();
  });

  it('submits with only {reason} when disputedAmount is empty', async () => {
    disputeInvoiceSpy.mockResolvedValue({ invoice: {}, dispute: {} });
    const { onClose, onSaved } = renderOpen();
    fireEvent.change(screen.getAllByRole('textbox')[0], {
      target: { value: 'Customer disputes billed scope — service not delivered' },
    });
    fireEvent.click(screen.getByText(/Mark disputed/i));
    await waitFor(() => expect(disputeInvoiceSpy).toHaveBeenCalled());
    const [invoiceId, body] = disputeInvoiceSpy.mock.calls[0];
    expect(invoiceId).toBe('inv-42');
    expect(body.reason).toMatch(/service not delivered/i);
    expect(body.disputedAmount).toBeUndefined();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSaved).toHaveBeenCalled();
  });

  it('submits with {reason, disputedAmount} when partial amount is entered', async () => {
    disputeInvoiceSpy.mockResolvedValue({ invoice: {}, dispute: {} });
    renderOpen();
    fireEvent.change(screen.getAllByRole('textbox')[0], {
      target: { value: 'Partial dispute on line items 3-4' },
    });
    // Second textbox-like field is the disputedAmount input (role=textbox for <input>).
    const inputs = screen.getAllByRole('textbox');
    // Reason is the textarea; disputedAmount is the input. We find by placeholder.
    const amountInput = screen.getByPlaceholderText(/1250\.000/);
    fireEvent.change(amountInput, { target: { value: '1250.000' } });
    fireEvent.click(screen.getByText(/Mark disputed/i));
    await waitFor(() => expect(disputeInvoiceSpy).toHaveBeenCalled());
    expect(disputeInvoiceSpy.mock.calls[0][1].disputedAmount).toBe('1250.000');
    // silence unused lint
    void inputs;
  });

  it('blocks submit on non-KWD-3dp disputed amount', () => {
    renderOpen();
    fireEvent.change(screen.getAllByRole('textbox')[0], {
      target: { value: 'Reason that is long enough to pass validation' },
    });
    const amountInput = screen.getByPlaceholderText(/1250\.000/);
    fireEvent.change(amountInput, { target: { value: '1.23456' } });
    fireEvent.click(screen.getByText(/Mark disputed/i));
    expect(disputeInvoiceSpy).not.toHaveBeenCalled();
    expect(screen.getByText(/up to 3 decimal places/i)).toBeInTheDocument();
  });

  it('surfaces backend error inline on rejection without closing', async () => {
    disputeInvoiceSpy.mockRejectedValueOnce({
      message: 'Invoice cannot be disputed in current status',
      status: 409,
    });
    const { onClose } = renderOpen();
    fireEvent.change(screen.getAllByRole('textbox')[0], {
      target: { value: 'Attempt to dispute an already-paid invoice' },
    });
    fireEvent.click(screen.getByText(/Mark disputed/i));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/cannot be disputed/i);
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
