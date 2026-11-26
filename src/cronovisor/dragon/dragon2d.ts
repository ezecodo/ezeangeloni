/*
 * El dragón plano (Eze, 2026-11-26, después de ver el video de la mesa de Miss Ko en París): no 3D, sino un dibujo
 * gráfico visto desde arriba, como el de ellos: contornos claros y gruesos que se leen proyectados sobre la mesa, la
 * cabeza con sus ojos de anillo, el cuerpo en franjas de medialuna y, sobre todo, cientos de llamas onduladas con borde
 * claro que salen del cuerpo hacia los costados y hacia atrás, mecidas como pelo en el agua: eso lo hace ancho.
 * Los colores son los del dragón 3D (la paleta festiva de la mesa).
 *
 * Todo sale de dos números: `u`, dónde va la pasada (0 → 1, en bucle), y `t`, el reloj en segundos. No guarda estado,
 * así que el bucle no salta y el video cuadro a cuadro sale exacto.
 *
 * El vuelo, como en el cenital 3D: la cabeza dibuja una sola S amplia y serena a lo ancho de la mesa, y lo que
 * serpentea es el cuerpo (una onda larga que lo recorre hacia la cola, creciendo desde el cuello); el avance late un
 * poco con cada brazada.
 */

type P = { x: number; y: number };
const TAU = Math.PI*2;
const suave = (q: number) => q*q*(3 - 2*q);
const lim = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const hash = (n: number) => { const s = Math.sin(n*12.9898)*43758.5453; return s - Math.floor(s); };

// la paleta del dragón 3D
const C = {
  cuerpo: '#3a9fd8', luz: '#a6e4ff', vientre: '#ffd35a', placa: '#d98a2a', trazo: '#1d5a8c',
  rojo: '#e8432e', rojoOsc: '#b8241a', naranja: '#f6744a', claro: '#ffc06a',
  oro: '#ffd03a', hueso: '#f2d28a', borde: '#fff3dc', ojo: '#1f3f6e',
};

export class DragonPlano {
  private L: number; private H: number; private R: number; private F: number;
  private x0: number; private x1: number;
  private arco: Float64Array; private xs: Float64Array;
  private S_INI = 0; private S_FIN = 0;
  private readonly N = 120;

  // w, h: la mesa en píxeles; el dragón se dibuja con el origen en su esquina de arriba a la izquierda
  constructor(readonly w: number, readonly h: number){
    this.L = w*.8;            // el largo del cuerpo: ~80 % de la mesa
    this.F = this.L*.105;     // la escala de las llamas y las patas
    this.H = this.L*.14;      // la cabeza: grande, es lo que se mira (como en la referencia)
    this.R = this.L*.04;      // medio ancho del cuerpo en el pecho
    const L = this.L;
    this.x0 = -w/2 - L - 700; this.x1 = w/2 + L + 700;
    const PASOS = 6000;
    this.arco = new Float64Array(PASOS + 1); this.xs = new Float64Array(PASOS + 1);
    let prev = this.camino(this.x0); this.xs[0] = this.x0;
    for(let j = 1; j <= PASOS; j++){
      const x = this.x0 + (this.x1 - this.x0)*j/PASOS, p = this.camino(x);
      this.arco[j] = this.arco[j - 1] + Math.hypot(p.x - prev.x, p.y - prev.y); this.xs[j] = x; prev = p;
    }
    // la pasada: empieza con la perla y la cabeza fuera por la izquierda, termina con las últimas llamas de la cola
    // fuera por la derecha (en el salto del bucle la mesa está vacía)
    const sDeX = (x: number) => this.arco[Math.round((x - this.x0)/(this.x1 - this.x0)*PASOS)];
    this.S_INI = sDeX(-w/2 - this.H*2.4);
    this.S_FIN = sDeX(w/2 + this.F*2.4) + L;
  }

  // la S de la cabeza, en coordenadas centradas en la mesa
  private camino(x: number): P {
    const f = x/(this.w/2), hh = this.h/2;
    // más tendida que la del cenital 3D: con las alas abiertas el dragón es muy ancho y se salía de la mesa en las curvas
    return { x, y: hh*(.22*Math.sin(f*Math.PI*.5 + .2) + .03*Math.sin(f*Math.PI*1.1 + 2.1) - .05*f) };
  }
  private enArco(s: number): P {
    const a = this.arco, n = a.length - 1;
    if(s <= 0) return this.camino(this.x0);
    if(s >= a[n]) return this.camino(this.x1);
    let lo = 0, hi = n;
    while(hi - lo > 1){ const m = (lo + hi) >> 1; if(a[m] < s) lo = m; else hi = m; }
    const f = (s - a[lo])/((a[hi] - a[lo]) || 1);
    return this.camino(this.xs[lo] + (this.xs[hi] - this.xs[lo])*f);
  }

  // el ancho del cuerpo a lo largo (0 la nuca, 1 la punta de la cola), en medios anchos del pecho
  private perfil(f: number){
    const cuello = .62 + .38*suave(lim(f/.16, 0, 1));
    const cola = f < .38 ? 1 : 1 - .9*Math.pow((f - .38)/.62, 1.1);
    return cuello*cola - .06*Math.exp(-Math.pow((f - .3)/.06, 2));
  }

  draw(ctx: CanvasRenderingContext2D, u: number, t: number){
    const { N, L, R } = this, H = this.F;
    // el avance late ±6 % con las brazadas (ciclos enteros por pasada: el bucle no salta)
    const ritmo = 5, uu = u + .06/(TAU*ritmo)*Math.sin(TAU*ritmo*u);
    const sCab = this.S_INI + (this.S_FIN - this.S_INI)*uu, ds = L/N;
    // la columna: el camino detrás de la cabeza, más la onda de lado que la recorre
    const sp: P[] = [], T: P[] = [], Nn: P[] = [], r: number[] = [];
    const k = TAU/(L*.85), w = 2.2;
    for(let i = 0; i <= N; i++){
      const s = sCab - i*ds, a = this.enArco(s), b = this.enArco(s + 1);
      let tx = b.x - a.x, ty = b.y - a.y; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const f = i/N, env = suave(lim((f - .02)/.5, 0, 1))*(1 - .25*f);
      const o = Math.sin(k*i*ds - w*t)*R*1.5*env;
      sp.push({ x: a.x - ty*o + this.w/2, y: a.y + tx*o + this.h/2 });
      r.push(R*this.perfil(f)*(1 + .04*Math.sin(t*1.6)*Math.exp(-Math.pow((f - .2)/.1, 2))));
    }
    for(let i = 0; i <= N; i++){
      const a = sp[Math.max(0, i - 1)], b = sp[Math.min(N, i + 1)];
      let tx = a.x - b.x, ty = a.y - b.y; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      T.push({ x: tx, y: ty }); Nn.push({ x: -ty, y: tx });   // T hacia la cabeza, N a su izquierda
    }
    // "hacia atrás" para el pelaje: la cuerda hacia el cuerpo de más atrás, no la tangente local. La tangente gira con
    // la onda del cuerpo en cada anillo, y una llama larga y rígida a lo largo de ella barría de lado a lado, rápido y a
    // tirones (Eze lo vio en el medio del lomo); la cuerda sigue la curva del cuerpo con calma
    const atrasDe = (i: number, k: number) => {
      const b = sp[Math.min(N, i + k)], a = sp[i];
      let x = b.x - a.x, y = b.y - a.y; const l = Math.hypot(x, y);
      if(l < 1e-3 || i + k > N) return { x: -T[i].x, y: -T[i].y };
      return { x: x/l, y: y/l };
    };
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const lw = Math.max(2, this.w/650);   // el grosor del contorno

    // ── las patas, lo primero: quedan debajo del pelaje de llamas, que las tapa en el hombro y el codo, y asoman las
    // manos y las garras (Eze, 2026-11-26: como en Miss Ko, las patas no van encima del pelaje sino por debajo)
    for(const [f, delantera] of [[.17, true], [.47, false]] as [number, boolean][]) for(const lado of [1, -1])
      this.pata(ctx, Math.round(f*N), delantera, lado, sp, T, Nn, r, t, lw);
    // ── las alas, debajo del pelaje (Eze: que salgan por debajo de las escamas, así no se ven los cortes en el
    // hombro: el pelaje de los costados y del lomo tapa sus raíces): de membrana, como las de un murciélago o un wyvern (Eze, 2026-11-26, con la foto de unas alas de
    // fieltro: "menos elementos"). Por lado, pocas piezas: el brazo (del hombro a la muñeca, el borde de adelante),
    // cuatro dedos largos que salen de la muñeca en abanico hacia atrás, y una sola membrana tensada entre ellos, con el
    // borde de atrás en festones (cada tramo entre dos puntas se curva hacia la muñeca) que vuelve al cuerpo detrás del
    // hombro. Membrana dorada y naranja, huesos rojo oscuro, un filo claro en el borde de adelante. Aletean despacio:
    // se abren y se pliegan un poco (el ancho) y barren apenas hacia adelante y atrás.
    { const iA = Math.round(N*.2), iB = Math.min(N, iA + 17);
      for(const lado of [1, -1]){
        const n = { x: Nn[iA].x*lado, y: Nn[iA].y*lado }, at = atrasDe(iA, 12), fw = { x: -at.x, y: -at.y };
        const nB = { x: Nn[iB].x*lado, y: Nn[iB].y*lado };
        const abre = .86 + .14*Math.sin(t*1.25), barre = .12*Math.sin(t*1.25 - .6);
        const span = H*2.9;
        const en = (o: P, afuera: number, adelante: number) => ({ x: o.x + n.x*afuera + fw.x*adelante, y: o.y + n.y*afuera + fw.y*adelante });
        const hombro = { x: sp[iA].x + n.x*r[iA]*.4, y: sp[iA].y + n.y*r[iA]*.4 };
        const cuerpoAtras = { x: sp[iB].x + nB.x*r[iB]*.8, y: sp[iB].y + nB.y*r[iB]*.8 };
        const muneca = en(hombro, span*.36*abre, span*(.1 + barre));
        // las puntas de los dedos: de afuera-adelante a atrás, cada una más corta
        const puntas: P[] = [];
        for(let k = 0; k < 4; k++){
          const a = (.05 + k*.42)*(.9 + .1*abre) - barre*.5, largo = span*(.78 - k*.1);
          puntas.push({ x: muneca.x + (n.x*Math.cos(a) + at.x*Math.sin(a))*largo*(k ? 1 : abre), y: muneca.y + (n.y*Math.cos(a) + at.y*Math.sin(a))*largo*(k ? 1 : abre) });
        }
        // El ala hecha sólo de escamas (Eze: sin la silueta de murciélago, y no tantas): nada recorta ni rellena; las
        // escamas mismas dibujan el ala. Cinco rayos del hombro (a la muñeca y a cada punta de dedo) y tres filas por
        // rayo, superpuestas como las del lomo (las de afuera primero, las de adentro encima tapando sus raíces); las de
        // la última fila llegan hasta donde estaba el borde, así el tamaño y la forma general se mantienen.
        const destinos = [muneca, ...puntas];
        const FILAS = 3;
        for(let fila = FILAS - 1; fila >= 0; fila--){
          const q0 = .05 + fila*.31;
          destinos.forEach((dst, j) => {
            const dx = dst.x - hombro.x, dy = dst.y - hombro.y, l = Math.hypot(dx, dy) || 1, d = { x: dx/l, y: dy/l };
            const base = { x: hombro.x + dx*q0, y: hombro.y + dy*q0 };
            const color = (fila + j) % 3 === 0 ? C.naranja : (fila + j) % 3 === 1 ? C.rojo : C.rojoOsc;
            this.llama(ctx, base, d, d, l*.5, Math.max(H*.13, l*.12), t, 700 + j*1.7 + fila*.61 + (lado > 0 ? 0 : 13), lado, color, lw, 1, true);
          });
        }
      }
    }
    // ── el pelaje de los costados, de la cola hacia la cabeza (las de adelante encima). Menos y más anchas (Eze,
    // 2026-11-26: "que cubran lo mismo pero que no sean tantas"), parejo a lo largo: las alas van aparte.
    for(let i = N - 4; i >= 4; i -= 5){
      const f = i/N;
      for(const lado of [1, -1]){
        const sem = i*2 + (lado > 0 ? 0 : 1), h1 = hash(sem), h2 = hash(sem + 77);
        const largo = H*(1 + .3*h1)*(f < .5 ? 1 - .2*f : .9 - .9*(f - .5));
        if(largo < H*.2) continue;
        const base = { x: sp[i].x + Nn[i].x*lado*r[i]*.7, y: sp[i].y + Nn[i].y*lado*r[i]*.7 };
        const fuera = { x: Nn[i].x*lado, y: Nn[i].y*lado };
        const color = h2 < .55 ? C.rojo : C.rojoOsc;
        this.llama(ctx, base, fuera, atrasDe(i, 10), largo, Math.max(r[i], R*.45)*.68, t, i*.45 + lado*1.3, lado, color, lw, .3 + .2*h2);
      }
    }
    // la cola: un penacho de llamas hacia atrás
    for(let j = 0; j < 9; j++){
      const a = (j - 4)*.2 + Math.sin(t*2 + j)*.06, c = Math.cos(a), s = Math.sin(a);
      const atras = { x: -T[N].x*c + T[N].y*s, y: -T[N].y*c - T[N].x*s };
      this.llama(ctx, sp[N - 1], { x: atras.x, y: atras.y }, atras, H*(1.1 + .5*hash(j + 300) - Math.abs(j - 4)*.12), R*.3, t, j*1.1, j < 4 ? 1 : -1, j % 3 ? C.rojo : C.naranja, lw, .1);
    }


    // ── el cuerpo: contorno claro, relleno azul, franjas de medialuna
    ctx.beginPath();
    for(let i = 0; i <= N; i++) { const p = sp[i]; i ? ctx.lineTo(p.x + Nn[i].x*r[i], p.y + Nn[i].y*r[i]) : ctx.moveTo(p.x + Nn[i].x*r[i], p.y + Nn[i].y*r[i]); }
    for(let i = N; i >= 0; i--){ const p = sp[i]; ctx.lineTo(p.x - Nn[i].x*r[i], p.y - Nn[i].y*r[i]); }
    ctx.closePath();
    ctx.fillStyle = C.cuerpo; ctx.fill();
    // las franjas: medialunas que miran hacia atrás, amarillas, cada una con su borde claro
    ctx.save(); ctx.clip();
    // franjas anchas en medialuna (como las de la referencia), con la panza hacia atrás
    for(let i = 8; i < N - 8; i += 8){
      const e = 3, q = (k2: number, lado: number) => ({ x: sp[k2].x + Nn[k2].x*r[k2]*lado*1.1, y: sp[k2].y + Nn[k2].y*r[k2]*lado*1.1 });
      const curva = (k2: number) => { const c = sp[Math.min(N, k2 + 5)]; return { x: c.x, y: c.y }; };
      const a1 = q(i, 1), a2 = q(i, -1), c1 = curva(i), b1 = q(i + e, 1), b2 = q(i + e, -1), c2 = curva(i + e);
      ctx.beginPath(); ctx.moveTo(a1.x, a1.y); ctx.quadraticCurveTo(c1.x*2 - (a1.x + a2.x)/2, c1.y*2 - (a1.y + a2.y)/2, a2.x, a2.y);
      ctx.lineTo(b2.x, b2.y); ctx.quadraticCurveTo(c2.x*2 - (b1.x + b2.x)/2, c2.y*2 - (b1.y + b2.y)/2, b1.x, b1.y); ctx.closePath();
      ctx.fillStyle = C.vientre; ctx.fill();
      ctx.strokeStyle = C.borde; ctx.lineWidth = lw*.9; ctx.stroke();
    }
    // una línea de luz por el lomo
    ctx.beginPath(); for(let i = 4; i < N - 6; i++) i === 4 ? ctx.moveTo(sp[i].x, sp[i].y) : ctx.lineTo(sp[i].x, sp[i].y);
    ctx.strokeStyle = C.luz; ctx.globalAlpha = .35; ctx.lineWidth = R*.22; ctx.stroke(); ctx.globalAlpha = 1;
    ctx.restore();
    // el contorno
    ctx.beginPath();
    for(let i = 0; i <= N; i++) { const p = sp[i]; i ? ctx.lineTo(p.x + Nn[i].x*r[i], p.y + Nn[i].y*r[i]) : ctx.moveTo(p.x + Nn[i].x*r[i], p.y + Nn[i].y*r[i]); }
    for(let i = N; i >= 0; i--){ const p = sp[i]; ctx.lineTo(p.x - Nn[i].x*r[i], p.y - Nn[i].y*r[i]); }
    ctx.closePath(); ctx.strokeStyle = C.borde; ctx.lineWidth = lw*.9; ctx.stroke();
    // ── el pelaje del lomo (Eze, 2026-11-26: desde arriba el torso no puede verse pelado): filas de llamas tendidas
    // hacia atrás sobre el lomo, superpuestas como escamas (de la cola hacia la cabeza, cada fila tapa la raíz de la de
    // atrás), tranquilas y ordenadas: dos o tres por fila según el ancho, alternando el tono por fila. Asoma el azul
    // sólo en los bordes.
    for(let i = N - 6, fila = 0; i >= 4; i -= 6, fila++){
      const n = r[i] > R*.5 ? 2 : 1;
      for(let k = 0; k < n; k++){
        const off = n === 1 ? 0 : (k/(n - 1) - .5)*.75 + (fila % 2 ? .1 : -.1);
        const lado = off >= 0 ? 1 : -1;
        const base = { x: sp[i].x + Nn[i].x*off*r[i], y: sp[i].y + Nn[i].y*off*r[i] };
        const color = fila % 2 ? (k ? C.rojo : C.rojoOsc) : (k ? C.rojoOsc : C.rojo);
        this.llama(ctx, base, { x: Nn[i].x*lado, y: Nn[i].y*lado }, atrasDe(i, 18), r[i]*4.6, r[i]*.82, t, i*.37 + k, lado, color, lw*.85, .12*Math.abs(off)*2, true);
      }
    }
    // ── la cabeza, la melena y la perla
    this.cabeza(ctx, sp, T, r, t, lw);
  }

  // Una llama, como las alas del dragón de Miss Ko (Eze, 2026-11-26: "más irregulares"): no lenguas iguales con borde
  // entero, sino rizos en S gruesos, cada uno con su carácter (sacado de `fase`, así es estable cuadro a cuadro): su
  // largo de onda, su amplitud, su grosor, el gancho de la punta; uno de cada cinco es una cinta larga que ondula varias
  // veces. Lo que separa una llama de la de abajo es una sombra oscura (no un contorno claro); el blanco es sólo un filo
  // de luz de un lado, el de afuera, que se corta antes de la punta.
  // `fuera`: hacia dónde sale; `atras`: hacia dónde la lleva el vuelo; `abre`: cuánto sale hacia afuera (0 todo atrás)
  private llama(ctx: CanvasRenderingContext2D, base: P, fuera: P, atras: P, largo: number, ancho: number, t: number, fase: number, lado: number, color: string, lw: number, abre = .55, regular = false){
    // la semilla sólo de `fase` y `lado`, nunca del largo o el ancho: en el pecho esos respiran con el cuerpo, y una
    // semilla que cambia cada cuadro cambiaba la forma de cada escama cada cuadro (Eze vio el lomo del pecho agitado)
    const sem = fase*3.71 + lado*.17, h1 = hash(sem), h2 = hash(sem + 11), h3 = hash(sem + 23), h4 = hash(sem + 37);
    const cinta = !regular && h4 < .1;                                  // una cinta larga y ondulada
    const ondas = cinta ? 3 + h1*1 : 1.9 + h1*.5;      // cuántas medias ondas a lo largo
    const amp = regular ? .035 : (cinta ? .09 : .15) + h2*.04;                 // cuánto se mece de lado
    const grueso = ((cinta ? .75 : .95) + h3*.25)*1.05;
    const gancho = (regular ? 0 : cinta ? .05 : .1 + h2*.14)*(h3 < .5 ? 1 : -1)*lado;   // la punta se riza, a un lado o al otro
    const L = largo*(cinta ? 1.25 : .95 + h1*.2);
    const M = 32, izq: P[] = [], der: P[] = [], cen: P[] = [];
    let dx = fuera.x*abre + atras.x*(1 - abre*.4), dy = fuera.y*abre + atras.y*(1 - abre*.4);
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const px = -dy, py = dx;
    for(let j = 0; j <= M; j++){
      const q = j/M;
      // la onda viaja de la raíz a la punta, más lenta en las cintas; la punta se enrosca en gancho
      const ola = Math.sin(q*Math.PI*ondas - t*(regular ? 1.6 : cinta ? 2.2 : 2.8) + fase + h2*6)*L*amp*Math.pow(q, .55);
      const rizo = gancho*L*Math.pow(q, 3);
      const curva = q*q*L*.22;
      cen.push({ x: base.x + dx*q*L + px*(ola + rizo) + atras.x*curva, y: base.y + dy*q*L + py*(ola + rizo) + atras.y*curva });
    }
    for(let j = 0; j <= M; j++){
      const q = j/M, a = cen[Math.max(0, j - 1)], b = cen[Math.min(M, j + 1)];
      let tx = b.x - a.x, ty = b.y - a.y; const l2 = Math.hypot(tx, ty) || 1; tx /= l2; ty /= l2;
      // gruesa en el primer tercio (la panza del rizo) y afinándose hasta la punta
      const punta = 1 - suave(lim((q - (cinta ? .45 : .5))/(cinta ? .55 : .5), 0, 1));   // pareja casi hasta el final, la punta redondeada
      const w = ancho*grueso*Math.sqrt(punta)*(cinta ? .55 + .1*Math.sin(q*9 + h1*5) : .8 + .2*Math.sin(Math.min(1, q*1.5)*Math.PI))*(1 - .2*q);
      izq.push({ x: cen[j].x - ty*w, y: cen[j].y + tx*w }); der.push({ x: cen[j].x + ty*w, y: cen[j].y - tx*w });
    }
    const silueta = () => {
      ctx.beginPath(); ctx.moveTo(izq[0].x, izq[0].y);
      for(let j = 1; j <= M; j++) ctx.lineTo(izq[j].x, izq[j].y);
      for(let j = M; j >= 0; j--) ctx.lineTo(der[j].x, der[j].y);
      ctx.closePath();
    };
    // la sombra: la misma silueta en casi negro, más gruesa, que la despega de lo que tiene debajo
    silueta(); ctx.strokeStyle = 'rgba(12,6,8,.9)'; ctx.lineWidth = lw*(regular ? 1.8 : 3); ctx.stroke();
    ctx.fillStyle = color; ctx.fill();
    // el filo de luz: sólo de un lado (el de afuera), de la raíz hasta antes de la punta, y no en todas
    if(h2 > .18){
      const borde = lado*gancho >= 0 ? izq : der, hasta = Math.round(M*(.55 + h1*.35));
      ctx.beginPath(); ctx.moveTo(borde[2].x, borde[2].y);
      for(let j = 3; j <= hasta; j++) ctx.lineTo(borde[j].x, borde[j].y);
      ctx.strokeStyle = C.borde; ctx.lineWidth = lw*(.9 + h3*.6); ctx.stroke();
    }
  }

  private pata(ctx: CanvasRenderingContext2D, i: number, delantera: boolean, lado: number, sp: P[], T: P[], Nn: P[], r: number[], t: number, lw: number){
    const H = this.F, n = { x: Nn[i].x*lado, y: Nn[i].y*lado }, T0 = T[i];
    // La brazada (Eze, 2026-11-26: mejorar el movimiento de las patas): al ritmo de la onda del cuerpo (la misma
    // frecuencia), en diagonal como un lagarto (la delantera de un lado con la trasera del otro). Cada brazada es
    // asimétrica: un alcance rápido hacia adelante con la mano abierta (40 %) y un tirón lento hacia atrás con la mano
    // cerrándose (60 %); el antebrazo va con retraso, así la mano arrastra en el tirón y se adelanta en el alcance.
    const fase = ((-2.2*t + (delantera ? 0 : Math.PI) + (lado > 0 ? 0 : Math.PI))/TAU % 1 + 1) % 1;
    const brazada = (p: number) => { p = (p % 1 + 1) % 1; return p < .4 ? -1 + 2*suave(p/.4) : 1 - 2*suave((p - .4)/.6); };
    const sw = brazada(fase), swLag = brazada(fase - .12);
    const abierta = fase < .45 ? Math.sin(fase/.45*Math.PI) : 0;
    const rot = (v: P, a: number) => ({ x: v.x*Math.cos(a) - v.y*Math.sin(a), y: v.x*Math.sin(a) + v.y*Math.cos(a) });
    const hacia = (a: number) => ({ x: n.x*Math.cos(a) + T0.x*Math.sin(a), y: n.y*Math.cos(a) + T0.y*Math.sin(a) }); // a > 0: hacia adelante
    const hombro = { x: sp[i].x + n.x*r[i]*.6, y: sp[i].y + n.y*r[i]*.6 };
    const a1 = (delantera ? .35 : -.45) + sw*(delantera ? .5 : .4);
    const d1 = hacia(a1);
    const codo = { x: hombro.x + d1.x*H*.78, y: hombro.y + d1.y*H*.78 };   // largas: las manos asoman del pelaje
    const dir = hacia(a1 + (delantera ? .7 : -.75) + swLag*.35*(delantera ? 1 : -1) - (sw - swLag)*.6);
    const mano = { x: codo.x + dir.x*H*.72, y: codo.y + dir.y*H*.72 };
    const g = this.R*(delantera ? .8 : .88);
    // un mechón de llama en el codo, hacia atrás
    for(let k = 0; k < 3; k++) this.llama(ctx, codo, n, { x: -T0.x, y: -T0.y }, H*(.45 + k*.12), g*.32, t, k*1.7 + i, lado, k === 1 ? C.naranja : C.rojo, lw*.8, .35);
    // la pata: un solo miembro que se afina, curvo en el codo (no dos tubos), relleno con borde claro
    const miembro: P[] = [], M = 14;
    for(let j = 0; j <= M; j++){
      const q = j/M, a = 1 - q;
      miembro.push({ x: a*a*hombro.x + 2*a*q*codo.x + q*q*mano.x, y: a*a*hombro.y + 2*a*q*codo.y + q*q*mano.y });
    }
    const izq: P[] = [], der: P[] = [];
    for(let j = 0; j <= M; j++){
      const q = j/M, a = miembro[Math.max(0, j - 1)], b = miembro[Math.min(M, j + 1)];
      let tx = b.x - a.x, ty = b.y - a.y; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const w = g*(.85 - .5*q + .18*Math.exp(-Math.pow((q - .5)/.12, 2)));   // gruesa en el hombro, el codo marcado
      izq.push({ x: miembro[j].x - ty*w, y: miembro[j].y + tx*w }); der.push({ x: miembro[j].x + ty*w, y: miembro[j].y - tx*w });
    }
    // La garra (Eze: "más forma de garra"): cuatro dedos cortos y gruesos, y en cada uno una uña grande en gancho, como
    // un talón de águila: una media luna rellena que se afina hasta la punta, clara con sombra oscura. Se abren en
    // abanico en el alcance y se cierran curvándose en el tirón. Primero las de atrás de la mano.
    const sg = lado > 0 ? 1 : -1;
    for(let k = 0; k < 4; k++){
      const pulgar = k === 3;                                 // el cuarto, el pulgar, va hacia atrás y adentro
      const a = pulgar ? -sg*(1.9 - .3*abierta) : (k - 1)*(.22 + .4*abierta)*sg;
      const c = rot(dir, a), largoDedo = H*(pulgar ? .08 : .13 - Math.abs(k - 1)*.02);
      const nudillo = { x: mano.x + c.x*largoDedo, y: mano.y + c.y*largoDedo };
      ctx.beginPath(); ctx.moveTo(mano.x, mano.y); ctx.lineTo(nudillo.x, nudillo.y);
      ctx.strokeStyle = 'rgba(12,6,8,.9)'; ctx.lineWidth = g*.3 + lw*2.4; ctx.stroke(); ctx.strokeStyle = C.cuerpo; ctx.lineWidth = g*.3; ctx.stroke();
      // la uña: a lo largo de una curva que se dobla hacia adentro de la mano (más cerrada en el tirón)
      const lu = H*(pulgar ? .14 : .19)*(.9 + .1*abierta), dobla = (pulgar ? -1 : 1)*sg*(1.1 + .9*(1 - abierta));
      const cu = rot(c, dobla*.5), fin = rot(c, dobla);
      const p1 = { x: nudillo.x + c.x*lu*.55, y: nudillo.y + c.y*lu*.55 };
      const p2 = { x: p1.x + cu.x*lu*.35 + fin.x*lu*.25, y: p1.y + cu.y*lu*.35 + fin.y*lu*.25 };
      const pts: P[] = [], Q = 10;
      for(let j = 0; j <= Q; j++){ const q = j/Q, b = 1 - q; pts.push({ x: b*b*nudillo.x + 2*b*q*p1.x + q*q*p2.x, y: b*b*nudillo.y + 2*b*q*p1.y + q*q*p2.y }); }
      const iz: P[] = [], de: P[] = [];
      for(let j = 0; j <= Q; j++){
        const q = j/Q, aa = pts[Math.max(0, j - 1)], bb = pts[Math.min(Q, j + 1)];
        let tx = bb.x - aa.x, ty = bb.y - aa.y; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
        const w = g*.17*(1 - q)*(1 + .3*Math.sin(q*Math.PI));
        iz.push({ x: pts[j].x - ty*w, y: pts[j].y + tx*w }); de.push({ x: pts[j].x + ty*w, y: pts[j].y - tx*w });
      }
      ctx.beginPath(); ctx.moveTo(iz[0].x, iz[0].y); for(const p of iz) ctx.lineTo(p.x, p.y); for(let j = Q; j >= 0; j--) ctx.lineTo(de[j].x, de[j].y); ctx.closePath();
      ctx.strokeStyle = 'rgba(12,6,8,.9)'; ctx.lineWidth = lw*2; ctx.stroke(); ctx.fillStyle = C.borde; ctx.fill();
      // un filo de sombra por dentro de la curva, para que se lea el volumen del gancho
      ctx.beginPath(); ctx.moveTo((dobla > 0 ? de : iz)[1].x, (dobla > 0 ? de : iz)[1].y); for(let j = 2; j < Q; j++){ const p = (dobla > 0 ? de : iz)[j]; ctx.lineTo(p.x, p.y); }
      ctx.strokeStyle = C.placa; ctx.lineWidth = lw*1.1; ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(izq[0].x, izq[0].y);
    for(let j = 1; j <= M; j++) ctx.lineTo(izq[j].x, izq[j].y);
    ctx.arc(mano.x, mano.y, g*.38, Math.atan2(izq[M].y - mano.y, izq[M].x - mano.x), Math.atan2(der[M].y - mano.y, der[M].x - mano.x), lado > 0);
    for(let j = M; j >= 0; j--) ctx.lineTo(der[j].x, der[j].y);
    ctx.closePath(); ctx.fillStyle = C.cuerpo; ctx.fill(); ctx.strokeStyle = C.borde; ctx.lineWidth = lw; ctx.stroke();
    // escamas de la pata: tres arcos claros
    for(let k = 1; k <= 3; k++){
      const m = miembro[Math.round(k*M/4.5)], d = { x: miembro[Math.round(k*M/4.5) + 1].x - m.x, y: miembro[Math.round(k*M/4.5) + 1].y - m.y };
      const a0 = Math.atan2(d.y, d.x);
      ctx.beginPath(); ctx.arc(m.x, m.y, g*.4, a0 + Math.PI*.6, a0 + Math.PI*1.4); ctx.strokeStyle = C.luz; ctx.globalAlpha = .6; ctx.lineWidth = lw*.9; ctx.stroke(); ctx.globalAlpha = 1;
    }
  }

  private cabeza(ctx: CanvasRenderingContext2D, sp: P[], T: P[], r: number[], t: number, lw: number){
    const H = this.H;
    // mira por la línea del cuello (estable), y un poco hacia la perla
    let tx = sp[0].x - sp[5].x, ty = sp[0].y - sp[5].y; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const ang = Math.atan2(ty, tx) + Math.sin(t*.8)*.06;
    const cx = sp[0].x + tx*H*.18, cy = sp[0].y + ty*H*.18;
    const P_ = (x: number, y: number) => ({ x: cx + (x*Math.cos(ang) - y*Math.sin(ang))*H, y: cy + (x*Math.sin(ang) + y*Math.cos(ang))*H });
    const adelante = { x: Math.cos(ang), y: Math.sin(ang) }, atras = { x: -adelante.x, y: -adelante.y };
    const izqV = { x: -Math.sin(ang), y: Math.cos(ang) };

    // la melena: crines largas que salen de la nuca y los costados hacia atrás, abiertas en abanico sobre el cuello
    for(let j = 5; j >= 0; j--){
      const lado = j % 2 ? 1 : -1, k = Math.floor(j/2), a = (.15 + k*.09)*lado + Math.sin(t*1.7 + j)*.05;
      const fuera = { x: atras.x*Math.cos(a) - atras.y*Math.sin(a), y: atras.x*Math.sin(a) + atras.y*Math.cos(a) };
      const raiz = P_(-.25 - k*.04, lado*(.12 + k*.035));
      this.llama(ctx, raiz, fuera, atras, H*(1.25 - k*.07 + .25*hash(j + 50)), H*.08, t, j*.9, -lado, j % 3 === 0 ? C.naranja : j % 3 === 1 ? C.rojo : C.rojoOsc, lw, .75);
    }
    // las astas: de ciervo, hacia atrás y afuera, con dos puntas
    for(const lado of [1, -1]){
      const s = (x: number, y: number) => P_(x, y*lado);
      const asta = [s(-.2, .17), s(-.55, .38), s(-.95, .46), s(-1.25, .42)];
      const ramas = [[s(-.5, .35), s(-.48, .55), s(-.38, .66)], [s(-.85, .45), s(-.88, .64), s(-.8, .76)]];
      const linea = (pts: P[], ancho: number) => {
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
        for(let k = 1; k < pts.length - 1; k++) ctx.quadraticCurveTo(pts[k].x, pts[k].y, (pts[k].x + pts[k + 1].x)/2, (pts[k].y + pts[k + 1].y)/2);
        ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
        ctx.strokeStyle = C.borde; ctx.lineWidth = ancho + lw*2.4; ctx.stroke();
        ctx.strokeStyle = C.hueso; ctx.lineWidth = ancho; ctx.stroke();
      };
      linea(asta, H*.075); for(const rr of ramas) linea(rr, H*.05);
    }
    // los bigotes: largos, ondulando hacia atrás
    for(const lado of [1, -1]){
      const pts: P[] = [];
      for(let j = 0; j <= 14; j++){
        const q = j/14, ola = Math.sin(q*5 - t*3.2 + (lado > 0 ? 0 : 1.3))*.18*q;
        pts.push(P_(.9 - q*2.4, lado*(.2 + q*.9 + ola)));
      }
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for(const p of pts) ctx.lineTo(p.x, p.y);
      ctx.strokeStyle = C.borde; ctx.lineWidth = H*.035 + lw*1.6; ctx.stroke(); ctx.strokeStyle = C.oro; ctx.lineWidth = H*.035; ctx.stroke();
    }
    // aletas de llama en las mejillas
    for(const lado of [1, -1]) for(let k = 0; k < 3; k++)
      this.llama(ctx, P_(-.05 - k*.12, lado*.3), { x: izqV.x*lado, y: izqV.y*lado }, atras, H*(.55 - k*.08), H*.08, t, k*2 + lado, lado, k === 1 ? C.naranja : C.rojo, lw*.9, .7);

    // el cráneo y el hocico, una sola silueta (de arriba: frente ancha, hocico largo que se ensancha en la punta)
    const sil = [[-.42, 0], [-.4, .24], [-.22, .36], [.05, .4], [.3, .3], [.55, .2], [.85, .22], [1.05, .2], [1.13, .08], [1.14, 0]];
    const pts = [...sil.map(([x, y]) => P_(x, y)), ...sil.slice(1, -1).reverse().map(([x, y]) => P_(x, -y))];
    ctx.beginPath();
    const m0 = { x: (pts[pts.length - 1].x + pts[0].x)/2, y: (pts[pts.length - 1].y + pts[0].y)/2 }; ctx.moveTo(m0.x, m0.y);
    for(let k = 0; k < pts.length; k++){ const a = pts[k], b = pts[(k + 1) % pts.length]; ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x)/2, (a.y + b.y)/2); }
    ctx.closePath(); ctx.fillStyle = C.cuerpo; ctx.fill(); ctx.strokeStyle = C.borde; ctx.lineWidth = lw*1.4; ctx.stroke();
    // la cresta del hocico y las arrugas de la frente
    ctx.strokeStyle = C.luz; ctx.lineWidth = lw*1.2; ctx.globalAlpha = .7;
    ctx.beginPath(); const c0 = P_(.35, 0), c1 = P_(.95, 0); ctx.moveTo(c0.x, c0.y); ctx.lineTo(c1.x, c1.y); ctx.stroke();
    for(let k = 0; k < 3; k++){ const a = P_(-.3 + k*.12, .14), b = P_(-.22 + k*.12, 0), c = P_(-.3 + k*.12, -.14); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(b.x, b.y, c.x, c.y); ctx.stroke(); }
    ctx.globalAlpha = 1;
    // las narinas: dos bultos amarillos en la punta, con su hueco
    for(const lado of [1, -1]){
      const n = P_(1.0, lado*.12);
      ctx.beginPath(); ctx.arc(n.x, n.y, H*.075, 0, TAU); ctx.fillStyle = C.oro; ctx.fill(); ctx.strokeStyle = C.borde; ctx.lineWidth = lw; ctx.stroke();
      const hu = P_(1.02, lado*.13); ctx.beginPath(); ctx.arc(hu.x, hu.y, H*.03, 0, TAU); ctx.fillStyle = C.rojoOsc; ctx.fill();
    }
    // los ojos: grandes, de anillo claro, que asoman por los costados; parpadean cada tanto; cejas amarillas encima
    const parpado = (t % 4.7) < .14 ? .15 : 1;
    for(const lado of [1, -1]){
      const o = P_(.08, lado*.33);
      ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(ang); ctx.scale(1, parpado);
      ctx.beginPath(); ctx.arc(0, 0, H*.13, 0, TAU); ctx.fillStyle = C.borde; ctx.fill(); ctx.strokeStyle = C.trazo; ctx.lineWidth = lw; ctx.stroke();
      ctx.beginPath(); ctx.arc(H*.03, lado*H*.03, H*.075, 0, TAU); ctx.fillStyle = C.ojo; ctx.fill();
      ctx.beginPath(); ctx.arc(H*.05, lado*H*.01, H*.025, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.restore();
      const a = P_(.24, lado*.27), b = P_(.1, lado*.52), c = P_(-.14, lado*.44);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(b.x, b.y, c.x, c.y);
      ctx.strokeStyle = C.borde; ctx.lineWidth = H*.07 + lw*2.2; ctx.stroke(); ctx.strokeStyle = C.oro; ctx.lineWidth = H*.07; ctx.stroke();
    }

    // la perla, delante: un sol pequeño con su halo y llamitas que giran
    const pe = P_(1.75 + Math.sin(t*1.3)*.08, Math.sin(t*.8)*.18);
    const halo = ctx.createRadialGradient(pe.x, pe.y, 0, pe.x, pe.y, H*.7);
    halo.addColorStop(0, 'rgba(255,240,200,.55)'); halo.addColorStop(.4, 'rgba(255,160,70,.22)'); halo.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(pe.x, pe.y, H*.7, 0, TAU); ctx.fill();
    for(let k = 0; k < 8; k++){
      const a = k/8*TAU + t*1.5, d = { x: Math.cos(a), y: Math.sin(a) };
      this.llama(ctx, { x: pe.x + d.x*H*.12, y: pe.y + d.y*H*.12 }, d, d, H*(.28 + .08*Math.sin(t*6 + k)), H*.06, t, k, 1, k % 2 ? C.naranja : C.rojo, lw*.7, 1, true);
    }
    ctx.beginPath(); ctx.arc(pe.x, pe.y, H*.16, 0, TAU); ctx.fillStyle = '#fff6dc'; ctx.fill(); ctx.strokeStyle = C.oro; ctx.lineWidth = lw*1.4; ctx.stroke();
  }
}
