// The workshop: every element on the list, one at a time on the stage. To add one, make taller/elements/<name>.ts
// (an Element: name, a line about it, how to set it on the stage) and add it to ELEMENTS below.
// The same viewer runs locally (taller/index.html, `npm run taller`) and on the site at /taller/ for whoever is
// signed in (src/pages/taller.astro), which calls startTaller() once the session is confirmed.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Element, Stage } from './elements/types';
import { tanu } from './elements/tanu';
import { selknamFigure } from './elements/selknam-figure';

const ELEMENTS: Element[] = [tanu, selknamFigure];

export function startTaller(){

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, innerWidth/innerHeight, .01, 2000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
let following: (() => THREE.Vector3) | null = null;
const stage: Stage = {
  scene, camera,
  look(target, from){ following = null; controls.target.copy(target); camera.position.copy(from); controls.update(); },
  follow(get){ following = get; },
  viewH: () => renderer.domElement.height,
};
let current: { update(dt: number): void; close(): void } | null = null, opening = 0;
async function open(el: Element){
  const ticket = ++opening;
  current?.close(); current = null;
  scene.background = new THREE.Color(el.background);
  document.querySelectorAll('#list button').forEach((b) => b.classList.toggle('on', (b as HTMLElement).dataset.id === el.id));
  document.getElementById('about')!.textContent = el.about;
  history.replaceState(null, '', '#' + el.id);
  const c = await el.open(stage);
  if(ticket !== opening){ c.close(); return; } // another was chosen meanwhile
  current = c;
}
const list = document.getElementById('list')!;
for(const el of ELEMENTS){
  const b = document.createElement('button');
  b.textContent = el.name; b.dataset.id = el.id;
  b.addEventListener('click', () => open(el));
  list.appendChild(b);
}
open(ELEMENTS.find((e) => '#' + e.id === location.hash) || ELEMENTS[0]);

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), .1);
  current?.update(dt);
  if(following){ // ride along: the camera keeps its distance and angle, the target moves with the element
    const d = camera.position.clone().sub(controls.target);
    controls.target.lerp(following(), 1 - Math.exp(-dt*3));
    camera.position.copy(controls.target).add(d);
  }
  controls.update();
  renderer.render(scene, camera);
});
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix(); });
(window as any).__taller = { scene, camera, controls };
}
