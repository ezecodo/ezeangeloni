// Tanu's body from a sculpted model (Eze, 2026-11-09: "Game-ready Humpback Whale" by Allie2k, CC Attribution,
// https://sketchfab.com/3d-models/game-ready-humpback-whale-da07e3ff73914ff28d2b8cf9da794036; credited in the about
// sheet). Its 5k triangles carry the sculpture's relief in a normal map; its colours are left out, the skin shader
// paints her. The mesh is turned into the procedural body's convention, so the swim, the rowing fins and the paint
// work on it unchanged: length 1 along +z (head at +z, z = .5 - s), and per vertex `aS` (0 head → 1 tail),
// `aKind` (0 body, 1 pectoral fin, 2 flukes), `aT` (out along a fin), `aC` (across it, 1 at the leading edge), `aSide`.
//
// The model as exported: x across (the fins reach ±14.4), y along (head at −22.3, fluke tips at 29.6), z up.
// Its fins hang out between y −8.4 and 1.6 beyond the flank (|x| > 4.9 there); the flukes start at s ≈ .83.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const FIN_FROM = .26, FIN_TO = .47, FLANK = 4.9, FLUKES = .83;

export interface WhaleModel {
  geometry: THREE.BufferGeometry;
  normalMap: THREE.Texture | null;
  finRoot: THREE.Vector3;   // the right fin's hinge
  eye: THREE.Vector3;       // the right eye (x > 0)
  blowhole: THREE.Vector3;
  fluke: THREE.Vector3;     // the middle of the flukes' trailing edge
  flukeS: number;           // where along the body the flukes begin
  finRest: number;          // the sculpture holds its fins straight out: let them down this much (radians)
}

export async function loadWhale(url: string): Promise<WhaleModel> {
  const gltf = await new GLTFLoader().loadAsync(url);
  let mesh: THREE.Mesh | null = null;
  gltf.scene.traverse((o) => { if (!mesh && (o as THREE.Mesh).isMesh) mesh = o as THREE.Mesh; });
  if (!mesh) throw new Error('no mesh in the whale model');
  const src = (mesh as THREE.Mesh).geometry;
  const mat = (mesh as THREE.Mesh).material as THREE.MeshStandardMaterial;
  const P = src.getAttribute('position'), Nr = src.getAttribute('normal');
  const n = P.count;
  let yMin = Infinity, yMax = -Infinity;
  for (let i = 0; i < n; i++) { yMin = Math.min(yMin, P.getY(i)); yMax = Math.max(yMax, P.getY(i)); }
  const L = yMax - yMin;
  const sOf = (y: number) => (y - yMin)/L;
  // the body's axis height: the middle of its deepest part (chest to navel), away from the fins
  let zLo = Infinity, zHi = -Infinity;
  for (let i = 0; i < n; i++) {
    const s = sOf(P.getY(i));
    if (s > .15 && s < .25 && Math.abs(P.getX(i)) < 3) { zLo = Math.min(zLo, P.getZ(i)); zHi = Math.max(zHi, P.getZ(i)); }
  }
  const zc = (zLo + zHi)/2;
  const pos = new Float32Array(n*3), nor = new Float32Array(n*3);
  const aS = new Float32Array(n), aKind = new Float32Array(n), aT = new Float32Array(n), aC = new Float32Array(n), aSide = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), s = sOf(y);
    pos[i*3] = x/L; pos[i*3 + 1] = (z - zc)/L; pos[i*3 + 2] = .5 - s;          // (x, z, −y): a proper rotation
    nor[i*3] = Nr.getX(i); nor[i*3 + 1] = Nr.getZ(i); nor[i*3 + 2] = -Nr.getY(i);
    aS[i] = s; aSide[i] = x >= 0 ? 1 : -1;
    if (s > FIN_FROM && s < FIN_TO && Math.abs(x) > FLANK) {
      aKind[i] = 1; aT[i] = (Math.abs(x) - FLANK)/(14.45 - FLANK);
    } else if (s > FLUKES) aKind[i] = 2;
  }
  // across each fin: 1 at its leading edge (towards the head), 0 at the trailing one, in slices out along it
  for (const side of [1, -1]) {
    const lo = new Array(12).fill(Infinity), hi = new Array(12).fill(-Infinity);
    const bin = (i: number) => Math.min(11, Math.floor(aT[i]*12));
    for (let i = 0; i < n; i++) if (aKind[i] === 1 && aSide[i] === side) { const b = bin(i); lo[b] = Math.min(lo[b], pos[i*3 + 2]); hi[b] = Math.max(hi[b], pos[i*3 + 2]); }
    for (let i = 0; i < n; i++) if (aKind[i] === 1 && aSide[i] === side) { const b = bin(i); aC[i] = hi[b] > lo[b] ? (pos[i*3 + 2] - lo[b])/(hi[b] - lo[b]) : .5; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (src.getAttribute('uv')) g.setAttribute('uv', src.getAttribute('uv'));
  g.setAttribute('aS', new THREE.BufferAttribute(aS, 1));
  g.setAttribute('aKind', new THREE.BufferAttribute(aKind, 1));
  g.setAttribute('aT', new THREE.BufferAttribute(aT, 1));
  g.setAttribute('aC', new THREE.BufferAttribute(aC, 1));
  g.setAttribute('aSide', new THREE.BufferAttribute(aSide, 1));
  if (src.index) g.setIndex(src.index);
  g.computeBoundingSphere();
  g.boundingSphere!.radius += .15; // room for the swimming wave

  const v = (i: number) => new THREE.Vector3(pos[i*3], pos[i*3 + 1], pos[i*3 + 2]);
  const avg = (pick: (i: number) => boolean) => {
    const a = new THREE.Vector3(); let k = 0;
    for (let i = 0; i < n; i++) if (pick(i)) { a.add(v(i)); k++; }
    return k ? a.divideScalar(k) : a;
  };
  const finRoot = avg((i) => aKind[i] === 1 && aSide[i] > 0 && aT[i] < .08);
  // the eye: the outermost point of the head's side, a little below the middle, about an eighth of the way back
  let eye = new THREE.Vector3(.06, -.01, .37), best = -Infinity;
  for (let i = 0; i < n; i++) {
    if (aS[i] < .1 || aS[i] > .16 || pos[i*3] <= 0) continue;
    const score = pos[i*3] - 3*Math.abs(pos[i*3 + 1] + .012);
    if (score > best) { best = score; eye = v(i); }
  }
  let blowhole = new THREE.Vector3(0, .05, .3), top = -Infinity;
  for (let i = 0; i < n; i++) if (aS[i] > .18 && aS[i] < .23 && Math.abs(pos[i*3]) < .02 && pos[i*3 + 1] > top) { top = pos[i*3 + 1]; blowhole = v(i); }
  const fluke = avg((i) => aKind[i] === 2 && aS[i] > .97 && Math.abs(pos[i*3]) < .03);
  return { geometry: g, normalMap: mat?.normalMap ?? null, finRoot, eye, blowhole, fluke, flukeS: FLUKES, finRest: -.72 };
}
