// Graba una historia de Instagram (1080×1920, 9:16) del dragón volando por la galaxia, desde el servidor de desarrollo.
// node tools/video/dragon-story.mjs [salida.mp4] [segundos]
// Necesita: `npm run dev` en el puerto 4361 (o URL=…), ffmpeg, y Puppeteer del proyecto cv (o PUPPETEER=…).
// Sin interfaz ni globo (?video), en una ventana de 1080×1920. Se graba CUADRO POR CUADRO, no en vivo: el reloj de la
// página (performance.now y requestAnimationFrame) pasa a ser manual, avanza exactamente 1/30 s por cuadro, y cada cuadro
// se captura antes de dar el siguiente paso; así sale perfectamente fluido aunque el Mac esté ocupado (en vivo, con
// otra pestaña de three.js abierta, salía trabado). Un "director" mueve la cámara en cuatro
// planos alrededor del dragón: la galaxia de lejos, la cabeza de tres cuartos, de costado desde abajo, y lo deja pasar.
import { createRequire } from 'node:module';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const puppeteer = require(process.env.PUPPETEER || `${os.homedir()}/Desktop/dev/cv/node_modules/puppeteer`);
const OUT = process.argv[2] || `${os.homedir()}/Desktop/dragon-historia.mp4`;
const DUR = Number(process.argv[3]) || 25;
const URL = process.env.URL || 'http://localhost:4361/?video&dpr=1';
const FPS = 30;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dragon-'));

const browser = await puppeteer.launch({
  headless: process.env.HEADFUL ? false : true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  args: ['--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
  defaultViewport: { width: 1080, height: 1920, deviceScaleFactor: 1 }, // sin pantalla, la ventana puede medir lo que el video
});
const page = await browser.newPage();
await page.evaluateOnNewDocument(() => {
  // el reloj manual: hasta __vt.start() corre normal; después sólo avanza con __vt.step(ms), que corre los cuadros pendientes
  const realNow = performance.now.bind(performance), realRAF = window.requestAnimationFrame.bind(window);
  let manual = false, vt = 0, cola = [];
  performance.now = () => manual ? vt : realNow();
  window.requestAnimationFrame = (cb) => { if(manual){ cola.push(cb); return cola.length; } return realRAF(cb); };
  window.__vt = { start(){ vt = realNow(); manual = true; }, step(ms){ vt += ms; const q = cola; cola = []; for(const cb of q) cb(vt); } };
  navigator.getGamepads = () => [];                 // un joystick conectado no se mete en la toma
  localStorage.setItem('cv-tour', '1');             // sin la invitación a aprender a volar
  const css = document.createElement('style');
  css.textContent = '#hud,#sky-marks,#sky-names,#balloon-tag,#cursor,#tour,#arrival,#t-fly,.t-btn,#t-zone,#pilot-hud,#mic,#world-info,#now,astro-dev-toolbar{display:none!important}';
  document.addEventListener('DOMContentLoaded', () => document.head.append(css));
});
await page.goto(URL, { waitUntil: 'load' });
await new Promise(r => setTimeout(r, 9000));      // el universo se arma

// el director: cuatro planos que se funden, la cámara suavizada para que la onda del cuerpo no la sacuda
await page.evaluate((DUR) => {
  const d = window.__dragon, cv = window.__cv, cam = cv.camera, V = cam.position.constructor;
  cv.controls.autoRotate = false; cv.controls.enabled = false;
  d.wait = 0;
  const suave = q => q*q*(3 - 2*q);
  const pos = new V(), mira = new V(); let primero = true, t0 = 0, fijo = null, kAntes = 0;
  const plano = (k, t) => {
    const H = d.spine[0], T = d.T[0], U = d.U[0], S = d.Sd[0], M = d.spine[45], M30 = d.spine[30];
    if(k === 0) return [M.clone().addScaledVector(S, 150).addScaledVector(U, 55).addScaledVector(T, -40), M.clone()];               // la galaxia de lejos
    if(k === 1) return [H.clone().addScaledVector(T, 15).addScaledVector(S, 9).addScaledVector(U, 3.5), d.spine[10].clone()];      // la cabeza, de tres cuartos
    if(k === 2){ const a = Math.min(.85, .55 + t*.02); return [d.spine[40].clone().addScaledVector(S, 22*Math.cos(a)).addScaledVector(U, -22*Math.sin(a)).addScaledVector(T, 8), M30.clone().addScaledVector(U, 1.5)]; } // de costado, desde abajo
    if(!fijo) fijo = H.clone().addScaledVector(T, 55).addScaledVector(S, 18).addScaledVector(U, 6); // al costado: la perla no pasa por el lente                                 // lo deja pasar
    return [fijo.clone().addScaledVector(new V(0, 1, 0), Math.max(0, t - 21)*1.2), H.clone()];
  };
  const CORTES = [0, 4.5, 11.5, 18.5], FUNDE = 1.6;
  window.__director = true;
  const paso = (now) => {
    if(!window.__director) return;
    requestAnimationFrame(paso);
    if(!d.route) return;
    if(!t0) t0 = now;
    const t = (now - t0)/1000;
    let k = 0; for(let j = 0; j < CORTES.length; j++) if(t >= CORTES[j]) k = j;
    let [p, m] = plano(k, t);
    if(k !== kAntes){ if(k >= 2) primero = true; kAntes = k; } // del plano 2 en adelante, corte seco: la cámara no cruza nada en el camino
    if(k === 1 && t - CORTES[k] < FUNDE){ // sólo de la galaxia a la cabeza, un fundido
      const [p0, m0] = plano(k - 1, t), f = suave((t - CORTES[k])/FUNDE);
      p = p0.lerp(p, f); m = m0.lerp(m, f);
    }
    if(primero){ pos.copy(p); mira.copy(m); primero = false; }
    pos.lerp(p, .12); mira.lerp(m, .18);
    cam.position.copy(pos); cam.lookAt(mira);
  };
  requestAnimationFrame(paso);
}, DUR);
await page.waitForFunction(() => window.__dragon.route && window.__dragon.u > .02, { timeout: 20000 });
await page.evaluate(() => window.__vt.start());
const total = Math.round(DUR*FPS);
for(let k = 0; k < total; k++){
  await page.evaluate((ms) => window.__vt.step(ms), 1000/FPS);
  await page.screenshot({ path: path.join(dir, String(k).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 93 });
  if(k % 60 === 0) process.stdout.write(`cuadro ${k}/${total}\r`);
}
await browser.close();
// a MP4 vertical 1080×1920, 30 fps, como lo quiere Instagram
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(FPS), '-i', path.join(dir, '%05d.jpg'),
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', OUT]);
fs.rmSync(dir, { recursive: true, force: true });
console.log('listo:', OUT);
