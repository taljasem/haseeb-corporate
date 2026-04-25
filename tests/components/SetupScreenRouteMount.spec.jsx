/**
 * HASEEB-490 (DECISION-026 P0-2) — verify OwnerView and CFOView mount
 * SetupScreen and forward the actual normalized user role through to
 * the screen, so ApprovalPolicySection's OWNER-only edit gate fires
 * for the real Owner user (and ONLY for the real Owner user).
 *
 * Sarah Phase 4 verification finding (2026-04-25): SetupScreen was
 * mounted only inside CFOView with `role="CFO"` hardcoded, and not
 * mounted in OwnerView at all — so an Owner navigating to Setup
 * either saw no Setup screen or saw the CFOView mount where the
 * hardcoded "CFO" overrode their actual role and disabled the
 * threshold inputs. The fix:
 *   1. Add SetupScreen mount to OwnerView with role={normalizedRole}
 *   2. Change CFOView mount to forward the actual user role too
 *      (architectural symmetry — CFO still normalizes to ROLES.CFO,
 *      so the disabled-inputs+banner behaviour is preserved for the
 *      production CFO user).
 *
 * Coverage:
 *   1. OwnerView with role="Owner" + activeScreen="setup" → SetupScreen
 *      mounted with role="Owner".
 *   2. CFOView with role="CFO" + activeScreen="setup" → SetupScreen
 *      mounted with role="CFO" (CFO sees disabled-inputs+banner).
 *   3. CFOView with role="Owner" + activeScreen="setup" → SetupScreen
 *      mounted with role="Owner" (proves the previous hardcoded
 *      `role="CFO"` was the bug; with the fix, the actual user role
 *      threads through regardless of which dispatcher mounts the
 *      screen).
 *
 * The test mocks SetupScreen to a marker component that exposes the
 * forwarded `role` prop in the DOM; this isolates the dispatcher-
 * forwarding contract from SetupScreen's own (heavy) wiring.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import React from 'react';

import i18n from '../../src/i18n';

// Marker component for SetupScreen — exposes the forwarded `role`
// prop via a data attribute so the test can read it back.
function SetupScreenMarker(props) {
  return (
    <div
      data-testid="setup-screen-marker"
      data-forwarded-role={props.role}
    >
      Setup ({props.role})
    </div>
  );
}

vi.mock('../../src/screens/cfo/SetupScreen', () => ({
  __esModule: true,
  default: SetupScreenMarker,
}));

// Mock the heavy sidebars so we don't need the full sidebar render
// machinery — we drive activeScreen via the registerNav callback the
// dispatcher exposes, not via clicking a sidebar nav item.
function StubSidebar() {
  return <aside data-testid="stub-sidebar" />;
}
vi.mock('../../src/components/owner/OwnerSidebar', () => ({
  __esModule: true,
  default: StubSidebar,
}));
vi.mock('../../src/components/cfo/CFOSidebar', () => ({
  __esModule: true,
  default: StubSidebar,
}));
vi.mock('../../src/components/owner/OwnerHeroBand', () => ({
  __esModule: true,
  default: () => <div data-testid="hero" />,
}));
vi.mock('../../src/components/cfo/CFOHeroBand', () => ({
  __esModule: true,
  default: () => <div data-testid="hero" />,
}));
vi.mock('../../src/components/cfo/AminahSlideOver', () => ({
  __esModule: true,
  default: () => null,
}));
vi.mock('../../src/components/taskbox/NewTaskModal', () => ({
  __esModule: true,
  default: () => null,
}));

// Engine boundary — the dispatcher views call getOpenTaskCount /
// getOpenApprovalCount on mount to hydrate sidebar badges. Override
// just those two; defer to the real engine for everything else so
// the dozens of CFO child screens (transitively imported via
// CFOView) don't blow up at module-eval time.
vi.mock('../../src/engine', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getOpenTaskCount: vi.fn().mockResolvedValue(0),
    getOpenApprovalCount: vi.fn().mockResolvedValue(0),
  };
});

// taskbox event bus — return an unsub no-op so the useEffect cleanup
// path is well-defined.
vi.mock('../../src/utils/taskboxBus', () => ({
  __esModule: true,
  subscribeTaskbox: () => () => {},
}));

import { TenantProvider } from '../../src/components/shared/TenantContext';
import OwnerView from '../../src/screens/owner/OwnerView';
import CFOView from '../../src/screens/cfo/CFOView';

async function setLang(lang) {
  await act(async () => {
    await i18n.changeLanguage(lang);
  });
}

/**
 * Render the dispatcher and drive its activeScreen state to "setup"
 * via the registerNav callback the dispatcher exposes on mount. This
 * mirrors the real-app flow where Header / sidebar / NavContext drive
 * navigation, without needing the full sidebar tree to be present.
 */
async function renderAndNavigateToSetup(View, role) {
  let nav = null;
  const registerNav = (handlers) => {
    nav = handlers;
  };

  const utils = render(
    <TenantProvider>
      <View registerNav={registerNav} role={role} />
    </TenantProvider>,
  );

  // Dispatcher registers its nav handlers in a useEffect after first
  // commit; flush effects before we use them.
  await act(async () => {
    await Promise.resolve();
  });

  expect(nav).not.toBeNull();
  await act(async () => {
    nav.setActiveScreen('setup');
  });

  return utils;
}

describe('HASEEB-490 — Setup mount forwards the actual user role', () => {
  beforeEach(async () => {
    await setLang('en');
  });

  afterEach(() => {
    cleanup();
  });

  it('OwnerView with role="Owner" mounts SetupScreen with role="Owner"', async () => {
    await renderAndNavigateToSetup(OwnerView, 'Owner');

    const marker = await screen.findByTestId('setup-screen-marker');
    // The actual Owner user threads through — ApprovalPolicySection's
    // `normalizedRole === ROLES.OWNER` check fires, so threshold
    // inputs are editable (proven separately in
    // ApprovalPolicySection.spec.jsx).
    expect(marker.getAttribute('data-forwarded-role')).toBe('Owner');
  });

  it('CFOView with role="CFO" mounts SetupScreen with role="CFO"', async () => {
    await renderAndNavigateToSetup(CFOView, 'CFO');

    const marker = await screen.findByTestId('setup-screen-marker');
    // CFO normalizes to ROLES.CFO (≠ ROLES.OWNER), so the production
    // CFO user still sees disabled-inputs + Owner-only banner —
    // current behaviour preserved post the dispatcher fix.
    expect(marker.getAttribute('data-forwarded-role')).toBe('CFO');
  });

  it('CFOView with role="Owner" mounts SetupScreen with role="Owner" (proves prior hardcode was the bug)', async () => {
    // Before HASEEB-490, this case would have rendered SetupScreen
    // with role="CFO" no matter the actual user role — the hardcode
    // won out over the auth context. With the fix, the real role
    // threads through symmetrically from either dispatcher.
    await renderAndNavigateToSetup(CFOView, 'Owner');

    const marker = await screen.findByTestId('setup-screen-marker');
    expect(marker.getAttribute('data-forwarded-role')).toBe('Owner');
  });

  it('OwnerView with role="CFO" (defensive: someone routes CFO into OwnerView) mounts SetupScreen with role="CFO"', async () => {
    // App.jsx only mounts OwnerView when the active role is "Owner",
    // so this combination shouldn't occur in production — but the
    // dispatcher must still forward whatever role it receives so the
    // contract is unambiguous.
    await renderAndNavigateToSetup(OwnerView, 'CFO');

    const marker = await screen.findByTestId('setup-screen-marker');
    expect(marker.getAttribute('data-forwarded-role')).toBe('CFO');
  });
});
