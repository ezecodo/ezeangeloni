/*
 * Las reglas gráficas del dragón plano (Eze, 2026-11-27: la base para diseñar los elementos que vendrán, en el mismo
 * lenguaje, y que se puedan animar con el mismo motor). Todo lo que define cómo se ve el dragón de las variantes 6, 7 y
 * 8 vive acá, y el dragón lo usa: la paleta, el contorno, la llama en S con su carácter estable, el ojo de reptil y la
 * oscuridad de la hondura. La guía visual, dibujada con este mismo código: /mesa/estilo/.
 *
 * Las reglas, en palabras:
 * - Paleta cálida de fuego: rojos (vivo, oscuro, profundo), naranja y claro (dorado pálido), oro para ojos y acentos;
 *   crema sólo como filo de luz. Sin azules ni verdes (el dragón dejó el celeste: "no acordaba").
 * - Contorno: una sombra casi negra alrededor de cada pieza (la separa de lo de abajo), nunca un contorno claro entero;
 *   el crema es un filo de luz de UN lado, que se corta antes de la punta, y no en todas las piezas.
 * - Forma base: la llama, una lengua en S de grosor parejo casi hasta la punta redondeada, con un rizo chico; cada una
 *   con su carácter (ondas, amplitud, grosor) sacado de su semilla, estable cuadro a cuadro; algunas, cintas largas.
 *   Las "regulares" (escamas, plumas, crestas) se mecen poco y no se rizan.
 * - Superficies: filas de llamas regulares tendidas hacia atrás, superpuestas como tejas (las de adelante tapan las
 *   raíces de las de atrás). Así el lomo, la cabeza y las alas.
 * - Movimiento: lento, la onda corre de la raíz a la punta; nada cambia de forma de un cuadro al siguiente (la semilla
 *   nunca depende de tamaños que respiran).
 * - Profundidad: no transparencia sino oscuridad, hacia un negro apenas azulado y negro puro en lo más hondo; las
 *   piezas siguen sólidas. Más hondo, más chico (perspectiva hacia el centro: k = 1/(1 + z·.55)).
 * - Ojos: almendra de reptil encajada, casi toda iris ámbar, pupila rasgada, brillo, cuenca oscura.
 */

export type P = { x: number; y: number };
export const TAU = Math.PI*2;
export const suave = (q: number) => q*q*(3 - 2*q);
export const lim = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const hash = (n: number) => { const s = Math.sin(n*12.9898)*43758.5453; return s - Math.floor(s); };

// la paleta (los nombres, en el idioma del proyecto). `cuerpo`, `luz`, `trazo` y `ojo` son azules del dragón de antes:
// quedan por compatibilidad, no se usan en lo nuevo
export const C = {
  cuerpo: '#3a9fd8', luz: '#a6e4ff', vientre: '#ffd35a', placa: '#d98a2a', trazo: '#1d5a8c',
  rojo: '#e8432e', rojoOsc: '#b8241a', pata: '#9c2216',
  naranja: '#f6744a', claro: '#ffc06a',
  oro: '#ffd03a', hueso: '#f2d28a', borde: '#fff3dc', ojo: '#1f3f6e',
};
// la paleta de lo nuevo, en orden de claro a oscuro, con su papel
export const PALETA = [
  { nombre: 'borde', hex: C.borde, papel: 'filo de luz, de un solo lado' },
  { nombre: 'oro', hex: C.oro, papel: 'ojos, acentos' },
  { nombre: 'claro', hex: C.claro, papel: 'luz cálida, puntas' },
  { nombre: 'naranja', hex: C.naranja, papel: 'llamas, crestas' },
  { nombre: 'rojo', hex: C.rojo, papel: 'llamas, escamas' },
  { nombre: 'rojoOsc', hex: C.rojoOsc, papel: 'llamas, escamas' },
  { nombre: 'pata', hex: C.pata, papel: 'piel, patas, cráneo' },
  { nombre: 'sombra', hex: '#0c0608', papel: 'la sombra que separa las piezas' },
];
export const SOMBRA = 'rgba(12,6,8,.9)';

// Una llama, como las alas del dragón de Miss Ko (Eze, 2026-11-26: "más irregulares"): no lenguas iguales con borde
// entero, sino rizos en S gruesos, cada uno con su carácter (sacado de `fase`, así es estable cuadro a cuadro): su
// largo de onda, su amplitud, su grosor, el gancho de la punta; uno de cada cinco es una cinta larga que ondula varias
// veces. Lo que separa una llama de la de abajo es una sombra oscura (no un contorno claro); el blanco es sólo un filo
// de luz de un lado, el de afuera, que se corta antes de la punta.
// `fuera`: hacia dónde sale; `atras`: hacia dónde la lleva el vuelo; `abre`: cuánto sale hacia afuera (0 todo atrás)
export function llama(ctx: CanvasRenderingContext2D, base: P, fuera: P, atras: P, largo: number, ancho: number, t: number, fase: number, lado: number, color: string, lw: number, abre = .55, regular = false){
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


// El ojo de reptil, visto desde arriba: en `o` (centro), mirando hacia `ang`, del lado `lado` (1/-1), a escala `H`
// (largo de cabeza); `parpado` 1 abierto, ~.1 cerrado.
export function ojoReptil(ctx: CanvasRenderingContext2D, o: P, ang: number, lado: number, H: number, lw: number, parpado = 1){
  const largoO = H*.15, anchoO = H*.065*parpado;
  ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(ang - lado*.32);   // el rabillo, hacia atrás y afuera
  const almendra = () => {
    ctx.beginPath(); ctx.moveTo(largoO, 0);
    ctx.quadraticCurveTo(0, lado*anchoO*2, -largoO, lado*anchoO*.35);    // el borde de afuera, más curvo
    ctx.quadraticCurveTo(0, -lado*anchoO*1.1, largoO, 0);                 // el de adentro, más recto
    ctx.closePath();
  };
  // la cuenca: una sombra oscura alrededor, que la hunde en el cráneo
  almendra(); ctx.strokeStyle = 'rgba(26,8,6,.95)'; ctx.lineWidth = lw*2.6; ctx.stroke();
  const cy = lado*anchoO*.45;
  const iris = ctx.createRadialGradient(largoO*.15, cy, 0, largoO*.15, cy, largoO*.95);
  iris.addColorStop(0, '#ffe08a'); iris.addColorStop(.55, C.oro); iris.addColorStop(1, '#c86a14');
  almendra(); ctx.fillStyle = iris; ctx.fill();
  ctx.save(); almendra(); ctx.clip();
  // la pupila rasgada, atravesada (de arriba se ve como una raja de lado a lado de la almendra)
  ctx.beginPath(); ctx.ellipse(largoO*.18, cy, H*.024, anchoO*1.6, 0, 0, TAU); ctx.fillStyle = '#140504'; ctx.fill();
  ctx.beginPath(); ctx.arc(largoO*.45, cy - lado*anchoO*.25, H*.018, 0, TAU); ctx.fillStyle = 'rgba(255,250,235,.9)'; ctx.fill();   // el brillo
  ctx.restore();
  ctx.restore();
}

// La hondura como oscuridad: un envoltorio del contexto que, al poner un color, lo lleva hacia el negro según `osc`
// (1 en el vidrio, 0 en lo hondo); los degradados se apagan con la opacidad. Las piezas siguen sólidas: transparentes,
// las llamas superpuestas se veían unas a través de otras y el dragón se desarmaba.
export class Hondura {
  osc = 1;
  private colores = new Map<string, string>();
  private metodos = new Map<PropertyKey, Function>();
  envolver(ctx: CanvasRenderingContext2D): CanvasRenderingContext2D {
    const yo = this;
    return new Proxy(ctx, {
      get(t, k){
        const v = Reflect.get(t, k);
        if(typeof v !== 'function') return v;
        let f = yo.metodos.get(k); if(!f){ f = v.bind(t); yo.metodos.set(k, f!); }
        return f;
      },
      set(t, k, v){
        if(k === 'fillStyle' || k === 'strokeStyle'){
          if(typeof v === 'string'){ v = yo.oscurecer(v); t.globalAlpha = 1; }
          else t.globalAlpha = yo.osc;
        }
        return Reflect.set(t, k, v);
      },
    });
  }
  oscurecer(c: string){
    const o = Math.round(this.osc*40)/40;
    if(o >= 1) return c;
    const clave = c + '|' + o;
    let r = this.colores.get(clave);
    if(r) return r;
    let rgb: number[], a = 1;
    if(c[0] === '#') rgb = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
    else { const m = c.match(/[\d.]+/g)!.map(Number); rgb = m.slice(0, 3); a = m[3] ?? 1; }
    // hacia un negro apenas azulado, como agua honda; en lo más hondo, negro puro (sin silueta fantasma)
    const fondo = [4, 6, 12].map(v => v*Math.min(1, o*3));
    r = `rgba(${rgb.map((v, i) => Math.round(fondo[i] + (v - fondo[i])*o)).join(',')},${a})`;
    this.colores.set(clave, r);
    return r;
  }
}
// la perspectiva de la hondura: escala y luz a una hondura z (0 en el vidrio)
export const escalaHondura = (z: number) => 1/(1 + Math.max(0, z)*.55);
export const luzHondura = (z: number) => Math.pow(lim(1 - (z - .4)/2.8, 0, 1), 1.3);
