// El video del dragón para el USB del proyector del restaurante: exactamente una pasada de /dragon/, en 1920×1080,
// cuadro por cuadro (perfecto aunque el Mac esté ocupado), sin la ayuda ni el contorno. Puesto en bucle en el proyector,
// no se nota el salto (al empezar y al terminar la mesa está vacía).
// node tools/video/mesa-usb.mjs [salida.mp4] [mesa=180x90] [segundos=14] [fps=30]   (ESTILO=2 para el japonés)
// Necesita: `npm run dev` en el puerto 4361 (o BASE=…), ffmpeg, y Puppeteer del proyecto cv (o PUPPETEER=…).
import { createRequire } from 'node:module';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const puppeteer = require(process.env.PUPPETEER || `${os.homedir()}/Desktop/dev/cv/node_modules/puppeteer`);
const [OUT = `${os.homedir()}/Desktop/dragon-mesa-USB.mp4`, MESA = '180x90', SEG = '14', FPS_ = '30'] = process.argv.slice(2);
const ESTILO = process.env.ESTILO || '1';
const FPS = Number(FPS_), BASE = process.env.BASE || 'http://localhost:4361';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesa-'));

const browser = await puppeteer.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=metal'],
  defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
await page.evaluateOnNewDocument(() => {
  const css = document.createElement('style');
  css.textContent = '#ui,#estilos,astro-dev-toolbar{display:none!important}';
  document.addEventListener('DOMContentLoaded', () => document.head.append(css));
});
await page.goto(`${BASE}/dragon/?mesa=${MESA}&seg=${SEG}&estilo=${ESTILO}`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__mesa, { timeout: 20000 });
await page.evaluate(() => { window.requestAnimationFrame = () => 0; }); // el reloj lo llevamos nosotros
const P = await page.evaluate(() => window.__mesa.PERIODO);
const total = Math.round(P/1000*FPS);
// dos vueltas de calentamiento (para que la inclinación, la inercia de los bigotes y los fundidos estén asentados) y
// después la vuelta que se graba
for(let k = 0; k < total*2; k += 4) await page.evaluate((t) => window.__mesa.dibujar(t), k*1000/FPS);
for(let k = 0; k < total; k++){
  await page.evaluate((t) => window.__mesa.dibujar(t), 2*P + k*1000/FPS);
  await page.screenshot({ path: path.join(dir, String(k).padStart(5, '0') + '.png') });
  if(k % 60 === 0) process.stdout.write(`cuadro ${k}/${total}\r`);
}
await browser.close();
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', path.join(dir, '%05d.png'),
  '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.1', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', OUT]);
fs.rmSync(dir, { recursive: true, force: true });
console.log('listo:', OUT);
