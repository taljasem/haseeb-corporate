/**
 * AgingReportsScreen — Track B first-wire regression.
 *
 * Phase 4 Wave 1 (Phase 4 Track B Tier 2; 2026-04-19). Asserts that the
 * screen renders a stubbed real-endpoint response shape for both AR and
 * AP. The engine router module is mocked at the boundary so this test
 * exercises the full adapter chain from api/aging.js through the engine's
 * wired surface into AgingReportsScreen's render pipeline — which is the
 * minimum bar the Track B wire method establishes.
 *
 * Test setup is MOCK mode per vitest.config.js (VITE_USE_MOCKS=true), so
 * the engine router would normally return mockEngine data. To drive the
 * live response-shape through the render code, we vi.mock the engine
 * module directly and stub getAgingReport to return the adapted live
 * shape that api/aging.js produces. If any screen-level code reads a
 * mock-only field that isn't in the live adapter's output, this test
 * surfaces it.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, act, fireEvent } from '@testing-library/react';
import React from 'react';

import i18n from '../../src/i18n';

// ── Sample responses (shape of what the Corporate API returns) ───────────
const AR_OVERVIEW_ANALYTICS = {
  monthlyTrend: [
    { month: 'Jan', revenue: 100, expenses: 50 },
    { month: 'Feb', revenue: 110, expenses: 55 },
    { month: 'Mar', revenue: 120, expenses: 60 },
    { month: 'Apr', revenue: 130, expenses: 65 },
    { month: 'May', revenue: 140, expenses: 70 },
    { month: 'Jun', revenue: 150, expenses: 75 },
  ],
  expenseBreakdown: [],
  invoiceStats: [],
  receivableAging: {
    current: 12000,
    '1-30': 8000,
    '31-60': 5000,
    '61-90': 3000,
    '90+': 1500,
  },
  topRevenue: [],
};

const AR_INVOICE_LIST = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    invoiceNumber: 'INV-2026-0001',
    refNumber: 'REF-1',
    customer: { id: 'c1', nameEn: 'Acme Holdings', nameAr: 'أكمي القابضة' },
    issueDate: new Date(Date.now() - 45 * 86400000).toISOString(),
    dueDate: new Date(Date.now() - 15 * 86400000).toISOString(), // 15 days overdue
    totalAmount: 5000,
    amountPaid: 0,
    status: 'SENT',
    lines: [
      { description: 'Consulting', quantity: 10, unitPrice: 500 },
    ],
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    invoiceNumber: 'INV-2026-0002',
    refNumber: 'REF-2',
    customer: { id: 'c2', nameEn: 'Beacon LLC', nameAr: 'بيكن' },
    issueDate: new Date(Date.now() - 120 * 86400000).toISOString(),
    dueDate: new Date(Date.now() - 95 * 86400000).toISOString(), // 90+ bucket
    totalAmount: 3000,
    amountPaid: 0,
    status: 'SENT',
    lines: [],
  },
];

const AP_AGING_RESPONSE = {
  current: 4000,
  days1to30: 2500,
  days31to60: 1200,
  days61to90: 800,
  days90plus: 500,
  total: 9000,
  details: [
    {
      billId: '33333333-3333-3333-3333-333333333333',
      billNumber: 'BILL-2026-0001',
      vendor: { id: 'v1', nameEn: 'Office Supplies Co.', nameAr: 'مكتب' },
      dueDate: new Date(Date.now() - 10 * 86400000).toISOString(),
      totalAmount: 2500,
      amountPaid: 0,
      outstanding: 2500,
      daysOverdue: 10,
      bucket: '1-30',
    },
  ],
};

// ── Mock the api/client used by api/aging.js ─────────────────────────────
// The adapter in api/aging.js calls client.get. We install a vi.mock so
// the adapter produces its output without needing a real network.
vi.mock('../../src/api/client', () => {
  return {
    default: {
      get: vi.fn((url) => {
        if (url === '/api/reports/overview-analytics') {
          return Promise.resolve({ data: { data: AR_OVERVIEW_ANALYTICS } });
        }
        if (url === '/api/invoices') {
          return Promise.resolve({ data: { data: AR_INVOICE_LIST } });
        }
        if (url === '/api/bills/ap-aging') {
          return Promise.resolve({ data: { data: AP_AGING_RESPONSE } });
        }
        return Promise.resolve({ data: { data: null } });
      }),
      post: vi.fn(() => Promise.resolve({ data: { data: { ok: true } } })),
    },
    setAuthToken: () => {},
    clearAuthToken: () => {},
    getAuthToken: () => '',
  };
});

// Mock the engine router to route getAgingReport through the live adapter
// (api/aging.js) even in MOCK mode. This gives us end-to-end coverage of
// the adapter + render pipeline without relying on the runtime env flag.
vi.mock('../../src/engine', async () => {
  // Pull in the live aging adapter (which now uses the stubbed client).
  const agingApi = await import('../../src/api/aging');
  return {
    __esModule: true,
    getAgingReport: agingApi.getAgingReport,
    // Provide no-op implementations for the other engine surface the
    // screen + modals import so their ambient imports don't crash.
    getInvoiceDetail: async () => null,
    logPayment: async () => ({ ok: true }),
    createWriteOffJE: async () => ({ ok: true }),
    getChartOfAccounts: async () => [],
    sendAgingReminder: async () => ({ ok: true }),
    markInvoiceDisputed: async () => ({ ok: true }),
    scheduleVendorPayment: async () => ({ ok: true }),
  };
});

import { TenantProvider } from '../../src/components/shared/TenantContext';
import AgingReportsScreen from '../../src/screens/cfo/AgingReportsScreen';

async function setLang(lang) {
  await act(async () => { await i18n.changeLanguage(lang); });
}

function renderScreen() {
  return render(
    <TenantProvider>
      <AgingReportsScreen />
    </TenantProvider>,
  );
}

describe('AgingReportsScreen — Track B live wire (Phase 4 Wave 1)', () => {
  beforeEach(async () => {
    await setLang('en');
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the AR aging table against a stubbed overview-analytics + /api/invoices response', async () => {
    renderScreen();

    // Loading indicator is visible before the async getAgingReport returns.
    expect(screen.getByText(/Loading aging report/i)).toBeInTheDocument();

    // Wait for the first customer to render — proves the adapter produced
    // the expected { invoices: [{partyName, ...}] } shape.
    await waitFor(
      () => {
        expect(screen.getByText('Acme Holdings')).toBeInTheDocument();
      },
      { timeout: 2000 },
    );

    // Second customer also present.
    expect(screen.getByText('Beacon LLC')).toBeInTheDocument();

    // Hero bucket labels render (from i18n) — there are two "Total
    // outstanding" labels (the total bucket card + possibly the total
    // strip), so getAllByText is the right assertion.
    expect(screen.getAllByText(/Total outstanding/i).length).toBeGreaterThan(0);
    // Total from receivableAging = 12000 + 8000 + 5000 + 3000 + 1500 = 29,500
    // The hero renders with `fmtKWD` (no decimals, en-US grouping).
    expect(screen.getByText('29,500')).toBeInTheDocument();
  });

  it('switches to AP and renders the bill row from /api/bills/ap-aging', async () => {
    renderScreen();

    // Wait for AR to finish loading first.
    await waitFor(
      () => expect(screen.getByText('Acme Holdings')).toBeInTheDocument(),
      { timeout: 2000 },
    );

    // Flip to AP tab.
    fireEvent.click(screen.getByText('Payables'));

    await waitFor(
      () => {
        expect(screen.getByText('Office Supplies Co.')).toBeInTheDocument();
      },
      { timeout: 2000 },
    );

    // AP total from stub = 9000.
    expect(screen.getByText('9,000')).toBeInTheDocument();
  });
});
