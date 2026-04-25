/**
 * HASEEB-482 (DECISION-026 Phase 2 frontend, 2026-04-24) — tests for the
 * approval-policy Setup section. Mocks `src/api/approvalPolicy` so the
 * component-under-test is purely the UI logic (table render, role-
 * gating, partial-update PATCH on save, bilingual).
 *
 * Coverage:
 *   1. Renders the four tier rows from a mock GET response.
 *   2. Owner role: inputs editable. Non-Owner: inputs disabled with
 *      banner.
 *   3. Save calls updateApprovalPolicy with ONLY the changed fields
 *      (partial update).
 *   4. Arabic locale renders the Arabic table headers + banner.
 *   5. Client-side validation rejects auto >= reviewer BEFORE PATCH.
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

const getApprovalPolicySpy = vi.fn();
const updateApprovalPolicySpy = vi.fn();

vi.mock('../../src/api/approvalPolicy', () => ({
  __esModule: true,
  getApprovalPolicy: (...args) => getApprovalPolicySpy(...args),
  updateApprovalPolicy: (...args) => updateApprovalPolicySpy(...args),
}));

import ApprovalPolicySection from '../../src/components/setup/ApprovalPolicySection';

// Minimal stand-ins for the helpers SetupScreen passes in. The component
// only uses these for layout chrome — they don't affect the assertions.
function Card({ title, description, children }) {
  return (
    <section data-testid="card">
      <h2 data-testid="card-title">{title}</h2>
      <p data-testid="card-description">{description}</p>
      {children}
    </section>
  );
}
function Toast({ text }) {
  return text ? <div data-testid="toast">{text}</div> : null;
}
function FormRow({ label, children }) {
  return (
    <div data-testid="form-row">
      <span>{label}</span>
      {children}
    </div>
  );
}
const inputStyle = { width: '100%' };
const btnPrimary = (loading) => ({
  background: loading ? 'gray' : 'teal',
  cursor: loading ? 'not-allowed' : 'pointer',
});

const POLICY_FIXTURE = {
  policyId: 'pol_001',
  thresholds: {
    autoApproveCeilingKwd: '1000.000',
    reviewerApprovalCeilingKwd: '25000.000',
    cfoApprovalCeilingKwd: '100000.000',
    boardAckThresholdKwd: '100000.000',
  },
  reviewerQualificationRules: {
    minCategorizationConfidence: 0.85,
    requireVerifiedMerchantBelowKwd: '500.000',
  },
  effectiveFrom: '2026-04-24T00:00:00.000Z',
  effectiveTo: null,
  createdAt: '2026-04-24T00:00:00.000Z',
  createdBy: 'user_owner_42',
  lastUpdatedAt: '2026-04-24T00:00:00.000Z',
  lastUpdatedBy: 'user_owner_42',
};

async function setLang(lang) {
  await act(async () => {
    await i18n.changeLanguage(lang);
  });
}

function renderSection(role = 'Owner') {
  return render(
    <ApprovalPolicySection
      role={role}
      Card={Card}
      Toast={Toast}
      FormRow={FormRow}
      inputStyle={inputStyle}
      btnPrimary={btnPrimary}
    />,
  );
}

describe('HASEEB-482 — ApprovalPolicySection', () => {
  beforeEach(async () => {
    getApprovalPolicySpy.mockReset();
    updateApprovalPolicySpy.mockReset();
    getApprovalPolicySpy.mockResolvedValue(POLICY_FIXTURE);
    updateApprovalPolicySpy.mockResolvedValue(POLICY_FIXTURE);
    await setLang('en');
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the four tier rows populated from the mock GET response', async () => {
    renderSection('Owner');
    // Section title in EN.
    expect(await screen.findByText('Approval Thresholds')).toBeInTheDocument();
    // The four KWD inputs land with the seeded values (after the
    // initial GET resolves).
    await waitFor(() => {
      expect(
        screen.getByLabelText('Auto-post ceiling in KWD'),
      ).toHaveValue(1000);
    });
    expect(screen.getByLabelText('Senior accountant ceiling in KWD')).toHaveValue(25000);
    expect(screen.getByLabelText('CFO ceiling in KWD')).toHaveValue(100000);
    expect(screen.getByLabelText('Board threshold in KWD')).toHaveValue(100000);
    // All four tier labels are visible.
    expect(screen.getByText('Auto-post')).toBeInTheDocument();
    expect(screen.getByText('Senior accountant')).toBeInTheDocument();
    expect(screen.getByText('CFO')).toBeInTheDocument();
    expect(screen.getByText('Board')).toBeInTheDocument();
  });

  it('Owner role: inputs editable; non-Owner role: inputs disabled with banner', async () => {
    // Non-Owner: CFO sees the banner + disabled inputs.
    renderSection('CFO');
    expect(
      await screen.findByText('Only the Owner can edit approval thresholds.'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText('Auto-post ceiling in KWD')).toBeDisabled();
    });
    expect(screen.getByLabelText('Senior accountant ceiling in KWD')).toBeDisabled();
    expect(screen.getByLabelText('CFO ceiling in KWD')).toBeDisabled();
    expect(screen.getByLabelText('Board threshold in KWD')).toBeDisabled();

    cleanup();

    // Owner: inputs are editable; no banner.
    renderSection('Owner');
    await waitFor(() => {
      expect(
        screen.getByLabelText('Auto-post ceiling in KWD'),
      ).not.toBeDisabled();
    });
    expect(
      screen.queryByText('Only the Owner can edit approval thresholds.'),
    ).toBeNull();
  });

  it('Save calls updateApprovalPolicy with ONLY the changed fields', async () => {
    renderSection('Owner');
    await waitFor(() => {
      expect(
        screen.getByLabelText('Auto-post ceiling in KWD'),
      ).toHaveValue(1000);
    });
    // Change only the auto-post ceiling.
    fireEvent.change(screen.getByLabelText('Auto-post ceiling in KWD'), {
      target: { value: '2000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save thresholds/i }));
    await waitFor(() => {
      expect(updateApprovalPolicySpy).toHaveBeenCalledTimes(1);
    });
    const patch = updateApprovalPolicySpy.mock.calls[0][0];
    // Partial update — only the changed field.
    expect(patch).toEqual({ autoApproveCeilingKwd: '2000.000' });
    expect(patch.reviewerApprovalCeilingKwd).toBeUndefined();
    expect(patch.cfoApprovalCeilingKwd).toBeUndefined();
    expect(patch.boardAckThresholdKwd).toBeUndefined();
  });

  it('Arabic locale renders Arabic table headers and banner', async () => {
    await setLang('ar');
    renderSection('CFO');
    expect(
      await screen.findByText('يمكن لصاحب الحساب فقط تعديل حدود الاعتماد.'),
    ).toBeInTheDocument();
    expect(screen.getByText('حدود الاعتماد')).toBeInTheDocument();
    // Arabic tier labels.
    expect(screen.getByText('اعتماد تلقائي')).toBeInTheDocument();
    expect(screen.getByText('المحاسب الأول')).toBeInTheDocument();
    expect(screen.getByText('المدير المالي')).toBeInTheDocument();
    expect(screen.getByText('مجلس الإدارة')).toBeInTheDocument();
    await setLang('en');
  });

  it('client-side validation rejects auto >= reviewer BEFORE the PATCH fires', async () => {
    renderSection('Owner');
    await waitFor(() => {
      expect(
        screen.getByLabelText('Auto-post ceiling in KWD'),
      ).toHaveValue(1000);
    });
    // Type a value above the reviewer ceiling — degenerate ordering.
    fireEvent.change(screen.getByLabelText('Auto-post ceiling in KWD'), {
      target: { value: '50000' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save thresholds/i }));
    await waitFor(() => {
      expect(
        screen.getByText(
          /Auto-post ceiling must be less than the senior accountant ceiling/i,
        ),
      ).toBeInTheDocument();
    });
    // PATCH never fired.
    expect(updateApprovalPolicySpy).not.toHaveBeenCalled();
  });
});
