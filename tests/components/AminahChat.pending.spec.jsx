/**
 * AminahChat proactive surface — Wave 6B.3 Layer 3 tests.
 *
 * These tests run in MOCK mode (the engine router's default), which wires
 * listAdvisorPending / defer / dismiss / acknowledge to the in-memory
 * stub at src/engine/aminah/advisor-pending-stub.js. That stub seeds
 * 2 items on mount:
 *   mock-pending-1 — statutory-reserve, warning, pendingJeId set → Confirm visible
 *   mock-pending-2 — compliance-calendar, info, no pendingJeId → Confirm hidden
 *
 * Coverage matrix mirrors the task spec acceptance criteria:
 *   1. Both cards render with their subjects.
 *   2. Defer on card 1 → 3-days option → card disappears.
 *   3. Dismiss on card 2 (severity=info) → no modal → card disappears.
 *   4. AR language → messageAr visible for card 1.
 *   5. Junior role → Dismiss button hidden.
 *
 * The AuthProvider is NOT mounted; useAuth's authUser stays null, and
 * AminahChat falls back to the `role` prop for Dismiss authorization.
 * This mirrors the role-aware-render pattern used throughout the dashboard.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within, cleanup, waitFor, fireEvent, act } from '@testing-library/react';
import React from 'react';

import AminahChat from '../../src/components/AminahChat';
import i18n from '../../src/i18n';
import { _resetAdvisorPendingStub } from '../../src/engine/aminah/advisor-pending-stub';

// ── Stubs ────────────────────────────────────────────────────────────────
//
// AminahChat calls useAuth() directly. We stub the hook to return a plausible
// user object whose role matches the test's intent. This isolates the
// component from the real auth provider and the real API.

vi.mock('../../src/contexts/AuthContext', () => {
  let _role = null;
  return {
    __setAuthRole: (role) => { _role = role; },
    useAuth: () => ({ user: _role ? { role: _role } : null, tenant: null, token: null, isAuthenticated: !!_role }),
  };
});

// The MOCK-mode mockEngine session helpers are side-effect free for our
// purposes, but they do write to a global session store. Reset lang state
// too so EN is the default in each test.
import { __setAuthRole } from '../../src/contexts/AuthContext';

async function setLang(lang) {
  await act(async () => { await i18n.changeLanguage(lang); });
}

describe('AminahChat — advisor pending surface (Wave 6B.3 Layer 3)', () => {
  beforeEach(async () => {
    _resetAdvisorPendingStub();
    __setAuthRole(null);
    await setLang('en');
  });

  afterEach(() => {
    cleanup();
  });

  async function renderAndWaitForCards(props = { role: 'CFO' }) {
    render(<AminahChat {...props} />);
    // Stub has an 80ms delay; wait until both cards appear.
    await waitFor(
      () => {
        expect(screen.getByTestId('advisor-pending-card-mock-pending-1')).toBeInTheDocument();
        expect(screen.getByTestId('advisor-pending-card-mock-pending-2')).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  }

  it('renders both seeded cards with their subjects', async () => {
    __setAuthRole('OWNER');
    await renderAndWaitForCards({ role: 'Owner' });

    expect(
      screen.getByText('Statutory reserve transfer due March 31')
    ).toBeInTheDocument();
    expect(
      screen.getByText('March PIFSS due April 15')
    ).toBeInTheDocument();
  });

  it('defers card 1 via the 3-days option and removes the card', async () => {
    __setAuthRole('OWNER');
    await renderAndWaitForCards({ role: 'Owner' });

    // Open defer menu on card 1
    const deferBtn = screen.getByTestId('advisor-pending-defer-mock-pending-1');
    fireEvent.click(deferBtn);

    const menu = await screen.findByTestId('advisor-pending-defer-menu-mock-pending-1');
    expect(menu).toBeInTheDocument();

    // Pick 3 days
    const threeDays = within(menu).getByTestId('advisor-pending-defer-opt-three_days-mock-pending-1');
    fireEvent.click(threeDays);

    await waitFor(() => {
      expect(screen.queryByTestId('advisor-pending-card-mock-pending-1')).not.toBeInTheDocument();
    });
    // Card 2 still present
    expect(screen.getByTestId('advisor-pending-card-mock-pending-2')).toBeInTheDocument();
  });

  it('dismisses info-severity card 2 with NO confirmation modal', async () => {
    __setAuthRole('OWNER');
    await renderAndWaitForCards({ role: 'Owner' });

    const dismissBtn = screen.getByTestId('advisor-pending-dismiss-mock-pending-2');
    fireEvent.click(dismissBtn);

    // No modal should appear for info-severity
    expect(screen.queryByTestId('advisor-pending-dismiss-modal')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByTestId('advisor-pending-card-mock-pending-2')).not.toBeInTheDocument();
    });
    // Card 1 still present
    expect(screen.getByTestId('advisor-pending-card-mock-pending-1')).toBeInTheDocument();
  });

  it('renders messageAr when the active language is Arabic', async () => {
    __setAuthRole('OWNER');
    await setLang('ar');
    await renderAndWaitForCards({ role: 'Owner' });

    // messageAr on card 1 is the Arabic text seeded in the stub.
    expect(
      screen.getByText('تحويل الاحتياطي القانوني مستحق في 31 مارس')
    ).toBeInTheDocument();
    // EN message on card 1 should NOT be rendered.
    expect(
      screen.queryByText("I computed 4,200 KWD from current retained earnings. Ready to post — confirm?")
    ).not.toBeInTheDocument();
  });

  it('hides the Dismiss button for Junior role (role-prop fallback)', async () => {
    // Auth user intentionally left unset — UI falls back to the role prop.
    await renderAndWaitForCards({ role: 'Junior' });

    expect(
      screen.queryByTestId('advisor-pending-dismiss-mock-pending-1')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('advisor-pending-dismiss-mock-pending-2')
    ).not.toBeInTheDocument();

    // Defer is still available to non-Owners
    expect(screen.getByTestId('advisor-pending-defer-mock-pending-1')).toBeInTheDocument();
  });
});
