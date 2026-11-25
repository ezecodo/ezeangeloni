// Una historia de Instagram (1080×1920, 9:16) de las caras que mutan (/caras/): exactamente una vuelta (las 14 caras,
// 56 s con los tiempos de siempre, por debajo del límite de 60 s de una historia), cuadro por cuadro, así sale fluida
// aunque el Mac esté ocupado, y termina en la cara con que empieza (si se repite, no se nota el salto).
// node tools/video/caras-story.mjs [salida.mp4]
// Necesita: `npm run dev` en el puerto 4361 (o BASE=…), ffmpeg, y Puppeteer del proyecto cv (o PUPPETEER=…).
import { createRequire } from 'node:module';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const puppeteer = require(process.env.PUPPETEER || `${os.homedir()}/Desktop/dev/cv/node_modules/puppeteer`);
const OUT = process.argv[2] || `${os.homedir()}/Desktop/caras-historia.mp4`;
const BASE = process.env.BASE || 'http://localhost:4361', FPS = 30;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'caras-'));

const browser = await puppeteer.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=metal'],
  defaultViewport: { width: 1080, height: 1920, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
await page.evaluateOnNewDocument(() => {
  const css = document.createElement('style');
  css.textContent = '#ui,astro-dev-toolbar{display:none!important}';
  document.addEventListener('DOMContentLoaded', () => document.head.append(css));
});
await page.goto(`${BASE}/caras/`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__caras, { timeout: 30000 });
await page.evaluate(() => { window.requestAnimationFrame = () => 0; }); // el reloj lo llevamos nosotros
const { CICLO, N } = await page.evaluate(() => ({ CICLO: window.__caras.CICLO, N: window.__caras.N }));
const total = Math.round(N*CICLO/1000*FPS);
for(let k = 0; k < total; k++){
  await page.evaluate((t) => window.__caras.dibujar(t), k*1000/FPS);
  await page.screenshot({ path: path.join(dir, String(k).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 94 });
  if(k % 150 === 0) process.stdout.write(`cuadro ${k}/${total}\r`);
}
await browser.close();
// a MP4 vertical, 30 fps, como lo quiere Instagram (con un tope de bitrate para que no lo recomprima de más)
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', path.join(dir, '%05d.jpg'),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-maxrate', '14M', '-bufsize', '28M', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', OUT]);
fs.rmSync(dir, { recursive: true, force: true });
console.log('listo:', OUT, `(${N} caras, ${(N*CICLO/1000).toFixed(0)} s)`);
