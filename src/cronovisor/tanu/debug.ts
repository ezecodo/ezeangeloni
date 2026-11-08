// Dev only (`?tanu`): a small panel to ask Tanu for each action by hand and to ride along with her.
// Imported behind import.meta.env.DEV, so the build leaves it out.
import type { Tanu, Emotion } from './tanu';

export function tanuPanel(tanu: Tanu, opts: { barrios: () => string[]; follow: (on: boolean) => void }){ // follow: the same ride along as clicking her name
  const el = document.createElement('div');
  el.id = 'tanu-debug';
  el.style.cssText = 'position:fixed;left:12px;bottom:56px;z-index:60;background:rgba(8,8,16,.9);border:1px solid rgba(240,237,232,.2);padding:10px;font:10px "DM Mono",monospace;letter-spacing:.08em;color:#f0ede8;display:flex;flex-direction:column;gap:6px;max-width:260px';
  const row = () => { const r = document.createElement('div'); r.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px'; el.appendChild(r); return r; };
  const btn = (r: HTMLElement, label: string, fn: () => unknown, title = '') => {
    const b = document.createElement('button');
    b.textContent = label; b.title = title;
    b.style.cssText = 'background:none;border:1px solid rgba(240,237,232,.25);color:inherit;font:inherit;padding:4px 6px;cursor:pointer;text-transform:uppercase';
    b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
    r.appendChild(b);
  };
  const state = document.createElement('div');
  state.style.color = '#6ef9f5';
  el.appendChild(state);
  let following = false;
  const r0 = row();
  btn(r0, 'ride along', () => { following = !following; opts.follow(following); }, 'the camera follows her (orbit with the mouse)');
  const r1 = row();
  btn(r1, '→ logo', () => tanu.swimTo('logo'));
  btn(r1, '→ barrio', () => { const b = opts.barrios(); tanu.swimTo(b[Math.floor(Math.random()*b.length)]); });
  btn(r1, '→ sun', () => tanu.swimTo('sun'));
  btn(r1, '→ gas', () => tanu.swimTo('gas-0'));
  btn(r1, '→ balloon', () => tanu.swimTo('balloon'));
  const r2 = row();
  btn(r2, 'look at balloon', () => tanu.lookAt('balloon'));
  const r3 = row();
  for(const e of ['calm', 'curious', 'joyful', 'nostalgic'] as Emotion[]) btn(r3, `sing ${e}`, () => tanu.sing(e), 'stage B');
  const r4 = row();
  btn(r4, 'blow', () => tanu.blowConstellation('test'), 'stage C');
  btn(r4, '→ tanu', () => tanu.transform('tanu'), 'stage D');
  btn(r4, '→ whale', () => tanu.transform('whale'), 'stage D');
  document.body.appendChild(el);
  const tick = () => {
    const p = tanu.position;
    state.textContent = `${tanu.state} · ${tanu.mood} · ${tanu.form} · ${p.x.toFixed(0)}, ${p.y.toFixed(0)}, ${p.z.toFixed(0)}`;
    requestAnimationFrame(tick);
  };
  tick();
  (window as any).__tanu = tanu;
}
