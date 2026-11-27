/*
 * Torii, el sexto elemento (Eze, 2026-11-27). El portal tradicional: pilares y vigas bermellón (nuestro rojo), el
 * travesaño de arriba (kasagi) y las bases (nemaki) negros; en el lenguaje del dragón, la sombra oscura que separa las
 * piezas y un filo de luz de un solo lado. Dos piezas: sobre el agua, con su reflejo partido por las ondas (el instante
 * de los reflejos en movimiento), y el túnel infinito (la profundidad como oscuridad, la regla del dragón: `Hondura`).
 * Estáticos; el movimiento previsto, en `animacion`.
 */
import { C, SOMBRA, TAU, hash, Hondura } from '../dragon/estilo';
import type { Elemento } from './index';

const ANIMACION = 'Puertas Torii: una puerta Torii flotando sobre el agua con reflejos en movimiento, o creando un efecto de "túnel infinito" por el que avanza la cámara.';
const GRUPO = 'Torii';
const NEGRO = '#1c0a07';

// Un torii de frente: la base al centro en (cx, piso), de alto H. Proporciones clásicas (myōjin): kasagi curvo que se
// levanta en las puntas, shimaki debajo, nuki (el travesaño de abajo) que sobresale de los pilares, gakuzuka (el poste
// corto del medio), pilares levemente inclinados hacia adentro, nemaki negros en la base.
function torii(g: CanvasRenderingContext2D, cx: number, piso: number, H: number, lw: number){
  const pilarX = H*.34, pilarW = H*.065, top = piso - H;
  const caja = (x: number, y: number, w: number, h: number, col: string, filo = true) => {
    g.beginPath(); g.rect(x, y, w, h); g.fillStyle = col; g.fill(); g.strokeStyle = SOMBRA; g.lineWidth = lw*1.6; g.stroke();
    if(filo){ g.beginPath(); g.moveTo(x + lw, y + h - lw); g.lineTo(x + lw, y + lw); g.lineTo(x + w*.7, y + lw); g.strokeStyle = C.borde; g.lineWidth = lw*.7; g.stroke(); }
  };
  // los pilares, apenas inclinados hacia adentro (un trapecio cada uno)
  for(const l of [-1, 1]){
    const xa = cx + l*pilarX, inc = l*H*.025;
    g.beginPath();
    g.moveTo(xa - pilarW/2 - inc, top + H*.16); g.lineTo(xa + pilarW/2 - inc, top + H*.16);
    g.lineTo(xa + pilarW/2, piso - H*.06); g.lineTo(xa - pilarW/2, piso - H*.06); g.closePath();
    g.fillStyle = C.rojo; g.fill(); g.strokeStyle = SOMBRA; g.lineWidth = lw*1.6; g.stroke();
    // sombra del lado derecho del pilar (volumen) y el filo de luz del izquierdo
    g.beginPath(); g.moveTo(xa + pilarW*.18 - inc, top + H*.16); g.lineTo(xa + pilarW/2 - inc, top + H*.16); g.lineTo(xa + pilarW/2, piso - H*.06); g.lineTo(xa + pilarW*.18, piso - H*.06); g.closePath();
    g.fillStyle = 'rgba(80,10,6,.45)'; g.fill();
    g.beginPath(); g.moveTo(xa - pilarW/2 - inc + lw, top + H*.17); g.lineTo(xa - pilarW/2 + lw, piso - H*.07); g.strokeStyle = C.borde; g.lineWidth = lw*.7; g.stroke();
    // el nemaki, la base negra
    caja(xa - pilarW*.62, piso - H*.075, pilarW*1.24, H*.075, NEGRO, false);
  }
  // el nuki, el travesaño de abajo, que sobresale de los pilares
  caja(cx - pilarX - H*.12, top + H*.3, (pilarX + H*.12)*2, H*.05, C.rojo);
  // el gakuzuka, el poste corto entre el nuki y el shimaki (con su tablilla)
  caja(cx - H*.03, top + H*.17, H*.06, H*.13, C.rojo);
  caja(cx - H*.055, top + H*.185, H*.11, H*.08, NEGRO, false);
  // el shimaki, la viga roja bajo el kasagi
  caja(cx - pilarX - H*.17, top + H*.1, (pilarX + H*.17)*2, H*.06, C.rojo);
  // el kasagi: la viga negra de arriba, curva, con las puntas levantadas
  const ancho = pilarX + H*.26, alto = H*.075;
  g.beginPath();
  g.moveTo(cx - ancho, top - H*.035); g.quadraticCurveTo(cx, top + H*.05, cx + ancho, top - H*.035);
  g.lineTo(cx + ancho - H*.02, top + alto - H*.02); g.quadraticCurveTo(cx, top + alto + H*.06, cx - ancho + H*.02, top + alto - H*.02);
  // negro como manda la tradición, pero con contorno rojo profundo (sobre un fondo oscuro, negro con sombra no se veía:
  // el portal parecía sin techo) y un filo cálido a todo lo largo del borde de arriba
  g.closePath(); g.fillStyle = NEGRO; g.fill(); g.strokeStyle = C.pata; g.lineWidth = lw*1.4; g.stroke();
  g.beginPath(); g.moveTo(cx - ancho + lw*2, top - H*.03); g.quadraticCurveTo(cx, top + H*.052, cx + ancho - lw*2, top - H*.03);
  g.strokeStyle = C.naranja; g.lineWidth = lw*1.1; g.stroke();
}

// El torii sobre el agua: el agua oscura, una luna baja dorada con su estela, y el reflejo del portal partido en franjas
// por las ondas (cada franja corrida un poco, y más oscuro que el portal)
// Animado (Eze, 2026-11-27): el agua se mueve. Las ondas corren por el reflejo (cada franja se mece, más cerca más
// ancho), la estela de la luna titila, y faroles flotantes (tōrō nagashi, los de papel que se sueltan en el agua) cruzan
// despacio con su reflejo. En bucle exacto de `AGUA` s (las ondas dan vueltas enteras, los faroles cruzan una vez).
const AGUA = 24;
let capaTorii: HTMLCanvasElement | null = null;
export const toriiAgua: Elemento = {
  id: 'torii-agua', grupo: GRUPO, nombre: 'Torii sobre el agua',
  descripcion: 'El portal flotando sobre agua oscura bajo una luna baja. Animado: las ondas mueven su reflejo, titila la estela de la luna y cruzan faroles flotantes.',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    const fase = (t % AGUA)/AGUA*TAU;
    const lw = Math.max(2, w/420), horizonte = h*.55, H = h*.4;   // así el reflejo entero (con las vigas) entra en el cuadro
    // el cielo, casi negro con un calor rojizo hacia el horizonte; el agua, más negra
    const cielo = g.createLinearGradient(0, 0, 0, horizonte);
    cielo.addColorStop(0, '#000'); cielo.addColorStop(1, '#2a0c07');
    g.fillStyle = cielo; g.fillRect(0, 0, w, horizonte);
    g.fillStyle = '#050202'; g.fillRect(0, horizonte, w, h - horizonte);
    // la luna, baja a la derecha, y su estela en el agua
    const lx = w*.76, ly = horizonte - H*.42, lr = H*.13;
    const halo = g.createRadialGradient(lx, ly, lr*.6, lx, ly, lr*4); halo.addColorStop(0, 'rgba(255,192,106,.35)'); halo.addColorStop(1, 'rgba(255,192,106,0)');
    g.fillStyle = halo; g.fillRect(lx - lr*4, ly - lr*4, lr*8, lr*8);
    g.beginPath(); g.arc(lx, ly, lr, 0, TAU); g.fillStyle = '#ffd98a'; g.fill();
    for(let k = 0; k < 26; k++){
      // cada raya de la estela respira y se corre con las ondas
      const y = horizonte + 4 + k*(h - horizonte)/26, ancho = lr*(.6 + hash(k*3.7)*1.4)*(1 + k*.05)*(.75 + .35*Math.sin(fase*3 + k*1.9));
      const dx = (hash(k)*2 - 1)*lr*.3 + Math.sin(fase*2 + k*.8)*lr*.25*(1 + k*.04);
      g.fillStyle = `rgba(255,208,58,${(.5 - k*.017)*(.7 + .3*Math.sin(fase*4 + k*2.3))})`; g.fillRect(lx - ancho/2 + dx, y, ancho, lw*1.2);
    }
    // el portal, en una capa propia para reflejarlo (dibujada una vez por tamaño: no cambia)
    if(!capaTorii || capaTorii.width !== w || capaTorii.height !== h){
      capaTorii = document.createElement('canvas'); capaTorii.width = w; capaTorii.height = h;
      const cg = capaTorii.getContext('2d')!; cg.lineJoin = 'round';
      torii(cg, w*.42, horizonte + H*.02, H, lw);
    }
    const capa = capaTorii;
    // el reflejo: dado vuelta bajo el horizonte, en franjas corridas por las ondas, oscurecido
    const franjas = 60, alto = (h - horizonte)/franjas;
    for(let k = 0; k < franjas; k++){
      // las ondas: suaves junto al horizonte, más abiertas hacia adelante
      const y = horizonte + k*alto, q = k/franjas, corr = (Math.sin(k*1.3 - fase*3) + .6*Math.sin(k*3.1 + 1 + fase*5))*lw*(.6 + q*5);
      g.save(); g.beginPath(); g.rect(0, y, w, alto*(.96 - q*.25)); g.clip();
      g.translate(corr, horizonte*2 + H*.04); g.scale(1, -1);
      g.globalAlpha = .6 - q*.45; g.drawImage(capa, 0, 0); g.restore();
    }
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, horizonte, w, h - horizonte);
    g.drawImage(capa, 0, 0);
    // la línea del agua al pie del portal
    g.fillStyle = 'rgba(255,192,106,.18)'; g.fillRect(0, horizonte, w, lw);
    // los faroles flotantes: cruzan de izquierda a derecha a distintas distancias (los lejanos, más chicos y lentos en
    // pantalla), mecidos por las ondas, cada uno con su reflejo alargado
    for(let k = 0; k < 6; k++){
      const prof = .15 + hash(k*3.1)*.85, y = horizonte + (h - horizonte)*(.08 + prof*.75), s = H*.06*(.35 + prof*.9);
      const x = ((hash(k*7.7) + (t % AGUA)/AGUA) % 1)*(w + s*8) - s*4, bob = Math.sin(fase*4 + k*2)*s*.12;
      const refl = g.createLinearGradient(0, y + s*.2, 0, y + s*2.6); refl.addColorStop(0, 'rgba(255,170,80,.5)'); refl.addColorStop(1, 'rgba(255,170,80,0)');
      g.fillStyle = refl; g.fillRect(x - s*.35 + Math.sin(fase*6 + k)*s*.15, y + s*.2, s*.7, s*2.4);
      const halo = g.createRadialGradient(x, y - s*.4, 0, x, y - s*.4, s*2.2); halo.addColorStop(0, 'rgba(255,170,80,.35)'); halo.addColorStop(1, 'rgba(255,170,80,0)');
      g.fillStyle = halo; g.fillRect(x - s*2.2, y - s*2.6, s*4.4, s*4.4);
      // el farol: una base de madera y una caja de papel encendida, con su techo
      g.fillStyle = '#1c0a07'; g.fillRect(x - s*.55, y + bob, s*1.1, s*.22);
      const papel = g.createLinearGradient(0, y - s + bob, 0, y + bob); papel.addColorStop(0, C.oro); papel.addColorStop(1, C.naranja);
      g.fillStyle = papel; g.fillRect(x - s*.42, y - s*.9 + bob, s*.84, s*.9);
      g.strokeStyle = SOMBRA; g.lineWidth = Math.max(1, lw*.5*prof); g.strokeRect(x - s*.42, y - s*.9 + bob, s*.84, s*.9);
      g.fillStyle = '#1c0a07'; g.fillRect(x - s*.55, y - s*1.02 + bob, s*1.1, s*.14);
    }
  },
};

// El túnel infinito: torii uno detrás de otro (como en Fushimi Inari), cada vez más chicos hacia el punto de fuga y más
// oscuros con la distancia (la profundidad del dragón: oscuridad, no transparencia); el suelo, un sendero que se pierde.
// Animado: la cámara avanza por el túnel, despacio, sin fin: cada `PASO` s cruza un torii (pasa por encima de la cámara
// y sale del cuadro), y en el fondo nace otro de la oscuridad; las juntas de las piedras del sendero vienen hacia uno;
// la mirada se mece apenas, como quien camina. Bucle exacto: después de un paso, todo está igual.
const PASO = 2.6;
export const toriiTunel: Elemento = {
  id: 'torii-tunel', grupo: GRUPO, nombre: 'Túnel de torii',
  descripcion: 'Torii uno detrás de otro, hacia un punto de fuga. Animado: la cámara avanza por el túnel sin fin, cruzando un portal tras otro.',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    const lw = Math.max(2, w/420), avance = (t % PASO)/PASO, mece = Math.sin((t % (PASO*4))/(PASO*4)*TAU);
    const fx = w/2 + mece*w*.008, fy = h*.44 + Math.abs(Math.sin((t % (PASO*2))/(PASO*2)*TAU))*h*.004;
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    // el sendero: un trapecio de piedra oscura que se pierde en el punto de fuga
    const sendero = g.createLinearGradient(0, fy, 0, h);
    sendero.addColorStop(0, '#000'); sendero.addColorStop(1, '#1d0d09');
    g.beginPath(); g.moveTo(fx - w*.01, fy); g.lineTo(fx + w*.01, fy); g.lineTo(fx + w*.42, h); g.lineTo(fx - w*.42, h); g.closePath();
    g.fillStyle = sendero; g.fill();
    // las juntas del sendero, que vienen hacia uno con el avance
    for(let j = 0; j < 30; j++){
      const z = (j - avance*2)*.21 + .02; if(z <= 0) continue;
      const k = 1/(1 + z*.9), y = fy + (h*1.05 - fy)*k, mitad = (w*.01 + (w*.42 - w*.01)*(y - fy)/(h - fy));
      g.beginPath(); g.moveTo(fx - mitad, y); g.lineTo(fx + mitad, y); g.strokeStyle = `rgba(0,0,0,${.6*Math.min(1, k*2)})`; g.lineWidth = Math.max(1, lw*1.5*k); g.stroke();
    }
    // los torii, del más lejano al más cercano; la hondura los achica hacia el punto de fuga y los oscurece; con el
    // avance todos se acercan un lugar, y el más cercano pasa por encima de la cámara
    const hond = new Hondura();
    for(let i = 17; i >= -2; i--){
      // el que pasa se sigue dibujando hasta salir del cuadro (cortado antes, desaparecía de golpe)
      const z = (i - avance)*.42 + .05; if(z < -.56) continue;
      const k = 1/(1 + z*.9);
      hond.osc = Math.min(1, Math.max(0, Math.pow(1 - Math.max(0, z)/7.2, 1.6)));
      const gz = hond.envolver(g); gz.lineJoin = 'round';
      const H = h*1.15*k, piso = fy + (h*1.05 - fy)*k;
      torii(gz, fx, piso, H, lw*Math.max(.35, k));
    }
    g.globalAlpha = 1;
  },
};
