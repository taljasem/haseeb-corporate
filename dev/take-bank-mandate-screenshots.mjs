// HASEEB-211 — BankMandateAdminScreen screenshot script.
//
// Usage: ensure `npm run preview -- --port 5188` is running (or
// `npm run dev -- --port 5188`), then
//   node dev/take-bank-mandate-screenshots.mjs
//
// Captures the 6 surfaces × EN/AR × dark/light = 24 screenshots
// written to aft-command/memory-bank/screenshots/HASEEB-211/.
//
// Surfaces:
//   1. List view (mixed statuses visible)
//   2. Create composer — Step 2 rule builder
//   3. Create composer — Step 3 threshold tier
//   4. Acknowledge modal (on PENDING mandate)
//   5. Cancel confirmation modal with linked-voucher warning
//   6. Detail view with signatory roster + linked vouchers + supersession banner
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(
  __dirname,
  '../../aft-command/memory-bank/screenshots/HASEEB-211',
);
mkdirSync(OUT_DIR, { recursive: true });

const BASE = 'http://localhost:5188/dev/bank-mandates-harness.html';

// Build the 24 shots programmatically: 6 surfaces × {en,ar} × {dark,light}
const SURFACES = [
  { key: '01-list', url: '?view=list' },
  { key: '02-composer-rules', url: '?view=composer&composer_step=2' },
  { key: '03-composer-thresholds', url: '?view=composer&composer_step=3' },
  { key: '04-acknowledge-modal', url: '?view=detail&mandate=mock-mandate-3&modal=acknowledge' },
  { key: '05-cancel-modal', url: '?view=detail&mandate=mock-mandate-1&modal=cancel' },
  { key: '06-detail-active', url: '?view=detail&mandate=mock-mandate-1' },
];

const LANGS = ['en', 'ar'];
const THEMES = ['dark', 'light'];

function buildShots() {
  const shots = [];
  for (const s of SURFACES) {
    for (const lang of LANGS) {
      for (const theme of THEMES) {
        shots.push({
          name: `${s.key}-${lang}-${theme}.png`,
          url: `${BASE}${s.url}&lang=${lang}&theme=${theme}&role=Owner`,
        });
      }
    }
  }
  return shots;
}

const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  for (const { name, url } of buildShots()) {
    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.warn(`[page console error][${name}]`, msg.text());
      }
    });
    await page.goto(url, { waitUntil: 'networkidle' });
    // Give harness effects + async list loads + modal clicks time to
    // settle. Modals need the longest (they chain two async actions).
    const settle = name.includes('modal') ? 2600 : name.includes('composer') ? 2000 : 1400;
    await page.waitForTimeout(settle);
    const outPath = path.join(OUT_DIR, name);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`wrote ${outPath}`);
    await page.close();
  }
} finally {
  await browser.close();
}
