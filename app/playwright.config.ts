import { defineConfig } from '@playwright/test';

// Browser smoke tests. Uses the locally installed Google Chrome (no browser download needed).
export default defineConfig({
  testDir: 'e2e',
  use: {
    baseURL: 'http://localhost:5174',
    channel: 'chrome',
    viewport: { width: 1280, height: 720 },
    launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader'] },
  },
  webServer: {
    command: 'npx vite --port 5174 --strictPort --open false',
    url: 'http://localhost:5174',
  },
});
