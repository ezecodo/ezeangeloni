/*
 * Cerezos en flor (sakura) y hojas de arce (momiji), el undécimo elemento (Eze, 2026-11-27): pétalos y hojas cayendo,
 * para transiciones entre animaciones o profundidad de fondo. El momiji es la paleta de fuego en estado puro; el sakura
 * es rosa, en el "rosa de fuego" melocotón del amanecer del Fuji. La profundidad, como en el dragón: lo lejano más chico
 * y más oscuro (`Hondura`), nunca transparente. Cientos de piezas: cada pieza se dibuja una sola vez por tamaño
 * (`figura`) y cada cuadro sólo se copia, girada y achicada. Animados: caen (ver `caer`).
 */
import { C, SOMBRA, TAU, hash, Hondura } from '../dragon/estilo';
import type { Elemento } from './index';

const ANIMACION = 'Cerezos en flor (Sakura) / Hojas de arce (Momiji): pétalos cayendo suavemente con el viento. Es el recurso perfecto para transiciones entre animaciones o para dar sensación de profundidad en segundo plano.';
const GRUPO = 'Sakura y momiji';
const MOMIJI = [C.rojo, C.rojoOsc, C.naranja, C.claro, '#d8541e'];
const SAKURA: [string, string][] = [['#ffe2d2', '#f2a088'], ['#ffd8c2', '#e8866c'], ['#fff0e2', '#f6b098']];

// Una hoja de arce japonés: siete lóbulos puntiagudos en abanico (más largos los del medio), el pecíolo, las nervaduras.
// Primero la sombra de todos los lóbulos y después el relleno: así el contorno queda sólo por fuera.
function momiji(g: CanvasRenderingContext2D, x: number, y: number, r: number, giro: number, inclina: number, col: string, lw: number){
  g.save(); g.translate(x, y); g.rotate(giro); g.scale(1, Math.max(.25, Math.cos(inclina)));
  const lobulos = [-2.35, -1.55, -.8, 0, .8, 1.55, 2.35].map(a => ({ a: a - Math.PI/2, l: r*(a === 0 ? 1 : Math.abs(a) < 1 ? .92 : Math.abs(a) < 2 ? .74 : .48) }));
  const lobulo = (a: number, l: number) => {
    const ancho = l*.26, dx = Math.cos(a), dy = Math.sin(a), px = -dy, py = dx;
    g.beginPath(); g.moveTo(0, 0);
    g.quadraticCurveTo(dx*l*.45 + px*ancho, dy*l*.45 + py*ancho, dx*l, dy*l);
    g.quadraticCurveTo(dx*l*.45 - px*ancho, dy*l*.45 - py*ancho, 0, 0);
  };
  for(const { a, l } of lobulos){ lobulo(a, l); g.strokeStyle = SOMBRA; g.lineWidth = lw*1.6; g.stroke(); }
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, r*.45); g.strokeStyle = SOMBRA; g.lineWidth = lw*2; g.stroke();
  for(const { a, l } of lobulos){ lobulo(a, l); g.fillStyle = col; g.fill(); }
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, r*.45); g.strokeStyle = col; g.lineWidth = lw; g.stroke();
  // nervaduras, del centro a cada punta, y un filo de luz en un lóbulo
  for(const { a, l } of lobulos){ g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a)*l*.85, Math.sin(a)*l*.85); g.strokeStyle = 'rgba(60,8,4,.45)'; g.lineWidth = lw*.6; g.stroke(); }
  const { a, l } = lobulos[2]; g.beginPath(); g.moveTo(Math.cos(a)*l*.2, Math.sin(a)*l*.2); g.lineTo(Math.cos(a)*l*.8, Math.sin(a)*l*.8); g.strokeStyle = 'rgba(255,243,220,.6)'; g.lineWidth = lw*.6; g.stroke();
  g.restore();
}

// Un pétalo de sakura: una gota ancha con la muesca en la punta, más oscuro en la base, girado e inclinado
function petalo(g: CanvasRenderingContext2D, x: number, y: number, r: number, giro: number, inclina: number, col: [string, string], lw: number){
  g.save(); g.translate(x, y); g.rotate(giro); g.scale(1, Math.max(.2, Math.cos(inclina)));
  const forma = () => {
    // ovalado, más largo que ancho, con una muesca chica en la punta (una muesca honda lo volvía un corazón)
    g.beginPath(); g.moveTo(0, r*.62);
    g.bezierCurveTo(-r*.55, r*.25, -r*.5, -r*.7, -r*.1, -r*.7);
    g.lineTo(0, -r*.58);
    g.lineTo(r*.1, -r*.7);
    g.bezierCurveTo(r*.5, -r*.7, r*.55, r*.25, 0, r*.62); g.closePath();
  };
  forma(); g.strokeStyle = SOMBRA; g.lineWidth = lw*1.2; g.stroke();
  const gr = g.createLinearGradient(0, r*.55, 0, -r*.6); gr.addColorStop(0, col[1]); gr.addColorStop(.6, col[0]); gr.addColorStop(1, col[0]);
  g.fillStyle = gr; g.fill();
  g.beginPath(); g.moveTo(-r*.05, r*.4); g.quadraticCurveTo(-r*.45, -r*.05, -r*.18, -r*.5); g.strokeStyle = 'rgba(255,248,236,.55)'; g.lineWidth = lw*.6; g.stroke();
  g.restore();
}

// La animación (Eze, 2026-11-27): las piezas caen, a distintas profundidades. Cada una se pinta una sola vez como
// figurita (`figura`: por tipo, color y uno de `NIVELES` de oscuridad, al tamaño más grande) y cada cuadro sólo se copia
// girada, achicada por la hondura y aplastada por su vaivén (el coseno de su inclinación: así gira sobre sí misma, de
// frente a de canto). Las lejanas caen más lento en pantalla (paralaje) y más oscuras, nunca transparentes. El viento
// las lleva de lado, en ondas.
const NIVELES = 8;
const figuras = new Map<string, HTMLCanvasElement>();
function figura(tipo: 'momiji' | 'petalo', col: number, nivel: number, R: number, lw: number){
  const clave = `${tipo}:${col}:${nivel}:${Math.round(R)}`;
  if(!figuras.has(clave)){
    const lado = Math.ceil(R*2.6), c = document.createElement('canvas'); c.width = c.height = lado;
    const g = c.getContext('2d')!; g.lineJoin = 'round'; g.lineCap = 'round';
    const hond = new Hondura(); hond.osc = Math.max(.12, nivel/(NIVELES - 1));
    const gz = hond.envolver(g);
    if(tipo === 'momiji') momiji(gz, lado/2, lado/2, R, 0, 0, MOMIJI[col], lw);
    else petalo(gz, lado/2, lado/2, R, 0, 0, SAKURA[col], lw);
    figuras.set(clave, c);
  }
  return figuras.get(clave)!;
}
type Pieza = { tipo: 'momiji' | 'petalo'; col: number; x: number; y: number; z: number; i: number };
// cada pieza en el segundo t: cae (más rápido cuanto más cerca), el viento la corre de lado en ondas, gira y se vuelca
function caer(g: CanvasRenderingContext2D, w: number, h: number, piezas: Pieza[], t: number, R: { momiji: number; petalo: number }, lw: number, viento = 1){
  for(const p of [...piezas].sort((a, b) => b.z - a.z)){
    const k = 1/(1 + p.z*.6), nivel = Math.round(Math.max(.12, Math.pow(1 - p.z/4.4, 1.3))*(NIVELES - 1));
    const r = R[p.tipo], baja = h*(.05 + .05*hash(p.i*4.7))*k*(p.tipo === 'momiji' ? 1.2 : .9);   // px por segundo
    const tramo = h + r*3, y = ((p.y*tramo + t*baja) % tramo) - r*1.5;
    const x = p.x*w + viento*(Math.sin(t*(.35 + hash(p.i)*.3) + p.i) * w*.05 + Math.sin(t*1.3 + p.i*2.7)*w*.012)*k;
    const giro = hash(p.i*5.3)*TAU + t*(hash(p.i*8.1) - .5)*1.6, vuelco = Math.cos(t*(.9 + hash(p.i*7.1)*1.4) + p.i);
    const f = figura(p.tipo, p.col, nivel, r, lw), lado = f.width;
    g.save(); g.translate(((x % (w + r*3)) + w + r*3) % (w + r*3) - r*1.5, y); g.rotate(giro); g.scale(k, k*Math.max(.18, Math.abs(vuelco)));
    g.drawImage(f, -lado/2, -lado/2); g.restore();
  }
}
const piezasDe = (n: number, sem: number, tipo: (i: number) => 'momiji' | 'petalo') => Array.from({ length: n }, (_, i) => {
  const tp = tipo(i);
  return { tipo: tp, col: i % (tp === 'momiji' ? MOMIJI.length : SAKURA.length), x: hash(sem + i*2.11), y: hash(sem + i*3.07), z: Math.pow(hash(sem + i*1.37), .7)*4, i };
});

export const momijiCae: Elemento = {
  id: 'momiji', grupo: GRUPO, nombre: 'Momiji cayendo',
  descripcion: 'Hojas de arce en rojos, naranjas y dorados, a distintas profundidades: las lejanas, chicas y oscuras. Animado: caen girando y volcándose, llevadas por el viento.',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const lw = Math.max(1.5, w/520);
    caer(g, w, h, piezasDe(70, 11, () => 'momiji'), t, { momiji: w*.085, petalo: 0 }, lw);
  },
};

export const sakuraCae: Elemento = {
  id: 'sakura', grupo: GRUPO, nombre: 'Sakura cayendo',
  descripcion: 'Pétalos de cerezo con su muesca, en un rosa de fuego, a distintas profundidades. Animado: caen girando, de frente a de canto, llevados por el viento.',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const lw = Math.max(1.5, w/520);
    caer(g, w, h, piezasDe(110, 23, () => 'petalo'), t, { momiji: 0, petalo: w*.062 }, lw, .8);
  },
};

// La cortina de transición: una banda diagonal densa de pétalos y hojas que cruza la pantalla de abajo a la izquierda a
// arriba a la derecha y taparía una animación para descubrir la siguiente; afuera de la banda, sueltas, cada vez menos.
// Animada en un ciclo de `CORTINA` s: la banda entra, cruza (en el medio tapa casi todo) y sale; una pausa vacía. Las
// piezas, además, giran y se vuelcan en su lugar dentro de la banda.
const CORTINA = 9;
export const cortina: Elemento = {
  id: 'sakura-cortina', grupo: GRUPO, nombre: 'Cortina de transición',
  descripcion: 'Una banda diagonal densa de pétalos y hojas. Animada: cruza la pantalla de punta a punta, el instante de una transición entre animaciones.',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const lw = Math.max(1.5, w/520), c = t % CORTINA, corre = (c/(CORTINA - 1.5))*3.6 - 1.8;   // -1.8 afuera abajo a la derecha, 1.8 afuera arriba a la izquierda
    if(corre > 1.8) return;
    const R = { momiji: w*.07, petalo: w*.05 };
    const piezas = Array.from({ length: 650 }, (_, i) => {
      // a lo largo de la diagonal, concentradas cerca de ella (más dispersas lejos)
      const u = hash(i*1.13)*1.3 - .65, d = (hash(i*2.71) - .5)*Math.pow(hash(i*4.3), 1.3)*1.8, z = Math.pow(hash(i*6.7), .8)*3.5;
      return { i, u, d, z };
    }).sort((a, b) => b.z - a.z);
    for(const p of piezas){
      // la banda corre a lo largo de la diagonal perpendicular a sí misma (se ve avanzar), cada pieza a su paso
      // la banda: a lo largo de la diagonal (abajo a la izquierda → arriba a la derecha), y avanza perpendicular a ella,
      // de abajo a la derecha hacia arriba a la izquierda; las lejanas, un poco rezagadas (paralaje)
      const q = p.d + corre*(1 - p.z*.06), L = Math.hypot(w, h)/2;
      const x = w/2 + p.u*w*.75 - q*L*h/(2*L), y = h/2 - p.u*h*.75 - q*L*w/(2*L);
      if(x < -R.momiji*2 || x > w + R.momiji*2 || y < -R.momiji*2 || y > h + R.momiji*2) continue;
      const k = 1/(1 + p.z*.6), nivel = Math.round(Math.max(.15, Math.pow(1 - p.z/4, 1.2))*(NIVELES - 1));
      const tipo = p.i % 3 === 0 ? 'momiji' : 'petalo', f = figura(tipo, p.i % (tipo === 'momiji' ? MOMIJI.length : SAKURA.length), nivel, R[tipo], lw);
      const giro = hash(p.i*5.3)*TAU + t*(hash(p.i*8.1) - .5)*2.4, vuelco = Math.cos(t*(1.2 + hash(p.i*7.1)*1.6) + p.i);
      g.save(); g.translate(x, y); g.rotate(giro); g.scale(k, k*Math.max(.18, Math.abs(vuelco))); g.drawImage(f, -f.width/2, -f.height/2); g.restore();
    }
  },
};
