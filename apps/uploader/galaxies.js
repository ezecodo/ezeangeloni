// Galaxies: other people's universes beside Eze's (family, invite-only). Eze creates them from his admin; each
// gets its own data folder, its own admin password and a privacy setting.
//
//   private registry  GALAXIES_JSON (outside the web root): slug, name, token, public, password hash
//   public registry   <web root>/galaxies.json: what the site may know (public ones with their folder,
//                     private ones only by name, drawn as a blurred nebula from afar)
//   data              <web root>/galaxies/<slug>-<token>/  (frases.json, images/, links.json, links/)
//   words             MESSAGES_DIR/<slug>.json (outside the web root, read in that galaxy's admin)
//
// A private galaxy is unlisted, not encrypted: its folder name carries a random token that the site only learns
// from the door (below). Getting in is knocking: a visitor at a private galaxy asks with their name; the owner
// lets them in from their admin. A grant is either a device (a random id the browser keeps) or a whole galaxy
// (when the one knocking is logged in as a galaxy's owner on that device: then the two galaxies are connected,
// both ways, on every device where those owners have logged in). Turning someone away again changes the
// galaxy's token (its folder is renamed), so whoever still has a grant just gets the new address at the door.
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
// one change at a time to the registry
let chain = Promise.resolve();
function locked(fn) { const p = chain.then(fn); chain = p.catch(() => {}); return p; }
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
const view = (g) => ({ slug: g.slug, name: g.name, public: !!g.public, created: g.created });

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
// The galaxy owner a password belongs to, without counting a wrong one as an attack (the site asks on every visit).
export async function ownerOf(password, ezePassword) {
  if (!password) return null;
  if (password === ezePassword) return { slug: MAIN, name: 'Eze' };
  const g = await byPassword(password).catch(() => null);
  return g ? { slug: g.slug, name: g.name } : null;
}

// ── the door ──
// `who` is the galaxy whose owner is logged in on the visiting device ('eze' for Eze), or null.
const MAIN = 'eze';
const cleanName = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 40);
const validDevice = (d) => /^[\w-]{16,64}$/.test(String(d || ''));
function canEnter(g, device, who) {
  if (g.public) return true;
  if (who === g.slug) return true;
  return (g.grants || []).some((x) => (x.device && x.device === device) || (x.galaxy && x.galaxy === who));
}
function stateOf(g, device, who) {
  if (canEnter(g, device, who)) return { status: 'open', dir: dirName(g) };
  const r = (g.requests || []).find((x) => x.device === device || (who && x.from === who));
  return { status: r ? r.status : 'closed' };
}
// What each private galaxy looks like from this device: open (and where it is), pending, declined or closed.
export async function doors(slugs, device, who) {
  const all = (await load()).galaxies, out = {};
  for (const slug of slugs.slice(0, 30)) {
    const g = all.find((x) => x.slug === slug);
    if (g) out[slug] = stateOf(g, device, who);
  }
  return out;
}
export function knock(slug, { name, device }, who, whoName) {
  return locked(async () => {
    if (!validDevice(device)) throw bad('no device');
    const data = await load();
    const g = data.galaxies.find((x) => x.slug === slug);
    if (!g) throw bad('no such galaxy', 404);
    if (canEnter(g, device, who)) return stateOf(g, device, who);
    g.requests = (g.requests || []).filter((x) => !(x.device === device || (who && x.from === who)));
    const n = cleanName(whoName || name);
    if (!n) throw bad('your name, please');
    g.requests.push({ id: crypto.randomBytes(6).toString('base64url'), name: n, device, from: who || null, status: 'pending', at: new Date().toISOString() });
    g.requests = g.requests.slice(-100);
    await save(data);
    return { status: 'pending' };
  });
}
// For the owner's admin: who's knocking, who can come in.
export async function requests(slug) {
  const g = (await load()).galaxies.find((x) => x.slug === slug);
  if (!g) throw bad('no such galaxy', 404);
  return {
    requests: (g.requests || []).filter((r) => r.status === 'pending').map(({ id, name, from, at }) => ({ id, name, galaxy: !!from, at })),
    guests: (g.grants || []).map(({ id, name, galaxy, at }) => ({ id, name, galaxy: !!galaxy, at })),
  };
}
export function decide(slug, id, action) {
  return locked(async () => {
    const data = await load();
    const g = data.galaxies.find((x) => x.slug === slug);
    const r = g && (g.requests || []).find((x) => x.id === id);
    if (!r) throw bad('no such request', 404);
    if (action === 'decline') { r.status = 'declined'; await save(data); return { ok: true }; }
    r.status = 'approved';
    g.grants = g.grants || [];
    const grant = { id: crypto.randomBytes(6).toString('base64url'), name: r.name, at: new Date().toISOString() };
    if (r.from) {
      grant.galaxy = r.from;
      // connected both ways: the one who knocked opens to this galaxy's owner too
      const back = data.galaxies.find((x) => x.slug === r.from);
      if (back && !(back.grants || []).some((x) => x.galaxy === slug)) {
        back.grants = back.grants || [];
        back.grants.push({ id: crypto.randomBytes(6).toString('base64url'), name: g.name, galaxy: slug, at: grant.at });
      }
    } else grant.device = r.device;
    g.grants.push(grant);
    g.requests = g.requests.filter((x) => x.id !== id);
    await save(data);
    return { ok: true };
  });
}
// Turning a guest away: the galaxy gets a new token (its folder moves), so a remembered address stops working;
// everyone still let in learns the new one at the door.
export function turnAway(slug, id) {
  return locked(async () => {
    const data = await load();
    const g = data.galaxies.find((x) => x.slug === slug);
    if (!g || !(g.grants || []).some((x) => x.id === id)) throw bad('no such guest', 404);
    const gone = g.grants.find((x) => x.id === id);
    g.grants = g.grants.filter((x) => x.id !== id);
    if (gone.galaxy) { const back = data.galaxies.find((x) => x.slug === gone.galaxy); if (back) back.grants = (back.grants || []).filter((x) => x.galaxy !== slug); }
    const old = rootOf(g);
    g.token = crypto.randomBytes(9).toString('base64url');
    if (existsSync(old)) await fs.rename(old, rootOf(g));
    await save(data);
    return { ok: true };
  });
}
export { MAIN };

// Words left with the balloon in someone's galaxy: kept for them, read in their admin.
export async function leaveWords(slug, device, who, text) {
  const g = (await load()).galaxies.find((x) => x.slug === slug);
  if (!g || !canEnter(g, device, who)) throw bad('no such galaxy', 404);
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
