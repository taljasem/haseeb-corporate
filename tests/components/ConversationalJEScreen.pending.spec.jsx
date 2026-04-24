/**
 * HASEEB-406 — ConversationalJEScreen multi-pending UI tests.
 *
 * Covers:
 *   (1) On mount, getPendingEntries is called and each returned row
 *       renders as a persistent card with Confirm / Edit / Cancel.
 *   (2) Clicking Confirm on a specific card calls confirmPendingAction
 *       with that card's confirmationId and removes the card.
 *   (3) Clicking Cancel on a specific card calls cancelPendingEntry
 *       with that card's confirmationId and removes the card.
 *   (4) A 410 PENDING_EXPIRED from cancel surfaces a bilingual "entry
 *       expired" message and drops the stale card from the list.
 *   (5) A 409 STALE_CONFIRMATION from confirm surfaces "already
 *       processed" and drops the stale card.
 *   (6) The Edit button renders but is disabled with a "coming soon"
 *       tooltip (design anticipates it but wiring is out of scope).
 *   (7) In Arabic the Confirm / Edit / Cancel labels are the Arabic
 *       translations.
 *
 * The engine module is mocked so we don't depend on MOCK-mode's
 * empty-list stub. Each test sets up its own pending-list return value
 * and asserts the dispatched calls.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent, act } from '@testing-library/react';
import React from 'react';

// ── Mock the engine BEFORE importing the screen ──────────────────────
vi.mock('../../src/engine', () => {
  return {
    sendChatMessage: vi.fn(),
    confirmPendingAction: vi.fn(),
    getConversationMessages: vi.fn(async () => []),
    getPendingEntries: vi.fn(async () => []),
    cancelPendingEntry: vi.fn(async () => ({ status: 'CANCELLED' })),
  };
});

import ConversationalJEScreen from '../../src/screens/cfo/ConversationalJEScreen';
import {
  getPendingEntries,
  cancelPendingEntry,
  confirmPendingAction,
} from '../../src/engine';
import i18n from '../../src/i18n';
import { LanguageProvider } from '../../src/i18n/LanguageContext';

function renderScreen(props = { role: 'CFO' }) {
  return render(
    <LanguageProvider>
      <ConversationalJEScreen {...props} />
    </LanguageProvider>,
  );
}

function makePendingRow({
  confirmationId,
  description,
  userMessage,
  lines,
  createdAt,
  expiresAt,
}) {
  return {
    id: `row-${confirmationId}`,
    confirmationId,
    conversationId: null,
    status: 'PENDING',
    transactionType: 'journal_entry',
    userMessage: userMessage ?? null,
    entryData: {
      confirmationId,
      type: 'journal_entry',
      data: {
        description,
        lines: lines || [],
      },
      createdAt: createdAt || new Date().toISOString(),
    },
    createdAt: createdAt || new Date().toISOString(),
    expiresAt:
      expiresAt ||
      new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
  };
}

async function setLang(lang) {
  await act(async () => {
    await i18n.changeLanguage(lang);
  });
}

beforeEach(async () => {
  vi.mocked(getPendingEntries).mockReset();
  vi.mocked(cancelPendingEntry).mockReset();
  vi.mocked(confirmPendingAction).mockReset();
  await setLang('en');
});

afterEach(() => {
  cleanup();
});

describe('HASEEB-406 — ConversationalJEScreen multi-pending UI', () => {
  it('(1) renders a persistent card per pending row returned by getPendingEntries', async () => {
    vi.mocked(getPendingEntries).mockResolvedValue([
      makePendingRow({
        confirmationId: 'c-alpha',
        description: 'Cash payment for cleaning',
        userMessage: 'paid cleaner 30 KWD cash',
        lines: [
          { accountCode: '6000', accountName: 'Cleaning Expense', debit: 30, credit: 0 },
          { accountCode: '1000', accountName: 'Cash', debit: 0, credit: 30 },
        ],
      }),
      makePendingRow({
        confirmationId: 'c-beta',
        description: 'Office supplies',
        userMessage: 'office supplies 50 KWD',
        lines: [
          { accountCode: '6100', accountName: 'Office Supplies', debit: 50, credit: 0 },
          { accountCode: '1000', accountName: 'Cash', debit: 0, credit: 50 },
        ],
      }),
    ]);

    renderScreen({ role: 'CFO' });

    await waitFor(() => {
      expect(screen.getByTestId('pending-card-c-alpha')).toBeInTheDocument();
      expect(screen.getByTestId('pending-card-c-beta')).toBeInTheDocument();
    });

    // Both cards rendered their description + userMessage.
    expect(screen.getByText('Cash payment for cleaning')).toBeInTheDocument();
    expect(screen.getByText('Office supplies')).toBeInTheDocument();
    // userMessage renders wrapped in curly-quotes — assert by substring.
    expect(screen.getByText(/paid cleaner 30 KWD cash/)).toBeInTheDocument();

    // Each card has Confirm / Edit / Cancel buttons.
    const cardAlpha = screen.getByTestId('pending-card-c-alpha');
    expect(cardAlpha.querySelector('button[aria-label="Confirm"]')).toBeTruthy();
    expect(cardAlpha.querySelector('button[aria-label="Edit"]')).toBeTruthy();
    expect(cardAlpha.querySelector('button[aria-label="Cancel"]')).toBeTruthy();
  });

  it('(2) clicking Confirm on a specific card calls confirmPendingAction with that card’s confirmationId and removes it', async () => {
    const rowAlpha = makePendingRow({
      confirmationId: 'c-alpha',
      description: 'Entry A',
      userMessage: 'entry a',
      lines: [{ accountCode: '1', accountName: 'X', debit: 10, credit: 0 }],
    });
    const rowBeta = makePendingRow({
      confirmationId: 'c-beta',
      description: 'Entry B',
      userMessage: 'entry b',
      lines: [{ accountCode: '2', accountName: 'Y', debit: 20, credit: 0 }],
    });
    // First call (mount) returns both rows. All subsequent calls (the
    // refresh fired after confirm) return only the remaining row —
    // mirrors the real server's CONFIRMED transition.
    vi.mocked(getPendingEntries)
      .mockResolvedValueOnce([rowAlpha, rowBeta])
      .mockResolvedValue([rowBeta]);
    vi.mocked(confirmPendingAction).mockResolvedValue({
      message: 'posted',
      success: true,
      journalEntry: { entryNumber: 42 },
    });

    renderScreen({ role: 'CFO' });

    await waitFor(() => {
      expect(screen.getByTestId('pending-card-c-alpha')).toBeInTheDocument();
      expect(screen.getByTestId('pending-card-c-beta')).toBeInTheDocument();
    });

    const cardAlpha = screen.getByTestId('pending-card-c-alpha');
    const confirmBtn = cardAlpha.querySelector('button[aria-label="Confirm"]');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(confirmPendingAction).toHaveBeenCalledTimes(1);
    });
    const call = vi.mocked(confirmPendingAction).mock.calls[0][0];
    expect(call).toMatchObject({ confirmationId: 'c-alpha', action: 'confirm' });

    // Optimistic removal — the alpha card is gone, beta stays.
    await waitFor(() => {
      expect(screen.queryByTestId('pending-card-c-alpha')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('pending-card-c-beta')).toBeInTheDocument();
  });

  it('(3) clicking Cancel on a specific card calls cancelPendingEntry with that card’s confirmationId and removes it', async () => {
    const rowAlpha = makePendingRow({
      confirmationId: 'c-alpha',
      description: 'A',
      userMessage: 'a',
      lines: [{ accountCode: '1', accountName: 'X', debit: 5, credit: 0 }],
    });
    const rowBeta = makePendingRow({
      confirmationId: 'c-beta',
      description: 'B',
      userMessage: 'b',
      lines: [{ accountCode: '2', accountName: 'Y', debit: 6, credit: 0 }],
    });
    vi.mocked(getPendingEntries)
      .mockResolvedValueOnce([rowAlpha, rowBeta])
      .mockResolvedValue([rowAlpha]);
    vi.mocked(cancelPendingEntry).mockResolvedValue({ status: 'CANCELLED' });

    renderScreen({ role: 'CFO' });

    await waitFor(() => {
      expect(screen.getByTestId('pending-card-c-beta')).toBeInTheDocument();
    });

    const cardBeta = screen.getByTestId('pending-card-c-beta');
    const cancelBtn = cardBeta.querySelector('button[aria-label="Cancel"]');
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(cancelPendingEntry).toHaveBeenCalledWith('c-beta');
    });

    await waitFor(() => {
      expect(screen.queryByTestId('pending-card-c-beta')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('pending-card-c-alpha')).toBeInTheDocument();
  });

  it('(4) a 410 PENDING_EXPIRED on cancel shows the expired message and drops the stale card', async () => {
    const staleRow = makePendingRow({
      confirmationId: 'c-stale',
      description: 'stale',
      userMessage: 'stale',
      lines: [{ accountCode: '1', accountName: 'X', debit: 1, credit: 0 }],
    });
    // Mount returns the stale row; refresh (after 410) returns empty,
    // mirroring the server having transitioned it away.
    vi.mocked(getPendingEntries)
      .mockResolvedValueOnce([staleRow])
      .mockResolvedValue([]);
    vi.mocked(cancelPendingEntry).mockRejectedValue({
      ok: false,
      status: 410,
      code: 'CLIENT_ERROR',
      message: 'Pending entry expired',
    });

    renderScreen({ role: 'CFO' });

    await waitFor(() => {
      expect(screen.getByTestId('pending-card-c-stale')).toBeInTheDocument();
    });

    const card = screen.getByTestId('pending-card-c-stale');
    fireEvent.click(card.querySelector('button[aria-label="Cancel"]'));

    await waitFor(() => {
      expect(screen.queryByTestId('pending-card-c-stale')).not.toBeInTheDocument();
    });
    // Bilingual expired message surfaces in an error bubble.
    expect(screen.getByText(/Entry expired\. Please re-enter\./)).toBeInTheDocument();
  });

  it('(5) a 409 STALE_CONFIRMATION on confirm shows "already processed" and drops the stale card', async () => {
    const staleRow = makePendingRow({
      confirmationId: 'c-stale',
      description: 'stale',
      userMessage: 'stale',
      lines: [{ accountCode: '1', accountName: 'X', debit: 1, credit: 0 }],
    });
    vi.mocked(getPendingEntries)
      .mockResolvedValueOnce([staleRow])
      .mockResolvedValue([]);
    vi.mocked(confirmPendingAction).mockRejectedValue({
      ok: false,
      status: 409,
      code: 'CLIENT_ERROR',
      message: 'This pending has already been processed',
    });

    renderScreen({ role: 'CFO' });

    await waitFor(() => {
      expect(screen.getByTestId('pending-card-c-stale')).toBeInTheDocument();
    });

    const card = screen.getByTestId('pending-card-c-stale');
    fireEvent.click(card.querySelector('button[aria-label="Confirm"]'));

    await waitFor(() => {
      expect(screen.queryByTestId('pending-card-c-stale')).not.toBeInTheDocument();
    });
    expect(
      screen.getByText(/This entry was already handled/i),
    ).toBeInTheDocument();
  });

  it('(6) the Edit button is rendered but disabled with a "coming soon" tooltip', async () => {
    vi.mocked(getPendingEntries).mockResolvedValue([
      makePendingRow({
        confirmationId: 'c-alpha',
        description: 'A',
        userMessage: 'a',
        lines: [{ accountCode: '1', accountName: 'X', debit: 1, credit: 0 }],
      }),
    ]);

    renderScreen({ role: 'CFO' });

    await waitFor(() => {
      expect(screen.getByTestId('pending-card-c-alpha')).toBeInTheDocument();
    });

    const card = screen.getByTestId('pending-card-c-alpha');
    const editBtn = card.querySelector('button[aria-label="Edit"]');
    expect(editBtn).toBeTruthy();
    expect(editBtn.disabled).toBe(true);
    expect(editBtn.getAttribute('title')).toMatch(/coming soon/i);
  });

  it('(7) Arabic locale — Confirm/Edit/Cancel labels render as the AR translations', async () => {
    await setLang('ar');
    vi.mocked(getPendingEntries).mockResolvedValue([
      makePendingRow({
        confirmationId: 'c-ar',
        description: 'قيد',
        userMessage: 'قيد',
        lines: [{ accountCode: '1', accountName: 'X', debit: 1, credit: 0 }],
      }),
    ]);

    renderScreen({ role: 'CFO' });

    await waitFor(() => {
      expect(screen.getByTestId('pending-card-c-ar')).toBeInTheDocument();
    });

    const card = screen.getByTestId('pending-card-c-ar');
    // AR strings per src/i18n/locales/ar/conv-je.json pending.*
    expect(card.querySelector('button[aria-label="تأكيد"]')).toBeTruthy();
    expect(card.querySelector('button[aria-label="تعديل"]')).toBeTruthy();
    expect(card.querySelector('button[aria-label="إلغاء"]')).toBeTruthy();
  });
});
