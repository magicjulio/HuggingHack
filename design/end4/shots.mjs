// Screenshots the E4 unplug shot at given film times. Usage: node shots.mjs out_prefix t1 t2 ...
import { chromium } from '../../app/node_modules/@playwright/test/index.mjs';
const [prefix, ...ts] = process.argv.slice(2);
const b = await chromium.launch({ channel: 'chrome', args: ['--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
await p.goto(`http://127.0.0.1:${process.env.PORT||5173}/?skipboot&debug`);
await p.getByText('The Letter', { exact: true }).click();
await p.getByRole('button', { name: /INJECT/ }).click();
await p.waitForFunction(() => window.__end4?.state().ready, null, { timeout: 30000 });
for (const t of ts) {
  await p.evaluate((t) => window.__end4.seek('office', t), +t);
  await p.waitForTimeout(250);
  await p.screenshot({ path: `shots/${prefix}-${t}.png` });
}
await b.close();
