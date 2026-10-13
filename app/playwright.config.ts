import { defineConfig } from '@playwright/test';

/**
 * WebGL in headless Chrome: Vulkan on the real GPU (~35 FPS on the dev laptop's Iris Xe).
 * The old SwiftShader (CPU) renderer ran the room at ~0.3–1 FPS, which made a run take 15 min.
 * Machines without a usable GPU (CI): `E2E_SWIFTSHADER=1 npx playwright test`.
 */
declare const process: { env: Record<string, string | undefined> }; // no @types/node here
const GL = process.env.E2E_SWIFTSHADER
  ? ['--use-gl=angle', '--use-angle=swiftshader']
  : ['--use-gl=angle', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist'];

// Browser smoke tests. Uses the locally installed Google Chrome (no browser download needed).
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true, // the tests are independent; each gets its own page
  use: {
    baseURL: 'http://localhost:5174',
    channel: 'chrome',
    viewport: { width: 1280, height: 720 },
    launchOptions: { args: GL },
  },
  webServer: {
    command: 'npx vite --port 5174 --strictPort --open false',
    url: 'http://localhost:5174',
  },
});
