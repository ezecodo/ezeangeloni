// The games room's lockers: each galaxy owner keeps their own copies of the games they own, privately, and only
// they can take them out again (Eze, 2026-11-09: to play the game of his childhood with his brother, each with
// his own copy). Nothing is shared between lockers and nothing is in the web root: the files live under
// GAMES_DIR/<owner>/ (dirs 700, files 600) and are only handed out through the API to that owner's own password.
// To anyone else, another owner included, a locker doesn't exist (404).
//
//   GAMES_DIR/<owner>/index.json   [{ id, name, system, size, added }]
//   GAMES_DIR/<owner>/<id>.rom     the files
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const DIR = process.env.GAMES_DIR || '/root/cronovisor-games';
const MAX = 16 * 1024 * 1024, MAX_ARCADE = 64 * 1024 * 1024, PER_LOCKER = 30;
// what the room can play, by the file's extension
// (an arcade game is a .zip of its board's chips, and the emulator knows it by the zip's name, so that name is kept)
const SYSTEMS = { sfc: 'snes', smc: 'snes', md: 'segaMD', gen: 'segaMD', smd: 'segaMD', bin: 'segaMD', zip: 'arcade' };
const bad = (msg, status = 400) => Object.assign(new Error(msg), { status });

let chain = Promise.resolve();
function locked(fn) { const p = chain.then(fn); chain = p.catch(() => {}); return p; }
const lockerOf = (owner) => {
  if (!/^[a-z0-9-]{1,40}$/.test(owner)) throw bad('not found', 404);
  return path.join(DIR, owner);
};
async function load(owner) {
  try { return JSON.parse(await fs.readFile(path.join(lockerOf(owner), 'index.json'), 'utf-8')); } catch { return []; }
}
async function save(owner, list) {
  const dir = lockerOf(owner);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const f = path.join(dir, 'index.json');
  await fs.writeFile(f + '.tmp', JSON.stringify(list, null, 1), { mode: 0o600 });
  await fs.rename(f + '.tmp', f);
}

export async function list(owner) {
  return (await load(owner)).map(({ id, name, ext, system, size, added }) => ({ id, name, ext, system, size, added }));
}
export function add(owner, buf, filename) {
  return locked(async () => {
    const ext = String(filename || '').toLowerCase().split('.').pop();
    const system = SYSTEMS[ext];
    if (!system) throw bad('the room plays SNES (.sfc, .smc), Mega Drive (.md, .gen, .smd, .bin) and arcade (.zip) files', 415);
    if (!buf?.length || buf.length > (system === 'arcade' ? MAX_ARCADE : MAX)) throw bad('too big', 413);
    if (system === 'arcade' && !(buf[0] === 0x50 && buf[1] === 0x4b)) throw bad('that .zip isn’t a zip', 415);
    const games = await load(owner);
    if (games.length >= PER_LOCKER) throw bad('the locker is full', 409);
    const id = crypto.randomBytes(9).toString('hex');
    const dir = lockerOf(owner);
    await fs.mkdir(dir, { recursive: true, mode: 0o700 });
    await fs.writeFile(path.join(dir, `${id}.rom`), buf, { mode: 0o600 });
    const base = String(filename).replace(/\.[^.]+$/, '');
    const name = system === 'arcade' ? (/^[a-z0-9_-]{1,40}$/i.test(base) ? base : null) : base.replace(/[^\p{L}\p{N} ._()'&-]/gu, ' ').trim().slice(0, 80) || 'game';
    if (!name) throw bad('an arcade zip keeps its set name (letters, numbers, _ or -), e.g. nbajamte.zip', 415);
    games.push({ id, name, ext, system, size: buf.length, added: new Date().toISOString().slice(0, 10) });
    await save(owner, games);
    return { id, name, system };
  });
}
export async function file(owner, id) {
  const g = (await load(owner)).find((x) => x.id === id);
  if (!g) throw bad('not found', 404);
  return { file: path.join(lockerOf(owner), `${g.id}.rom`), name: `${g.name}.${g.ext}` };
}
export function remove(owner, id) {
  return locked(async () => {
    const games = await load(owner);
    const g = games.find((x) => x.id === id);
    if (!g) throw bad('not found', 404);
    await fs.rm(path.join(lockerOf(owner), `${g.id}.rom`), { force: true });
    await save(owner, games.filter((x) => x.id !== id));
    return { ok: true };
  });
}
