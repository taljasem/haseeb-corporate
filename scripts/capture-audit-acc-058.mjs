/**
 * AUDIT-ACC-058 screenshot capture — PIFSSReconciliationScreen (FN-251).
 *
 * Runs Playwright against `vite preview` (per HASEEB-189 guidance — the
 * StrictMode auth-race in `npm run dev` makes screenshot capture flaky
 * in dev-mode). MOCK seed data in engine/index.js provides 2 years of
 * reconciliation history, 12 variances across 3 employees covering all
 * 4 VarianceType values, and one empty-slot year for the "new year"
 * prompt.
 *
 * Captures 20 PNGs (5 surfaces × 4 variants EN/AR × dark/light):
 *   01-04: year-list                       (populated table)
 *   05-08: per-year-import-composer        (Step 1, empty slot for current year)
 *   09-12: per-year-variance-review        (Step 3, fully-run year, expanded employee)
 *   13-16: variance-resolution-modal       (reopen flow, Owner on a RESOLVED variance)
 *   17-20: auditor-report                  (GET /report view)
 */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const BASE_URL = process.env.PREVIEW_URL || 'http://localhost:4321';
const OUT_DIR =
  '/Users/tarekaljasem/Downloads/aft-command/memory-bank/screenshots/AUDIT-ACC-058';

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

async function navigateToPifssRecon(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400);
  await pickOwner(page);
  const isAr =
    (await page.evaluate(() => document.documentElement.lang)) === 'ar';
  const label = isAr ? /تسوية التأمينات \(سنوية\)/ : /PIFSS Reconciliation \(Annual\)/i;
  try {
    await page.getByText(label).first().click({ timeout: 6000 });
  } catch (err) {
    console.error('[nav] pifss-reconciliation click failed:', err.message);
  }
  await page.waitForTimeout(1000);
}

async function setLangThenTheme(page, lang, theme) {
  // Seed localStorage so the preferences persist across the reload.
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
  // If detected language doesn't match, toggle via the Header button.
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
  await navigateToPifssRecon(page);
}

async function openYearRow(page, year) {
  try {
    await page
      .locator(`[data-testid="year-row-${year}"]`)
      .first()
      .click({ timeout: 5000 });
    await page.waitForTimeout(800);
  } catch (err) {
    console.error('[nav] open-year', year, 'failed:', err.message);
  }
}

async function expandEmployees(page) {
  const isAr =
    (await page.evaluate(() => document.documentElement.lang)) === 'ar';
  const expandPattern = isAr ? /^توسيع / : /^Expand /;
  try {
    const btns = await page.getByRole('button', { name: expandPattern }).all();
    for (const btn of btns) {
      try {
        await btn.click({ timeout: 2500 });
        await page.waitForTimeout(150);
      } catch {
        /* skip */
      }
    }
  } catch (err) {
    console.error('[nav] expand-employees failed:', err.message);
  }
  await page.waitForTimeout(400);
}

async function openResolveModal(page) {
  // Expand first, then click the first Resolve button. Match by
  // aria-label prefix (Resolve variance for period ... / حل الفرق للفترة ...).
  await expandEmployees(page);
  const isAr =
    (await page.evaluate(() => document.documentElement.lang)) === 'ar';
  const resolveLabel = isAr
    ? /^حل الفرق للفترة /
    : /^Resolve variance for period /;
  try {
    await page
      .getByRole('button', { name: resolveLabel })
      .first()
      .click({ timeout: 5000 });
    await page.waitForTimeout(500);
  } catch (err) {
    console.error('[nav] resolve-click failed:', err.message);
  }
}

async function openResolveModalOnResolved(page) {
  // Expand first, then find a Resolve button whose variance row (the
  // immediate grid ancestor with display: grid) contains the
  // RESOLVED status badge text. The Resolve buttons have aria-label
  // "Resolve variance for period ..." (EN) or "حل الفرق للفترة ..." (AR).
  await expandEmployees(page);
  const isAr =
    (await page.evaluate(() => document.documentElement.lang)) === 'ar';
  const resolvedLabel = isAr ? 'محلول' : 'Resolved';
  const ariaPrefix = isAr ? 'حل الفرق للفترة' : 'Resolve variance for period';
  const clickResult = await page.evaluate(
    ({ ariaPrefix, resolvedLabel }) => {
      const allBtns = Array.from(
        document.querySelectorAll('button[aria-label]'),
      );
      const resolveBtns = allBtns.filter((b) =>
        (b.getAttribute('aria-label') || '').startsWith(ariaPrefix),
      );
      const debug = { total: resolveBtns.length, checkedRows: [] };
      for (const btn of resolveBtns) {
        // Walk ancestors to find the immediate variance-row div
        // (identifiable by style.display === 'grid' and it has 7
        // children — the 6th child is the status badge cell).
        let el = btn.parentElement;
        for (let i = 0; i < 5 && el; i += 1) {
          const cs = el.style || {};
          if (cs.display === 'grid' && el.children.length === 7) {
            const statusCell = el.children[5];
            const statusText = (statusCell?.textContent || '').trim();
            debug.checkedRows.push(statusText);
            if (statusText === resolvedLabel) {
              btn.click();
              return { ok: true, which: 'resolved', debug };
            }
            break;
          }
          el = el.parentElement;
        }
      }
      // Fallback: click the first resolve button.
      if (resolveBtns.length > 0) {
        resolveBtns[0].click();
        return { ok: true, which: 'fallback', debug };
      }
      return { ok: false, debug };
    },
    { ariaPrefix, resolvedLabel },
  );
  console.log('[nav] openResolveModalOnResolved →', JSON.stringify(clickResult));
  await page.waitForTimeout(500);
}

async function switchStatusToUnresolved(page) {
  // Wait for the modal to be visible before operating on its select.
  try {
    await page.waitForSelector('#variance-status-select', { timeout: 5000, state: 'visible' });
    await page.locator('#variance-status-select').selectOption('UNRESOLVED', { timeout: 3000 });
    await page.waitForTimeout(400);
  } catch (err) {
    console.error('[nav] status-change failed:', err.message);
  }
}

async function openAuditorReport(page) {
  const isAr =
    (await page.evaluate(() => document.documentElement.lang)) === 'ar';
  const label = isAr ? /عرض تقرير المدقق/ : /View auditor report/i;
  try {
    await page
      .getByRole('button', { name: label })
      .first()
      .click({ timeout: 5000 });
    await page.waitForTimeout(600);
  } catch (err) {
    console.error('[nav] report-click failed:', err.message);
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
  const runYear = new Date().getUTCFullYear() - 1;

  // 01-04: year list
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

  // 05-08: per-year import composer (Step 1 — empty slot current year)
  const importYear = new Date().getUTCFullYear();
  for (const v of variants) {
    try {
      await setLangThenTheme(page, v.lang, v.theme);
      await openYearRow(page, importYear);
      const suffix = `${String(idx).padStart(2, '0')}-import-composer-${v.lang}-${v.theme}`;
      await page.screenshot({
        path: path.join(OUT_DIR, `${suffix}.png`),
        fullPage: false,
      });
      console.log('[capture] ok:', suffix);
    } catch (err) {
      console.error('[capture]', idx, 'import-composer failed:', err.message);
    }
    idx += 1;
  }

  // 09-12: Step 3 variance review (fully-run year, expanded)
  for (const v of variants) {
    try {
      await setLangThenTheme(page, v.lang, v.theme);
      await openYearRow(page, runYear);
      await expandEmployees(page);
      const suffix = `${String(idx).padStart(2, '0')}-variance-review-${v.lang}-${v.theme}`;
      await page.screenshot({
        path: path.join(OUT_DIR, `${suffix}.png`),
        fullPage: false,
      });
      console.log('[capture] ok:', suffix);
    } catch (err) {
      console.error('[capture]', idx, 'variance-review failed:', err.message);
    }
    idx += 1;
  }

  // 13-16: variance resolution modal (Owner reopen flow)
  for (const v of variants) {
    try {
      await setLangThenTheme(page, v.lang, v.theme);
      await openYearRow(page, runYear);
      await openResolveModalOnResolved(page);
      // Debug: check whether a dialog is present.
      const dialogCount = await page
        .locator('[role="dialog"]')
        .count()
        .catch(() => 0);
      console.log('[debug] dialog count after resolve click:', dialogCount);
      await switchStatusToUnresolved(page);
      const suffix = `${String(idx).padStart(2, '0')}-resolution-modal-${v.lang}-${v.theme}`;
      await page.screenshot({
        path: path.join(OUT_DIR, `${suffix}.png`),
        fullPage: false,
      });
      console.log('[capture] ok:', suffix);
    } catch (err) {
      console.error('[capture]', idx, 'resolution-modal failed:', err.message);
    }
    idx += 1;
  }

  // 17-20: auditor report view
  for (const v of variants) {
    try {
      await setLangThenTheme(page, v.lang, v.theme);
      await openYearRow(page, runYear);
      await openAuditorReport(page);
      const suffix = `${String(idx).padStart(2, '0')}-auditor-report-${v.lang}-${v.theme}`;
      await page.screenshot({
        path: path.join(OUT_DIR, `${suffix}.png`),
        fullPage: false,
      });
      console.log('[capture] ok:', suffix);
    } catch (err) {
      console.error('[capture]', idx, 'auditor-report failed:', err.message);
    }
    idx += 1;
  }

  await browser.close();
  console.log('[capture] done:', OUT_DIR);
})().catch((err) => {
  console.error('[capture] fatal:', err);
  process.exit(1);
});
