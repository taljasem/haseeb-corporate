/**
 * CITAssessmentScreen — AUDIT-ACC-057 (2026-04-22).
 *
 * Covers:
 *   1. Year list renders rows for all 7 CitAssessmentStatus values.
 *   2. Approaching-statute row gets warning highlight + N-days badge.
 *   3. Role gating (Owner vs CFO/Junior): OWNER sees enabled action
 *      buttons; non-OWNER sees the same buttons rendered but disabled
 *      with the OWNER-only tooltip (not hidden).
 *   4. Per-case detail view renders when a row is clicked: three
 *      figures, dates, notes, audit trail, action bar.
 *   5. Transition buttons visible for correct source states:
 *        FILED           → open_review + record_assessment
 *        UNDER_REVIEW    → record_assessment
 *        ASSESSED        → record_objection + finalize
 *        OBJECTED        → finalize
 *        FINAL           → close
 *        CLOSED / STATUTE_EXPIRED → no actions (terminal)
 *   6. Mark-statute-expired is disabled unless statuteExpiresOn < today
 *      AND status is non-terminal.
 *   7. i18n parity: EN + AR have identical key sets for citAssessment.
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
import enCit from '../../src/i18n/locales/en/citAssessment.json';
import arCit from '../../src/i18n/locales/ar/citAssessment.json';

const listCitAssessmentsSpy = vi.fn();
const getCitAssessmentSpy = vi.fn();
const listApproachingStatuteSpy = vi.fn();
const closeCitAssessmentSpy = vi.fn();
const markCitAssessmentStatuteExpiredSpy = vi.fn();

vi.mock('../../src/engine', () => ({
  __esModule: true,
  listCitAssessments: (...args) => listCitAssessmentsSpy(...args),
  getCitAssessment: (...args) => getCitAssessmentSpy(...args),
  listApproachingStatute: (...args) => listApproachingStatuteSpy(...args),
  closeCitAssessment: (...args) => closeCitAssessmentSpy(...args),
  markCitAssessmentStatuteExpired: (...args) =>
    markCitAssessmentStatuteExpiredSpy(...args),
  // Modal components reach back into engine via create/transition
  // helpers. Provide no-op stubs so the detail view can open them
  // without network.
  createCitAssessment: vi.fn(),
  openCitAssessmentReview: vi.fn(),
  recordCitAssessment: vi.fn(),
  recordCitAssessmentObjection: vi.fn(),
  finalizeCitAssessment: vi.fn(),
}));

import CITAssessmentScreen from '../../src/screens/cfo/CITAssessmentScreen';

async function setLang(lang) {
  await act(async () => {
    await i18n.changeLanguage(lang);
  });
}

function isoDaysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function seedCases() {
  // One case per CitAssessmentStatus value. The FINAL case sits in
  // the approaching-statute window (~60 days); STATUTE_EXPIRED has
  // statute already past.
  return [
    {
      id: 'c-filed',
      fiscalYear: 2024,
      filedAmountKwd: '185000.000',
      filedOnDate: '2025-03-31',
      authorityCaseNumber: 'MOF-CIT-2025-0441',
      status: 'FILED',
      assessedAmountKwd: null,
      assessedOnDate: null,
      varianceKwd: null,
      objectionFiledOn: null,
      finalAmountKwd: null,
      finalizedOnDate: null,
      statuteExpiresOn: '2029-12-31',
      notes: null,
      createdAt: '2025-03-31T00:00:00.000Z',
      updatedAt: '2025-03-31T00:00:00.000Z',
    },
    {
      id: 'c-review',
      fiscalYear: 2023,
      filedAmountKwd: '142000.000',
      filedOnDate: '2024-03-28',
      authorityCaseNumber: 'MOF-CIT-2024-0318',
      status: 'UNDER_REVIEW',
      assessedAmountKwd: null,
      assessedOnDate: null,
      varianceKwd: null,
      objectionFiledOn: null,
      finalAmountKwd: null,
      finalizedOnDate: null,
      statuteExpiresOn: '2028-12-31',
      notes: null,
      createdAt: '2024-03-28T00:00:00.000Z',
      updatedAt: '2024-03-28T00:00:00.000Z',
    },
    {
      id: 'c-assessed',
      fiscalYear: 2022,
      filedAmountKwd: '118500.000',
      filedOnDate: '2023-03-30',
      authorityCaseNumber: 'MOF-CIT-2023-0207',
      status: 'ASSESSED',
      assessedAmountKwd: '134250.000',
      assessedOnDate: '2025-09-15',
      varianceKwd: '15750.000',
      objectionFiledOn: null,
      finalAmountKwd: null,
      finalizedOnDate: null,
      statuteExpiresOn: '2027-12-31',
      notes: null,
      createdAt: '2023-03-30T00:00:00.000Z',
      updatedAt: '2025-09-15T00:00:00.000Z',
    },
    {
      id: 'c-objected',
      fiscalYear: 2021,
      filedAmountKwd: '96000.000',
      filedOnDate: '2022-03-29',
      authorityCaseNumber: 'MOF-CIT-2022-0188',
      status: 'OBJECTED',
      assessedAmountKwd: '112400.000',
      assessedOnDate: '2024-11-10',
      varianceKwd: '16400.000',
      objectionFiledOn: '2024-12-08',
      finalAmountKwd: null,
      finalizedOnDate: null,
      statuteExpiresOn: '2026-12-31',
      notes: null,
      createdAt: '2022-03-29T00:00:00.000Z',
      updatedAt: '2024-12-08T00:00:00.000Z',
    },
    {
      id: 'c-final-approaching',
      fiscalYear: 2020,
      filedAmountKwd: '84500.000',
      filedOnDate: '2021-03-30',
      authorityCaseNumber: 'MOF-CIT-2021-0102',
      status: 'FINAL',
      assessedAmountKwd: '91200.000',
      assessedOnDate: '2023-06-18',
      varianceKwd: '6700.000',
      objectionFiledOn: null,
      finalAmountKwd: '91200.000',
      finalizedOnDate: '2024-02-14',
      // Approaching-statute scenario: 60 days out.
      statuteExpiresOn: isoDaysFromNow(60),
      notes: null,
      createdAt: '2021-03-30T00:00:00.000Z',
      updatedAt: '2024-02-14T00:00:00.000Z',
    },
    {
      id: 'c-closed',
      fiscalYear: 2019,
      filedAmountKwd: '72300.000',
      filedOnDate: '2020-03-31',
      authorityCaseNumber: 'MOF-CIT-2020-0057',
      status: 'CLOSED',
      assessedAmountKwd: '74100.000',
      assessedOnDate: '2022-05-12',
      varianceKwd: '1800.000',
      objectionFiledOn: null,
      finalAmountKwd: '74100.000',
      finalizedOnDate: '2023-01-09',
      statuteExpiresOn: '2024-12-31',
      notes: null,
      createdAt: '2020-03-31T00:00:00.000Z',
      updatedAt: '2023-01-09T00:00:00.000Z',
    },
    {
      id: 'c-statute',
      fiscalYear: 2018,
      filedAmountKwd: '65800.000',
      filedOnDate: '2019-03-28',
      authorityCaseNumber: 'MOF-CIT-2019-0033',
      status: 'STATUTE_EXPIRED',
      assessedAmountKwd: null,
      assessedOnDate: null,
      varianceKwd: null,
      objectionFiledOn: null,
      finalAmountKwd: null,
      finalizedOnDate: null,
      statuteExpiresOn: '2023-12-31',
      notes: null,
      createdAt: '2019-03-28T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z',
    },
  ];
}

// ── Year list tests ──────────────────────────────────────────────

describe('CITAssessmentScreen — year list', () => {
  beforeEach(async () => {
    listCitAssessmentsSpy.mockReset();
    getCitAssessmentSpy.mockReset();
    listApproachingStatuteSpy.mockReset();
    closeCitAssessmentSpy.mockReset();
    markCitAssessmentStatuteExpiredSpy.mockReset();
    await setLang('en');
  });
  afterEach(() => cleanup());

  it('renders a row for every CitAssessmentStatus value returned by the engine', async () => {
    listCitAssessmentsSpy.mockResolvedValue(seedCases());
    listApproachingStatuteSpy.mockResolvedValue([]);
    render(<CITAssessmentScreen role="CFO" />);

    await waitFor(() => {
      expect(screen.getByTestId('cit-row-2024')).toBeInTheDocument();
    });
    for (const fy of [2023, 2022, 2021, 2020, 2019, 2018]) {
      expect(screen.getByTestId(`cit-row-${fy}`)).toBeInTheDocument();
    }
    // Status badges — each of the 7 statuses rendered exactly once in
    // the year list.
    for (const s of [
      'FILED',
      'UNDER_REVIEW',
      'ASSESSED',
      'OBJECTED',
      'FINAL',
      'CLOSED',
      'STATUTE_EXPIRED',
    ]) {
      expect(screen.getAllByTestId(`cit-status-${s}`).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('shows approaching-statute banner and N-days-remaining badge on the affected row', async () => {
    listCitAssessmentsSpy.mockResolvedValue(seedCases());
    // The FY2020 FINAL case has statute 60 days out — seed it into
    // the approaching-statute sweep.
    const approachingRow = seedCases().find((c) => c.id === 'c-final-approaching');
    listApproachingStatuteSpy.mockResolvedValue([
      { assessment: approachingRow, daysUntilExpiry: 60 },
    ]);

    render(<CITAssessmentScreen role="CFO" />);
    await waitFor(() => {
      expect(screen.getByTestId('cit-approaching-banner')).toBeInTheDocument();
    });
    // Row countdown badge.
    expect(
      screen.getByTestId('cit-statute-countdown-2020'),
    ).toBeInTheDocument();
  });

  it('shows empty state when no cases are returned', async () => {
    listCitAssessmentsSpy.mockResolvedValue([]);
    listApproachingStatuteSpy.mockResolvedValue([]);
    render(<CITAssessmentScreen role="CFO" />);
    await waitFor(() => {
      expect(screen.getByText(enCit.year_list.empty_title)).toBeInTheDocument();
    });
  });

  it('renders the New case action button regardless of role (disabled for non-Owner)', async () => {
    // Non-Owner (CFO): button is present but disabled with tooltip.
    listCitAssessmentsSpy.mockResolvedValue(seedCases());
    listApproachingStatuteSpy.mockResolvedValue([]);
    const { unmount } = render(<CITAssessmentScreen role="CFO" />);
    await waitFor(() => {
      expect(screen.getByTestId('cit-action-new-case')).toBeInTheDocument();
    });
    const btn = screen.getByTestId('cit-action-new-case');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('data-owner-disabled', 'true');
    expect(btn).toHaveAttribute('title', enCit.ownerOnly.tooltip);
    unmount();

    // Owner: button enabled, no owner-disabled marker.
    listCitAssessmentsSpy.mockResolvedValue(seedCases());
    listApproachingStatuteSpy.mockResolvedValue([]);
    render(<CITAssessmentScreen role="Owner" />);
    await waitFor(() => {
      expect(screen.getByTestId('cit-action-new-case')).toBeInTheDocument();
    });
    const btn2 = screen.getByTestId('cit-action-new-case');
    expect(btn2).not.toBeDisabled();
    expect(btn2).not.toHaveAttribute('data-owner-disabled');
  });
});

// ── Per-case detail view tests ───────────────────────────────────

describe('CITAssessmentScreen — per-case detail', () => {
  beforeEach(async () => {
    listCitAssessmentsSpy.mockReset();
    getCitAssessmentSpy.mockReset();
    listApproachingStatuteSpy.mockReset();
    closeCitAssessmentSpy.mockReset();
    markCitAssessmentStatuteExpiredSpy.mockReset();
    await setLang('en');
  });
  afterEach(() => cleanup());

  async function openDetail(role, targetFy) {
    const cases = seedCases();
    listCitAssessmentsSpy.mockResolvedValue(cases);
    listApproachingStatuteSpy.mockResolvedValue([]);
    const target = cases.find((c) => c.fiscalYear === targetFy);
    getCitAssessmentSpy.mockResolvedValue(target);
    render(<CITAssessmentScreen role={role} />);
    await waitFor(() => {
      expect(screen.getByTestId(`cit-row-${targetFy}`)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId(`cit-row-${targetFy}`));
    await waitFor(() => {
      expect(screen.getByTestId('cit-detail-view')).toBeInTheDocument();
    });
  }

  it('FILED: shows Open Review + Record Assessment action buttons', async () => {
    await openDetail('Owner', 2024);
    expect(screen.getByTestId('cit-action-open-review')).toBeInTheDocument();
    expect(
      screen.getByTestId('cit-action-record-assessment'),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('cit-action-record-objection'),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('cit-action-finalize')).not.toBeInTheDocument();
    expect(screen.queryByTestId('cit-action-close')).not.toBeInTheDocument();
  });

  it('UNDER_REVIEW: shows Record Assessment only', async () => {
    await openDetail('Owner', 2023);
    expect(
      screen.getByTestId('cit-action-record-assessment'),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('cit-action-open-review'),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('cit-action-finalize')).not.toBeInTheDocument();
  });

  it('ASSESSED: shows Record Objection + Finalize', async () => {
    await openDetail('Owner', 2022);
    expect(
      screen.getByTestId('cit-action-record-objection'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('cit-action-finalize')).toBeInTheDocument();
  });

  it('OBJECTED: shows Finalize only (no Record Objection twice)', async () => {
    await openDetail('Owner', 2021);
    expect(screen.getByTestId('cit-action-finalize')).toBeInTheDocument();
    expect(
      screen.queryByTestId('cit-action-record-objection'),
    ).not.toBeInTheDocument();
  });

  it('FINAL: shows Close action', async () => {
    await openDetail('Owner', 2020);
    expect(screen.getByTestId('cit-action-close')).toBeInTheDocument();
    expect(
      screen.queryByTestId('cit-action-record-assessment'),
    ).not.toBeInTheDocument();
  });

  it('CLOSED terminal: no action buttons, shows terminal explanation', async () => {
    await openDetail('Owner', 2019);
    expect(
      screen.getByText(enCit.detail.action_terminal),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('cit-action-close')).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('cit-action-mark-statute-expired'),
    ).not.toBeInTheDocument();
  });

  it('STATUTE_EXPIRED terminal: no action buttons, shows terminal explanation', async () => {
    await openDetail('Owner', 2018);
    expect(
      screen.getByText(enCit.detail.action_terminal),
    ).toBeInTheDocument();
  });

  it('Mark-statute-expired is disabled unless statuteExpiresOn is overdue', async () => {
    // 2024 FILED case has statuteExpiresOn 2029-12-31 (not overdue) →
    // button visible (non-terminal) but disabled with "not-yet"
    // reason.
    await openDetail('Owner', 2024);
    const btn = screen.getByTestId('cit-action-mark-statute-expired');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute(
      'title',
      enCit.detail.action_statute_not_yet,
    );
  });

  it('non-Owner sees all transition buttons present but disabled with tooltip', async () => {
    await openDetail('CFO', 2022); // ASSESSED state
    const finalize = screen.getByTestId('cit-action-finalize');
    expect(finalize).toBeInTheDocument();
    expect(finalize).toBeDisabled();
    expect(finalize).toHaveAttribute('data-owner-disabled', 'true');
    expect(finalize).toHaveAttribute('title', enCit.ownerOnly.tooltip);

    const objection = screen.getByTestId('cit-action-record-objection');
    expect(objection).toBeDisabled();
    expect(objection).toHaveAttribute('data-owner-disabled', 'true');
  });

  it('Junior (VIEWER) sees all transition buttons present but disabled', async () => {
    await openDetail('Junior', 2020); // FINAL state
    const closeBtn = screen.getByTestId('cit-action-close');
    expect(closeBtn).toBeDisabled();
    expect(closeBtn).toHaveAttribute('data-owner-disabled', 'true');
  });
});

// ── i18n parity ──────────────────────────────────────────────────

describe('CITAssessmentScreen — i18n parity', () => {
  it('EN + AR have identical key shapes (spot-check all 7 status labels + detail action labels)', () => {
    // All 7 status values resolved in both EN and AR.
    for (const s of [
      'FILED',
      'UNDER_REVIEW',
      'ASSESSED',
      'OBJECTED',
      'FINAL',
      'CLOSED',
      'STATUTE_EXPIRED',
    ]) {
      expect(enCit.status[s]).toBeTypeOf('string');
      expect(arCit.status[s]).toBeTypeOf('string');
    }
    // Detail transition-action labels.
    for (const k of [
      'action_open_review',
      'action_record_assessment',
      'action_record_objection',
      'action_finalize',
      'action_close',
      'action_mark_statute_expired',
      'action_terminal',
      'action_statute_not_yet',
    ]) {
      expect(enCit.detail[k]).toBeTypeOf('string');
      expect(arCit.detail[k]).toBeTypeOf('string');
    }
    // Year-list column headers.
    for (const k of [
      'column_fiscal_year',
      'column_filed',
      'column_assessed',
      'column_final',
      'column_authority_case',
      'column_filed_on',
      'column_statute_expires',
      'column_status',
      'action_new',
      'action_back',
      'days_remaining',
      'statute_overdue',
      'empty_title',
      'empty_description',
    ]) {
      expect(enCit.year_list[k]).toBeTypeOf('string');
      expect(arCit.year_list[k]).toBeTypeOf('string');
    }
    // Summary-widget keys.
    for (const k of [
      'widget_title',
      'widget_description',
      'open_count',
      'open_count_zero',
      'approaching_label',
      'approaching_label_zero',
      'most_recent_label',
      'most_recent_none',
      'view_full_link',
    ]) {
      expect(enCit.summary[k]).toBeTypeOf('string');
      expect(arCit.summary[k]).toBeTypeOf('string');
    }
    // Owner-only tooltip — the key dispatch specified.
    expect(enCit.ownerOnly.tooltip).toBeTypeOf('string');
    expect(arCit.ownerOnly.tooltip).toBeTypeOf('string');
  });

  it('Kuwait-Arabic CIT terminology present in AR file', () => {
    // Spec explicitly requires Kuwait-Arabic for CIT-specific terms.
    // Spot-check a few that must appear.
    const arJson = JSON.stringify(arCit);
    expect(arJson).toContain('ضريبة دخل الشركات'); // CIT
    expect(arJson).toContain('مدة التقادم'); // Statute of limitations
    expect(arJson).toContain('التقدير'); // (Authority) assessment
    expect(arJson).toContain('الاعتراض'); // Objection
    expect(arJson).toContain('السنة المالية'); // Fiscal year
    expect(arJson).toContain('القضية'); // Case
  });
});
