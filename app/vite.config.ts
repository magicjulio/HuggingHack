/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// One command for Julius: `npm run dev` → http://localhost:5173 (opens the browser).
export default defineConfig({
  plugins: [react()],
  // `/api` (the online ranking, functions/) runs in `npm run dev:api` on :8788
  server: { port: 5173, open: true, proxy: { '/api': 'http://localhost:8788' } },
  // three.js alone is ~900 kB; it is lazy-loaded with the game screen.
  build: { chunkSizeWarningLimit: 1200 },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts'],
  },
});
