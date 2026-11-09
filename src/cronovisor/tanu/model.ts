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
  eye: THREE.Vector3;       // the right eye's socket (x > 0): open holes in the model, closed by a cap painted as an eye
  eyeR: number;             // its radius
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
  // The eyes: the model leaves them as two open holes in the head (its eyeballs weren't part of it), and through
  // them one saw the inside of the head. They're found as the mesh's open edges (edges only one triangle uses,
  // once vertices on UV seams are welded) and closed with a cap made of the rim's own points, swelling a little
  // outwards like an eye under its lid: it fits exactly, and breathes and bends with the skin, being part of it.
  // `aKind` 3, `aC` 1 at its centre (the pupil) and 0 at the rim; the skin shader paints it as an eye.
  const v = (i: number) => new THREE.Vector3(pos[i*3], pos[i*3 + 1], pos[i*3 + 2]);
  let eye = new THREE.Vector3(.087, .02, .25), eyeR = .011;
  const extra = { pos: [] as number[], nor: [] as number[], s: [] as number[], c: [] as number[], side: [] as number[], idx: [] as number[] };
  {
    const idx = src.index ? Array.from(src.index.array) : Array.from({ length: n }, (_, i) => i);
    const weld = new Map<string, number>(), w: number[] = [];
    for (let i = 0; i < n; i++) { const k = `${pos[i*3].toFixed(5)},${pos[i*3 + 1].toFixed(5)},${pos[i*3 + 2].toFixed(5)}`; if (!weld.has(k)) weld.set(k, i); w.push(weld.get(k)!); }
    const edges = new Map<string, number>();
    for (let t = 0; t < idx.length; t += 3) for (const [a, b] of [[idx[t], idx[t + 1]], [idx[t + 1], idx[t + 2]], [idx[t + 2], idx[t]]]) {
      const u = w[a], vv = w[b], k = u < vv ? `${u}_${vv}` : `${vv}_${u}`;
      edges.set(k, (edges.get(k) || 0) + 1);
    }
    const next = new Map<number, number[]>();
    for (const [k, c] of edges) if (c === 1) { const [a, b] = k.split('_').map(Number); next.set(a, [...(next.get(a) || []), b]); next.set(b, [...(next.get(b) || []), a]); }
    for (const side of [1, -1]) {
      const ids = [...next.keys()].filter((i) => Math.sign(pos[i*3]) === side && aS[i] < .4);
      if (ids.length < 4) continue;
      // walk round the rim in order
      const ring = [ids[0]];
      while (ring.length < ids.length) {
        const nb = (next.get(ring[ring.length - 1]) || []).find((x) => !ring.includes(x) && ids.includes(x));
        if (nb === undefined) break;
        ring.push(nb);
      }
      const centre = ring.reduce((a, i) => a.add(v(i)), new THREE.Vector3()).divideScalar(ring.length);
      const r = Math.max(...ring.map((i) => v(i).distanceTo(centre)));
      if (side > 0) { eye = centre.clone(); eyeR = r; }
      const out = new THREE.Vector3(side, 0, 0);
      const base = n + extra.pos.length/3;
      for (const i of ring) {
        const p = v(i), radial = p.clone().sub(centre).normalize();
        const nn = out.clone().multiplyScalar(.75).addScaledVector(radial, .65).normalize();
        extra.pos.push(p.x, p.y, p.z); extra.nor.push(nn.x, nn.y, nn.z); extra.s.push(aS[i]); extra.c.push(0); extra.side.push(side);
      }
      const tip = centre.clone().addScaledVector(out, r*.28); // the eye swells a little beyond the rim
      extra.pos.push(tip.x, tip.y, tip.z); extra.nor.push(side, 0, 0); extra.s.push(.5 - centre.z); extra.c.push(1); extra.side.push(side);
      const mid = base + ring.length;
      for (let k = 0; k < ring.length; k++) extra.idx.push(mid, base + k, base + (k + 1) % ring.length);
    }
  }
  const total = n + extra.pos.length/3;
  const grow = (a: Float32Array, add: number[], k = 1) => { const b = new Float32Array(total*k); b.set(a); b.set(add, a.length); return b; };
  const zeros = (k: number) => new Array((total - n)*k).fill(0);
  const posAll = grow(pos, extra.pos, 3), norAll = grow(nor, extra.nor, 3);
  const aSAll = grow(aS, extra.s), aKindAll = grow(aKind, new Array(total - n).fill(3)), aTAll = grow(aT, zeros(1)), aCAll = grow(aC, extra.c), aSideAll = grow(aSide, extra.side);
  // (read point by point: the model's attributes are interleaved, so `.array` is the whole shared buffer; copying
  // it as UVs gave garbage coordinates, the relief turned some pixels NaN and the bloom blacked out whole frames)
  const uvSrc = src.getAttribute('uv') as THREE.BufferAttribute | THREE.InterleavedBufferAttribute | undefined;
  let uvAll: Float32Array | null = null;
  if (uvSrc) { uvAll = new Float32Array(total*2); for (let i = 0; i < n; i++) { uvAll[i*2] = uvSrc.getX(i); uvAll[i*2 + 1] = uvSrc.getY(i); } }
  const indexAll = [...(src.index ? Array.from(src.index.array) : Array.from({ length: n }, (_, i) => i)), ...extra.idx];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(posAll, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(norAll, 3));
  if (uvAll) g.setAttribute('uv', new THREE.BufferAttribute(uvAll, 2));
  g.setAttribute('aS', new THREE.BufferAttribute(aSAll, 1));
  g.setAttribute('aKind', new THREE.BufferAttribute(aKindAll, 1));
  g.setAttribute('aT', new THREE.BufferAttribute(aTAll, 1));
  g.setAttribute('aC', new THREE.BufferAttribute(aCAll, 1));
  g.setAttribute('aSide', new THREE.BufferAttribute(aSideAll, 1));
  g.setIndex(indexAll);
  g.computeBoundingSphere();
  g.boundingSphere!.radius += .15; // room for the swimming wave

  const avg = (pick: (i: number) => boolean) => {
    const a = new THREE.Vector3(); let k = 0;
    for (let i = 0; i < n; i++) if (pick(i)) { a.add(v(i)); k++; }
    return k ? a.divideScalar(k) : a;
  };
  const finRoot = avg((i) => aKind[i] === 1 && aSide[i] > 0 && aT[i] < .08);
  let blowhole = new THREE.Vector3(0, .05, .3), top = -Infinity;
  for (let i = 0; i < n; i++) if (aS[i] > .18 && aS[i] < .23 && Math.abs(pos[i*3]) < .02 && pos[i*3 + 1] > top) { top = pos[i*3 + 1]; blowhole = v(i); }
  const fluke = avg((i) => aKind[i] === 2 && aS[i] > .97 && Math.abs(pos[i*3]) < .03);
  return { geometry: g, normalMap: mat?.normalMap ?? null, finRoot, eye, eyeR, blowhole, fluke, flukeS: FLUKES, finRest: -.72 };
}
