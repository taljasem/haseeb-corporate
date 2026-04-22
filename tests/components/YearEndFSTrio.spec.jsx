/**
 * YEAR-END-FS-TRIO — AUDIT-ACC-040 + HASEEB-213 + HASEEB-216
 *
 * Covers three closures shipped in a single dispatch:
 *   1. SOCIE tab on FinancialStatementsScreen (HASEEB-213)
 *   2. IAS 8 restatement watermark rendering (HASEEB-216)
 *   3. DisclosureNotes frontend surface (AUDIT-ACC-040)
 *
 * Engine surface is mocked at `../../src/engine` so the render path
 * exercises the full screen without touching network or the real
 * mockEngine tenant seed.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  within,
  cleanup,
  fireEvent,
  act,
  waitFor,
} from '@testing-library/react';
import React from 'react';

import i18n from '../../src/i18n';
import enFinancial from '../../src/i18n/locales/en/financial.json';
import arFinancial from '../../src/i18n/locales/ar/financial.json';

// ── Engine stubs ────────────────────────────────────────────────
// Every wrapper the screen pulls from `../../engine` must be spied so
// act() resolves and setState is batched inside the screen's effects.

const getIncomeStatementSpy = vi.fn();
const getBalanceSheetSpy = vi.fn();
const getCashFlowStatementSpy = vi.fn();
const getStatementOfChangesInEquitySpy = vi.fn();
const getDisclosureNotesSpy = vi.fn();
const listReportVersionsSpy = vi.fn();

vi.mock('../../src/engine', () => ({
  __esModule: true,
  getIncomeStatement: (...a) => getIncomeStatementSpy(...a),
  getBalanceSheet: (...a) => getBalanceSheetSpy(...a),
  getCashFlowStatement: (...a) => getCashFlowStatementSpy(...a),
  getStatementOfChangesInEquity: (...a) =>
    getStatementOfChangesInEquitySpy(...a),
  getDisclosureNotes: (...a) => getDisclosureNotesSpy(...a),
  listReportVersions: (...a) => listReportVersionsSpy(...a),
}));

// mockEngine helpers the screen still imports directly.
vi.mock('../../src/engine/mockEngine', () => ({
  __esModule: true,
  getAdjustingEntries: vi.fn().mockResolvedValue([]),
  getLineNotes: vi.fn().mockResolvedValue([]),
  exportStatement: vi.fn().mockResolvedValue({
    url: null,
    filename: 'mock-export.pdf',
  }),
}));

// TenantContext: minimal shim that returns a plausible tenant shape.
vi.mock('../../src/components/shared/TenantContext', () => ({
  __esModule: true,
  useTenant: () => ({
    tenant: {
      id: 'almanara',
      company: { shortName: 'Al Manara', nameEn: 'Al Manara Trading' },
    },
    setTenant: vi.fn(),
  }),
  TenantProvider: ({ children }) => children,
}));

import FinancialStatementsScreen from '../../src/screens/shared/FinancialStatementsScreen';

// ── Fixtures ─────────────────────────────────────────────────────

function legacyStatementFixture(kind) {
  return {
    period: 'March 2026',
    aminahNarration: null,
    sections: [
      {
        name: kind === 'balance' ? 'ASSETS' : 'REVENUE',
        lines: [
          { account: '1100 Cash', code: '1100', current: 500, prior: 400, change: 100, percentChange: 25 },
          { account: '5100 Opex', code: '5100', current: 120, prior: 100, change: 20, percentChange: 20 },
        ],
        subtotal: { label: 'Subtotal', current: 620, prior: 500 },
      },
      { name: 'TOTAL', highlight: 'teal', final: true, current: 620, prior: 500 },
    ],
  };
}

function socieFixture({ withWatermark = false, withPrior = true } = {}) {
  const components = [
    {
      category: 'SHARE_CAPITAL',
      labelEn: 'Share Capital',
      labelAr: 'رأس المال',
      accountCodes: ['3100'],
      openingBalance: 1000000,
      profitLoss: null,
      otherComprehensiveIncome: 0,
      transactionsWithOwners: 0,
      transfersBetweenComponents: 0,
      closingBalance: 1000000,
      restatedMarker: null,
    },
    {
      category: 'STATUTORY_RESERVE',
      labelEn: 'Statutory Reserve',
      labelAr: 'الاحتياطي القانوني',
      accountCodes: ['3210'],
      openingBalance: 250000,
      profitLoss: null,
      otherComprehensiveIncome: 0,
      transactionsWithOwners: 0,
      transfersBetweenComponents: 38000,
      closingBalance: 288000,
      restatedMarker: null,
    },
    {
      category: 'RETAINED_EARNINGS',
      labelEn: 'Retained Earnings',
      labelAr: 'الأرباح المرحلة',
      accountCodes: ['3300'],
      openingBalance: 650000,
      profitLoss: 380000,
      otherComprehensiveIncome: 0,
      transactionsWithOwners: -100000,
      transfersBetweenComponents: -38000,
      closingBalance: 892000,
      restatedMarker: withWatermark ? 'RESTATED_IAS8' : null,
    },
  ];
  return {
    fromDate: '2025-01-01',
    toDate: '2025-12-31',
    components,
    totalOpeningBalance: 1900000,
    totalProfitLoss: 380000,
    totalOtherComprehensiveIncome: 0,
    totalTransactionsWithOwners: -100000,
    totalTransfersBetweenComponents: 0,
    totalClosingBalance: 2180000,
    isBalanced: true,
    priorPeriod: withPrior
      ? {
          fromDate: '2024-01-01',
          toDate: '2024-12-31',
          components: components.map((c) => ({ ...c, restatedMarker: null })),
          totalOpeningBalance: 1900000,
          totalProfitLoss: 300000,
          totalOtherComprehensiveIncome: 0,
          totalTransactionsWithOwners: -80000,
          totalTransfersBetweenComponents: 0,
          totalClosingBalance: 2120000,
          isBalanced: true,
        }
      : null,
    restatementNote: withWatermark ? 'Restated (IAS 8)\nPrior-period error' : null,
    restatementWatermark: withWatermark
      ? {
          isRestated: true,
          restatementReasons: [
            'IAS 8 — Operating expenses accrual understated in prior year.',
            'IAS 8 — Depreciation expense reclassified per revised policy.',
          ],
          restatedComponents: ['3300', '5100'],
          restatementEffectiveDate: '2025-03-15',
          labelEn: 'Restated (IAS 8)',
          labelAr: 'بعد التسوية (المعيار ٨)',
          affectedRestatementIds: ['PPR-2025-001'],
        }
      : {
          isRestated: false,
          restatementReasons: [],
          restatedComponents: [],
          restatementEffectiveDate: null,
          labelEn: 'Restated (IAS 8)',
          labelAr: 'بعد التسوية (المعيار ٨)',
          affectedRestatementIds: [],
        },
  };
}

function disclosuresFixture({ islamic = false } = {}) {
  const base = [
    {
      id: 'DN-1',
      noteType: 'ACCOUNTING_POLICIES',
      kind: 'READY',
      standardReference: 'IAS 1 ¶117–124',
      titleEn: 'Significant Accounting Policies',
      titleAr: 'السياسات المحاسبية الهامة',
      methodVersion: 'v1',
      isAaoifi: false,
      autoPopulatedFrom: null,
      narratives: [
        {
          key: 'body',
          titleEn: null,
          titleAr: null,
          paragraphsEn: ['IFRS as adopted for Kuwait.'],
          paragraphsAr: ['المعايير الدولية المعتمدة في الكويت.'],
        },
      ],
      tables: [],
      warnings: [],
    },
    {
      id: 'DN-2',
      noteType: 'IFRS_9_ECL',
      kind: 'NARRATIVE_PENDING',
      standardReference: 'IFRS 9',
      titleEn: 'Expected Credit Losses (IFRS 9)',
      titleAr: 'الخسائر الائتمانية المتوقعة (المعيار ٩)',
      methodVersion: 'v1',
      isAaoifi: false,
      autoPopulatedFrom: null,
      narratives: [
        {
          key: 'body',
          titleEn: null,
          titleAr: null,
          paragraphsEn: ['Simplified approach.'],
          paragraphsAr: ['النهج المبسط.'],
        },
      ],
      tables: [],
      warnings: [],
    },
    {
      id: 'DN-3',
      noteType: 'IAS_16_PROPERTY_PLANT_EQUIPMENT',
      kind: 'READY',
      standardReference: 'IAS 16',
      titleEn: 'Property, Plant and Equipment',
      titleAr: 'الممتلكات والآلات والمعدات',
      methodVersion: 'v1',
      isAaoifi: false,
      autoPopulatedFrom: 'fixed_assets',
      narratives: [
        {
          key: 'body',
          titleEn: null,
          titleAr: null,
          paragraphsEn: ['PP&E at cost less depreciation.'],
          paragraphsAr: ['بالتكلفة ناقصاً الإهلاك.'],
        },
      ],
      tables: [
        {
          key: 'ppe',
          titleEn: 'PP&E Roll-Forward',
          titleAr: 'حركة الممتلكات والآلات والمعدات',
          columns: [
            { key: 'class', labelEn: 'Asset Class', labelAr: 'فئة الأصل', isAmount: false, align: 'start' },
            { key: 'closing', labelEn: 'Closing', labelAr: 'الختامي', isAmount: true, align: 'end' },
          ],
          rows: [
            { labelEn: 'Buildings', labelAr: 'مبانٍ', cells: ['Buildings', '1728000.000'] },
            { labelEn: 'Total', labelAr: 'الإجمالي', cells: [null, '2605000.000'], isTotal: true },
          ],
        },
      ],
      warnings: [],
    },
  ];

  const aaoifi = [
    {
      id: 'DN-AAOIFI-1',
      noteType: 'AAOIFI_FAS_28_MURABAHA',
      kind: 'READY',
      standardReference: 'AAOIFI FAS 28',
      titleEn: 'Murabaha (AAOIFI FAS 28)',
      titleAr: 'المرابحة (معيار الهيئة ٢٨)',
      methodVersion: 'v1',
      isAaoifi: true,
      autoPopulatedFrom: 'islamic_finance',
      narratives: [
        {
          key: 'body',
          titleEn: null,
          titleAr: null,
          paragraphsEn: ['Murabaha is cost-plus deferred sale.'],
          paragraphsAr: ['المرابحة بيع بالتكلفة مع ربح معلوم.'],
        },
      ],
      tables: [
        {
          key: 'position',
          titleEn: 'Murabaha Position Schedule',
          titleAr: 'جدول مراكز المرابحة',
          columns: [
            {
              key: 'ifrs',
              labelEn: 'IFRS Cross-Reference',
              labelAr: 'المرجع وفق المعايير الدولية',
              isAmount: false,
              align: 'start',
            },
            {
              key: 'outstanding',
              labelEn: 'Outstanding (KWD)',
              labelAr: 'القائم (د.ك)',
              isAmount: true,
              align: 'end',
            },
          ],
          rows: [
            {
              labelEn: 'MUR-001 — NBK',
              labelAr: 'مرا-٠٠١ — NBK',
              cells: ['Finance Cost', '1200000.000'],
            },
          ],
        },
      ],
      warnings: [],
    },
    {
      id: 'DN-AAOIFI-2',
      noteType: 'AAOIFI_FAS_32_IJARA',
      kind: 'READY',
      standardReference: 'AAOIFI FAS 32',
      titleEn: 'Ijara (AAOIFI FAS 32)',
      titleAr: 'الإجارة (معيار الهيئة ٣٢)',
      methodVersion: 'v1',
      isAaoifi: true,
      autoPopulatedFrom: 'islamic_finance',
      narratives: [
        {
          key: 'body',
          titleEn: null,
          titleAr: null,
          paragraphsEn: ['Ijara is a lease of assets.'],
          paragraphsAr: ['الإجارة إجارة للأصول.'],
        },
      ],
      tables: [],
      warnings: [],
    },
  ];

  const notes = islamic ? [...base, ...aaoifi] : base;
  return {
    runId: 'DN-RUN-1',
    fiscalYear: 2025,
    asOfDate: '2025-12-31',
    language: 'bilingual',
    period: 'FY 2025',
    notes: notes.map((n, i) => ({ ...n, noteOrder: i + 1 })),
  };
}

// ── Helpers ──────────────────────────────────────────────────────

async function setLang(lang) {
  await act(async () => {
    await i18n.changeLanguage(lang);
  });
}

async function renderScreen({ role = 'Owner', socieOverride, watermark, islamic } = {}) {
  getIncomeStatementSpy.mockResolvedValue(legacyStatementFixture('income'));
  getBalanceSheetSpy.mockResolvedValue({
    ...legacyStatementFixture('balance'),
    // BS watermark attached when the test requests it.
    restatementWatermark: watermark
      ? socieFixture({ withWatermark: true }).restatementWatermark
      : undefined,
  });
  getCashFlowStatementSpy.mockResolvedValue(legacyStatementFixture('cashflow'));
  getStatementOfChangesInEquitySpy.mockResolvedValue(
    socieOverride ?? socieFixture({ withWatermark: !!watermark }),
  );
  getDisclosureNotesSpy.mockResolvedValue(
    disclosuresFixture({ islamic: !!islamic }),
  );
  listReportVersionsSpy.mockResolvedValue([]);

  let rendered;
  await act(async () => {
    rendered = render(<FinancialStatementsScreen role={role} />);
  });
  // Wait for the initial Promise.all to resolve.
  await waitFor(() =>
    expect(getStatementOfChangesInEquitySpy).toHaveBeenCalled(),
  );
  await waitFor(() => expect(getDisclosureNotesSpy).toHaveBeenCalled());
  // Let the second pass complete.
  await act(async () => {});
  return rendered;
}

// ── i18n lifecycle ───────────────────────────────────────────────

beforeEach(async () => {
  vi.clearAllMocks();
  // Ensure the financial namespace is registered in both langs.
  i18n.addResourceBundle('en', 'financial', enFinancial, true, true);
  i18n.addResourceBundle('ar', 'financial', arFinancial, true, true);
  await setLang('en');
});

afterEach(() => {
  cleanup();
});

// ──────────────────────────────────────────────────────────────────
// Part 1 — SOCIE tab (HASEEB-213)
// ──────────────────────────────────────────────────────────────────

describe('SOCIE tab (HASEEB-213)', () => {
  it('renders the "Changes in Equity" tab and clicks through to the matrix', async () => {
    await renderScreen();
    const tabButton = screen.getByRole('button', {
      name: /changes in equity/i,
    });
    expect(tabButton).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(tabButton);
    });
    const matrices = await screen.findAllByTestId('socie-matrix');
    expect(matrices.length).toBeGreaterThan(0);
    const matrix = matrices[0];
    // 6 movement rows: opening / P&L / OCI / txns / transfers / closing
    expect(within(matrix).getByText(/opening balance/i)).toBeInTheDocument();
    expect(
      within(matrix).getByText(/profit or loss for the period/i),
    ).toBeInTheDocument();
    expect(
      within(matrix).getByText(/transactions with owners/i),
    ).toBeInTheDocument();
    expect(
      within(matrix).getByText(/transfers between equity components/i),
    ).toBeInTheDocument();
    expect(within(matrix).getByText(/closing balance/i)).toBeInTheDocument();
  });

  it('renders the comparative prior-year matrix alongside current period', async () => {
    await renderScreen();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /changes in equity/i }));
    });
    const matrices = await screen.findAllByTestId('socie-matrix');
    expect(matrices.length).toBe(2);
  });

  it('renders SOCIE tab bilingually in Arabic', async () => {
    await renderScreen();
    await setLang('ar');
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /التغيرات في حقوق الملكية/ }),
      );
    });
    const matrices = await screen.findAllByTestId('socie-matrix');
    const matrix = matrices[0];
    expect(within(matrix).getByText(/الرصيد الافتتاحي/)).toBeInTheDocument();
    expect(within(matrix).getByText(/الرصيد الختامي/)).toBeInTheDocument();
  });

  it('fetches SOCIE with the prior-period date range so the backend returns the comparative column', async () => {
    await renderScreen();
    const args = getStatementOfChangesInEquitySpy.mock.calls[0];
    expect(args).toHaveLength(4);
    expect(args[0]).toMatch(/^\d{4}-01-01$/);
    expect(args[1]).toMatch(/^\d{4}-12-31$/);
    expect(args[2]).toMatch(/^\d{4}-01-01$/);
    expect(args[3]).toMatch(/^\d{4}-12-31$/);
  });
});

// ──────────────────────────────────────────────────────────────────
// Part 2 — IAS 8 restatement watermark (HASEEB-216)
// ──────────────────────────────────────────────────────────────────

describe('IAS 8 restatement watermark (HASEEB-216)', () => {
  it('does NOT render the watermark banner when isRestated is false', async () => {
    await renderScreen();
    expect(
      screen.queryByTestId('restatement-watermark'),
    ).not.toBeInTheDocument();
  });

  it('renders the watermark banner on the Balance Sheet tab when active', async () => {
    await renderScreen({ watermark: true });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /balance sheet/i }));
    });
    const banner = await screen.findByTestId('restatement-watermark');
    expect(banner).toBeInTheDocument();
    expect(within(banner).getByText(/restated \(ias 8\)/i)).toBeInTheDocument();
    // Footnote reasons render
    expect(within(banner).getByText(/operating expenses accrual/i)).toBeInTheDocument();
  });

  it('renders the watermark banner on the SOCIE tab when active', async () => {
    await renderScreen({ watermark: true });
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /changes in equity/i }),
      );
    });
    const banner = await screen.findByTestId('restatement-watermark');
    expect(banner).toBeInTheDocument();
  });

  it('renders per-line restated markers when restatedComponents matches row account code', async () => {
    await renderScreen({ watermark: true });
    // BS fixture has a line with code "5100" that matches the watermark's
    // restatedComponents. A restated-line-marker should render.
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /balance sheet/i }));
    });
    const markers = screen.getAllByTestId('restated-line-marker');
    expect(markers.length).toBeGreaterThan(0);
  });

  it('renders the watermark in Arabic with the Arabic label', async () => {
    await renderScreen({ watermark: true });
    await setLang('ar');
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /قائمة المركز المالي/ }),
      );
    });
    const banner = await screen.findByTestId('restatement-watermark');
    expect(within(banner).getByText(/بعد التسوية \(المعيار ٨\)/)).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────────────────────────
// Part 3 — DisclosureNotes (AUDIT-ACC-040)
// ──────────────────────────────────────────────────────────────────

describe('Disclosure Notes (AUDIT-ACC-040)', () => {
  it('renders IFRS notes when the tenant is non-Islamic', async () => {
    await renderScreen();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /disclosure notes/i }));
    });
    const section = await screen.findByTestId('disclosure-notes-section');
    expect(section).toBeInTheDocument();
    const notes = within(section).getAllByTestId('disclosure-note');
    expect(notes.length).toBe(3); // matches disclosuresFixture IFRS-only
  });

  it('renders AAOIFI dual-label notes for an Islamic-finance tenant', async () => {
    await renderScreen({ islamic: true });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /disclosure notes/i }));
    });
    const section = await screen.findByTestId('disclosure-notes-section');
    const notes = within(section).getAllByTestId('disclosure-note');
    expect(notes.length).toBe(5); // 3 IFRS + 2 AAOIFI
    const aaoifiNotes = notes.filter(
      (n) => n.getAttribute('data-note-type')?.startsWith('AAOIFI_'),
    );
    expect(aaoifiNotes.length).toBe(2);
  });

  it('renders the NARRATIVE_PENDING badge and opens the stub modal on click', async () => {
    await renderScreen({ role: 'Owner' });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /disclosure notes/i }));
    });
    const badges = await screen.findAllByTestId('narrative-pending-badge');
    expect(badges.length).toBeGreaterThan(0);
    const stubBtn = screen.getAllByTestId('edit-narrative-stub')[0];
    expect(stubBtn).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(stubBtn);
    });
    const modal = await screen.findByTestId('narrative-editor-stub');
    expect(within(modal).getByText(/HASEEB-223/)).toBeInTheDocument();
  });

  it('hides the Edit-narrative stub from Junior role (read-only)', async () => {
    await renderScreen({ role: 'Junior' });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /disclosure notes/i }));
    });
    await screen.findByTestId('disclosure-notes-section');
    // Badge renders for everyone (visibility signal); button is
    // role-gated.
    expect(
      screen.queryByTestId('edit-narrative-stub'),
    ).not.toBeInTheDocument();
  });

  it('renders notes bilingually in Arabic', async () => {
    await renderScreen();
    await setLang('ar');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /الإيضاحات/ }));
    });
    const section = await screen.findByTestId('disclosure-notes-section');
    expect(
      within(section).getByText(/السياسات المحاسبية الهامة/),
    ).toBeInTheDocument();
  });

  it('renders the Auto-populated citation on notes that ship one', async () => {
    await renderScreen();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /disclosure notes/i }));
    });
    // Expand the IAS 16 note (index 2) which carries autoPopulatedFrom.
    const notes = await screen.findAllByTestId('disclosure-note');
    const ppeNote = notes.find(
      (n) => n.getAttribute('data-note-type') === 'IAS_16_PROPERTY_PLANT_EQUIPMENT',
    );
    // First expand.
    const toggle = within(ppeNote).getByRole('button');
    await act(async () => {
      fireEvent.click(toggle);
    });
    expect(within(ppeNote).getByText(/auto-populated from fixed_assets/i)).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────────────────────────
// i18n parity — every new key exists in both locales
// ──────────────────────────────────────────────────────────────────

describe('i18n parity for YEAR-END-FS-TRIO keys', () => {
  const newKeys = [
    'tabs.socie',
    'tabs.disclosures',
    'restatement.banner',
    'restatement.lineMarker',
    'restatement.lineMarkerBadge',
    'restatement.footnoteHeader',
    'socie.columns.movement',
    'socie.columns.total',
    'socie.columns.currentYear',
    'socie.columns.priorYear',
    'socie.rows.opening',
    'socie.rows.profitForPeriod',
    'socie.rows.oci',
    'socie.rows.transactionsWithOwners',
    'socie.rows.transfers',
    'socie.rows.closing',
    'disclosureNotes.title',
    'disclosureNotes.noteLabel',
    'disclosureNotes.narrativePendingBadge',
    'disclosureNotes.editNarrativeButton',
    'disclosureNotes.autoPopulatedFrom',
    'disclosureNotes.emptyTitle',
    'disclosureNotes.aaoifi.badge',
    'disclosureNotes.aaoifi.ifrsCrossRef',
    'disclosureNotes.narrativeEditorStub.title',
    'disclosureNotes.narrativeEditorStub.body',
    'disclosureNotes.narrativeEditorStub.close',
  ];
  it('has every key defined in EN + AR', () => {
    function get(obj, path) {
      return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
    }
    for (const key of newKeys) {
      const en = get(enFinancial, key);
      const ar = get(arFinancial, key);
      expect(en, `en missing ${key}`).toBeTruthy();
      expect(ar, `ar missing ${key}`).toBeTruthy();
    }
  });
});
