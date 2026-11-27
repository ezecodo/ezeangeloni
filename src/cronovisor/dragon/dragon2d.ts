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

import { type P, TAU, suave, lim, hash, C, llama, ojoReptil, Hondura, escalaHondura, luzHondura } from './estilo';

export class DragonPlano {
  private L: number; private H: number; private R: number; private F: number;
  private x0: number; private x1: number;
  private arco: Float64Array; private xs: Float64Array;
  private S_INI = 0; private S_FIN = 0;
  private readonly N = 120;

  // w, h: la mesa en píxeles; el dragón se dibuja con el origen en su esquina de arriba a la izquierda
  // `largo`: el largo del cuerpo en píxeles; por defecto el 80 % del ancho. En una franja angosta (la pantalla LED de la
  // barra, ~10:1) el 80 % del ancho no entraría a lo alto: ahí se lo da a la medida de la franja
  // `hondo` (la variante 7, Eze 2026-11-26: "que venga del fondo"): el mismo dibujo con profundidad. Cada punto de la
  // columna tiene su hondura bajo el vidrio (z: 0 en el vidrio, más hondo cuanto más grande); se proyecta en perspectiva
  // hacia el centro de la mesa (k = 1/(1 + z·.55): lo hondo, más chico) y se apaga con la hondura (`vis`: a ~z 3,2 ya no
  // se ve, el abismo es negro). El recorrido: sube del fondo en espiral, cruza la mesa rozando el vidrio y se hunde.
  private hondo = false;
  private arcoQ = new Float64Array(0);
  private kk: number[] = []; private vv: number[] = [];
  constructor(readonly w: number, readonly h: number, largo?: number, hondo: boolean | 'pez' = false){
    this.hondo = !!hondo;
    this.L = largo ?? w*.8;   // el largo del cuerpo: ~80 % de la mesa
    this.F = this.L*.105;     // la escala de las llamas y las patas
    this.H = this.L*.175;     // la cabeza: grande, es lo que se mira (Eze: más grande, por la proporción del cuerpo con las alas)
    this.R = this.L*.04;      // medio ancho del cuerpo en el pecho
    const L = this.L;
    this.x0 = -w/2 - L - 700*L/1444; this.x1 = w/2 + L + 700*L/1444;
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
    this.S_INI = sDeX(-w/2 - this.H*2.7);
    this.S_FIN = sDeX(w/2 + this.F*2.4) + L;
    if(hondo === 'pez') this.armarPez(); else if(hondo) this.armarHondo();
  }

  // El recorrido en profundidad, rehecho (Eze: giros bruscos; medido: la cabeza llegaba a girar >1000°/s donde el
  // camino subía casi en vertical hacia el vidrio: visto desde arriba apenas avanzaba y su dirección en pantalla saltaba).
  // Dos reglas: lo que se ve desde arriba (x, y) es siempre una curva amplia y regular, una espiral de radio grande que
  // sale tangente a una travesía suave, nunca más cerrada de lo que el cuerpo puede seguir; y la hondura va aparte, una
  // curva suave a lo largo del camino (sube durante la espiral, roza el vidrio en la travesía, se hunde al final),
  // mientras sigue avanzando lo bastante para que la perspectiva no lo haga parecer retroceder.
  private hx = new Float64Array(0); private hy = new Float64Array(0); private hz = new Float64Array(0);
  // La variante 8, "el pez" (Eze: como un pez que sube a la superficie): sube del fondo en una punta de la pantalla,
  // sale a flor de vidrio, recorre la pantalla a lo largo y en la otra punta se vuelve a hundir. El recorrido se diseña
  // como se VE en pantalla (una curva suave: sube por la izquierda, cruza arriba del centro, baja por la derecha) y la
  // hondura aparte; la posición en el espacio sale de deshacer la perspectiva (mundo = pantalla · (1 + .55 z)). Así, en
  // pantalla sigue siempre esa curva, sin poder retroceder ni dar media vuelta; sólo cambia de tamaño y de luz.
  private armarPez(){
    const W2 = this.w/2, H2 = this.h/2, L = this.L;
    // nace en la punta izquierda, a media altura y ya mirando a lo largo (Eze: empezaba hacia el medio, subiendo en
    // diagonal desde la esquina); el final, como estaba
    // Entra desde fuera, por el borde izquierdo (Eze: no que aparezca dentro de la pantalla, "del medio", sino del
    // extremo opuesto al que se retira). Del cuarto punto en adelante es el recorrido original, sin tocar: Eze quería el
    // final tal cual (cómo se hunde a la derecha); sólo cambia la entrada.
    // y al final (Eze: no parecía irse para abajo) la curva frena y converge a un punto: el cuerpo entero pasa por ahí
    // y se hunde por ese mismo sitio, como un pez que se zambulle
    const ctl = [[-1.4, .06], [-1.15, .02], [-.85, -.06], [-.42, -.12], [-.05, -.15], [.3, -.08], [.52, .05], [.64, .14], [.69, .18]]
      .map(([x, y]) => [x*W2, y*H2]);
    const cat = (q: number) => {
      const n = ctl.length - 1, i = Math.max(0, Math.min(n - 1, Math.floor(q))), f = q - i;
      const p0 = ctl[Math.max(0, i - 1)], p1 = ctl[i], p2 = ctl[i + 1], p3 = ctl[Math.min(n, i + 2)];
      return [0, 1].map(k => .5*((2*p1[k]) + (-p0[k] + p2[k])*f + (2*p0[k] - 5*p1[k] + 4*p2[k] - p3[k])*f*f + (-p0[k] + 3*p1[k] - 3*p2[k] + p3[k])*f*f*f));
    };
    const xs: number[] = [], ys: number[] = [];
    for(let q = 0; q <= ctl.length - 1 + 1e-9; q += .002){ const p = cat(q); xs.push(p[0]); ys.push(p[1]); }
    // la hondura a lo largo de la curva (en pantalla): sube mientras entra (hasta el punto 2,7 de la curva), roza el
    // vidrio, y se hunde desde el punto 4,69 de la curva (el mismo donde se hundía en la versión que Eze quería, a la
    // altura del centro-derecha), con la misma suavidad, hasta el final
    const n = xs.length, sp = new Float64Array(n);
    for(let j = 1; j < n; j++) sp[j] = sp[j - 1] + Math.hypot(xs[j] - xs[j - 1], ys[j] - ys[j - 1]);
    const tot = sp[n - 1], sm = (q: number) => { q = lim(q, 0, 1); return q*q*q*(q*(q*6 - 15) + 10); };
    const enQ = (q: number) => sp[Math.min(n - 1, Math.round(q/.002))];
    const spR = enQ(2.7), spD = enQ(4.69);
    const Z0 = 6.5, ZV = .12, ZE = 2.4;
    this.hx = new Float64Array(n); this.hy = new Float64Array(n); this.hz = new Float64Array(n);
    for(let j = 0; j < n; j++){
      const z = sp[j] < spR ? ZE + (ZV - ZE)*sm(sp[j]/spR) : sp[j] < spD ? ZV : ZV + (Z0 - ZV)*sm((sp[j] - spD)/(tot - spD));
      const m = 1 + .55*z;                                     // deshacer la perspectiva
      this.hx[j] = xs[j]*m; this.hy[j] = ys[j]*m; this.hz[j] = z;
    }
    // el largo de arco, en el espacio (con la hondura): así el cuerpo, hondo, se ve acortado como corresponde
    const arco = new Float64Array(n);
    for(let j = 1; j < n; j++) arco[j] = arco[j - 1] + Math.hypot(this.hx[j] - this.hx[j - 1], this.hy[j] - this.hy[j - 1], (this.hz[j] - this.hz[j - 1])*W2*.6);
    this.arcoQ = arco;
    const total = arco[n - 1], zDe = (q: number) => this.punto(q)[2], ZI = 3.3;
    // empieza cuando la perla, delante de la cabeza, está por asomar por el borde izquierdo (o por salir del fondo)
    // (la cabeza, honda, es más chica: la perla va a ~1,9 cabezas por delante, a la escala de su hondura)
    const asoma = (q: number) => { const p = this.punto(q), k = DragonPlano.k(p[2]); return p[0]*k + this.H*2.75*k > -W2; };   // con el halo
    let ini = 0; for(let q = 0; q < total; q += 2) if(zDe(q) < ZI && asoma(q)){ ini = q - 2; break; }
    let fin = total; for(let q = total; q > 0; q -= 2) if(zDe(q) < ZI){ fin = q + 2; break; }
    this.S_INI = ini; this.S_FIN = Math.min(total + L*1.5, fin + L*1.02);
  }
  private armarHondo(){
    const W2 = this.w/2, H2 = this.h/2, L = this.L;
    const cx = -.5*W2, cy = .4*H2, R0 = .62*H2;   // la espiral, a la izquierda: así la travesía cruza dentro de la mesa
    const vueltas = 1.15, te = -Math.PI/2, ts = te - TAU*vueltas, paso = .004;
    const xs: number[] = [], ys: number[] = [];
    const radio = (th: number) => R0*(.85 + .15*(th - ts)/(te - ts));
    for(let th = ts; th < te; th += paso){ xs.push(cx + radio(th)*Math.cos(th)); ys.push(cy + radio(th)*Math.sin(th)); }
    const nEsp = xs.length;
    // la travesía: sale tangente de lo alto de la espiral hacia la derecha y baja apenas (pendiente cero en la unión)
    const yTop = cy - R0, largoT = 7*W2;
    for(let d = 3; d <= largoT; d += 3){ xs.push(cx + d); ys.push(yTop + .3*H2*(1 - Math.cos(Math.PI*Math.min(1, d/(1.8*W2))))/2); }
    // largo de arco en el plano; la hondura, por tramos suaves a lo largo de él
    const n = xs.length, arco = new Float64Array(n);
    for(let j = 1; j < n; j++) arco[j] = arco[j - 1] + Math.hypot(xs[j] - xs[j - 1], ys[j] - ys[j - 1]);
    const finEspiral = arco[nEsp - 1], total = arco[n - 1];
    const s1 = finEspiral + .15*W2, s2 = finEspiral + .5*W2;          // de s1 a s2 roza el vidrio; se hunde a la derecha del centro, sin salir de la mesa
    const sm = (q: number) => { q = lim(q, 0, 1); return q*q*q*(q*(q*6 - 15) + 10); };
    const Z0 = 6.5, ZV = .12;
    this.hx = new Float64Array(xs); this.hy = new Float64Array(ys); this.hz = new Float64Array(n);
    // la hondura: sube con la espiral, roza el vidrio, y al hundirse nunca más rápido de lo que deja seguir avanzando en
    // pantalla (una pieza que se aleja de lado y a la vez se hunde se achica hacia el centro: si se hunde demasiado
    // rápido, en pantalla frena y retrocede, y la cabeza daba media vuelta en un cuadro; medido: 3700°/s)
    for(let j = 0; j < n; j++){
      const sj = arco[j];
      if(sj < s1){ this.hz[j] = Z0 + (ZV - Z0)*sm(sj/s1); continue; }
      if(sj < s2 || j === 0){ this.hz[j] = ZV; continue; }
      const z = this.hz[j - 1], ds2 = sj - arco[j - 1], k = DragonPlano.k(z), x = Math.max(1, Math.abs(xs[j]));
      const tope = .6/(.55*k*x/ds2)*ds2/ds2;                      // dz/ds máximo para que x·k siga creciendo (margen 40 %)
      const deseo = (1.4/W2)*sm((sj - s2)/(.5*W2));                // arranca suave
      this.hz[j] = z + Math.min(deseo, tope)*ds2;
    }
    this.arcoQ = arco;
    // la pasada: empieza con la cabeza todavía invisible en el fondo y termina cuando la cola entera se perdió abajo
    const zDe = (q: number) => this.punto(q)[2], ZI = 3.3;
    let ini = 0; for(let q = 0; q < total; q += 2) if(zDe(q) < ZI){ ini = q - 2; break; }
    let fin = total; for(let q = total; q > 0; q -= 2) if(zDe(q) < ZI){ fin = q + 2; break; }
    this.S_INI = ini; this.S_FIN = Math.min(total + L, fin + L*1.02);
  }
  // un punto del recorrido a una distancia `s` (x, y centradas en la mesa, z hondura); en el plano, z = 0
  private punto(s: number): number[] {
    if(!this.hondo){ const p = this.enArco(s); return [p.x, p.y, 0]; }
    const a = this.arcoQ, n = a.length - 1, X = this.hx, Y = this.hy, Z = this.hz;
    // antes del comienzo y después del final: más hondo, sobre la misma vertical de la pantalla (invisible, en el negro)
    if(s <= 0){
      // antes del comienzo: sigue la curva hacia atrás en pantalla (no apilado en un punto, que hacía girar la cabeza)
      const m0 = 1 + .55*Z[0], m1 = 1 + .55*Z[1], ax = X[0]/m0, ay = Y[0]/m0, bx = X[1]/m1, by = Y[1]/m1;
      const l = Math.hypot(bx - ax, by - ay) || 1, z = Z[0] + (-s)/(this.w*.6), m = 1 + .55*z, d = s/m0;
      return [(ax + (bx - ax)/l*d)*m, (ay + (by - ay)/l*d)*m, z];
    }
    if(s >= a[n]){ const z = Z[n] + (s - a[n])/(this.w*.3), m = (1 + .55*z)/(1 + .55*Z[n]); return [X[n]*m, Y[n]*m, z]; }
    let lo = 0, hi = n;
    while(hi - lo > 1){ const m = (lo + hi) >> 1; if(a[m] < s) lo = m; else hi = m; }
    const f = (s - a[lo])/((a[hi] - a[lo]) || 1);
    return [X[lo] + (X[hi] - X[lo])*f, Y[lo] + (Y[hi] - Y[lo])*f, Z[lo] + (Z[hi] - Z[lo])*f];
  }
  private static k(z: number){ return escalaHondura(z); }
  private static vis(z: number){ return luzHondura(z); }

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

  // la oscuridad de la hondura (estilo.ts)
  private hondura = new Hondura();
  private get osc(){ return this.hondura.osc; }
  private set osc(v: number){ this.hondura.osc = v; }
  private envolver(ctx: CanvasRenderingContext2D){ return this.hondura.envolver(ctx); }

  // el abismo: brasas que suben lentamente desde el fondo hacia el vidrio, en perspectiva (las hondas, chicas y
  // apagadas; se encienden y se apagan en el camino). Su movimiento sale de `u` con ciclos enteros por pasada, así el
  // bucle no salta aunque siempre haya brasas en la mesa.
  private brasas(ctx: CanvasRenderingContext2D, u: number){
    const lw = Math.max(2, this.w/650), W2 = this.w*.8, H2 = this.h*.8;
    for(let j = 0; j < 150; j++){
      const vida = ((hash(j*3.1) - u*2) % 1 + 1) % 1;              // 0: nace abajo, 1: llega arriba (dos subidas por pasada)
      const z = 5.4 - vida*5.1, k = DragonPlano.k(z), v = DragonPlano.vis(z)*Math.sin(vida*Math.PI);
      if(v < .02) continue;
      const deriva = Math.sin(u*TAU*3 + j)*.04;
      const x = ((hash(j + .5) - .5)*2*W2 + deriva*W2)*k + this.w/2, y = ((hash(j + 1.7) - .5)*2*H2)*k + this.h/2;
      const tam = (1 + 2.2*hash(j + 9.3))*lw*.7*k;
      ctx.globalAlpha = v*.55;
      ctx.fillStyle = hash(j + 4.4) < .5 ? C.claro : C.naranja;
      ctx.beginPath(); ctx.arc(x, y, tam, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
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
    this.kk = []; this.vv = [];
    for(let i = 0; i <= N; i++){
      const s = sCab - i*ds, a = this.punto(s), b = this.punto(s + 1);
      let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      const f = i/N, env = suave(lim((f - .02)/.5, 0, 1))*(1 - .25*f);
      const o = Math.sin(k*i*ds - w*t)*R*1.5*env;
      // la perspectiva: hacia el centro de la mesa, más chico cuanto más hondo
      const kz = DragonPlano.k(a[2]);
      this.kk.push(kz); this.vv.push(this.hondo ? DragonPlano.vis(a[2]) : 1);
      sp.push({ x: (a[0] - ty*o)*kz + this.w/2, y: (a[1] + tx*o)*kz + this.h/2 });
      r.push(R*this.perfil(f)*(1 + .04*Math.sin(t*1.6)*Math.exp(-Math.pow((f - .2)/.1, 2)))*kz);
    }
    // la hondura: no transparencia (las llamas superpuestas, transparentes, se veían unas a través de otras y el dragón
    // se desarmaba al hundirse, Eze: "se va deformando feo") sino oscuridad, como en el agua: cada pieza se dibuja
    // sólida, con sus colores llevados hacia el negro del fondo según su hondura (`osc`, a través de `envolver`)
    const kk = this.kk, vv = this.vv, niebla = (i: number) => { this.osc = vv[Math.max(0, Math.min(N, i))]; };
    if(this.hondo){ this.brasas(ctx, u); ctx = this.envolver(ctx); }
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
    for(const [f, delantera] of [[.17, true], [.47, false]] as [number, boolean][]) for(const lado of [1, -1]){
      const i = Math.round(f*N); niebla(i);
      this.pata(ctx, i, delantera, lado, sp, T, Nn, r, t, lw*kk[i]);
    }
    // ── las alas, debajo del pelaje (Eze: que salgan por debajo de las escamas, así no se ven los cortes en el
    // hombro: el pelaje de los costados y del lomo tapa sus raíces): de membrana, como las de un murciélago o un wyvern (Eze, 2026-11-26, con la foto de unas alas de
    // fieltro: "menos elementos"). Por lado, pocas piezas: el brazo (del hombro a la muñeca, el borde de adelante),
    // cuatro dedos largos que salen de la muñeca en abanico hacia atrás, y una sola membrana tensada entre ellos, con el
    // borde de atrás en festones (cada tramo entre dos puntas se curva hacia la muñeca) que vuelve al cuerpo detrás del
    // hombro. Membrana dorada y naranja, huesos rojo oscuro, un filo claro en el borde de adelante. Aletean despacio:
    // se abren y se pliegan un poco (el ancho) y barren apenas hacia adelante y atrás.
    { const iA = Math.round(N*.2), iB = Math.min(N, iA + 17);
      for(const lado of [1, -1]){
        niebla(iA);
        const n = { x: Nn[iA].x*lado, y: Nn[iA].y*lado }, at = atrasDe(iA, 12), fw = { x: -at.x, y: -at.y };
        const nB = { x: Nn[iB].x*lado, y: Nn[iB].y*lado };
        const abre = .86 + .14*Math.sin(t*1.25), barre = .12*Math.sin(t*1.25 - .6);
        const span = H*2.9*kk[iA];
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
            this.llama(ctx, base, d, d, l*.5, Math.max(H*.13*kk[iA], l*.12), t, 700 + j*1.7 + fila*.61 + (lado > 0 ? 0 : 13), lado, color, lw*kk[iA], 1, true);
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
        const largo = H*(1 + .3*h1)*(f < .5 ? 1 - .2*f : .9 - .9*(f - .5))*kk[i];
        if(largo < H*.2*kk[i]) continue;
        niebla(i);
        const base = { x: sp[i].x + Nn[i].x*lado*r[i]*.7, y: sp[i].y + Nn[i].y*lado*r[i]*.7 };
        const fuera = { x: Nn[i].x*lado, y: Nn[i].y*lado };
        const color = h2 < .55 ? C.rojo : C.rojoOsc;
        this.llama(ctx, base, fuera, atrasDe(i, 10), largo, Math.max(r[i], R*.45*kk[i])*.68, t, i*.45 + lado*1.3, lado, color, lw*kk[i], .3 + .2*h2);
      }
    }
    // la cola: un penacho de llamas hacia atrás
    for(let j = 0; j < 9; j++){
      const a = (j - 4)*.2 + Math.sin(t*2 + j)*.06, c = Math.cos(a), s = Math.sin(a);
      const atras = { x: -T[N].x*c + T[N].y*s, y: -T[N].y*c - T[N].x*s };
      niebla(N);
      this.llama(ctx, sp[N - 1], { x: atras.x, y: atras.y }, atras, H*(1.1 + .5*hash(j + 300) - Math.abs(j - 4)*.12)*kk[N], R*.3*kk[N], t, j*1.1, j < 4 ? 1 : -1, j % 3 ? C.rojo : C.naranja, lw*kk[N], .1);
    }


    // ── el cuerpo: contorno claro, relleno azul, franjas de medialuna
    niebla(Math.round(N*.3));
    const alfaCuerpo = ctx.globalAlpha;
    ctx.beginPath();
    for(let i = 0; i <= N; i++) { const p = sp[i]; i ? ctx.lineTo(p.x + Nn[i].x*r[i], p.y + Nn[i].y*r[i]) : ctx.moveTo(p.x + Nn[i].x*r[i], p.y + Nn[i].y*r[i]); }
    for(let i = N; i >= 0; i--){ const p = sp[i]; ctx.lineTo(p.x - Nn[i].x*r[i], p.y - Nn[i].y*r[i]); }
    ctx.closePath();
    ctx.fillStyle = C.pata; ctx.fill();   // el cuerpo, debajo del pelaje: rojo profundo como patas y cabeza (asomaba azul en los bordes)
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
      ctx.strokeStyle = C.borde; ctx.lineWidth = lw*.9*kk[i]; ctx.stroke();
    }
    // una línea de luz por el lomo
    ctx.beginPath(); for(let i = 4; i < N - 6; i++) i === 4 ? ctx.moveTo(sp[i].x, sp[i].y) : ctx.lineTo(sp[i].x, sp[i].y);
    ctx.strokeStyle = C.luz; ctx.globalAlpha = .35*alfaCuerpo; ctx.lineWidth = R*.22*kk[Math.round(N*.3)]; ctx.stroke(); ctx.globalAlpha = alfaCuerpo;
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
        niebla(i);
        this.llama(ctx, base, { x: Nn[i].x*lado, y: Nn[i].y*lado }, atrasDe(i, 18), r[i]*4.6, r[i]*.82, t, i*.37 + k, lado, color, lw*.85*kk[i], .12*Math.abs(off)*2, true);
      }
    }
    // ── la cabeza, la melena y la perla
    niebla(0);
    this.cabeza(ctx, sp, T, r, t, lw*kk[0]);
    this.osc = 1; ctx.globalAlpha = 1;
  }

  // la llama: la forma base del estilo (estilo.ts)
  private llama(ctx: CanvasRenderingContext2D, base: P, fuera: P, atras: P, largo: number, ancho: number, t: number, fase: number, lado: number, color: string, lw: number, abre = .55, regular = false){
    llama(ctx, base, fuera, atras, largo, ancho, t, fase, lado, color, lw, abre, regular);
  }

  private pata(ctx: CanvasRenderingContext2D, i: number, delantera: boolean, lado: number, sp: P[], T: P[], Nn: P[], r: number[], t: number, lw: number){
    const H = this.F*(this.kk[i] ?? 1), n = { x: Nn[i].x*lado, y: Nn[i].y*lado }, T0 = T[i];
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
    const g = this.R*(delantera ? .8 : .88)*(this.kk[i] ?? 1);
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
      ctx.strokeStyle = 'rgba(12,6,8,.9)'; ctx.lineWidth = g*.3 + lw*2.4; ctx.stroke(); ctx.strokeStyle = C.pata; ctx.lineWidth = g*.3; ctx.stroke();
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
    ctx.closePath(); ctx.fillStyle = C.pata; ctx.fill(); ctx.strokeStyle = 'rgba(12,6,8,.9)'; ctx.lineWidth = lw*1.6; ctx.stroke();
    // escamas de la pata: tres arcos claros
    for(let k = 1; k <= 3; k++){
      const m = miembro[Math.round(k*M/4.5)], d = { x: miembro[Math.round(k*M/4.5) + 1].x - m.x, y: miembro[Math.round(k*M/4.5) + 1].y - m.y };
      const a0 = Math.atan2(d.y, d.x);
      ctx.beginPath(); ctx.arc(m.x, m.y, g*.4, a0 + Math.PI*.6, a0 + Math.PI*1.4); const alfa0 = ctx.globalAlpha; ctx.strokeStyle = C.naranja; ctx.globalAlpha = .75*alfa0; ctx.lineWidth = lw*.9; ctx.stroke(); ctx.globalAlpha = alfa0;
    }
  }

  private cabeza(ctx: CanvasRenderingContext2D, sp: P[], T: P[], r: number[], t: number, lw: number){
    const H = this.H*(this.kk[0] ?? 1);
    // mira por la línea del cuello (estable), y un poco hacia la perla
    let tx = sp[0].x - sp[8].x, ty = sp[0].y - sp[8].y; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;   // una cuerda larga: más estable
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
    // La cabeza, rehecha con los elementos del cuerpo (Eze: no tenía relación con el cuerpo; las cejas doradas sobre
    // rojo parecían la bandera; "como un biólogo de la época de los dragones"). Como en un reptil: cráneo en cuña,
    // cubierto de escudos que siguen el pelaje del lomo (filas tendidas hacia atrás, superpuestas), una hilera mayor
    // sobre la cresta del hocico, crestas supraorbitales de púas sobre los ojos, cuernos de queratina barridos hacia
    // atrás, narinas en relieve y barbillas largas; todo en los rojos y naranjas del cuerpo, con su contorno oscuro.
    const rot = (v: P, a: number) => ({ x: v.x*Math.cos(a) - v.y*Math.sin(a), y: v.x*Math.sin(a) + v.y*Math.cos(a) });
    // los cuernos: de la nuca, barridos hacia atrás y afuera, afinándose; oscuros en la base, más claros en la punta
    for(const lado of [1, -1]){
      const curva: P[] = [];
      for(let j = 0; j <= 12; j++){ const q = j/12; curva.push(P_(-.22 - q*.85, lado*(.2 + q*.3 + Math.sin(q*Math.PI)*.06))); }
      const iz: P[] = [], de: P[] = [];
      for(let j = 0; j <= 12; j++){
        const q = j/12, a2 = curva[Math.max(0, j - 1)], b2 = curva[Math.min(12, j + 1)];
        let tx2 = b2.x - a2.x, ty2 = b2.y - a2.y; const l2 = Math.hypot(tx2, ty2) || 1; tx2 /= l2; ty2 /= l2;
        const w = H*.075*(1 - q*.92);
        iz.push({ x: curva[j].x - ty2*w, y: curva[j].y + tx2*w }); de.push({ x: curva[j].x + ty2*w, y: curva[j].y - tx2*w });
      }
      ctx.beginPath(); ctx.moveTo(iz[0].x, iz[0].y); for(const q of iz) ctx.lineTo(q.x, q.y); for(let j = 12; j >= 0; j--) ctx.lineTo(de[j].x, de[j].y); ctx.closePath();
      ctx.strokeStyle = 'rgba(12,6,8,.9)'; ctx.lineWidth = lw*2.6; ctx.stroke();
      const g2 = ctx.createLinearGradient(curva[0].x, curva[0].y, curva[12].x, curva[12].y);
      g2.addColorStop(0, '#4a1610'); g2.addColorStop(.6, C.rojoOsc); g2.addColorStop(1, C.claro);
      ctx.fillStyle = g2; ctx.fill();
      // los anillos de crecimiento del cuerno
      for(const q of [.2, .38, .55]){ const j = Math.round(q*12); ctx.beginPath(); ctx.moveTo(iz[j].x, iz[j].y); ctx.lineTo(de[j].x, de[j].y); ctx.strokeStyle = 'rgba(12,6,8,.55)'; ctx.lineWidth = lw*.9; ctx.stroke(); }
    }
    // las barbillas: largas, finas, ondulando hacia atrás, en naranja del cuerpo con su contorno oscuro
    for(const lado of [1, -1]){
      const pts: P[] = [];
      for(let j = 0; j <= 14; j++){
        const q = j/14, ola = Math.sin(q*5 - t*2.6 + (lado > 0 ? 0 : 1.3))*.16*q;
        pts.push(P_(.95 - q*2.2, lado*(.19 + q*.8 + ola)));
      }
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for(const q of pts) ctx.lineTo(q.x, q.y);
      ctx.strokeStyle = 'rgba(12,6,8,.85)'; ctx.lineWidth = H*.03 + lw*1.8; ctx.stroke(); ctx.strokeStyle = C.naranja; ctx.lineWidth = H*.03; ctx.stroke();
    }
    // aletas de llama en las mejillas (como las del cuerpo)
    for(const lado of [1, -1]) for(let k = 0; k < 3; k++)
      this.llama(ctx, P_(-.05 - k*.12, lado*.3), { x: izqV.x*lado, y: izqV.y*lado }, atras, H*(.55 - k*.08), H*.08, t, k*2 + lado, lado, k === 1 ? C.naranja : C.rojo, lw*.9, .7);

    // la cresta supraorbital: tres púas de escama sobre cada ojo, abiertas hacia afuera y atrás; se dibujan antes que
    // el cráneo, así sus raíces quedan debajo y asoman por el borde, como saliendo de entre las escamas
    for(const lado of [1, -1]) for(let k = 0; k < 3; k++){
      const d = rot(atras, -lado*(.55 - k*.12));
      this.llama(ctx, P_(.06 - k*.12, lado*(.3 + k*.02)), d, atras, H*(.32 + k*.07), H*.065, t, 800 + k + (lado > 0 ? 0 : 5), lado, k === 1 ? C.naranja : C.rojoOsc, lw*.85, .6, true);
    }
    // el cráneo en cuña: frente ancha entre los ojos, hocico largo que se afina y se abre un poco en las narinas
    const sil = [[-.45, 0], [-.43, .26], [-.28, .38], [-.05, .42], [.2, .36], [.45, .25], [.75, .2], [1.0, .19], [1.13, .1], [1.16, 0]];
    const pts = [...sil.map(([x, y]) => P_(x, y)), ...sil.slice(1, -1).reverse().map(([x, y]) => P_(x, -y))];
    const silueta = () => {
      ctx.beginPath();
      const m0 = { x: (pts[pts.length - 1].x + pts[0].x)/2, y: (pts[pts.length - 1].y + pts[0].y)/2 }; ctx.moveTo(m0.x, m0.y);
      for(let k = 0; k < pts.length; k++){ const a2 = pts[k], b2 = pts[(k + 1) % pts.length]; ctx.quadraticCurveTo(a2.x, a2.y, (a2.x + b2.x)/2, (a2.y + b2.y)/2); }
      ctx.closePath();
    };
    ctx.fillStyle = C.pata; silueta(); ctx.fill();
    // los escudos de la cabeza, recortados por la silueta: filas de la nuca al hocico (las de adelante encima), cada
    // escudo una llamita tendida hacia atrás como las del lomo; el ancho de cada fila sigue el de la cabeza
    const anchoEn = (x: number) => { for(let k = 1; k < sil.length; k++) if(sil[k][0] >= x){ const [x0, y0] = sil[k - 1], [x1, y1] = sil[k]; return y0 + (y1 - y0)*(x - x0)/((x1 - x0) || 1); } return 0; };
    ctx.save(); silueta(); ctx.clip();
    let fila = 0;
    for(let x = -.42; x <= 1.08; x += .12, fila++){
      const w = anchoEn(x), n = Math.max(1, Math.round(w*2/.13));
      for(let k = 0; k < n; k++){
        const y = n === 1 ? 0 : (k/(n - 1) - .5)*w*1.7 + (fila % 2 ? .03 : -.03);
        const color = (fila + k) % 3 === 0 ? C.rojo : (fila + k) % 3 === 1 ? C.rojoOsc : C.pata;
        this.llama(ctx, P_(x, y), atras, atras, H*.24, H*.065, t, 600 + fila*1.31 + k*.71, y >= 0 ? 1 : -1, color, lw*.7, 0, true);
      }
    }
    // la cresta del hocico: una hilera de escudos mayores sobre la línea media, en naranja
    for(let x = -.25; x <= .95; x += .24) this.llama(ctx, P_(x, 0), atras, atras, H*.3, H*.075, t, 700 + x*7, 1, C.rojo, lw*.8, 0, true);
    ctx.restore();
    // y un filo claro sólo a lo largo del hocico (como el de las llamas)
    // el borde: fino, en un rojo muy oscuro (Eze: el contorno negro grueso no quedaba bien; las escamas ya marcan la forma)
    silueta(); ctx.strokeStyle = '#5a140c'; ctx.lineWidth = lw*.9; ctx.stroke();
    for(const lado of [1, -1]){
      ctx.beginPath(); const tramo = sil.filter(([x]) => x >= .3).map(([x, y]) => P_(x, y*lado));
      ctx.moveTo(tramo[0].x, tramo[0].y); for(const q of tramo) ctx.lineTo(q.x, q.y);
      ctx.strokeStyle = C.borde; ctx.lineWidth = lw*.9; ctx.stroke();
    }
    // las narinas: dos bultos en relieve en la punta, con la raja oscura mirando hacia adelante y afuera
    for(const lado of [1, -1]){
      const n = P_(1.0, lado*.11);
      ctx.beginPath(); ctx.ellipse(n.x, n.y, H*.07, H*.05, ang + lado*.4, 0, TAU); ctx.fillStyle = C.rojo; ctx.fill(); ctx.strokeStyle = 'rgba(12,6,8,.9)'; ctx.lineWidth = lw*1.2; ctx.stroke();
      const hu = P_(1.03, lado*.13); ctx.beginPath(); ctx.ellipse(hu.x, hu.y, H*.035, H*.012, ang + lado*.55, 0, TAU); ctx.fillStyle = '#140504'; ctx.fill();
    }
    // los ojos: el ojo de reptil del estilo (estilo.ts), parpadeando cada tanto
    const parpado = (t % 4.7) < .14 ? .12 : 1;
    for(const lado of [1, -1]) ojoReptil(ctx, P_(.1, lado*.27), ang, lado, H, lw, parpado);

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
