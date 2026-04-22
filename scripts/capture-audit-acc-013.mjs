/**
 * AUDIT-ACC-013 screenshot capture — PayrollScreen (employees / runs /
 * PIFSS tabs) + run detail + WPS-download button visibility.
 *
 * Runs Playwright against the dev server in MOCK mode (VITE_USE_MOCKS=true,
 * default). MOCK seed data is rich enough to exercise:
 *   - 3 payroll runs (DRAFT, APPROVED, PAID) with mixed Kuwaiti +
 *     non-Kuwaiti line items showing statutory PIFSS differences
 *   - 6 employees (3 Kuwaiti + 3 non-Kuwaiti, one TERMINATED)
 *   - "Download WPS" button visible on APPROVED + PAID rows
 *
 * Captures 16 PNGs minimum:
 *   01-04: runs-list                   (EN/AR × dark/light)
 *   05-08: run-detail-with-entries     (EN/AR × dark/light, DRAFT run)
 *   09-12: approved-run-with-wps       (EN/AR × dark/light, APPROVED run)
 *   13-16: employee-detail-slide-over  (EN/AR × dark/light)
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const BASE_URL = 'http://localhost:5173';
const OUT_DIR =
  '/Users/tarekaljasem/Downloads/aft-command/memory-bank/screenshots/AUDIT-ACC-013';

fs.mkdirSync(OUT_DIR, { recursive: true });

const FAKE_TOKEN = 'dev.stub.token.for.screenshots';
const FAKE_USER = {
  id: 'user-owner-1',
  email: 'owner@demo.local',
  name: 'Demo Owner',
  // OWNER so the full approve/pay/download suite is visible.
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
      console.log('[stub]', route.request().method(), url);
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
      console.log(`[bootstrap] loaded after ${(i + 1) * 500}ms`);
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
  // Click the row whose aria-label contains the period (EN/AR both use
  // the ISO "YYYY-MM" string verbatim).
  const row = page.getByRole('button', {
    name: new RegExp(`(Open payroll run for|فتح مشغل الرواتب للفترة) ${periodLabel}`),
  });
  await row.first().click({ timeout: 5000 });
  await page.waitForTimeout(500);
}

async function closeDrawer(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

async function openEmployeesTab(page) {
  const isAr =
    (await page.evaluate(() => document.documentElement.lang)) === 'ar';
  const label = isAr ? /^الموظفون$/ : /^Employees$/i;
  try {
    await page.getByRole('tab', { name: label }).click({ timeout: 5000 });
    await page.waitForTimeout(500);
  } catch (err) {
    console.error('[nav] employees tab click failed:', err.message);
  }
}

async function openFirstEmployee(page) {
  const isAr =
    (await page.evaluate(() => document.documentElement.lang)) === 'ar';
  const label = isAr
    ? /فتح تفاصيل الموظف/
    : /Open employee detail for/i;
  try {
    await page
      .getByRole('button', { name: label })
      .first()
      .click({ timeout: 5000 });
    await page.waitForTimeout(500);
  } catch (err) {
    console.error('[nav] first employee click failed:', err.message);
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
  page.on('console', (msg) => {
    const txt = msg.text();
    if (msg.type() === 'error' || txt.includes('fail') || txt.includes('Error')) {
      console.log('[console-' + msg.type() + ']', txt.slice(0, 200));
    }
  });

  await seedPrefs(page, { lang: 'en', theme: 'dark' });
  await bootstrap(page);

  const variants = [
    { lang: 'en', theme: 'dark' },
    { lang: 'ar', theme: 'dark' },
    { lang: 'en', theme: 'light' },
    { lang: 'ar', theme: 'light' },
  ];

  // 01-04: runs list
  let idx = 1;
  for (const v of variants) {
    try {
      await setLangThenTheme(page, v.lang, v.theme);
      const suffix = `${String(idx).padStart(2, '0')}-${v.lang}-${v.theme}`;
      await page.screenshot({
        path: path.join(OUT_DIR, `${suffix}-runs-list.png`),
        fullPage: false,
      });
      console.log('[capture] ok:', suffix, 'runs-list');
    } catch (err) {
      console.error('[capture]', idx, 'runs-list failed:', err.message);
    }
    idx += 1;
  }

  // 05-08: DRAFT run detail (with mixed Kuwaiti + non-Kuwaiti entries)
  for (const v of variants) {
    try {
      await setLangThenTheme(page, v.lang, v.theme);
      await openRunByPeriod(page, '2026-04');
      const suffix = `${String(idx).padStart(2, '0')}-${v.lang}-${v.theme}`;
      await page.screenshot({
        path: path.join(OUT_DIR, `${suffix}-run-detail-draft.png`),
        fullPage: false,
      });
      console.log('[capture] ok:', suffix, 'run-detail-draft');
      await closeDrawer(page);
    } catch (err) {
      console.error('[capture]', idx, 'run-detail-draft failed:', err.message);
    }
    idx += 1;
  }

  // 09-12: APPROVED run detail (shows Download WPS button)
  for (const v of variants) {
    try {
      await setLangThenTheme(page, v.lang, v.theme);
      await openRunByPeriod(page, '2026-03');
      const suffix = `${String(idx).padStart(2, '0')}-${v.lang}-${v.theme}`;
      await page.screenshot({
        path: path.join(OUT_DIR, `${suffix}-run-detail-approved-wps.png`),
        fullPage: false,
      });
      console.log('[capture] ok:', suffix, 'run-detail-approved-wps');
      await closeDrawer(page);
    } catch (err) {
      console.error('[capture]', idx, 'approved failed:', err.message);
    }
    idx += 1;
  }

  // 13-16: Employee detail slide-over
  for (const v of variants) {
    try {
      await setLangThenTheme(page, v.lang, v.theme);
      await openEmployeesTab(page);
      await openFirstEmployee(page);
      const suffix = `${String(idx).padStart(2, '0')}-${v.lang}-${v.theme}`;
      await page.screenshot({
        path: path.join(OUT_DIR, `${suffix}-employee-detail.png`),
        fullPage: false,
      });
      console.log('[capture] ok:', suffix, 'employee-detail');
      await closeDrawer(page);
    } catch (err) {
      console.error('[capture]', idx, 'employee-detail failed:', err.message);
    }
    idx += 1;
  }

  await browser.close();
  console.log('[capture] done:', OUT_DIR);
})().catch((err) => {
  console.error('[capture] fatal:', err);
  process.exit(1);
});
