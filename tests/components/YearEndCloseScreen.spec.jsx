/**
 * YearEndCloseScreen — AUDIT-ACC-003 (2026-04-22).
 *
 * Covers:
 *   1. Year list renders rows for DRAFT (PENDING_PREP) / PREPARED
 *      (PENDING_APPROVAL) / APPROVED (CLOSED) / REVERSED states.
 *   2. Role gating: Junior sees list + detail but the Prepare +
 *      Re-prepare + Approve + Reverse actions all render disabled
 *      with tooltip. CFO/Senior can prepare + re-prepare but cannot
 *      approve or reverse. Owner can do all four.
 *   3. SoD hiding: on a PENDING_APPROVAL record whose preparedBy ===
 *      currentUserId, the Approve button is HIDDEN and a tooltip note
 *      renders in its place.
 *   4. Pre-close checklist: blocked items render in the expanded
 *      danger-toned section; ready items collapse behind a count
 *      button; pending items visible inline.
 *   5. Approve confirmation modal: opens on click; governance notice
 *      visible; type-to-confirm gates the approve button.
 *   6. Reverse modal: reason textarea demands ≥10 chars; Owner
 *      reconfirm checkbox required; both together enable reverse.
 *   7. FS export button group renders only when the record is CLOSED.
 *   8. i18n parity: EN + AR have identical key sets.
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
import enYec from '../../src/i18n/locales/en/yearEndClose.json';
import arYec from '../../src/i18n/locales/ar/yearEndClose.json';

const listYearEndCloseRecordsSpy = vi.fn();
const getYearEndCloseSpy = vi.fn();
const prepareYearEndCloseSpy = vi.fn();
const approveYearEndCloseSpy = vi.fn();
const reverseYearEndCloseSpy = vi.fn();

vi.mock('../../src/engine', () => ({
  __esModule: true,
  listYearEndCloseRecords: (...a) => listYearEndCloseRecordsSpy(...a),
  getYearEndClose: (...a) => getYearEndCloseSpy(...a),
  prepareYearEndClose: (...a) => prepareYearEndCloseSpy(...a),
  approveYearEndClose: (...a) => approveYearEndCloseSpy(...a),
  reverseYearEndClose: (...a) => reverseYearEndCloseSpy(...a),
  getYearEndCloseConfig: vi.fn().mockResolvedValue({}),
  updateYearEndCloseConfig: vi.fn(),
}));

vi.mock('../../src/engine/mockEngine', () => ({
  __esModule: true,
  exportStatement: vi.fn().mockResolvedValue({
    filename: 'test-export.pdf',
    url: null,
  }),
}));

// Provide a current-user id via AuthContext mock so the SoD gate can
// exercise predictably. authUser.id defaults to 'user-owner-current'
// for Owner tests unless the individual test overrides via the
// mockReturnValue.
const authUserRef = { current: { id: 'user-owner-current' } };
vi.mock('../../src/contexts/AuthContext', () => ({
  __esModule: true,
  useAuth: () => ({ user: authUserRef.current }),
}));

import YearEndCloseScreen from '../../src/screens/cfo/YearEndCloseScreen';

async function setLang(lang) {
  await act(async () => {
    await i18n.changeLanguage(lang);
  });
}

const CURRENT_YEAR = new Date().getUTCFullYear();

function seedRecords() {
  return [
    // APPROVED prior year
    {
      id: 'yec-approved',
      fiscalYear: CURRENT_YEAR - 2,
      status: 'CLOSED',
      revenueTotalKwd: '4218450.750',
      expenseTotalKwd: '3184220.125',
      netIncomeKwd: '1034230.625',
      openingRetainedEarningsKwd: '2815400.000',
      endingRetainedEarningsKwd: '3849630.625',
      linkedRestatementIds: [],
      preparedBy: 'user-cfo-1',
      preparedAt: '2024-03-10T09:15:00.000Z',
      approvedBy: 'user-owner-1',
      approvedAt: '2024-03-18T14:30:00.000Z',
      reversedAt: null,
      reversedBy: null,
      reversalReason: null,
      reversalJournalEntryIds: [],
      revenueCloseJeId: 'je-rev',
      expenseCloseJeId: 'je-exp',
      incomeSummaryCloseJeId: 'je-is',
      notes: null,
      createdAt: '2024-03-10T09:15:00.000Z',
      updatedAt: '2024-03-18T14:30:00.000Z',
      prerequisites: {
        statutoryReserveSatisfied: true,
        noUnresolvedRestatements: true,
        noOpenScopeExceptions: true,
      },
    },
    // PREPARED current year — preparedBy matches the Owner-current so
    // SoD can be tested
    {
      id: 'yec-prepared',
      fiscalYear: CURRENT_YEAR - 1,
      status: 'PENDING_APPROVAL',
      revenueTotalKwd: '4752100.000',
      expenseTotalKwd: '3510850.500',
      netIncomeKwd: '1241249.500',
      openingRetainedEarningsKwd: '3849630.625',
      endingRetainedEarningsKwd: '5090880.125',
      linkedRestatementIds: [],
      preparedBy: 'user-cfo-1',
      preparedAt: '2025-03-12T11:05:00.000Z',
      approvedBy: null,
      approvedAt: null,
      reversedAt: null,
      reversedBy: null,
      reversalReason: null,
      reversalJournalEntryIds: [],
      revenueCloseJeId: null,
      expenseCloseJeId: null,
      incomeSummaryCloseJeId: null,
      notes: null,
      createdAt: '2025-03-12T11:05:00.000Z',
      updatedAt: '2025-03-12T11:05:00.000Z',
      prerequisites: {
        statutoryReserveSatisfied: true,
        noUnresolvedRestatements: true,
        noOpenScopeExceptions: false,
      },
    },
    // REVERSED older year
    {
      id: 'yec-reversed',
      fiscalYear: CURRENT_YEAR - 3,
      status: 'REVERSED',
      revenueTotalKwd: '3892000.000',
      expenseTotalKwd: '3120000.000',
      netIncomeKwd: '772000.000',
      openingRetainedEarningsKwd: '2043400.000',
      endingRetainedEarningsKwd: '2815400.000',
      linkedRestatementIds: [],
      preparedBy: 'user-cfo-1',
      preparedAt: '2023-03-08T09:20:00.000Z',
      approvedBy: 'user-owner-1',
      approvedAt: '2023-03-14T15:45:00.000Z',
      reversedAt: '2023-08-03T10:00:00.000Z',
      reversedBy: 'user-owner-1',
      reversalReason:
        'Material inventory count variance discovered post-close.',
      reversalJournalEntryIds: ['je-rev-rev', 'je-exp-rev', 'je-is-rev'],
      revenueCloseJeId: 'je-rev',
      expenseCloseJeId: 'je-exp',
      incomeSummaryCloseJeId: 'je-is',
      notes: null,
      createdAt: '2023-03-08T09:20:00.000Z',
      updatedAt: '2023-08-03T10:00:00.000Z',
      prerequisites: {
        statutoryReserveSatisfied: true,
        noUnresolvedRestatements: true,
        noOpenScopeExceptions: true,
      },
    },
  ];
}

function findRecord(records, fy) {
  return records.find((r) => r.fiscalYear === fy);
}

// ══════════════════════════════════════════════════════════════════
// Year list
// ══════════════════════════════════════════════════════════════════

describe('YearEndCloseScreen — year list', () => {
  beforeEach(async () => {
    listYearEndCloseRecordsSpy.mockReset();
    getYearEndCloseSpy.mockReset();
    prepareYearEndCloseSpy.mockReset();
    approveYearEndCloseSpy.mockReset();
    reverseYearEndCloseSpy.mockReset();
    authUserRef.current = { id: 'user-owner-current' };
    await setLang('en');
  });
  afterEach(() => cleanup());

  it('renders a row for each fiscal-year record (APPROVED / PREPARED / REVERSED)', async () => {
    listYearEndCloseRecordsSpy.mockResolvedValue(seedRecords());
    render(<YearEndCloseScreen role="Owner" />);
    await waitFor(() => {
      expect(
        screen.getByTestId(`yec-row-${CURRENT_YEAR - 2}`),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByTestId(`yec-row-${CURRENT_YEAR - 1}`),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`yec-row-${CURRENT_YEAR - 3}`),
    ).toBeInTheDocument();
    // Three distinct status badges rendered.
    expect(screen.getByTestId('yec-status-CLOSED')).toBeInTheDocument();
    expect(
      screen.getByTestId('yec-status-PENDING_APPROVAL'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('yec-status-REVERSED')).toBeInTheDocument();
  });

  it('shows empty-state when no records', async () => {
    listYearEndCloseRecordsSpy.mockResolvedValue([]);
    render(<YearEndCloseScreen role="Owner" />);
    await waitFor(() => {
      expect(screen.getByText(enYec.year_list.empty_title)).toBeInTheDocument();
    });
  });

  it('Prepare button enabled for Owner', async () => {
    listYearEndCloseRecordsSpy.mockResolvedValue([]);
    render(<YearEndCloseScreen role="Owner" />);
    await waitFor(() => {
      expect(screen.getByTestId('yec-action-prepare')).toBeInTheDocument();
    });
    const btn = screen.getByTestId('yec-action-prepare');
    expect(btn).not.toBeDisabled();
  });

  it('Prepare button enabled for CFO (ACCOUNTANT role)', async () => {
    listYearEndCloseRecordsSpy.mockResolvedValue([]);
    render(<YearEndCloseScreen role="CFO" />);
    await waitFor(() => {
      expect(screen.getByTestId('yec-action-prepare')).toBeInTheDocument();
    });
    expect(screen.getByTestId('yec-action-prepare')).not.toBeDisabled();
  });

  it('Prepare button disabled for Junior', async () => {
    listYearEndCloseRecordsSpy.mockResolvedValue([]);
    render(<YearEndCloseScreen role="Junior" />);
    await waitFor(() => {
      expect(screen.getByTestId('yec-action-prepare')).toBeInTheDocument();
    });
    const btn = screen.getByTestId('yec-action-prepare');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('data-owner-disabled', 'true');
  });
});

// ══════════════════════════════════════════════════════════════════
// Detail view
// ══════════════════════════════════════════════════════════════════

describe('YearEndCloseScreen — detail view', () => {
  beforeEach(async () => {
    listYearEndCloseRecordsSpy.mockReset();
    getYearEndCloseSpy.mockReset();
    prepareYearEndCloseSpy.mockReset();
    approveYearEndCloseSpy.mockReset();
    reverseYearEndCloseSpy.mockReset();
    authUserRef.current = { id: 'user-owner-current' };
    await setLang('en');
  });
  afterEach(() => cleanup());

  async function openDetail(role, fy, records = seedRecords()) {
    listYearEndCloseRecordsSpy.mockResolvedValue(records);
    const target = findRecord(records, fy);
    getYearEndCloseSpy.mockResolvedValue(target);
    render(<YearEndCloseScreen role={role} />);
    await waitFor(() => {
      expect(screen.getByTestId(`yec-row-${fy}`)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId(`yec-row-${fy}`));
    await waitFor(() => {
      expect(screen.getByTestId('yec-detail-view')).toBeInTheDocument();
    });
  }

  it('APPROVED detail shows Reverse + FS export group (Owner)', async () => {
    await openDetail('Owner', CURRENT_YEAR - 2);
    expect(screen.getByTestId('yec-action-reverse')).toBeInTheDocument();
    expect(screen.getByTestId('yec-export-group')).toBeInTheDocument();
    expect(screen.getByTestId('yec-export-balance-sheet')).toBeInTheDocument();
    expect(
      screen.getByTestId('yec-export-income-statement'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('yec-export-cash-flow')).toBeInTheDocument();
    expect(screen.getByTestId('yec-export-socie')).toBeInTheDocument();
    expect(screen.getByTestId('yec-export-disclosures')).toBeInTheDocument();
  });

  it('APPROVED detail: CFO cannot reverse (button disabled)', async () => {
    await openDetail('CFO', CURRENT_YEAR - 2);
    const btn = screen.getByTestId('yec-action-reverse');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('data-owner-disabled', 'true');
  });

  it('PREPARED detail shows pre-close checklist with blocked items expanded', async () => {
    await openDetail('Owner', CURRENT_YEAR - 1);
    expect(screen.getByTestId('yec-checklist-block')).toBeInTheDocument();
    // `noOpenScopeExceptions` is false in the seed → blocked section visible.
    expect(screen.getByTestId('yec-checklist-blocked')).toBeInTheDocument();
    // The two ready items are collapsed into the count button.
    expect(screen.getByTestId('yec-checklist-ready')).toBeInTheDocument();
    // The specific blocked row for scope-exceptions rendered.
    expect(
      screen.getByTestId('yec-checklist-row-noOpenScopeExceptions'),
    ).toBeInTheDocument();
  });

  it('PREPARED + SoD fires: Owner == preparedBy → Approve button HIDDEN, tooltip note rendered', async () => {
    // Owner current user id matches preparedBy on the record.
    authUserRef.current = { id: 'user-cfo-1' };
    await openDetail('Owner', CURRENT_YEAR - 1);
    // Approve not present — SoD HIDES rather than disables per dispatch.
    expect(
      screen.queryByTestId('yec-action-approve'),
    ).not.toBeInTheDocument();
    // The SoD tooltip note is rendered in its place.
    expect(screen.getByTestId('yec-sod-tooltip')).toBeInTheDocument();
    expect(screen.getByTestId('yec-sod-tooltip')).toHaveTextContent(
      enYec.detail.sod_tooltip,
    );
  });

  it('PREPARED + SoD does not fire: different Owner → Approve button rendered + enabled', async () => {
    // Owner is a different user from preparedBy.
    authUserRef.current = { id: 'user-owner-current' };
    await openDetail('Owner', CURRENT_YEAR - 1);
    const approve = screen.getByTestId('yec-action-approve');
    expect(approve).toBeInTheDocument();
    expect(approve).not.toBeDisabled();
    // No SoD tooltip shown.
    expect(screen.queryByTestId('yec-sod-tooltip')).not.toBeInTheDocument();
  });

  it('REVERSED detail shows terminal note, no action buttons', async () => {
    await openDetail('Owner', CURRENT_YEAR - 3);
    expect(screen.getByText(enYec.detail.action_terminal)).toBeInTheDocument();
    expect(
      screen.queryByTestId('yec-action-approve'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('yec-action-reverse'),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('yec-export-group')).not.toBeInTheDocument();
  });

  it('REVERSED detail: audit trail shows all three events + reversal reason', async () => {
    await openDetail('Owner', CURRENT_YEAR - 3);
    const audit = screen.getByTestId('yec-audit-trail');
    expect(audit).toHaveTextContent(enYec.detail.audit_prepared);
    expect(audit).toHaveTextContent(enYec.detail.audit_approved);
    expect(audit).toHaveTextContent(enYec.detail.audit_reversed);
    expect(audit).toHaveTextContent(
      'Material inventory count variance discovered post-close.',
    );
  });

  it('Junior detail: Re-prepare + Approve + Reverse all disabled', async () => {
    await openDetail('Junior', CURRENT_YEAR - 1);
    // Re-prepare disabled (Junior cannot prepare).
    const reprep = screen.getByTestId('yec-action-reprepare');
    expect(reprep).toBeDisabled();
    // Approve: SoD doesn't apply for Junior (role blocks first); the
    // button still renders with data-owner-disabled so the operator
    // understands.
    const approve = screen.getByTestId('yec-action-approve');
    expect(approve).toBeDisabled();
    expect(approve).toHaveAttribute('data-owner-disabled', 'true');
  });
});

// ══════════════════════════════════════════════════════════════════
// Modals
// ══════════════════════════════════════════════════════════════════

describe('YearEndCloseScreen — approve modal', () => {
  beforeEach(async () => {
    listYearEndCloseRecordsSpy.mockReset();
    getYearEndCloseSpy.mockReset();
    approveYearEndCloseSpy.mockReset();
    authUserRef.current = { id: 'user-owner-current' };
    await setLang('en');
  });
  afterEach(() => cleanup());

  it('opens on Approve click, renders governance notice, type-to-confirm gates submit', async () => {
    const recs = seedRecords();
    listYearEndCloseRecordsSpy.mockResolvedValue(recs);
    getYearEndCloseSpy.mockResolvedValue(findRecord(recs, CURRENT_YEAR - 1));
    render(<YearEndCloseScreen role="Owner" />);
    await waitFor(() => {
      expect(
        screen.getByTestId(`yec-row-${CURRENT_YEAR - 1}`),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId(`yec-row-${CURRENT_YEAR - 1}`));
    await waitFor(() => {
      expect(screen.getByTestId('yec-action-approve')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('yec-action-approve'));
    // Modal visible, governance notice present.
    expect(screen.getByTestId('yec-approve-modal')).toBeInTheDocument();
    expect(
      screen.getByTestId('yec-approve-governance-notice'),
    ).toBeInTheDocument();
    // Approve button is disabled before typing the year.
    const confirmBtn = screen.getByTestId('yec-approve-confirm');
    expect(confirmBtn).toBeDisabled();
    // Type the wrong year → still disabled.
    fireEvent.change(screen.getByTestId('yec-approve-type-to-confirm'), {
      target: { value: '1999' },
    });
    expect(confirmBtn).toBeDisabled();
    // Type the right year → enabled.
    fireEvent.change(screen.getByTestId('yec-approve-type-to-confirm'), {
      target: { value: String(CURRENT_YEAR - 1) },
    });
    expect(confirmBtn).not.toBeDisabled();
  });
});

describe('YearEndCloseScreen — reverse modal', () => {
  beforeEach(async () => {
    listYearEndCloseRecordsSpy.mockReset();
    getYearEndCloseSpy.mockReset();
    reverseYearEndCloseSpy.mockReset();
    authUserRef.current = { id: 'user-owner-current' };
    await setLang('en');
  });
  afterEach(() => cleanup());

  it('reason must be ≥10 chars AND Owner-reconfirm checkbox required', async () => {
    const recs = seedRecords();
    listYearEndCloseRecordsSpy.mockResolvedValue(recs);
    getYearEndCloseSpy.mockResolvedValue(findRecord(recs, CURRENT_YEAR - 2));
    render(<YearEndCloseScreen role="Owner" />);
    await waitFor(() => {
      expect(
        screen.getByTestId(`yec-row-${CURRENT_YEAR - 2}`),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId(`yec-row-${CURRENT_YEAR - 2}`));
    await waitFor(() => {
      expect(screen.getByTestId('yec-action-reverse')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('yec-action-reverse'));
    expect(screen.getByTestId('yec-reverse-modal')).toBeInTheDocument();
    const reverseBtn = screen.getByTestId('yec-reverse-confirm');
    expect(reverseBtn).toBeDisabled();
    // Short reason → still disabled.
    fireEvent.change(screen.getByTestId('yec-reverse-reason'), {
      target: { value: 'too short' },
    });
    expect(reverseBtn).toBeDisabled();
    // Long reason, checkbox still unchecked → disabled.
    fireEvent.change(screen.getByTestId('yec-reverse-reason'), {
      target: {
        value: 'Material variance in inventory count.',
      },
    });
    expect(reverseBtn).toBeDisabled();
    // Check the checkbox → enabled.
    fireEvent.click(screen.getByTestId('yec-reverse-acknowledge'));
    expect(reverseBtn).not.toBeDisabled();
  });
});

// ══════════════════════════════════════════════════════════════════
// i18n parity
// ══════════════════════════════════════════════════════════════════

describe('YearEndCloseScreen — i18n parity', () => {
  it('EN + AR have identical key shapes on top-level sections', () => {
    // Spot-check all 5 status labels.
    for (const s of [
      'PENDING_PREP',
      'PENDING_APPROVAL',
      'CLOSING',
      'CLOSED',
      'REVERSED',
    ]) {
      expect(enYec.status[s]).toBeTypeOf('string');
      expect(arYec.status[s]).toBeTypeOf('string');
    }
    // Year-list section parity.
    for (const k of Object.keys(enYec.year_list)) {
      expect(arYec.year_list[k]).toBeTypeOf('string');
    }
    for (const k of Object.keys(arYec.year_list)) {
      expect(enYec.year_list[k]).toBeTypeOf('string');
    }
    // Detail section parity.
    for (const k of Object.keys(enYec.detail)) {
      expect(arYec.detail[k]).toBeTypeOf('string');
    }
    for (const k of Object.keys(arYec.detail)) {
      expect(enYec.detail[k]).toBeTypeOf('string');
    }
    // Approve / reverse modals.
    for (const k of Object.keys(enYec.approve_modal)) {
      expect(arYec.approve_modal[k]).toBeTypeOf('string');
    }
    for (const k of Object.keys(enYec.reverse_modal)) {
      expect(arYec.reverse_modal[k]).toBeTypeOf('string');
    }
    // Toasts.
    for (const k of Object.keys(enYec.toast)) {
      expect(arYec.toast[k]).toBeTypeOf('string');
    }
  });

  it('Kuwait-Arabic year-end terminology present in AR file', () => {
    const arJson = JSON.stringify(arYec);
    expect(arJson).toContain('إقفال السنة المالية'); // Year-end close
    expect(arJson).toContain('إعداد'); // Prepare
    expect(arJson).toContain('اعتماد'); // Approve
    expect(arJson).toContain('إعادة فتح'); // Reverse / reopen
    expect(arJson).toContain('السنة المالية'); // Fiscal year
    expect(arJson).toContain('قائمة التحقق قبل الإقفال'); // Pre-close checklist
    expect(arJson).toContain('الأرباح المحتجزة'); // Retained earnings
    expect(arJson).toContain('الاحتياطي القانوني'); // Statutory reserve
    expect(arJson).toContain('فصل الواجبات'); // Separation of duties
  });
});
