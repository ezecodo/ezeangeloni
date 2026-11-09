// The games room's emulator (EmulatorJS, GPL-3, from npm) goes into public/emulator/ before every dev and build,
// so it's served from Eze's own server, never from a CDN. Its scripts are joined into emulator.min.js (that's the
// file its loader asks for; without it it falls back to its debug mode, which also asks a CDN for updates).
// Only the cores Eze plays are copied: SNES (snes9x) and Mega Drive (genesis_plus_gx).
// No game is ever here: each player keeps their own in their own private locker (apps/uploader/games.js).
import { cpSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, readdirSync } from 'fs';
import path from 'path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = path.join(root, 'node_modules/@emulatorjs/emulatorjs/data');
const out = path.join(root, 'public/emulator/data');
const CORES = ['snes9x', 'genesis_plus_gx'];

if (!existsSync(src)) { console.warn('[emulator] @emulatorjs/emulatorjs not installed, skipping'); process.exit(0); }
rmSync(path.join(root, 'public/emulator'), { recursive: true, force: true });
mkdirSync(path.join(out, 'cores/reports'), { recursive: true });
for (const d of ['compression', 'localization']) if (existsSync(path.join(src, d))) cpSync(path.join(src, d), path.join(out, d), { recursive: true });
cpSync(path.join(src, 'loader.js'), path.join(out, 'loader.js'));
cpSync(path.join(src, 'version.json'), path.join(out, 'version.json'));
// the same order its loader uses in debug mode
const scripts = ['emulator.js', 'nipplejs.js', 'shaders.js', 'storage.js', 'gamepad.js', 'GameManager.js', 'socket.io.min.js', 'compression.js'];
writeFileSync(path.join(out, 'emulator.min.js'), scripts.map((f) => readFileSync(path.join(src, 'src', f), 'utf-8')).join('\n;\n'));
writeFileSync(path.join(out, 'emulator.min.css'), readFileSync(path.join(src, 'emulator.css'), 'utf-8'));
for (const c of CORES) {
  const dir = path.join(root, 'node_modules/@emulatorjs', `core-${c}`);
  for (const f of readdirSync(dir)) if (f.endsWith('.data')) cpSync(path.join(dir, f), path.join(out, 'cores', f));
  const rep = path.join(dir, 'reports');
  if (existsSync(rep)) for (const f of readdirSync(rep)) cpSync(path.join(rep, f), path.join(out, 'cores/reports', f));
}
cpSync(path.join(root, 'node_modules/@emulatorjs/emulatorjs/LICENSE'), path.join(root, 'public/emulator/LICENSE.txt'));
console.log(`[emulator] EmulatorJS + ${CORES.join(', ')} → public/emulator/`);
