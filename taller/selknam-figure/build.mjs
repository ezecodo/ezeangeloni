#!/usr/bin/env node
// A figure in the language of the Selk'nam Hain spirits' body paint (Eze, 2026-11-09): a tall bell-shaped body
// painted in red panels, each with a column of white dots, between white stripes edged in black; a white band at
// the neck; a black domed head with white dots down its front; two short dark legs beneath. Built in code and
// written as a GLB (geometry + one painted texture per part), so it opens anywhere (Blender, three.js, viewers).
// Not in the universe yet: it lives in the workshop (taller/, `npm run taller`).
//
//   node taller/selknam-figure/build.mjs         → taller/selknam-figure/selknam-figure.glb
import * as THREE from 'three';
import { Document, NodeIO } from '@gltf-transform/core';
import { deflateSync } from 'zlib';
import { writeFileSync } from 'fs';
import path from 'path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(HERE, 'selknam-figure.glb');

// ── proportions (height 1) ──
const HEM = 0, NECK = .62, BAND = .028, TOP = 1.1;
const bodyR = (y) => .36 - .09*Math.pow(y/NECK, 1.3);       // a bell, widest at the hem
const HEAD_R = bodyR(NECK) - .004;
// the head: a tall cone, its sides gently swelling, the tip just rounded (Eze: "not so round, more triangular")
const headR = (t) => Math.max(1e-4, HEAD_R*(1 - t)*(1 + .22*Math.sin(Math.PI*t))*Math.min(1, (1 - t)*14 + .25));
const PANELS = 8;                                               // red panels round the body

// ── colours ──
const RED = [168, 50, 43], BLACK = [30, 26, 26], WHITE = [240, 237, 232], DARK = [42, 36, 32];

// ── a tiny painter: RGBA pixels → PNG ──
function canvas(w, h, fill){
  const px = new Uint8Array(w*h*4);
  for(let i = 0; i < w*h; i++){ px[i*4] = fill[0]; px[i*4 + 1] = fill[1]; px[i*4 + 2] = fill[2]; px[i*4 + 3] = 255; }
  const set = (x, y, c, a = 1) => {
    x = ((x % w) + w) % w; if(y < 0 || y >= h) return;
    const i = (y*w + x)*4;
    for(let k = 0; k < 3; k++) px[i + k] = Math.round(px[i + k]*(1 - a) + c[k]*a);
  };
  return {
    w, h, px,
    rect(x0, y0, x1, y1, c){ for(let y = Math.floor(y0); y < Math.ceil(y1); y++) for(let x = Math.floor(x0); x < Math.ceil(x1); x++) set(x, y, c); },
    // an antialiased disc, squeezed horizontally by `sx` (to stay round on a narrowing body)
    disc(cx, cy, r, c, sx = 1){
      for(let y = Math.floor(cy - r - 2); y <= cy + r + 2; y++) for(let x = Math.floor(cx - r/sx - 2); x <= cx + r/sx + 2; x++){
        const d = Math.hypot((x + .5 - cx)*sx, y + .5 - cy);
        const a = Math.max(0, Math.min(1, r + .5 - d));
        if(a > 0) set(x, y, c, a);
      }
    },
  };
}
function png(cv){
  const { w, h, px } = cv;
  const raw = Buffer.alloc((w*4 + 1)*h);
  for(let y = 0; y < h; y++){ raw[y*(w*4 + 1)] = 0; Buffer.from(px.buffer, y*w*4, w*4).copy(raw, y*(w*4 + 1) + 1); }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for(let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for(const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const t = Buffer.from(type); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// ── the paint ──
// A lathe's texture: u goes round (u = 0 at the front, +z), v up its profile (v = 0 at the first point).
// The body's profile runs from the hem up, so the image's first row is the hem.
// (a dot stays round on the surface: across, a pixel covers 2πR/W of the body at that height; up, height/H)
const squeeze = (W, H, height, R) => (H/height)/(W/(2*Math.PI*R));
function bodyPaint(){
  const W = 2048, H = 640, cv = canvas(W, H, RED), pw = W/PANELS;
  for(let k = 0; k < PANELS; k++){
    // between two panels (k − ½ and k + ½ of a panel from the front): black, white, black
    const x = (k + .5)*pw;
    cv.rect(x - 22, 0, x - 13, H, BLACK);
    cv.rect(x - 13, 0, x + 13, H, WHITE);
    cv.rect(x + 13, 0, x + 22, H, BLACK);
    // a column of white dots down the middle of the panel (the front panel is centred on u = 0)
    const cx = k*pw;
    for(let j = 0; j < 9; j++){
      const v = (j + .55)/9.3;
      cv.disc(cx, v*H, 17, WHITE, squeeze(W, H, NECK - HEM, bodyR(HEM + v*(NECK - HEM))));
    }
  }
  cv.rect(0, 0, W, 10, BLACK); // the hem
  return cv;
}
function headPaint(){
  const W = 1024, H = 512, cv = canvas(W, H, BLACK);
  // white dots down the front of the dome, and the back (smaller as the dome narrows towards the top)
  const y0 = NECK + BAND, height = TOP - y0;
  for(const cx of [0, W/2]) for(let j = 0; j < 3; j++){
    const v = .16 + j*.2, r = 30 - j*3;
    cv.disc(cx, v*H, r, WHITE, squeeze(W, H, height, Math.max(.03, headR(v))));
  }
  return cv;
}

// ── the shapes ──
function lathe(profile, seg = 96){ return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg); }
function body(){
  const pts = [];
  for(let i = 0; i <= 60; i++){ const y = HEM + (NECK - HEM)*i/60; pts.push([bodyR(y), y]); }
  return lathe(pts);
}
function band(){
  const r = bodyR(NECK) + .006;
  return lathe([[r - .012, NECK - .004], [r, NECK], [r, NECK + BAND], [r - .012, NECK + BAND + .004]]);
}
function head(){
  const pts = [], y0 = NECK + BAND;
  for(let i = 0; i <= 48; i++){ const t = i/48; pts.push([headR(t), y0 + (TOP - y0)*t]); }
  return lathe(pts);
}
// a leg hangs from its hip at the origin (so it can swing from there), the foot forward
// (in two parts, so the knee can bend: the thigh hangs from the hip, the shin and foot from the knee)
const HIP_Y = .07, HIP_X = .078, THIGH = .13;
function thigh(){
  const g = new THREE.CylinderGeometry(.04, .038, THIGH, 20);
  g.translate(0, -THIGH/2, 0);
  const knee = new THREE.SphereGeometry(.038, 20, 12); // the joint, so no gap shows as it bends
  knee.translate(0, -THIGH, 0);
  return mergeTwo(g, knee);
}
function shin(){
  const g = new THREE.CylinderGeometry(.037, .042, .12, 20);
  g.translate(0, -.06, 0);
  const foot = new THREE.SphereGeometry(.047, 20, 12);
  foot.scale(1, .55, 1.5); foot.translate(0, -.12, .024);
  return mergeTwo(g, foot);
}
function mergeTwo(a, b){
  const ai = a.index ? a : a, bi = b;
  const pos = [...a.attributes.position.array, ...bi.attributes.position.array];
  const nor = [...a.attributes.normal.array, ...bi.attributes.normal.array];
  const uv = [...a.attributes.uv.array, ...bi.attributes.uv.array];
  const off = a.attributes.position.count;
  const idx = [...a.index.array, ...[...bi.index.array].map((i) => i + off)];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// ── walking ──
// A cycle in place, 1.2 s, looped: the legs swing from the hips in turn (the foot coming forward lifts a little);
// the body under its mantle rises and settles with each step, leans onto the leg it stands on and turns its
// shoulders a touch. Slow and grave, as a spirit walks. Saved in the GLB as the animation "walk".
const CYCLE = 1.2, SAMPLES = 48;
function walk(doc, buffer, torso, hipL, hipR, kneeL, kneeR){
  const q = (x, y, z) => { const e = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z, 'YXZ')); return [e.x, e.y, e.z, e.w]; };
  const times = [], tor = [], torPos = [], legL = [], legR = [], posL = [], posR = [], knL = [], knR = [];
  for(let i = 0; i <= SAMPLES; i++){
    const t = CYCLE*i/SAMPLES, p = 2*Math.PI*i/SAMPLES;
    times.push(t);
    const swing = .36*Math.sin(p);
    legL.push(...q(swing, 0, 0)); legR.push(...q(-swing, 0, 0));
    posL.push(-HIP_X, HIP_Y + .008*Math.max(0, -Math.cos(p)), 0);
    posR.push(HIP_X, HIP_Y + .008*Math.max(0, Math.cos(p)), 0);
    // the knee: bent as the leg swings through (the foot clears the ground), straightening to land; standing,
    // it stays a little soft, never locked
    const knee = (c) => .1 + .52*Math.pow(Math.max(0, c), 1.3);
    knL.push(...q(knee(-Math.cos(p)), 0, 0)); knR.push(...q(knee(Math.cos(p)), 0, 0));
    tor.push(...q(.03, .035*Math.sin(p), .045*Math.sin(p)));
    torPos.push(0, .008*Math.cos(2*p), 0);
  }
  const acc = (type, arr) => doc.createAccessor().setType(type).setArray(new Float32Array(arr)).setBuffer(buffer);
  const input = acc('SCALAR', times);
  const anim = doc.createAnimation('walk');
  const channel = (node, path, type, values) => {
    const sampler = doc.createAnimationSampler().setInput(input).setOutput(acc(type, values)).setInterpolation('LINEAR');
    anim.addSampler(sampler).addChannel(doc.createAnimationChannel().setTargetNode(node).setTargetPath(path).setSampler(sampler));
  };
  channel(hipL, 'rotation', 'VEC4', legL); channel(hipR, 'rotation', 'VEC4', legR);
  channel(hipL, 'translation', 'VEC3', posL); channel(hipR, 'translation', 'VEC3', posR);
  channel(kneeL, 'rotation', 'VEC4', knL); channel(kneeR, 'rotation', 'VEC4', knR);
  channel(torso, 'rotation', 'VEC4', tor); channel(torso, 'translation', 'VEC3', torPos);
}

// ── the GLB ──
async function build(){
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene('Selknam figure');
  const root = doc.createNode('selknam-figure');
  scene.addChild(root);
  const texture = (name, cv) => doc.createTexture(name).setImage(png(cv)).setMimeType('image/png');
  const material = (name, opts) => {
    const m = doc.createMaterial(name).setRoughnessFactor(.85).setMetallicFactor(0).setDoubleSided(true);
    if(opts.map) m.setBaseColorTexture(opts.map);
    if(opts.color) m.setBaseColorFactor([...opts.color.map((c) => Math.pow(c/255, 2.2)), 1]);
    return m;
  };
  const torso = doc.createNode('torso');
  root.addChild(torso);
  const add = (name, geo, mat, parent = torso) => {
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(geo.attributes.position.array)).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(geo.attributes.normal.array)).setBuffer(buffer))
      .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(geo.attributes.uv.array)).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(geo.index.array)).setBuffer(buffer))
      .setMaterial(mat);
    const node = doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim));
    parent.addChild(node);
    return node;
  };
  add('body', body(), material('body paint', { map: texture('body', bodyPaint()) }));
  add('band', band(), material('white', { color: WHITE }));
  add('head', head(), material('head paint', { map: texture('head', headPaint()) }));
  const legs = material('legs', { color: DARK });
  const hipL = doc.createNode('hip-left').setTranslation([-HIP_X, HIP_Y, 0]), hipR = doc.createNode('hip-right').setTranslation([HIP_X, HIP_Y, 0]);
  root.addChild(hipL); root.addChild(hipR);
  const kneeL = doc.createNode('knee-left').setTranslation([0, -THIGH, 0]), kneeR = doc.createNode('knee-right').setTranslation([0, -THIGH, 0]);
  hipL.addChild(kneeL); hipR.addChild(kneeR);
  add('thigh-left', thigh(), legs, hipL); add('shin-left', shin(), legs, kneeL);
  add('thigh-right', thigh(), legs, hipR); add('shin-right', shin(), legs, kneeR);
  // standing on the ground: the feet's soles at y = 0
  root.setTranslation([0, .205, 0]);
  walk(doc, buffer, torso, hipL, hipR, kneeL, kneeR);
  const glb = await new NodeIO().writeBinary(doc);
  writeFileSync(OUT, glb);
  console.log(`→ ${OUT} (${(glb.length/1024).toFixed(0)} KB)`);
}

await build();
