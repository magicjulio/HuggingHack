// Clean background plate from a 3D page: hides every overlay (non-canvas DOM) and screenshots on the GPU.
// node ch2-ui/tools/plate.mjs <url> <out.png> [waitMs] [w] [h]    (serve design/ on 8765 first)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { chromium } = require('/home/julio/Desktop/HuggingHack/app/node_modules/playwright');
const [url, out, wait = '5000', w = '1920', h = '1080'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
page.on('pageerror', e => console.log('pageerror', e.message));
await page.goto(url);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 }).catch(() => console.log('no __ready'));
await page.waitForTimeout(+wait);
await page.addStyleTag({ content: 'body > *:not(canvas){visibility:hidden!important} canvas{visibility:visible!important}' });
await page.waitForTimeout(200);
await page.screenshot({ path: out, type: out.endsWith('.jpg') ? 'jpeg' : 'png', quality: out.endsWith('.jpg') ? 86 : undefined });
await browser.close();
