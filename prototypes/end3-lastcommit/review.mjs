// Independent director-view check. Run after prototypes/serve.sh.
// No test hooks: verifies real keyboard handlers, menus, viewport layout and rendering.
import assert from "node:assert/strict";
import { chromium } from "../../app/node_modules/playwright/index.mjs";

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome",
  args: [
    "--no-sandbox",
    "--enable-webgl",
    "--use-gl=angle",
    "--use-angle=swiftshader",
  ],
});
try {
  for (const name of ["deadletter", "lastcommit"]) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 900 },
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(`http://127.0.0.1:8765/end3-${name}/`);
    await page.waitForSelector("canvas");
    await page.screenshot({ path: `/tmp/end3-${name}-review-intro.png` });
    await page.click("#start");
    await page.keyboard.down("KeyD");
    await page.waitForTimeout(800);
    await page.keyboard.up("KeyD");
    await page.keyboard.press("Space");
    const frames = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const start = performance.now();
          let count = 0;
          function measure(now) {
            count++;
            if (now - start >= 2000)
              resolve({ frames: count, seconds: (now - start) / 1000 });
            else requestAnimationFrame(measure);
          }
          requestAnimationFrame(measure);
        }),
    );
    await page.screenshot({ path: `/tmp/end3-${name}-review-play.png` });
    await page.keyboard.press("Escape");
    const pauseSelector = name === "deadletter" ? "#pause" : "#overlay";
    assert.ok(
      await page.locator(pauseSelector).isVisible(),
      `${name}: Escape opens pause`,
    );
    await page.click(name === "deadletter" ? "#resume" : "#start");
    assert.ok(
      await page.locator(pauseSelector).isHidden(),
      `${name}: resume closes pause`,
    );
    await page.setViewportSize({ width: 960, height: 720 });
    await page.screenshot({ path: `/tmp/end3-${name}-review-small.png` });
    const normal = await page.evaluate(() => ({
      hooks:
        typeof window.__lastcommit !== "undefined" ||
        typeof window.__deadletter !== "undefined",
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
      canvas: !!document.querySelector("canvas")?.getBoundingClientRect().width,
    }));
    assert.equal(
      normal.hooks,
      false,
      `${name}: debug hooks absent on normal URL`,
    );
    assert.equal(
      normal.horizontalOverflow,
      false,
      `${name}: no horizontal overflow`,
    );
    assert.ok(normal.canvas);
    assert.deepEqual(errors, [], `${name}: no browser errors`);
    console.log(
      `${name}: normal keyboard / pause / resume / 960px viewport PASS; software renderer ${(frames.frames / frames.seconds).toFixed(1)} fps`,
    );
    await page.close();
  }
} finally {
  await browser.close();
}
