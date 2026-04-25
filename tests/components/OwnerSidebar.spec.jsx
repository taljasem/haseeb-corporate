/**
 * OwnerSidebar — HASEEB-446 (2026-04-24).
 *
 * Covers:
 *   1. Six accounting-operations screens are NOT present in the Owner
 *      sidebar (year-end close, migration, payroll, payment vouchers,
 *      PIFSS reconciliation, CIT assessment). These belong in the CFO
 *      view; Owner view is strategic-only.
 *   2. Strategic-retained items are still present (Today, Taskbox,
 *      Overview, Financial Statements, Board Pack, Budget, Month-End
 *      Close, Audit Bridge, ECL, Contacts, Bank Mandates).
 *   3. Rendering works in both EN and AR so the removal holds across
 *      locales (no hard-coded English label in the sidebar data).
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import React from 'react';

import i18n from '../../src/i18n';
import enSidebar from '../../src/i18n/locales/en/sidebar.json';
import arSidebar from '../../src/i18n/locales/ar/sidebar.json';

import OwnerSidebar from '../../src/components/owner/OwnerSidebar';

async function setLang(lang) {
  await act(async () => {
    await i18n.changeLanguage(lang);
  });
}

// Labels like "ECL (IFRS 9)" and "PIFSS Reconciliation (Annual)" contain
// regex metacharacters; escape them before constructing RegExp.
function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const REMOVED_KEYS = [
  'year_end_close',
  'migration',
  'payroll',
  'payment_vouchers',
  'pifss_reconciliation',
  'cit_assessment',
];

const RETAINED_KEYS = [
  'today',
  'taskbox',
  'overview',
  'bank_accounts',
  'financial_statements',
  'board_pack',
  'budget',
  'month_end_close',
  'audit_bridge',
  'ecl',
  'contacts',
  'bank_mandates',
];

describe('OwnerSidebar — HASEEB-446 accounting-operations removal', () => {
  afterEach(() => {
    cleanup();
  });

  it('does NOT render the 6 accounting-operations items (EN)', async () => {
    await setLang('en');
    render(<OwnerSidebar active="today" setActive={() => {}} />);

    for (const key of REMOVED_KEYS) {
      const label = enSidebar.items[key];
      expect(
        screen.queryByRole('button', { name: new RegExp(`^${escapeRegExp(label)}$`, 'i') }),
        `Owner sidebar must not expose "${label}" (key: ${key})`,
      ).toBeNull();
    }
  });

  it('does NOT render the 6 accounting-operations items (AR)', async () => {
    await setLang('ar');
    render(<OwnerSidebar active="today" setActive={() => {}} />);

    for (const key of REMOVED_KEYS) {
      const label = arSidebar.items[key];
      expect(
        screen.queryByRole('button', { name: new RegExp(escapeRegExp(label)) }),
        `Owner sidebar must not expose "${label}" (key: ${key})`,
      ).toBeNull();
    }

    // Reset for downstream tests.
    await setLang('en');
  });

  it('retains the strategic and operational items that belong in Owner view', async () => {
    await setLang('en');
    render(<OwnerSidebar active="today" setActive={() => {}} />);

    for (const key of RETAINED_KEYS) {
      const label = enSidebar.items[key];
      expect(
        screen.getByRole('button', { name: new RegExp(`^${escapeRegExp(label)}$`, 'i') }),
        `Owner sidebar must still expose "${label}" (key: ${key})`,
      ).toBeTruthy();
    }
  });
});

/**
 * HASEEB-490 amendment (2026-04-25) — OwnerSidebar must expose Setup as
 * a navigable nav item, not just leave it reachable through programmatic
 * setActiveScreen("setup"). Sarah Phase 5 verification needs sidebar
 * access like a real Owner user. Mirrors CFOSidebar's Setup item which
 * lives in the operations group between ECL and Contacts.
 */
describe('OwnerSidebar — HASEEB-490 amendment Setup nav item', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the Setup nav item and routes clicks to setActive("setup")', async () => {
    await setLang('en');
    const setActive = vi.fn();
    render(<OwnerSidebar active="today" setActive={setActive} />);

    const setupButton = screen.getByRole('button', {
      name: new RegExp(`^${escapeRegExp(enSidebar.items.setup)}$`, 'i'),
    });
    expect(setupButton, 'Owner sidebar must expose Setup as a button').toBeTruthy();

    fireEvent.click(setupButton);
    expect(setActive).toHaveBeenCalledWith('setup');
  });
});
