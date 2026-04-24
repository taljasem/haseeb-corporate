/**
 * ManualJEScreen — Source dropdown enum case (HASEEB-466).
 *
 * Regression for the P0 blocker where the Source dropdown sent
 * lowercase values ("manual", "recurring") to the backend, which
 * rejected them against the Prisma `EntrySource` enum (uppercase
 * MANUAL / RECURRING / ...) and prevented manual JE save.
 *
 * Asserts:
 *   1. The Source <select>'s options match the backend EntrySource
 *      enum spelling exactly (uppercase). No lowercase legacy values.
 *   2. The default value of the dropdown when a fresh blank draft is
 *      composed is "MANUAL", not "manual".
 *   3. When the operator clicks "Save Draft", the createJournalEntry
 *      payload passes `source: "MANUAL"` to the API write layer.
 *
 * The boundary mocked is the engine module (which the screen imports
 * for both reads and writes). The createJournalEntry spy captures the
 * exact payload that would hit /api/journal-entries.
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

const createJournalEntrySpy = vi.fn();
const updateJournalEntryDraftSpy = vi.fn();
const postJournalEntrySpy = vi.fn();
const reverseJournalEntrySpy = vi.fn();
const listRecurringEntriesSpy = vi.fn();

vi.mock('../../src/engine', () => ({
  __esModule: true,
  // Reads ManualJEScreen performs on mount — return empty so tabs
  // render without crashing.
  getManualJEs: vi.fn(async () => []),
  getManualJEById: vi.fn(async () => null),
  // Writes — the spy captures the payload we care about.
  createJournalEntry: (...args) => createJournalEntrySpy(...args),
  updateJournalEntryDraft: (...args) => updateJournalEntryDraftSpy(...args),
  postJournalEntry: (...args) => postJournalEntrySpy(...args),
  reverseJournalEntry: (...args) => reverseJournalEntrySpy(...args),
  // Recurring-entries surface — empty list for the templates tab.
  listRecurringEntries: (...args) => listRecurringEntriesSpy(...args),
  getRecurringEntry: vi.fn(async () => null),
  createRecurringEntry: vi.fn(async () => ({})),
  updateRecurringEntry: vi.fn(async () => ({})),
  deleteRecurringEntry: vi.fn(async () => ({})),
  fireRecurringEntryNow: vi.fn(async () => ({})),
  listRecurringEntryInstances: vi.fn(async () => ({ entries: [], total: 0 })),
  // COA + period-status + attachments — also imported from the engine
  // router per HASEEB-278. Stubbed to no-ops.
  getChartOfAccounts: vi.fn(async () => [
    { code: '6200', name: 'Office Rent', type: 'expense' },
    { code: '1120', name: 'KIB Operating Account', type: 'asset' },
  ]),
  searchChartOfAccounts: vi.fn(async () => []),
  checkPeriodStatus: vi.fn(async () => ({ status: 'open' })),
  attachJEFile: vi.fn(async () => ({})),
  removeJEAttachment: vi.fn(async () => ({})),
  getJEAttachments: vi.fn(async () => []),
  shareJETemplate: vi.fn(async () => ({})),
}));

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

// EntrySource enum values from the backend Prisma tenant schema —
// kept in sync with prisma/tenant/schema.prisma `enum EntrySource`.
// If the backend adds new sources, this list is still valid (the test
// only asserts that any rendered option value is a SUBSET of the
// backend enum, not that every backend value is in the dropdown).
const VALID_ENTRY_SOURCE_VALUES = new Set([
  'MANUAL',
  'HASEEB_AI',
  'INVOICE',
  'CREDIT_NOTE',
  'PAYMENT',
  'BANK_IMPORT',
  'RECURRING',
  'API',
  'BILL',
  'BILL_PAYMENT',
  'DEPRECIATION',
  'PAYROLL',
  'EOS_ACCRUAL',
  'FX_REVALUATION',
  'INVENTORY',
  'RESTATEMENT',
  'YEAR_END_CLOSE',
  'MANUAL_MIGRATION',
]);

describe('ManualJEScreen — Source dropdown enum case (HASEEB-466)', () => {
  beforeEach(async () => {
    createJournalEntrySpy.mockReset();
    updateJournalEntryDraftSpy.mockReset();
    postJournalEntrySpy.mockReset();
    reverseJournalEntrySpy.mockReset();
    listRecurringEntriesSpy.mockReset();
    listRecurringEntriesSpy.mockResolvedValue([]);
    createJournalEntrySpy.mockResolvedValue({
      id: 'JE-NEW-1',
      entryNumber: 'JE-NEW-1',
    });
    await setLang('en');
  });

  afterEach(() => {
    cleanup();
  });

  it('renders source <option> values that exactly match the backend EntrySource enum', async () => {
    render(<ManualJEScreen />);
    // Click "New blank" to mount the composer.
    const newBlankButtons = await screen.findAllByText(/Blank entry/i);
    fireEvent.click(newBlankButtons[0]);

    // The composer's Source <select> is the only <select> on the screen
    // labelled by the SOURCE field heading. Find by role.
    const selects = await screen.findAllByRole('combobox');
    expect(selects.length).toBeGreaterThan(0);
    // The Source select sits in the metadata grid; pick the one whose
    // options include a "Manual" label.
    const sourceSelect = selects.find((sel) =>
      Array.from(sel.querySelectorAll('option')).some((o) =>
        /Manual/i.test(o.textContent || '')
      )
    );
    expect(sourceSelect, 'Source dropdown not found').toBeTruthy();

    const optionValues = Array.from(
      sourceSelect.querySelectorAll('option')
    ).map((o) => o.getAttribute('value'));

    expect(optionValues.length).toBeGreaterThan(0);
    // No legacy lowercase values — the P0 regression guard.
    for (const v of optionValues) {
      expect(v).toBe(String(v).toUpperCase());
      expect(VALID_ENTRY_SOURCE_VALUES.has(v)).toBe(true);
    }
    // The composer's default selection is MANUAL.
    expect(sourceSelect.value).toBe('MANUAL');
  });

  it('sends `source: "MANUAL"` (not "manual") to createJournalEntry on Save Draft', async () => {
    render(<ManualJEScreen />);
    const newBlankButtons = await screen.findAllByText(/Blank entry/i);
    fireEvent.click(newBlankButtons[0]);

    // Fill two balancing lines so canPost gates Save Draft (which
    // is enabled on draft regardless, but the payload filter requires
    // accountCode + a non-zero debit/credit per line).
    const accountInputs = await screen.findAllByPlaceholderText(/account/i);
    expect(accountInputs.length).toBeGreaterThanOrEqual(2);
    fireEvent.change(accountInputs[0], { target: { value: '6200' } });
    fireEvent.change(accountInputs[1], { target: { value: '1120' } });

    const numericInputs = screen
      .getAllByRole('spinbutton')
      // Filter out anything other than the debit/credit cells (debit on
      // line 1, credit on line 2).
      .filter((el) => el.tagName === 'INPUT');
    // Heuristic: the first numeric input is debit on L1, the fourth is
    // credit on L2 (debit/credit columns alternate). Tolerate slack.
    if (numericInputs.length >= 4) {
      fireEvent.change(numericInputs[0], { target: { value: '100' } });
      fireEvent.change(numericInputs[3], { target: { value: '100' } });
    }

    // Click Save Draft.
    const saveDraft = await screen.findByText(/Save draft/i);
    fireEvent.click(saveDraft);

    await waitFor(() => {
      expect(createJournalEntrySpy).toHaveBeenCalled();
    });
    const payload = createJournalEntrySpy.mock.calls[0][0];
    // The P0 contract: source is the uppercase backend enum spelling.
    expect(payload.source).toBe('MANUAL');
    expect(payload.source).not.toBe('manual');
  });
});
