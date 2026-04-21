/**
 * AUDIT-ACC-005 screenshot capture.
 *
 * Launches Playwright Chromium, intercepts the 3 auth endpoints so the
 * ProtectedRoute shell gets past login without a real backend, then
 * navigates to Aging Reports and opens each of the three modals in both
 * EN+AR × light+dark (12 screenshots + 2 extras).
 *
 * Runs against the dev server on http://localhost:5173 with VITE_USE_MOCKS=true.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const BASE_URL = 'http://localhost:5173';
const OUT_DIR =
  '/Users/tarekaljasem/Downloads/aft-command/memory-bank/screenshots/AUDIT-ACC-005';

fs.mkdirSync(OUT_DIR, { recursive: true });

const FAKE_TOKEN = 'dev.stub.token.for.screenshots';
const FAKE_USER = {
  id: 'user-cfo-1',
  email: 'cfo@demo.local',
  name: 'Demo CFO',
  role: 'ACCOUNTANT',
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

// Install routing at context level (fires before any page.goto). Routes are
// URL-predicate functions because Playwright glob-matchers do NOT cross the
// protocol scheme, and a string-equal route on `http://localhost:3000/...`
// doesn't match in all Playwright versions.
async function stubAuth(context) {
  await context.route((url) => url.hostname === 'localhost' && url.port === '3000', async (route) => {
    const url = route.request().url();
    if (url.includes('/api/auth/login')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(wrapData({ token: FAKE_TOKEN, user: FAKE_USER, tenant: FAKE_TENANT, expiresAt: Date.now() + 24 * 3600 * 1000 })) });
    }
    if (url.includes('/api/auth/me')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(wrapData(FAKE_USER)) });
    }
    if (url.includes('/api/auth/tenant-info')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(wrapData(FAKE_TENANT)) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(wrapData(null)) });
  });
}

async function seedTokenAndPrefs(page, { lang, theme }) {
  await page.addInitScript(
    ({ token, lang, theme }) => {
      try {
        localStorage.setItem('haseeb_corp_token', token);
        localStorage.setItem('haseeb_corp_token_exp', String(Date.now() + 24 * 3600 * 1000));
        // Canonical storage keys per src/i18n/index.js + ThemeContext.
        localStorage.setItem('haseeb-language', lang);
        localStorage.setItem('haseeb-corporate-theme', theme);
        // Also set the pre-paint SSR hint so the first render picks the
        // correct theme (ThemeContext reads the data-theme attribute first).
        document.documentElement.setAttribute('data-theme', theme);
      } catch {
        /* no-op */
      }
    },
    { token: FAKE_TOKEN, lang, theme },
  );
}

async function waitForAging(page) {
  // Wait for the shell to be mounted.
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);

  const isAr = (await page.evaluate(() => document.documentElement.lang)) === 'ar';

  // Switch to CFO role (the role toggle is in the header). The button label
  // is `t('role_cfo')` — translated. CFO is "CFO" in EN and "المدير المالي"
  // in AR. Easier: use the role attribute — the Header renders buttons with
  // a distinctive background; grab by data-role if available, else by text
  // in both languages.
  const cfoText = isAr ? 'المدير المالي' : 'CFO';
  try {
    await page.getByText(cfoText, { exact: true }).first().click({ timeout: 4000 });
    await page.waitForTimeout(500);
  } catch {
    // already on CFO, or failed
  }

  // Click the Aging Reports sidebar item. EN: "Aging Reports"; AR: "تقارير الأعمار".
  const agingText = isAr ? /تقارير الأعمار/ : /Aging Reports/i;
  try {
    await page.getByText(agingText).first().click({ timeout: 5000 });
  } catch {
    // fall through; screenshot will reveal what happened
  }
  // Allow time for the aging data + narration to render.
  await page.waitForTimeout(1500);
}

async function openKebabAndAction(page, actionTextRegex) {
  // The kebab buttons have aria-label "Open menu" in EN and "فتح القائمة" in AR.
  const isAr = (await page.evaluate(() => document.documentElement.lang)) === 'ar';
  const kebabRegex = isAr ? /فتح القائمة/ : /Open menu/;
  let clicked = false;
  try {
    await page.getByLabel(kebabRegex).first().click({ timeout: 5000 });
    clicked = true;
  } catch {
    // Fallback: find the first button with lucide "more-vertical" icon.
  }
  if (!clicked) {
    try {
      await page.locator('button:has(svg.lucide-ellipsis-vertical)').first().click({ timeout: 3000 });
      clicked = true;
    } catch {
      /* eslint-disable no-empty */
    }
  }
  if (!clicked) {
    try {
      // Last-resort fallback: click the kebab by selecting the last column of
      // the first row that contains a single-svg button.
      await page.locator('button[aria-label]').filter({ has: page.locator('svg') }).last().click({ timeout: 3000 });
    } catch {
      /* eslint-disable no-empty */
    }
  }
  await page.waitForTimeout(250);
  await page.getByText(actionTextRegex).first().click({ timeout: 5000 });
  await page.waitForTimeout(450);
}

async function captureModal({
  page,
  outFile,
  modalSetup,
}) {
  await modalSetup(page);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, outFile), fullPage: false });
  // Close by ESC.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

async function forceTheme(page, theme) {
  await page.evaluate((t) => {
    document.documentElement.setAttribute('data-theme', t);
    try {
      localStorage.setItem('haseeb-corporate-theme', t);
    } catch { /* no-op */ }
  }, theme);
}

async function forceLang(page, lang) {
  await page.evaluate((l) => {
    try {
      localStorage.setItem('haseeb-language', l);
    } catch { /* no-op */ }
    document.documentElement.lang = l;
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';
  }, lang);
}

async function captureForLangTheme({ page, lang, theme }) {
  // Theme: via localStorage + attribute (ThemeContext reads the DOM attr on
  // first paint, so this is all we need).
  await page.evaluate(({ t }) => {
    try { localStorage.setItem('haseeb-corporate-theme', t); } catch {}
    document.documentElement.setAttribute('data-theme', t);
  }, { t: theme });
  // Reload to let the ThemeContext pick up the new attribute cleanly.
  await page.reload({ waitUntil: 'networkidle' });
  // Language: use the header's "Toggle language" button since i18n has to
  // run through i18n.changeLanguage() for translations to swap. Setting
  // localStorage alone doesn't update already-mounted i18n state. The
  // toggle button is EN<->AR; if we're already on the target lang, skip.
  const currentLang = await page.evaluate(() => document.documentElement.lang || 'en');
  if (currentLang !== lang) {
    try {
      await page.getByLabel(/Toggle language|تبديل اللغة/i).first().click({ timeout: 4000 });
    } catch {
      /* eslint-disable no-empty */
    }
    await page.waitForTimeout(400);
  }
  await waitForAging(page);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  await stubAuth(context);
  const page = await context.newPage();
  await seedTokenAndPrefs(page, { lang: 'en', theme: 'dark' });
  await page.goto(BASE_URL, { waitUntil: 'networkidle' });

  const matrix = [
    { lang: 'en', theme: 'dark', suffix: '01-en-dark' },
    { lang: 'ar', theme: 'dark', suffix: '02-ar-dark' },
    { lang: 'en', theme: 'light', suffix: '03-en-light' },
    { lang: 'ar', theme: 'light', suffix: '04-ar-light' },
  ];
  // Re-number to match the spec (01..12):
  // writeoff: 01 en-dark, 02 ar-dark, 03 en-light, 04 ar-light
  // dispute:  05 en-dark, 06 ar-dark, 07 en-light, 08 ar-light
  // schedule: 09 en-dark, 10 ar-dark, 11 en-light, 12 ar-light
  const ordered = [
    { lang: 'en', theme: 'dark' },
    { lang: 'ar', theme: 'dark' },
    { lang: 'en', theme: 'light' },
    { lang: 'ar', theme: 'light' },
  ];

  // We'll capture in per-variant order and then rename to match the spec.
  for (let i = 0; i < ordered.length; i++) {
    const { lang, theme } = ordered[i];
    const suffix = `batch-${i}-${lang}-${theme}`;
    try {
      await captureForLangTheme({ page, lang, theme });
      // After captureForLangTheme sets up the page, take the 3 modal shots.
      const labels = {
        en: {
          writeoff: /Write off/i,
          dispute: /Mark as disputed/i,
          schedule_ar: /Schedule payment plan/i,
        },
        ar: {
          writeoff: /^شطب$/,
          dispute: /وسم كمتنازع/,
          schedule_ar: /جدولة خطة دفع/,
        },
      };
      const L = labels[lang];
      await captureModal({ page, outFile: `${suffix}-writeoff.png`, modalSetup: (p) => openKebabAndAction(p, L.writeoff) });
      await captureModal({ page, outFile: `${suffix}-dispute.png`, modalSetup: (p) => openKebabAndAction(p, L.dispute) });
      await captureModal({ page, outFile: `${suffix}-schedule-ar.png`, modalSetup: (p) => openKebabAndAction(p, L.schedule_ar) });
    } catch (err) {
      console.error(`[capture] variant ${suffix} failed:`, err.message);
    }
  }

  // Rename batch files to the spec's 01..12 numbering.
  const renameMap = {
    'batch-0-en-dark-writeoff.png': '01-en-dark-writeoff.png',
    'batch-1-ar-dark-writeoff.png': '02-ar-dark-writeoff.png',
    'batch-2-en-light-writeoff.png': '03-en-light-writeoff.png',
    'batch-3-ar-light-writeoff.png': '04-ar-light-writeoff.png',
    'batch-0-en-dark-dispute.png': '05-en-dark-dispute.png',
    'batch-1-ar-dark-dispute.png': '06-ar-dark-dispute.png',
    'batch-2-en-light-dispute.png': '07-en-light-dispute.png',
    'batch-3-ar-light-dispute.png': '08-ar-light-dispute.png',
    'batch-0-en-dark-schedule-ar.png': '09-en-dark-schedule-ar.png',
    'batch-1-ar-dark-schedule-ar.png': '10-ar-dark-schedule-ar.png',
    'batch-2-en-light-schedule-ar.png': '11-en-light-schedule-ar.png',
    'batch-3-ar-light-schedule-ar.png': '12-ar-light-schedule-ar.png',
  };
  for (const [from, to] of Object.entries(renameMap)) {
    const f = path.join(OUT_DIR, from);
    const t = path.join(OUT_DIR, to);
    if (fs.existsSync(f)) {
      fs.renameSync(f, t);
    }
  }

  // Sum-mismatch screenshot (13): reopen schedule-AR, tamper first amount.
  try {
    await forceLang(page, 'en');
    await forceTheme(page, 'dark');
    await page.reload({ waitUntil: 'networkidle' });
    await waitForAging(page);
    await openKebabAndAction(page, /Schedule payment plan/i);
    await page.waitForTimeout(400);
    const amountInputs = await page.locator('input[aria-label^="Amount (KWD)"]').all();
    if (amountInputs.length > 0) {
      await amountInputs[0].fill('0.000');
    }
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT_DIR, '13-en-dark-sum-mismatch.png') });
    await page.keyboard.press('Escape');
  } catch (err) {
    console.error('[capture] 13-sum-mismatch failed:', err.message);
  }

  // Tab-toggle screenshot (14): AgingReportsScreen AR kebab open showing
  // the "Schedule payment plan" option next to "Write off".
  try {
    await forceLang(page, 'en');
    await forceTheme(page, 'dark');
    await page.reload({ waitUntil: 'networkidle' });
    await waitForAging(page);
    const kebab = page.getByLabel(/Open menu/).first();
    await kebab.click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT_DIR, '14-en-dark-tab-toggle.png') });
  } catch (err) {
    console.error('[capture] 14-tab-toggle failed:', err.message);
  }

  await browser.close();
  console.log('[capture] done:', OUT_DIR);
})().catch((err) => {
  console.error('[capture] fatal:', err);
  process.exit(1);
});
