/**
 * HASEEB-221 frontend capture — per-employee "Download Payslip" button
 * on the APPROVED-run detail drawer in PayrollScreen.
 *
 * 4 PNGs: EN + AR × dark + light. Shows at least three employee rows
 * each with the Download Payslip button (Owner role — always visible).
 * Screenshots land in memory-bank/screenshots/HASEEB-221-frontend/.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const BASE_URL = 'http://localhost:4173';
const OUT_DIR =
  '/Users/tarekaljasem/Downloads/aft-command/memory-bank/screenshots/HASEEB-221-frontend';

fs.mkdirSync(OUT_DIR, { recursive: true });

const FAKE_TOKEN = 'dev.stub.token.for.screenshots';
const FAKE_USER = {
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
          body: JSON.stringify(wrapData(FAKE_USER)),
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
    if (stillLoading === 0) {
      return;
    }
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
    // Role picker may have auto-resolved already.
  }
}

async function navigateToPayroll(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
  await pickOwner(page);
  const isAr =
    (await page.evaluate(() => document.documentElement.lang)) === 'ar';
  const payrollText = isAr ? /^الرواتب$/ : /^Payroll$/i;
  try {
    await page.getByText(payrollText).first().click({ timeout: 6000 });
  } catch (err) {
    console.error('[nav] payroll sidebar click failed:', err.message);
  }
  await page.waitForTimeout(900);
}

async function setLangThenTheme(page, lang, theme) {
  await page.evaluate(
    ({ t }) => {
      try {
        localStorage.setItem('haseeb-corporate-theme', t);
      } catch {}
      document.documentElement.setAttribute('data-theme', t);
    },
    { t: theme },
  );
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const currentLang = await page.evaluate(
    () => document.documentElement.lang || 'en',
  );
  if (currentLang !== lang) {
    try {
      await page
        .getByLabel(/Toggle language|تبديل اللغة/i)
        .first()
        .click({ timeout: 4000 });
    } catch {}
    await page.waitForTimeout(400);
  }
  await navigateToPayroll(page);
}

async function openRunByPeriod(page, periodLabel) {
  const row = page.getByRole('button', {
    name: new RegExp(
      `(Open payroll run for|فتح مشغل الرواتب للفترة) ${periodLabel}`,
    ),
  });
  await row.first().click({ timeout: 5000 });
  await page.waitForTimeout(500);
}

async function closeDrawer(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
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

  // APPROVED-run detail (2026-03): shows Download Payslip button per row
  // (Owner → always visible; and also Download WPS header button).
  let idx = 1;
  for (const v of variants) {
    try {
      await setLangThenTheme(page, v.lang, v.theme);
      // Open an APPROVED or PAID run — 2026-03 is APPROVED in the MOCK seed.
      // Fall back to 2026-02 (PAID) if APPROVED missing.
      try {
        await openRunByPeriod(page, '2026-03');
      } catch {
        await openRunByPeriod(page, '2026-02');
      }
      const suffix = `${String(idx).padStart(2, '0')}-${v.lang}-${v.theme}`;
      await page.screenshot({
        path: path.join(OUT_DIR, `${suffix}-approved-run-payslip-button.png`),
        fullPage: false,
      });
      console.log('[capture] ok:', suffix);
      await closeDrawer(page);
    } catch (err) {
      console.error('[capture]', idx, 'failed:', err.message);
    }
    idx += 1;
  }

  await browser.close();
  console.log('[capture] done:', OUT_DIR);
})().catch((err) => {
  console.error('[capture] fatal:', err);
  process.exit(1);
});
