// Threads: a memory in one galaxy tied by hand to one in another (Eze's idea: you see something in your brother's
// galaxy and know it belongs with something of yours). Kept privately; a thread is only shown to whoever may enter
// both galaxies it joins. Made by a galaxy's owner, from a piece elsewhere to one of their own; either end's owner
// can cut it.
//   THREADS_JSON: [{ id, a: { galaxy, piece }, b: { galaxy, piece }, by, at }]   piece = the site's stable piece id
import fs from 'fs/promises';
import crypto from 'crypto';
import { canEnterSlug } from './galaxies.js';

const FILE = process.env.THREADS_JSON || '/root/cronovisor-threads.json';
const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });
const okEnd = (e) => e && /^[a-z0-9-]{1,24}$/.test(String(e.galaxy)) && /^[\w-]{1,48}$/.test(String(e.piece));

let chain = Promise.resolve();
function locked(fn) { const p = chain.then(fn); chain = p.catch(() => {}); return p; }
async function load() { try { return JSON.parse(await fs.readFile(FILE, 'utf-8')); } catch { return []; } }
async function save(all) { await fs.writeFile(FILE + '.tmp', JSON.stringify(all, null, 1), { mode: 0o600 }); await fs.rename(FILE + '.tmp', FILE); }

export async function list(galaxies, device, who) {
  const want = new Set(galaxies.map(String));
  const out = [];
  for (const t of await load()) {
    if (!want.has(t.a.galaxy) && !want.has(t.b.galaxy)) continue;
    if (await canEnterSlug(t.a.galaxy, device, who) && await canEnterSlug(t.b.galaxy, device, who)) out.push({ ...t, mine: !!who && (who === t.a.galaxy || who === t.b.galaxy) });
  }
  return out;
}
export function create(from, to, device, who, whoName) {
  return locked(async () => {
    if (!who) throw bad('log into your admin on this device first', 401);
    if (!okEnd(from) || !okEnd(to)) throw bad('which pieces?');
    if (to.galaxy !== who) throw bad('the second piece has to be one of yours', 403);
    if (from.galaxy === to.galaxy) throw bad('both are in the same galaxy');
    if (!(await canEnterSlug(from.galaxy, device, who))) throw bad('no such galaxy', 404);
    const all = await load();
    const same = (t) => (t.a.galaxy === from.galaxy && t.a.piece === from.piece && t.b.galaxy === to.galaxy && t.b.piece === to.piece)
      || (t.b.galaxy === from.galaxy && t.b.piece === from.piece && t.a.galaxy === to.galaxy && t.a.piece === to.piece);
    if (all.some(same)) return { ok: true, already: true };
    const t = { id: crypto.randomBytes(6).toString('base64url'), a: { galaxy: from.galaxy, piece: from.piece }, b: { galaxy: to.galaxy, piece: to.piece }, by: String(whoName || '').slice(0, 40), at: new Date().toISOString() };
    all.push(t);
    await save(all);
    return { ok: true, thread: t };
  });
}
export function cut(id, who) {
  return locked(async () => {
    const all = await load();
    const t = all.find((x) => x.id === id);
    if (!t) throw bad('no such thread', 404);
    if (!who || (who !== t.a.galaxy && who !== t.b.galaxy)) throw bad('only its two galaxies can cut it', 403);
    await save(all.filter((x) => x.id !== id));
    return { ok: true };
  });
}
