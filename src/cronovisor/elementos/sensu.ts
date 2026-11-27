/*
 * Abanicos (sensu) y sombrillas (wagasa), el séptimo elemento (Eze, 2026-11-27). Lo que revelan al abrirse son los
 * wagara ya diseñados (seigaiha, asanoha, shippo): así los elementos se hablan entre sí, no sólo con el dragón. En el
 * lenguaje del dragón: varillas de laca oscura con un filo de luz, pliegues que alternan luz y sombra, borde dorado, la
 * sombra oscura alrededor. Estáticos (abiertos, y una fila de aperturas como instante de la coreografía); el movimiento
 * previsto, en `animacion`.
 */
import { C, SOMBRA, TAU } from '../dragon/estilo';
import type { Elemento } from './index';
import { seigaiha, asanoha, shippo } from './wagara';

const ANIMACION = 'Abanicos (Sensu) o Sombrillas (Wagasa): abriéndose y cerrándose de forma sincronizada, revelando patrones geométricos en su interior.';
const GRUPO = 'Abanicos (sensu) y sombrillas (wagasa)';
const LACA = '#2a0d08';

// un wagara dibujado una vez en su propio lienzo (para recortarlo dentro del papel)
const patrones = new Map<string, HTMLCanvasElement>();
function patron(e: { id: string; dibujar(g: CanvasRenderingContext2D, w: number, h: number, t: number): void }, tam: number){
  const clave = e.id + tam;
  if(!patrones.has(clave)){ const c = document.createElement('canvas'); c.width = c.height = tam; const g = c.getContext('2d')!; g.lineJoin = 'round'; e.dibujar(g, tam, tam, 0); patrones.set(clave, c); }
  return patrones.get(clave)!;
}

// Un sensu: el eje en (px, py), de radio R, abierto `apertura` radianes (centrado hacia arriba), con `diseno` en el
// papel. El papel es un sector de corona entre .42R y R, plegado en `pliegues` facetas que alternan luz y sombra; debajo,
// las varillas que salen del eje; las dos de afuera (oyabone), más gruesas, sobre el papel.
function sensu(g: CanvasRenderingContext2D, px: number, py: number, R: number, apertura: number, diseno: HTMLCanvasElement, lw: number, pliegues = 18){
  const a0 = -Math.PI/2 - apertura/2, a1 = -Math.PI/2 + apertura/2, r0 = R*.42;
  const pto = (r: number, a: number) => ({ x: px + Math.cos(a)*r, y: py + Math.sin(a)*r });
  // las varillas de abajo, del eje hasta el papel
  for(let k = 0; k <= pliegues; k++){
    const a = a0 + (a1 - a0)*k/pliegues, p = pto(r0*1.02, a);
    g.beginPath(); g.moveTo(px, py); g.lineTo(p.x, p.y); g.strokeStyle = SOMBRA; g.lineWidth = lw*2.4; g.stroke();
    g.strokeStyle = LACA; g.lineWidth = lw*1.4; g.stroke();
  }
  // el papel: sombra alrededor, el diseño recortado, y los pliegues
  const papel = () => { g.beginPath(); g.arc(px, py, R, a0, a1); g.arc(px, py, r0, a1, a0, true); g.closePath(); };
  papel(); g.strokeStyle = SOMBRA; g.lineWidth = lw*3; g.stroke();
  g.save(); papel(); g.clip();
  g.drawImage(diseno, px - R, py - R, R*2, R*2);
  for(let k = 0; k < pliegues; k++){
    const b0 = a0 + (a1 - a0)*k/pliegues, b1 = a0 + (a1 - a0)*(k + 1)/pliegues;
    g.beginPath(); g.moveTo(pto(r0, b0).x, pto(r0, b0).y); g.arc(px, py, R, b0, b1); g.arc(px, py, r0, b1, b0, true); g.closePath();
    g.fillStyle = k % 2 ? 'rgba(0,0,0,.28)' : 'rgba(255,230,200,.06)'; g.fill();
    g.beginPath(); const p0 = pto(r0, b0), p1 = pto(R, b0); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y);
    g.strokeStyle = k % 2 ? 'rgba(0,0,0,.45)' : 'rgba(255,240,220,.18)'; g.lineWidth = lw*.7; g.stroke();
  }
  g.restore();
  // el borde de afuera, dorado, con un filo de luz de un lado
  g.beginPath(); g.arc(px, py, R, a0, a1); g.strokeStyle = C.oro; g.lineWidth = lw*1.6; g.stroke();
  g.beginPath(); g.arc(px, py, R - lw*1.2, a0, a0 + (a1 - a0)*.45); g.strokeStyle = C.borde; g.lineWidth = lw*.6; g.stroke();
  g.beginPath(); g.arc(px, py, r0, a0, a1); g.strokeStyle = C.oro; g.lineWidth = lw*1; g.stroke();
  // las dos varillas de afuera (oyabone): más gruesas, por encima del papel, con su filo de luz
  for(const a of [a0, a1]){
    const p = pto(R*1.01, a);
    g.beginPath(); g.moveTo(px, py); g.lineTo(p.x, p.y); g.strokeStyle = SOMBRA; g.lineWidth = lw*5; g.stroke();
    g.strokeStyle = LACA; g.lineWidth = lw*3.2; g.stroke();
    g.strokeStyle = 'rgba(255,192,106,.5)'; g.lineWidth = lw*.7; g.stroke();
  }
  // el remache dorado del eje
  g.beginPath(); g.arc(px, py, lw*3.2, 0, TAU); g.fillStyle = C.oro; g.fill(); g.strokeStyle = SOMBRA; g.lineWidth = lw; g.stroke();
  g.beginPath(); g.arc(px - lw, py - lw, lw*1.1, 0, TAU); g.fillStyle = '#fff3dc'; g.fill();
}

// La animación (Eze, 2026-11-27): abrirse y cerrarse. `abierto(c)` da cuánto está abierto (0 a 1) en el segundo `c` de
// un ciclo: cerrado, se abre con un pequeño rebote (como una muñeca que lo despliega de un golpe), queda abierto, se
// cierra parejo, y espera cerrado.
const suave = (x: number) => { const q = Math.min(1, Math.max(0, x)); return q*q*(3 - 2*q); };
const rebote = (x: number) => { const q = Math.min(1, Math.max(0, x)), k = 1.7; return 1 + (k + 1)*Math.pow(q - 1, 3) + k*Math.pow(q - 1, 2); };
function abierto(c: number, abre: number, dura: number, cierra: number, durc: number){
  if(c < abre) return 0;
  if(c < cierra) return rebote((c - abre)/dura);
  return 1 - suave((c - cierra)/durc);
}

// el sensu: en un ciclo de `SENSU` s se abre de un golpe, se abanica (se mece de un lado al otro, como en la mano), se
// cierra y espera
const SENSU = 10;
export const sensuAbierto: Elemento = {
  id: 'sensu', grupo: GRUPO, nombre: 'Sensu · abanico abierto',
  descripcion: 'El abanico plegable: pliegues que alternan luz y sombra, varillas de laca, remache dorado, y el seigaiha en el papel. Animado: se abre de un golpe revelando el patrón, se abanica y se cierra.',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const lw = Math.max(2, w/420), R = Math.min(w*.46, h*.78), c = t % SENSU, k = abierto(c, 1, 1.1, 7.2, 1.3);
    // abanicarse: mientras está abierto se mece alrededor del eje
    const mece = Math.sin(Math.max(0, c - 2)*TAU/1.6)*.09*suave((c - 2)/.6)*(1 - suave((c - 6.6)/.6));
    g.save(); g.translate(w/2, h*.9); g.rotate(mece); g.translate(-w/2, -h*.9);
    sensu(g, w/2, h*.9, R, Math.PI*(.05 + .81*k), patron(seigaiha, 900), lw);
    g.restore();
  },
};

// Una wagasa vista desde abajo: un círculo de papel en gajos (cada gajo entre dos varillas), el asanoha recortado
// dentro, gajos alternando luz y sombra, el borde un poco festoneado entre varilla y varilla, las varillas desde el
// centro, y el hilado de colores (kagari-ito) alrededor del eje, como en las de verdad.
const WAGASA = 13;
export const wagasa: Elemento = {
  id: 'wagasa', grupo: GRUPO, nombre: 'Wagasa · desde abajo',
  descripcion: 'La sombrilla de papel vista desde abajo: varillas en abanico, gajos con el asanoha, y el hilado de colores del centro. Animada: se abre, gira despacio como en una danza, y se cierra.',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    // en un ciclo de `WAGASA` s: cerrada (vista desde abajo es un círculo chico, el papel flojo), se abre, gira despacio
    // (la sombrilla de las danzas, que se hace girar), frena, se cierra
    const c = t % WAGASA, k = abierto(c, .8, 1.6, 9.4, 1.4), giro = 10*TAU/28*suave((c - 1.5)/8.2);   // diez gajos justos: al volver a empezar, cerrada, no se nota el salto
    const lw = Math.max(2, w/420), cx = w/2, cy = h/2, Rmax = Math.min(w, h)*.46, R = Rmax*(.16 + .84*k), N = 28;
    const flojo = .955 - (1 - k)*.25;   // cerrada, el papel cuelga entre varilla y varilla
    g.save(); g.translate(cx, cy); g.rotate(giro); g.translate(-cx, -cy);
    const borde = () => {
      g.beginPath();
      for(let k = 0; k <= N; k++){
        const a = k/N*TAU, am = (k + .5)/N*TAU;
        const p = { x: cx + Math.cos(a)*R, y: cy + Math.sin(a)*R };
        k ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y);
        if(k < N) g.quadraticCurveTo(cx + Math.cos(am)*R*flojo, cy + Math.sin(am)*R*flojo, cx + Math.cos(a + TAU/N)*R, cy + Math.sin(a + TAU/N)*R);
      }
      g.closePath();
    };
    borde(); g.strokeStyle = SOMBRA; g.lineWidth = lw*3; g.stroke();
    g.save(); borde(); g.clip();
    // el asanoha, en grande (sus líneas más las varillas, a escala chica, eran un ruido de líneas cruzadas)
    g.drawImage(patron(asanoha, 1000), cx - R*1.9, cy - R*1.9, R*3.8, R*3.8);
    for(let k = 0; k < N; k++){
      const a0 = k/N*TAU, a1 = (k + 1)/N*TAU;
      g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, R*1.02, a0, a1); g.closePath();
      g.fillStyle = k % 2 ? 'rgba(0,0,0,.24)' : 'rgba(255,230,200,.05)'; g.fill();
    }
    // la luz que pasa por el papel: más clara hacia el centro, como vista contra el cielo
    const luz = g.createRadialGradient(cx, cy, R*.1, cx, cy, R); luz.addColorStop(0, 'rgba(255,200,140,.18)'); luz.addColorStop(1, 'rgba(0,0,0,.25)');
    g.fillStyle = luz; g.fillRect(cx - R, cy - R, R*2, R*2);
    g.restore();
    // las varillas
    for(let k = 0; k < N; k++){
      const a = k/N*TAU;
      g.beginPath(); g.moveTo(cx + Math.cos(a)*R*.12, cy + Math.sin(a)*R*.12); g.lineTo(cx + Math.cos(a)*R*.99, cy + Math.sin(a)*R*.99);
      g.strokeStyle = SOMBRA; g.lineWidth = lw*1.8; g.stroke(); g.strokeStyle = LACA; g.lineWidth = lw; g.stroke();
    }
    g.beginPath(); for(let k = 0; k <= N; k++){ const a = k/N*TAU; g.lineTo(cx + Math.cos(a)*R, cy + Math.sin(a)*R); }
    g.strokeStyle = C.oro; g.lineWidth = lw*1.3; g.stroke();
    // el hilado de colores alrededor del eje: anillos de hilo cruzado en la paleta
    const hilos = [C.oro, C.rojo, C.claro, C.rojoOsc, C.naranja];
    hilos.forEach((col, i) => {
      const r = R*(.22 - i*.022);
      for(let k = 0; k < N; k++){
        const a = k/N*TAU + (i % 2 ? TAU/N/2 : 0), b = a + TAU/N;
        g.beginPath(); g.moveTo(cx + Math.cos(a)*r, cy + Math.sin(a)*r); g.lineTo(cx + Math.cos(b)*(r - R*.022), cy + Math.sin(b)*(r - R*.022));
        g.strokeStyle = col; g.lineWidth = lw*1.1; g.stroke();
      }
    });
    g.beginPath(); g.arc(cx, cy, R*.1, 0, TAU); g.fillStyle = LACA; g.fill(); g.strokeStyle = SOMBRA; g.lineWidth = lw*1.5; g.stroke();
    g.beginPath(); g.arc(cx, cy, R*.045, 0, TAU); g.fillStyle = C.oro; g.fill();
    g.restore();
  },
};

// La coreografía, congelada: cinco sensu en fila, cada uno un poco más abierto que el anterior (el instante de
// abrirse de forma sincronizada, en ola), revelando por turnos seigaiha, asanoha y shippo.
const FILA = 12;
export const sensuFila: Elemento = {
  id: 'sensu-fila', grupo: GRUPO, nombre: 'Coreografía de abanicos',
  descripcion: 'Cinco abanicos en fila revelando los tres wagara. Animado: se abren en ola, uno tras otro, se mecen juntos y se cierran en ola.',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    // la coreografía, en un ciclo de `FILA` s: se abren en ola de izquierda a derecha, se mecen todos a la vez (un
    // abanicarse sincronizado), y se cierran en ola, en el mismo orden
    const lw = Math.max(1.5, w/600), R = w*.135, disenos = [seigaiha, asanoha, shippo, seigaiha, asanoha], c = t % FILA;
    for(let i = 0; i < 5; i++){
      const k = abierto(c - i*.28, 1, 1, 8, 1.1), px = w*(.1 + i*.185), py = h*.8;
      const mece = Math.sin(Math.max(0, c - 3.6)*TAU/1.8)*.1*suave((c - 3.6)/.5)*(1 - suave((c - 7.4)/.5));
      g.save(); g.translate(px, py); g.rotate(mece); g.translate(-px, -py);
      sensu(g, px, py, R, Math.PI*(.04 + .8*k), patron(disenos[i], 600), lw, 14);
      g.restore();
    }
  },
};
