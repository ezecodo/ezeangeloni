/*
 * Grullas japonesas (tsuru), el decimoquinto elemento (Eze, 2026-11-27): elegancia y longevidad. La grulla de
 * Manchuria (tanchōzuru): cuerpo blanco (un hueso cálido: la excepción de los blancos, como las caras), cuello y plumas
 * de vuelo negras, la corona roja; de perfil en vuelo, cuello estirado adelante y patas atrás. Las alas en tres poses
 * (arriba, a mitad, abajo) para que la bandada no parezca copiada. Sobre un sol rojo gigante con franjas de nubes, y
 * entre nubes estilizadas de rizos (kumo) en oro. Lo lejano, más chico y oscuro (`Hondura`). Estáticos; el vuelo en
 * cámara lenta, en `animacion`.
 */
import { C, SOMBRA, TAU, hash, Hondura } from '../dragon/estilo';
import type { Elemento } from './index';

const ANIMACION = 'Grullas japonesas (Tsuru): símbolo de elegancia y longevidad. Volando en cámara lenta sobre un sol rojo gigante o entre nubes estilizadas.';
const GRUPO = 'Grullas (tsuru)';
const BLANCO = '#f6ead6', NEGRO = '#140808';

// una grulla en vuelo en (x, y), de largo S (pico a patas), vista desde abajo con las alas abiertas (la vista de los
// emblemas y los kimonos: de perfil, con las alas en alto, parecía una vela), hacia `rumbo` (radianes); `u` la pose
// del batido: 1 las alas extendidas, -1 recogidas (la envergadura se acorta)
function grulla(g: CanvasRenderingContext2D, x: number, y: number, S: number, rumbo: number, u: number, lw: number){
  g.save(); g.translate(x, y); g.rotate(rumbo); g.scale(S, S);
  const L = lw/S, env = .78 + .22*u;
  const ala = (l: 1 | -1) => {
    const P = (px: number, py: number) => [px, l*py*env] as [number, number];
    const hombro = P(.08, .04), muneca = P(.02, .5), punta = P(-.18, .82), atras = P(-.3, .45), raiz = P(-.18, .04);
    const forma = () => {
      g.beginPath(); g.moveTo(...hombro);
      g.quadraticCurveTo(...P(.1, .28), ...muneca);
      g.quadraticCurveTo(...P(-.04, .7), ...punta);
      g.quadraticCurveTo(...P(-.26, .66), ...atras);
      g.quadraticCurveTo(...P(-.3, .2), ...raiz); g.closePath();
    };
    // las primarias, abiertas como dedos en la punta
    for(let i = 0; i < 5; i++){
      const o = P(-.1 - i*.045, .76 - i*.06), ang = Math.atan2(l*env*(.6 - i*.12), -.5 - i*.15), lg = .2 - i*.015;
      const d = [Math.cos(ang), Math.sin(ang)], n = [-d[1], d[0]], a = .022;
      g.beginPath(); g.moveTo(o[0] + n[0]*a, o[1] + n[1]*a);
      g.quadraticCurveTo(o[0] + d[0]*lg*.6 + n[0]*a, o[1] + d[1]*lg*.6 + n[1]*a, o[0] + d[0]*lg, o[1] + d[1]*lg);
      g.quadraticCurveTo(o[0] + d[0]*lg*.6 - n[0]*a, o[1] + d[1]*lg*.6 - n[1]*a, o[0] - n[0]*a, o[1] - n[1]*a); g.closePath();
      g.strokeStyle = SOMBRA; g.lineWidth = L*2.4; g.stroke(); g.fillStyle = BLANCO; g.fill();
    }
    forma(); g.strokeStyle = SOMBRA; g.lineWidth = L*3; g.stroke(); g.fillStyle = BLANCO; g.fill();
    // las secundarias negras: la banda del borde de atrás, con el borde de adelante festoneado
    g.save(); forma(); g.clip();
    g.beginPath(); g.moveTo(...P(-.5, .04)); g.lineTo(...P(-.5, .75));
    for(let i = 0; i <= 7; i++){ const q = i/7, v = .7 - q*.66; g.lineTo(...P(-.25 + q*.09, v)); g.lineTo(...P(-.22 + q*.09, v - .045)); }
    g.closePath(); g.fillStyle = NEGRO; g.fill();
    g.restore();
    forma(); g.strokeStyle = C.pata; g.lineWidth = L*1.1; g.stroke();
    // el filo de luz, en el borde de ataque de un solo ala
    if(l < 0){ g.beginPath(); g.moveTo(...hombro); g.quadraticCurveTo(...P(.1, .28), ...muneca); g.strokeStyle = C.borde; g.lineWidth = L*1.3; g.stroke(); }
  };
  // las patas, finas, estiradas atrás
  g.beginPath(); g.moveTo(-.2, -.015); g.lineTo(-.62, -.02); g.moveTo(-.2, .015); g.lineTo(-.62, .025); g.strokeStyle = NEGRO; g.lineWidth = L*2.4; g.stroke();
  g.strokeStyle = C.pata; g.lineWidth = L*.8; g.stroke();
  ala(1); ala(-1);
  // el cuerpo, un huso blanco; la cola
  g.beginPath(); g.ellipse(-.05, 0, .19, .065, 0, 0, TAU); g.strokeStyle = SOMBRA; g.lineWidth = L*3; g.stroke(); g.fillStyle = BLANCO; g.fill();
  // el cuello negro estirado, la cabeza blanca con la corona roja, el pico
  g.beginPath(); g.moveTo(.1, -.03); g.quadraticCurveTo(.28, -.022, .42, -.018); g.lineTo(.42, .018); g.quadraticCurveTo(.28, .022, .1, .03); g.closePath();
  g.fillStyle = NEGRO; g.fill(); g.strokeStyle = C.pata; g.lineWidth = L; g.stroke();
  g.beginPath(); g.ellipse(.45, 0, .035, .026, 0, 0, TAU); g.fillStyle = BLANCO; g.fill();
  g.beginPath(); g.ellipse(.455, 0, .018, .014, 0, 0, TAU); g.fillStyle = C.rojo; g.fill();
  g.beginPath(); g.moveTo(.48, -.012); g.lineTo(.6, 0); g.lineTo(.48, .012); g.closePath(); g.fillStyle = '#8a6a44'; g.fill();
  g.restore();
}

// una bandada: cada grulla con su pose y su hondura, de la más lejana a la más cercana
// Animada (Eze, 2026-11-27: "volando en cámara lenta"), con `t`: cada grulla bate las alas despacio (un batido cada
// ~2,4 s, la envergadura se acorta arriba y abajo: `u` = coseno del batido, cada una a su tiempo, la cuarta pieza de
// la tupla es su fase) y avanza por el cielo hacia su rumbo, las cercanas más rápido (paralaje); al salir del cuadro
// vuelven a entrar por el otro lado. Planean un poco entre batidos (el coseno se aplana arriba).
function bandada(g: CanvasRenderingContext2D, aves: [number, number, number, number][], w: number, h: number, lw: number, t = 0){
  const hond = new Hondura();
  [...aves].map((a, i) => [a, i] as const).sort((a, b) => a[0][2] - b[0][2]).forEach(([[x, y, s, fase], i]) => {
    hond.osc = Math.min(1, .35 + s*1.3);
    const rumbo = -.35 + (hash(i*3.3) - .5)*.25, v = h*s*.16, m = h*s*.8;
    const ancho = w + m*2, alto = h + m*2;
    const px = (((w*x + Math.cos(rumbo)*v*t + m) % ancho) + ancho) % ancho - m, py = (((h*y + Math.sin(rumbo)*v*t + m) % alto) + alto) % alto - m;
    const b = Math.cos((t/(2.2 + hash(i*5.1)*.6) + fase)*TAU), u = Math.sign(b)*Math.pow(Math.abs(b), .6);
    grulla(hond.envolver(g), px, py - u*h*s*.02, h*s, rumbo + .04*u, u, lw*Math.max(.5, s*2.5));
  });
  g.globalAlpha = 1;
}

export const tsuruSol: Elemento = {
  id: 'tsuru-sol', grupo: GRUPO, nombre: 'Grullas sobre el sol rojo',
  descripcion: 'Una bandada de grullas de Manchuria (blancas, cuello y plumas de vuelo negras, corona roja) cruzando un sol rojo gigante con franjas de nubes.',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    const lw = Math.max(2, w/420);
    const cielo = g.createLinearGradient(0, 0, 0, h); cielo.addColorStop(0, '#000'); cielo.addColorStop(1, '#2a0a06');
    g.fillStyle = cielo; g.fillRect(0, 0, w, h);
    // el sol gigante, con su resplandor
    const sx = w*.56, sy = h*.52, R = h*.42;
    const halo = g.createRadialGradient(sx, sy, R*.9, sx, sy, R*1.6); halo.addColorStop(0, 'rgba(232,67,46,.35)'); halo.addColorStop(1, 'rgba(232,67,46,0)');
    g.fillStyle = halo; g.fillRect(0, 0, w, h);
    const sol = g.createRadialGradient(sx - R*.2, sy - R*.25, R*.1, sx, sy, R); sol.addColorStop(0, C.naranja); sol.addColorStop(.55, C.rojo); sol.addColorStop(1, C.rojoOsc);
    g.beginPath(); g.arc(sx, sy, R, 0, TAU); g.fillStyle = sol; g.fill();
    // franjas de nubes finas cruzando el sol, de bordes redondos
    for(const [y, x00, x10] of [[.66, .3, .84], [.74, .4, .95], [.36, .62, .9]] as [number, number, number][]){
      // las franjas se corren despacio hacia la izquierda, a distinta velocidad, y vuelven a entrar
      const corr = (((t*(.006 + y*.004)) % 1.6) + 1.6) % 1.6, x0 = (x00 - corr + 1.6) % 1.6 - .5, x1 = x0 + (x10 - x00);
      const yy = h*y, a = h*.022;
      g.beginPath(); g.roundRect(w*x0, yy - a, w*(x1 - x0), a*2, a); g.fillStyle = '#5a140c'; g.fill();
      g.beginPath(); g.moveTo(w*x0 + a, yy - a); g.lineTo(w*x1 - a, yy - a); g.strokeStyle = 'rgba(255,160,90,.5)'; g.lineWidth = lw; g.stroke();
    }
    bandada(g, [[.3, .3, .4, .1], [.62, .5, .3, .45], [.82, .26, .2, .7], [.45, .72, .14, .25], [.18, .62, .1, .9], [.92, .6, .09, .6]], w, h, lw, t);
  },
};

// una nube de rizos (kumo): una franja con rizos en espiral en los extremos y arriba, en oro con su sombra
function kumo(g: CanvasRenderingContext2D, x: number, y: number, a: number, lw: number){
  const forma = () => {
    g.beginPath(); g.moveTo(x - a, y);
    g.arc(x - a*.65, y - a*.08, a*.22, Math.PI, Math.PI*1.9);
    g.arc(x - a*.25, y - a*.2, a*.3, Math.PI*1.1, Math.PI*1.95);
    g.arc(x + a*.2, y - a*.16, a*.26, Math.PI*1.1, Math.PI*1.95);
    g.arc(x + a*.6, y - a*.05, a*.2, Math.PI*1.1, Math.PI*2.1);
    g.lineTo(x + a, y + a*.08); g.lineTo(x - a, y + a*.08); g.closePath();
  };
  forma(); g.strokeStyle = SOMBRA; g.lineWidth = lw*3; g.stroke();
  const gr = g.createLinearGradient(0, y - a*.5, 0, y + a*.1); gr.addColorStop(0, C.oro); gr.addColorStop(1, C.naranja); g.fillStyle = gr; g.fill();
  // los rizos en espiral, en rojo profundo, como en los grabados
  for(const [cx, cy, r] of [[x - a*.65, y - a*.08, a*.12], [x - a*.25, y - a*.2, a*.17], [x + a*.2, y - a*.16, a*.14], [x + a*.6, y - a*.05, a*.1]]){
    g.beginPath(); for(let i = 0; i <= 40; i++){ const q = i/40, ang = Math.PI*1.2 + q*TAU*1.4, rr = r*(1 - q*.8); i ? g.lineTo(cx + Math.cos(ang)*rr, cy + Math.sin(ang)*rr) : g.moveTo(cx + Math.cos(ang)*rr, cy + Math.sin(ang)*rr); }
    g.strokeStyle = C.rojoOsc; g.lineWidth = lw*1.2; g.stroke();
  }
  g.beginPath(); g.moveTo(x - a*.95, y + a*.02); g.lineTo(x + a*.95, y + a*.02); g.strokeStyle = C.rojoOsc; g.lineWidth = lw; g.stroke();
}

export const tsuruNubes: Elemento = {
  id: 'tsuru-nubes', grupo: GRUPO, nombre: 'Grullas entre nubes',
  descripcion: 'Grullas en vuelo entre nubes estilizadas de rizos, en oro, como en los grabados y los kimonos.',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    const lw = Math.max(2, w/420);
    g.fillStyle = '#080303'; g.fillRect(0, 0, w, h);
    // las nubes se corren despacio hacia la izquierda (las grullas van a la derecha): la de adelante, más rápido
    const nx = (x: number, a: number, v: number) => { const L = w + a*2.4; return ((((x*w - t*v*w + a*1.2) % L) + L) % L) - a*1.2; };
    kumo(g, nx(.78, w*.16, .006), h*.2, w*.16, lw*.8);
    kumo(g, nx(.2, w*.2, .009), h*.86, w*.2, lw);
    kumo(g, nx(.9, w*.13, .007), h*.78, w*.13, lw*.8);
    bandada(g, [[.36, .38, .44, .2], [.72, .58, .3, .55], [.15, .3, .16, .8], [.6, .18, .12, .35]], w, h, lw, t);
    kumo(g, nx(.5, w*.14, .016), h*.66, w*.14, lw*.9);   // una delante, para meter a las grullas entre las nubes
  },
};
