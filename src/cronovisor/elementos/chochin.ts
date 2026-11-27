/*
 * Linternas de papel (chōchin), el octavo elemento (Eze, 2026-11-27). El papel rojo iluminado desde adentro (dorado en
 * el centro, rojo en los bordes), las costillas de bambú, las tapas de laca negra, el kanji en tinta, y un halo de luz
 * cálida que ilumina lo que tiene alrededor. Animados: se balancean y la vela titila (ver `vela`).
 */
import { C, SOMBRA, TAU } from '../dragon/estilo';
import type { Elemento } from './index';

const ANIMACION = 'Linternas de papel (Chōchin): colgando y balanceándose suavemente, emitiendo una luz cálida que ilumina el resto de la escena.';
const GRUPO = 'Linternas de papel (chōchin)';
const JP = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", "Hiragino Kaku Gothic ProN", serif';
const LACA = '#1c0a07';

// la luz del farol sobre lo que lo rodea: un halo cálido grande (se dibuja antes de los faroles)
function halo(g: CanvasRenderingContext2D, x: number, y: number, r: number, fuerza = 1){
  const gr = g.createRadialGradient(x, y, r*.1, x, y, r);
  gr.addColorStop(0, `rgba(255,170,80,${.32*fuerza})`); gr.addColorStop(.4, `rgba(232,90,40,${.14*fuerza})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(x - r, y - r, r*2, r*2);
}

// Un chōchin colgado de (x, y) (el gancho), de alto A, inclinado `ang` (su balanceo, desde el gancho), con `kanji`.
// `fuego` (animación): la llama de adentro, ~1; más, el papel se enciende; menos, se apaga un poco.
function chochin(g: CanvasRenderingContext2D, x: number, y: number, A: number, ang: number, kanji: string, lw: number, fuego = 1){
  g.save(); g.translate(x, y); g.rotate(ang);
  const cuerda = A*.18, tapa = A*.09, cuerpo = A - cuerda - tapa*2, ancho = A*.34, cy = cuerda + tapa + cuerpo/2;
  // el cordón y el gancho
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, cuerda); g.strokeStyle = '#3a2418'; g.lineWidth = lw*1.4; g.stroke();
  g.beginPath(); g.arc(0, lw*2, lw*2.2, 0, TAU); g.strokeStyle = C.oro; g.lineWidth = lw; g.stroke();
  // el cuerpo: un barril (elipse algo achatada arriba y abajo), iluminado desde adentro
  const barril = () => { g.beginPath(); g.ellipse(0, cy, ancho, cuerpo*.56, 0, 0, TAU); };
  g.save(); barril(); g.shadowColor = 'rgba(255,140,60,.9)'; g.shadowBlur = A*.18; g.fillStyle = C.rojo; g.fill(); g.restore();
  const luz = g.createRadialGradient(-ancho*.1, cy - cuerpo*.05, ancho*.08, 0, cy, ancho*1.15);
  luz.addColorStop(0, '#ffe7a8'); luz.addColorStop(.25, C.claro); luz.addColorStop(.5, C.naranja); luz.addColorStop(.78, C.rojo); luz.addColorStop(1, C.rojoOsc);
  barril(); g.fillStyle = luz; g.fill();
  g.save(); barril(); g.clip();
  // el lado de la sombra, a la derecha
  const sombra = g.createLinearGradient(-ancho, 0, ancho, 0); sombra.addColorStop(.55, 'rgba(0,0,0,0)'); sombra.addColorStop(1, 'rgba(60,8,4,.45)');
  g.fillStyle = sombra; g.fillRect(-ancho, cy - cuerpo, ancho*2, cuerpo*2);
  // la llama de adentro: cuando sube, el centro del papel se enciende; cuando baja, el papel se apaga un poco
  if(fuego > 1){ const f = g.createRadialGradient(0, cy, 0, 0, cy, ancho); f.addColorStop(0, `rgba(255,236,180,${Math.min(.5, (fuego - 1)*3)})`); f.addColorStop(1, 'rgba(255,170,80,0)'); g.fillStyle = f; g.fillRect(-ancho, cy - cuerpo, ancho*2, cuerpo*2); }
  else if(fuego < 1){ g.fillStyle = `rgba(30,4,2,${Math.min(.6, (1 - fuego)*2.2)})`; g.fillRect(-ancho, cy - cuerpo, ancho*2, cuerpo*2); }
  // el kanji en tinta, apenas transparente (la luz pasa a través de él)
  g.font = `900 ${cuerpo*.46}px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(26,8,6,.88)'; g.fillText(kanji, 0, cy + cuerpo*.02);
  // las costillas de bambú: arcos horizontales que siguen la curva del barril
  for(let k = 1; k < 14; k++){
    const q = k/14, yy = cy - cuerpo*.56 + q*cuerpo*1.12, rx = ancho*Math.sqrt(Math.max(0, 1 - Math.pow((yy - cy)/(cuerpo*.56), 2)));
    g.beginPath(); g.ellipse(0, yy, rx, rx*.12, 0, 0, Math.PI); g.strokeStyle = 'rgba(90,20,10,.55)'; g.lineWidth = lw*.7; g.stroke();
  }
  g.restore();
  barril(); g.strokeStyle = SOMBRA; g.lineWidth = lw*1.6; g.stroke();
  // el filo de luz, de un lado
  g.beginPath(); g.ellipse(0, cy, ancho - lw, cuerpo*.56 - lw, 0, Math.PI*1.05, Math.PI*1.4); g.strokeStyle = '#fff3dc'; g.lineWidth = lw*.8; g.stroke();
  // las tapas de laca negra, arriba y abajo, con su filo cálido
  for(const [ty, s] of [[cuerda, 1], [cuerda + tapa + cuerpo, -1]] as [number, number][]){
    g.beginPath(); g.roundRect(-ancho*.62, ty, ancho*1.24, tapa, lw*1.5); g.fillStyle = LACA; g.fill(); g.strokeStyle = SOMBRA; g.lineWidth = lw*1.2; g.stroke();
    g.beginPath(); g.moveTo(-ancho*.6, ty + (s > 0 ? tapa - lw : lw)); g.lineTo(ancho*.6, ty + (s > 0 ? tapa - lw : lw)); g.strokeStyle = 'rgba(255,170,80,.7)'; g.lineWidth = lw*.8; g.stroke();
  }
  // la borla de abajo
  g.beginPath(); g.moveTo(0, A); g.lineTo(0, A + A*.08); g.strokeStyle = C.rojoOsc; g.lineWidth = lw*2.5; g.stroke();
  g.restore();
}

// La animación (Eze, 2026-11-27): cada farol se balancea suave desde su gancho (un péndulo, con un vaivén más chico
// encima, como lo empuja la brisa) y la vela de adentro titila (`vela`: dos o tres oscilaciones que no se repiten igual
// y, de vez en cuando, una bajada breve, como cuando la llama se inclina); el halo sobre la escena sigue al farol y a su
// llama. Sin estado: todo sale del reloj.
const vela = (t: number, s: number) => {
  let f = 1 + .045*Math.sin(t*7.3 + s) + .03*Math.sin(t*13.1 + s*2.1) + .02*Math.sin(t*23.7 + s*3.7);
  const seg = Math.floor(t/1.7 + s), q = t/1.7 + s - seg;
  if(Math.sin(seg*12.9898 + s*78.233)*43758.5453 % 1 > .6) f -= .12*Math.sin(Math.min(1, q*2.5)*Math.PI);   // la llama se inclina
  return f;
};
// dónde queda el centro del farol, colgado de (x, y) con alto A e inclinado `ang`
const centro = (x: number, y: number, A: number, ang: number) => { const d = A*.55; return { x: x - Math.sin(ang)*d, y: y + Math.cos(ang)*d }; };

export const chochinGrande: Elemento = {
  id: 'chochin', grupo: GRUPO, nombre: 'Chōchin · 祭',
  descripcion: 'Un farol de papel rojo iluminado desde adentro, con 祭 (matsuri, festival) en tinta, y la luz cálida que ilumina alrededor.',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const lw = Math.max(2, w/420), A = h*.82;
    const ang = .055*Math.sin(t*TAU/4.2) + .015*Math.sin(t*TAU/1.9 + 1), f = vela(t, .3), c = centro(w/2, h*.06, A, ang);
    halo(g, c.x, c.y, A*.85, 1.2*f);
    chochin(g, w/2, h*.06, A, ang, '祭', lw, f);
  },
};

// la hilera: faroles colgando de una cuerda que cae en curva, cada uno detenido en otro punto de su balanceo, con sus
// luces sumándose sobre la escena
export const chochinHilera: Elemento = {
  id: 'chochin-hilera', grupo: GRUPO, nombre: 'Hilera de faroles',
  descripcion: 'Faroles colgando de una cuerda, cada uno en otro punto de su balanceo (酒 sake, 食 comida, 宴 banquete); sus luces bañan la escena.',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const lw = Math.max(1.5, w/560), n = 5, kanjis = ['酒', '食', '宴', '食', '酒'], A = h*.37;
    // la brisa: una ola que pasa de izquierda a derecha; la cuerda se mece apenas y cada farol, un poco después del anterior
    const comba = 1 + .08*Math.sin(t*TAU/5.5);
    const cuerdaY = (x: number) => h*.12 + Math.pow((x - w/2)/(w/2), 2)*-h*.06*comba + h*.06*comba;   // la cuerda cae en curva
    const xs = Array.from({ length: n }, (_, i) => w*(.12 + i*.19));
    const angs = xs.map((_, i) => .09*Math.sin(t*TAU/3.6 - i*.7) + .02*Math.sin(t*TAU/1.7 + i*2.3));
    const fs = xs.map((_, i) => vela(t, i*1.37));
    xs.forEach((x, i) => { const c = centro(x, cuerdaY(x), A*(i % 2 ? .9 : 1), angs[i]); halo(g, c.x, c.y, A*.9, .8*fs[i]); });
    g.beginPath(); for(let x = 0; x <= w; x += 8) x ? g.lineTo(x, cuerdaY(x)) : g.moveTo(x, cuerdaY(x));
    g.strokeStyle = '#3a2418'; g.lineWidth = lw*1.6; g.stroke();
    xs.forEach((x, i) => chochin(g, x, cuerdaY(x), A*(i % 2 ? .9 : 1), angs[i], kanjis[i], lw, fs[i]));
  },
};
