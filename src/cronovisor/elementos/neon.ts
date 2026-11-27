/*
 * Neo-Tokio, carteles de neón, el cuarto elemento (Eze, 2026-11-27). El cyberpunk de siempre es rosa y celeste, pero la
 * regla del dragón es fuego, no arcoíris: es neón cálido (tubos rojos, naranjas y dorados, el núcleo casi blanco de
 * calor). Cada cartel: un tablero oscuro con su borde de metal, el texto en japonés hecho tubo (el contorno de cada
 * letra, como los neones de letras huecas), un marco de tubo, la palabra en español debajo, y el resplandor sobre la
 * pared. Animados: se encienden tubo por tubo, zumban, tartamudean, y se cortan (ver `brillo`).
 * La letra japonesa sale de las fuentes del sistema (Hiragino en Mac, Yu Gothic en Windows, Noto en Linux). Si el equipo
 * de la mesa no tiene ninguna, habrá que traer una (Noto Sans JP, servida desde el propio servidor).
 */
import { C, TAU, hash } from '../dragon/estilo';
import type { Elemento } from './index';

const ANIMACION = 'Estilo Cyberpunk / Neo-Tokio: carteles luminosos con caracteres kanji/katakana (que digan "Fusión", "Sabor", "Bienvenidos", etc.) con efecto de parpadeo de neón.';
const GRUPO = 'Neo-Tokio · carteles de neón';
const JP = '"Hiragino Kaku Gothic ProN", "Hiragino Sans", "Yu Gothic", "Noto Sans JP", "Noto Sans CJK JP", sans-serif';
const LAT = '"DM Mono", ui-monospace, monospace';

// el tubo de neón: un resplandor ancho, el vidrio de color, y el núcleo casi blanco. `trazar` dibuja el camino (texto o
// figura) y llama a `pintar` con el ancho y el color de cada pasada. `k` (animación): cuánto está encendido (0 apagado:
// se ve el vidrio del tubo, oscuro; 1 a pleno).
function neon(g: CanvasRenderingContext2D, color: string, nucleo: string, grosor: number, trazar: (pintar: () => void) => void, k = 1){
  const pasada = (ancho: number, col: string, brillo: number, alfa = 1) => {
    g.save(); g.globalAlpha = alfa; g.lineWidth = ancho; g.strokeStyle = col; g.shadowColor = col; g.shadowBlur = brillo;
    g.lineJoin = 'round'; g.lineCap = 'round';
    trazar(() => g.stroke()); g.restore();
  };
  if(k < 1) pasada(grosor, 'rgba(70,32,26,.85)', 0);        // el vidrio apagado
  if(k <= 0) return;
  pasada(grosor*3, color, grosor*12*k, .5*k);    // el halo
  pasada(grosor, color, grosor*4*k, k);          // el tubo
  pasada(grosor*.38, nucleo, grosor*1.5, k);     // el núcleo caliente
}

// El parpadeo (Eze, 2026-11-27), en un ciclo de `CICLO` s y sin estado (sólo del reloj): el cartel arranca a oscuras y
// cada tubo se enciende a su turno (`enciende`) con el titubeo de un neón que arranca; después queda encendido con un
// zumbido apenas visible, y de vez en cuando un tubo tartamudea un instante; el tubo `flojo` (cada cartel tiene uno)
// tartamudea más seguido y a veces queda a media luz. Al final del ciclo se corta la luz (todos a la vez, con un último
// destello) y vuelve a empezar.
const CICLO = 22;
function brillo(t: number, enciende: number, sem: number, flojo = false){
  const c = t % CICLO, paso = (x: number) => Math.floor(x/.045);
  if(c < enciende) return 0;
  // al arrancar: titubea medio segundo, cada vez más encendido
  const a = c - enciende;
  if(a < .6) return hash(paso(a) + sem) < .25 + a*1.4 ? .35 + .65*hash(paso(a)*1.7 + sem) : 0;
  // el corte del final
  const fin = CICLO - 1.1;
  if(c > fin){ const b = c - fin; return b < .08 ? 1.15 : b < .5 && hash(paso(b) + sem) < .35 ? .3 : Math.max(0, .15 - b*.3); }
  // encendido: el zumbido, y un tartamudeo de un cuarto de segundo en algunos segundos
  let k = .96 + .04*Math.sin(t*37 + sem*5);
  const seg = Math.floor(c), f = c - seg, ini = hash(seg*1.31 + sem)*.7;
  if(hash(seg*2.17 + sem*3.3) < (flojo ? .3 : .05) && f > ini && f < ini + (flojo ? .45 : .22)) k *= hash(paso(f) + seg + sem) < .5 ? .08 : .7;
  // el flojo, además, pasa ratos a media luz
  if(flojo && Math.sin(c*.9 + sem) > .82) k *= .55;
  return k;
}

// el tablero: oscuro, con su borde de metal, cuatro tornillos y una textura apenas visible
function tablero(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, lw: number){
  g.save();
  g.beginPath(); g.roundRect(x, y, w, h, r); g.fillStyle = '#0d0706'; g.fill();
  g.clip();
  for(let k = 0; k < 220; k++){ g.fillStyle = `rgba(255,190,150,${.012 + hash(k*3.3)*.02})`; g.fillRect(x + hash(k)*w, y + hash(k + .5)*h, 1 + hash(k + 9)*3, 1 + hash(k + 7)*3); }
  g.restore();
  g.beginPath(); g.roundRect(x, y, w, h, r); g.strokeStyle = '#2b1d19'; g.lineWidth = lw*2.5; g.stroke();
  g.beginPath(); g.roundRect(x + lw*1.5, y + lw*1.5, w - lw*3, h - lw*3, r*.8); g.strokeStyle = 'rgba(0,0,0,.8)'; g.lineWidth = lw; g.stroke();
  for(const [px, py] of [[x + r, y + r], [x + w - r, y + r], [x + r, y + h - r], [x + w - r, y + h - r]]){
    g.beginPath(); g.arc(px, py, lw*2.2, 0, TAU); g.fillStyle = '#3a2a24'; g.fill(); g.strokeStyle = '#000'; g.lineWidth = lw*.6; g.stroke();
  }
}

// el resplandor del neón sobre la pared, alrededor del cartel
function resplandor(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string){
  const gr = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
  gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.save(); g.translate(x, y); g.scale(rx/Math.max(rx, ry), ry/Math.max(rx, ry)); g.translate(-x, -y);
  g.fillStyle = gr; g.fillRect(x - Math.max(rx, ry), y - Math.max(rx, ry), Math.max(rx, ry)*2, Math.max(rx, ry)*2); g.restore();
}

// 融合 (yūgō, "fusión"): un cartel vertical, como los de las calles de Tokio; los kanji uno debajo del otro en rojo, un
// marco de tubo naranja, y "FUSIÓN" en dorado debajo
export const fusion: Elemento = {
  id: 'neon-fusion', grupo: GRUPO, nombre: '融合 · fusión',
  descripcion: 'Un cartel vertical, como los de las calles de Tokio: 融合 (yūgō) en neón rojo, marco naranja, "FUSIÓN" debajo.',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const lw = Math.max(2, w/420), bw = w*.3, bh = h*.86, bx = (w - bw)/2, by = (h - bh)/2;
    const k = [brillo(t, 1, 1), brillo(t, 1.5, 2), brillo(t, 2.2, 3, true), brillo(t, 2.9, 4)];   // marco, 融, 合 (el flojo), FUSIÓN
    resplandor(g, w/2, h/2, bw*1.6, bh*.75, `rgba(232,67,46,${.22*(k[0] + k[1] + k[2] + k[3])/4})`);
    tablero(g, bx, by, bw, bh, lw*6, lw);
    const T = bw*.62;
    g.font = `700 ${T}px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    (['融', '合'] as const).forEach((ch, i) => neon(g, C.rojo, '#ffd9c8', lw*1.6, () => { g.strokeText(ch, w/2, by + bh*.3 + i*T*1.12); }, k[1 + i]));
    neon(g, C.naranja, '#ffe6c8', lw*1.2, pintar => { g.beginPath(); g.roundRect(bx + lw*7, by + lw*7, bw - lw*14, bh - lw*14, lw*4); pintar(); }, k[0]);
    g.font = `500 ${bw*.13}px ${LAT}`;
    neon(g, C.oro, '#fff6dc', lw*.8, () => { g.strokeText('FUSIÓN', w/2, by + bh*.88); }, k[3]);
  },
};

// 味 (aji, "sabor"): un kanji grande dentro de un círculo de tubo, como el cartel de una casa de ramen; "SABOR" debajo
export const sabor: Elemento = {
  id: 'neon-sabor', grupo: GRUPO, nombre: '味 · sabor',
  descripcion: 'Un kanji grande dentro de un círculo de neón, como el cartel de una casa de ramen: 味 (aji) y "SABOR".',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const lw = Math.max(2, w/420), cx = w/2, cy = h*.43, R = Math.min(w, h)*.31;
    const k = [brillo(t, 1, 11), brillo(t, 1.4, 12, true), brillo(t, 2.1, 13), brillo(t, 2.8, 14)];   // anillo, anillo de adentro (flojo), 味, SABOR
    resplandor(g, cx, cy, R*2.1, R*1.8, `rgba(246,116,74,${.2*(k[0] + k[1] + k[2] + k[3])/4})`);
    tablero(g, cx - R*1.25, cy - R*1.2, R*2.5, R*2.85, lw*8, lw);
    neon(g, C.rojo, '#ffd9c8', lw*1.4, pintar => { g.beginPath(); g.arc(cx, cy, R, 0, TAU); pintar(); }, k[0]);
    neon(g, C.naranja, '#ffe6c8', lw*.9, pintar => { g.beginPath(); g.arc(cx, cy, R*.9, 0, TAU); pintar(); }, k[1]);
    g.font = `700 ${R*1.15}px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    neon(g, C.oro, '#fff6dc', lw*1.5, () => { g.strokeText('味', cx, cy + R*.04); }, k[2]);
    g.font = `500 ${R*.24}px ${LAT}`;
    neon(g, C.naranja, '#ffe6c8', lw*.8, () => { g.strokeText('SABOR', cx, cy + R*1.42); }, k[3]);
  },
};

// ようこそ (yōkoso, "bienvenidos"): un cartel horizontal, el texto en naranja, subrayado por un tubo rojo con dos
// remates, y "BIENVENIDOS" en dorado
export const bienvenidos: Elemento = {
  id: 'neon-bienvenidos', grupo: GRUPO, nombre: 'ようこそ · bienvenidos',
  descripcion: 'Un cartel horizontal: ようこそ (yōkoso) en neón naranja, subrayado en rojo, y "BIENVENIDOS".',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const lw = Math.max(2, w/420), bw = w*.86, bh = h*.5, bx = (w - bw)/2, by = (h - bh)/2;
    // cada letra es su propio tubo, y se encienden de izquierda a derecha; la こ es la floja
    const kl = [0, 1, 2, 3].map(i => brillo(t, 1 + i*.35, 21 + i, i === 2)), ks = brillo(t, 2.6, 26), kb = brillo(t, 3.1, 27);
    resplandor(g, w/2, h/2, bw*.8, bh*1.3, `rgba(246,116,74,${.2*(kl.reduce((a, b) => a + b) + ks + kb)/6})`);
    tablero(g, bx, by, bw, bh, lw*6, lw);
    g.font = `700 ${bh*.42}px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    const letras = [...'ようこそ'], anchos = letras.map(l => g.measureText(l).width), total = anchos.reduce((a, b) => a + b);
    let x = w/2 - total/2;
    letras.forEach((l, i) => { const xc = x + anchos[i]/2; neon(g, C.naranja, '#ffe6c8', lw*1.5, () => { g.strokeText(l, xc, by + bh*.4); }, kl[i]); x += anchos[i]; });
    const yl = by + bh*.68;
    neon(g, C.rojo, '#ffd9c8', lw*1.2, pintar => {
      g.beginPath(); g.moveTo(bx + bw*.18, yl); g.lineTo(bx + bw*.82, yl);
      g.moveTo(bx + bw*.18, yl - lw*6); g.lineTo(bx + bw*.18, yl + lw*6); g.moveTo(bx + bw*.82, yl - lw*6); g.lineTo(bx + bw*.82, yl + lw*6);
      pintar();
    }, ks);
    g.font = `500 ${bh*.12}px ${LAT}`;
    neon(g, C.oro, '#fff6dc', lw*.8, () => { g.strokeText('BIENVENIDOS', w/2, by + bh*.84); }, kb);
  },
};
