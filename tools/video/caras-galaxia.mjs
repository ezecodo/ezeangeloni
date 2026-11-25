// Historia de Instagram (1080×1920) de las caras que mutan flotando sobre la galaxia: dos capas grabadas cuadro por
// cuadro y combinadas con ffmpeg.
//  1. el fondo: la galaxia de verdad (/?video, sin interfaz ni globo), girando sola despacio, como cuando nadie la toca;
//  2. las caras con transparencia (/caras/?alfa), exactamente una vuelta (14 caras, 56 s).
// Detrás de la cara, una sombra suave y redonda, para que el rostro no compita con lo brillante de la galaxia.
// node tools/video/caras-galaxia.mjs [salida.mp4]
// Necesita: `npm run dev` en el puerto 4361 (o BASE=…), ffmpeg, Python con Pillow, y Puppeteer del proyecto cv.
import { createRequire } from 'node:module';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const puppeteer = require(process.env.PUPPETEER || `${os.homedir()}/Desktop/dev/cv/node_modules/puppeteer`);
const OUT = process.argv[2] || `${os.homedir()}/Desktop/caras-galaxia-historia.mp4`;
const BASE = process.env.BASE || 'http://localhost:4361', FPS = 30, W = 1080, H = 1920;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'caras-gal-'));
fs.mkdirSync(path.join(dir, 'fondo')); fs.mkdirSync(path.join(dir, 'caras'));

const browser = await puppeteer.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=metal'],
  defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
});

// ── las caras, con transparencia: primero, así sabemos cuánto dura una vuelta
const pc = await browser.newPage();
await pc.goto(`${BASE}/caras/?alfa`, { waitUntil: 'load' });
await pc.waitForFunction(() => window.__caras, { timeout: 30000 });
await pc.addStyleTag({ content: '#ui,astro-dev-toolbar{display:none!important} html,body{background:transparent!important}' });
await pc.evaluate(() => { window.requestAnimationFrame = () => 0; });
const { CICLO, N } = await pc.evaluate(() => ({ CICLO: window.__caras.CICLO, N: window.__caras.N }));
const total = Math.round(N*CICLO/1000*FPS);
for(let k = 0; k < total; k++){
  await pc.evaluate((t) => window.__caras.dibujar(t), k*1000/FPS);
  await pc.screenshot({ path: path.join(dir, 'caras', String(k).padStart(5, '0') + '.png'), omitBackground: true });
  if(k % 150 === 0) process.stdout.write(`caras ${k}/${total}\r`);
}
await pc.close();

// ── el fondo: la galaxia, con el reloj de la página manual (avanza exactamente 1/30 s por cuadro)
const pg = await browser.newPage();
await pg.evaluateOnNewDocument(() => {
  const realNow = performance.now.bind(performance), realRAF = window.requestAnimationFrame.bind(window);
  let manual = false, vt = 0, cola = [];
  performance.now = () => manual ? vt : realNow();
  window.requestAnimationFrame = (cb) => { if(manual){ cola.push(cb); return cola.length; } return realRAF(cb); };
  window.__vt = { start(){ vt = realNow(); manual = true; }, step(ms){ vt += ms; const q = cola; cola = []; for(const cb of q) cb(vt); } };
  document.hasFocus = () => true;                   // sin esto, la página cree que otra ventana tiene el foco y baja a 10 fps
  navigator.getGamepads = () => [];
  localStorage.setItem('cv-tour', '1');
  const css = document.createElement('style');
  css.textContent = '#hud,#sky-marks,#sky-names,#balloon-tag,#cursor,#tour,#arrival,#t-fly,.t-btn,#t-zone,#pilot-hud,#mic,#world-info,#now,#hint,#teaser,astro-dev-toolbar{display:none!important}';
  document.addEventListener('DOMContentLoaded', () => document.head.append(css));
});
await pg.goto(`${BASE}/?video&dpr=1`, { waitUntil: 'load' });
await new Promise(r => setTimeout(r, 12000));         // el universo se arma y la cámara llega a la vista general
await pg.evaluate(() => window.__vt.start());
for(let k = 0; k < 90; k++) await pg.evaluate((ms) => window.__vt.step(ms), 1000/FPS); // 3 s para asentarse
for(let k = 0; k < total; k++){
  await pg.evaluate((ms) => window.__vt.step(ms), 1000/FPS);
  await pg.screenshot({ path: path.join(dir, 'fondo', String(k).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 93 });
  if(k % 150 === 0) process.stdout.write(`galaxia ${k}/${total}\r`);
}
await browser.close();

// ── la sombra detrás de la cara (una elipse negra que se desvanece) y la mezcla
const sombra = path.join(dir, 'sombra.png');
execFileSync('python3', ['-c', `
from PIL import Image, ImageDraw, ImageFilter
W, H = ${W}, ${H}
m = Image.new('L', (W, H), 0)
ImageDraw.Draw(m).ellipse((W*.08, H*.5 - W*.62, W*.92, H*.5 + W*.62), fill=175)
m = m.filter(ImageFilter.GaussianBlur(W*.12))
Image.merge('RGBA', (Image.new('L', (W, H), 0),)*3 + (m,)).save(${JSON.stringify(sombra)})
`]);
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', path.join(dir, 'fondo', '%05d.jpg'),
  '-i', sombra, '-framerate', String(FPS), '-i', path.join(dir, 'caras', '%05d.png'),
  '-filter_complex', '[0][1]overlay[f];[f][2]overlay=format=auto',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-maxrate', '8M', '-bufsize', '16M', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', OUT]);
fs.rmSync(dir, { recursive: true, force: true });
console.log('listo:', OUT, `(${N} caras, ${(N*CICLO/1000).toFixed(0)} s)`);
