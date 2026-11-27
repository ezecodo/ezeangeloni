/*
 * Olas estilo Hokusai (la gran ola), el duodécimo elemento (Eze, 2026-11-27; la de Hokusai, de 1831, es dominio
 * público: ésta es una ola propia en su estilo). Eze propuso dorados, turquesas o neón; el turquesa choca con la regla
 * (fuego, nada de azules ni verdes), dorado y neón cálido encajan. La ola dorada: el cuerpo en franjas que siguen su
 * curva (rojos profundos y oro), la espuma de la cresta con las "garras" de Hokusai hechas con la llama del dragón (casi
 * la misma forma), salpicaduras doradas, un Fuji chico a lo lejos. La ola en neón: la misma ola sólo en líneas de tubo.
 * Estáticos; el movimiento del agua, en `animacion`.
 */
import { C, SOMBRA, TAU, hash, llama, type P } from '../dragon/estilo';
import type { Elemento } from './index';

const ANIMACION = 'Olas estilo Hokusai (La Gran Ola): el movimiento del agua con espuma estilizada es hipnótico en pantallas LED. Toque fusión cambiando los colores tradicionales por tonos dorados, turquesas o neón.';
const GRUPO = 'La gran ola';

// la forma de la ola en coordenadas normalizadas (0..1 a lo ancho y a lo alto de su caja): el lomo que sube desde abajo
// a la izquierda, la cresta, y el labio que se curva hacia adelante y abajo en un gancho
const LOMO = [[0, 1], [.1, .72], [.24, .4], [.4, .15], [.58, .03], [.75, .06], [.88, .18], [.96, .34]];
const LABIO = [[.96, .34], [.95, .46], [.88, .52], [.8, .5], [.76, .44]];
const FRENTE = [[.76, .44], [.8, .6], [.86, .8], [.9, 1]];

function spline(ctl: number[][], n = 60): number[][] {
  const out: number[][] = [], m = ctl.length - 1;
  for(let j = 0; j <= n; j++){
    const q = j/n*m, i = Math.min(m - 1, Math.floor(q)), f = q - i;
    const p0 = ctl[Math.max(0, i - 1)], p1 = ctl[i], p2 = ctl[i + 1], p3 = ctl[Math.min(m, i + 2)];
    out.push([0, 1].map(k => .5*((2*p1[k]) + (-p0[k] + p2[k])*f + (2*p0[k] - 5*p1[k] + 4*p2[k] - p3[k])*f*f + (-p0[k] + 3*p1[k] - 3*p2[k] + p3[k])*f*f*f)));
  }
  return out;
}

type Ola = { lomo: P[]; labio: P[]; frente: P[]; cuerpo: () => void };
// `marea` (animación, -1 a 1): la ola respira; en 1 la cresta sube y el labio se curva más hacia adelante, como a punto
// de romper; en -1 se relaja.
function forma(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, marea = 0): Ola {
  const a = (p: number[]) => ({ x: x + p[0]*w, y: y + p[1]*h });
  const cresta = LOMO[LOMO.length - 1], giro = marea*.14;
  const curva = (p: number[]) => {   // el labio gira alrededor del final del lomo, y se estira un poco
    const dx = p[0] - cresta[0], dy = p[1] - cresta[1], c = Math.cos(giro), sn = Math.sin(giro);
    return [cresta[0] + (dx*c - dy*sn)*(1 + marea*.06), cresta[1] + (dx*sn + dy*c)*(1 + marea*.06) - marea*.03];
  };
  const LO = LOMO.map((p, i) => [p[0] + marea*.01*(i/LOMO.length), p[1] - marea*.035*Math.pow(i/(LOMO.length - 1), 2)]);
  LO[LO.length - 1] = [cresta[0], cresta[1] - marea*.03];
  const LA = LABIO.map((p, i) => i ? curva(p) : LO[LO.length - 1]);
  const FR = FRENTE.map((p, i) => i ? [p[0] + marea*.012*(1 - i/FRENTE.length), p[1]] : LA[LA.length - 1]);
  const lomo = spline(LO).map(a), labio = spline(LA, 24).map(a), frente = spline(FR, 24).map(a);
  const cuerpo = () => {
    g.beginPath(); lomo.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y));
    labio.forEach(p => g.lineTo(p.x, p.y)); frente.forEach(p => g.lineTo(p.x, p.y));
    g.closePath();
  };
  return { lomo, labio, frente, cuerpo };
}

// las normales hacia adentro del lomo, para las franjas y las garras
function normales(pts: P[]){
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let tx = b.x - a.x, ty = b.y - a.y; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    return { t: { x: tx, y: ty }, n: { x: ty, y: -tx } };   // n: hacia afuera (a la izquierda del avance, arriba)
  });
}

// la ola dorada en (x, y), de w × h
// Animada (Eze, 2026-11-27: "el movimiento del agua con espuma estilizada, hipnótico"), con `t`: la ola respira (sube,
// se curva como a punto de romper, se relaja: `marea`, cada `RESPIRA` s), las franjas corren por su cara hacia la
// cresta (el agua que sube), las garras de espuma se mecen (la llama del dragón ya sabe moverse) y las gotas saltan
// del labio en arcos y caen.
const RESPIRA = 7;
function olaDorada(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, lw: number, sem: number, t = 0, desfase = 0){
  const marea = Math.sin((t/RESPIRA + desfase)*TAU), O = forma(g, x, y, w, h, marea), corre = ((t/RESPIRA*2) % 1);
  O.cuerpo(); g.strokeStyle = SOMBRA; g.lineWidth = lw*3; g.stroke();
  const fondo = g.createLinearGradient(x, y, x + w*.3, y + h); fondo.addColorStop(0, C.rojoOsc); fondo.addColorStop(1, C.pata);
  g.fillStyle = fondo; g.fill();
  // las franjas: curvas paralelas al lomo, hacia adentro, alternando oro, rojo y rojo profundo (las líneas de Hokusai)
  g.save(); O.cuerpo(); g.clip();
  const N = normales(O.lomo), cols = [C.oro, C.rojo, C.claro, C.rojoOsc];
  for(let k = 1; k < 15; k++){
    g.beginPath();
    // (las franjas se corren hacia afuera, hacia el lomo, una franja cada medio respiro: el agua que sube por la cara)
    O.lomo.forEach((p, i) => { const d = (k - corre)*h*.045*(1 - i/O.lomo.length*.4); const q = { x: p.x - N[i].n.x*d, y: p.y - N[i].n.y*d }; i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y); });
    // el color va con la franja (no con su lugar), así al correrse no cambia de color de golpe
    const fr = k + Math.floor((t/RESPIRA*2)), aparece = k === 1 ? 1 - corre : 1;
    g.strokeStyle = cols[((fr % cols.length) + cols.length) % cols.length]; g.lineWidth = lw*(fr % 2 ? 2.2 : 1.2); g.globalAlpha = (.55 + (fr % 2)*.35)*aparece; g.stroke();
  }
  g.globalAlpha = 1;
  g.restore();
  // el hueco del rulo: bajo el labio, la cavidad oscura que se curva (lo que hace reconocible la ola), de bordes suaves,
  // con un par de franjas que siguen su curva por dentro
  const hx = x + w*.85, hy = y + h*.5, hr = Math.min(w, h)*.13;
  g.save(); O.cuerpo(); g.clip();
  const hueco = g.createRadialGradient(hx - hr*.2, hy + hr*.1, hr*.15, hx, hy, hr*1.6);
  hueco.addColorStop(0, 'rgba(8,2,2,.95)'); hueco.addColorStop(.55, 'rgba(20,4,3,.7)'); hueco.addColorStop(1, 'rgba(20,4,3,0)');
  g.fillStyle = hueco; g.beginPath(); g.ellipse(hx, hy, hr*1.6, hr*2, -.4, 0, TAU); g.fill();
  for(let k = 1; k <= 3; k++){ g.beginPath(); g.ellipse(hx, hy, hr*(.5 + k*.28), hr*(.7 + k*.33), -.4, -Math.PI*.9, Math.PI*.15); g.strokeStyle = k % 2 ? 'rgba(255,208,58,.45)' : 'rgba(232,67,46,.5)'; g.lineWidth = lw*1.2; g.stroke(); }
  g.restore();
  // la espuma de la cresta: las garras de Hokusai, llamas en crema y oro que salen del lomo hacia adelante y se rizan
  const arriba = O.lomo.slice(Math.floor(O.lomo.length*.35)).concat(O.labio);
  const NA = normales(arriba);
  for(let i = 0; i < arriba.length; i += 2){
    const p = arriba[i], { t: tg, n } = NA[i], q = i/arriba.length;
    const dir = { x: n.x*.7 + tg.x*.7, y: n.y*.7 + tg.y*.7 };
    llama(g, p, dir, tg, h*(.07 + .09*Math.sin(q*Math.PI))*(1 + .15*marea*q), h*.018, t*.8, sem + i*1.31, 1, i % 3 ? '#fff1d6' : C.claro, lw*.9, .6);
  }
  // las salpicaduras: gotas doradas por delante del labio
  // cada gota sale de un punto del labio, vuela en arco hacia adelante y cae, y vuelve a salir (su propio ciclo)
  for(let k = 0; k < 70; k++){
    const r1 = hash(sem + k*1.7), r2 = hash(sem + k*2.9), dura = 1.6 + r2*1.4, e = ((t + r1*dura*3)/dura) % 1;
    const o = O.labio[Math.floor(r1*(O.labio.length - 1))];
    const px = o.x + w*(.05 + r2*.25)*e, py = o.y - h*(.12 + r1*.15)*Math.sin(e*Math.PI*.9) + h*.15*e*e;
    g.globalAlpha = 1 - e*e;
    g.beginPath(); g.arc(px, py, lw*(.6 + hash(k*5.1)*1.8)*(1 - e*.4), 0, TAU); g.fillStyle = hash(k) < .5 ? '#fff1d6' : C.oro; g.fill();
  }
  g.globalAlpha = 1;
}

// la ola en neón: el contorno y las franjas como tubos (halo, vidrio, núcleo)
function olaNeon(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, lw: number){
  const O = forma(g, x, y, w, h), N = normales(O.lomo);
  const tubo = (trazar: () => void, color: string, nucleo: string, grosor: number) => {
    for(const [ancho, col, brillo, alfa] of [[grosor*3, color, grosor*12, .45], [grosor, color, grosor*4, 1], [grosor*.38, nucleo, grosor*1.5, 1]] as [number, string, number, number][]){
      g.save(); g.globalAlpha = alfa; g.strokeStyle = col; g.lineWidth = ancho; g.shadowColor = col; g.shadowBlur = brillo; g.lineJoin = 'round'; g.lineCap = 'round';
      trazar(); g.stroke(); g.restore();
    }
  };
  // el contorno, abierto (cerrado por abajo parecía un montículo)
  tubo(() => { g.beginPath(); [...O.lomo, ...O.labio, ...O.frente].forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); }, C.rojo, '#ffd9c8', lw*1.4);
  for(let k = 1; k < 7; k++)
    tubo(() => { g.beginPath(); O.lomo.slice(0, O.lomo.length - k*2).forEach((p, i) => { const d = k*h*.075; const q = { x: p.x - N[i].n.x*d, y: p.y - N[i].n.y*d }; i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y); }); }, k % 2 ? C.naranja : C.oro, '#fff2d8', lw*(k % 2 ? 1 : .8));
  // la cresta: rizos de tubo dorado
  const arriba = O.lomo.slice(Math.floor(O.lomo.length*.4)).concat(O.labio), NA = normales(arriba);
  for(let i = 0; i < arriba.length; i += 4){
    const p = arriba[i], { t, n } = NA[i], r = h*.035;
    const c = { x: p.x + (n.x*.7 + t.x*.7)*r*1.6, y: p.y + (n.y*.7 + t.y*.7)*r*1.6 };
    tubo(() => { g.beginPath(); g.moveTo(p.x, p.y); g.quadraticCurveTo(c.x + n.x*r, c.y + n.y*r, c.x + t.x*r*.6, c.y + t.y*r*.6); }, C.oro, '#fff6dc', lw*.8);
  }
}

// un Fuji chico a lo lejos, en silueta con su nieve
function fujiLejos(g: CanvasRenderingContext2D, cx: number, base: number, ancho: number, alto: number){
  g.beginPath(); g.moveTo(cx - ancho, base); g.quadraticCurveTo(cx - ancho*.4, base - alto*.25, cx - ancho*.12, base - alto); g.lineTo(cx + ancho*.12, base - alto);
  g.quadraticCurveTo(cx + ancho*.4, base - alto*.25, cx + ancho, base); g.closePath(); g.fillStyle = '#2a0c08'; g.fill();
  g.beginPath(); g.moveTo(cx - ancho*.12, base - alto); g.lineTo(cx + ancho*.12, base - alto); g.lineTo(cx + ancho*.28, base - alto*.65); g.lineTo(cx + ancho*.1, base - alto*.72); g.lineTo(cx, base - alto*.62); g.lineTo(cx - ancho*.12, base - alto*.7); g.lineTo(cx - ancho*.28, base - alto*.65); g.closePath();
  g.fillStyle = '#e8c8a8'; g.fill();
}

export const olaOro: Elemento = {
  id: 'ola-dorada', grupo: GRUPO, nombre: 'La gran ola dorada',
  descripcion: 'La ola en el lenguaje del dragón: franjas en rojos y oro, la espuma hecha con la llama del dragón, un Fuji a lo lejos. Animada: respira, el agua sube por su cara, la espuma se mece y las gotas saltan.',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    const lw = Math.max(2, w/420);
    const cielo = g.createLinearGradient(0, 0, 0, h); cielo.addColorStop(0, '#000'); cielo.addColorStop(1, '#1e0806');
    g.fillStyle = cielo; g.fillRect(0, 0, w, h);
    fujiLejos(g, w*.74, h*.86, w*.12, h*.16);
    olaDorada(g, w*.62, h*.58, w*.42, h*.42, lw*.7, 41, t, .4);   // una ola chica, detrás, a otro tiempo
    olaDorada(g, -w*.05, h*.06, w*.82, h*.96, lw, 7, t);           // la gran ola
  },
};

export const olaNeonE: Elemento = {
  id: 'ola-neon', grupo: GRUPO, nombre: 'La gran ola en neón',
  descripcion: 'La misma ola sólo en líneas de tubo de neón cálido, sobre negro: el toque fusión más moderno.',
  animacion: ANIMACION,
  dibujar(g, w, h){
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    olaNeon(g, w*.06, h*.08, w*.82, h*.88, Math.max(2, w/420));
  },
};
