/*
 * Daruma, el quinto elemento (Eze, 2026-11-27): el muñeco de la suerte, rojo por tradición (encaja solo en la paleta).
 * En el lenguaje del dragón: el cuerpo con la sombra oscura alrededor y un filo de luz de un lado, adornos dorados con la
 * forma de la llama del dragón, el kanji 福 (fuku, fortuna) en oro. La cara es clara por tradición: un tono hueso cálido
 * (la única excepción a "el crema sólo como filo"), con las cejas de grulla y la barba de tortuga. La tradición: se pinta
 * un ojo al pedir un deseo, el otro cuando se cumple. Estático; rodar y guiñar quedan en `animacion`.
 */
import { C, SOMBRA, TAU, llama } from '../dragon/estilo';
import type { Elemento } from './index';

const ANIMACION = 'Daruma: un muñeco Daruma rodando o guiñando un ojo, ideal para momentos más dinámicos o divertidos.';
const GRUPO = 'Daruma';
const JP = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", "Hiragino Kaku Gothic ProN", serif';
const TINTA = '#1a0806', CARA = '#f6e2b8';

// Un Daruma en (cx, cy) (el centro del cuerpo), de alto S, inclinado `inclina` radianes; `ojos`: 'uno' (el deseo: un ojo
// pintado y el otro en blanco), 'guino' (uno pintado, el otro cerrado en un guiño). Animación: `pinta` (0 a 1) cuánto
// del segundo ojo ya se pintó (la tinta da la vuelta como un pincel); `rueda`: gira sobre su centro (rodando) en vez de
// mecerse sobre su base.
function daruma(g: CanvasRenderingContext2D, cx: number, cy: number, S: number, inclina: number, ojos: 'uno' | 'guino', lw: number, pinta = 0, rueda = false){
  // la sombra en la mesa, que no rota
  g.save(); g.beginPath(); g.ellipse(cx + (rueda ? 0 : Math.sin(inclina)*S*.2), cy + S*.47, S*.4, S*.06, 0, 0, TAU); g.fillStyle = 'rgba(0,0,0,.55)'; g.filter = `blur(${S*.02}px)`; g.fill(); g.restore();
  if(rueda){ g.save(); g.translate(cx, cy); g.rotate(inclina); }
  else { g.save(); g.translate(cx, cy + S*.45); g.rotate(inclina); g.translate(0, -S*.45); }   // se mece sobre su base
  const ancho = S*.42;
  // el cuerpo: un huevo, más ancho abajo
  const cuerpo = () => {
    g.beginPath();
    g.moveTo(0, -S*.5);
    g.bezierCurveTo(ancho*.72, -S*.5, ancho*1.02, -S*.12, ancho, S*.12);
    g.bezierCurveTo(ancho*.98, S*.36, ancho*.62, S*.47, 0, S*.47);
    g.bezierCurveTo(-ancho*.62, S*.47, -ancho*.98, S*.36, -ancho, S*.12);
    g.bezierCurveTo(-ancho*1.02, -S*.12, -ancho*.72, -S*.5, 0, -S*.5);
    g.closePath();
  };
  cuerpo(); g.strokeStyle = SOMBRA; g.lineWidth = lw*4; g.stroke();
  const rojo = g.createRadialGradient(-ancho*.35, -S*.25, S*.05, 0, 0, S*.6);
  rojo.addColorStop(0, '#f4573c'); rojo.addColorStop(.55, C.rojo); rojo.addColorStop(1, C.pata);
  g.fillStyle = rojo; g.fill();
  // los adornos dorados de los costados: llamas del dragón que nacen abajo y suben barriendo hacia afuera
  g.save(); cuerpo(); g.clip();
  for(const l of [1, -1]) for(let k = 0; k < 3; k++){
    const b = { x: l*ancho*(.28 + k*.16), y: S*(.42 - k*.04) };
    llama(g, b, { x: l*.55, y: -1 }, { x: l*.35, y: -1 }, S*(.34 - k*.06), S*(.045 - k*.006), 0, 21 + k*3.7 + (l > 0 ? 0 : 11), l, k === 1 ? C.claro : C.oro, lw*.9, .5);
  }
  g.restore();
  // la cara: un óvalo claro arriba
  const cara = () => { g.beginPath(); g.ellipse(0, -S*.17, ancho*.62, S*.2, 0, 0, TAU); };
  // el borde dorado de la cara (tradicional), con su sombra
  cara(); g.strokeStyle = SOMBRA; g.lineWidth = lw*2.4 + S*.03; g.stroke();
  cara(); g.strokeStyle = C.oro; g.lineWidth = S*.022; g.stroke();
  const piel = g.createRadialGradient(-ancho*.2, -S*.25, S*.02, 0, -S*.17, S*.25);
  piel.addColorStop(0, '#fff3dc'); piel.addColorStop(1, CARA);
  g.fillStyle = piel; g.fill();
  // las cejas de grulla: dos trazos gruesos que suben hacia afuera, con plumas
  for(const l of [1, -1]){
    g.beginPath(); g.moveTo(l*ancho*.12, -S*.27); g.quadraticCurveTo(l*ancho*.32, -S*.36, l*ancho*.5, -S*.3);
    g.strokeStyle = TINTA; g.lineWidth = S*.032; g.lineCap = 'round'; g.stroke();
    for(let k = 0; k < 3; k++){ g.beginPath(); g.moveTo(l*ancho*(.3 + k*.07), -S*(.33 - k*.012)); g.lineTo(l*ancho*(.36 + k*.07), -S*(.38 - k*.01)); g.lineWidth = S*.012; g.stroke(); }
  }
  // los ojos: el de la derecha (de quien mira) pintado, el otro en blanco o guiñando
  for(const l of [-1, 1]){
    const ox = l*ancho*.26, oy = -S*.2, r = S*.062;
    if(ojos === 'guino' && l < 0){
      g.beginPath(); g.moveTo(ox - r, oy); g.quadraticCurveTo(ox, oy + r*.8, ox + r, oy);
      g.strokeStyle = TINTA; g.lineWidth = S*.018; g.lineCap = 'round'; g.stroke();
      continue;
    }
    g.beginPath(); g.arc(ox, oy, r, 0, TAU); g.fillStyle = '#fffaf0'; g.fill(); g.strokeStyle = TINTA; g.lineWidth = S*.012; g.stroke();
    if(l > 0 || ojos === 'guino' || pinta >= 1){ g.beginPath(); g.arc(ox, oy, r*.55, 0, TAU); g.fillStyle = TINTA; g.fill(); g.beginPath(); g.arc(ox - r*.18, oy - r*.2, r*.16, 0, TAU); g.fillStyle = '#fff'; g.fill(); }
    else if(pinta > 0){
      // la pupila pintándose: la tinta da la vuelta desde arriba, con una brasa en el borde del pincel
      const a0 = -Math.PI/2, a1 = a0 + pinta*TAU;
      g.beginPath(); g.moveTo(ox, oy); g.arc(ox, oy, r*.55, a0, a1); g.closePath(); g.fillStyle = TINTA; g.fill();
      const px = ox + Math.cos(a1)*r*.4, py = oy + Math.sin(a1)*r*.4, b = g.createRadialGradient(px, py, 0, px, py, r*.5);
      b.addColorStop(0, 'rgba(255,214,140,.9)'); b.addColorStop(1, 'rgba(232,67,46,0)'); g.fillStyle = b; g.beginPath(); g.arc(px, py, r*.5, 0, TAU); g.fill();
    }
  }
  // la nariz y la boca, mínimas, y la barba de tortuga: rizos a los lados y abajo
  g.strokeStyle = TINTA; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-S*.012, -S*.13); g.quadraticCurveTo(0, -S*.115, S*.012, -S*.13); g.lineWidth = S*.01; g.stroke();
  g.beginPath(); g.moveTo(-S*.03, -S*.075); g.quadraticCurveTo(0, -S*.062, S*.03, -S*.075); g.lineWidth = S*.012; g.stroke();
  for(const l of [1, -1]){
    for(let k = 0; k < 3; k++){
      g.beginPath();
      const bx = l*ancho*(.18 + k*.1), by = -S*(.11 - k*.022);
      g.arc(bx, by, S*.026, l > 0 ? -Math.PI*.2 : Math.PI*1.2, l > 0 ? Math.PI*.9 : Math.PI*.1, l < 0);
      g.lineWidth = S*.014; g.stroke();
    }
  }
  // el vientre: 福 en oro, con su sombra
  g.font = `900 ${S*.2}px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = lw*3; g.strokeStyle = SOMBRA; g.strokeText('福', 0, S*.21);
  const oro = g.createLinearGradient(0, S*.12, 0, S*.31); oro.addColorStop(0, '#ffe38a'); oro.addColorStop(1, '#d99a1c');
  g.fillStyle = oro; g.fillText('福', 0, S*.21);
  // el filo de luz del cuerpo, arriba a la izquierda
  g.save(); cuerpo(); g.clip();
  g.beginPath(); g.ellipse(0, 0, ancho*.98, S*.49, 0, -Math.PI*.85, -Math.PI*.55); g.strokeStyle = C.borde; g.lineWidth = lw*1.2; g.stroke();
  g.restore();
  g.restore();
}

const lim01 = (x: number) => Math.min(1, Math.max(0, x));
const telon = (g: CanvasRenderingContext2D, w: number, h: number, a: number) => { if(a > 0){ g.fillStyle = `rgba(0,0,0,${Math.min(1, a)})`; g.fillRect(0, 0, w, h); } };
// destellos dorados de cuatro puntas que salen de un punto y se apagan (`e`: 0 a 1 de su vida)
function destellos(g: CanvasRenderingContext2D, x: number, y: number, R: number, e: number, n = 14){
  if(e <= 0 || e >= 1) return;
  g.save(); g.globalCompositeOperation = 'lighter';
  for(let k = 0; k < n; k++){
    const a = k/n*TAU + k*.37, d = R*(.3 + e*(.8 + (k % 3)*.25)), px = x + Math.cos(a)*d, py = y + Math.sin(a)*d - e*R*.3, r = R*.09*(1 - e)*(1 + (k % 2)*.6);
    g.beginPath(); g.moveTo(px, py - r); g.quadraticCurveTo(px, py, px + r, py); g.quadraticCurveTo(px, py, px, py + r); g.quadraticCurveTo(px, py, px - r, py); g.quadraticCurveTo(px, py, px, py - r);
    g.fillStyle = k % 2 ? C.oro : C.claro; g.globalAlpha = 1 - e*e; g.fill();
  }
  g.restore();
}

// El deseo, animado (Eze, 2026-11-27), en un ciclo de `DESEO` s: el Daruma es un okiagari (se levanta solo), así que se
// mece apenas, quieto; a los pocos segundos se pinta el segundo ojo (la tinta da la vuelta como un pincel): el deseo se
// cumplió; se sacude de alegría (un vaivén que se amortigua) entre destellos dorados; se apaga y vuelve con un solo ojo.
const DESEO = 16;
export const darumaDeseo: Elemento = {
  id: 'daruma-deseo', grupo: GRUPO, nombre: 'Daruma · el deseo',
  descripcion: 'Con un solo ojo pintado, el deseo pedido. Animado: se mece, se pinta el segundo ojo (el deseo cumplido) y se sacude de alegría entre destellos.',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const c = t % DESEO, S = h*.82, pinta = lim01((c - 4.2)/1.6), alegria = c - 6.1;
    let inclina = .035*Math.sin(TAU*c/2.8);
    if(alegria > 0) inclina += .22*Math.exp(-alegria*.9)*Math.sin(alegria*5.2);
    daruma(g, w/2, h*.47, S, inclina, 'uno', Math.max(2, w/420), pinta);
    destellos(g, w/2 - S*.42*.26, h*.47 - S*.2, S*.5, alegria/1.6);
    telon(g, w, h, Math.max(1 - c/.8, (c - (DESEO - 1.2))/1.2));
  },
};

// El guiño, animado: entra rodando desde la izquierda (gira sobre sí mismo mientras avanza, cada vez más despacio),
// llega al centro, se endereza meciéndose (el vaivén de un okiagari que se amortigua), guiña el ojo con un saltito,
// y se va rodando a la derecha; una pausa a oscuras. En un ciclo de `GUINO` s.
const GUINO = 12;
export const darumaGuino: Elemento = {
  id: 'daruma-guino', grupo: GRUPO, nombre: 'Daruma · guiño',
  descripcion: 'Animado: entra rodando, se endereza meciéndose, te guiña el ojo con un saltito y se va rodando.',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const c = t % GUINO, S = h*.7, r = S*.45, cy = h*.53, lw = Math.max(2, w/420), xc = w/2;
    const ENTRA = 2.6, v1 = r*2.2;              // llega al centro con esta velocidad (px/s), y la convierte en vaivén
    const x0 = -S*.6, d = xc - x0, v0 = 2*d/ENTRA - v1;   // desacelera parejo de v0 a v1 en ENTRA s
    let x = xc, ang = 0, guino = false, salto = 0;
    if(c < ENTRA){
      x = x0 + v0*c + (v1 - v0)*c*c/(2*ENTRA);
      ang = -(xc - x)/r;                          // rodar: el ángulo es lo recorrido sobre el radio (llega derecho)
    } else if(c < 8.4){
      const a = c - ENTRA, om = 4.2;
      ang = (v1/r/om)*Math.exp(-a*1.1)*Math.sin(om*a);
      // el guiño, con un saltito
      const gu = c - 5.4; if(gu > 0 && gu < .55){ guino = true; salto = Math.sin(gu/.55*Math.PI)*S*.05; }
      ang += gu > 0 && gu < 1.6 ? .1*Math.exp(-gu*2)*Math.sin(gu*9) : 0;
    } else {
      const a = c - 8.4;                          // se va: arranca despacio y acelera
      x = xc + .5*r*3.2*a*a; ang = (x - xc)/r;
    }
    daruma(g, x, cy - salto, S, ang, guino ? 'guino' : 'uno', lw, guino ? 0 : 1, true);
  },
};
