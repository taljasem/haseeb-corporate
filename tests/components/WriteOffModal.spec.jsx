/**
 * WriteOffModal — AUDIT-ACC-005 (2026-04-22) regression.
 *
 * Asserts:
 *   1. Submit dispatches via engine.writeOffInvoice (NOT mock createWriteOffJE,
 *      which has been deleted — the vi.mock here will fail import if the
 *      modal still tries to import the old name).
 *   2. Happy path closes modal + fires onSubmitted(result).
 *   3. Reason-minLength-10 validation blocks submit until satisfied.
 *   4. Backend rejection surfaces inline (submitError) without closing.
 *   5. Amount is read-only and shows invoice.outstanding as 3dp KWD.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, act, waitFor } from '@testing-library/react';
import React from 'react';

import i18n from '../../src/i18n';

// Stub the engine module so the component calls our spy.
const writeOffInvoiceSpy = vi.fn();
vi.mock('../../src/engine', () => ({
  __esModule: true,
  writeOffInvoice: (...args) => writeOffInvoiceSpy(...args),
}));

// Suppress the lightweight taskbox event bus side-effect.
vi.mock('../../src/utils/taskboxBus', () => ({
  __esModule: true,
  emitTaskboxChange: () => {},
}));

import WriteOffModal from '../../src/components/aging/WriteOffModal';

async function setLang(lang) {
  await act(async () => { await i18n.changeLanguage(lang); });
}

const SAMPLE_INVOICE = {
  id: 'inv-1',
  invoiceNumber: 'INV-2026-0001',
  partyName: 'Acme Holdings',
  outstanding: 1250.5,
  amount: 1250.5,
};

function renderOpen(overrides = {}) {
  const props = {
    open: true,
    invoice: SAMPLE_INVOICE,
    onClose: vi.fn(),
    onSubmitted: vi.fn(),
    ...overrides,
  };
  const view = render(<WriteOffModal {...props} />);
  return { ...view, ...props };
}

describe('WriteOffModal — AUDIT-ACC-005 rewire', () => {
  beforeEach(async () => {
    writeOffInvoiceSpy.mockReset();
    await setLang('en');
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the amount as a read-only 3dp KWD string and includes the HASEEB-196 hint', () => {
    renderOpen();
    const amountInput = screen.getByDisplayValue('1250.500');
    expect(amountInput).toHaveAttribute('readonly');
    expect(screen.getByText(/Partial write-offs are not available/i)).toBeInTheDocument();
  });

  it('blocks submit until the reason is at least 10 characters', async () => {
    const { onSubmitted } = renderOpen();
    const shortReason = 'short';
    // The textarea is the description; the read-only input shares role=textbox
    // but is disabled from input via `readonly`. Target the last textbox.
    const textboxes = screen.getAllByRole('textbox');
    const description = textboxes[textboxes.length - 1];
    fireEvent.change(description, { target: { value: shortReason } });
    fireEvent.click(screen.getByText(/Post write-off/i));
    // The engine should not have been called.
    expect(writeOffInvoiceSpy).not.toHaveBeenCalled();
    expect(onSubmitted).not.toHaveBeenCalled();
  });

  it('dispatches writeOffInvoice with {reason, effectiveDate, category} on submit', async () => {
    writeOffInvoiceSpy.mockResolvedValue({
      invoice: { id: 'inv-1', status: 'WRITTEN_OFF' },
      writeOff: { id: 'wo-1' },
      journalEntry: { id: 'je-1' },
    });
    const { onSubmitted, onClose } = renderOpen();
    const textboxes = screen.getAllByRole('textbox');
    fireEvent.change(textboxes[textboxes.length - 1], {
      target: { value: 'Customer unreachable after 180d; bad debt write-off' },
    });
    fireEvent.click(screen.getByText(/Post write-off/i));
    await waitFor(() => expect(writeOffInvoiceSpy).toHaveBeenCalledTimes(1));
    const [invoiceId, body] = writeOffInvoiceSpy.mock.calls[0];
    expect(invoiceId).toBe('inv-1');
    expect(body.reason).toMatch(/Customer unreachable/);
    expect(body.category).toBe('bad_debt');
    expect(body.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // Modal closes on success.
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onSubmitted).toHaveBeenCalledTimes(1);
  });

  it('switches category correctly and preserves state through validation', async () => {
    writeOffInvoiceSpy.mockResolvedValue({
      invoice: {}, writeOff: {}, journalEntry: {},
    });
    renderOpen();
    fireEvent.click(screen.getByText(/^Settlement$/i));
    const textboxes = screen.getAllByRole('textbox');
    fireEvent.change(textboxes[textboxes.length - 1], {
      target: { value: 'Resolved via out-of-court settlement' },
    });
    fireEvent.click(screen.getByText(/Post write-off/i));
    await waitFor(() => expect(writeOffInvoiceSpy).toHaveBeenCalled());
    expect(writeOffInvoiceSpy.mock.calls[0][1].category).toBe('settlement');
  });

  it('surfaces backend error inline and keeps modal open on rejection', async () => {
    writeOffInvoiceSpy.mockRejectedValueOnce({
      message: 'Invoice status not eligible for write-off',
      code: 'CLIENT_ERROR',
      status: 409,
    });
    const { onClose } = renderOpen();
    const textboxes = screen.getAllByRole('textbox');
    fireEvent.change(textboxes[textboxes.length - 1], {
      target: { value: 'Attempting write-off on paid invoice' },
    });
    fireEvent.click(screen.getByText(/Post write-off/i));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/not eligible/i);
    });
    // Modal is NOT closed on error.
    expect(onClose).not.toHaveBeenCalled();
  });
});
