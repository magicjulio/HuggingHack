// Evaluate an expression in a design page (after window.__ready) and print the result as JSON.
// node design/3d/tools/evalpage.mjs <url> '<js expression>'   (serve design/ first: python3 -m http.server 8765)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/julio/Desktop/HuggingHack/app/node_modules/playwright');
const [url, expr] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
page.on('pageerror', e => console.error('pageerror: ' + e.message));
await page.goto(url);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
console.log(JSON.stringify(await page.evaluate(expr)));
await browser.close();
