#!/usr/bin/env node
// Facebook → Cronovisor. Reads a Facebook data download (JSON format, the folder `your_facebook_activity`), proposes
// a date and a title for every photo and opens a review page on this Mac, grouped by album (Facebook's own way of
// telling these stories), each album and each photo with a checkbox, date and title editable. "Upload" sends the
// chosen ones, oldest first, through the admin's route (POST /api/frases/photo), which stores them with their date.
//
//   node tools/facebook-import/import.mjs ~/Downloads/your_facebook_activity [~/Downloads/HTML_instagram-…]
//   then open http://localhost:4341
//
// Dates, best first: the camera's own date (EXIF `taken_timestamp`, green); a date or year in the album's name
// ("Camino de Santiago en Bicicleta 2007", "Recital Jack Johnson, 15.07.2008", "Suiza, Enero 2008") when it's
// earlier than the upload (gold, check it); otherwise the day it went up to Facebook (muted).
// Titles: the photo's own description, else the text of the post it came in, else the album's name (generic albums
// like "Profilbilder" or "Uploads von Mobilgeräten" give none). Facebook writes its JSON as UTF-8 read as Latin-1
// ("SeÃ±oras"); it's mended. Videos are left out. Duplicates are found by picture (a 64-bit difference hash made with
// ffmpeg, cached in .cronovisor-hashes.json): the same photo twice in Facebook, and, if the Instagram export folder
// is given, photos already imported from Instagram; both come with a tag. Nothing comes ticked: every photo is chosen by hand (Eze, 2026-11-07). Uploads are logged in
// .cronovisor-imported.json inside the export folder, so a rerun never sends a photo twice, and the review page
// leaves them out (and their twins): each visit shows only what's still to go, so it can be swept bit by bit.
import http from 'http';
import fs from 'fs/promises';
import { existsSync, readFileSync, readdirSync } from 'fs';
import path from 'path';
import { execFile } from 'child_process';

const DIR = path.resolve(process.argv[2] || '');
const IG = process.argv[3] ? path.resolve(process.argv[3]) : '';
const PORT = Number(process.env.PORT || 4341);
const TARGET = process.env.TARGET || 'https://ezeangeloni.xyz/api/frases/photo';
const POSTS = path.join(DIR, 'posts');
const LOG = process.env.LOG || path.join(DIR, '.cronovisor-imported.json'); // LOG: only for testing
const HASHES = path.join(DIR, '.cronovisor-hashes.json');
const REVIEW = path.join(DIR, '.cronovisor-review.json'); // your ticks, dates and titles, kept as you change them
if (!existsSync(path.join(POSTS, 'album'))) {
  console.error('usage: node import.mjs <your_facebook_activity folder> [instagram export folder]');
  process.exit(1);
}

const pad = (n) => String(n).padStart(2, '0');
const mend = (s) => { if (typeof s !== 'string') return ''; const t = Buffer.from(s, 'latin1').toString('utf8'); return t.includes('�') ? s : t; };
const json = (f) => JSON.parse(readFileSync(path.join(POSTS, f), 'utf-8'));
const dayOf = (ts) => { // the local day in Europe (where he lived), as YYYY-MM-DD
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(ts * 1000));
  const g = (t) => p.find((x) => x.type === t).value;
  return `${g('year')}-${g('month')}-${g('day')}`;
};
const validDay = (y, m, d) => { const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCMonth() === m - 1 && t.getUTCDate() === d; };

const MONTHS = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  januar: 1, februar: 2, märz: 3, april: 4, mai: 5, juni: 6, juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12,
  january: 1, february: 2, march: 3, may: 5, june: 6, july: 7, october: 10, december: 12, janvier: 1, juillet: 7, août: 8 };
// the date an album's name points at: {y, m?, d?} or null
function nameDate(s) {
  let m = s.match(/\b(\d{1,2})[./](\d{1,2})[./]((?:19|20)\d\d)\b/); // 15.07.2008, 28/02/2013
  if (m && validDay(+m[3], +m[2], +m[1])) return { y: +m[3], m: +m[2], d: +m[1] };
  m = s.match(/\b(\d{1,2})\s+(?:de\s+)?([a-zäéû]+)\s+(?:de\s+)?((?:19|20)\d\d)\b/i); // 24 Marzo 2004, 1 de diciembre de 2011
  if (m && MONTHS[m[2].toLowerCase()] && validDay(+m[3], MONTHS[m[2].toLowerCase()], +m[1])) return { y: +m[3], m: MONTHS[m[2].toLowerCase()], d: +m[1] };
  m = s.match(/\b([a-zäéû]+),?\s*((?:19|20)\d\d)\b/i); // Enero 2008, Julio 2012, ChecaEnero 2008
  if (m) { const mo = Object.keys(MONTHS).find((k) => m[1].toLowerCase().endsWith(k)); if (mo) return { y: +m[2], m: MONTHS[mo] }; }
  m = s.match(/\b((?:19|20)\d\d)\b/);
  return m ? { y: +m[1] } : null;
}

const GENERIC = /^(fotos|profilbilder|titelbilder|uploads von mobilger.te|unbenanntes album|ios photos|instagram photos|digital|that's me photos|mobile uploads|profile pictures|cover photos|timeline photos)$/i;
function title(text) {
  const clean = (l) => l.replace(/#[\p{L}\p{N}_]+/gu, '').replace(/\p{Extended_Pictographic}|[\u{1F1E6}-\u{1F1FF}]|️|‍/gu, '')
    .replace(/\s+/g, ' ').trim().replace(/^[-–—·:|.,\s]+|[-–—·:|,\s]+$/g, '');
  const t = (text.split('\n').map(clean).filter(Boolean)[0] || '').replace(/\.+$/, '');
  return t.length <= 120 ? t : t.slice(0, 120).replace(/\s+\S*$/, '') + '…';
}
const albumTitle = (name) => GENERIC.test(name.trim()) ? '' : title(name.replace(/^\d+\s*-\s*/, '').replace(/\s*PARTE\s*\d+\s*$/i, ''));

// ── gather ──
const posts = json('your_posts__check_ins__photos_and_videos_1.json');
const postText = new Map(); // uri → text of the post it came in
for (const p of posts) {
  const text = mend((p.data || []).find((d) => d.post)?.post || '');
  for (const a of p.attachments || []) for (const d of a.data || []) if (d.media?.uri && text) postText.set(d.media.uri, text);
}
const items = [];
const seen = new Set();
function add(ph, album, order) {
  const uri = ph.uri;
  if (!uri || seen.has(uri) || !/\.(jpe?g|png|webp|avif)$/i.test(uri) || /\/stickers_used\//.test(uri)) return;
  seen.add(uri);
  const file = path.join(DIR, uri.replace(/^your_facebook_activity\//, ''));
  if (!existsSync(file)) return;
  const ex = ph.media_metadata?.photo_metadata?.exif_data?.[0] || {};
  const up = ph.creation_timestamp;
  const uploaded = up ? dayOf(up) : '';
  let fecha = uploaded, how = 'uploaded';
  if (ex.taken_timestamp && ex.taken_timestamp > 631152000 && (!up || ex.taken_timestamp <= up + 86400)) { fecha = dayOf(ex.taken_timestamp); how = 'camera'; }
  else if (album && uploaded) {
    const nd = nameDate(album.name);
    const [uy, um, ud] = uploaded.split('-').map(Number);
    if (nd && (nd.y < uy || (nd.y === uy && nd.m && nd.m < um))) {
      const m = nd.m || um; let d = nd.d || (nd.m ? 15 : ud);
      if (!validDay(nd.y, m, d)) d = 28;
      fecha = `${nd.y}-${pad(m)}-${pad(d)}`; how = 'album';
    }
  }
  const desc = mend(ph.description || '');
  const own = desc && desc.trim() !== album?.name.trim() ? desc : postText.get(uri) || '';
  items.push({
    id: uri, file, fecha, how, uploaded, order,
    album: album ? album.name : (postText.has(uri) ? 'posts' : 'other photos'),
    caption: own ? title(own) : album ? albumTitle(album.name) : '',
    full: (own || album?.description || '').slice(0, 600),
  });
}
const albums = readdirSync(path.join(POSTS, 'album')).filter((f) => f.endsWith('.json')).map((f) => json('album/' + f))
  .map((a) => ({ ...a, name: mend(a.name), description: mend(a.description || '') }));
for (const a of albums) a.photos.forEach((ph, k) => add(ph, a, k));
for (const p of posts) for (const a of p.attachments || []) for (const d of a.data || []) if (d.media) add({ ...d.media, creation_timestamp: d.media.creation_timestamp || p.timestamp }, null, 0);
for (const ph of json('your_uncategorized_photos.json').other_photos_v2 || []) add(ph, null, 0);

// ── duplicates by picture ──
const hashes = existsSync(HASHES) ? JSON.parse(readFileSync(HASHES, 'utf-8')) : {};
const dhash = (f) => new Promise((ok) => {
  execFile('ffmpeg', ['-v', 'error', '-i', f, '-frames:v', '1', '-vf', 'scale=9:8:flags=area,format=gray', '-f', 'rawvideo', '-'],
    { encoding: 'buffer', maxBuffer: 1 << 16 }, (err, out) => {
      if (err || out.length < 72) return ok(null);
      let h = 0n;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) h = (h << 1n) | (out[y * 9 + x] > out[y * 9 + x + 1] ? 1n : 0n);
      ok(h.toString(16));
    });
});
async function hashAll(files) {
  const todo = files.filter((f) => !(f in hashes));
  let k = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (todo.length) {
      const f = todo.pop();
      hashes[f] = await dhash(f);
      if (++k % 200 === 0) process.stdout.write(`  hashed ${k}\n`);
    }
  }));
  if (k) await fs.writeFile(HASHES, JSON.stringify(hashes));
}
const near = (a, b) => { let x = BigInt('0x' + a) ^ BigInt('0x' + b), n = 0; while (x) { n += Number(x & 1n); x >>= 1n; } return n <= 5; };

const igFiles = [];
if (IG) {
  const igLog = path.join(IG, '.cronovisor-imported.json');
  if (existsSync(igLog)) igFiles.push(...Object.keys(JSON.parse(readFileSync(igLog, 'utf-8'))).map((f) => path.join(IG, f)).filter(existsSync));
  else console.warn(`no .cronovisor-imported.json in ${IG}: Instagram duplicates not checked`);
}
console.log(`hashing ${items.length + igFiles.length} pictures (cached after the first run)…`);
await hashAll([...items.map((i) => i.file), ...igFiles]);
const igHashes = igFiles.map((f) => hashes[f]).filter(Boolean);
const rank = (i) => (i.how === 'camera' ? 0 : i.how === 'album' ? 1 : 2) + (i.caption ? 0 : .5);
const kept = [];
for (const it of [...items].sort((a, b) => rank(a) - rank(b))) {
  const h = hashes[it.file];
  if (!h) continue;
  if (igHashes.some((g) => near(g, h))) { it.dup = 'on instagram'; continue; }
  const twin = kept.find((k) => near(hashes[k.file], h));
  if (twin) { it.dup = `twin in ${twin.album}`; it.twinOf = twin.id; continue; }
  kept.push(it);
}
// an album's photos sort by date, the albums by their first photo
items.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.order - b.order);
const done = existsSync(LOG) ? JSON.parse(readFileSync(LOG, 'utf-8')) : {};
const count = (k) => items.filter((i) => i.how === k).length;
console.log(`${items.length} photos · ${count('camera')} camera date · ${count('album')} from the album's name · ${count('uploaded')} upload day · ${items.filter((i) => i.dup).length} duplicates · ${Object.keys(done).length} already uploaded`);

const send = (res, code, body, type = 'application/json') => { res.writeHead(code, { 'Content-Type': type }); res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
const readBody = (req) => new Promise((ok) => { let d = ''; req.on('data', (c) => { d += c; }); req.on('end', () => ok(d)); });
const sniff = (b) => b[0] === 0xFF && b[1] === 0xD8 ? ['image/jpeg', 'jpg'] : b[0] === 0x89 && b[1] === 0x50 ? ['image/png', 'png']
  : b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP' ? ['image/webp', 'webp'] : null;
const review = existsSync(REVIEW) ? JSON.parse(readFileSync(REVIEW, 'utf-8')) : {};
let saving = Promise.resolve();
// what's already gone up (or is the same picture as one that has) isn't shown again: the review is a sweep, a little
// at a time, and each visit only shows what's left. The log is read on every load, so reloading the page is enough
const gone = (it) => !!(done[it.id] || (it.twinOf && done[it.twinOf]));
const pub = () => items.filter((it) => !gone(it)).map(({ file, twinOf, ...it }) => ({ ...it, ...review[it.id] }));

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/') return send(res, 200, readFileSync(new URL('./review.html', import.meta.url)), 'text/html; charset=utf-8');
    if (url.pathname === '/items.json') return send(res, 200, { items: pub(), done, hidden: items.filter(gone).length, target: TARGET });
    if (url.pathname === '/img') {
      const it = items.find((i) => i.id === url.searchParams.get('id'));
      if (!it) return send(res, 404, '');
      const buf = await fs.readFile(it.file);
      const t = sniff(buf);
      return t ? send(res, 200, buf, t[0]) : send(res, 415, '');
    }
    if (url.pathname === '/review' && req.method === 'POST') { // { id: { on?, fecha?, caption? }, … }
      const changes = JSON.parse(await readBody(req));
      for (const [id, c] of Object.entries(changes)) {
        if (!items.some((i) => i.id === id)) continue;
        const r = review[id] ||= {};
        if (typeof c.on === 'boolean') r.on = c.on;
        if (typeof c.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.fecha)) { r.fecha = c.fecha; r.how = 'yours'; }
        if (typeof c.caption === 'string') r.caption = c.caption.slice(0, 300);
      }
      saving = saving.catch(() => {}).then(() => fs.writeFile(REVIEW + '.tmp', JSON.stringify(review)).then(() => fs.rename(REVIEW + '.tmp', REVIEW)));
      await saving;
      return send(res, 200, { ok: true });
    }
    if (url.pathname === '/upload' && req.method === 'POST') {
      const { id, fecha, caption } = JSON.parse(await readBody(req));
      const item = items.find((i) => i.id === id);
      if (!item) return send(res, 404, { error: 'unknown photo' });
      if (done[id]) return send(res, 200, { ok: true, already: true, imagen: done[id] });
      const buf = await fs.readFile(item.file);
      const t = sniff(buf);
      if (!t) return send(res, 415, { error: 'not a jpg, png or webp inside' });
      const form = new FormData();
      form.append('fecha', fecha);
      form.append('caption', caption || '');
      form.append('photo', new Blob([buf], { type: t[0] }), path.basename(item.file).replace(/\.\w+$/, '.' + t[1]));
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
