// Xibalbá: the journey of Eze's father through the underworld, for Eze and his brothers only.
// Nothing here is public: the data and photos live outside the web root and are only handed to a device logged in
// as one of the family's galaxies (Eze always; the others chosen in his admin). To anyone else it doesn't exist.
//
//   XIBALBA_DIR/journey.json   name, died (YYYY-MM-DD), family (galaxy slugs), photos [{id, ext, caption}], words
//   XIBALBA_DIR/<id>.<ext>     the photos
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { sniff } from './frases.js';

const DIR = process.env.XIBALBA_DIR || '/root/cronovisor-xibalba';
const FILE = path.join(DIR, 'journey.json');
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });

let chain = Promise.resolve();
function locked(fn) { const p = chain.then(fn); chain = p.catch(() => {}); return p; }
async function load() {
  try { return JSON.parse(await fs.readFile(FILE, 'utf-8')); } catch { return { name: '', died: '', family: [], photos: [], words: [] }; }
}
async function save(j) {
  await fs.mkdir(DIR, { recursive: true, mode: 0o700 });
  await fs.writeFile(FILE + '.tmp', JSON.stringify(j, null, 1), { mode: 0o600 });
  await fs.rename(FILE + '.tmp', FILE);
}

// Eze ('eze') always; his brothers when he ticks their galaxies.
export async function isFamily(who) {
  if (!who) return false;
  if (who === 'eze') return true;
  return (await load()).family.includes(who);
}

export async function journey() {
  const j = await load();
  if (!j.died) return null; // not begun yet
  return { name: j.name, died: j.died, photos: j.photos.map(({ id, caption }) => ({ id, caption })), words: j.words.slice(-60) };
}
export async function settings() {
  const j = await load();
  return { name: j.name, died: j.died, family: j.family, photos: j.photos.map(({ id, caption }) => ({ id, caption })), words: j.words.slice(-200).reverse() };
}
export function configure({ name, died, family }) {
  return locked(async () => {
    const j = await load();
    if (died !== undefined) {
      if (died && (!/^\d{4}-\d{2}-\d{2}$/.test(died) || died > new Date().toISOString().slice(0, 10))) throw bad('that date doesn’t look right');
      j.died = died || '';
    }
    if (name !== undefined) j.name = String(name).trim().slice(0, 60);
    if (Array.isArray(family)) j.family = family.map(String).filter((s) => /^[a-z0-9-]{1,24}$/.test(s)).slice(0, 12);
    await save(j);
    return settings();
  });
}
export function addPhoto(buf, caption) {
  return locked(async () => {
    const type = sniff(buf);
    if (!type) throw bad('a jpg, png or webp, please', 415);
    const j = await load();
    const id = crypto.randomBytes(8).toString('hex');
    await fs.mkdir(DIR, { recursive: true, mode: 0o700 });
    await fs.writeFile(path.join(DIR, `${id}.${EXT[type]}`), buf, { mode: 0o600 });
    j.photos.push({ id, ext: EXT[type], caption: String(caption || '').trim().slice(0, 200) });
    await save(j);
    return { id };
  });
}
export function removePhoto(id) {
  return locked(async () => {
    const j = await load();
    const p = j.photos.find((x) => x.id === id);
    if (!p) throw bad('no such photo', 404);
    j.photos = j.photos.filter((x) => x.id !== id);
    await fs.rm(path.join(DIR, `${p.id}.${p.ext}`), { force: true });
    await save(j);
    return { ok: true };
  });
}
export async function photoFile(id) {
  const p = (await load()).photos.find((x) => x.id === id);
  if (!p) throw bad('no such photo', 404);
  return { file: path.join(DIR, `${p.id}.${p.ext}`), type: p.ext === 'jpg' ? 'image/jpeg' : `image/${p.ext}` };
}
export function leaveWords(fromName, text) {
  return locked(async () => {
    const words = String(text || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length || words.length > 30) throw bad('a few words, please');
    const j = await load();
    j.words.push({ from: String(fromName || '').slice(0, 40), text: words.join(' ').slice(0, 400), at: new Date().toISOString() });
    j.words = j.words.slice(-500);
    await save(j);
    return { ok: true };
  });
}
