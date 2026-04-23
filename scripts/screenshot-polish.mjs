/**
 * Screenshot capture for POLISH dispatch (ACC-055 + ACC-073).
 *
 * The Corporate dashboard is auth-gated via ProtectedRoute. To capture
 * screens without running a full backend, we intercept the three
 * endpoints that AuthContext reads on bootstrap (`/api/auth/me` and
 * `/api/auth/tenant-info`) and return a stub CFO user.
 *
 * Captures 8 screenshots:
 *   - ACC-055: QuarterlyKPIScreen in {EN, AR} × {dark, light} = 4
 *   - ACC-073: MonthEndCloseScreen in {EN, AR} × {dark, light} = 4
 */

import { chromium } from "playwright";
import { mkdirSync, existsSync } from "fs";

const BASE = process.env.BASE_URL || "http://localhost:4173";
const ROOT =
  process.env.SCREENSHOT_ROOT ||
  "/Users/tarekaljasem/Downloads/aft-command/memory-bank/screenshots";
const ACC055_DIR = `${ROOT}/POLISH-ACC-055`;
const ACC073_DIR = `${ROOT}/POLISH-ACC-073`;

for (const d of [ACC055_DIR, ACC073_DIR]) {
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

/** Seed localStorage auth state and stub the bootstrap endpoints. */
async function primeAuth(context) {
  await context.addInitScript(() => {
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    localStorage.setItem("haseeb_corp_token", "stub-token-for-screenshot");
    localStorage.setItem("haseeb_corp_token_exp", String(expiresAt));
  });
  // Single fn-matcher route for anything going to the Corporate API
  // (baseURL is localhost:3000 per .env). Dispatches by path suffix.
  await context.route(
    (url) => {
      const href = typeof url === "string" ? url : url.href || "";
      return href.includes(":3000/api/");
    },
    async (route) => {
      const u = route.request().url();
      if (u.endsWith("/api/auth/me")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              user: {
                id: "stub-cfo-id",
                userId: "stub-cfo-id",
                email: "cfo@demo.test",
                name: "Screenshot CFO",
                role: "ACCOUNTANT",
              },
            },
          }),
        });
      }
      if (u.endsWith("/api/auth/tenant-info")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: {
              tenant: {
                id: "almanara",
                name: "Almanara Trading",
                slug: "almanara",
              },
            },
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: {} }),
      });
    }
  );
}

async function setLang(page, lang) {
  await page.evaluate((l) => {
    localStorage.setItem("haseeb-language", l);
  }, lang);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(500);
}

async function setTheme(page, theme) {
  await page.evaluate((th) => {
    localStorage.setItem("haseeb-theme", th);
    document.documentElement.setAttribute("data-theme", th);
  }, theme);
  await page.waitForTimeout(300);
}

async function navTo(page, label) {
  const btn = await page.waitForSelector(
    `xpath=//aside//button[.//span[normalize-space(text())="${label}"]]`,
    { timeout: 10000 }
  );
  await btn.click();
  await page.waitForTimeout(800);
}

async function forceCfoRole(page) {
  // The Header exposes three inline role buttons (Owner / CFO / Junior).
  // Click the CFO one. Language-agnostic: we match by text "CFO" first
  // (kept in English in the header per the Wave 2 LoginScreen note);
  // if not present, fall back to the AR equivalent.
  const candidates = ["CFO", "المدير المالي"];
  for (const label of candidates) {
    const btn = await page.$(
      `xpath=//header//button[normalize-space(text())="${label}"]`
    );
    if (btn) {
      try {
        await btn.click({ timeout: 2000 });
        await page.waitForTimeout(400);
        return;
      } catch {
        // fallthrough
      }
    }
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  await primeAuth(context);

  const page = await context.newPage();
  page.on("pageerror", (err) =>
    console.log("[pageerror]", err?.message || err)
  );

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForSelector("aside", { timeout: 15000 });
  await forceCfoRole(page);

  const combos = [
    { lang: "en", theme: "dark", suffix: "en-dark" },
    { lang: "en", theme: "light", suffix: "en-light" },
    { lang: "ar", theme: "dark", suffix: "ar-dark" },
    { lang: "ar", theme: "light", suffix: "ar-light" },
  ];

  for (const c of combos) {
    console.log(`-- capturing ${c.suffix}`);
    await setLang(page, c.lang);
    await setTheme(page, c.theme);
    await page.waitForSelector("aside", { timeout: 10000 });
    await forceCfoRole(page);

    const qkpLabel = c.lang === "ar" ? "المؤشرات ربع السنوية" : "Quarterly KPIs";
    const mecLabel = c.lang === "ar" ? "إقفال نهاية الشهر" : "Month-End Close";

    try {
      await navTo(page, qkpLabel);
      await page.waitForSelector('[data-testid="quarterlykpi-screen"]', {
        timeout: 10000,
      });
      await page.waitForTimeout(1500);
      const p055 = `${ACC055_DIR}/quarterly-kpi-${c.suffix}.png`;
      await page.screenshot({ path: p055, fullPage: true });
      console.log(`saved ${p055}`);
    } catch (e) {
      console.log(`ACC-055 ${c.suffix} failed: ${e.message || e}`);
    }

    try {
      await navTo(page, mecLabel);
      await page.waitForTimeout(2000);
      const p073 = `${ACC073_DIR}/month-end-close-${c.suffix}.png`;
      await page.screenshot({ path: p073, fullPage: true });
      console.log(`saved ${p073}`);
    } catch (e) {
      console.log(`ACC-073 ${c.suffix} failed: ${e.message || e}`);
    }
  }

  await browser.close();
}

run().catch((e) => {
  console.error("screenshot run failed:", e);
  process.exit(1);
});
