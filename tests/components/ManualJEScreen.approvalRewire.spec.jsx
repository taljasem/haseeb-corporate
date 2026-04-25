/**
 * HASEEB-482 (DECISION-026 Phase 2 frontend, 2026-04-24) — Post-button
 * rewire on ManualJEScreen.
 *
 * Coverage:
 *   1. AUTO_APPROVED state hides the Post button (the routing engine
 *      already auto-posted the entry; UI must not offer a redundant
 *      action).
 *   2. PENDING_REVIEW state shows the Post button; Save+Post calls
 *      postJournalEntry (engine wrapper for /approvals/:id/approve).
 *   3. SoD self-approval: when the current user matches the proposer,
 *      the Post button is disabled with the bilingual SoD message.
 *   4. New blank draft path (HASEEB-504, 2026-04-25 — REVISED): Save+
 *      Post calls createJournalEntry with status: "DRAFT" (NOT POSTED).
 *      The HASEEB-420 backend gateway guard rejects direct status:POSTED
 *      for any source other than MANUAL_MIGRATION, so the prior
 *      "atomic create+post with status:POSTED" assertion was encoding
 *      a broken-server-side behaviour. New flow:
 *        Step 1: createJournalEntry({ ...payload, status: "DRAFT" })
 *        Step 2: if backend routing didn't auto-post (i.e. created
 *                came back !== POSTED), call postJournalEntry(id) to
 *                hit /approvals/:id/approve.
 *      Per HASEEB-490 governance ("tests are verification, not spec"):
 *      this test now asserts the playbook-correct shape, not the prior
 *      defect-as-spec.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
  waitFor,
} from '@testing-library/react';
import React from 'react';

import i18n from '../../src/i18n';

const getManualJEsSpy = vi.fn();
const getManualJEByIdSpy = vi.fn();
const createJournalEntrySpy = vi.fn();
const updateJournalEntryDraftSpy = vi.fn();
const postJournalEntrySpy = vi.fn();
const reverseJournalEntrySpy = vi.fn();

vi.mock('../../src/engine', () => ({
  __esModule: true,
  getManualJEs: (...args) => getManualJEsSpy(...args),
  getManualJEById: (...args) => getManualJEByIdSpy(...args),
  createJournalEntry: (...args) => createJournalEntrySpy(...args),
  updateJournalEntryDraft: (...args) => updateJournalEntryDraftSpy(...args),
  postJournalEntry: (...args) => postJournalEntrySpy(...args),
  reverseJournalEntry: (...args) => reverseJournalEntrySpy(...args),
  listRecurringEntries: vi.fn(async () => []),
  getRecurringEntry: vi.fn(async () => null),
  createRecurringEntry: vi.fn(async () => ({})),
  updateRecurringEntry: vi.fn(async () => ({})),
  deleteRecurringEntry: vi.fn(async () => ({})),
  fireRecurringEntryNow: vi.fn(async () => ({})),
  listRecurringEntryInstances: vi.fn(async () => ({ entries: [], total: 0 })),
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
import { AuthContext } from '../../src/contexts/AuthContext';

async function setLang(lang) {
  await act(async () => {
    await i18n.changeLanguage(lang);
  });
}

/** Helper that wraps ManualJEScreen with a stub AuthContext value. */
function renderWithAuth(userId) {
  const value = userId
    ? { user: { id: userId }, tenant: null, token: 'tok', isAuthenticated: true }
    : null;
  return render(
    <AuthContext.Provider value={value}>
      <ManualJEScreen />
    </AuthContext.Provider>,
  );
}

const DRAFT_PENDING_REVIEW = {
  id: 'JE-DRAFT-1',
  entryNumber: 'JE-DRAFT-1',
  date: '2026-04-24',
  description: 'Office rent April',
  status: 'draft',
  source: 'MANUAL',
  reference: 'OR-APR',
  approvalState: 'PENDING_REVIEW',
  createdBy: 'user_other_99',
  lines: [
    { id: 'L1', accountCode: '6200', accountName: 'Office Rent', debit: 100, credit: 0, memo: '' },
    { id: 'L2', accountCode: '1120', accountName: 'KIB Operating', debit: 0, credit: 100, memo: '' },
  ],
};

const DRAFT_AUTO_APPROVED = {
  ...DRAFT_PENDING_REVIEW,
  id: 'JE-AUTO-2',
  entryNumber: 'JE-AUTO-2',
  approvalState: 'AUTO_APPROVED',
};

const DRAFT_SELF_PROPOSED = {
  ...DRAFT_PENDING_REVIEW,
  id: 'JE-SELF-3',
  entryNumber: 'JE-SELF-3',
  createdBy: 'user_self_42',
};

describe('HASEEB-482 — ManualJEScreen Post button rewire', () => {
  beforeEach(async () => {
    getManualJEsSpy.mockReset();
    getManualJEByIdSpy.mockReset();
    createJournalEntrySpy.mockReset();
    updateJournalEntryDraftSpy.mockReset();
    postJournalEntrySpy.mockReset();
    reverseJournalEntrySpy.mockReset();

    getManualJEsSpy.mockResolvedValue([]);
    // Default getManualJEById to a no-op so selecting a freshly-created
    // entry doesn't crash the post-create state transition.
    getManualJEByIdSpy.mockResolvedValue(null);
    createJournalEntrySpy.mockResolvedValue({
      id: 'JE-NEW-1',
      entryNumber: 'JE-NEW-1',
    });
    postJournalEntrySpy.mockResolvedValue({
      id: 'JE-POSTED',
      entryNumber: 'JE-POSTED',
      status: 'POSTED',
      approvalState: 'APPROVED',
    });
    await setLang('en');
  });

  afterEach(() => {
    cleanup();
  });

  it('AUTO_APPROVED state hides the Post button on an existing draft', async () => {
    // Drafts tab pre-populated with the AUTO_APPROVED entry.
    getManualJEsSpy.mockImplementation(async (filter) => {
      if (filter === 'drafts') return [DRAFT_AUTO_APPROVED];
      return [];
    });
    getManualJEByIdSpy.mockResolvedValue(DRAFT_AUTO_APPROVED);

    renderWithAuth('user_other_99');

    // Click into the Drafts tab to surface the seed entry.
    const draftsTab = await screen.findByText(/Drafts/i);
    fireEvent.click(draftsTab);

    // Open the entry to mount the composer.
    await waitFor(() => {
      expect(screen.getByText('JE-AUTO-2')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('JE-AUTO-2'));

    // Wait for the composer to render with the AUTO_APPROVED draft.
    await screen.findByText(/EDIT DRAFT/i);

    // The Post button must not be present.
    expect(screen.queryByText(/Post Entry/i)).toBeNull();
    // Save Draft is still visible (auto-approved entries can still be
    // edited in DRAFT until they hit POSTED status).
    expect(screen.getByText(/Save draft/i)).toBeInTheDocument();
  });

  it('PENDING_REVIEW state: Post button shows; Save+Post calls postJournalEntry', async () => {
    getManualJEsSpy.mockImplementation(async (filter) => {
      if (filter === 'drafts') return [DRAFT_PENDING_REVIEW];
      return [];
    });
    getManualJEByIdSpy.mockResolvedValue(DRAFT_PENDING_REVIEW);

    // currentUserId differs from createdBy → no SoD block.
    renderWithAuth('user_other_999');

    const draftsTab = await screen.findByText(/Drafts/i);
    fireEvent.click(draftsTab);
    await waitFor(() => {
      expect(screen.getByText('JE-DRAFT-1')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('JE-DRAFT-1'));
    await screen.findByText(/EDIT DRAFT/i);

    // Post button is visible and clickable.
    const postBtn = await screen.findByText(/Post Entry/i);
    expect(postBtn).toBeInTheDocument();
    fireEvent.click(postBtn);

    // The handler PATCHes then calls postJournalEntry on the engine.
    await waitFor(() => {
      expect(postJournalEntrySpy).toHaveBeenCalledTimes(1);
    });
    expect(postJournalEntrySpy.mock.calls[0][0]).toBe('JE-DRAFT-1');
  });

  it('SoD self-approval: Post button disabled when user matches proposer', async () => {
    getManualJEsSpy.mockImplementation(async (filter) => {
      if (filter === 'drafts') return [DRAFT_SELF_PROPOSED];
      return [];
    });
    getManualJEByIdSpy.mockResolvedValue(DRAFT_SELF_PROPOSED);

    // currentUserId === createdBy → SoD blocked.
    renderWithAuth('user_self_42');

    const draftsTab = await screen.findByText(/Drafts/i);
    fireEvent.click(draftsTab);
    await waitFor(() => {
      expect(screen.getByText('JE-SELF-3')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('JE-SELF-3'));
    await screen.findByText(/EDIT DRAFT/i);

    // The Post button renders but is disabled.
    const postBtn = await screen.findByRole('button', { name: /Post Entry/i });
    expect(postBtn).toBeDisabled();

    // Bilingual SoD warning is surfaced (English label here; AR
    // covered in the bilingual test below).
    expect(
      screen.getByText(
        /You created this entry\. A different reviewer must approve it\./i,
      ),
    ).toBeInTheDocument();

    // Click does not fire postJournalEntry.
    fireEvent.click(postBtn);
    expect(postJournalEntrySpy).not.toHaveBeenCalled();
  });

  it('new blank draft: Save+Post creates as DRAFT then approves (HASEEB-504 two-step)', async () => {
    // HASEEB-504 (2026-04-25) — REVISED. Per HASEEB-420 backend gateway
    // guard, direct `status: POSTED` is forbidden for source=MANUAL.
    // The screen now always sends `status: "DRAFT"` and (when the user
    // hit Post) calls postJournalEntry(id) — the engine wrapper for
    // /api/journal-entries/approvals/:id/approve.
    //
    // Default-mock for createJournalEntry returns `{ status: "DRAFT" }`
    // so the screen's auto-post-skip branch (created.status === POSTED)
    // does NOT fire and postJournalEntry is invoked.
    createJournalEntrySpy.mockResolvedValue({
      id: 'JE-NEW-1',
      entryNumber: 'JE-NEW-1',
      status: 'DRAFT',
    });
    postJournalEntrySpy.mockResolvedValue({
      id: 'JE-NEW-1',
      entryNumber: 'JE-NEW-1',
      status: 'POSTED',
    });

    renderWithAuth('user_other_999');

    const newBlankButtons = await screen.findAllByText(/Blank entry/i);
    fireEvent.click(newBlankButtons[0]);

    // Fill two balancing lines.
    const accountInputs = await screen.findAllByPlaceholderText(/account/i);
    expect(accountInputs.length).toBeGreaterThanOrEqual(2);
    fireEvent.change(accountInputs[0], { target: { value: '6200' } });
    fireEvent.change(accountInputs[1], { target: { value: '1120' } });

    const numericInputs = screen
      .getAllByRole('spinbutton')
      .filter((el) => el.tagName === 'INPUT');
    if (numericInputs.length >= 4) {
      fireEvent.change(numericInputs[0], { target: { value: '500' } });
      fireEvent.change(numericInputs[3], { target: { value: '500' } });
    }

    // Click Post Entry.
    const postBtn = await screen.findByText(/Post Entry/i);
    fireEvent.click(postBtn);

    await waitFor(() => {
      expect(createJournalEntrySpy).toHaveBeenCalled();
    });
    const payload = createJournalEntrySpy.mock.calls[0][0];
    // Step 1: must create as DRAFT, never POSTED. The backend
    // gateway guard (HASEEB-420) rejects direct POSTED creation.
    expect(payload.status).toBe('DRAFT');

    // Step 2: must call postJournalEntry to promote DRAFT → POSTED via
    // the approval engine (since the mock returned DRAFT, not POSTED).
    await waitFor(() => {
      expect(postJournalEntrySpy).toHaveBeenCalledWith('JE-NEW-1');
    });
  });

  it('new blank draft: Save+Post skips approve call when backend auto-posted (TIER_AUTO)', async () => {
    // HASEEB-504 (2026-04-25) — when sub-ceiling MANUAL routes to
    // TIER_AUTO inside `journal-entry.service.ts:create()`, the server
    // returns the row already at status: POSTED. The screen then
    // skips the approve call (no point promoting an already-POSTED
    // entry; would 400 INVALID_APPROVAL_STATE).
    createJournalEntrySpy.mockResolvedValue({
      id: 'JE-NEW-2',
      entryNumber: 'JE-NEW-2',
      status: 'POSTED',
    });

    renderWithAuth('user_other_999');

    const newBlankButtons = await screen.findAllByText(/Blank entry/i);
    fireEvent.click(newBlankButtons[0]);

    const accountInputs = await screen.findAllByPlaceholderText(/account/i);
    fireEvent.change(accountInputs[0], { target: { value: '6200' } });
    fireEvent.change(accountInputs[1], { target: { value: '1120' } });

    const numericInputs = screen
      .getAllByRole('spinbutton')
      .filter((el) => el.tagName === 'INPUT');
    if (numericInputs.length >= 4) {
      fireEvent.change(numericInputs[0], { target: { value: '500' } });
      fireEvent.change(numericInputs[3], { target: { value: '500' } });
    }

    const postBtn = await screen.findByText(/Post Entry/i);
    fireEvent.click(postBtn);

    await waitFor(() => {
      expect(createJournalEntrySpy).toHaveBeenCalled();
    });
    const payload = createJournalEntrySpy.mock.calls[0][0];
    expect(payload.status).toBe('DRAFT');
    // postJournalEntry MUST NOT fire — the row is already POSTED.
    expect(postJournalEntrySpy).not.toHaveBeenCalled();
  });

  it('Arabic locale: SoD warning renders in Arabic for self-proposed entries', async () => {
    await setLang('ar');
    getManualJEsSpy.mockImplementation(async (filter) => {
      if (filter === 'drafts') return [DRAFT_SELF_PROPOSED];
      return [];
    });
    getManualJEByIdSpy.mockResolvedValue(DRAFT_SELF_PROPOSED);
    renderWithAuth('user_self_42');

    // Find the Drafts tab — Arabic label.
    const draftsTab = await screen.findByText(/مسودات|المسودات|drafts/i);
    fireEvent.click(draftsTab);
    await waitFor(() => {
      expect(screen.getByText('JE-SELF-3')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('JE-SELF-3'));

    await waitFor(() => {
      expect(
        screen.getByText('أنت أنشأت هذا القيد. يجب على مراجع آخر اعتماده.'),
      ).toBeInTheDocument();
    });
    await setLang('en');
  });
});
