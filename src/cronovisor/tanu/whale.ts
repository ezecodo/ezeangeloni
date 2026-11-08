// The whale's body, made in code (no model, nothing borrowed): a humpback's shape, length 1 along +z (head at +z),
// with the long knobbed pectoral fins and the notched, serrated flukes. Every vertex carries where it sits along the
// body (`aS`, 0 head → 1 tail, a little more on the flukes), what it belongs to (`aKind`: 0 body, 1 fin, 2 fluke),
// how far out along a fin (`aT`), across it (`aC`, 1 at the leading edge) and which side (`aSide`), so the skin
// shader can swim and paint it in one draw.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeSkin } from './skin';

// radius along the body: a rounded snout, the deep chest of a humpback, a long narrowing tail stock
const PROFILE: [number, number][] = [[0, 0], [.012, .026], [.03, .046], [.06, .066], [.1, .084], [.16, .1], [.24, .112], [.32, .116], [.42, .11], [.52, .096], [.62, .076], [.72, .054], [.8, .037], [.88, .024], [.94, .018], [.975, .012], [1, 0]];
export function radiusAt(s: number){
  for(let i = 1; i < PROFILE.length; i++){
    const [s1, r1] = PROFILE[i];
    if(s <= s1){
      const [s0, r0] = PROFILE[i-1];
      const t = (s - s0)/(s1 - s0), e = t*t*(3 - 2*t);
      return r0 + (r1 - r0)*e;
    }
  }
  return 0;
}
const zAt = (s: number) => .5 - s;

type Part = { pos: number[]; s: number[]; kind: number[]; t: number[]; side: number[]; c: number[]; idx: number[] };
const part = (): Part => ({ pos: [], s: [], kind: [], t: [], side: [], c: [], idx: [] });
function toGeometry(p: Part){
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p.pos, 3));
  g.setAttribute('aS', new THREE.Float32BufferAttribute(p.s, 1));
  g.setAttribute('aKind', new THREE.Float32BufferAttribute(p.kind, 1));
  g.setAttribute('aT', new THREE.Float32BufferAttribute(p.t, 1));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(p.side, 1));
  g.setAttribute('aC', new THREE.Float32BufferAttribute(p.c, 1));
  g.setIndex(p.idx);
  g.computeVertexNormals();
  return g;
}

function body(){
  const NS = 90, NA = 30, p = part();
  for(let i = 0; i <= NS; i++){
    // more rings at the head and tail, where the shape turns fastest
    const u = i/NS, s = u < .5 ? .5*Math.pow(2*u, 1.35) : 1 - .5*Math.pow(2*(1 - u), 1.25);
    const r = radiusAt(s);
    for(let j = 0; j <= NA; j++){
      const th = j/NA*Math.PI*2, c = Math.cos(th), sn = Math.sin(th);
      // a little wider than tall, the belly flatter than the back, and a small dorsal hump two thirds back
      const hump = .022*Math.exp(-Math.pow((s - .66)/.035, 2))*Math.pow(Math.max(0, c), 10);
      const x = sn*r*1.06, y = c > 0 ? c*r*.96 + hump : c*r*.84;
      p.pos.push(x, y, zAt(s));
      p.s.push(s); p.kind.push(0); p.t.push(0); p.side.push(Math.sign(sn)); p.c.push(0);
    }
  }
  for(let i = 0; i < NS; i++) for(let j = 0; j < NA; j++){
    const a = i*(NA + 1) + j, b = a + NA + 1;
    p.idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = toGeometry(p);
  // the seam where the ring closes: the same point twice, given one normal so no line shows
  const n = g.getAttribute('normal') as THREE.BufferAttribute, v = new THREE.Vector3(), w = new THREE.Vector3();
  for(let i = 0; i <= NS; i++){
    const a = i*(NA + 1), b = a + NA;
    v.fromBufferAttribute(n, a).add(w.fromBufferAttribute(n, b)).normalize();
    n.setXYZ(a, v.x, v.y, v.z); n.setXYZ(b, v.x, v.y, v.z);
  }
  return g;
}

// a thin two-sided blade: `at(u, v)` gives the midsurface, `thick(u, v)` half its thickness along `normal(u)`
function blade(nu: number, nv: number, at: (u: number, v: number) => THREE.Vector3, normal: (u: number, v: number) => THREE.Vector3, thick: (u: number, v: number) => number, attrs: (u: number, v: number) => [number, number, number, number]){
  const p = part();
  for(const sheet of [1, -1]){
    const base = p.pos.length/3;
    for(let i = 0; i <= nu; i++) for(let j = 0; j <= nv; j++){
      const u = i/nu, v = j/nv;
      const q = at(u, v).addScaledVector(normal(u, v), thick(u, v)*sheet);
      p.pos.push(q.x, q.y, q.z);
      const [s, kind, t, side] = attrs(u, v);
      p.s.push(s); p.kind.push(kind); p.t.push(t); p.side.push(side); p.c.push(v);
    }
    for(let i = 0; i < nu; i++) for(let j = 0; j < nv; j++){
      const a = base + i*(nv + 1) + j, b = a + nv + 1;
      if(sheet > 0) p.idx.push(a, b, a + 1, a + 1, b, b + 1);
      else p.idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  return toGeometry(p);
}

// the pectoral fins, a third of the body long, the leading edge knobbed (the humpback's tubercles)
function fin(side: number){
  const S = .27, r = radiusAt(S);
  const root = new THREE.Vector3(side*r*.86, -r*.42, zAt(S));
  const dir = new THREE.Vector3(side*.7, -.55, -.42).normalize(); // hanging, as a humpback's
  const fwd = new THREE.Vector3(0, 0, 1);
  const chordDir = fwd.clone().addScaledVector(dir, -dir.dot(fwd)).normalize();
  const nrm = new THREE.Vector3().crossVectors(dir, chordDir).normalize();
  const LEN = .37;
  const chord = (t: number) => .078*(1 - .58*t)*Math.sqrt(Math.max(0, 1 - Math.pow(t, 6)));
  const bumps = (t: number) => t > .12 ? .0055*Math.max(0, Math.sin(t*44)) : 0;
  return blade(26, 10,
    (t, v) => {
      const u = v - .5, c = chord(t);
      return root.clone().addScaledVector(dir, t*LEN).addScaledVector(chordDir, u*c + (u > 0 ? bumps(t)*u*2 : 0));
    },
    () => nrm,
    (t, v) => .011*(1 - t*.72)*(1 - Math.pow(2*v - 1, 2)) + .0008,
    (t) => [S, 1, t, side]);
}

// the flukes: wide, swept back, a notch in the middle and a serrated trailing edge
function flukes(){
  const up = new THREE.Vector3(0, 1, 0);
  const lead = (q: number) => -.474 - .078*q*q;
  const trail = (q: number) => -.516 - .044*q*q + .024*Math.exp(-q*q*90) + .0035*Math.sin(q*52)*(1 - q*q);
  return blade(44, 8,
    (u, v) => {
      const q = u*2 - 1;
      return new THREE.Vector3(q*.175, 0, lead(q) + (trail(q) - lead(q))*v);
    },
    () => up,
    (u, v) => { const q = u*2 - 1; return .009*(1 - v)*Math.sqrt(Math.max(0, 1 - q*q)) + .0012; },
    (u, v) => { const q = u*2 - 1; const z = lead(q) + (trail(q) - lead(q))*v; return [.5 - z, 2, v, Math.sign(q)]; });
}

export function buildWhale(){
  const geo = mergeGeometries([body(), fin(1), fin(-1), flukes()])!;
  geo.computeBoundingSphere();
  geo.boundingSphere!.radius += .15; // room for the swimming wave
  const skin = makeSkin();
  const S = .13, r = radiusAt(S), th = 1.78; // the eyes: low on the sides, just behind the mouth's corner
  skin.uniforms.uEye.value.set(Math.sin(th)*r*1.06, Math.cos(th)*r*.84, zAt(S));
  const mesh = new THREE.Mesh(geo, skin.mat);
  return { mesh, skin };
}
// where things are on the body, in its own space (length 1)
export const FLUKE_AT = new THREE.Vector3(0, 0, -.53);
export const BLOWHOLE_AT = new THREE.Vector3(0, radiusAt(.2)*.96, zAt(.2));
