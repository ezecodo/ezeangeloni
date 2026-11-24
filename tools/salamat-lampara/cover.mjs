// The scene's last frame, in real time (headless Chrome's virtual time stalls its animation frames):
// node cover.mjs <url> <out.png> [width height waitMs]   — Puppeteer from ~/Desktop/dev/cv (or PUPPETEER), the installed Chrome
import { createRequire } from 'node:module';
import os from 'node:os';
const require = createRequire(import.meta.url);
const puppeteer = require(process.env.PUPPETEER || `${os.homedir()}/Desktop/dev/cv/node_modules/puppeteer`);
const [url, out, W = '1000', H = '525', WAIT = '9500'] = process.argv.slice(2);
const browser = await puppeteer.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
const page = await browser.newPage();
await page.setViewport({ width: +W, height: +H, deviceScaleFactor: 1.6 });
await page.goto(url, { waitUntil: 'load' });
await new Promise(r => setTimeout(r, +WAIT)); // Salamat: bulbs, writing, neon, gauge to 0, headline: ~7.5 s
await page.screenshot({ path: out });
await browser.close();
