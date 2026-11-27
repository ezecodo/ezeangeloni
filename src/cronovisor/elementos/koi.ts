/*
 * Peces koi, el decimosexto elemento (Eze, 2026-11-27): loops relajantes, nadando en círculo como el yin-yang, con
 * estelas de agua brillante o de tinta sumi-e. Los koi ya son de la paleta: kohaku (blanco hueso con manchas rojas),
 * ogon (oro), showa (negro, rojo y blanco). Vistos desde arriba, el cuerpo dibujado a lo largo de una columna curva
 * (`koi`), con las aletas largas tipo mariposa hechas con la llama del dragón. El yin-yang: dos koi persiguiéndose
 * cola con cabeza, la S que los separa y el círculo como estelas de luz dorada, los dos "ojos" como perlas. El estanque:
 * agua oscura con ondas y estelas de tinta que arde (la `pincelada` del shodō). Estáticos; el nado, en `animacion`.
 */
import { C, SOMBRA, TAU, hash, llama, type P } from '../dragon/estilo';
import { pincelada } from './shodo';
import type { Elemento } from './index';

const ANIMACION = 'Peces Koi (Koi Nobori / estanque): ideales para animaciones en bucle relajantes. Nadando en círculo (formando el símbolo del Yin-Yang) dejando estelas de agua brillante o tinta sumi-e.';
const GRUPO = 'Peces koi';
const HUESO = '#f6ead6';
type Variedad = { cuerpo: string; manchas: string[]; n: number; chicas?: boolean };
const KOHAKU: Variedad = { cuerpo: HUESO, manchas: [C.rojo, C.rojo], n: 4 };
const OGON: Variedad = { cuerpo: C.oro, manchas: [C.claro, C.naranja], n: 3 };
const SHOWA: Variedad = { cuerpo: '#1c0a08', manchas: [C.rojo, HUESO], n: 3, chicas: true };

// un arco de circunferencia como columna: centro, radio, ángulo de la cabeza, largo en radianes, sentido
function arco(c: P, R: number, a0: number, la: number, s: 1 | -1, n = 30): P[] {
  return Array.from({ length: n }, (_, i) => { const a = a0 - s*la*i/(n - 1); return { x: c.x + Math.cos(a)*R, y: c.y + Math.sin(a)*R }; });
}

// un koi a lo largo de `col` (de la cabeza a la base de la cola), de ancho máximo W
// `t` (animación): el cuerpo ondula (una onda que corre de la cabeza a la cola, más amplia hacia la cola, como nada un
// pez) y las aletas se mecen.
function koi(g: CanvasRenderingContext2D, col0: P[], W: number, v: Variedad, lw: number, sem: number, t = 0){
  const n0 = col0.length, tg0 = (i: number) => { const a = col0[Math.max(0, i - 1)], b = col0[Math.min(n0 - 1, i + 1)], l = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: (a.x - b.x)/l, y: (a.y - b.y)/l }; };
  const col = col0.map((p, i) => { const q = i/(n0 - 1), tt = tg0(i), d = W*.32*Math.pow(q, 1.6)*Math.sin(q*Math.PI*1.6 - t*4.2 + sem); return { x: p.x - tt.y*d, y: p.y + tt.x*d }; });
  const n = col.length, tang = (i: number) => { const a = col[Math.max(0, i - 1)], b = col[Math.min(n - 1, i + 1)], l = Math.hypot(b.x - a.x, b.y - a.y) || 1; return { x: (a.x - b.x)/l, y: (a.y - b.y)/l }; };
  const ancho = (q: number) => W*(q < .18 ? Math.sin(q/.18*Math.PI/2)*.9 + .1*q/.18 : 1 - Math.pow((q - .18)/.82, 1.4)*.85)*.5;
  const lados = col.map((p, i) => { const t = tang(i), a = ancho(i/(n - 1)); return { l: { x: p.x - t.y*a, y: p.y + t.x*a }, r: { x: p.x + t.y*a, y: p.y - t.x*a } }; });
  const cuerpo = () => { g.beginPath(); lados.forEach((s, i) => i ? g.lineTo(s.l.x, s.l.y) : g.moveTo(s.l.x, s.l.y)); for(let i = n - 1; i >= 0; i--) g.lineTo(lados[i].r.x, lados[i].r.y); g.closePath(); };
  const L = Math.hypot(col[0].x - col[n - 1].x, col[0].y - col[n - 1].y);
  const aleta = v === OGON ? C.claro : v === SHOWA ? C.rojoOsc : '#ffd8c2';
  // la cola: dos llamas largas abiertas hacia atrás; las pectorales, una a cada lado
  const tc = tang(n - 1), atras = { x: -tc.x, y: -tc.y }, cola = col[n - 1];
  for(const l of [-1, 1]){
    const d = { x: atras.x - tc.y*l*.45, y: atras.y + tc.x*l*.45 };
    llama(g, cola, d, atras, L*.42, W*.32, t*1.2, sem + l*2.3, l, aleta, lw, .5);
  }
  const i1 = Math.round(n*.26), tp = tang(i1);
  for(const l of [-1, 1]){
    const s = l < 0 ? lados[i1].l : lados[i1].r, d = { x: -tp.y*l*-1*.8 - tp.x*.6, y: tp.x*l*-1*.8 - tp.y*.6 };
    llama(g, s, { x: (l < 0 ? -1 : 1)*-tp.y*.8 - tp.x*.6, y: (l < 0 ? 1 : -1)*-tp.x*.8 - tp.y*.6 }, { x: -tp.x, y: -tp.y }, W*.75*(1 + .12*Math.sin(t*3 + l + sem)), W*.22, t*1.5, sem + 5 + l, l, aleta, lw*.8, .6);
    void d;
  }
  cuerpo(); g.strokeStyle = SOMBRA; g.lineWidth = lw*2.5; g.stroke(); g.fillStyle = v.cuerpo; g.fill();
  // las manchas, recortadas por el cuerpo
  g.save(); cuerpo(); g.clip();
  for(let k = 0; k < v.n; k++){
    const p = col[Math.floor((.12 + hash(sem + k)*.75)*(n - 1))], r = W*(.35 + hash(sem*2 + k)*.35)*(v.chicas ? .6 : 1);
    g.beginPath(); g.ellipse(p.x + (hash(sem*3 + k) - .5)*W*.5, p.y + (hash(sem*5 + k) - .5)*W*.5, r, r*.7, hash(k)*TAU, 0, TAU);
    g.fillStyle = v.manchas[k % v.manchas.length]; g.fill();
  }
  // el lomo: un brillo a lo largo, y las escamas como tejas chicas (la regla)
  g.beginPath(); col.slice(2, n - 3).forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.strokeStyle = 'rgba(255,245,225,.25)'; g.lineWidth = W*.18; g.stroke();
  for(let i = 5; i < n - 3; i += 2) for(const o of [-.25, 0, .25]){
    const p = col[i], t = tang(i), c = { x: p.x - t.y*o*W, y: p.y + t.x*o*W }, r = W*.12, a = Math.atan2(t.y, t.x);
    g.beginPath(); g.arc(c.x, c.y, r, a + Math.PI*.6, a + Math.PI*1.4); g.strokeStyle = 'rgba(30,8,6,.25)'; g.lineWidth = lw*.6; g.stroke();
  }
  g.restore();
  // el filo de luz de un lado, los ojos, los barbillones
  g.beginPath(); lados.slice(1, n - 4).forEach((s, i) => i ? g.lineTo(s.l.x, s.l.y) : g.moveTo(s.l.x, s.l.y)); g.strokeStyle = C.borde; g.lineWidth = lw*.9; g.stroke();
  const t0 = tang(1), cab = col[1];
  for(const l of [-1, 1]){
    const e = { x: cab.x - t0.y*l*W*.28 - t0.x*W*.05, y: cab.y + t0.x*l*W*.28 - t0.y*W*.05 };
    g.beginPath(); g.arc(e.x, e.y, W*.07, 0, TAU); g.fillStyle = '#120604'; g.fill();
    g.beginPath(); g.moveTo(col[0].x - t0.y*l*W*.12, col[0].y + t0.x*l*W*.12); g.lineTo(col[0].x - t0.y*l*W*.32 + t0.x*W*.15, col[0].y + t0.x*l*W*.32 + t0.y*W*.15);
    g.strokeStyle = SOMBRA; g.lineWidth = lw*.8; g.stroke();
  }
}

// una estela de agua brillante a lo largo de un camino: un resplandor dorado que se apaga, y chispas
function estela(g: CanvasRenderingContext2D, linea: P[], ancho: number, lw: number, sem: number, t = 0){
  g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
  for(let i = 1; i < linea.length; i++){
    const q = i/linea.length, a = (1 - q)*.5;
    g.beginPath(); g.moveTo(linea[i - 1].x, linea[i - 1].y); g.lineTo(linea[i].x, linea[i].y);
    g.strokeStyle = `rgba(255,190,80,${a*.35})`; g.lineWidth = ancho*(1 - q*.6); g.stroke();
    g.strokeStyle = `rgba(255,236,190,${a})`; g.lineWidth = lw*(1.4 - q); g.stroke();
  }
  for(let k = 0; k < 40; k++){
    const i = Math.floor(hash(sem + k)*linea.length), p = linea[i], q = i/linea.length, o = (hash(sem*2 + k) - .5)*ancho;
    const late = .5 + .5*Math.sin(t*(2 + hash(k*7.7)*3) + k*1.9);   // las chispas del agua titilan
    g.beginPath(); g.arc(p.x + o, p.y + o*.6, lw*(.5 + hash(k*3.1)*1.2), 0, TAU); g.fillStyle = `rgba(255,230,170,${(1 - q)*.8*late})`; g.fill();
  }
  g.restore();
}

function agua(g: CanvasRenderingContext2D, w: number, h: number){
  const f = g.createRadialGradient(w/2, h/2, h*.1, w/2, h/2, w*.7); f.addColorStop(0, '#1a0806'); f.addColorStop(1, '#030101');
  g.fillStyle = f; g.fillRect(0, 0, w, h);
}

const YINYANG = 24;
export const koiYinYang: Elemento = {
  id: 'koi-yinyang', grupo: GRUPO, nombre: 'Koi · yin-yang',
  descripcion: 'Dos koi persiguiéndose cola con cabeza, un kohaku y un showa: la S que los separa y el círculo, estelas de agua brillante; los dos ojos del símbolo, perlas.',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    // animado: todo el símbolo gira despacio en el sentido en que nadan los dos koi (una vuelta cada `YINYANG` s, un
    // bucle exacto), los peces ondulan y las chispas del agua titilan
    agua(g, w, h);
    const lw = Math.max(2, w/420), c = { x: w/2, y: h/2 }, R = h*.42;
    g.save(); g.translate(c.x, c.y); g.rotate(-(t % YINYANG)/YINYANG*TAU); g.translate(-c.x, -c.y);
    // el círculo y la S, como estelas de luz
    const circulo = arco(c, R, -Math.PI/2, TAU*.98, -1, 120);
    estela(g, circulo, lw*6, lw, 3, t);
    const s1 = arco({ x: c.x, y: c.y - R/2 }, R/2, -Math.PI/2, Math.PI, -1, 50), s2 = arco({ x: c.x, y: c.y + R/2 }, R/2, -Math.PI/2, Math.PI, 1, 50);
    estela(g, [...s1, ...s2], lw*8, lw*1.2, 9, t);
    // los ojos del símbolo: perlas de luz
    for(const [y, col] of [[c.y - R/2, C.oro], [c.y + R/2, HUESO]] as [number, string][]){
      const p = g.createRadialGradient(c.x, y, 0, c.x, y, R*.13); p.addColorStop(0, col); p.addColorStop(.35, col); p.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = p; g.beginPath(); g.arc(c.x, y, R*.13, 0, TAU); g.fill();
    }
    // los dos koi, en las dos mitades, nadando en el sentido de las agujas, cola con cabeza
    const Rk = R*.72;
    koi(g, arco(c, Rk, -Math.PI*.05, Math.PI*.52, -1), R*.3, KOHAKU, lw, 11, t);
    koi(g, arco(c, Rk, Math.PI*.95, Math.PI*.52, -1), R*.3, SHOWA, lw, 23, t);
    g.restore();
  },
};

export const koiEstanque: Elemento = {
  id: 'koi-estanque', grupo: GRUPO, nombre: 'Koi · estanque de tinta',
  descripcion: 'Koi en un estanque oscuro con ondas, dejando estelas de tinta que arde (la pincelada del shodō): un kohaku, un ogon y un showa.',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    // animado: los tres koi nadan en sus anillos (cada uno a su velocidad, los de adentro más rápido), ondulando, con su
    // estela de tinta detrás; las ondas del agua se abren y se apagan
    agua(g, w, h);
    const lw = Math.max(2, w/420);
    // ondas en el agua: anillos finos que nacen chicos, se abren y se apagan, cada grupo a su tiempo
    for(const [x, y, r, d] of [[.22, .3, .1, 0], [.8, .72, .13, 2.1], [.62, .2, .06, 4.3]] as [number, number, number, number][])
      for(let k = 0; k < 3; k++){
        const e = (((t + d)/6 + k/3) % 1), rr = w*r*(.3 + e*1.6);
        g.beginPath(); g.ellipse(w*x, h*y, rr, rr*.8, 0, 0, TAU); g.strokeStyle = `rgba(255,192,106,${.2*(1 - e)})`; g.lineWidth = lw; g.stroke();
      }
    // tres koi girando alrededor del mismo centro a distintos radios (un bucle), cada uno con su estela detrás
    const c = { x: w*.5, y: h*.5 };
    const peces: [P, number, number, number, 1 | -1, Variedad, number][] = [
      [c, h*.2, .3 + t*.34, 2.2, 1, KOHAKU, 3], [c, h*.31, 2.5 + t*.24, 1.5, 1, OGON, 7], [c, h*.42, 4.4 + t*.17, 1.1, 1, SHOWA, 13]];
    // primero las estelas de tinta (cada una sigue el arco detrás de su pez), después los peces
    for(const [c, R, a0, la, s, , sem] of peces){
      const cola = arco(c, R, a0 - s*la*.55, la*1.1, s, 40);
      pincelada(g, cola, q => h*.03*(1 - q*.7), lw, sem, .8, 30);
    }
    for(const [c, R, a0, la, s, v, sem] of peces) koi(g, arco(c, R, a0, la*.55, s), h*.085, v, lw, sem, t);
  },
};
