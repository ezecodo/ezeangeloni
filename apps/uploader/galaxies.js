// Galaxies: other people's universes beside Eze's (family, invite-only). Eze creates them from his admin; each
// gets its own data folder, its own admin password and a privacy setting.
//
//   private registry  GALAXIES_JSON (outside the web root): slug, name, token, public, password hash
//   public registry   <web root>/galaxies.json: what the site may know (public ones with their folder,
//                     private ones only by name, drawn as a blurred nebula from afar)
//   data              <web root>/galaxies/<slug>-<token>/  (frases.json, images/, links.json, links/)
//   words             MESSAGES_DIR/<slug>.json (outside the web root, read in that galaxy's admin)
//
// A private galaxy is unlisted, not encrypted: its folder name carries a random token, and only the visa link
// (`/g/<slug>?v=<token>`) tells the site where it is.
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { PUBLIC_ROOT } from './frases.js';

const GALAXIES_JSON = process.env.GALAXIES_JSON || '/root/cronovisor-galaxies.json';
const MESSAGES_DIR = process.env.MESSAGES_DIR || '/root/cronovisor-messages';
const TRASH_DIR = process.env.GALAXIES_TRASH || '/root/cronovisor-galaxies-trash';
const PUBLIC_JSON = path.join(PUBLIC_ROOT, 'galaxies.json');
const DATA_DIR = path.join(PUBLIC_ROOT, 'galaxies');

const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });
const dirName = (g) => `${g.slug}-${g.token}`;
export const rootOf = (g) => path.join(DATA_DIR, dirName(g));

async function load() {
  try { return JSON.parse(await fs.readFile(GALAXIES_JSON, 'utf-8')); } catch { return { galaxies: [] }; }
}
async function save(data) {
  const tmp = GALAXIES_JSON + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
  await fs.rename(tmp, GALAXIES_JSON);
  // what the site is allowed to know
  const pub = { galaxies: data.galaxies.map((g) => (g.public ? { slug: g.slug, name: g.name, public: true, dir: dirName(g) } : { slug: g.slug, name: g.name, public: false })) };
  await fs.writeFile(PUBLIC_JSON + '.tmp', JSON.stringify(pub, null, 2) + '\n');
  await fs.rename(PUBLIC_JSON + '.tmp', PUBLIC_JSON);
}

function hash(password, salt = crypto.randomBytes(16).toString('hex')) {
  return `${salt}:${crypto.scryptSync(password, salt, 32).toString('hex')}`;
}
function matches(password, stored) {
  const [salt, h] = String(stored).split(':');
  if (!salt || !h) return false;
  const a = Buffer.from(h, 'hex'), b = crypto.scryptSync(String(password), salt, 32);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
// easy to dictate over the phone, hard to guess: four words and a number
const WORDS = ['luna', 'globo', 'viento', 'cielo', 'nube', 'fuego', 'mar', 'sol', 'rio', 'monte', 'bosque', 'piedra', 'lluvia', 'trigo', 'barco', 'faro', 'puente', 'nido', 'rayo', 'sal', 'cobre', 'miel', 'pluma', 'arena'];
function newPassword() {
  const pick = () => WORDS[crypto.randomInt(WORDS.length)];
  return `${pick()}-${pick()}-${pick()}-${pick()}-${crypto.randomInt(10, 100)}`;
}
const slugify = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
const view = (g) => ({ slug: g.slug, name: g.name, public: !!g.public, token: g.token, created: g.created });

export async function list() { return (await load()).galaxies.map(view); }

export async function create(name) {
  name = String(name || '').trim().slice(0, 40);
  const slug = slugify(name);
  if (!slug) throw bad('a name, please');
  if (['eze', 'admin', 'api', 'g', 'images', 'sets', 'links', 'galaxies'].includes(slug)) throw bad('that name is taken');
  const data = await load();
  if (data.galaxies.some((g) => g.slug === slug)) throw bad('there is already a galaxy with that name');
  const password = newPassword();
  const g = { slug, name, token: crypto.randomBytes(9).toString('base64url'), public: false, pass: hash(password), created: new Date().toISOString().slice(0, 10) };
  const root = rootOf(g);
  await fs.mkdir(path.join(root, 'images'), { recursive: true });
  await fs.writeFile(path.join(root, 'frases.json'), JSON.stringify({ frases: [] }, null, 2) + '\n');
  data.galaxies.push(g);
  await save(data);
  return { ...view(g), password };
}

export async function update(slug, { public: isPublic }) {
  const data = await load();
  const g = data.galaxies.find((x) => x.slug === slug);
  if (!g) throw bad('no such galaxy', 404);
  if (typeof isPublic === 'boolean') g.public = isPublic;
  await save(data);
  return view(g);
}

export async function resetPassword(slug) {
  const data = await load();
  const g = data.galaxies.find((x) => x.slug === slug);
  if (!g) throw bad('no such galaxy', 404);
  const password = newPassword();
  g.pass = hash(password);
  await save(data);
  return { ...view(g), password };
}

// Not erased: moved aside, so a mistake can be undone by hand.
export async function remove(slug) {
  const data = await load();
  const g = data.galaxies.find((x) => x.slug === slug);
  if (!g) throw bad('no such galaxy', 404);
  await fs.mkdir(TRASH_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  if (existsSync(rootOf(g))) await fs.rename(rootOf(g), path.join(TRASH_DIR, `${dirName(g)}-${stamp}`));
  data.galaxies = data.galaxies.filter((x) => x.slug !== slug);
  await save(data);
}

// The galaxy a password opens, if any.
export async function byPassword(password) {
  if (!password) return null;
  const g = (await load()).galaxies.find((x) => matches(password, x.pass));
  return g ? { ...view(g), root: rootOf(g), dir: dirName(g) } : null;
}

// Words left with the balloon in someone's galaxy: kept for them, read in their admin.
export async function leaveWords(slug, token, text) {
  const g = (await load()).galaxies.find((x) => x.slug === slug);
  if (!g || (!g.public && token !== g.token)) throw bad('no such galaxy', 404);
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 11) throw bad('eleven words at most');
  await fs.mkdir(MESSAGES_DIR, { recursive: true });
  const file = path.join(MESSAGES_DIR, `${slug}.json`);
  let all = [];
  try { all = JSON.parse(await fs.readFile(file, 'utf-8')); } catch {}
  all.push({ text: words.join(' ').slice(0, 300), at: new Date().toISOString() });
  await fs.writeFile(file, JSON.stringify(all.slice(-2000), null, 1));
}
export async function readWords(slug) {
  try { return JSON.parse(await fs.readFile(path.join(MESSAGES_DIR, `${slug}.json`), 'utf-8')).reverse(); } catch { return []; }
}
