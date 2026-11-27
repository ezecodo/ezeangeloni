/*
 * Maneki-neko moderno, el decimotercer elemento (Eze, 2026-11-27): el gato de la suerte, en clave pop/urbana. Una misma
 * silueta (sentado de frente, una pata en alto saludando, el collar con su cascabel, la moneda koban) en dos estilos:
 * negro y dorado minimalista (el gato en negro profundo, sólo unos trazos de oro que brillan, y los ojos de reptil del
 * dragón, dorados y de pupila rasgada, que en un gato quedan perfectos) y streetwear (sticker pop: planos rojos, contorno
 * grueso, la sombra desplazada en oro, ojos cerrados de felicidad, el pecho estampado con el shippo de los wagara).
 * Estáticos (la pata en alto); el saludo, en `animacion`.
 */
import { C, SOMBRA, TAU, hash, ojoReptil } from '../dragon/estilo';
import type { Elemento } from './index';
import { shippo } from './wagara';

const ANIMACION = 'Maneki-neko (gato de la suerte) moderno: un guiño pop/urbano. En lugar del clásico, uno minimalista en negro y dorado o estilo streetwear saludando suavemente.';
const GRUPO = 'Maneki-neko';
const JP = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';

// las formas del gato, centrado en cx, con la base en `piso`, de alto S
// `saluda` (animación): el ángulo del brazo que saluda, girando desde el hombro (0 en alto; negativo, la mano baja hacia
// adelante, el gesto del maneki-neko que llama)
const hombroDe = (cx: number, piso: number, S: number) => ({ x: cx - S*.22, y: piso - S*.42 });
function formas(cx: number, piso: number, S: number, saluda = 0){
  const cab = { x: cx, y: piso - S*.7, rx: S*.27, ry: S*.22 };
  const cuerpo = (g: CanvasRenderingContext2D) => {
    g.beginPath(); g.moveTo(cx - S*.22, piso - S*.52);
    g.bezierCurveTo(cx - S*.34, piso - S*.3, cx - S*.34, piso - S*.02, cx - S*.2, piso);
    g.lineTo(cx + S*.2, piso);
    g.bezierCurveTo(cx + S*.34, piso - S*.02, cx + S*.34, piso - S*.3, cx + S*.22, piso - S*.52); g.closePath();
  };
  const cabeza = (g: CanvasRenderingContext2D) => {
    g.beginPath(); g.ellipse(cab.x, cab.y, cab.rx, cab.ry, 0, 0, TAU);
    for(const l of [-1, 1]){ g.moveTo(cx + l*S*.25, cab.y - S*.08); g.lineTo(cx + l*S*.22, cab.y - S*.3); g.lineTo(cx + l*S*.08, cab.y - S*.19); g.closePath(); }
  };
  // la pata en alto (a la izquierda de quien mira), saludando: el brazo y la mano redonda con sus almohadillas
  const hb = hombroDe(cx, piso, S);
  const brazo = (g: CanvasRenderingContext2D) => {
    // abierta hacia afuera, para que la mano se vea entera al lado de la cabeza; girada desde el hombro al saludar (el
    // camino guarda los puntos ya girados, así sirve igual para el trazo y el relleno)
    g.save(); g.translate(hb.x, hb.y); g.rotate(saluda); g.translate(-hb.x, -hb.y);
    g.beginPath(); g.moveTo(cx - S*.22, piso - S*.4); g.quadraticCurveTo(cx - S*.47, piso - S*.5, cx - S*.47, piso - S*.74);
    g.arc(cx - S*.42, piso - S*.79, S*.075, Math.PI*.95, Math.PI*2.15);
    g.quadraticCurveTo(cx - S*.36, piso - S*.58, cx - S*.16, piso - S*.47); g.closePath();
    g.restore();
  };
  // dónde queda la mano (para la almohadilla)
  const mx = cx - S*.42 - hb.x, my = piso - S*.79 - hb.y, mano = { x: hb.x + mx*Math.cos(saluda) - my*Math.sin(saluda), y: hb.y + mx*Math.sin(saluda) + my*Math.cos(saluda) };
  const koban = { x: cx + S*.13, y: piso - S*.22, rx: S*.08, ry: S*.12 };
  return { cab, cuerpo, cabeza, brazo, koban, mano };
}

// La animación (Eze, 2026-11-27: "saludando suavemente"): el brazo baja y sube desde el hombro, el gesto de llamar a la
// suerte (`saludo`: baja rápido y vuelve despacio, con una pausa arriba); el negro y oro parpadea con sus ojos de reptil
// y un brillo recorre su contorno de oro; el streetwear se balancea con cada saludo y sus destellos laten.
const saludo = (t: number) => { const q = (t % 1.6)/1.6; return -.32*(q < .3 ? Math.sin(q/.3*Math.PI/2) : q < .75 ? Math.cos((q - .3)/.45*Math.PI/2) : 0); };

export const nekoOro: Elemento = {
  id: 'neko-oro', grupo: GRUPO, nombre: 'Maneki-neko · negro y oro',
  descripcion: 'Minimalista: el gato en negro profundo, unos pocos trazos de oro, y ojos dorados de pupila rasgada (los del dragón).',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const lw = Math.max(2, w/420), S = h*.92, cx = w/2, piso = h*.96, F = formas(cx, piso, S, saludo(t));
    // un halo cálido detrás, para que el negro del gato se recorte
    const halo = g.createRadialGradient(cx, piso - S*.5, S*.1, cx, piso - S*.5, S*.6); halo.addColorStop(0, 'rgba(255,192,106,.16)'); halo.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = halo; g.fillRect(0, 0, w, h);
    const negro = g.createLinearGradient(cx - S*.3, 0, cx + S*.3, 0); negro.addColorStop(0, '#1e0b08'); negro.addColorStop(1, '#080303');
    const oro = (trazar: () => void, ancho: number) => { g.save(); trazar(); g.strokeStyle = C.oro; g.lineWidth = ancho; g.shadowColor = 'rgba(255,190,60,.8)'; g.shadowBlur = lw*5; g.stroke(); g.restore(); };
    // primero el oro de todos los contornos y después el negro encima: queda un solo contorno, el de afuera (trazados
    // después del relleno, se cruzaban por dentro: la cabeza sobre las orejas, el brazo sobre el cuerpo)
    oro(() => F.cuerpo(g), lw*2.8); oro(() => F.brazo(g), lw*2.8); oro(() => F.cabeza(g), lw*2.8);
    for(const f of [F.cuerpo, F.brazo, F.cabeza]){ f(g); g.fillStyle = negro; g.fill(); }
    // el brillo que recorre el contorno de oro: un trazo corto, claro, que corre por cada silueta
    g.save(); g.globalCompositeOperation = 'lighter'; g.setLineDash([S*.12, S*4]);
    [F.cuerpo, F.brazo, F.cabeza].forEach((f, i) => { f(g); g.lineDashOffset = -(t*S*.45 + i*S*1.3); g.strokeStyle = 'rgba(255,246,220,.85)'; g.lineWidth = lw*1.6; g.stroke(); });
    g.restore();
    // el collar fino, el cascabel, la moneda
    oro(() => { g.beginPath(); g.ellipse(cx, F.cab.y + F.cab.ry*.98, S*.2, S*.03, 0, .15, Math.PI - .15); }, lw*2.2);
    g.beginPath(); g.arc(cx, F.cab.y + F.cab.ry + S*.04, S*.035, 0, TAU); g.fillStyle = C.oro; g.fill();
    g.beginPath(); g.moveTo(cx - S*.02, F.cab.y + F.cab.ry + S*.05); g.lineTo(cx + S*.02, F.cab.y + F.cab.ry + S*.05); g.strokeStyle = '#5a3a10'; g.lineWidth = lw; g.stroke();
    oro(() => { g.beginPath(); g.ellipse(F.koban.x, F.koban.y, F.koban.rx, F.koban.ry, 0, 0, TAU); }, lw*1.6);
    g.beginPath(); g.ellipse(F.koban.x, F.koban.y, F.koban.rx*.72, F.koban.ry*.78, 0, 0, TAU); g.strokeStyle = 'rgba(255,208,58,.5)'; g.lineWidth = lw*.7; g.stroke();
    // los ojos del dragón, dorados y rasgados; la nariz; los bigotes
    // parpadea cada tanto (un cuarto de segundo cada ~4,5 s)
    const parpado = (t % 4.5) < .22 ? Math.max(.08, Math.abs((t % 4.5) - .11)/.11) : 1;
    for(const l of [-1, 1]) ojoReptil(g, { x: cx + l*S*.1, y: F.cab.y - S*.01 }, l < 0 ? Math.PI : 0, l < 0 ? -1 : 1, S*.6, lw, parpado);
    g.beginPath(); g.moveTo(cx - S*.015, F.cab.y + S*.06); g.lineTo(cx + S*.015, F.cab.y + S*.06); g.lineTo(cx, F.cab.y + S*.08); g.closePath(); g.fillStyle = C.oro; g.fill();
    for(const l of [-1, 1]) for(let k = 0; k < 3; k++)
      oro(() => { g.beginPath(); g.moveTo(cx + l*S*.07, F.cab.y + S*(.075 + k*.012)); g.lineTo(cx + l*S*.25, F.cab.y + S*(.05 + k*.035)); }, lw*.6);
  },
};

export const nekoCalle: Elemento = {
  id: 'neko-streetwear', grupo: GRUPO, nombre: 'Maneki-neko · streetwear',
  descripcion: 'Sticker pop: planos rojos, contorno grueso, sombra desplazada en oro, ojos cerrados de felicidad y el pecho estampado con shippo.',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const lw = Math.max(2, w/420), S = h*.9, piso = h*.95, sa = saludo(t), off = S*.025;
    // se balancea con cada saludo, como un muñeco con resorte
    const cx = w/2 + sa*S*.04, F = formas(cx, piso, S, sa);
    // destellos dorados de fondo (cruces de cuatro puntas)
    for(let k = 0; k < 9; k++){
      const x = w*(.08 + hash(k*3.1)*.84), y = h*(.08 + hash(k*5.7)*.6), r = S*(.02 + hash(k*7.3)*.03)*(.55 + .45*Math.sin(t*(1.5 + hash(k)*2) + k*2.3));
      if(Math.abs(x - cx) < S*.36 && y > piso - S*.95) continue;
      g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r);
      g.fillStyle = k % 2 ? C.oro : C.claro; g.fill();
    }
    // la sombra desplazada del sticker, en oro, y el contorno grueso
    g.save(); g.translate(off, off); for(const f of [F.cuerpo, F.brazo, F.cabeza]){ f(g); g.fillStyle = C.oro; g.fill(); } g.restore();
    for(const f of [F.cuerpo, F.brazo, F.cabeza]){ f(g); g.strokeStyle = SOMBRA; g.lineWidth = lw*5; g.stroke(); }
    for(const f of [F.cuerpo, F.brazo, F.cabeza]){ f(g); g.fillStyle = C.rojo; g.fill(); }
    // el pecho estampado con shippo
    const pecho = document.createElement('canvas'); pecho.width = pecho.height = 500; const pg = pecho.getContext('2d')!; pg.lineJoin = 'round'; shippo.dibujar(pg, 500, 500, 0);
    g.save(); g.beginPath(); g.ellipse(cx, piso - S*.24, S*.16, S*.2, 0, 0, TAU); g.clip(); g.drawImage(pecho, cx - S*.2, piso - S*.46, S*.4, S*.4); g.restore();
    g.beginPath(); g.ellipse(cx, piso - S*.24, S*.16, S*.2, 0, 0, TAU); g.strokeStyle = SOMBRA; g.lineWidth = lw*2.5; g.stroke();
    // orejas por dentro, almohadillas de la mano
    for(const l of [-1, 1]){ g.beginPath(); g.moveTo(cx + l*S*.22, F.cab.y - S*.1); g.lineTo(cx + l*S*.2, F.cab.y - S*.25); g.lineTo(cx + l*S*.11, F.cab.y - S*.17); g.closePath(); g.fillStyle = C.rojoOsc; g.fill(); }
    g.beginPath(); g.arc(F.mano.x, F.mano.y, S*.03, 0, TAU); g.fillStyle = C.claro; g.fill();
    // ojos cerrados de felicidad (^ ^), mejillas, nariz, boquita
    g.strokeStyle = SOMBRA; g.lineCap = 'round';
    for(const l of [-1, 1]){
      g.beginPath(); g.arc(cx + l*S*.1, F.cab.y + S*.005, S*.04, Math.PI*1.15, Math.PI*1.85); g.lineWidth = lw*2.6; g.stroke();
      g.beginPath(); g.ellipse(cx + l*S*.17, F.cab.y + S*.06, S*.035, S*.02, 0, 0, TAU); g.fillStyle = C.naranja; g.fill();
    }
    g.beginPath(); g.moveTo(cx - S*.015, F.cab.y + S*.05); g.lineTo(cx + S*.015, F.cab.y + S*.05); g.lineTo(cx, F.cab.y + S*.068); g.closePath(); g.fillStyle = SOMBRA; g.fill();
    g.beginPath(); g.moveTo(cx - S*.03, F.cab.y + S*.085); g.quadraticCurveTo(cx - S*.015, F.cab.y + S*.1, cx, F.cab.y + S*.08); g.quadraticCurveTo(cx + S*.015, F.cab.y + S*.1, cx + S*.03, F.cab.y + S*.085); g.lineWidth = lw*1.6; g.stroke();
    // el collar, el cascabel, la moneda con 福
    g.beginPath(); g.ellipse(cx, F.cab.y + F.cab.ry*.98, S*.2, S*.03, 0, .15, Math.PI - .15); g.strokeStyle = SOMBRA; g.lineWidth = lw*6; g.stroke(); g.strokeStyle = C.oro; g.lineWidth = lw*3.5; g.stroke();
    g.beginPath(); g.arc(cx, F.cab.y + F.cab.ry + S*.04, S*.04, 0, TAU); g.fillStyle = C.oro; g.fill(); g.strokeStyle = SOMBRA; g.lineWidth = lw*2; g.stroke();
    g.beginPath(); g.ellipse(F.koban.x, F.koban.y, F.koban.rx, F.koban.ry, 0, 0, TAU); g.fillStyle = C.oro; g.fill(); g.strokeStyle = SOMBRA; g.lineWidth = lw*2.5; g.stroke();
    g.font = `900 ${S*.08}px ${JP}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = C.rojoOsc; g.fillText('福', F.koban.x, F.koban.y);
  },
};
