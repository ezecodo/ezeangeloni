// The workshop's viewer (Eze, 2026-11-09): a place to keep the things he designs until their time comes.
// Local only, never deployed. `npm run taller` → http://localhost:4350
import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';

const here = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({
  root: here,
  publicDir: fileURLToPath(new URL('../public', import.meta.url)), // Tanu's body is the site's own (/models/…)
  cacheDir: fileURLToPath(new URL('../node_modules/.vite-taller', import.meta.url)), // its own, so it never upsets the site's `astro dev` cache
  server: { port: 4350, host: '127.0.0.1', fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] } },
});
