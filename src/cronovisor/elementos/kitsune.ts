/*
 * Kitsune, el decimocuarto elemento (Eze, 2026-11-27): el zorro, "muy potente para el concepto fusión". La máscara
 * tradicional (blanca: un hueso cálido, la excepción de las caras claras como el Daruma) con sus marcas rojas y detalles
 * en tubos de neón cálido; y el zorro de nueve colas (kyūbi), con los ojos de reptil del dragón y las colas hechas con la
 * llama del dragón (casi la misma forma: el zorro y el dragón, del mismo linaje), rodeado de kitsunebi. El kitsunebi suele
 * ser azul; la regla es fuego, nada de azules: aquí es un fuego fantasmal dorado pálido, casi blanco (azul sería una
 * excepción). Estáticos; el movimiento previsto, en `animacion`.
 */
import { C, SOMBRA, TAU, hash, llama, ojoReptil, type P } from '../dragon/estilo';
import type { Elemento } from './index';

const ANIMACION = 'Zorro Kitsune (con máscaras o varias colas): muy potente para el concepto "fusión". Una máscara de Kitsune con detalles en neón o un zorro rodeado de fuego espiritual azul (kitsunebi).';
const GRUPO = 'Kitsune';
const HUESO = '#f6e8d0';

// un tubo de neón (halo, vidrio, núcleo) a lo largo de un camino
function tubo(g: CanvasRenderingContext2D, trazar: () => void, color: string, nucleo: string, grosor: number, k = 1){
  for(const [ancho, col, brillo, alfa] of [[grosor*3, color, grosor*12*k, .45*k], [grosor, color, grosor*4*k, Math.min(1, .35 + .65*k)], [grosor*.38, nucleo, grosor*1.5, Math.min(1, .3 + .7*k)]] as [number, string, number, number][]){
    g.save(); g.globalAlpha = alfa; g.strokeStyle = col; g.lineWidth = ancho; g.shadowColor = col; g.shadowBlur = brillo; g.lineJoin = 'round'; g.lineCap = 'round';
    trazar(); g.stroke(); g.restore();
  }
}

// la máscara de frente, centrada en (cx, cy), de alto M: frente ancha con las orejas, el hocico que se afina hacia abajo
function mascara(cx: number, cy: number, M: number){
  const contorno = (g: CanvasRenderingContext2D) => {
    g.beginPath();
    g.moveTo(cx, cy + M*.5);                                                   // la punta del hocico
    g.bezierCurveTo(cx - M*.12, cy + M*.42, cx - M*.3, cy + M*.15, cx - M*.34, cy - M*.08);
    g.lineTo(cx - M*.38, cy - M*.5);                                           // la oreja izquierda
    g.lineTo(cx - M*.16, cy - M*.26);
    g.quadraticCurveTo(cx, cy - M*.3, cx + M*.16, cy - M*.26);
    g.lineTo(cx + M*.38, cy - M*.5);                                           // la derecha
    g.lineTo(cx + M*.34, cy - M*.08);
    g.bezierCurveTo(cx + M*.3, cy + M*.15, cx + M*.12, cy + M*.42, cx, cy + M*.5);
    g.closePath();
  };
  return { contorno };
}

// La máscara, animada (Eze, 2026-11-27): flota (sube y baja apenas, se inclina), el neón respira (cada tubo a su
// tiempo) y una luz corre por el contorno; cada tanto, detrás de los ojos se enciende el espíritu: un brillo dorado que
// crece en las ranuras y se apaga, y el neón sube con él. En un ciclo de `MASCARA` s.
const MASCARA = 11;
export const kitsuneMascara: Elemento = {
  id: 'kitsune-mascara', grupo: GRUPO, nombre: 'Máscara de kitsune · neón',
  descripcion: 'La máscara tradicional, blanca con sus marcas rojas y ojos rasgados, con el contorno y los acentos en tubos de neón cálido.',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const c = t % MASCARA, espiritu = Math.max(0, Math.sin(Math.min(1, Math.max(0, (c - 6)/2.6))*Math.PI));
    const lw = Math.max(2, w/420), M = h*.86;
    // flota: el centro sube y baja, y la máscara se inclina apenas (todo el dibujo gira alrededor de su centro)
    const cx = w/2, cy = h*.53 + Math.sin(t*TAU/5.5)*h*.012, inclina = Math.sin(t*TAU/7.3)*.03, K = mascara(cx, cy, M);
    const halo = g.createRadialGradient(cx, cy, M*.1, cx, cy, M*.7); halo.addColorStop(0, `rgba(232,67,46,${.18 + .12*espiritu})`); halo.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = halo; g.fillRect(0, 0, w, h);
    g.save(); g.translate(cx, cy); g.rotate(inclina); g.translate(-cx, -cy);
    // la máscara: el hueso con un poco de volumen (más claro a la izquierda), la sombra alrededor
    K.contorno(g); g.strokeStyle = SOMBRA; g.lineWidth = lw*3; g.stroke();
    const piel = g.createLinearGradient(cx - M*.35, 0, cx + M*.35, 0); piel.addColorStop(0, '#fff6e6'); piel.addColorStop(1, '#e8d2b0');
    g.fillStyle = piel; g.fill();
    g.save(); K.contorno(g); g.clip();
    // el interior de las orejas, rojo
    for(const l of [-1, 1]){ g.beginPath(); g.moveTo(cx + l*M*.355, cy - M*.43); g.lineTo(cx + l*M*.33, cy - M*.15); g.lineTo(cx + l*M*.19, cy - M*.25); g.closePath(); g.fillStyle = C.rojo; g.fill(); }
    // las marcas sobre los ojos: llamas rojas que suben hacia las orejas
    for(const l of [-1, 1]){
      g.beginPath(); g.moveTo(cx + l*M*.06, cy - M*.02);
      g.quadraticCurveTo(cx + l*M*.2, cy - M*.2, cx + l*M*.3, cy - M*.3);
      g.quadraticCurveTo(cx + l*M*.2, cy - M*.08, cx + l*M*.06, cy - M*.02); g.fillStyle = C.rojo; g.fill();
    }
    // la marca de la frente: una llama vertical
    g.beginPath(); g.moveTo(cx, cy - M*.08); g.quadraticCurveTo(cx - M*.05, cy - M*.17, cx, cy - M*.27); g.quadraticCurveTo(cx + M*.05, cy - M*.17, cx, cy - M*.08); g.fillStyle = C.rojo; g.fill();
    g.beginPath(); g.arc(cx, cy - M*.13, M*.015, 0, TAU); g.fillStyle = C.oro; g.fill();
    // los bigotes: tres líneas rojas a cada lado del hocico
    for(const l of [-1, 1]) for(let k = 0; k < 3; k++){
      g.beginPath(); g.moveTo(cx + l*M*.05, cy + M*(.22 + k*.035)); g.quadraticCurveTo(cx + l*M*.14, cy + M*(.2 + k*.04), cx + l*M*.22, cy + M*(.16 + k*.06));
      g.strokeStyle = C.rojo; g.lineWidth = lw*1.3; g.lineCap = 'round'; g.stroke();
    }
    // la boca, roja, y la nariz negra en la punta
    g.beginPath(); g.moveTo(cx - M*.06, cy + M*.37); g.quadraticCurveTo(cx, cy + M*.42, cx + M*.06, cy + M*.37); g.strokeStyle = C.rojoOsc; g.lineWidth = lw*1.6; g.stroke();
    g.beginPath(); g.ellipse(cx, cy + M*.46, M*.03, M*.022, 0, 0, TAU); g.fillStyle = '#1a0806'; g.fill();
    g.restore();
    // los ojos: rasgados, oscuros, hacia arriba y afuera, con un borde rojo
    for(const l of [-1, 1]){
      g.beginPath(); g.moveTo(cx + l*M*.05, cy + M*.03);
      g.quadraticCurveTo(cx + l*M*.12, cy - M*.03, cx + l*M*.21, cy - M*.07);
      g.quadraticCurveTo(cx + l*M*.13, cy + M*.06, cx + l*M*.05, cy + M*.03); g.closePath();
      g.fillStyle = '#0d0403'; g.fill(); g.strokeStyle = C.rojoOsc; g.lineWidth = lw*1.4; g.stroke();
      // el espíritu detrás de la ranura: un brillo dorado que crece y se apaga
      if(espiritu > .01){
        g.save(); g.clip(); const ex = cx + l*M*.13, ey = cy;
        const b = g.createRadialGradient(ex, ey, 0, ex, ey, M*.1); b.addColorStop(0, `rgba(255,236,180,${espiritu})`); b.addColorStop(.5, `rgba(255,192,60,${.8*espiritu})`); b.addColorStop(1, 'rgba(232,67,46,0)');
        g.fillStyle = b; g.fillRect(ex - M*.12, ey - M*.12, M*.24, M*.24); g.restore();
      }
    }
    // el neón: el contorno de la máscara en rojo, las orejas y las marcas en oro
    // cada tubo respira a su tiempo, y todos suben con el espíritu
    const resp = (f: number) => Math.min(1.3, .78 + .22*Math.sin(t*TAU/3.2 + f) + .4*espiritu);
    tubo(g, () => K.contorno(g), C.rojo, '#ffd9c8', lw*1.3, resp(0));
    for(const l of [-1, 1]) tubo(g, () => { g.beginPath(); g.moveTo(cx + l*M*.06, cy - M*.02); g.quadraticCurveTo(cx + l*M*.2, cy - M*.2, cx + l*M*.3, cy - M*.3); }, C.oro, '#fff6dc', lw*.9, resp(1.5 + l));
    tubo(g, () => { g.beginPath(); g.moveTo(cx, cy - M*.08); g.quadraticCurveTo(cx - M*.05, cy - M*.17, cx, cy - M*.27); g.quadraticCurveTo(cx + M*.05, cy - M*.17, cx, cy - M*.08); }, C.naranja, '#ffe6c8', lw*.8, resp(3));
    // una luz que corre por el contorno
    g.save(); g.globalCompositeOperation = 'lighter'; g.setLineDash([M*.08, M*4]); g.lineDashOffset = -t*M*.35;
    K.contorno(g); g.strokeStyle = 'rgba(255,240,220,.9)'; g.lineWidth = lw*1.2; g.stroke(); g.restore();
    g.restore();
  },
};

// el kitsunebi: un fuego fantasmal (dorado pálido, casi blanco) flotando, con su resplandor
function kitsunebi(g: CanvasRenderingContext2D, x: number, y: number, r: number, sem: number, lw: number, t = 0){
  const halo = g.createRadialGradient(x, y, r*.1, x, y, r*2.6); halo.addColorStop(0, 'rgba(255,236,190,.45)'); halo.addColorStop(1, 'rgba(255,236,190,0)');
  g.fillStyle = halo; g.fillRect(x - r*3, y - r*3, r*6, r*6);
  for(let k = 0; k < 3; k++) llama(g, { x: x + (k - 1)*r*.25, y: y + r*.4 }, { x: 0, y: -1 }, { x: 0, y: -1 }, r*(1.6 - Math.abs(k - 1)*.4), r*.32, t*1.4, sem + k*1.9, 1, k === 1 ? '#fff6e0' : '#ffe2a6', lw*.7, 1);
}

export const kyubi: Elemento = {
  id: 'kitsune-kyubi', grupo: GRUPO, nombre: 'Kyūbi · el zorro de nueve colas',
  descripcion: 'El zorro sentado, con los ojos del dragón, sus nueve colas en abanico hechas con la llama del dragón, rodeado de kitsunebi.',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    // animado: las nueve colas se mecen en ola (de afuera hacia adentro, cada una a destiempo) y ondulan como llamas, el
    // zorro respira y parpadea, y los kitsunebi flotan dando vueltas lentas y titilan
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const lw = Math.max(2, w/420), S = h*.62, cx = w/2, piso = h*.94;
    // las nueve colas, detrás, en abanico: llamas grandes en rojos, naranja y claro, de la más de afuera a la del medio
    const raiz: P = { x: cx + S*.05, y: piso - S*.12 };
    const orden = [0, 8, 1, 7, 2, 6, 3, 5, 4];
    for(const k of orden){
      const a = -Math.PI/2 + (k - 4)*.32 + .09*Math.sin(t*TAU/4 - Math.abs(k - 4)*.6) + .04*Math.sin(t*TAU/2.3 + k), d = { x: Math.cos(a), y: Math.sin(a) };
      llama(g, raiz, d, { x: d.x*.4, y: d.y }, S*(1.05 - Math.abs(k - 4)*.06)*(1 + .04*Math.sin(t*TAU/3 + k)), S*.12, t*.6, 90 + k*2.7, k < 4 ? -1 : 1, [C.rojoOsc, C.rojo, C.naranja, C.claro][k % 4], lw*1.2, 1);
    }
    // el cuerpo sentado: lomo, pecho claro, patas delanteras
    const cuerpo = () => {
      g.beginPath(); g.moveTo(cx - S*.18, piso);
      g.bezierCurveTo(cx - S*.26, piso - S*.25, cx - S*.2, piso - S*.5, cx - S*.08, piso - S*.62);
      g.lineTo(cx + S*.1, piso - S*.62);
      g.bezierCurveTo(cx + S*.24, piso - S*.45, cx + S*.28, piso - S*.2, cx + S*.2, piso); g.closePath();
    };
    cuerpo(); g.strokeStyle = SOMBRA; g.lineWidth = lw*3; g.stroke();
    const pelo = g.createLinearGradient(cx - S*.25, 0, cx + S*.25, 0); pelo.addColorStop(0, C.naranja); pelo.addColorStop(1, C.rojoOsc);
    g.fillStyle = pelo; g.fill();
    g.beginPath(); g.moveTo(cx - S*.05, piso - S*.58); g.quadraticCurveTo(cx - S*.13, piso - S*.3, cx - S*.02, piso - S*.08); g.quadraticCurveTo(cx + S*.1, piso - S*.3, cx + S*.06, piso - S*.58); g.closePath();
    g.fillStyle = HUESO; g.fill();
    for(const l of [-1, 1]){ g.beginPath(); g.roundRect(cx + l*S*.07 - S*.035, piso - S*.32, S*.07, S*.32, S*.03); g.fillStyle = C.rojo; g.fill(); g.strokeStyle = SOMBRA; g.lineWidth = lw*1.4; g.stroke(); }
    // la cabeza: hocico largo, orejas altas, los ojos del dragón
    const hy = piso - S*.74;
    const cabeza = () => {
      g.beginPath(); g.moveTo(cx, hy + S*.2);
      g.bezierCurveTo(cx - S*.06, hy + S*.16, cx - S*.16, hy + S*.06, cx - S*.17, hy - S*.04);
      g.lineTo(cx - S*.2, hy - S*.26); g.lineTo(cx - S*.08, hy - S*.12);
      g.quadraticCurveTo(cx, hy - S*.15, cx + S*.08, hy - S*.12);
      g.lineTo(cx + S*.2, hy - S*.26); g.lineTo(cx + S*.17, hy - S*.04);
      g.bezierCurveTo(cx + S*.16, hy + S*.06, cx + S*.06, hy + S*.16, cx, hy + S*.2); g.closePath();
    };
    cabeza(); g.strokeStyle = SOMBRA; g.lineWidth = lw*3; g.stroke(); g.fillStyle = C.naranja; g.fill();
    g.save(); cabeza(); g.clip();
    g.beginPath(); g.moveTo(cx, hy + S*.2); g.quadraticCurveTo(cx - S*.12, hy + S*.08, cx - S*.08, hy + S*.02); g.lineTo(cx + S*.08, hy + S*.02); g.quadraticCurveTo(cx + S*.12, hy + S*.08, cx, hy + S*.2); g.fillStyle = HUESO; g.fill();
    for(const l of [-1, 1]){ g.beginPath(); g.moveTo(cx + l*S*.19, hy - S*.22); g.lineTo(cx + l*S*.16, hy - S*.06); g.lineTo(cx + l*S*.1, hy - S*.12); g.closePath(); g.fillStyle = C.rojoOsc; g.fill(); }
    g.restore();
    const parpado = (t % 5.2) < .24 ? Math.max(.08, Math.abs((t % 5.2) - .12)/.12) : 1;
    for(const l of [-1, 1]) ojoReptil(g, { x: cx + l*S*.075, y: hy - S*.01 }, l < 0 ? Math.PI + .25 : -.25, l < 0 ? -1 : 1, S*.5, lw, parpado);
    g.beginPath(); g.ellipse(cx, hy + S*.19, S*.02, S*.014, 0, 0, TAU); g.fillStyle = '#1a0806'; g.fill();
    // el filo de luz, de un lado
    g.save(); cabeza(); g.clip(); g.beginPath(); g.moveTo(cx - S*.17, hy - S*.04); g.bezierCurveTo(cx - S*.16, hy + S*.06, cx - S*.06, hy + S*.16, cx, hy + S*.2); g.strokeStyle = C.borde; g.lineWidth = lw; g.stroke(); g.restore();
    // los kitsunebi alrededor
    const fuegos: [number, number, number][] = [[.14, .3, .05], [.86, .24, .045], [.2, .7, .04], [.83, .66, .05], [.5, .08, .035], [.68, .45, .03], [.3, .48, .03]];
    fuegos.forEach(([x, y, r], i) => {
      // cada uno da una vuelta lenta alrededor de su lugar, sube y baja, y titila
      const a = t*TAU/(9 + i*1.3) + i*2, px = w*x + Math.cos(a)*w*.025, py = h*y + Math.sin(a*1.3)*h*.03 + Math.sin(t*1.7 + i)*h*.01;
      kitsunebi(g, px, py, h*r*(.9 + .15*Math.sin(t*3.1 + i*1.7)), 200 + i*5.1, lw, t);
    });
  },
};
