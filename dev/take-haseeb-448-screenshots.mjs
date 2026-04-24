// HASEEB-448 — SetupScreen onboarding-polish screenshot script.
// Usage: with `npm run dev` running on :5173, then
//   node dev/take-haseeb-448-screenshots.mjs
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(
  __dirname,
  '../../aft-command/memory-bank/screenshots/HASEEB-448',
);
mkdirSync(OUT_DIR, { recursive: true });

const BASE = 'http://localhost:5173/dev/setup-harness.html';

const shots = [
  { name: 'company-section-en-cfo.png',        url: `${BASE}?section=company&role=CFO&lang=en` },
  { name: 'company-section-ar-cfo.png',        url: `${BASE}?section=company&role=CFO&lang=ar` },
  { name: 'company-section-junior-readonly.png', url: `${BASE}?section=company&role=Junior&lang=en` },
  { name: 'chart-templates-en.png',            url: `${BASE}?section=chart&role=CFO&lang=en` },
  { name: 'chart-templates-ar.png',            url: `${BASE}?section=chart&role=CFO&lang=ar` },
  { name: 'fiscal-position-en.png',            url: `${BASE}?section=fiscal&role=CFO&lang=en` },
  { name: 'fiscal-position-ar.png',            url: `${BASE}?section=fiscal&role=CFO&lang=ar` },
];

const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  for (const { name, url } of shots) {
    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.warn(`[page console error][${name}]`, msg.text());
      }
    });
    await page.goto(url, { waitUntil: 'networkidle' });
    // Give React + the harness's sidebar-activation timer a beat.
    await page.waitForTimeout(1800);
    const outPath = path.join(OUT_DIR, name);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`wrote ${outPath}`);
    await page.close();
  }

  // Preview modals — open them by clicking the relevant button.
  const modalShots = [
    {
      name: 'invoice-preview-bilingual-en.png',
      url: `${BASE}?section=company&role=CFO&lang=en`,
      action: async (page) => {
        await page.click('[data-testid="company-preview-button"]');
        await page.waitForSelector('[data-testid="invoice-preview-modal"]');
        await page.waitForTimeout(400);
      },
    },
    {
      name: 'invoice-preview-bilingual-ar.png',
      url: `${BASE}?section=company&role=CFO&lang=ar`,
      action: async (page) => {
        await page.click('[data-testid="company-preview-button"]');
        await page.waitForSelector('[data-testid="invoice-preview-modal"]');
        await page.waitForTimeout(400);
      },
    },
    {
      name: 'coa-template-preview-en.png',
      url: `${BASE}?section=chart&role=CFO&lang=en`,
      action: async (page) => {
        await page.click('[data-testid="coa-preview-button"]');
        await page.waitForTimeout(600);
      },
    },
  ];

  for (const { name, url, action } of modalShots) {
    const page = await context.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.warn(`[page console error][${name}]`, msg.text());
      }
    });
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1800);
    try {
      await action(page);
    } catch (err) {
      console.warn(`[modal step failed][${name}]`, err.message);
    }
    const outPath = path.join(OUT_DIR, name);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`wrote ${outPath}`);
    await page.close();
  }
} finally {
  await browser.close();
}
