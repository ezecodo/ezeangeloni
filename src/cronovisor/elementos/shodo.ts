/*
 * Caligrafía (shodō) y tinta, el segundo elemento (Eze, 2026-11-27). La tinta negra sobre la mesa negra no se vería, así
 * que en el lenguaje del dragón es "tinta que arde": el trazo es sumi casi negra, con su pincel seco (kasure: las vetas
 * donde el pincel se queda sin tinta), y su borde brilla como una brasa (rojo y naranja); al final del trazo la tinta se
 * deshace en partículas doradas, un instante congelado de la transformación que se animará en la etapa 2.
 */
import { C, TAU, hash, lim, type P } from '../dragon/estilo';
import type { Elemento } from './index';

const ANIMACION = 'Caligrafía japonesa (Shodō) y tinta: trazos de pincel negro que se dibujan solos en el aire y se transforman en humo o partículas doradas.';
const GRUPO = 'Caligrafía (shodō) y tinta';
const SUMI = '#2c0c08';          // la tinta: un negro rojizo, para que su cuerpo y su pincel seco se lean sobre el negro

// Una pincelada: `linea` es el centro del trazo (de donde apoya el pincel a donde lo levanta), `ancho(q)` su grosor a lo
// largo (q de 0 a 1). Se dibuja: el resplandor de brasa alrededor, el cuerpo de tinta, el borde encendido, el pincel
// seco (vetas sin tinta hacia el final, `seco` desde dónde empieza a secarse), y las partículas doradas en que se
// deshace la punta (`polvo`: cuántas). `sem` da a cada trazo su propio carácter.
// `soplo` (0 a 1, animación): el polvo de la punta se aleja, sube y se apaga.
export function pincelada(g: CanvasRenderingContext2D, linea: P[], ancho: (q: number) => number, lw: number, sem: number, seco = .7, polvo = 60, soplo = 0){
  const n = linea.length - 1, izq: P[] = [], der: P[] = [], nor: P[] = [];
  for(let j = 0; j <= n; j++){
    const a = linea[Math.max(0, j - 1)], b = linea[Math.min(n, j + 1)];
    let tx = b.x - a.x, ty = b.y - a.y; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    // el borde del pincel no es liso: tiembla apenas, distinto en cada lado
    const q = j/n, w = ancho(q), t1 = 1 + .06*(hash(sem + j*.7) - .5), t2 = 1 + .06*(hash(sem + 50 + j*.7) - .5);
    nor.push({ x: -ty, y: tx });
    izq.push({ x: linea[j].x - ty*w*t1, y: linea[j].y + tx*w*t1 }); der.push({ x: linea[j].x + ty*w*t2, y: linea[j].y - tx*w*t2 });
  }
  // el contorno, con el apoyo del pincel redondeado al empezar (un pincel no apoya en corte recto)
  const a0 = Math.atan2(izq[0].y - linea[0].y, izq[0].x - linea[0].x);
  const contorno = () => {
    g.beginPath(); g.moveTo(izq[0].x, izq[0].y); for(const p of izq) g.lineTo(p.x, p.y); for(let j = n; j >= 0; j--) g.lineTo(der[j].x, der[j].y);
    g.arc(linea[0].x, linea[0].y, ancho(0), a0 + Math.PI, a0, true);   // por detrás del trazo (no por delante: hacía una muesca)
    g.closePath();
  };
  // el resplandor de brasa, por fuera
  g.save(); contorno(); g.shadowColor = 'rgba(232,67,46,.75)'; g.shadowBlur = lw*14; g.fillStyle = SUMI; g.fill(); g.restore();
  // el cuerpo de tinta, con un brillo húmedo a lo largo (más claro en el medio del trazo, que se apaga hacia la punta)
  contorno(); g.fillStyle = SUMI; g.fill();
  g.save(); contorno(); g.clip();
  g.beginPath(); for(let j = 0; j <= Math.round(n*.75); j++){ const p = { x: linea[j].x + nor[j].x*ancho(j/n)*.25, y: linea[j].y + nor[j].y*ancho(j/n)*.25 }; j ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); }
  g.strokeStyle = 'rgba(184,36,26,.45)'; g.lineWidth = Math.max(lw, ancho(.3)*.5); g.stroke();
  g.restore();
  // el pincel seco: vetas a lo largo, del color del fondo, que se abren hacia el final del trazo
  g.save(); contorno(); g.clip();
  for(let k = 0; k < 11; k++){
    const off = (k/10 - .5)*1.7, desde = Math.floor(n*(seco - .25*hash(sem + k*3.1))), grueso = lw*(.6 + 1.4*hash(sem + k));
    g.beginPath();
    for(let j = desde; j <= n; j++){ const q = j/n, w = ancho(q); const p = { x: linea[j].x + nor[j].x*off*w, y: linea[j].y + nor[j].y*off*w }; j === desde ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y); }
    g.strokeStyle = '#000'; g.lineWidth = grueso; g.stroke();
  }
  g.restore();
  // el borde encendido: rojo alrededor, y un filo naranja de un solo lado (como el filo de luz del dragón)
  contorno(); g.strokeStyle = C.rojoOsc; g.lineWidth = lw*1.2; g.stroke();
  g.beginPath(); for(let j = 0; j <= Math.round(n*.8); j++) j ? g.lineTo(izq[j].x, izq[j].y) : g.moveTo(izq[j].x, izq[j].y);
  g.strokeStyle = C.naranja; g.lineWidth = lw*.9; g.stroke();
  // la punta se deshace en partículas doradas: siguen la dirección del trazo, se abren y se achican al alejarse
  const fin = linea[n], ant = linea[Math.max(0, n - 6)];
  let dx = fin.x - ant.x, dy = fin.y - ant.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
  const wFin = ancho(.9);
  for(let k = 0; k < polvo; k++){
    const r1 = hash(sem*1.3 + k*.91), r2 = hash(sem*2.1 + k*1.7), r3 = hash(sem*.7 + k*2.3);
    const lejos = Math.pow(r1, 1.6)*wFin*14 + soplo*wFin*(4 + 8*r2), abre = (r2 - .5)*(wFin*1.2 + lejos*.7);
    const x = fin.x + dx*lejos - dy*abre, y = fin.y + dy*lejos + dx*abre - lejos*.25*r3 - soplo*wFin*6*r1;   // y suben un poco, como humo
    const tam = lim(lw*(2.6 - lejos/(wFin*6))*(.5 + r3), lw*.3, lw*3.5);
    g.save(); g.shadowColor = 'rgba(255,208,58,.8)'; g.shadowBlur = tam*3; g.globalAlpha = Math.max(0, 1 - soplo*(.6 + .6*r3));
    g.beginPath(); g.arc(x, y, tam, 0, TAU); g.fillStyle = r3 < .5 ? C.oro : C.claro; g.fill(); g.restore();
  }
}

// muestrea una curva por puntos de control (Catmull-Rom), para el centro de un trazo
function curva(ctl: number[][], w: number, h: number, pasos = 80): P[] {
  const n = ctl.length - 1, out: P[] = [];
  for(let j = 0; j <= pasos; j++){
    const q = j/pasos*n, i = Math.min(n - 1, Math.floor(q)), f = q - i;
    const p0 = ctl[Math.max(0, i - 1)], p1 = ctl[i], p2 = ctl[i + 1], p3 = ctl[Math.min(n, i + 2)];
    const v = [0, 1].map(k => .5*((2*p1[k]) + (-p0[k] + p2[k])*f + (2*p0[k] - 5*p1[k] + 4*p2[k] - p3[k])*f*f + (-p0[k] + 3*p1[k] - 3*p2[k] + p3[k])*f*f*f));
    out.push({ x: v[0]*w, y: v[1]*h });
  }
  return out;
}

// Trazos vivos (la animación del shodō, Eze, 2026-11-27): dibuja uno o varios trazos a medio escribir (`prog` de cada
// uno, 0 a 1, con su punta de brasa), con el polvo de las puntas yéndose como humo (`soplo`) y, al final, deshaciéndose
// desde donde empezó cada uno (`deshecho`), borrados con un borde suave en su propio lienzo mientras la tinta se vuelve
// partículas doradas que suben y se apagan.
type Trazo = { linea: P[]; ancho: (q: number) => number; sem: number; seco: number; polvo: number };
// cada trazo en su propio lienzo: borrar uno no hace agujeros en los que se le cruzan
const lienzosVivos: HTMLCanvasElement[] = [];
const facil = (x: number) => { const q = lim(x, 0, 1); return q < .5 ? 4*q*q*q : 1 - Math.pow(-2*q + 2, 3)/2; };
function vivos(g: CanvasRenderingContext2D, w: number, h: number, trazos: Trazo[], prog: number[], soplo: number, deshecho: number, lw: number, alto: number){
  trazos.forEach((tr, i) => {
    let c = lienzosVivos[i];
    if(!c || c.width !== w || c.height !== h){ c = lienzosVivos[i] = document.createElement('canvas'); c.width = w; c.height = h; }
    const e = c.getContext('2d')!; e.clearRect(0, 0, w, h); e.lineJoin = 'round'; e.lineCap = 'round';
    const p = prog[i]; if(p <= 0) return;
    const N = tr.linea.length - 1, n = Math.max(2, Math.round(N*p));
    pincelada(e, tr.linea.slice(0, n + 1), q => tr.ancho(q*p), lw, tr.sem, p < tr.seco ? 2 : tr.seco/p, p >= 1 ? tr.polvo : 0, soplo);
    if(deshecho > 0){
      e.save(); e.globalCompositeOperation = 'destination-out'; e.strokeStyle = '#000'; e.fillStyle = '#000';
      const corte = Math.round(N*deshecho), L = tr.linea;
      let mx = 0; for(let k = 0; k <= 20; k++) mx = Math.max(mx, tr.ancho(k/20)); const ancho = mx*2.3 + lw*16;
      e.lineWidth = ancho; e.lineCap = 'butt';
      e.beginPath(); for(let j = 0; j <= corte; j++) j ? e.lineTo(L[j].x, L[j].y) : e.moveTo(L[j].x, L[j].y); e.stroke();
      // el apoyo redondo del pincel, que queda por detrás del principio, con su brillo
      e.beginPath(); e.arc(L[0].x, L[0].y, ancho*.55, 0, TAU); e.fill();
      // el borde, suave: delante del corte se borra cada vez menos (con un corte duro quedaba un disco negro en el brillo)
      const pluma = Math.round(N*.11);
      for(let j = 0; j < pluma && corte + j < N; j++){
        e.beginPath(); e.moveTo(L[corte + j].x, L[corte + j].y); e.lineTo(L[corte + j + 1].x, L[corte + j + 1].y);
        e.globalAlpha = 1 - (j + 1)/(pluma + 1); e.stroke();
      }
      // al final se va también lo que queda de la punta y su polvo
      if(deshecho > .97){ e.globalAlpha = (deshecho - .97)/.03; e.fillRect(0, 0, w, h); }
      e.restore();
    }
    g.drawImage(c, 0, 0);
  });
  // la punta de brasa de los trazos que se están escribiendo
  trazos.forEach((tr, i) => {
    const p = prog[i]; if(p <= 0 || p >= 1) return;
    const N = tr.linea.length - 1, pt = tr.linea[Math.max(1, Math.round(N*p))], rr = tr.ancho(p)*.9 + lw*2;
    const b = g.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, rr*2.2); b.addColorStop(0, 'rgba(255,214,140,.9)'); b.addColorStop(.4, 'rgba(232,67,46,.5)'); b.addColorStop(1, 'rgba(232,67,46,0)');
    g.fillStyle = b; g.beginPath(); g.arc(pt.x, pt.y, rr*2.2, 0, TAU); g.fill();
  });
  // al deshacerse, las partículas: nacen en el borde que avanza y suben, se abren y se apagan
  if(deshecho > 0){
    g.save(); g.globalCompositeOperation = 'lighter';
    trazos.forEach((tr, i) => {
      const N = tr.linea.length - 1, cuantas = Math.round(N*1.6);
      for(let k = 0; k < cuantas; k++){
        const q = hash(k*1.31 + i*7.7)*deshecho, edad = (deshecho - q)/.25;
        if(edad > 1) continue;
        const j = Math.min(N - 1, Math.round(N*q)), a = tr.linea[j], b = tr.linea[j + 1], ww = tr.ancho(q);
        let nx = -(b.y - a.y), ny = b.x - a.x; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
        const off = (hash(k*2.7 + i) - .5)*ww*1.8;
        const x = a.x + nx*off + (hash(k*5.1 + i) - .5)*alto*.08*edad, y = a.y + ny*off - alto*.12*edad*(.5 + hash(k*3.3 + i));
        g.globalAlpha = (1 - edad)*(.7 + .3*hash(k + i));
        g.beginPath(); g.arc(x, y, lw*(1.6 + 1.6*hash(k*7.9 + i))*(1 - edad*.5), 0, TAU); g.fillStyle = hash(k*9.1 + i) < .5 ? C.oro : C.claro; g.fill();
      }
    });
    g.restore();
  }
}

// Ensō: el círculo zen de una sola pincelada. Apoya con fuerza arriba a la izquierda (una gota de tinta), recorre casi
// toda la vuelta adelgazándose, y antes de cerrar el pincel se seca y la tinta se vuelve polvo dorado.
// Animado, en un ciclo de `ENSO` s: el pincel apoya, el círculo se escribe solo (lento al apoyar, rápido en la vuelta,
// lento al levantar, como una mano), queda respirando mientras el polvo de la punta se va como humo, se deshace desde
// donde empezó, una pausa a oscuras, y vuelve a empezar.
const ENSO = 13;
export const enso: Elemento = {
  id: 'enso', grupo: GRUPO, nombre: 'Ensō · el círculo',
  descripcion: 'El círculo zen de una sola pincelada. Animado: se escribe solo, queda respirando y se deshace en polvo dorado que sube, en un ciclo.',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const lw = Math.max(2, w/420), cx = w*.5, cy = h*.5, R = Math.min(w, h)*.33;
    const linea: P[] = [];
    for(let j = 0; j <= 160; j++){
      const q = j/160, a = -Math.PI*.62 + q*TAU*.9, r = R*(1 + .035*Math.sin(q*9 + 1) + .02*Math.sin(q*23));
      linea.push({ x: cx + Math.cos(a)*r, y: cy + Math.sin(a)*r });
    }
    const ancho = (q: number) => R*(.13*Math.exp(-q*9) + .075*(1 - q*.55) + .02*Math.sin(q*7))*(q > .85 ? 1 - (q - .85)/.15*.7 : 1);
    // el reloj del ciclo: 0.5 s quieto, 3.2 s escribiendo, 4.3 s quieto, 3.6 s deshaciéndose, 1.4 s a oscuras
    const c = t % ENSO;
    vivos(g, w, h, [{ linea, ancho, sem: 3.7, seco: .62, polvo: 90 }], [facil((c - .5)/3.2)], lim((c - 3.7)/4.3, 0, 1), lim((c - 8)/3.6, 0, 1), lw, R*3);
  },
};

// 火 (fuego): el kanji en cuatro trazos de pincel: los dos puntos que se abren a los lados, el trazo largo que baja y
// barre a la izquierda, y el que barre a la derecha ensanchándose; las puntas de los dos barridos se hacen polvo dorado.
// Animado, en un ciclo de `FUEGO` s: los cuatro trazos se escriben en el orden de la caligrafía (el punto de la
// izquierda, el de la derecha, el largo que barre a la izquierda, el que barre a la derecha), cada uno a su ritmo y con
// el pincel que se levanta entre uno y otro; el kanji queda ardiendo, y se deshace en polvo dorado.
const FUEGO = 14;
const ORDEN: [number, number][] = [[.5, .5], [1.25, .5], [2.05, 1.3], [3.65, 1.35]];   // cuándo empieza y cuánto dura cada trazo
export const fuego: Elemento = {
  id: 'kanji-fuego', grupo: GRUPO, nombre: '火 · fuego',
  descripcion: 'El kanji de fuego en cuatro trazos de pincel. Animado: se escribe en el orden de la caligrafía, queda ardiendo y se deshace en polvo dorado.',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const lw = Math.max(2, w/420), s = Math.min(w, h)*.84, ox = (w - s)/2, oy = (h - s)/2;
    const en = (ctl: number[][]) => curva(ctl, s, s).map(p => ({ x: p.x + ox, y: p.y + oy }));
    const S = s;
    const trazos: Trazo[] = [
      // los dos puntos: cortos, gruesos al apoyar, se afinan
      { linea: en([[.26, .35], [.31, .44], [.35, .53]]), ancho: q => S*.052*(1.3 - q*.85), sem: 11, seco: .8, polvo: 0 },
      { linea: en([[.75, .32], [.70, .42], [.64, .51]]), ancho: q => S*.052*(1.3 - q*.85), sem: 17, seco: .8, polvo: 0 },
      // el trazo largo: baja desde arriba al centro y barre hacia abajo a la izquierda, afinándose
      { linea: en([[.52, .12], [.52, .3], [.5, .5], [.42, .68], [.28, .82], [.14, .9]]), ancho: q => S*(.06 - q*.038 + .02*Math.exp(-q*12)), sem: 23, seco: .72, polvo: 50 },
      // el barrido a la derecha: nace fino en el centro, se ensancha y se levanta en una punta
      { linea: en([[.5, .52], [.58, .64], [.68, .76], [.8, .86], [.9, .9]]), ancho: q => S*(.016 + .062*Math.sin(Math.min(1, q*1.15)*Math.PI*.9)), sem: 31, seco: .78, polvo: 60 },
    ];
    // el reloj: los cuatro trazos hasta ~5 s, quieto ardiendo hasta 9.4, deshaciéndose 3.4 s, a oscuras hasta 14
    const c = t % FUEGO;
    vivos(g, w, h, trazos, ORDEN.map(([desde, dura]) => facil((c - desde)/dura)), lim((c - 5.2)/4.2, 0, 1), lim((c - 9.4)/3.4, 0, 1), lw, s);
  },
};
