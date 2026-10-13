// Screenshot a design page in headless Chrome on the real GPU (Vulkan), like the app's e2e.
// node design/3d/tools/shot.mjs <url> <out.png> [waitMs] [w] [h]   (serve design/ first: python3 -m http.server 8765)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/julio/Desktop/HuggingHack/app/node_modules/playwright');
const [url, out, wait = '6000', w = '1600', h = '900'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.goto(url);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 }).catch(e => errs.push('not ready: ' + e.message));
await page.waitForTimeout(+wait);
const fps = await page.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else r(n); }; requestAnimationFrame(f); }));
await page.screenshot({ path: out });
console.log('fps~', fps, errs.length ? '\n' + errs.join('\n') : 'no errors');
await browser.close();
