/**
 * AUDIT-ACC-002 screenshot capture — PaymentVoucherScreen.
 *
 * Runs Playwright against `vite preview` (per HASEEB-189 guidance — the
 * StrictMode auth-race in `npm run dev` makes screenshot capture flaky
 * in dev-mode). MOCK seed data in engine/index.js provides 4 vouchers
 * spread across all four filter tabs + 2 mandates (one compliant,
 * count=2; one deliberately sub-2 so the HASEEB-274 warning can be
 * screenshot-verified).
 *
 * Captures 24 PNGs (6 surfaces × 4 variants EN/AR × dark/light):
 *   01-04: list-drafts                  (default, Drafts tab)
 *   05-08: list-awaiting                (Awaiting Action tab)
 *   09-12: composer-compliant           (mandate-1, count=2, no banner)
 *   13-16: composer-warning             (mandate-2, count=1, HASEEB-274 banner visible)
 *   17-20: detail-signatories           (PV-2026-0003 PENDING_SIGNATORIES)
 *   21-24: detail-paid                  (PV-2026-0004 PAID, terminal tab)
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const BASE_URL = 'http://localhost:4173';
const OUT_DIR =
  '/Users/tarekaljasem/Downloads/aft-command/memory-bank/screenshots/AUDIT-ACC-002';

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

async function navigateToPaymentVouchers(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
  await pickOwner(page);
  const isAr =
    (await page.evaluate(() => document.documentElement.lang)) === 'ar';
  const label = isAr ? /^سندات الصرف$/ : /^Payment Vouchers$/i;
  try {
    await page.getByText(label).first().click({ timeout: 6000 });
  } catch (err) {
    console.error('[nav] payment-vouchers click failed:', err.message);
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
  await navigateToPaymentVouchers(page);
}

async function clickTab(page, tabKey) {
  // Tab labels by language.
  const labels = {
    drafts: { en: /^Drafts$/, ar: /^المسودات$/ },
    awaiting_action: { en: /^Awaiting Action$/, ar: /^بانتظار الإجراء$/ },
    approved: { en: /^Approved or Signed$/, ar: /^معتمدة أو موقعة$/ },
    terminal: { en: /^Terminal$/, ar: /^نهائية$/ },
  };
  const isAr =
    (await page.evaluate(() => document.documentElement.lang)) === 'ar';
  const label = labels[tabKey][isAr ? 'ar' : 'en'];
  try {
    await page.getByRole('tab', { name: label }).click({ timeout: 5000 });
    await page.waitForTimeout(400);
  } catch (err) {
    console.error('[nav] tab', tabKey, 'click failed:', err.message);
  }
}

async function openComposer(page) {
  const isAr =
    (await page.evaluate(() => document.documentElement.lang)) === 'ar';
  const label = isAr
    ? /إنشاء سند صرف جديد/
    : /Create a new payment voucher/i;
  try {
    await page.getByRole('button', { name: label }).click({ timeout: 5000 });
    await page.waitForTimeout(500);
  } catch (err) {
    console.error('[nav] composer click failed:', err.message);
  }
}

async function selectMandate(page, value) {
  const select = page.locator('select[aria-label*="mandate" i], select[aria-label*="تفويض"]').first();
  try {
    await select.selectOption(value);
    await page.waitForTimeout(500);
  } catch (err) {
    console.error('[nav] mandate select failed:', err.message);
  }
}

async function openVoucherDetail(page, voucherNumber) {
  // Click the row containing the voucher number. The row is a button.
  try {
    await page.getByText(voucherNumber, { exact: true }).first().click({ timeout: 5000 });
    await page.waitForTimeout(600);
  } catch (err) {
    console.error('[nav] open-detail', voucherNumber, 'failed:', err.message);
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

  // 01-04: list on Drafts tab (default)
  for (const v of variants) {
    try {
      await setLangThenTheme(page, v.lang, v.theme);
      const suffix = `${String(idx).padStart(2, '0')}-list-drafts-${v.lang}-${v.theme}`;
      await page.screenshot({
        path: path.join(OUT_DIR, `${suffix}.png`),
        fullPage: false,
      });
      console.log('[capture] ok:', suffix);
    } catch (err) {
      console.error('[capture]', idx, 'list-drafts failed:', err.message);
    }
    idx += 1;
  }

  // 05-08: list on Awaiting Action tab (mixed PENDING_* rows)
  for (const v of variants) {
    try {
      await setLangThenTheme(page, v.lang, v.theme);
      await clickTab(page, 'awaiting_action');
      const suffix = `${String(idx).padStart(2, '0')}-list-awaiting-${v.lang}-${v.theme}`;
      await page.screenshot({
        path: path.join(OUT_DIR, `${suffix}.png`),
        fullPage: false,
      });
      console.log('[capture] ok:', suffix);
    } catch (err) {
      console.error('[capture]', idx, 'list-awaiting failed:', err.message);
    }
    idx += 1;
  }

  // 09-12: composer with compliant mandate (mandate-1, Σcount=2, no banner)
  for (const v of variants) {
    try {
      await setLangThenTheme(page, v.lang, v.theme);
      await openComposer(page);
      await selectMandate(page, 'mock-mandate-1');
      const suffix = `${String(idx).padStart(2, '0')}-composer-compliant-${v.lang}-${v.theme}`;
      await page.screenshot({
        path: path.join(OUT_DIR, `${suffix}.png`),
        fullPage: false,
      });
      console.log('[capture] ok:', suffix);
    } catch (err) {
      console.error('[capture]', idx, 'composer-compliant failed:', err.message);
    }
    idx += 1;
  }

  // 13-16: composer with non-compliant mandate (mandate-2, Σcount=1, HASEEB-274 banner)
  for (const v of variants) {
    try {
      await setLangThenTheme(page, v.lang, v.theme);
      await openComposer(page);
      await selectMandate(page, 'mock-mandate-2');
      const suffix = `${String(idx).padStart(2, '0')}-composer-warning-${v.lang}-${v.theme}`;
      await page.screenshot({
        path: path.join(OUT_DIR, `${suffix}.png`),
        fullPage: false,
      });
      console.log('[capture] ok:', suffix);
    } catch (err) {
      console.error('[capture]', idx, 'composer-warning failed:', err.message);
    }
    idx += 1;
  }

  // 17-20: detail PENDING_SIGNATORIES with signatory progress block
  for (const v of variants) {
    try {
      await setLangThenTheme(page, v.lang, v.theme);
      await clickTab(page, 'awaiting_action');
      await openVoucherDetail(page, 'PV-2026-0003');
      const suffix = `${String(idx).padStart(2, '0')}-detail-signatories-${v.lang}-${v.theme}`;
      await page.screenshot({
        path: path.join(OUT_DIR, `${suffix}.png`),
        fullPage: false,
      });
      console.log('[capture] ok:', suffix);
    } catch (err) {
      console.error('[capture]', idx, 'detail-signatories failed:', err.message);
    }
    idx += 1;
  }

  // 21-24: detail PAID (terminal tab)
  for (const v of variants) {
    try {
      await setLangThenTheme(page, v.lang, v.theme);
      await clickTab(page, 'terminal');
      await openVoucherDetail(page, 'PV-2026-0004');
      const suffix = `${String(idx).padStart(2, '0')}-detail-paid-${v.lang}-${v.theme}`;
      await page.screenshot({
        path: path.join(OUT_DIR, `${suffix}.png`),
        fullPage: false,
      });
      console.log('[capture] ok:', suffix);
    } catch (err) {
      console.error('[capture]', idx, 'detail-paid failed:', err.message);
    }
    idx += 1;
  }

  await browser.close();
  console.log('[capture] done:', OUT_DIR);
})().catch((err) => {
  console.error('[capture] fatal:', err);
  process.exit(1);
});
