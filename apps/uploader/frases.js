// Frases and photos: the archive the Cronovisor draws (`frases.json`).
// Two doors write to it: the admin's "photos" tab (batches, dates read from the photos)
// and the Telegram bot through n8n (one message at a time, date optional at the start of the text).
// The site groups pieces into barrios by the month of `fecha`, so dating a photo is all it takes.
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// Every galaxy has the same layout under its own root: frases.json, images/, images/t/. Eze's is the web root;
// the others live in galaxies/<slug>-<token>/ (see galaxies.js). Functions take that root, Eze's by default.
export const PUBLIC_ROOT = process.env.PUBLIC_ROOT || '/var/www/ezeangeloni.xyz/html';
const jsonOf = (root) => path.join(root, 'frases.json');
const imagesOf = (root) => path.join(root, 'images');
const TZ = process.env.TZ_LOCAL || 'Europe/Madrid';
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '';
const TELEGRAM_CHAT = process.env.TELEGRAM_CHAT || '';


const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

export function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function validDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return y >= 1900 && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d && s <= today();
}

const pad = (n) => String(n).padStart(2, '0');

// A date at the start of a message: 2019-07-14, 2019-07, 14/07/2019, 14.7.19, 14-07-2019.
// Day first, like it's written in Spanish. Returns the date and the rest of the text.
export function leadingDate(text) {
  const t = String(text || '');
  let m = t.match(/^\s*(\d{4})-(\d{1,2})(?:-(\d{1,2}))?(?=$|[\s·:,|–—-])/);
  let fecha = null;
  if (m) fecha = `${m[1]}-${pad(m[2])}-${pad(m[3] || 1)}`;
  else {
    m = t.match(/^\s*(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?=$|[\s·:,|–—-])/);
    if (m) {
      let y = Number(m[3]);
      if (m[3].length === 2) y += y > Number(today().slice(2, 4)) ? 1900 : 2000;
      fecha = `${y}-${pad(m[2])}-${pad(m[1])}`;
    }
  }
  if (!m || !validDate(fecha)) return { fecha: null, rest: t.trim() };
  return { fecha, rest: t.slice(m[0].length).replace(/^[\s·:,|–—-]+/, '').trim() };
}

// The date a camera wrote into a JPEG (EXIF DateTimeOriginal, else DateTime). Same parser as the admin page.
export function exifDate(buf) {
  try {
    const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    if (v.getUint16(0) !== 0xFFD8) return null;
    let o = 2;
    while (o + 10 < v.byteLength) {
      if (v.getUint8(o) !== 0xFF) return null;
      const mark = v.getUint8(o + 1), len = v.getUint16(o + 2);
      if (mark === 0xE1 && v.getUint32(o + 4) === 0x45786966) {
        const t = o + 10, le = v.getUint16(t) === 0x4949;
        const u16 = (p) => v.getUint16(p, le), u32 = (p) => v.getUint32(p, le);
        const ifd = (off) => { const tags = {}, n = u16(t + off); for (let i = 0; i < n; i++) { const e = t + off + 2 + i * 12; tags[u16(e)] = e; } return tags; };
        const str = (e) => { const c = u32(e + 4), p = c > 4 ? t + u32(e + 8) : e + 8; let s = ''; for (let i = 0; i < c - 1; i++) s += String.fromCharCode(v.getUint8(p + i)); return s; };
        const ifd0 = ifd(u32(t + 4));
        let raw = '';
        if (ifd0[0x8769]) { const ex = ifd(u32(ifd0[0x8769] + 8)); raw = ex[0x9003] ? str(ex[0x9003]) : ex[0x9004] ? str(ex[0x9004]) : ''; }
        if (!raw && ifd0[0x0132]) raw = str(ifd0[0x0132]);
        const d = raw.match(/^(\d{4}):(\d{2}):(\d{2})/);
        const out = d && `${d[1]}-${d[2]}-${d[3]}`;
        return out && validDate(out) ? out : null;
      }
      if (mark === 0xDA) return null;
      o += 2 + len;
    }
  } catch {}
  return null;
}

export function monthLabel(fecha) {
  const [y, m] = fecha.split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

// One writer at a time, and never a half-written file: the site reads it on every visit.
const chains = new Map(); // one queue per galaxy
function withLock(root, fn) {
  const p = (chains.get(root) || Promise.resolve()).then(fn);
  chains.set(root, p.catch(() => {}));
  return p;
}
async function load(root) {
  let data = { frases: [] };
  try { data = JSON.parse(await fs.readFile(jsonOf(root), 'utf-8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  if (!Array.isArray(data.frases)) data.frases = [];
  return data;
}
async function save(root, data) {
  const tmp = jsonOf(root) + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(data, null, 2) + '\n');
  await fs.rename(tmp, jsonOf(root));
}

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export function sniff(buf) {
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return 'image/png';
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}

// Same naming as the bot always used (unix seconds), which is also the photo's share link (#1773216235).
async function storeImage(root, buf) {
  const IMAGES_DIR = imagesOf(root);
  await fs.mkdir(IMAGES_DIR, { recursive: true });
  const type = sniff(buf);
  if (!type) throw Object.assign(new Error('not a jpg, png or webp image'), { status: 415 });
  // The number alone is the link, so it must be free in every extension.
  let stamp = Math.floor(Date.now() / 1000);
  while (Object.values(EXT).some((x) => existsSync(path.join(IMAGES_DIR, `${stamp}.${x}`)))) stamp++;
  const name = `${stamp}.${EXT[type]}`;
  await fs.writeFile(path.join(IMAGES_DIR, name), buf, { flag: 'wx' });
  return { imagen: `/images/${name}`, type };
}

// A 384px JPEG beside every photo (images/t/<name>.jpg): the Cronovisor streams these by proximity
// instead of downloading every full photo to shrink it in the browser.
function ffmpeg(args) {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err.slice(-300) || `ffmpeg ${code}`))));
  });
}
export async function makeThumb(name, root = PUBLIC_ROOT) {
  const THUMBS_DIR = path.join(imagesOf(root), 't');
  const out = path.join(THUMBS_DIR, name.replace(/\.\w+$/, '.jpg'));
  if (existsSync(out)) return false;
  await fs.mkdir(THUMBS_DIR, { recursive: true });
  await ffmpeg(['-v', 'error', '-y', '-i', path.join(imagesOf(root), name), '-frames:v', '1',
    '-vf', "scale='min(384,iw)':'min(384,ih)':force_original_aspect_ratio=decrease", '-q:v', '4', out]);
  return true;
}
// On start: thumbnails for any photo that has none yet (the ones from before this existed, or the bot's).
export async function backfillThumbs(root = PUBLIC_ROOT) {
  const names = (await fs.readdir(imagesOf(root))).filter((n) => /\.(jpe?g|png|webp)$/i.test(n));
  let made = 0;
  for (const n of names) {
    try { if (await makeThumb(n, root)) made++; } catch (e) { console.error('[thumbs]', n, e.message); }
  }
  if (made) console.log(`[thumbs] made ${made}`);
}

// `subida` marks the upload day: a piece dated before it went into the past, which the site uses
// to keep the old #NNN links pointing where they did.
export function addPhoto(buf, { fecha, caption }, root = PUBLIC_ROOT) {
  return withLock(root, async () => {
    const { imagen, type } = await storeImage(root, buf);
    await makeThumb(imagen.split('/').pop(), root).catch((e) => console.error('[thumbs]', e.message));
    const date = validDate(fecha) ? fecha : (type === 'image/jpeg' && exifDate(buf)) || today();
    const entry = { imagen, caption: String(caption || '').trim().slice(0, 300), fecha: date, subida: today() };
    const data = await load(root);
    data.frases.push(entry);
    await save(root, data);
    return entry;
  });
}

export function addText(texto, fecha, root = PUBLIC_ROOT) {
  return withLock(root, async () => {
    const entry = { texto: String(texto).trim().slice(0, 2000), fecha: validDate(fecha) ? fecha : today(), subida: today() };
    const data = await load(root);
    data.frases.push(entry);
    await save(root, data);
    return entry;
  });
}

async function telegramFile(fileId) {
  if (!TELEGRAM_TOKEN) throw new Error('TELEGRAM_TOKEN is not set');
  const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`);
  const j = await r.json();
  if (!j.ok) throw new Error('telegram getFile failed');
  const f = await fetch(`https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${j.result.file_path}`);
  if (!f.ok) throw new Error('telegram download failed');
  return Buffer.from(await f.arrayBuffer());
}

const SITE = 'https://ezeangeloni.xyz/';
function when(entry) {
  return entry.fecha === entry.subida ? 'hoy' : `${entry.fecha} · barrio ${monthLabel(entry.fecha)}`;
}

// A Telegram message forwarded by n8n. Returns the reply text for the bot.
// Photos lose their camera date in Telegram's compression; sent as a file (uncompressed) they keep it.
export async function fromTelegram(msg) {
  if (!msg || typeof msg !== 'object') return { status: 400, reply: '' };
  if (!TELEGRAM_CHAT || String(msg.chat?.id) !== TELEGRAM_CHAT) return { status: 403, reply: '' };

  const doc = msg.document;
  const fileId = msg.photo?.length ? msg.photo[msg.photo.length - 1].file_id
    : doc && /^image\//.test(doc.mime_type || '') ? doc.file_id : null;

  if (fileId) {
    if (doc && !/^image\/(jpeg|png|webp)$/.test(doc.mime_type)) {
      return { status: 415, reply: `⚠️ ${doc.mime_type} no se ve en todos los navegadores. Mandala como foto (con la fecha al principio del texto) o como JPG.` };
    }
    const { fecha, rest } = leadingDate(msg.caption);
    const buf = await telegramFile(fileId);
    const entry = await addPhoto(buf, { fecha, caption: rest });
    const id = entry.imagen.split('/').pop().replace(/\.\w+$/, '');
    return { status: 200, reply: `📸 guardada · ${when(entry)}\n${SITE}#${id}` };
  }

  if (typeof msg.text === 'string' && msg.text.trim()) {
    const { fecha, rest } = leadingDate(msg.text);
    if (!rest) return { status: 400, reply: '⚠️ Falta el texto después de la fecha.' };
    const entry = await addText(rest, fecha);
    return { status: 200, reply: `💬 guardada · ${when(entry)}` };
  }
  return { status: 200, reply: '🤷 Solo guardo texto y fotos.' };
}

export async function ensureImagesDir(root = PUBLIC_ROOT) {
  await fs.mkdir(imagesOf(root), { recursive: true });
}
