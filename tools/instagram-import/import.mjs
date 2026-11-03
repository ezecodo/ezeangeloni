#!/usr/bin/env node
// Instagram → Cronovisor. Reads an Instagram data download (HTML format), proposes a date and a title for every
// photo, and opens a review page on this Mac: each photo grouped by year and month (the barrios it will form),
// with a checkbox, its date and its title, all editable. "Upload" sends the chosen ones, oldest first, through the
// same route as the admin's photos tab (POST /api/frases/photo), which stores them in frases.json with their date.
//
//   node tools/instagram-import/import.mjs ~/Downloads/HTML_instagram-<user>-<date>-<id>
//   then open http://localhost:4340
//
// Dates: the day the post went up. A post that names an earlier year in its text ("Retrospectiva Serie · Thar
// Desert, India, 2015") is a photo from then: it gets that year (same month and day as the post) and is marked so
// you can check it. Titles: the first line of the text without hashtags or emojis ("Retrospectiva Serie" headers
// skipped). Carousels: every photo, same date, the title on all. Videos are left out (the site doesn't play them).
// Archived posts are listed unticked. What's been uploaded is remembered in .cronovisor-imported.json inside the
// export folder, so running it again never uploads a photo twice. The password is typed in the page, never stored.
import http from 'http';
import fs from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

const DIR = path.resolve(process.argv[2] || '');
const PORT = Number(process.env.PORT || 4340);
const TARGET = process.env.TARGET || 'https://ezeangeloni.xyz/api/frases/photo';
const LOG = path.join(DIR, '.cronovisor-imported.json');
if (!existsSync(path.join(DIR, 'your_instagram_activity/media/posts_1.html'))) {
  console.error('usage: node import.mjs <instagram export folder> (the one with your_instagram_activity/ and media/)');
  process.exit(1);
}

const MONTHS = { 'jan': 1, 'feb': 2, 'mär': 3, 'mar': 3, 'märz': 3, 'apr': 4, 'mai': 5, 'may': 5, 'jun': 6, 'juni': 6, 'jul': 7, 'juli': 7,
  'aug': 8, 'sep': 9, 'sept': 9, 'okt': 10, 'oct': 10, 'nov': 11, 'dez': 12, 'dec': 12 };
const pad = (n) => String(n).padStart(2, '0');
const decode = (s) => s.replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '')
  .replace(/&#0*39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

function parseDate(s) { // "Okt. 28, 2022 12:48 am", "Juni 11, 2015 10:13 pm"
  const m = s.match(/^\s*([^\s.]+)\.?\s+(\d{1,2}),\s*(\d{4})/);
  if (!m) return null;
  const mo = MONTHS[m[1].toLowerCase()];
  return mo ? { y: Number(m[3]), m: mo, d: Number(m[2]) } : null;
}
function validDay(y, m, d) { const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCMonth() === m - 1; }

function title(text) {
  const clean = (l) => l.replace(/#[\p{L}\p{N}_]+/gu, '').replace(/\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]|️|‍/gu, '')
    .replace(/\s+/g, ' ').trim().replace(/^[-–—·:|.,\s]+|[-–—·:|,\s]+$/g, '');
  const lines = text.split('\n').map(clean).filter(Boolean);
  if (lines.length > 1 && /^retrospectiva/i.test(lines[0])) lines.shift();
  const t = (lines[0] || '').replace(/\.$/, '');
  if (t.length <= 120) return t;
  return t.slice(0, 120).replace(/\s+\S*$/, '') + '…';
}

function parsePosts(file, archived) {
  const s = readFileSync(path.join(DIR, file), 'utf-8');
  const blocks = s.split('<div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">').slice(1);
  const items = [];
  for (const b of blocks) {
    const ds = [...b.matchAll(/<div class="_3-94 _a6-o">([^<]+)<\/div>/g)].map((m) => m[1]);
    const posted = ds.length ? parseDate(ds[ds.length - 1]) : null;
    if (!posted) continue;
    const text = (b.match(/<h2[^>]*>([\s\S]*?)<\/h2>/) || [])[1];
    const caption = text ? decode(text) : '';
    const media = [...new Set([...b.matchAll(/(?:src|href)="(media\/[^"]+)"/g)].map((m) => m[1]))]
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
    // a photo from an earlier year, named in its text
    const earlier = [...caption.matchAll(/\b(19[89]\d|20[0-2]\d)\b/g)].map((m) => Number(m[1])).find((y) => y < posted.y);
    let { y, m, d } = posted;
    if (earlier) { y = earlier; if (!validDay(y, m, d)) d = 28; }
    const postedOn = `${posted.y}-${pad(posted.m)}-${pad(posted.d)}`;
    media.forEach((f, k) => items.push({
      id: f, file: f, fecha: `${y}-${pad(m)}-${pad(d)}`, postedOn, fromText: !!earlier,
      caption: title(caption), full: caption.slice(0, 600), carousel: media.length > 1 ? `${k + 1}/${media.length}` : '', archived,
    }));
  }
  return items;
}

const items = [
  ...parsePosts('your_instagram_activity/media/posts_1.html', false),
  ...(existsSync(path.join(DIR, 'your_instagram_activity/media/archived_posts.html')) ? parsePosts('your_instagram_activity/media/archived_posts.html', true) : []),
].sort((a, b) => a.fecha.localeCompare(b.fecha));
const done = existsSync(LOG) ? JSON.parse(readFileSync(LOG, 'utf-8')) : {};
console.log(`${items.length} photos · ${items.filter((i) => i.fromText).length} dated from their text · ${Object.keys(done).length} already uploaded`);

const send = (res, code, body, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
const readBody = (req) => new Promise((ok) => { let d = ''; req.on('data', (c) => { d += c; }); req.on('end', () => ok(d)); });

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/') return send(res, 200, readFileSync(new URL('./review.html', import.meta.url)), 'text/html; charset=utf-8');
    if (url.pathname === '/items.json') return send(res, 200, { items, done, target: TARGET });
    if (url.pathname === '/img') {
      const f = path.resolve(DIR, url.searchParams.get('f') || '');
      if (!f.startsWith(path.join(DIR, 'media') + path.sep) || !/\.(jpe?g|png|webp)$/i.test(f)) return send(res, 404, '');
      return send(res, 200, await fs.readFile(f), f.endsWith('.webp') ? 'image/webp' : f.endsWith('.png') ? 'image/png' : 'image/jpeg');
    }
    if (url.pathname === '/upload' && req.method === 'POST') {
      const { id, fecha, caption } = JSON.parse(await readBody(req));
      const item = items.find((i) => i.id === id);
      if (!item) return send(res, 404, { error: 'unknown photo' });
      if (done[id]) return send(res, 200, { ok: true, already: true, imagen: done[id] });
      const buf = await fs.readFile(path.join(DIR, item.file));
      const form = new FormData();
      form.append('fecha', fecha);
      form.append('caption', caption || '');
      form.append('photo', new Blob([buf]), path.basename(item.file));
      const r = await fetch(TARGET, { method: 'POST', headers: { 'X-Auth': req.headers['x-auth'] || '' }, body: form });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return send(res, r.status, { error: j.error || `error ${r.status}` });
      done[id] = j.entry.imagen;
      await fs.writeFile(LOG, JSON.stringify(done, null, 1));
      return send(res, 200, { ok: true, imagen: j.entry.imagen, barrio: j.barrio });
    }
    send(res, 404, '');
  } catch (e) {
    send(res, 500, { error: e.message });
  }
}).listen(PORT, '127.0.0.1', () => console.log(`review: http://localhost:${PORT}  →  uploads to ${TARGET}`));
