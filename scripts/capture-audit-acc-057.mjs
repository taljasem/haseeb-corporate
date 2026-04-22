/**
 * AUDIT-ACC-057 screenshot capture — CITAssessmentScreen (FN-249).
 *
 * Runs Playwright against `vite preview` (per HASEEB-189 — the
 * StrictMode auth-race in dev-mode makes capture flaky). MOCK seed
 * data in engine/index.js ships 7 cases covering every
 * CitAssessmentStatus value plus one approaching-statute case (~80
 * days from now) so we can demo the warning row without mutating data.
 *
 * Captures 20 PNGs (5 surfaces × 4 variants EN/AR × dark/light):
 *   01-04: year-list (approaching-statute row highlighted)
 *   05-08: per-case detail — UNDER_REVIEW state (FY2023)
 *   09-12: Record Assessment modal open (validation surface visible)
 *   13-16: per-case detail — CLOSED terminal (FY2019)
 *   17-20: per-case detail — STATUTE_EXPIRED terminal (FY2018)
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const BASE_URL = process.env.PREVIEW_URL || 'http://localhost:4321';
const OUT_DIR =
  '/Users/tarekaljasem/Downloads/aft-command/memory-bank/screenshots/AUDIT-ACC-057';

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
    // role picker may have auto-resolved already
  }
}

async function navigateToCitAssessment(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
  await pickOwner(page);
  const isAr =
    (await page.evaluate(() => document.documentElement.lang)) === 'ar';
  const label = isAr
    ? /قضايا ضريبة دخل الشركات \(سنوية\)/
    : /CIT Assessments \(Annual\)/i;
  try {
    await page.getByText(label).first().click({ timeout: 6000 });
  } catch (err) {
    console.error('[nav] cit-assessment click failed:', err.message);
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
  await navigateToCitAssessment(page);
}

async function openCaseRow(page, fiscalYear) {
  try {
    await page
      .locator(`[data-testid="cit-row-${fiscalYear}"]`)
      .first()
      .click({ timeout: 5000 });
    await page.waitForTimeout(900);
  } catch (err) {
    console.error('[nav] open-case', fiscalYear, 'failed:', err.message);
  }
}

async function openRecordAssessmentModal(page) {
  try {
    await page
      .locator('[data-testid="cit-action-record-assessment"]')
      .first()
      .click({ timeout: 5000 });
    await page.waitForTimeout(800);
    // Trigger validation by clicking Save with an empty amount — the
    // existing CitAssessmentTransitionModal surfaces the validation
    // error banner inline. Find the Save/حفظ button within the modal.
    const isAr =
      (await page.evaluate(() => document.documentElement.lang)) === 'ar';
    const saveLabel = isAr ? /^حفظ$/ : /^Save$/;
    try {
      await page
        .getByRole('button', { name: saveLabel })
        .last()
        .click({ timeout: 2500 });
      await page.waitForTimeout(500);
    } catch {
      /* validation banner may show without a second click if placeholder is empty */
    }
  } catch (err) {
    console.error('[nav] open-record-assessment failed:', err.message);
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

  // 01-04: year list (approaching-statute banner + FY2020 row highlighted)
  for (const v of variants) {
    try {
      await setLangThenTheme(page, v.lang, v.theme);
      const suffix = `${String(idx).padStart(2, '0')}-year-list-${v.lang}-${v.theme}`;
      await page.screenshot({
        path: path.join(OUT_DIR, `${suffix}.png`),
        fullPage: false,
      });
      console.log('[capture] ok:', suffix);
    } catch (err) {
      console.error('[capture]', idx, 'year-list failed:', err.message);
    }
    idx += 1;
  }

  // 05-08: per-case detail — UNDER_REVIEW (FY2023)
  for (const v of variants) {
    try {
      await setLangThenTheme(page, v.lang, v.theme);
      await openCaseRow(page, 2023);
      const suffix = `${String(idx).padStart(2, '0')}-detail-under-review-${v.lang}-${v.theme}`;
      await page.screenshot({
        path: path.join(OUT_DIR, `${suffix}.png`),
        fullPage: false,
      });
      console.log('[capture] ok:', suffix);
    } catch (err) {
      console.error('[capture]', idx, 'detail-under-review failed:', err.message);
    }
    idx += 1;
  }

  // 09-12: Record Assessment modal open on a UNDER_REVIEW case
  for (const v of variants) {
    try {
      await setLangThenTheme(page, v.lang, v.theme);
      await openCaseRow(page, 2023);
      await openRecordAssessmentModal(page);
      const suffix = `${String(idx).padStart(2, '0')}-record-assessment-modal-${v.lang}-${v.theme}`;
      await page.screenshot({
        path: path.join(OUT_DIR, `${suffix}.png`),
        fullPage: false,
      });
      console.log('[capture] ok:', suffix);
    } catch (err) {
      console.error('[capture]', idx, 'record-assessment-modal failed:', err.message);
    }
    idx += 1;
  }

  // 13-16: per-case detail — CLOSED terminal (FY2019)
  for (const v of variants) {
    try {
      await setLangThenTheme(page, v.lang, v.theme);
      await openCaseRow(page, 2019);
      const suffix = `${String(idx).padStart(2, '0')}-detail-closed-${v.lang}-${v.theme}`;
      await page.screenshot({
        path: path.join(OUT_DIR, `${suffix}.png`),
        fullPage: false,
      });
      console.log('[capture] ok:', suffix);
    } catch (err) {
      console.error('[capture]', idx, 'detail-closed failed:', err.message);
    }
    idx += 1;
  }

  // 17-20: per-case detail — STATUTE_EXPIRED terminal (FY2018)
  for (const v of variants) {
    try {
      await setLangThenTheme(page, v.lang, v.theme);
      await openCaseRow(page, 2018);
      const suffix = `${String(idx).padStart(2, '0')}-detail-statute-expired-${v.lang}-${v.theme}`;
      await page.screenshot({
        path: path.join(OUT_DIR, `${suffix}.png`),
        fullPage: false,
      });
      console.log('[capture] ok:', suffix);
    } catch (err) {
      console.error('[capture]', idx, 'detail-statute-expired failed:', err.message);
    }
    idx += 1;
  }

  await browser.close();
  console.log('[capture] done:', OUT_DIR);
})().catch((err) => {
  console.error('[capture] fatal:', err);
  process.exit(1);
});
