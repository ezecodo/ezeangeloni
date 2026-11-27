/*
 * Monte Fuji minimalista, el noveno elemento (Eze, 2026-11-27). Formas planas: la montaña de laderas cóncavas y cumbre
 * achatada, la nieve con su borde dentado y sus surcos, nubes estilizadas a la manera del ukiyo-e (bandas con remates
 * redondos) que pasan por delante de la cumbre. Tres iluminaciones, en la paleta de fuego: amanecer (un rosa de fuego,
 * no chicle), noche estrellada (estrellas cálidas, sin azules), eclipse (disco negro con corona dorada). Estáticos; el
 * paso de las nubes y los cambios de luz quedan en `animacion`.
 */
import { C, SOMBRA, TAU, hash } from '../dragon/estilo';
import type { Elemento } from './index';

const ANIMACION = 'Monte Fuji minimalista: con nubes pasando por la cima y cambios de iluminación (amanecer rosado, noche estrellada, eclipse).';
const GRUPO = 'Monte Fuji';

type Luz = { cielo: [string, string, string]; monte: [string, string]; nieve: [string, string]; nube: string; filoNube: string; filoNieve: string };

// la silueta: base ancha, laderas cóncavas, cumbre achatada con dos muescas
function monte(w: number, h: number){
  const base = h*.98, cima = h*.32, cx = w*.5, anchoBase = w*.5, anchoCima = w*.06;
  const pts: number[][] = [];
  // laderas cóncavas: suaves junto a la base y cada vez más empinadas hacia la cumbre (la altura sube con q^1.8)
  for(let k = 0; k <= 40; k++){ const q = k/40; pts.push([cx - anchoBase + (anchoBase - anchoCima)*q, base - (base - cima)*Math.pow(q, 1.8)]); }
  pts.push([cx - anchoCima*.4, cima + h*.008], [cx - anchoCima*.1, cima], [cx + anchoCima*.2, cima + h*.01], [cx + anchoCima*.55, cima]);
  for(let k = 40; k >= 0; k--){ const q = k/40; pts.push([cx + anchoBase - (anchoBase - anchoCima)*q, base - (base - cima)*Math.pow(q, 1.8)]); }
  return { pts, cx, cima, base, anchoBase, anchoCima };
}

// La animación (Eze, 2026-11-27): las nubes pasan despacio por delante de la cumbre (cruzan de un lado al otro y vuelven
// a entrar: en bucle exacto de `CICLO` s) y cada luz tiene su cambio: el sol que sube, las estrellas que titilan y una
// estrella fugaz, el eclipse que se cierra hasta la totalidad y se abre.
const CICLO = 30;
function dibujarFuji(g: CanvasRenderingContext2D, w: number, h: number, L: Luz, extra: (g: CanvasRenderingContext2D, w: number, h: number) => void, t = 0, sombra = 0){
  const lw = Math.max(2, w/420);
  const cielo = g.createLinearGradient(0, 0, 0, h);
  cielo.addColorStop(0, L.cielo[0]); cielo.addColorStop(.55, L.cielo[1]); cielo.addColorStop(1, L.cielo[2]);
  g.fillStyle = cielo; g.fillRect(0, 0, w, h);
  extra(g, w, h);   // sol, luna, estrellas, eclipse: detrás de la montaña
  const M = monte(w, h);
  const silueta = () => { g.beginPath(); M.pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.lineTo(M.cx + M.anchoBase, h); g.lineTo(M.cx - M.anchoBase, h); g.closePath(); };
  silueta(); g.strokeStyle = SOMBRA; g.lineWidth = lw*2.5; g.stroke();
  const roca = g.createLinearGradient(M.cx - M.anchoBase, 0, M.cx + M.anchoBase, 0);
  roca.addColorStop(0, L.monte[0]); roca.addColorStop(1, L.monte[1]);
  g.fillStyle = roca; g.fill();
  // la nieve: el tercio de arriba, con el borde de abajo dentado (lenguas de nieve que bajan por los surcos)
  g.save(); silueta(); g.clip();
  const limite = M.cima + (M.base - M.cima)*.22;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(w, 0); g.lineTo(w, limite);
  for(let k = 24; k >= 0; k--){
    const x = M.cx - M.anchoBase*.45 + k/24*M.anchoBase*.9;
    const lengua = (hash(k*3.7) - .3)*(M.base - M.cima)*.09*(1 - Math.abs(k/24 - .5));
    g.lineTo(x, limite + lengua + (k % 2 ? (M.base - M.cima)*.025 : 0));
  }
  g.lineTo(0, limite); g.closePath();
  const nieve = g.createLinearGradient(M.cx - M.anchoBase*.4, 0, M.cx + M.anchoBase*.4, 0);
  nieve.addColorStop(0, L.nieve[0]); nieve.addColorStop(1, L.nieve[1]);
  g.fillStyle = nieve; g.fill(); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = lw; g.stroke();
  // los surcos en la nieve: líneas que bajan desde la cima, en sombra suave
  for(let k = -4; k <= 4; k++){
    if(!k) continue;
    g.beginPath(); g.moveTo(M.cx + k*M.anchoCima*.22, M.cima + h*.01);
    g.quadraticCurveTo(M.cx + k*M.anchoBase*.08, limite - h*.04, M.cx + k*M.anchoBase*.12, limite + h*.03);
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = lw*1.2; g.stroke();
  }
  // el filo de luz de la nieve, del lado izquierdo
  g.beginPath(); M.pts.slice(14, 41).forEach(([x, y], i) => i ? g.lineTo(x + lw, y + lw) : g.moveTo(x + lw, y + lw));
  g.strokeStyle = L.filoNieve; g.lineWidth = lw*1.1; g.stroke();
  g.restore();
  // las nubes, por delante de la cumbre: bandas con remates redondos (como en el ukiyo-e), en dos alturas
  const nube = (x: number, y: number, largo: number, alto: number) => {
    g.beginPath();
    g.moveTo(x, y + alto);
    g.arc(x + alto*.5, y + alto*.5, alto*.5, Math.PI*.5, Math.PI*1.5);
    for(let k = 0; k < 4; k++){ const bx = x + alto*.5 + k*largo/4; g.arc(bx + largo/8, y + alto*.15, largo/8, Math.PI, 0); }
    g.arc(x + alto*.5 + largo, y + alto*.5, alto*.5, -Math.PI*.5, Math.PI*.5);
    g.closePath();
    g.fillStyle = L.nube; g.fill(); g.strokeStyle = SOMBRA; g.lineWidth = lw*1.6; g.stroke();
    g.beginPath(); g.moveTo(x + alto*.4, y + alto*.15); g.lineTo(x + largo*.55, y + alto*.15); g.strokeStyle = L.filoNube; g.lineWidth = lw*.9; g.stroke();
  };
  // la montaña y la nieve se apagan con el eclipse (antes de las nubes, que tienen su propio filo)
  if(sombra > 0){ g.save(); silueta(); g.fillStyle = `rgba(0,0,0,${sombra})`; g.fill(); g.restore(); }
  // pocas y chicas (minimalista): una cruzando la cima, otra más abajo; pasan de izquierda a derecha y vuelven a entrar
  const pasa = (x0: number, largo: number, vueltas: number) => { const tramo = w + largo + h*.1; return ((x0 + w*.05 + (t % CICLO)/CICLO*vueltas*tramo) % tramo + tramo) % tramo - largo - h*.05; };
  nube(pasa(M.cx - w*.03, w*.2, 1), M.cima + h*.03, w*.2, h*.05);
  nube(pasa(M.cx - w*.42, w*.24, 2), M.cima + h*.26, w*.24, h*.055);
}

export const fujiAmanecer: Elemento = {
  id: 'fuji-amanecer', grupo: GRUPO, nombre: 'Fuji · amanecer',
  descripcion: 'El cielo del rojo profundo al melocotón, el sol naciendo, la nieve teñida de un rosa de fuego. Animado: el sol sube detrás de la ladera y las nubes pasan.',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    // el sol sube a lo largo del ciclo; al final se apaga a oscuras y vuelve a nacer (un telón de un segundo)
    const c = t % CICLO, sube = c/CICLO;
    dibujarFuji(g, w, h, {
      cielo: ['#3a0e0a', '#c8402c', '#ffc08a'], monte: ['#6a1c14', '#3a0e0a'], nieve: ['#ffd8c2', '#f29a7e'],
      nube: '#ffcfa8', filoNube: '#fff3dc', filoNieve: '#fff3dc',
    }, (g, w, h) => {
      // el sol, grande y bajo, detrás de la ladera derecha
      const sx = w*.74 - sube*w*.04, sy = h*(.8 - sube*.36), r = h*.17;
      const halo = g.createRadialGradient(sx, sy, r*.8, sx, sy, r*2.6); halo.addColorStop(0, 'rgba(255,208,58,.45)'); halo.addColorStop(1, 'rgba(255,208,58,0)');
      g.fillStyle = halo; g.fillRect(sx - r*3, sy - r*3, r*6, r*6);
      g.beginPath(); g.arc(sx, sy, r, 0, TAU); g.fillStyle = '#ffe3a0'; g.fill();
    }, t);
    const telon = Math.max(1 - c/1.2, (c - (CICLO - 1.2))/1.2);
    if(telon > 0){ g.fillStyle = `rgba(0,0,0,${telon})`; g.fillRect(0, 0, w, h); }
  },
};

export const fujiNoche: Elemento = {
  id: 'fuji-noche', grupo: GRUPO, nombre: 'Fuji · noche estrellada',
  descripcion: 'Cielo casi negro con estrellas cálidas, una luna creciente, la nieve apenas iluminada y las nubes con filo de luna. Animado: las estrellas titilan, cruza una estrella fugaz y las nubes pasan.',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    dibujarFuji(g, w, h, {
      cielo: ['#000', '#0c0405', '#24090a'], monte: ['#1e0806', '#0c0403'], nieve: ['#c9b8a2', '#6e5a4c'],
      nube: '#22110d', filoNube: C.claro, filoNieve: '#f2e2c8',
    }, (g, w, h) => {
      // estrellas: puntos cálidos, unas pocas más grandes con su brillo
      for(let k = 0; k < 160; k++){
        const x = hash(k*1.3)*w, y = Math.pow(hash(k*2.7), 1.4)*h*.7, r = .6 + hash(k*5.1)*1.8;
        g.beginPath(); g.arc(x, y, r*(w/960), 0, TAU); g.fillStyle = hash(k*9.1) < .3 ? C.claro : '#fff3dc';
        g.globalAlpha = (.4 + hash(k*7.7)*.6)*(.65 + .35*Math.sin(t*(1 + hash(k*4.3)*3) + k)); g.fill();
      }
      g.globalAlpha = 1;
      // una estrella fugaz, una vez por ciclo, cruzando en diagonal y apagándose
      const f = ((t % CICLO) - 12)/1.1;   // (a los 12 s de cada ciclo)
      if(f > 0 && f < 1){
        const x0 = w*.15, y0 = h*.1, x1 = x0 + w*.32*f, y1 = y0 + h*.12*f, cola = .25;
        const gr = g.createLinearGradient(x1 - w*.32*cola, y1 - h*.12*cola, x1, y1); gr.addColorStop(0, 'rgba(255,243,220,0)'); gr.addColorStop(1, `rgba(255,243,220,${1 - f})`);
        g.beginPath(); g.moveTo(x1 - w*.32*cola, y1 - h*.12*cola); g.lineTo(x1, y1); g.strokeStyle = gr; g.lineWidth = Math.max(1.5, w/500); g.stroke();
      }
      // la luna creciente, arriba a la derecha
      const mx = w*.78, my = h*.2, r = h*.07;
      const halo = g.createRadialGradient(mx, my, r, mx, my, r*3.5); halo.addColorStop(0, 'rgba(255,220,170,.25)'); halo.addColorStop(1, 'rgba(255,220,170,0)');
      g.fillStyle = halo; g.fillRect(mx - r*4, my - r*4, r*8, r*8);
      // la creciente: la luna recortada por un círculo corrido (sin tapar el cielo con un disco)
      g.save(); g.beginPath(); g.rect(0, 0, w, h); g.arc(mx + r*.45, my - r*.15, r*.92, 0, TAU); g.clip('evenodd');
      g.beginPath(); g.arc(mx, my, r, 0, TAU); g.fillStyle = '#ffe9c4'; g.fill(); g.restore();
    }, t);
  },
};

export const fujiEclipse: Elemento = {
  id: 'fuji-eclipse', grupo: GRUPO, nombre: 'Fuji · eclipse',
  descripcion: 'Un disco negro sobre la cumbre, con su corona dorada y sus rayos; la montaña en silueta. Animado: la luna tapa el sol hasta la totalidad (la corona, el anillo de diamante) y lo vuelve a destapar.',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    // el eclipse a lo largo del ciclo: la luna cruza el sol; `total` es 1 en la totalidad
    const c = t % CICLO, paso = (c/CICLO)*2 - 1, total = Math.max(0, 1 - Math.abs(paso)/.1);
    dibujarFuji(g, w, h, {
      cielo: ['#060202', '#1c0605', '#3a0e0a'], monte: ['#120504', '#080202'], nieve: ['#5a3a2e', '#2a1712'],
      nube: '#170806', filoNube: C.naranja, filoNieve: C.naranja,
    }, (g, w, h) => {
      // el eclipse, justo encima de la cumbre: rayos de la corona, el anillo dorado y el disco negro
      const ex = w*.5, ey = h*.17, r = h*.1, sol = 1 - total;
      // el sol, mientras no está tapado del todo, brilla; la luna (el disco negro) lo cruza
      const luna = { x: ex + paso*r*2.6, y: ey - paso*r*.4 };
      if(sol > 0){
        const halo = g.createRadialGradient(ex, ey, r*.9, ex, ey, r*3); halo.addColorStop(0, `rgba(255,208,58,${.5*sol})`); halo.addColorStop(1, 'rgba(255,208,58,0)');
        g.fillStyle = halo; g.fillRect(ex - r*3, ey - r*3, r*6, r*6);
        g.beginPath(); g.arc(ex, ey, r, 0, TAU); g.fillStyle = '#ffe3a0'; g.fill();
      }
      // la corona y sus rayos, sólo cerca de la totalidad, girando apenas
      g.globalAlpha = total;
      for(let k = 0; k < 48; k++){
        const a = k/48*TAU + t*.02, largo = r*(1.5 + hash(k*3.1)*1.4*(.85 + .15*Math.sin(t*.7 + k)));
        g.beginPath(); g.moveTo(ex + Math.cos(a)*r, ey + Math.sin(a)*r); g.lineTo(ex + Math.cos(a)*largo, ey + Math.sin(a)*largo);
        g.strokeStyle = `rgba(255,192,106,${.12 + hash(k)*.25})`; g.lineWidth = Math.max(1, w/700)*(1 + hash(k*2)*2); g.stroke();
      }
      const corona = g.createRadialGradient(ex, ey, r*.95, ex, ey, r*1.8); corona.addColorStop(0, 'rgba(255,208,58,.9)'); corona.addColorStop(.25, 'rgba(246,116,74,.45)'); corona.addColorStop(1, 'rgba(232,67,46,0)');
      g.fillStyle = corona; g.beginPath(); g.arc(ex, ey, r*1.8, 0, TAU); g.fill();
      g.globalAlpha = 1;
      g.beginPath(); g.arc(luna.x, luna.y, r*1.01, 0, TAU); g.fillStyle = '#060202'; g.fill();
      // el anillo de diamante: el destello justo antes y justo después de la totalidad, del lado por donde entra o sale el sol
      // (la luna entra por la izquierda y un poco abajo: el último hilo de sol queda arriba a la derecha; al salir, el
      // primero aparece abajo a la izquierda)
      const borde = Math.abs(Math.abs(paso) - .055);
      if(borde < .035){
        const lado = paso < 0 ? -.35 : Math.PI - .35, a = 1 - borde/.035, px = ex + Math.cos(lado)*r, py = ey + Math.sin(lado)*r;
        const d = g.createRadialGradient(px, py, 0, px, py, r*.45); d.addColorStop(0, `rgba(255,252,240,${a})`); d.addColorStop(.25, `rgba(255,236,190,${a*.7})`); d.addColorStop(1, 'rgba(255,220,160,0)');
        g.fillStyle = d; g.fillRect(px - r*.5, py - r*.5, r, r);
        g.strokeStyle = `rgba(255,248,230,${a*.8})`; g.lineWidth = Math.max(1, w/900);
        for(const [dx, dy] of [[1, 0], [0, 1], [.7, .7], [.7, -.7]]){ g.beginPath(); g.moveTo(px - dx*r*.5*a, py - dy*r*.5*a); g.lineTo(px + dx*r*.5*a, py + dy*r*.5*a); g.stroke(); }
      }
    }, t, .55*total);
  },
};
