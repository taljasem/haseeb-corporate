/**
 * AUDIT-ACC-003 screenshot capture — YearEndCloseScreen (FN-271).
 *
 * Runs Playwright against `vite preview` (per HASEEB-189). MOCK seed
 * data in engine/index.js ships 3 fiscal-year fixtures:
 *   FY-2 (current - 2): CLOSED with full checklist + export buttons.
 *   FY-1 (current - 1): PENDING_APPROVAL with blocked scope-exception.
 *   FY-3 (current - 3): REVERSED with reversal reason.
 *
 * Captures 20 PNGs (5 surfaces × 4 variants EN/AR × dark/light):
 *   01-04: year list showing all three states side by side.
 *   05-08: per-year detail — PREPARED (FY-1) with pre-close checklist
 *          (blocked scope-exception + ready items collapsed).
 *   09-12: Approve confirmation modal open with governance notice.
 *   13-16: per-year detail — CLOSED (FY-2) with FS export button group.
 *   17-20: Reverse modal with reason populated + reconfirm checkbox.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const BASE_URL = process.env.PREVIEW_URL || 'http://localhost:4321';
const OUT_DIR =
  '/Users/tarekaljasem/Downloads/aft-command/memory-bank/screenshots/AUDIT-ACC-003';

fs.mkdirSync(OUT_DIR, { recursive: true });

const FAKE_TOKEN = 'dev.stub.token.for.screenshots';
// Use a different id from mock preparedBy 'user-cfo-1' so the SoD gate
// does NOT fire on FY-1 and the Approve button remains visible in the
// screenshots.
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
const FY_PREPARED = CURRENT_YEAR - 1;
// const FY_REVERSED = CURRENT_YEAR - 3;

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

async function openApproveModal(page) {
  try {
    await page
      .locator('[data-testid="yec-action-approve"]')
      .first()
      .click({ timeout: 5000 });
    await page.waitForTimeout(700);
    // Type the year into the confirm field so the Approve button
    // enables in the screenshot.
    await page
      .locator('[data-testid="yec-approve-type-to-confirm"]')
      .fill(String(FY_PREPARED));
    await page.waitForTimeout(300);
  } catch (err) {
    console.error('[nav] open-approve-modal failed:', err.message);
  }
}

async function openReverseModal(page) {
  try {
    await page
      .locator('[data-testid="yec-action-reverse"]')
      .first()
      .click({ timeout: 5000 });
    await page.waitForTimeout(700);
    await page
      .locator('[data-testid="yec-reverse-reason"]')
      .fill(
        'Material inventory count variance discovered post-close; five warehouses recounted.',
      );
    await page.waitForTimeout(200);
    await page.locator('[data-testid="yec-reverse-acknowledge"]').check();
    await page.waitForTimeout(300);
  } catch (err) {
    console.error('[nav] open-reverse-modal failed:', err.message);
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

  // 01-04: year list (mixed states)
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

  // 05-08: per-year detail — PREPARED (FY_PREPARED) with blocked-checklist
  for (const v of variants) {
    try {
      await setLangThenTheme(page, v.lang, v.theme);
      await openYearRow(page, FY_PREPARED);
      const suffix = `${String(idx).padStart(2, '0')}-detail-prepared-checklist-${v.lang}-${v.theme}`;
      await page.screenshot({
        path: path.join(OUT_DIR, `${suffix}.png`),
        fullPage: false,
      });
      console.log('[capture] ok:', suffix);
    } catch (err) {
      console.error('[capture]', idx, 'detail-prepared failed:', err.message);
    }
    idx += 1;
  }

  // 09-12: Approve confirmation modal
  for (const v of variants) {
    try {
      await setLangThenTheme(page, v.lang, v.theme);
      await openYearRow(page, FY_PREPARED);
      await openApproveModal(page);
      const suffix = `${String(idx).padStart(2, '0')}-approve-modal-${v.lang}-${v.theme}`;
      await page.screenshot({
        path: path.join(OUT_DIR, `${suffix}.png`),
        fullPage: false,
      });
      console.log('[capture] ok:', suffix);
    } catch (err) {
      console.error('[capture]', idx, 'approve-modal failed:', err.message);
    }
    idx += 1;
  }

  // 13-16: per-year detail — CLOSED (FY_APPROVED) with FS export group
  for (const v of variants) {
    try {
      await setLangThenTheme(page, v.lang, v.theme);
      await openYearRow(page, FY_APPROVED);
      const suffix = `${String(idx).padStart(2, '0')}-detail-approved-export-${v.lang}-${v.theme}`;
      await page.screenshot({
        path: path.join(OUT_DIR, `${suffix}.png`),
        fullPage: false,
      });
      console.log('[capture] ok:', suffix);
    } catch (err) {
      console.error('[capture]', idx, 'detail-approved failed:', err.message);
    }
    idx += 1;
  }

  // 17-20: Reverse modal with reason + reconfirm
  for (const v of variants) {
    try {
      await setLangThenTheme(page, v.lang, v.theme);
      await openYearRow(page, FY_APPROVED);
      await openReverseModal(page);
      const suffix = `${String(idx).padStart(2, '0')}-reverse-modal-${v.lang}-${v.theme}`;
      await page.screenshot({
        path: path.join(OUT_DIR, `${suffix}.png`),
        fullPage: false,
      });
      console.log('[capture] ok:', suffix);
    } catch (err) {
      console.error('[capture]', idx, 'reverse-modal failed:', err.message);
    }
    idx += 1;
  }

  await browser.close();
  console.log('[capture] done:', OUT_DIR);
})().catch((err) => {
  console.error('[capture] fatal:', err);
  process.exit(1);
});
