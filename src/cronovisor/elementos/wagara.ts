/*
 * Patrones tradicionales (wagara), el primer elemento (Eze, 2026-11-27). Tres fondos geométricos japoneses, dibujados
 * con las reglas del dragón (estilo.ts): sólo la paleta de fuego, la sombra oscura que separa cada pieza, y el filo
 * crema de un solo lado, no en todas. Estáticos por ahora: el movimiento previsto queda en `animacion`, para la etapa 2.
 */
import { C, SOMBRA, TAU, hash } from '../dragon/estilo';
import type { Elemento } from './index';

const ANIMACION = 'Patrones tradicionales animados (Wagara): fondos geométricos como Seigaiha (ondas de mar), Asanoha (hoja de cáñamo) o Shippo (círculos entrelazados) que pulsan o cambian de color al ritmo de la música del local.';
const GRUPO = 'Patrones tradicionales (wagara)';
const grosor = (w: number) => Math.max(2, w/420);

// mezcla de dos colores #rrggbb, en #rrggbb
function mezcla(a: string, b: string, f: number){
  const ca = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), cb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return '#' + ca.map((v, i) => Math.round(v + (cb[i] - v)*f).toString(16).padStart(2, '0')).join('');
}

// Seigaiha (las olas del mar azul): abanicos de anillos concéntricos en filas; cada fila tapa la de arriba, como tejas.
// Los anillos, de afuera hacia adentro, del rojo profundo al dorado pálido; la sombra entre anillo y anillo; el filo
// crema, sólo en el arco de arriba a la izquierda del anillo exterior.
// Animado (Eze, 2026-11-27, el primero en moverse): un mar de fondo. Una marejada ancha cruza el patrón en diagonal:
// donde pasa la cresta, los abanicos se levantan un poco y se encienden (cada anillo toma algo del color del de adentro)
// y el filo crema crece como espuma; en el valle bajan y se apagan. Además todo el mar deriva despacio hacia un lado.
// En bucle exacto: la marejada da una vuelta cada `OLA` s y la deriva recorre un módulo del patrón (2R) cada `2·OLA`.
const OLA = 9;
export const seigaiha: Elemento = {
  id: 'seigaiha', grupo: GRUPO, nombre: 'Seigaiha · olas del mar',
  descripcion: 'Abanicos de anillos superpuestos en filas, como tejas: cada fila tapa la de arriba. Animado: una marejada lenta los levanta y los enciende al pasar, y el mar deriva.',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    const R = w/9, lw = grosor(w), anillos = [C.pata, C.rojoOsc, C.rojo, C.naranja, C.claro];
    const fase = (t % (OLA*2))/OLA, deriva = R*2*(fase/2), lambda = w*.95;
    g.fillStyle = C.pata; g.fillRect(0, 0, w, h);
    for(let fila = 0, y = -R*.2; y < h + R; y += R*.5, fila++){
      for(let x = (fila % 2 ? R : 0) - R*4 + deriva; x < w + R*2; x += R*2){
        // la marejada en este abanico: 1 en la cresta, -1 en el valle (la cresta avanza hacia abajo a la derecha)
        const ola = Math.sin(TAU*(fase - (x*.8 + y*.6)/lambda)), cresta = Math.pow(Math.max(0, ola), 1.6);
        const yy = y - R*.07*ola;
        anillos.forEach((col, k) => {
          const r = R*(1 - k*.19);
          g.beginPath(); g.arc(x, yy, r, 0, TAU);
          g.fillStyle = mezcla(col, anillos[Math.min(4, k + 1)], cresta*.75); g.fill();
          g.strokeStyle = SOMBRA; g.lineWidth = lw*(k ? 1.4 : 2.4); g.stroke();
        });
        // la espuma: el filo crema, más largo y más claro en la cresta
        g.beginPath(); g.arc(x, yy, R*.96, -Math.PI*.92, -Math.PI*(.6 - .25*cresta));
        g.strokeStyle = mezcla(C.oro, C.borde, .4 + .6*cresta); g.globalAlpha = .55 + .45*cresta; g.lineWidth = lw*(1 + cresta*.8); g.stroke();
        g.globalAlpha = 1;
      }
    }
  },
};

// Asanoha (la hoja de cáñamo): una red de triángulos; cada triángulo se parte en tres "cometas", una por vértice, y las
// seis cometas que rodean un mismo vértice forman una estrella de seis puntas; cada estrella toma un color distinto de
// sus vecinas (tres colores en la red). Encima, las líneas tradicionales (los lados y los radios del centro a cada
// vértice) en sombra, y un filo crema en unos pocos radios.
// Animado (Eze, 2026-11-27): latidos que nacen en el centro y se abren en anillos, como la hoja que crece. Al pasar el
// frente, cada estrella se enciende en oro, sus radios brillan, y cambia al color siguiente de los tres (todas a la vez
// en el mismo anillo, así dos vecinas nunca quedan iguales); tras el frente, el color nuevo se asienta despacio.
// En bucle exacto: un latido cada `LATIDO` s; tres latidos devuelven cada estrella a su color (3·LATIDO, 13,5 s).
const LATIDO = 4.5;
const suave01 = (x: number) => { const q = Math.min(1, Math.max(0, x)); return q*q*(3 - 2*q); };
export const asanoha: Elemento = {
  id: 'asanoha', grupo: GRUPO, nombre: 'Asanoha · hoja de cáñamo',
  descripcion: 'Estrellas de seis puntas hechas de cometas. Animado: latidos que salen del centro en anillos; al pasar, cada estrella se enciende en oro y cambia de color.',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    const s = w/6.5, hh = s*Math.sqrt(3)/2, lw = grosor(w);
    const colores = [C.rojo, C.rojoOsc, C.naranja], cx0 = w/2, cy0 = h/2, lambda = w*.42;
    // el latido en un punto: cuántos frentes pasaron ya (entero) y hace cuánto pasó el último (0..1 de un latido)
    const latido = (x: number, y: number) => { const f = (t % (LATIDO*3))/LATIDO - Math.hypot(x - cx0, y - cy0)/lambda + 3; return { n: Math.floor(f), q: f - Math.floor(f) }; };
    // el color de la estrella de un vértice: coordenadas de la red (u, v) con x = u·s + v·s/2, y = v·hh; (u - v) mod 3
    // da tres colores sin que dos estrellas vecinas se repitan; cada latido corre los tres un lugar, a todas a la vez
    const colorDe = (x: number, y: number) => {
      const v = Math.round(y/hh), u = Math.round((x - v*s/2)/s), { n, q } = latido(u*s + v*s/2, v*hh);
      const i = (((u - v + n) % 3) + 3) % 3, antes = colores[(i + 2) % 3], ahora = colores[i];
      const base = mezcla(antes, ahora, suave01(q/.35));
      return mezcla(base, C.claro, .5*Math.exp(-q*7));   // el destello, hacia el dorado pálido (hacia el oro, el rojo oscuro se volvía oliva)
    };
    g.fillStyle = C.pata; g.fillRect(0, 0, w, h);
    const tris: number[][][] = [];
    for(let j = -1; j*hh < h + hh; j++) for(let i = -3; i*s/2 < w + s; i++){
      const arriba = ((i + j) % 2 + 2) % 2 === 0, x0 = i*s/2, y0 = j*hh;
      tris.push(arriba ? [[x0, y0 + hh], [x0 + s/2, y0], [x0 + s, y0 + hh]] : [[x0, y0], [x0 + s, y0], [x0 + s/2, y0 + hh]]);
    }
    for(const tri of tris){
      const cx = (tri[0][0] + tri[1][0] + tri[2][0])/3, cy = (tri[0][1] + tri[1][1] + tri[2][1])/3;
      for(let k = 0; k < 3; k++){
        const a = tri[k], b = tri[(k + 1) % 3], c = tri[(k + 2) % 3];
        const mab = [(a[0] + b[0])/2, (a[1] + b[1])/2], mca = [(a[0] + c[0])/2, (a[1] + c[1])/2];
        g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(mab[0], mab[1]); g.lineTo(cx, cy); g.lineTo(mca[0], mca[1]); g.closePath();
        g.fillStyle = colorDe(a[0], a[1]); g.fill();
      }
    }
    for(const tri of tris){
      const cx = (tri[0][0] + tri[1][0] + tri[2][0])/3, cy = (tri[0][1] + tri[1][1] + tri[2][1])/3;
      g.beginPath(); g.moveTo(tri[0][0], tri[0][1]); g.lineTo(tri[1][0], tri[1][1]); g.lineTo(tri[2][0], tri[2][1]); g.closePath();
      for(const v of tri){ g.moveTo(cx, cy); g.lineTo(v[0], v[1]); }
      g.strokeStyle = SOMBRA; g.lineWidth = lw*1.3; g.stroke();
      // los radios brillan en oro justo cuando pasa el frente
      const { q } = latido(cx, cy), brillo = Math.exp(-q*9);
      if(brillo > .03){ g.beginPath(); for(const v of tri){ g.moveTo(cx, cy); g.lineTo(v[0], v[1]); } g.strokeStyle = C.borde; g.globalAlpha = brillo*.8; g.lineWidth = lw; g.stroke(); g.globalAlpha = 1; }
      tri.forEach((v, k) => { if(hash(cx*.017 + cy*.031 + k) < .1){ g.beginPath(); g.moveTo(cx, cy); g.lineTo(v[0], v[1]); g.strokeStyle = C.borde; g.lineWidth = lw*.8; g.stroke(); } });
    }
  },
};

// Shippo (los siete tesoros): círculos en una red cuadrada, cada uno cruzándose con sus cuatro vecinos; las lentes que
// se forman, en naranja; las estrellas de cuatro puntas entre ellas, en rojo; el fondo, rojo profundo. La sombra
// recorre los círculos, y un filo crema aparece arriba a la izquierda de algunos.
// Animado (Eze, 2026-11-27): los anillos de una cadena que gira. Cada círculo lleva cuatro destellos de oro que corren por
// su borde, en sentidos alternados como en un tablero (uno horario, sus vecinos antihorarios): son espejo unos de otros,
// así que se encuentran a la vez en cada cruce y la luz parece pasar de un anillo al siguiente. Cuando se encuentran,
// las lentes se encienden; los rombos del centro titilan cada uno a su tiempo. En bucle exacto: cada `VUELTA` s los
// destellos avanzan un cuarto de vuelta y todo queda igual.
const VUELTA = 4;
export const shippo: Elemento = {
  id: 'shippo', grupo: GRUPO, nombre: 'Shippo · círculos entrelazados',
  descripcion: 'Círculos que se cruzan con sus cuatro vecinos: lentes y estrellas de cuatro puntas. Animado: destellos de oro corren por los anillos, se encuentran en los cruces y encienden las lentes.',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    const d = w/7, r = d/Math.SQRT2, lw = grosor(w);
    const giro = (t % VUELTA)/VUELTA*Math.PI/2, encuentro = Math.pow(Math.cos(giro*2), 2)**6;   // 1 al cruzarse
    g.fillStyle = C.rojo; g.fillRect(0, 0, w, h);
    const centros: number[][] = [];
    for(let j = -1; j*d < h + d; j++) for(let i = -1; i*d < w + d; i++) centros.push([i*d, j*d]);
    // dentro de cada círculo, lo que no es lente: el rojo profundo
    for(const [x, y] of centros){ g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = C.rojoOsc; g.fill(); }
    // las lentes: la intersección de cada círculo con su vecino de la derecha y el de abajo
    for(const [x, y] of centros) for(const [dx, dy] of [[d, 0], [0, d]]){
      g.save(); g.beginPath(); g.arc(x, y, r, 0, TAU); g.clip();
      g.beginPath(); g.arc(x + dx, y + dy, r, 0, TAU); g.fillStyle = mezcla(C.naranja, C.claro, encuentro*.6); g.fill();
      g.restore();
    }
    // y en el centro de cada círculo, un pequeño rombo dorado (el tesoro)
    for(const [x, y] of centros){
      const q = r*(.16 + .05*Math.sin(TAU*(t/VUELTA + hash(x*.011 + y*.017))));
      g.beginPath(); g.moveTo(x, y - q); g.lineTo(x + q, y); g.lineTo(x, y + q); g.lineTo(x - q, y); g.closePath();
      g.fillStyle = C.claro; g.fill(); g.strokeStyle = SOMBRA; g.lineWidth = lw; g.stroke();
    }
    for(const [x, y] of centros){
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.strokeStyle = SOMBRA; g.lineWidth = lw*1.8; g.stroke();
      if(hash(x*.013 + y*.029) < .45){ g.beginPath(); g.arc(x, y, r - lw, -Math.PI*.95, -Math.PI*.62); g.strokeStyle = C.borde; g.lineWidth = lw*.9; g.stroke(); }
    }
    // los destellos: cuatro por anillo; en los anillos "pares" van en un sentido y en los impares en el otro, empezando
    // en los cruces (45°, 135°…): espejo de sus vecinos, se encuentran en cada cruce a la vez
    g.save();
    for(const [x, y] of centros){
      const par = (Math.round(x/d) + Math.round(y/d)) % 2 === 0, a0 = par ? Math.PI/4 + giro : Math.PI*3/4 - giro;
      for(let k = 0; k < 4; k++){
        const a = a0 + k*Math.PI/2, largo = .7, dir = par ? 1 : -1;
        // una estela continua (un solo trazo con un degradado cónico: en tramos se veía rayada), transparente en la cola
        // y dorada hasta el destello
        const cola = a - dir*largo, grad = g.createConicGradient(Math.min(a, cola), x, y), f = largo/TAU;
        if(dir > 0){ grad.addColorStop(0, 'rgba(255,208,58,0)'); grad.addColorStop(f*.7, 'rgba(255,208,58,.85)'); grad.addColorStop(f, 'rgba(255,243,220,1)'); }
        else { grad.addColorStop(0, 'rgba(255,243,220,1)'); grad.addColorStop(f*.3, 'rgba(255,208,58,.85)'); grad.addColorStop(f, 'rgba(255,208,58,0)'); }
        grad.addColorStop(Math.min(1, f + .001), 'rgba(255,208,58,0)');
        g.beginPath(); g.arc(x, y, r, Math.min(a, cola), Math.max(a, cola));
        g.strokeStyle = grad; g.lineWidth = lw*2.4; g.lineCap = 'butt'; g.stroke(); g.lineCap = 'round';
        g.beginPath(); g.arc(x + Math.cos(a)*r, y + Math.sin(a)*r, lw*1.6, 0, TAU); g.fillStyle = 'rgba(255,243,220,.9)'; g.fill();
      }
    }
    g.restore();
  },
};
