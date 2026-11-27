/*
 * Bambú mecido por el viento, el décimo elemento (Eze, 2026-11-27). El bambú es verde, pero la regla del dragón es
 * fuego, nada de verdes: en clave cálida. El bosque al atardecer (tallos a distintas honduras, los lejanos más oscuros
 * por la regla de la profundidad, hojas en silueta con un filo naranja, haces de luz dorada entrando en diagonal) y el
 * bambú dorado de cerca (Phyllostachys aurea, que existe: tallos ámbar con sus nudos, un ramo de hojas, luz moteada).
 * Si Eze lo quiere verde, sería una excepción a la paleta. Estáticos; el vaivén y la luz, en `animacion`.
 */
import { C, SOMBRA, TAU, hash, Hondura } from '../dragon/estilo';
import type { Elemento } from './index';

const ANIMACION = 'Bambú mecido por el viento: tallos de bambú con haces de luz filtrándose entre las hojas. Aporta frescura y elegancia.';
const GRUPO = 'Bambú';

// Un tallo: de (x, abajo) a (x + inclina, arriba), de ancho a; entrenudos cada `seg`; colores [luz, medio, sombra].
// La caña se curva: el corrimiento crece con el cuadrado de la altura (abajo firme, arriba se dobla con el viento).
const enTallo = (x: number, abajo: number, arriba: number, inclina: number, y: number) => x + inclina*Math.pow((abajo - y)/(abajo - arriba), 2);
function tallo(g: CanvasRenderingContext2D, x: number, abajo: number, arriba: number, a: number, inclina: number, seg: number, col: [string, string, string], lw: number, sem: number){
  const xAt = (y: number) => enTallo(x, abajo, arriba, inclina, y);
  const cuerpo = () => {
    g.beginPath();
    for(let k = 0; k <= 16; k++){ const y = abajo + (arriba - abajo)*k/16; k ? g.lineTo(xAt(y) - a/2, y) : g.moveTo(xAt(y) - a/2, y); }
    for(let k = 16; k >= 0; k--){ const y = abajo + (arriba - abajo)*k/16; g.lineTo(xAt(y) + a/2, y); }
    g.closePath();
  };
  cuerpo(); g.strokeStyle = SOMBRA; g.lineWidth = lw*1.6; g.stroke();
  // la caña, redonda: luz de un lado, sombra del otro
  const cx = xAt((abajo + arriba)/2), gr = g.createLinearGradient(cx - a/2, 0, cx + a/2, 0);
  gr.addColorStop(0, col[1]); gr.addColorStop(.28, col[0]); gr.addColorStop(.6, col[1]); gr.addColorStop(1, col[2]);
  g.fillStyle = gr; g.fill();
  // los nudos: un anillo oscuro con una línea clara encima, y el entrenudo apenas abombado
  for(let y = abajo - seg*(.4 + hash(sem)*.6); y > arriba; y -= seg*(.9 + hash(sem + y*.01)*.25)){
    const xx = xAt(y);
    g.beginPath(); g.ellipse(xx, y, a*.56, a*.09, 0, 0, TAU); g.fillStyle = col[2]; g.fill();
    g.beginPath(); g.moveTo(xx - a*.48, y - a*.06); g.lineTo(xx + a*.3, y - a*.06); g.strokeStyle = 'rgba(255,230,190,.45)'; g.lineWidth = Math.max(1, lw*.6); g.stroke();
  }
}

// Una hoja de bambú: lanceolada, de `largo`, saliendo de (x, y) hacia `ang`; color y un filo de un lado.
function hoja(g: CanvasRenderingContext2D, x: number, y: number, largo: number, ang: number, col: string, filo: string, lw: number){
  const ancho = largo*.13, dx = Math.cos(ang), dy = Math.sin(ang), px = -dy, py = dx;
  const punta = { x: x + dx*largo, y: y + dy*largo + largo*.12 };   // un poco caída
  const m = { x: x + dx*largo*.4, y: y + dy*largo*.4 };
  g.beginPath(); g.moveTo(x, y);
  g.quadraticCurveTo(m.x + px*ancho, m.y + py*ancho, punta.x, punta.y);
  g.quadraticCurveTo(m.x - px*ancho, m.y - py*ancho, x, y); g.closePath();
  g.fillStyle = col; g.fill(); g.strokeStyle = SOMBRA; g.lineWidth = lw*.9; g.stroke();
  g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(m.x + px*ancho*.9, m.y + py*ancho*.9, punta.x, punta.y); g.strokeStyle = filo; g.lineWidth = lw*.7; g.stroke();
}

// Un ramo de hojas, como crecen en el bambú: una ramita fina, algo arqueada, y las hojas naciendo alternadas a lo largo
// de ella, de un lado y del otro, colgando un poco (en abanico desde un punto parecían de palmera)
// `t` y `viento` (animación): la ramita cabecea y cada hoja aletea a su ritmo, más cuanto más viento.
function ramo(g: CanvasRenderingContext2D, x: number, y: number, largo: number, dir: number, col: string, filo: string, lw: number, sem: number, n = 6, t = 0, viento = 0){
  dir += viento*.12*Math.sin(t*1.7 + sem);
  const pto = (t: number) => ({ x: x + Math.cos(dir)*largo*t, y: y + Math.sin(dir)*largo*t + largo*.12*t*t });
  g.beginPath(); for(let k = 0; k <= 12; k++){ const p = pto(k/12); k ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y); }
  g.strokeStyle = col; g.lineWidth = lw*1.1; g.stroke();
  for(let k = 0; k < n; k++){
    const t = .25 + .75*k/(n - 1), p = pto(t), lado = k % 2 ? 1 : -1;
    const a0 = dir + lado*(.5 + hash(sem + k)*.3), a = Math.atan2(Math.sin(a0) + .9, Math.cos(a0)) + viento*.22*Math.sin(t*(3 + hash(sem + k*2.3)*2.5) + k*1.7);   // hacia afuera y colgando, aleteando
    hoja(g, p.x, p.y, largo*(.42 + hash(sem*2 + k)*.2), a, col, filo, lw);
  }
}

// los haces de luz: franjas diagonales que se suman (modo "lighter"), más intensas arriba
// `t` (animación): cada haz respira (se abre y se cierra cuando las hojas de arriba se mueven) y se corre apenas
function haces(g: CanvasRenderingContext2D, w: number, h: number, n: number, sem: number, fuerza = 1, t = 0){
  g.save(); g.globalCompositeOperation = 'lighter';
  for(let k = 0; k < n; k++){
    const late = .65 + .35*Math.sin(t*(.5 + hash(sem*3 + k)*.6) + k*2.1)*Math.sin(t*.23 + k);
    const x0 = w*(.05 + hash(sem + k)*.9) + Math.sin(t*.3 + k)*w*.006, ancho = w*(.03 + hash(sem*2 + k)*.06), dx = h*.55;
    const gr = g.createLinearGradient(x0, 0, x0 - dx, h);
    gr.addColorStop(0, `rgba(255,200,110,${(.16 + hash(k*3)*.12)*fuerza*late})`); gr.addColorStop(1, 'rgba(255,200,110,0)');
    g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0 + ancho, 0); g.lineTo(x0 + ancho - dx, h); g.lineTo(x0 - dx, h); g.closePath();
    g.fillStyle = gr; g.fill();
  }
  g.restore();
}

// El viento (Eze, 2026-11-27: "mecido por el viento"): ráfagas que cruzan de izquierda a derecha (`rafaga`, entre 0 y
// 1 según dónde y cuándo), sumadas a un vaivén lento; las cañas se doblan desde abajo, las ramitas cabecean, las hojas
// aletean, los haces de luz respiran. Sin estado: todo sale del reloj.
const rafaga = (t: number, x: number, w: number) => .5 + .5*Math.sin(t*TAU/9 - x/w*2.4)*(.6 + .4*Math.sin(t*TAU/23));

export const bosqueBambu: Elemento = {
  id: 'bambu-bosque', grupo: GRUPO, nombre: 'Bosque de bambú al atardecer',
  descripcion: 'Tallos a distintas honduras (los lejanos, más oscuros), hojas en silueta con filo naranja, y haces de luz dorada entre ellas.',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    const lw = Math.max(1.5, w/480);
    const cielo = g.createLinearGradient(0, 0, 0, h); cielo.addColorStop(0, '#3a1209'); cielo.addColorStop(.5, '#1a0705'); cielo.addColorStop(1, '#060202');
    g.fillStyle = cielo; g.fillRect(0, 0, w, h);
    const hond = new Hondura();
    // tres capas, de la más lejana a la más cercana: más finas y oscuras al fondo
    for(const [capa, n, ancho, osc] of [[0, 14, w*.018, .25], [1, 9, w*.03, .5], [2, 5, w*.055, 1]] as [number, number, number, number][]){
      hond.osc = osc; const gz = hond.envolver(g);
      for(let k = 0; k < n; k++){
        const s = capa*31 + k*7.3, x = w*(hash(s)*1.1 - .05), a = ancho*(.75 + hash(s + 1)*.5);
        // la caña se dobla con el viento: las cercanas (más altas en pantalla) se mueven más; cada una con su propio vaivén
        const v = rafaga(t, x, w), inclina = (hash(s + 2) - .5)*w*.05 + w*(.012 + capa*.008)*(v*1.4 + .25*Math.sin(t*(.9 + hash(s)*.5) + s));
        tallo(gz, x, h*1.02, -h*.02, a, inclina, h*(.16 + capa*.04), ['#6a2a16', '#3a1209', '#14060a'], lw, s);
        // ramos de hojas que salen del tallo hacia los costados, en silueta con el filo naranja
        for(let j = 0; j < 2 + capa; j++){
          const y = h*(.08 + hash(s + j*3.1)*.6), lado = hash(s + j) < .5 ? -1 : 1;
          ramo(gz, enTallo(x, h*1.02, -h*.02, inclina, y), y, a*3.4, lado < 0 ? Math.PI + .35 : -.35, '#1a0806', C.naranja, lw, s + j*11, 6, t, .4 + v);
        }
      }
      if(capa === 1) haces(g, w, h, 7, 13, .9, t);
    }
    g.globalAlpha = 1;
    haces(g, w, h, 4, 57, .6, t);
  },
};

export const bambuDorado: Elemento = {
  id: 'bambu-dorado', grupo: GRUPO, nombre: 'Bambú dorado',
  descripcion: 'De cerca: tallos ámbar con sus nudos, un ramo de hojas, y la luz moteada filtrándose entre ellas.',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    const lw = Math.max(2, w/420);
    g.fillStyle = '#080303'; g.fillRect(0, 0, w, h);
    haces(g, w, h, 5, 91, 1.1, t);
    // de cerca las cañas casi no se doblan (son gruesas): se mecen apenas; lo que se mueve son las hojas
    const tallos: [number, number, number][] = [[w*.22, w*.085, -w*.02], [w*.48, w*.11, w*.015], [w*.8, w*.075, -w*.01]];
    const incs = tallos.map(([x, , inc], i) => inc + w*.012*(rafaga(t, x, w) - .5) + w*.004*Math.sin(t*1.1 + i*2));
    tallos.forEach(([x, a], i) => tallo(g, x, h*1.02, -h*.02, a, incs[i], h*.3, [C.claro, '#d8902e', '#7a3612'], lw, i*9.1));
    // ramos de hojas dorado oscuro y rojizo, con su filo de luz, pegados a su caña
    const en = (i: number, y: number) => enTallo(tallos[i][0], h*1.02, -h*.02, incs[i], y), v = (x: number) => .5 + rafaga(t, x, w);
    ramo(g, en(1, h*.3) + w*.05, h*.3, w*.3, -.3, '#b8501e', '#ffd98a', lw, 3, 8, t, v(w*.53));
    ramo(g, en(0, h*.55) - w*.04, h*.55, w*.24, Math.PI + .3, '#9c3a18', '#ffd98a', lw, 8, 7, t, v(w*.18));
    ramo(g, en(2, h*.14) - w*.02, h*.14, w*.22, Math.PI + .45, '#a8461b', '#ffd98a', lw, 15, 7, t, v(w*.78));
    ramo(g, en(2, h*.62) + w*.03, h*.62, w*.2, -.4, '#9c3a18', '#ffd98a', lw, 21, 6, t, v(w*.83));
    ramo(g, en(1, h*.78) - w*.03, h*.78, w*.22, Math.PI + .3, '#b8501e', '#ffd98a', lw, 27, 6, t, v(w*.45));
    // la luz moteada: manchas cálidas suaves que se corren y laten, como la luz entre hojas que se mueven
    g.save(); g.globalCompositeOperation = 'lighter';
    for(let k = 0; k < 26; k++){
      const x = hash(k*2.1)*w + Math.sin(t*(.6 + hash(k)*.8) + k)*w*.015, y = hash(k*3.7)*h + Math.cos(t*(.5 + hash(k*2)*.7) + k)*h*.012, r = w*(.01 + hash(k*5.3)*.03);
      const late = .5 + .5*Math.sin(t*(1.2 + hash(k*4.4)*2) + k*1.9);
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(255,220,150,${.36*late})`); gr.addColorStop(1, 'rgba(255,220,150,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r*2, r*2);
    }
    g.restore();
  },
};
