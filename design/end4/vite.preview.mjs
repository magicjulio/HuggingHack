// Preview server: the app, but E4 uses design/end4/scene.ts. Run from app/: npx vite --config ../design/end4/vite.config.ts
import { defineConfig } from '../../app/node_modules/vite/dist/node/index.js';
import react from '../../app/node_modules/@vitejs/plugin-react/dist/index.js';
import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname);
export default defineConfig({
  root: path.resolve(here, '../../app'),
  plugins: [
    react(),
    { name: 'e4-scene', enforce: 'pre', resolveId(id, importer) {
        if (id === './scene' && importer?.includes('levels/end4/End4')) return path.join(here, 'scene.ts');
      } },
  ],
  resolve: { alias: [
    { find: /^three\/addons\//, replacement: path.resolve(here, '../../app/node_modules/three/examples/jsm') + '/' },
    { find: /^three$/, replacement: path.resolve(here, '../../app/node_modules/three/build/three.module.js') },
  ] },
  server: { port: 5175, strictPort: true, fs: { allow: [path.resolve(here, '../..')] } },
});
