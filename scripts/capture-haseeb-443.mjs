/**
 * HASEEB-443 screenshot capture — YearEndCloseScreen APPROVED-state
 * detail view with the 5 real export buttons wired via HASEEB-443.
 *
 * Captures the APPROVED (CLOSED) fiscal-year detail view where the
 * 5 export buttons live (BS/IS/CF/SOCIE PDF + Disclosure Notes DOCX).
 * MOCK mode renders the mock metadata stub on click (dev surface); LIVE
 * mode triggers the real binary-download pipeline via the backend.
 *
 * Surfaces: 4 variants (EN/AR × dark/light) of the APPROVED detail.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const BASE_URL = process.env.PREVIEW_URL || 'http://localhost:4321';
const OUT_DIR =
  '/Users/tarekaljasem/Downloads/aft-command/memory-bank/screenshots/HASEEB-443';

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

const CURRENT_YEAR = new Date().getUTCFullYear();
const FY_APPROVED = CURRENT_YEAR - 2;

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

async function bootstrap(page) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(500);
    const stillLoading = await page
      .locator('text=/^Loading…$/i')
      .count()
      .catch(() => 0);
    if (stillLoading === 0) return;
  }
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
    /* no-op */
  }
}

async function navigateToYearEndClose(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
  await pickOwner(page);
  const isAr =
    (await page.evaluate(() => document.documentElement.lang)) === 'ar';
  const label = isAr ? /إقفال السنة المالية/ : /Year-End Close/i;
  try {
    await page.getByText(label).first().click({ timeout: 6000 });
  } catch (err) {
    console.error('[nav] year-end-close click failed:', err.message);
  }
  await page.waitForTimeout(1200);
}

async function setLangThenTheme(page, lang, theme) {
  await page.evaluate(
    ({ t, l }) => {
      try {
        localStorage.setItem('haseeb-corporate-theme', t);
        localStorage.setItem('haseeb-language', l);
      } catch {
        /* no-op */
      }
      document.documentElement.setAttribute('data-theme', t);
    },
    { t: theme, l: lang },
  );
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await navigateToYearEndClose(page);
}

async function openYearRow(page, fiscalYear) {
  try {
    await page
      .locator(`[data-testid="yec-row-${fiscalYear}"]`)
      .first()
      .click({ timeout: 5000 });
    await page.waitForTimeout(900);
  } catch (err) {
    console.error('[nav] open-year', fiscalYear, 'failed:', err.message);
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
  for (const v of variants) {
    try {
      await setLangThenTheme(page, v.lang, v.theme);
      await openYearRow(page, FY_APPROVED);
      const suffix = `${String(idx).padStart(2, '0')}-approved-exports-${v.lang}-${v.theme}`;
      await page.screenshot({
        path: path.join(OUT_DIR, `${suffix}.png`),
        fullPage: false,
      });
      console.log('[capture] ok:', suffix);
    } catch (err) {
      console.error('[capture]', idx, 'approved-exports failed:', err.message);
    }
    idx += 1;
  }

  await browser.close();
  console.log('Saved screenshots to', OUT_DIR);
})();
