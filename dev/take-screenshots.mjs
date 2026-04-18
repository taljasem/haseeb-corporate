// Wave 6B.3 Layer 3 — screenshot script for the AminahChat proactive surface.
// Usage: ensure `npm run dev -- --port 5177` is running, then
//   node dev/take-screenshots.mjs
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(
  __dirname,
  '../../aft-command/memory-bank/screenshots/wave-6b3'
);
mkdirSync(OUT_DIR, { recursive: true });

const BASE = 'http://localhost:5177/dev/aminah-chat-harness.html';

const shots = [
  {
    name: 'aminah-slideover-pending-en-dark.png',
    url: `${BASE}?role=Owner&lang=en`,
  },
  {
    name: 'aminah-slideover-pending-ar-dark.png',
    url: `${BASE}?role=Owner&lang=ar`,
  },
  {
    name: 'aminah-slideover-pending-empty.png',
    url: `${BASE}?role=Owner&lang=en&empty=1`,
  },
];

const browser = await chromium.launch();
try {
  const context = await browser.newContext({
    viewport: { width: 900, height: 700 },
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
    // Give the MOCK stub's 80ms delay + React effect a beat to settle.
    await page.waitForTimeout(1500);
    const outPath = path.join(OUT_DIR, name);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`wrote ${outPath}`);
    await page.close();
  }
} finally {
  await browser.close();
}
