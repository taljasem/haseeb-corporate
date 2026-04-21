/**
 * AUDIT-ACC-010 screenshot capture — recurring-entry templates tab +
 * instance history modal.
 *
 * Launches Playwright Chromium against the dev server running in MOCK
 * mode (VITE_USE_MOCKS=true, default). The AUDIT-ACC-010 engine rewire
 * routes the LIVE surface names (listRecurringEntries / etc.) to MOCK
 * adapters that delegate to mockEngine.getManualJETemplates — so the
 * screen renders a populated templates tab with the mockEngine's seeded
 * template set (Monthly Rent Allocation, Payroll Run, etc.).
 *
 * Instance-history data is served from the MOCK adapter
 * (listRecurringEntryInstances returns {entries: [], total: 0}) — so
 * the modal shots display the empty-state. Dispatch §13 accepts this
 * as reasonable for v1 (backend data emerges organically once the
 * scheduler + manual fires run); future dispatch can run against a
 * seeded test tenant.
 *
 * Captures 8 PNGs minimum:
 *   01-04: templates-tab          (EN/AR × dark/light)
 *   05-08: instance-history-modal (EN/AR × dark/light, empty-state)
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const BASE_URL = 'http://localhost:5173';
const OUT_DIR =
  '/Users/tarekaljasem/Downloads/aft-command/memory-bank/screenshots/AUDIT-ACC-010';

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
async function stubAuth(context) {
  await context.route(
    (url) => url.hostname === 'localhost' && url.port === '3000',
    async (route) => {
      const url = route.request().url();
      console.log('[stub]', route.request().method(), url);
      if (url.includes('/api/auth/me')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(wrapData(FAKE_USER)) });
      }
      if (url.includes('/api/auth/tenant-info')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(wrapData(FAKE_TENANT)) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(wrapData(null)) });
    },
  );
}

async function seedPrefs(page, { lang, theme }) {
  await page.addInitScript(
    ({ lang, theme, token }) => {
      try {
        localStorage.setItem('haseeb_corp_token', token);
        localStorage.setItem('haseeb_corp_token_exp', String(Date.now() + 24 * 3600 * 1000));
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
  // Poll for up to 15s waiting for the LoadingShell to disappear.
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

async function navigateToManualJE(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(600);
  const isAr = (await page.evaluate(() => document.documentElement.lang)) === 'ar';
  // Click CFO role.
  const cfoText = isAr ? 'المدير المالي' : 'CFO';
  try {
    await page.getByText(cfoText, { exact: true }).first().click({ timeout: 4000 });
    await page.waitForTimeout(400);
  } catch {}

  // Manual JE sidebar.
  const manualJeText = isAr ? /قيد يدوي/ : /Manual JE/i;
  try {
    await page.getByText(manualJeText).first().click({ timeout: 6000 });
  } catch {}
  await page.waitForTimeout(1000);

  // Templates tab. Structural: find the 4-button tab row (gap:2px,
  // flex) under the Manual JE header. This is robust across EN/AR
  // where the text match fails due to numeric count suffixes.
  try {
    const tabBtns = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      // Find a flex-row group of 4 adjacent siblings with gap:2px.
      for (const btn of buttons) {
        const parent = btn.parentElement;
        if (!parent) continue;
        const style = parent.getAttribute('style') || '';
        if (!style.includes('gap: 2px') || !style.includes('display: flex')) continue;
        const siblings = Array.from(parent.children);
        if (siblings.length === 4 && siblings.every((s) => s.tagName === 'BUTTON')) {
          // Return coordinates for the 3rd button.
          const r = siblings[2].getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }
      }
      return null;
    });
    if (tabBtns) {
      await page.mouse.click(tabBtns.x, tabBtns.y);
    } else {
      console.error('[nav] templates-tab structural lookup failed');
    }
  } catch (err) {
    console.error('[nav] templates-tab click error:', err.message);
  }
  await page.waitForTimeout(800);
}

async function setLangThenTheme(page, lang, theme) {
  await page.evaluate(
    ({ t }) => {
      try { localStorage.setItem('haseeb-corporate-theme', t); } catch {}
      document.documentElement.setAttribute('data-theme', t);
    },
    { t: theme },
  );
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const currentLang = await page.evaluate(() => document.documentElement.lang || 'en');
  if (currentLang !== lang) {
    try {
      await page.getByLabel(/Toggle language|تبديل اللغة/i).first().click({ timeout: 4000 });
    } catch {}
    await page.waitForTimeout(400);
  }
  await navigateToManualJE(page);
}

async function openInstanceHistoryModal(page) {
  const isAr = (await page.evaluate(() => document.documentElement.lang)) === 'ar';
  // Click the first template list item — the mockEngine seeds
  // "Monthly Rent Allocation" as the first template.
  try {
    const tplText = isAr ? /إيجار|الرواتب|الإهلاك|التأمينات/ : /Monthly Rent|Payroll|Depreciation|PIFSS/i;
    const item = page.getByText(tplText).first();
    await item.click({ timeout: 5000 });
    await page.waitForTimeout(500);
    const btn = isAr ? /^سجل التنفيذات$/ : /^Instance History$/i;
    await page.getByText(btn).first().click({ timeout: 4000 });
  } catch (err) {
    console.error('[capture] open modal failed:', err.message);
  }
  await page.waitForTimeout(600);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
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

  const ordered = [
    { lang: 'en', theme: 'dark', suffix: '01-en-dark' },
    { lang: 'ar', theme: 'dark', suffix: '02-ar-dark' },
    { lang: 'en', theme: 'light', suffix: '03-en-light' },
    { lang: 'ar', theme: 'light', suffix: '04-ar-light' },
  ];

  for (const v of ordered) {
    try {
      await setLangThenTheme(page, v.lang, v.theme);
      await page.screenshot({
        path: path.join(OUT_DIR, `${v.suffix}-templates-tab.png`),
        fullPage: false,
      });
      console.log('[capture] ok:', v.suffix, 'templates-tab');
    } catch (err) {
      console.error(`[capture] ${v.suffix}-templates-tab failed:`, err.message);
    }
  }

  const ordered2 = [
    { lang: 'en', theme: 'dark', suffix: '05-en-dark' },
    { lang: 'ar', theme: 'dark', suffix: '06-ar-dark' },
    { lang: 'en', theme: 'light', suffix: '07-en-light' },
    { lang: 'ar', theme: 'light', suffix: '08-ar-light' },
  ];
  for (const v of ordered2) {
    try {
      await setLangThenTheme(page, v.lang, v.theme);
      await openInstanceHistoryModal(page);
      await page.screenshot({
        path: path.join(OUT_DIR, `${v.suffix}-instance-history-modal.png`),
        fullPage: false,
      });
      console.log('[capture] ok:', v.suffix, 'instance-history-modal');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    } catch (err) {
      console.error(`[capture] ${v.suffix}-instance-history-modal failed:`, err.message);
    }
  }

  await browser.close();
  console.log('[capture] done:', OUT_DIR);
})().catch((err) => {
  console.error('[capture] fatal:', err);
  process.exit(1);
});
