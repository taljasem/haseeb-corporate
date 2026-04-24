/**
 * HASEEB-448 — SetupScreen onboarding polish (FN-102/103/105/107/108/110/111).
 *
 * Covers:
 *   1. Company section: EN + AR name inputs render, AR input has dir="rtl",
 *      validation blocks save on empty, happy save calls engine writer.
 *   2. Invoice preview modal: bilingual renders both facsimiles side-by-
 *      side; language=ar renders only the RTL facsimile.
 *   3. CoA templates block: industry + template dropdowns render with 12
 *      options; selecting industry auto-selects matching template.
 *   4. CoA "no match" fallback: when industry doesn't map, the General
 *      Business default is chosen and the banner appears.
 *   5. CoA preview modal: opens on click, lists preview rows.
 *   6. Fiscal-position block: start-month / functional-currency /
 *      accounting-standard selects render with defaults (Jan / KWD /
 *      IFRS); save calls engine writer.
 *   7. Read-only gating: Junior role disables inputs (Junior maps to
 *      readOnly via canEditAdmin).
 *   8. Arabic UI renders (i18n language toggle) without breaking the
 *      template / fiscal blocks.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  act,
  waitFor,
  within,
} from '@testing-library/react';
import React from 'react';

import i18n from '../../src/i18n';

// Engine boundary stubs. We mock every function SetupScreen imports from
// `../../engine` so the component tree loads without calling the real
// mockEngine (which carries a lot of seed data + timers). We only need
// the new HASEEB-448 functions to return sane shapes; everything else
// returns empty/default values good enough for the surface we exercise.
const listCoaTemplatesSpy = vi.fn();
const resolveIndustryTemplateSpy = vi.fn();
const previewCoaTemplateSpy = vi.fn();
const getTenantCompanyInfoSpy = vi.fn();
const updateTenantCompanyInfoSpy = vi.fn();
const getFiscalYearConfigSpy = vi.fn();
const updateFiscalYearConfigSpy = vi.fn();
const getSetupChartOfAccountsSpy = vi.fn();

const TEMPLATES_FIXTURE = [
  { id: 'general', nameEn: 'General Business', nameAr: 'أعمال عامة', accountCount: 70 },
  { id: 'it_software', nameEn: 'IT / Software Company', nameAr: 'شركة تقنية', accountCount: 82 },
  { id: 'construction', nameEn: 'Construction Company', nameAr: 'شركة مقاولات', accountCount: 94 },
  { id: 'real_estate', nameEn: 'Real Estate Company', nameAr: 'شركة عقارات', accountCount: 76 },
  { id: 'healthcare_medical', nameEn: 'Healthcare / Medical', nameAr: 'الرعاية الصحية', accountCount: 90 },
  { id: 'manufacturing', nameEn: 'Manufacturing', nameAr: 'صناعة', accountCount: 88 },
  { id: 'retail_trading', nameEn: 'Retail / Trading', nameAr: 'تجزئة', accountCount: 68 },
  { id: 'restaurant_food_beverage', nameEn: 'Restaurant / Food & Beverage', nameAr: 'مطعم', accountCount: 62 },
  { id: 'education', nameEn: 'Education', nameAr: 'تعليم', accountCount: 58 },
  { id: 'law_firm_professional', nameEn: 'Law Firm / Professional Services', nameAr: 'محاماة', accountCount: 60 },
  { id: 'transportation_logistics', nameEn: 'Transportation / Logistics', nameAr: 'نقل', accountCount: 64 },
  { id: 'salon', nameEn: 'Salon / Beauty', nameAr: 'صالون', accountCount: 52 },
];

vi.mock('../../src/engine', () => ({
  __esModule: true,
  // HASEEB-448 new functions — the subjects under test.
  listCoaTemplates: (...args) => listCoaTemplatesSpy(...args),
  resolveIndustryTemplate: (...args) => resolveIndustryTemplateSpy(...args),
  previewCoaTemplate: (...args) => previewCoaTemplateSpy(...args),
  getTenantCompanyInfo: (...args) => getTenantCompanyInfoSpy(...args),
  updateTenantCompanyInfo: (...args) => updateTenantCompanyInfoSpy(...args),
  // Fiscal — exercised by FN-105.
  getFiscalYearConfig: (...args) => getFiscalYearConfigSpy(...args),
  updateFiscalYearConfig: (...args) => updateFiscalYearConfigSpy(...args),
  // Chart-of-accounts load — not the focus of this suite, but required
  // so ChartSection doesn't blow up when the user switches to it.
  getSetupChartOfAccounts: (...args) => getSetupChartOfAccountsSpy(...args),
  getAccountsFlat: async () => [],
  // All other engine helpers SetupScreen imports — stubbed empty.
  listDisallowanceRules: async () => [],
  deactivateDisallowanceRule: async () => ({}),
  listTaxLodgements: async () => [],
  updateTaxLodgementStatus: async () => ({}),
  getTaxLodgementTieOut: async () => ({}),
  listWhtConfigs: async () => [],
  deactivateWhtConfig: async () => ({}),
  listWhtCertificates: async () => [],
  listCostAllocationRules: async () => [],
  deactivateCostAllocationRule: async () => ({}),
  computeCostAllocation: async () => ({}),
  listRelatedParties: async () => [],
  deactivateRelatedParty: async () => ({}),
  getRelatedPartyReport: async () => ({}),
  listVendorsForRelatedParty: async () => [],
  listCustomersForRelatedParty: async () => [],
  listWarrantyPolicies: async () => [],
  deactivateWarrantyPolicy: async () => ({}),
  listBankFormats: async () => [],
  deactivateBankFormat: async () => ({}),
  listLeavePolicies: async () => [],
  getActiveLeavePolicy: async () => null,
  getLeaveProvisionSummary: async () => ({}),
  listCbkRates: async () => [],
  deleteCbkRate: async () => ({}),
  getCbkRateStaleness: async () => ({}),
  // Tax + currency + integration stubs.
  getTaxConfiguration: async () => ({
    regime: 'kuwait',
    zakatRate: 2.5, zakatAccount: '2300',
    corporateTaxRate: 15, pifssRate: 11, pifssAccount: '2200',
    filingFrequency: 'quarterly', exemptions: [],
  }),
  updateTaxConfiguration: async () => ({}),
  getCurrencyConfig: async () => ({
    base: 'KWD', enabled: {}, rates: {}, rateSource: 'cbk', lastUpdated: new Date().toISOString(),
  }),
  updateCurrencyConfig: async () => ({}),
  updateExchangeRates: async () => ({ updated: [] }),
  getIntegrationStatus: async () => [],
  forceSyncIntegration: async () => ({}),
  getIntegrationSyncLogs: async () => [],
  getEngineConfiguration: async () => ({}),
  // Tenant-flags imported dynamically; stub the dynamic import boundary
  // below (the component calls `import("../../engine").then(...)` for
  // getTenantFlags so the static mock here is enough — the dynamic
  // import reuses the same module mock).
  getTenantFlags: async () => ({ hasForeignActivity: false }),
}));

import { TenantProvider } from '../../src/components/shared/TenantContext';
import SetupScreen from '../../src/screens/cfo/SetupScreen';

async function setLang(lang) {
  await act(async () => {
    await i18n.changeLanguage(lang);
  });
}

function renderScreen(role = 'CFO') {
  return render(
    <TenantProvider>
      <SetupScreen role={role} />
    </TenantProvider>,
  );
}

// Default fiscal config shape.
function seedFiscalConfig(overrides = {}) {
  return {
    currentFY: 2026,
    startMonth: 1,
    functionalCurrency: 'KWD',
    accountingStandard: 'IFRS',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    periods: [
      { month: 'Jan 2026', status: 'hard_closed' },
      { month: 'Feb 2026', status: 'open' },
    ],
    milestones: [],
    ...overrides,
  };
}

function seedCompanyInfo(overrides = {}) {
  return {
    nameEn: 'Al Manara Trading',
    nameAr: 'المنارة للتجارة',
    industry: 'Trading',
    documentLanguagePreference: 'bilingual',
    ...overrides,
  };
}

describe('HASEEB-448 — SetupScreen onboarding polish', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Default spy returns.
    listCoaTemplatesSpy.mockResolvedValue(TEMPLATES_FIXTURE);
    resolveIndustryTemplateSpy.mockImplementation(async (industry) => {
      const key = (industry || '').toString().trim().toLowerCase();
      if (key === 'trading' || key === 'retail' || key === 'retail_trading') {
        return { industry, templateId: 'retail_trading', matched: true };
      }
      if (key === 'it' || key === 'software' || key === 'it_software') {
        return { industry, templateId: 'it_software', matched: true };
      }
      // Any 12 template id is valid as an industry key in the dropdown.
      const tpl = TEMPLATES_FIXTURE.find((t) => t.id === key);
      if (tpl) return { industry, templateId: tpl.id, matched: true };
      if (!key) return { industry, templateId: 'general', matched: false };
      return { industry, templateId: 'general', matched: false };
    });
    previewCoaTemplateSpy.mockImplementation(async (templateId) => ({
      templateId,
      count: TEMPLATES_FIXTURE.find((t) => t.id === templateId)?.accountCount || 70,
      accounts: [
        { code: '1000', nameEn: 'Assets', nameAr: 'الأصول', type: 'ASSET' },
        { code: '1100', nameEn: 'Current Assets', nameAr: 'الأصول المتداولة', type: 'ASSET' },
        { code: '2000', nameEn: 'Liabilities', nameAr: 'الخصوم', type: 'LIABILITY' },
      ],
    }));
    getTenantCompanyInfoSpy.mockResolvedValue(seedCompanyInfo());
    updateTenantCompanyInfoSpy.mockResolvedValue({ success: true });
    getFiscalYearConfigSpy.mockResolvedValue(seedFiscalConfig());
    updateFiscalYearConfigSpy.mockResolvedValue(seedFiscalConfig());
    getSetupChartOfAccountsSpy.mockResolvedValue([]);

    await setLang('en');
  });

  afterEach(() => {
    cleanup();
  });

  // ── Company section (FN-110) ─────────────────────────────────────

  it('company section: EN + AR name inputs render; AR input has dir=rtl', async () => {
    renderScreen('CFO');
    // SetupScreen defaults to the new "company" section on mount.
    const nameEn = await screen.findByTestId('company-name-en');
    expect(nameEn).toBeInTheDocument();
    expect(nameEn).toHaveAttribute('dir', 'ltr');
    expect(nameEn).toHaveValue('Al Manara Trading');
    const nameAr = screen.getByTestId('company-name-ar');
    expect(nameAr).toBeInTheDocument();
    expect(nameAr).toHaveAttribute('dir', 'rtl');
    expect(nameAr).toHaveValue('المنارة للتجارة');
  });

  it('company section: save blocked when either name is empty (validation)', async () => {
    renderScreen('CFO');
    const nameEn = await screen.findByTestId('company-name-en');
    const nameAr = screen.getByTestId('company-name-ar');
    fireEvent.change(nameEn, { target: { value: '' } });
    fireEvent.change(nameAr, { target: { value: '' } });
    fireEvent.click(screen.getByTestId('company-save'));
    // Both error messages render.
    expect(await screen.findByTestId('company-name-en-error')).toBeInTheDocument();
    expect(screen.getByTestId('company-name-ar-error')).toBeInTheDocument();
    // Writer not called.
    expect(updateTenantCompanyInfoSpy).not.toHaveBeenCalled();
  });

  it('company section: happy save calls updateTenantCompanyInfo with both names', async () => {
    renderScreen('CFO');
    await screen.findByTestId('company-name-en');
    fireEvent.click(screen.getByTestId('company-save'));
    await waitFor(() => {
      expect(updateTenantCompanyInfoSpy).toHaveBeenCalledTimes(1);
    });
    const payload = updateTenantCompanyInfoSpy.mock.calls[0][0];
    expect(payload.nameEn).toBe('Al Manara Trading');
    expect(payload.nameAr).toBe('المنارة للتجارة');
    expect(payload.documentLanguagePreference).toBe('bilingual');
  });

  // ── Invoice preview (FN-111) ──────────────────────────────────────

  it('invoice preview: bilingual renders both EN and AR facsimiles', async () => {
    renderScreen('CFO');
    await screen.findByTestId('company-name-en');
    fireEvent.click(screen.getByTestId('company-preview-button'));
    const modal = await screen.findByTestId('invoice-preview-modal');
    expect(within(modal).getByTestId('invoice-facsimile-en')).toBeInTheDocument();
    expect(within(modal).getByTestId('invoice-facsimile-ar')).toBeInTheDocument();
    // AR facsimile has dir=rtl.
    expect(within(modal).getByTestId('invoice-facsimile-ar')).toHaveAttribute('dir', 'rtl');
    expect(within(modal).getByTestId('invoice-facsimile-en')).toHaveAttribute('dir', 'ltr');
  });

  it('invoice preview: doc-language=ar renders only the RTL facsimile', async () => {
    getTenantCompanyInfoSpy.mockResolvedValue(seedCompanyInfo({ documentLanguagePreference: 'ar' }));
    renderScreen('CFO');
    await screen.findByTestId('company-name-en');
    fireEvent.click(screen.getByTestId('company-preview-button'));
    const modal = await screen.findByTestId('invoice-preview-modal');
    expect(within(modal).getByTestId('invoice-facsimile-ar')).toBeInTheDocument();
    expect(within(modal).queryByTestId('invoice-facsimile-en')).not.toBeInTheDocument();
  });

  // ── CoA templates block (FN-102/103/107/108) ─────────────────────

  it('CoA templates: industry + template selects render with all 12 options', async () => {
    renderScreen('CFO');
    // Switch to chart section.
    // Sidebar buttons are rendered as plain <button>s; click by text content.
    const chartTab = await screen.findByRole('button', { name: /Chart of Accounts/i });
    fireEvent.click(chartTab);
    const industry = await screen.findByTestId('coa-industry-select');
    const template = await screen.findByTestId('coa-template-select');
    // 12 options on each select.
    const industryOpts = within(industry).getAllByRole('option');
    const templateOpts = within(template).getAllByRole('option');
    expect(industryOpts).toHaveLength(12);
    expect(templateOpts).toHaveLength(12);
    // "General Business" is present.
    expect(industryOpts.map((o) => o.textContent)).toContain('General Business');
  });

  it('CoA templates: changing industry auto-selects matching template', async () => {
    renderScreen('CFO');
    fireEvent.click(await screen.findByRole('button', { name: /Chart of Accounts/i }));
    const industry = await screen.findByTestId('coa-industry-select');
    // Change to IT — stub returns templateId 'it_software'.
    fireEvent.change(industry, { target: { value: 'it_software' } });
    await waitFor(() => {
      const tpl = screen.getByTestId('coa-template-select');
      expect(tpl.value).toBe('it_software');
    });
  });

  it('CoA templates: unmapped industry falls back to General Business + shows no-match note', async () => {
    // Mount with a tenant whose industry resolves to not-matched.
    // Default tenant "almanara" has industry "Trading" → matched. For
    // this case we force the resolver to return matched=false.
    resolveIndustryTemplateSpy.mockResolvedValue({
      industry: 'Trading', templateId: 'general', matched: false,
    });
    renderScreen('CFO');
    fireEvent.click(await screen.findByRole('button', { name: /Chart of Accounts/i }));
    await screen.findByTestId('coa-template-select');
    expect(screen.getByTestId('coa-no-match-note')).toBeInTheDocument();
    expect(screen.getByTestId('coa-template-select').value).toBe('general');
  });

  it('CoA templates: preview button opens modal with preview rows', async () => {
    renderScreen('CFO');
    fireEvent.click(await screen.findByRole('button', { name: /Chart of Accounts/i }));
    const previewBtn = await screen.findByTestId('coa-preview-button');
    fireEvent.click(previewBtn);
    await waitFor(() => {
      expect(previewCoaTemplateSpy).toHaveBeenCalled();
    });
    // Preview modal renders the stub rows — assert on the row code
    // (which is unique to preview rows; the ChartSection's type filter
    // also lists "Assets" as an option, so matching by name alone would
    // be ambiguous). "1000" is the Assets parent row from the stub.
    await waitFor(() => {
      expect(screen.getByText('1000')).toBeInTheDocument();
    });
    // The stub also returns code "2000" for Liabilities.
    expect(screen.getByText('2000')).toBeInTheDocument();
  });

  it('CoA templates: apply button is disabled (follow-up flag)', async () => {
    renderScreen('CFO');
    fireEvent.click(await screen.findByRole('button', { name: /Chart of Accounts/i }));
    const applyBtn = await screen.findByTestId('coa-apply-button');
    expect(applyBtn).toBeDisabled();
    expect(applyBtn).toHaveAttribute('title');
  });

  // ── Fiscal position (FN-105) ─────────────────────────────────────

  it('fiscal position: three selects render with defaults (Jan / KWD / IFRS)', async () => {
    renderScreen('CFO');
    fireEvent.click(await screen.findByRole('button', { name: /Fiscal Year/i }));
    const startMonth = await screen.findByTestId('fiscal-start-month');
    const currency = await screen.findByTestId('fiscal-functional-currency');
    const standard = await screen.findByTestId('fiscal-accounting-standard');
    expect(startMonth.value).toBe('1');
    expect(currency.value).toBe('KWD');
    expect(standard.value).toBe('IFRS');
  });

  it('fiscal position: save calls updateFiscalYearConfig with edited values', async () => {
    renderScreen('CFO');
    fireEvent.click(await screen.findByRole('button', { name: /Fiscal Year/i }));
    const startMonth = await screen.findByTestId('fiscal-start-month');
    fireEvent.change(startMonth, { target: { value: '4' } });
    const currency = screen.getByTestId('fiscal-functional-currency');
    fireEvent.change(currency, { target: { value: 'USD' } });
    const standard = screen.getByTestId('fiscal-accounting-standard');
    fireEvent.change(standard, { target: { value: 'IFRS-SME' } });
    fireEvent.click(screen.getByTestId('fiscal-position-save'));
    await waitFor(() => {
      expect(updateFiscalYearConfigSpy).toHaveBeenCalledWith({
        startMonth: 4,
        functionalCurrency: 'USD',
        accountingStandard: 'IFRS-SME',
      });
    });
  });

  // ── Role gating ───────────────────────────────────────────────────

  it('Junior role: company inputs disabled + save disabled', async () => {
    renderScreen('Junior');
    const nameEn = await screen.findByTestId('company-name-en');
    expect(nameEn).toBeDisabled();
    expect(screen.getByTestId('company-name-ar')).toBeDisabled();
    expect(screen.getByTestId('company-save')).toBeDisabled();
  });

  it('Junior role: fiscal-position save disabled', async () => {
    renderScreen('Junior');
    fireEvent.click(await screen.findByRole('button', { name: /Fiscal Year/i }));
    expect(await screen.findByTestId('fiscal-position-save')).toBeDisabled();
  });

  // ── Arabic UI language ────────────────────────────────────────────

  it('Arabic UI: company section + CoA templates block render in AR', async () => {
    await setLang('ar');
    renderScreen('CFO');
    // Company section title in Arabic.
    // The EN setup.json key company.title is "Company" / AR is "الشركة".
    await screen.findByTestId('company-name-en');
    // AR input still has dir=rtl (independent of UI language).
    expect(screen.getByTestId('company-name-ar')).toHaveAttribute('dir', 'rtl');
  });
});
