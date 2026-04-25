/**
 * HASEEB-471 — JournalEntryCard edit-mode expansion tests.
 *
 * Scope (per the spec):
 *   (1) Click account area in edit mode opens the AccountPicker.
 *   (2) Picking an account updates the targeted line's `account` + `code`.
 *   (3) Click DR/CR swap → debit/credit swap; only the originally-non-null
 *       side's value carries over to the other side.
 *   (4) Click Add line → new placeholder line appended.
 *   (5) Remove × is hidden when only 2 lines are present.
 *   (6) Remove × removes the correct line when lines.length > 2.
 *   (7) Save is disabled when any placeholder remains.
 *   (8) Save is disabled when totals don't balance.
 *   (9) Save calls onSaveEdit(payload) with valid balanced shape where
 *       every line has a non-null accountCode.
 *
 * The parent passes `onSaveEdit` which both gates entry into edit mode
 * (see JournalEntryCard lines ~715-720) and receives the final payload.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent, act } from '@testing-library/react';
import React from 'react';

// AccountPicker loads the chart via mockEngine.getChartOfAccounts; we
// stub a tiny CoA so the picker has deterministic rows to click.
vi.mock('../../src/engine/mockEngine', async (importOriginal) => {
  const mod = await importOriginal();
  return {
    ...mod,
    getChartOfAccounts: vi.fn(async () => [
      { code: '5200', name: 'Office Supplies Expense', category: 'Operating Expenses' },
      { code: '5100', name: 'Repairs & Maintenance', category: 'Operating Expenses' },
      { code: '1000', name: 'Cash on Hand', category: 'Assets' },
      { code: '1100', name: 'Bank - KFH', category: 'Assets' },
    ]),
  };
});

import JournalEntryCard from '../../src/components/cfo/JournalEntryCard';
import i18n from '../../src/i18n';
import { LanguageProvider } from '../../src/i18n/LanguageContext';

function renderCard(overrides = {}) {
  const defaultEntry = {
    id: 'JE-TEST-1',
    createdAt: new Date().toISOString(),
    description: 'Test entry',
    mappingVersion: 'v1',
    totalDebit: 30,
    totalCredit: 30,
    balanced: true,
    lines: [
      {
        account: 'Cleaning Expense',
        code: '5300',
        debit: '30.000',
        credit: null,
        label: 'cleaning',
      },
      {
        account: 'Cash on Hand',
        code: '1000',
        debit: null,
        credit: '30.000',
        label: 'cash',
      },
    ],
  };
  const props = {
    entry: overrides.entry || defaultEntry,
    state: overrides.state || 'draft-validated',
    onSaveEdit: overrides.onSaveEdit || vi.fn(),
    onConfirm: overrides.onConfirm || vi.fn(),
    onDiscard: overrides.onDiscard || vi.fn(),
  };
  return {
    ...render(
      <LanguageProvider>
        <JournalEntryCard {...props} />
      </LanguageProvider>,
    ),
    props,
  };
}

async function enterEditMode() {
  // "Edit" button is the fallback from HASEEB-307 path; with onSaveEdit
  // present it toggles isEditing rather than calling onEdit.
  const editBtn = screen.getByRole('button', { name: /^Edit$/i });
  await act(async () => {
    fireEvent.click(editBtn);
  });
}

beforeEach(async () => {
  await act(async () => {
    await i18n.changeLanguage('en');
  });
});

afterEach(() => {
  cleanup();
});

describe('HASEEB-471 — JournalEntryCard edit-mode expansion', () => {
  it('(1) clicking the account area in edit mode opens the AccountPicker', async () => {
    renderCard();
    await enterEditMode();

    // Now each non-placeholder line has an aria-label "Change account" button.
    const changeBtns = screen.getAllByRole('button', { name: /Change account/i });
    expect(changeBtns.length).toBe(2);

    await act(async () => {
      fireEvent.click(changeBtns[0]);
    });

    // AccountPicker's search input appears (its placeholder is in
    // account_picker.search_placeholder).
    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/Search accounts by name or code/i),
      ).toBeInTheDocument();
    });
  });

  it('(2) picking an account updates the line account + code', async () => {
    const onSaveEdit = vi.fn();
    renderCard({ onSaveEdit });
    await enterEditMode();

    const changeBtns = screen.getAllByRole('button', { name: /Change account/i });
    await act(async () => {
      fireEvent.click(changeBtns[0]);
    });

    // AccountPicker opens the dropdown on input focus.
    const picker = await screen.findByPlaceholderText(/Search accounts by name or code/i);
    await act(async () => {
      fireEvent.focus(picker);
    });

    // Wait for the picker rows to load (getChartOfAccounts is async) and
    // for the dropdown to render the mocked account rows.
    await waitFor(() => {
      expect(screen.getByText(/Office Supplies Expense/i)).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText(/Office Supplies Expense/i));
    });

    // Line 1 account display now reads "Office Supplies Expense" with code 5200.
    expect(screen.getByText('Office Supplies Expense')).toBeInTheDocument();
    expect(screen.getByText(/\(5200\)/)).toBeInTheDocument();

    // Save and confirm the payload carries the new code on line 0.
    const saveBtn = screen.getByRole('button', { name: /Save changes/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });
    expect(onSaveEdit).toHaveBeenCalledTimes(1);
    const payload = onSaveEdit.mock.calls[0][0];
    expect(payload.lines[0].accountCode).toBe('5200');
    expect(payload.lines[0].accountName).toBe('Office Supplies Expense');
  });

  it('(3) clicking DR ⇄ CR swaps debit and credit on that line', async () => {
    const onSaveEdit = vi.fn();
    renderCard({ onSaveEdit });
    await enterEditMode();

    // Swap line 0 (was debit 30, credit null → should become debit null, credit 30).
    const swapBtns = screen.getAllByRole('button', { name: /Swap DR\/CR/i });
    expect(swapBtns.length).toBe(2);
    await act(async () => {
      fireEvent.click(swapBtns[0]);
    });

    // Line 0's debit side should now show "—" and credit side a 30 input.
    // Line 1 also needs swap to rebalance (original: credit 30; after user
    // swap of line 0, totals would break) — swap it too for the save test.
    const swapBtnsAfter = screen.getAllByRole('button', { name: /Swap DR\/CR/i });
    await act(async () => {
      fireEvent.click(swapBtnsAfter[1]);
    });

    // Both lines swapped. Save and inspect payload.
    const saveBtn = screen.getByRole('button', { name: /Save changes/i });
    await act(async () => {
      fireEvent.click(saveBtn);
    });
    expect(onSaveEdit).toHaveBeenCalledTimes(1);
    const payload = onSaveEdit.mock.calls[0][0];
    // Line 0 was debit 30 → now credit 30.
    expect(payload.lines[0].credit).toBe('30.000');
    expect(payload.lines[0].debit).toBe('0.000');
    // Line 1 was credit 30 → now debit 30.
    expect(payload.lines[1].debit).toBe('30.000');
    expect(payload.lines[1].credit).toBe('0.000');
  });

  it('(4) clicking Add line appends a placeholder line', async () => {
    renderCard();
    await enterEditMode();

    // Initially 2 lines → no remove × visible.
    expect(screen.queryAllByRole('button', { name: /Remove line/i })).toHaveLength(0);

    const addBtn = screen.getByRole('button', { name: /Add line/i });
    await act(async () => {
      fireEvent.click(addBtn);
    });

    // A placeholder "Select account" button now renders for the new line.
    expect(screen.getByRole('button', { name: /Select account/i })).toBeInTheDocument();

    // Now 3 lines → remove × appears on all three.
    expect(screen.queryAllByRole('button', { name: /Remove line/i })).toHaveLength(3);
  });

  it('(5) Remove × is hidden when only 2 lines remain', async () => {
    renderCard();
    await enterEditMode();
    // Initial render: 2 lines; remove × should not be visible.
    expect(screen.queryAllByRole('button', { name: /Remove line/i })).toHaveLength(0);
  });

  it('(6) Remove × removes the correct line when lines.length > 2', async () => {
    renderCard();
    await enterEditMode();

    // Add a third line so remove becomes available.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Add line/i }));
    });

    let removeBtns = screen.getAllByRole('button', { name: /Remove line/i });
    expect(removeBtns).toHaveLength(3);

    // Remove the middle line (index 1 — Cash on Hand).
    await act(async () => {
      fireEvent.click(removeBtns[1]);
    });

    // Cash on Hand's display text should be gone; Cleaning Expense stays.
    expect(screen.queryByText('Cash on Hand')).not.toBeInTheDocument();
    expect(screen.getByText('Cleaning Expense')).toBeInTheDocument();

    // Line count back to 2 → remove × hidden again.
    removeBtns = screen.queryAllByRole('button', { name: /Remove line/i });
    expect(removeBtns).toHaveLength(0);
  });

  it('(7) Save is disabled when any placeholder line remains', async () => {
    renderCard();
    await enterEditMode();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Add line/i }));
    });

    const saveBtn = screen.getByRole('button', { name: /Save changes/i });
    expect(saveBtn.disabled).toBe(true);
    // Inline message references line 3 (1-indexed) since the new line
    // is index 2.
    expect(
      screen.getByText(/Select an account for line 3/i),
    ).toBeInTheDocument();
  });

  it('(8) Save is disabled when debit/credit totals do not balance', async () => {
    renderCard({
      entry: {
        id: 'JE-TEST-UNBAL',
        createdAt: new Date().toISOString(),
        description: 'Unbalanced',
        mappingVersion: 'v1',
        totalDebit: 50,
        totalCredit: 30,
        balanced: false,
        lines: [
          {
            account: 'Cleaning Expense',
            code: '5300',
            debit: '50.000',
            credit: null,
            label: 'x',
          },
          {
            account: 'Cash on Hand',
            code: '1000',
            debit: null,
            credit: '30.000',
            label: 'y',
          },
        ],
      },
    });
    await enterEditMode();

    const saveBtn = screen.getByRole('button', { name: /Save changes/i });
    expect(saveBtn.disabled).toBe(true);
    expect(
      screen.getByText(/Debit and credit totals must match/i),
    ).toBeInTheDocument();
  });

  it('(9) Save calls onSaveEdit with a balanced payload where every line has a code', async () => {
    const onSaveEdit = vi.fn();
    renderCard({ onSaveEdit });
    await enterEditMode();

    // Balanced default entry → save should succeed and pass valid shape.
    const saveBtn = screen.getByRole('button', { name: /Save changes/i });
    expect(saveBtn.disabled).toBe(false);

    await act(async () => {
      fireEvent.click(saveBtn);
    });

    expect(onSaveEdit).toHaveBeenCalledTimes(1);
    const payload = onSaveEdit.mock.calls[0][0];
    expect(payload).toHaveProperty('description');
    expect(payload).toHaveProperty('lines');
    expect(Array.isArray(payload.lines)).toBe(true);
    expect(payload.lines).toHaveLength(2);
    for (const line of payload.lines) {
      expect(line.accountCode).toBeTruthy();
      expect(typeof line.debit).toBe('string');
      expect(typeof line.credit).toBe('string');
    }
    // Totals match within 0.001.
    const sumD = payload.lines.reduce((s, l) => s + Number(l.debit), 0);
    const sumC = payload.lines.reduce((s, l) => s + Number(l.credit), 0);
    expect(Math.abs(sumD - sumC)).toBeLessThan(0.001);
  });
});
