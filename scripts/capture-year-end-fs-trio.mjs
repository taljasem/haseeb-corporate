/**
 * YEAR-END-FS-TRIO screenshot capture.
 *
 * Runs Playwright against `vite preview`. Captures 6 surfaces × EN/AR ×
 * dark/light = 24 PNGs for AUDIT-ACC-040 / HASEEB-213 / HASEEB-216.
 *
 *  01-04  SOCIE tab (demo-corporate tenant — multi-component + prior-year)
 *  05-08  SOCIE tab with restatement watermark (almawred tenant)
 *  09-12  Balance Sheet with restatement watermark
 *  13-16  Disclosure Notes IFRS section
 *  17-20  Disclosure Notes AAOIFI dual-label section (demo-corporate)
 *  21-24  Disclosure Notes NARRATIVE_PENDING stub modal open
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const BASE_URL = process.env.PREVIEW_URL || 'http://localhost:4680';
const OUT_DIR =
  '/Users/tarekaljasem/Downloads/aft-command/memory-bank/screenshots/YEAR-END-FS-TRIO';

fs.mkdirSync(OUT_DIR, { recursive: true });

const FAKE_TOKEN = 'dev.stub.token.for.screenshots';
const FAKE_USER_OWNER = {
  id: 'user-owner-1',
  email: 'owner@demo.local',
  name: 'Demo Owner',
  role: 'OWNER',
  tenantId: 'tenant-1',
  preferredLanguage: 'en',
  preferredTheme: 'dark',
};
const FAKE_TENANT = {
  id: 'tenant-1',
  slug: 'demo',
  name: 'Al Manara Trading Co',
  nameEn: 'Al Manara Trading Co',
  nameAr: 'المنارة للتجارة',
  locale: 'en',
  currency: 'KWD',
};

function wrapData(body) {
  return { success: true, data: body };
}

async function stubAuth(context) {
  await context.route(
    (url) => url.hostname === 'localhost' && url.port === '3000',
    async (route) => {
      const url = route.request().url();
      if (url.includes('/api/auth/me')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(wrapData(FAKE_USER_OWNER)),
        });
      }
      if (url.includes('/api/auth/tenant-info')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(wrapData(FAKE_TENANT)),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(wrapData(null)),
      });
    },
  );
}

async function seedPrefs(page, { lang, theme }) {
  await page.addInitScript(
    ({ lang, theme, token }) => {
      try {
        localStorage.setItem('haseeb_corp_token', token);
        localStorage.setItem(
          'haseeb_corp_token_exp',
          String(Date.now() + 24 * 3600 * 1000),
        );
        localStorage.setItem('haseeb-language', lang);
        localStorage.setItem('haseeb-corporate-theme', theme);
        document.documentElement.setAttribute('data-theme', theme);
      } catch {
        /* no-op */
      }
    },
    { lang, theme, token: FAKE_TOKEN },
  );
}

async function setScenario(page, variant) {
  // Force the mockEngine fixture variant via the window-exposed hook.
  // Null clears the override (falls back to tenant-id resolution).
  await page.evaluate((v) => {
    if (typeof window.__setYearEndFsScenario === 'function') {
      window.__setYearEndFsScenario(v);
    }
  }, variant);
}

async function bootstrap(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(500);
    const stillLoading = await page
      .locator('text=/^Loading…$/i')
      .count()
      .catch(() => 0);
    if (stillLoading === 0) {
      return;
    }
  }
  console.log('[bootstrap] WARNING — Loading still showing after 15s');
}

async function pickOwner(page) {
  const isAr =
    (await page.evaluate(() => document.documentElement.lang)) === 'ar';
  const ownerText = isAr ? 'المالك' : 'Owner';
  try {
    await page
      .getByText(ownerText, { exact: true })
      .first()
      .click({ timeout: 4000 });
    await page.waitForTimeout(500);
  } catch {
    /* picker may have auto-resolved */
  }
}

async function pickTenantByMock(page, tenantId) {
  // The TenantContext exposes no localStorage binding — tenant switching
  // is UI-only via the Header tenant-switcher. Click through the switcher
  // rather than trying to flip a module-level variable from the outside.
  // Tenant options in `src/config/tenants.js`:
  //   • `almanara` → classic IFRS, non-restated, no AAOIFI
  //   • `generic`  → routes to demo-corporate variant (AAOIFI + watermark)
  try {
    // The tenant pill has the label "TENANT · <SHORTNAME>". Click it to
    // open the dropdown, then select the target by tenant id marker.
    const tenantButton = page.locator('button[title*="tenant"], button[title*="Tenant"]').first();
    await tenantButton.click({ timeout: 4000 });
    await page.waitForTimeout(300);
    // Click the target tenant option by its visible name. almanara is
    // "Al Manara Trading"; generic is "Generic Tenant" or similar.
    const label = tenantId === 'almanara' ? /Al Manara/i : /Generic/i;
    await page
      .getByText(label)
      .first()
      .click({ timeout: 3000 });
    await page.waitForTimeout(600);
  } catch (err) {
    console.log('[tenant-switch]', tenantId, 'soft-fail:', err.message);
  }
}

async function navigateToFinancialStatements(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
  await pickOwner(page);
  const isAr =
    (await page.evaluate(() => document.documentElement.lang)) === 'ar';
  const label = isAr ? /القوائم المالية/ : /Financial Statements/i;
  try {
    await page.getByText(label).first().click({ timeout: 6000 });
  } catch (err) {
    console.error('[nav] financial-statements click failed:', err.message);
  }
  await page.waitForTimeout(1200);
}

async function setLangThenTheme(page, lang, theme, scenario) {
  await page.evaluate(
    ({ t, l }) => {
      try {
        localStorage.setItem('haseeb-corporate-theme', t);
        localStorage.setItem('haseeb-language', l);
      } catch {}
      document.documentElement.setAttribute('data-theme', t);
    },
    { t: theme, l: lang },
  );
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  // Force the fixture variant after reload.
  if (scenario) await setScenario(page, scenario);
  const currentLang = await page.evaluate(
    () => document.documentElement.lang || 'en',
  );
  if (currentLang !== lang) {
    try {
      await page
        .getByLabel(/Toggle language|تبديل اللغة/i)
        .first()
        .click({ timeout: 4000 });
      await page.waitForTimeout(500);
    } catch {
      /* no-op */
    }
  }
  await navigateToFinancialStatements(page);
  // Re-apply scenario after navigation in case re-render cleared state.
  if (scenario) await setScenario(page, scenario);
}

async function clickTab(page, tabLabel) {
  try {
    await page
      .getByRole('button', { name: tabLabel })
      .first()
      .click({ timeout: 5000 });
    await page.waitForTimeout(800);
  } catch (err) {
    console.error('[tab-click]', tabLabel, 'failed:', err.message);
  }
}

async function openSocieTab(page) {
  const isAr =
    (await page.evaluate(() => document.documentElement.lang)) === 'ar';
  await clickTab(
    page,
    isAr ? /التغيرات في حقوق الملكية/ : /changes in equity/i,
  );
}

async function openDisclosuresTab(page) {
  const isAr =
    (await page.evaluate(() => document.documentElement.lang)) === 'ar';
  await clickTab(page, isAr ? /الإيضاحات/ : /disclosure notes/i);
}

async function openBalanceTab(page) {
  const isAr =
    (await page.evaluate(() => document.documentElement.lang)) === 'ar';
  await clickTab(page, isAr ? /قائمة المركز المالي/ : /balance sheet/i);
}

async function expandFirstNarrativePendingAndOpenStub(page) {
  // Click the first visible "Edit narrative" stub button.
  const isAr =
    (await page.evaluate(() => document.documentElement.lang)) === 'ar';
  const label = isAr ? /تحرير الوصف/ : /edit narrative/i;
  try {
    await page
      .getByRole('button', { name: label })
      .first()
      .click({ timeout: 4000 });
    await page.waitForTimeout(500);
  } catch (err) {
    console.error('[stub-modal] click failed:', err.message);
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await stubAuth(context);
  const page = await context.newPage();
  page.on('pageerror', (err) => console.log('[page-err]', err.message));

  await seedPrefs(page, { lang: 'en', theme: 'dark' });
  await bootstrap(page);

  const variants = [
    { lang: 'en', theme: 'dark' },
    { lang: 'ar', theme: 'dark' },
    { lang: 'en', theme: 'light' },
    { lang: 'ar', theme: 'light' },
  ];

  let idx = 1;

  // 01-04: SOCIE tab — demo-corporate variant (multi-component + prior-year, non-restated)
  for (const v of variants) {
    try {
      await setLangThenTheme(page, v.lang, v.theme, 'demo-corporate');
      await openSocieTab(page);
      const suffix = `${String(idx).padStart(2, '0')}-socie-${v.lang}-${v.theme}`;
      await page.screenshot({
        path: path.join(OUT_DIR, `${suffix}.png`),
        fullPage: false,
      });
      console.log('[capture] ok:', suffix);
    } catch (err) {
      console.error('[capture]', idx, 'socie failed:', err.message);
    }
    idx += 1;
  }

  // 05-08: SOCIE tab — almawred variant (restatement watermark active)
  for (const v of variants) {
    try {
      await setLangThenTheme(page, v.lang, v.theme, 'almawred');
      await openSocieTab(page);
      const suffix = `${String(idx).padStart(2, '0')}-socie-restated-${v.lang}-${v.theme}`;
      await page.screenshot({
        path: path.join(OUT_DIR, `${suffix}.png`),
        fullPage: false,
      });
      console.log('[capture] ok:', suffix);
    } catch (err) {
      console.error('[capture]', idx, 'socie-restated failed:', err.message);
    }
    idx += 1;
  }

  // 09-12: Balance Sheet with restatement watermark (almawred variant)
  for (const v of variants) {
    try {
      await setLangThenTheme(page, v.lang, v.theme, 'almawred');
      await openBalanceTab(page);
      const suffix = `${String(idx).padStart(2, '0')}-bs-restated-${v.lang}-${v.theme}`;
      await page.screenshot({
        path: path.join(OUT_DIR, `${suffix}.png`),
        fullPage: false,
      });
      console.log('[capture] ok:', suffix);
    } catch (err) {
      console.error('[capture]', idx, 'bs-restated failed:', err.message);
    }
    idx += 1;
  }

  // 13-16: Disclosure Notes IFRS section (almanara variant — non-Islamic)
  for (const v of variants) {
    try {
      await setLangThenTheme(page, v.lang, v.theme, 'almanara');
      await openDisclosuresTab(page);
      const suffix = `${String(idx).padStart(2, '0')}-disclosures-ifrs-${v.lang}-${v.theme}`;
      await page.screenshot({
        path: path.join(OUT_DIR, `${suffix}.png`),
        fullPage: false,
      });
      console.log('[capture] ok:', suffix);
    } catch (err) {
      console.error('[capture]', idx, 'disclosures-ifrs failed:', err.message);
    }
    idx += 1;
  }

  // 17-20: Disclosure Notes AAOIFI dual-label (demo-corporate variant — Islamic)
  for (const v of variants) {
    try {
      await setLangThenTheme(page, v.lang, v.theme, 'demo-corporate');
      await openDisclosuresTab(page);
      // Scroll down so AAOIFI notes (later in the list) are visible.
      await page.evaluate(() => {
        const panel = document.querySelector('[data-testid="disclosure-notes-section"]');
        if (panel) panel.scrollIntoView({ block: 'end' });
        window.scrollBy(0, 400);
      });
      await page.waitForTimeout(400);
      const suffix = `${String(idx).padStart(2, '0')}-disclosures-aaoifi-${v.lang}-${v.theme}`;
      await page.screenshot({
        path: path.join(OUT_DIR, `${suffix}.png`),
        fullPage: false,
      });
      console.log('[capture] ok:', suffix);
    } catch (err) {
      console.error('[capture]', idx, 'disclosures-aaoifi failed:', err.message);
    }
    idx += 1;
  }

  // 21-24: NARRATIVE_PENDING stub modal open (almanara variant — default IFRS notes)
  for (const v of variants) {
    try {
      await setLangThenTheme(page, v.lang, v.theme, 'almanara');
      await openDisclosuresTab(page);
      await expandFirstNarrativePendingAndOpenStub(page);
      const suffix = `${String(idx).padStart(2, '0')}-narrative-stub-modal-${v.lang}-${v.theme}`;
      await page.screenshot({
        path: path.join(OUT_DIR, `${suffix}.png`),
        fullPage: false,
      });
      console.log('[capture] ok:', suffix);
    } catch (err) {
      console.error('[capture]', idx, 'narrative-stub-modal failed:', err.message);
    }
    idx += 1;
  }

  await browser.close();
  console.log('[capture] done:', OUT_DIR);
})().catch((err) => {
  console.error('[capture] fatal:', err);
  process.exit(1);
});
