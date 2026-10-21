// Renders card.html to app/public/og.jpg (the og:image link preview). Run from the repo root:
// node design/og/render.mjs   (uses the app's Playwright and your installed Chrome)
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../app/package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const here = fileURLToPath(new URL('.', import.meta.url));
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto('file://' + here + 'card.html');
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: here + '../../app/public/og.jpg', type: 'jpeg', quality: 86 });
await browser.close();
