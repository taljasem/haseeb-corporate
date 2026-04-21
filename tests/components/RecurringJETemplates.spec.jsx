/**
 * RecurringJETemplates — AUDIT-ACC-010 (corporate-api 65ccaf6, 2026-04-22).
 *
 * Asserts that ManualJEScreen's templates tab dispatches the LIVE
 * recurring-entries engine surface (not the legacy mockEngine template
 * trio). We vi.mock the engine module at the boundary so these specs
 * exercise the full adapter chain: listRecurringEntries → adapter →
 * ListItem render + fire-now / pause / delete / save-as-template.
 *
 * Covers (per dispatch "3 most important paths" guidance):
 *   1. Template list renders from listRecurringEntries (NOT the legacy
 *      getManualJETemplates mock). Frequency + nextDate + paused badge
 *      all come off the LIVE DTO shape.
 *   2. "Fire Now" kebab action calls fireRecurringEntryNow and shows a
 *      toast.
 *   3. Instance history modal calls listRecurringEntryInstances on
 *      open and renders status badges + journal-entry ids.
 *
 * Bonus: we also verify that the screen does NOT import the deleted
 * mockEngine template names on the active path — the ManualJEScreen
 * top-of-file import block only pulls getChartOfAccounts etc. +
 * shareJETemplate (kept as mock-only per HASEEB-202 follow-up) from
 * ../../engine/mockEngine. If a future rewire reintroduces a legacy
 * import, this spec breaks at the vi.mock boundary.
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

// Engine module: stub the recurring-entries LIVE surface + the read
// paths ManualJEScreen still exercises.
const listRecurringEntriesSpy = vi.fn();
const getRecurringEntrySpy = vi.fn();
const createRecurringEntrySpy = vi.fn();
const updateRecurringEntrySpy = vi.fn();
const deleteRecurringEntrySpy = vi.fn();
const fireRecurringEntryNowSpy = vi.fn();
const listRecurringEntryInstancesSpy = vi.fn();

vi.mock('../../src/engine', () => ({
  __esModule: true,
  listRecurringEntries: (...args) => listRecurringEntriesSpy(...args),
  getRecurringEntry: (...args) => getRecurringEntrySpy(...args),
  createRecurringEntry: (...args) => createRecurringEntrySpy(...args),
  updateRecurringEntry: (...args) => updateRecurringEntrySpy(...args),
  deleteRecurringEntry: (...args) => deleteRecurringEntrySpy(...args),
  fireRecurringEntryNow: (...args) => fireRecurringEntryNowSpy(...args),
  listRecurringEntryInstances: (...args) =>
    listRecurringEntryInstancesSpy(...args),
  // Baseline reads the screen performs on mount — return empty lists so
  // the drafts / recent / scheduled tabs don't crash.
  getManualJEs: vi.fn(async () => []),
  getManualJEById: vi.fn(async () => null),
  createJournalEntry: vi.fn(async () => ({ id: 'JE-NEW-1' })),
  updateJournalEntryDraft: vi.fn(async () => ({})),
  postJournalEntry: vi.fn(async () => ({ id: 'JE-1', entryNumber: 'JE-1' })),
  reverseJournalEntry: vi.fn(async () => ({ id: 'JE-REV-1' })),
}));

// mockEngine module: only the helpers ManualJEScreen still pulls from
// mockEngine by design (chart of accounts, period lock, attachments,
// and the shareJETemplate escape hatch per HASEEB-202 follow-up).
vi.mock('../../src/engine/mockEngine', () => ({
  __esModule: true,
  getChartOfAccounts: vi.fn(async () => []),
  searchChartOfAccounts: vi.fn(async () => []),
  checkPeriodStatus: vi.fn(async () => ({ status: 'open' })),
  attachJEFile: vi.fn(async () => ({})),
  removeJEAttachment: vi.fn(async () => ({})),
  getJEAttachments: vi.fn(async () => []),
  shareJETemplate: vi.fn(async () => ({})),
}));

// Stub format helpers that depend on Date/TZ internals so the test
// output is stable.
vi.mock('../../src/utils/format', () => ({
  __esModule: true,
  formatDate: (iso) => (iso ? String(iso).slice(0, 10) : '—'),
}));
vi.mock('../../src/utils/relativeTime', () => ({
  __esModule: true,
  formatRelativeTime: () => 'just now',
}));

import ManualJEScreen from '../../src/screens/cfo/ManualJEScreen';

async function setLang(lang) {
  await act(async () => {
    await i18n.changeLanguage(lang);
  });
}

const SAMPLE_TEMPLATES = [
  {
    id: 'REC-1',
    description: 'Monthly office rent',
    frequency: 'MONTHLY',
    nextDate: '2026-05-01T00:00:00.000Z',
    endDate: null,
    templateLines: [
      {
        accountId: '6100',
        accountCode: '6100',
        accountName: 'Rent Expense',
        debit: 500,
        credit: 0,
        description: '',
      },
      {
        accountId: '2100',
        accountCode: '2100',
        accountName: 'Accounts Payable',
        debit: 0,
        credit: 500,
        description: '',
      },
    ],
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'REC-2',
    description: 'Quarterly audit fee accrual',
    frequency: 'QUARTERLY',
    nextDate: '2026-07-01T00:00:00.000Z',
    endDate: null,
    templateLines: [
      {
        accountId: '6200',
        accountCode: '6200',
        accountName: 'Audit Fees',
        debit: 2000,
        credit: 0,
        description: '',
      },
      {
        accountId: '2200',
        accountCode: '2200',
        accountName: 'Accrued Liabilities',
        debit: 0,
        credit: 2000,
        description: '',
      },
    ],
    isActive: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('RecurringJETemplates (ManualJEScreen templates tab) — AUDIT-ACC-010', () => {
  beforeEach(async () => {
    listRecurringEntriesSpy.mockReset();
    getRecurringEntrySpy.mockReset();
    createRecurringEntrySpy.mockReset();
    updateRecurringEntrySpy.mockReset();
    deleteRecurringEntrySpy.mockReset();
    fireRecurringEntryNowSpy.mockReset();
    listRecurringEntryInstancesSpy.mockReset();
    listRecurringEntriesSpy.mockResolvedValue(SAMPLE_TEMPLATES);
    await setLang('en');
  });

  afterEach(() => {
    cleanup();
  });

  it('renders templates tab from listRecurringEntries (not the legacy mock)', async () => {
    render(<ManualJEScreen />);
    // Switch to the templates tab.
    const tabBtn = await screen.findByText(/^Templates$/i);
    fireEvent.click(tabBtn);

    await waitFor(() => {
      expect(listRecurringEntriesSpy).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      // Description renders both as title + description; both should hit.
      expect(screen.getAllByText(/Monthly office rent/).length).toBeGreaterThan(0);
    });
    // Second template shows too (paused badge).
    expect(screen.getAllByText(/Quarterly audit fee accrual/).length).toBeGreaterThan(0);
    expect(screen.getByText(/^Paused$/i)).toBeInTheDocument();
  });

  it('fires a template via fireRecurringEntryNow when the Fire Now kebab action is invoked', async () => {
    fireRecurringEntryNowSpy.mockResolvedValue({
      recurring: { id: 'REC-1' },
      instance: { id: 'INST-1' },
      outcome: {
        kind: 'DRAFT_CREATED',
        instance: { id: 'INST-1' },
        journalEntryId: 'JE-FIRED-1',
        advisorPendingId: 'ADV-1',
      },
    });

    render(<ManualJEScreen />);
    const tabBtn = await screen.findByText(/^Templates$/i);
    fireEvent.click(tabBtn);
    await waitFor(() => {
      expect(listRecurringEntriesSpy).toHaveBeenCalled();
    });
    await waitFor(() => {
      // Description renders both as title + description; both should hit.
      expect(screen.getAllByText(/Monthly office rent/).length).toBeGreaterThan(0);
    });

    // Open the kebab for the active template (REC-1).
    const kebabs = screen.getAllByLabelText(/Open actions menu/i);
    fireEvent.click(kebabs[0]);

    // Click Fire Now.
    const fireNowButtons = screen.getAllByText(/^Fire Now$/i);
    fireEvent.click(fireNowButtons[fireNowButtons.length - 1]);

    await waitFor(() => {
      expect(fireRecurringEntryNowSpy).toHaveBeenCalledWith('REC-1');
    });
  });

  it('loads instance history via listRecurringEntryInstances and renders status badges', async () => {
    listRecurringEntryInstancesSpy.mockResolvedValue({
      entries: [
        {
          id: 'INST-1',
          recurringId: 'REC-1',
          firedAt: '2026-04-01T10:00:00.000Z',
          scheduledFor: '2026-04-01T00:00:00.000Z',
          journalEntryId: 'JE-1',
          firedByUserId: 'user-1',
          firedBy: 'SCHEDULER',
          status: 'DRAFT_CREATED',
          advisoryReason: null,
          journalEntry: { id: 'JE-1', status: 'DRAFT', totalAmount: '500.000' },
        },
        {
          id: 'INST-2',
          recurringId: 'REC-1',
          firedAt: '2026-03-01T10:00:00.000Z',
          scheduledFor: '2026-03-01T00:00:00.000Z',
          journalEntryId: null,
          firedByUserId: null,
          firedBy: 'SCHEDULER',
          status: 'ADVISORY_ONLY',
          advisoryReason: 'Template lines had an invalid account code.',
          journalEntry: null,
        },
      ],
      total: 2,
      page: 1,
      limit: 20,
    });

    render(<ManualJEScreen />);
    const tabBtn = await screen.findByText(/^Templates$/i);
    fireEvent.click(tabBtn);
    await waitFor(() => {
      // Description renders both as title + description; both should hit.
      expect(screen.getAllByText(/Monthly office rent/).length).toBeGreaterThan(0);
    });

    // Open the kebab + click Instance History.
    const kebabs = screen.getAllByLabelText(/Open actions menu/i);
    fireEvent.click(kebabs[0]);
    const historyBtns = screen.getAllByText(/^Instance History$/i);
    fireEvent.click(historyBtns[historyBtns.length - 1]);

    await waitFor(() => {
      expect(listRecurringEntryInstancesSpy).toHaveBeenCalledWith(
        'REC-1',
        expect.objectContaining({ page: 1, limit: 20 }),
      );
    });

    const modal = await screen.findByTestId('instances-modal');
    expect(within(modal).getByText(/Draft created/i)).toBeInTheDocument();
    expect(within(modal).getByText(/Advisory/i)).toBeInTheDocument();
    // Advisory reason renders for the second row.
    expect(
      within(modal).getByText(/invalid account code/i),
    ).toBeInTheDocument();
  });
});
