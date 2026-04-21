/**
 * Tier D frontend-bundle screenshot capture.
 *
 * Four scenarios × EN/AR × dark/light = 16 PNGs total to
 * memory-bank/screenshots/TIER-D-FRONTEND-BUNDLE/.
 *
 * Scenarios:
 *   mixed-severities       — MissedRecurrencesCard with HIGH/MEDIUM/LOW/UNKNOWN, non-KWD items
 *   kwd-native             — MissedRecurrencesCard with KWD-only items (no FX strip)
 *   cross-tenant-above     — CrossTenantContextCard above-threshold full state
 *   cross-tenant-below     — CrossTenantContextCard below-threshold empty state
 *
 * The harness page is served by `npm run dev` at:
 *   /scripts/tier-d-harness/tier-d-harness.html?scenario=<id>&lang=<en|ar>
 * Theme is applied via the pre-hydration localStorage read (same pattern
 * as the real app's index.html).
 */
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";

const BASE_URL = "http://localhost:5173";
const HARNESS_PATH = "/scripts/tier-d-harness/tier-d-harness.html";
const OUT_DIR =
  "/Users/tarekaljasem/Downloads/aft-command/memory-bank/screenshots/TIER-D-FRONTEND-BUNDLE";

fs.mkdirSync(OUT_DIR, { recursive: true });

const scenarios = [
  { id: "mixed-severities", shortName: "missed-card-mixed" },
  { id: "kwd-native", shortName: "missed-card-kwd" },
  { id: "cross-tenant-above", shortName: "cross-tenant-above" },
  { id: "cross-tenant-below", shortName: "cross-tenant-below" },
];
const langs = ["en", "ar"];
const themes = ["dark", "light"];

async function capture() {
  const browser = await chromium.launch();
  try {
    for (const scenario of scenarios) {
      for (const lang of langs) {
        for (const theme of themes) {
          const context = await browser.newContext({
            viewport: { width: 720, height: 720 },
            deviceScaleFactor: 2,
          });
          const page = await context.newPage();

          await page.addInitScript((t) => {
            try {
              localStorage.setItem("haseeb-corporate-theme", t);
            } catch {}
            document.documentElement.setAttribute("data-theme", t);
          }, theme);

          const url = `${BASE_URL}${HARNESS_PATH}?scenario=${scenario.id}&lang=${lang}`;
          await page.goto(url, { waitUntil: "domcontentloaded" });

          // Wait for the harness panel to be visible (React mounted +
          // i18n bundle resolved). Vite HMR keeps the websocket open so
          // 'networkidle' never fires.
          await page.waitForSelector("#root > div", { timeout: 15000 });
          await page.waitForTimeout(1500);

          const fileName = `${scenario.shortName}_${lang}_${theme}.png`;
          const outPath = path.join(OUT_DIR, fileName);

          // Capture just the rendered panel area for tight framing.
          const panelElement = await page.locator("#root > div").first();
          await panelElement.screenshot({ path: outPath });
          console.log(`[captured] ${fileName}`);

          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
}

capture().catch((err) => {
  console.error("[capture] failed:", err);
  process.exit(1);
});
