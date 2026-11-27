/*
 * Kintsugi, el tercer elemento (Eze, 2026-11-27): una superficie oscura (cerámica negra, piedra) agrietada, y por las
 * grietas, oro líquido. En el lenguaje del dragón: la cerámica es un negro cálido (rojizo, como la tinta del shodō) con
 * su textura; el oro brilla (resplandor), lleva la sombra oscura que lo separa de la cerámica y un filo de luz de un solo
 * lado, y se junta en pequeños charcos donde las grietas se cruzan. Estático; el movimiento previsto, en `animacion`.
 * La textura se calcula píxel a píxel una sola vez por tamaño (`cache`), y cada cuadro sólo se copia.
 */
import { C, TAU, hash, lim, type P } from '../dragon/estilo';
import type { Elemento } from './index';

const ANIMACION = 'Kintsugi (arte de reparar con oro): una textura oscura (como cerámica negra o piedra) que se agrieta y por cuyas grietas fluye oro líquido brillante. Representa perfectamente el concepto de "fusión" y lujo.';
const GRUPO = 'Kintsugi · reparar con oro';

// ruido de valor suave (para la textura), con semilla
function ruido(sem: number){
  const h = (x: number, y: number) => { const s = Math.sin(x*127.1 + y*311.7 + sem*74.7)*43758.5453; return s - Math.floor(s); };
  const sv = (t: number) => t*t*(3 - 2*t);
  const v = (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = sv(x - xi), yf = sv(y - yi);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a)*xf + (c - a)*yf + (a - b - c + d)*xf*yf;
  };
  return (x: number, y: number, oct = 4) => { let s = 0, a = .5, f = 1; for(let o = 0; o < oct; o++){ s += a*v(x*f, y*f); a *= .5; f *= 2.03; } return s; };
}

// La superficie oscura, calculada una vez: cerámica (esmalte liso con manchas y un brillo) o piedra (más granulada).
const cache = new Map<string, HTMLCanvasElement>();
function superficie(w: number, h: number, tipo: 'ceramica' | 'piedra'){
  const clave = `${tipo}:${w}x${h}`;
  if(cache.has(clave)) return cache.get(clave)!;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d')!, img = g.createImageData(w, h), n1 = ruido(tipo === 'piedra' ? 5 : 2), n2 = ruido(9);
  for(let y = 0; y < h; y++) for(let x = 0; x < w; x++){
    const u = x/w, v = y/h, k = (y*w + x)*4;
    let l: number;
    if(tipo === 'piedra'){
      l = 22 + (n1(u*5, v*4, 5) - .5)*26 + (n2(u*90, v*90, 2) - .5)*14 + (hash(x*.37 + y*1.31) < .015 ? 16 : 0);
    } else {
      // esmalte negro: manchas suaves y lentas, apenas un moteado fino
      l = 14 + (n1(u*3, v*3, 4) - .5)*14 + (n2(u*60, v*60, 2) - .5)*4;
    }
    img.data[k] = l*1.22; img.data[k + 1] = l*.86; img.data[k + 2] = l*.78; img.data[k + 3] = 255;   // negro cálido
  }
  g.putImageData(img, 0, 0);
  cache.set(clave, c);
  return c;
}

// Las grietas: caminatas que se quiebran (cambian de dirección en cada tramo) y se ramifican; cada una con su grosor,
// más grueso en el medio y fino en las puntas. `dentro` decide hasta dónde pueden ir.
// `inicio`: a qué distancia del golpe nace (en la grieta madre), para que la rotura y el oro corran en orden.
type Grieta = { pts: P[]; ancho: number; rama?: boolean; inicio: number };
function grietas(origenes: { p: P; dir: number; largo: number; ancho: number }[], sem: number, dentro: (p: P) => boolean, paso: number){
  const out: Grieta[] = [];
  const crecer = (p0: P, dir: number, largo: number, ancho: number, s: number, nivel: number, inicio = 0) => {
    const pts: P[] = [{ ...p0 }];
    let p = { ...p0 }, d = dir;
    const pasos = Math.round(largo/paso);
    for(let i = 0; i < pasos; i++){
      // casi recta, con quiebres angulosos de vez en cuando (la cerámica se parte así; curvas suaves parecían venas)
      d += (hash(s + i*1.7) - .5)*.18 + (hash(s*2.3 + i*.9) < .16 ? (hash(s + i*5.3) - .5)*1.3 : 0);
      const q = { x: p.x + Math.cos(d)*paso, y: p.y + Math.sin(d)*paso };
      if(!dentro(q)) break;
      pts.push(q); p = q;
      // ramas: a veces, hacia un lado, más cortas y finas
      if(nivel < 1 && hash(s*3.1 + i*2.3) < .05 && i > 3)
        crecer(q, d + (hash(s + i) < .5 ? -1 : 1)*(.6 + .5*hash(s*1.9 + i)), largo*(.35 + .3*hash(s + i*4.1)), ancho*.55, s*1.37 + i, nivel + 1, inicio + (i + 1)*paso);
    }
    if(pts.length > 2) out.push({ pts, ancho, rama: nivel > 0, inicio });
  };
  origenes.forEach((o, k) => crecer(o.p, o.dir, o.largo, o.ancho, sem + k*13.7, 0));
  return out;
}

// El oro en las grietas: sombra oscura debajo, oro hondo, oro claro encima con resplandor, un filo de luz de un lado;
// charcos en las uniones (donde nace cada grieta y cada rama).
// `hasta` (animación): cuántos tramos de cada grieta tienen oro ya (fraccionario; sin él, todos).
function oro(g: CanvasRenderingContext2D, gs: Grieta[], lw: number, hasta?: number[]){
  const lleno = new Map(gs.map((gr, i) => [gr, hasta ? hasta[i] : Infinity]));
  const trazo = (gr: Grieta, ancho: number, color: string, desplaza = 0) => {
    const n = gr.pts.length - 1, h = lleno.get(gr) ?? Infinity;
    for(let j = 0; j < n && j < h; j++){
      const q = j/n, w = ancho*(.35 + .65*Math.sin(Math.PI*Math.min(1, q*1.2 + .1)));   // fino en las puntas
      const a = gr.pts[j], b0 = gr.pts[j + 1], f = Math.min(1, h - j), b = { x: a.x + (b0.x - a.x)*f, y: a.y + (b0.y - a.y)*f };
      g.beginPath(); g.moveTo(a.x - desplaza, a.y - desplaza); g.lineTo(b.x - desplaza, b.y - desplaza);
      g.strokeStyle = color; g.lineWidth = w; g.stroke();
    }
  };
  g.lineCap = 'round'; g.lineJoin = 'round';
  gs = gs.map(gr => { const o = { ...gr, ancho: gr.ancho*1.45 }; lleno.set(o, lleno.get(gr)!); return o; });   // la costura dorada es la protagonista
  for(const gr of gs) trazo(gr, gr.ancho + lw*2.2, 'rgba(6,2,2,.85)');                    // la sombra que lo hunde
  g.save(); g.shadowColor = 'rgba(255,190,60,.75)'; g.shadowBlur = lw*7;
  for(const gr of gs) trazo(gr, gr.ancho, '#c98a14');                                     // oro hondo, con resplandor
  g.restore();
  for(const gr of gs) trazo(gr, gr.ancho*.62, C.oro);                                     // oro
  for(const gr of gs) trazo(gr, gr.ancho*.22, '#fff1c2', lw*.35);                         // el filo de luz, de un lado
  // charcos de oro donde nacen las ramas (no en el borde, donde nace cada grieta)
  for(const gr of gs.filter(gr => gr.rama && (lleno.get(gr) ?? 0) > 0)){
    const p = gr.pts[0], r = gr.ancho*.95;
    g.save(); g.shadowColor = 'rgba(255,190,60,.8)'; g.shadowBlur = lw*8;
    g.beginPath(); g.ellipse(p.x, p.y, r*1.2, r*.9, hash(p.x + p.y)*TAU, 0, TAU); g.fillStyle = C.oro; g.fill(); g.restore();
    g.beginPath(); g.arc(p.x - r*.3, p.y - r*.3, r*.35, 0, TAU); g.fillStyle = '#fff1c2'; g.fill();
  }
}

// La animación (Eze, 2026-11-27), en un ciclo de `CICLO` s: la superficie entera; se quiebra (las grietas corren desde el
// golpe, rápidas, oscuras, con un destello donde golpea); el oro líquido entra y corre despacio por cada grieta en el
// orden en que se rompió (cada rama se llena cuando el oro llega a donde nace), con una gota encendida en el frente; ya
// reparada, un brillo recorre las costuras de oro; al final se apaga despacio a oscuras y vuelve entera.
const CICLO = 16, ROMPE = 1, VROMPE = 3.2, LLENA = 3, VORO = .55, APAGA = 13.2;
function reparar(g: CanvasRenderingContext2D, gs: Grieta[], lw: number, t: number, golpe: P, L: number){
  const c = t % CICLO, paso = Math.hypot(gs[0].pts[1].x - gs[0].pts[0].x, gs[0].pts[1].y - gs[0].pts[0].y);
  // la rotura: una línea oscura y fina, con un filo apenas claro, que corre por cada grieta
  const rota = Math.max(0, c - ROMPE)*VROMPE*L, orado = Math.max(0, c - LLENA)*VORO*L;
  g.save(); g.lineCap = 'round';
  for(const gr of gs){
    const h = (rota - gr.inicio)/paso; if(h <= 0) continue;
    const n = gr.pts.length - 1;
    g.beginPath(); g.moveTo(gr.pts[0].x, gr.pts[0].y);
    for(let j = 0; j < n && j < h; j++){ const a = gr.pts[j], b = gr.pts[j + 1], f = Math.min(1, h - j); g.lineTo(a.x + (b.x - a.x)*f, a.y + (b.y - a.y)*f); }
    g.strokeStyle = 'rgba(0,0,0,.9)'; g.lineWidth = gr.ancho*.7 + lw; g.stroke();
    g.strokeStyle = 'rgba(255,200,160,.12)'; g.lineWidth = lw*.6; g.stroke();
  }
  g.restore();
  // el destello del golpe
  const d = c - ROMPE;
  if(d > 0 && d < .8){
    const r = L*.35*(.3 + d), a = 1 - d/.8;
    const fl = g.createRadialGradient(golpe.x, golpe.y, 0, golpe.x, golpe.y, r); fl.addColorStop(0, `rgba(255,236,200,${.8*a})`); fl.addColorStop(1, 'rgba(255,190,60,0)');
    g.fillStyle = fl; g.beginPath(); g.arc(golpe.x, golpe.y, r, 0, TAU); g.fill();
  }
  // el oro, hasta donde llegó en cada grieta, y una gota encendida en cada frente
  const hasta = gs.map(gr => (orado - gr.inicio)/paso);
  oro(g, gs, lw, hasta);
  g.save(); g.globalCompositeOperation = 'lighter';
  gs.forEach((gr, i) => {
    const h = hasta[i], n = gr.pts.length - 1; if(h <= 0 || h >= n) return;
    const j = Math.floor(h), a = gr.pts[j], b = gr.pts[j + 1], f = h - j, p = { x: a.x + (b.x - a.x)*f, y: a.y + (b.y - a.y)*f }, r = gr.ancho*2.4 + lw*3;
    const gota = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); gota.addColorStop(0, 'rgba(255,246,220,.95)'); gota.addColorStop(.35, 'rgba(255,208,58,.6)'); gota.addColorStop(1, 'rgba(255,190,60,0)');
    g.fillStyle = gota; g.beginPath(); g.arc(p.x, p.y, r, 0, TAU); g.fill();
  });
  // reparada: un brillo que recorre las costuras (cada grieta a su tiempo), cada vez que pasa
  gs.forEach((gr, i) => {
    const n = gr.pts.length - 1; if(hasta[i] < n) return;
    const pos = ((c*.35 + hash(i*3.7))%1)*n*1.6 - n*.3;
    for(let j = Math.max(0, Math.floor(pos - 3)); j < Math.min(n, pos + 3); j++){
      const k = 1 - Math.abs(j + .5 - pos)/3; if(k <= 0) continue;
      const a = gr.pts[j], b = gr.pts[j + 1];
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.strokeStyle = `rgba(255,246,220,${.55*k})`; g.lineWidth = gr.ancho*.9; g.lineCap = 'round'; g.stroke();
    }
  });
  g.restore();
}
// el telón: se apaga a oscuras al final del ciclo y vuelve entera al empezar
function telon(g: CanvasRenderingContext2D, w: number, h: number, t: number){
  const c = t % CICLO, a = Math.max(lim((c - APAGA)/1.8, 0, 1), 1 - lim(c/.6, 0, 1));
  if(a > 0){ g.fillStyle = `rgba(0,0,0,${a})`; g.fillRect(0, 0, w, h); }
}
const grietasCache = new Map<string, Grieta[]>();

// Un chawan (el cuenco de té) de cerámica negra, visto desde arriba, roto y reparado con oro: el labio del borde, el
// esmalte que se junta en el fondo, y grietas que nacen de un golpe en el borde y cruzan el cuenco.
export const chawan: Elemento = {
  id: 'kintsugi-chawan', grupo: GRUPO, nombre: 'Chawan reparado',
  descripcion: 'Un cuenco de té de cerámica negra visto desde arriba. Animado: se quiebra desde un golpe en el borde y el oro líquido corre por las grietas hasta repararlo.',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const lw = Math.max(2, w/420), cx = w/2, cy = h/2, R = Math.min(w, h)*.42;
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.clip();
    g.drawImage(superficie(w, h, 'ceramica'), 0, 0);
    // el fondo del cuenco: el esmalte más espeso y brillante, y una sombra hacia el borde
    const fondo = g.createRadialGradient(cx - R*.08, cy - R*.1, R*.05, cx, cy, R);
    fondo.addColorStop(0, 'rgba(90,40,30,.35)'); fondo.addColorStop(.45, 'rgba(0,0,0,0)'); fondo.addColorStop(.82, 'rgba(0,0,0,.35)'); fondo.addColorStop(1, 'rgba(0,0,0,.1)');
    g.fillStyle = fondo; g.fillRect(0, 0, w, h);
    // el brillo del esmalte, una mancha de luz arriba a la izquierda
    const brillo = g.createRadialGradient(cx - R*.4, cy - R*.45, 0, cx - R*.4, cy - R*.45, R*.35);
    brillo.addColorStop(0, 'rgba(255,220,190,.16)'); brillo.addColorStop(1, 'rgba(255,220,190,0)');
    g.fillStyle = brillo; g.fillRect(0, 0, w, h);
    // las grietas: desde un golpe en el borde (abajo a la derecha), cruzando hacia el otro lado
    const golpe = { x: cx + Math.cos(.7)*R*.96, y: cy + Math.sin(.7)*R*.96 };
    const clave = `chawan:${w}x${h}`;
    if(!grietasCache.has(clave)) grietasCache.set(clave, grietas([
      { p: golpe, dir: Math.PI + .7, largo: R*1.9, ancho: lw*4.2 },
      { p: golpe, dir: Math.PI + .2, largo: R*1.3, ancho: lw*3.2 },
      { p: golpe, dir: Math.PI + 1.3, largo: R*1.1, ancho: lw*2.8 },
      { p: { x: cx + Math.cos(3.6)*R*.97, y: cy + Math.sin(3.6)*R*.97 }, dir: .2, largo: R*.8, ancho: lw*2.4 },
    ], 41, p => Math.hypot(p.x - cx, p.y - cy) < R*.985, R*.07));
    reparar(g, grietasCache.get(clave)!, lw, t, golpe, R);
    g.restore();
    // el labio del borde: un anillo un poco más claro, con su sombra por dentro y un filo de luz arriba a la izquierda
    g.beginPath(); g.arc(cx, cy, R*.985, 0, TAU); g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = R*.06; g.stroke();
    g.beginPath(); g.arc(cx, cy, R*.995, 0, TAU); g.strokeStyle = '#2e1712'; g.lineWidth = R*.035; g.stroke();
    g.beginPath(); g.arc(cx, cy, R*1.005, -Math.PI*.95, -Math.PI*.55); g.strokeStyle = C.borde; g.lineWidth = lw*.9; g.stroke();
    telon(g, w, h, t);
  },
};

// Piedra oscura agrietada, a pantalla completa (un fondo, como los wagara): una red de grietas de oro que la cruza.
export const piedra: Elemento = {
  id: 'kintsugi-piedra', grupo: GRUPO, nombre: 'Piedra agrietada',
  descripcion: 'Piedra oscura a pantalla completa. Animado: se agrieta desde los bordes y el oro líquido llena la red de grietas: un fondo.',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    const lw = Math.max(2, w/420);
    g.drawImage(superficie(w, h, 'piedra'), 0, 0);
    // en la piedra las cuatro grietas empiezan en los bordes a la vez: el "golpe" es el centro, sin destello visible
    const clave = `piedra:${w}x${h}`;
    if(!grietasCache.has(clave)) grietasCache.set(clave, grietas([
      { p: { x: w*.08, y: h*.3 }, dir: .25, largo: w*.95, ancho: lw*4.4 },
      { p: { x: w*.45, y: h*.02 }, dir: 1.4, largo: h*.9, ancho: lw*3.6 },
      { p: { x: w*.98, y: h*.72 }, dir: Math.PI + .3, largo: w*.6, ancho: lw*3 },
      { p: { x: w*.2, y: h*.98 }, dir: -1.1, largo: h*.6, ancho: lw*2.6 },
    ], 77, p => p.x > -10 && p.x < w + 10 && p.y > -10 && p.y < h + 10, Math.min(w, h)*.05));
    reparar(g, grietasCache.get(clave)!, lw, t, { x: -w, y: -h }, Math.min(w, h)*.6);
    telon(g, w, h, t);
  },
};
