/*
 * Hanabi, el decimoséptimo elemento (Eze, 2026-11-27): los fuegos artificiales japoneses, la paleta de fuego en estado
 * puro; un momento festivo (un cumpleaños, un brindis). Los tipos clásicos de los maestros japoneses: el kiku
 * (crisantemo: estrellas con estela desde el centro, una esfera perfecta), el botan (peonía: estrellas sin estela), el
 * yae-shin (el crisantemo de corazón doble: un anillo interior de otro color), el yanagi (sauce: estelas doradas largas
 * que caen) y el senrinka (mil flores: muchos estallidos chicos). Y el senkō hanabi, la bengalita japonesa de papel que
 * se sostiene con la mano: una bola de fuego colgando que suelta chispas ramificadas como agujas de pino (matsuba), la
 * escala justa para una mesa. Todo con luz que se suma ("lighter"). Estáticos; el estallido, en `animacion`.
 */
import { C, TAU, hash } from '../dragon/estilo';
import type { Elemento } from './index';

const ANIMACION = 'Hanabi (fuegos artificiales japoneses): un momento festivo para la mesa (un cumpleaños, un brindis). Estallidos que se abren, caen y se apagan; la bengala senkō hanabi chisporroteando.';
const GRUPO = 'Hanabi';

const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
type Tipo = 'kiku' | 'botan' | 'yanagi';

// un estallido en (x, y) de radio R: `n` estrellas en direcciones repartidas sobre una esfera (proyectadas, por eso el
// borde se ve más denso y se lee redondo), cada una con su estela que cae un poco por la gravedad
// `e` (animación): la edad del estallido, de 0 (recién reventado) a 1 (apagado); sin él, el instante de la foto. Con la
// edad: se abre rápido y frena (`abre`), la estela se acorta y se corre hacia afuera, la gravedad lo hace caer y todo
// se apaga; el destello del centro sólo al reventar.
function estallido(g: CanvasRenderingContext2D, x: number, y: number, R: number, tipo: Tipo, color: string, lw: number, sem: number, n = 110, e = -1){
  const vivo = e >= 0, abre = vivo ? 1 - Math.pow(1 - Math.min(1, e/.3), 3) : 1, luz = vivo ? Math.max(0, 1 - Math.pow(Math.max(0, (e - .35)/.65), 1.3)) : 1;
  if(luz <= 0) return;
  const [r, gg, b] = rgb(color), caida = (tipo === 'yanagi' ? 1.1 : .22)*(vivo ? .3 + e*2.2 : 1);
  g.save(); g.globalCompositeOperation = 'lighter';
  // el resplandor del centro, apenas (y un destello al reventar)
  const fl = vivo ? Math.max(0, 1 - e/.08) : 0;
  const halo = g.createRadialGradient(x, y, 0, x, y, R*1.1); halo.addColorStop(0, `rgba(${r},${gg},${b},${.12*luz + .5*fl})`); halo.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = halo; g.fillRect(x - R*1.2, y - R*1.2, R*2.4, R*2.4);
  for(let i = 0; i < n; i++){
    // una dirección uniforme sobre la esfera (Fibonacci), vista de frente
    const zz = 1 - 2*(i + .5)/n, rr = Math.sqrt(1 - zz*zz), a = i*2.39996 + sem;
    const dx = Math.cos(a)*rr, dy = Math.sin(a)*rr, var_ = .92 + hash(sem + i)*.16;
    const P = (s: number) => ({ x: x + dx*R*s*var_*abre, y: y + dy*R*s*var_*abre + caida*R*s*s*s*abre });
    if(tipo !== 'botan'){
      // la estela: en vida, la cola se va acercando a la estrella (se acorta) a medida que el estallido envejece
      const desde = vivo ? (tipo === 'yanagi' ? Math.min(.9, e*.9) : .35 + e*.55) : tipo === 'yanagi' ? 0 : .35, pasos = tipo === 'yanagi' ? 14 : 8, hasta = tipo === 'yanagi' ? 1.35 : 1;
      for(let k = 0; k < pasos; k++){
        const s0 = desde + (hasta - desde)*k/pasos, s1 = desde + (hasta - desde)*(k + 1)/pasos, q = (k + 1)/pasos;
        const p0 = P(s0), p1 = P(s1), al = tipo === 'yanagi' ? .5*Math.sin(q*Math.PI)*(1 - q*.4) : .7*q*q;
        g.beginPath(); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y);
        g.strokeStyle = `rgba(${r},${gg},${b},${al*luz})`; g.lineWidth = lw*(tipo === 'yanagi' ? 1 : .8 + q*.6); g.stroke();
      }
    }
    if(tipo === 'yanagi') continue;
    // la estrella: un punto brillante con núcleo casi blanco
    // (al final, las estrellas titilan antes de apagarse, cada una a su tiempo)
    const tit = vivo && e > .55 ? (hash(sem + i*3.7 + Math.floor(e*40)) < .35 ? .25 : 1) : 1;
    const p = P(1), t = lw*(tipo === 'botan' ? 2.2 : 1.6)*(vivo ? .6 + .4*luz : 1);
    const es = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, t*3); es.addColorStop(0, `rgba(255,248,230,${luz*tit})`); es.addColorStop(.3, `rgba(${r},${gg},${b},${.9*luz*tit})`); es.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    g.fillStyle = es; g.fillRect(p.x - t*3, p.y - t*3, t*6, t*6);
  }
  g.restore();
}

// el ascenso: la carcasa sube desde abajo dejando una estela fina de chispas, frenando (`e` de 0 a 1)
function sube(g: CanvasRenderingContext2D, x: number, y: number, desde: number, e: number, lw: number){
  const q = 1 - Math.pow(1 - e, 2), py = desde + (y - desde)*q;
  g.save(); g.globalCompositeOperation = 'lighter';
  const gr = g.createLinearGradient(x, py, x, py + (desde - y)*.25); gr.addColorStop(0, 'rgba(255,220,150,.9)'); gr.addColorStop(1, 'rgba(255,170,80,0)');
  g.beginPath(); g.moveTo(x + Math.sin(e*30)*lw*.5, py); g.lineTo(x, py + (desde - y)*.25); g.strokeStyle = gr; g.lineWidth = lw*1.2; g.stroke();
  g.beginPath(); g.arc(x, py, lw*1.5, 0, TAU); g.fillStyle = '#fff3dc'; g.fill();
  g.restore();
}
// Un programa de fuegos: cada carcasa con cuándo sale, dónde revienta, de qué tipo, color y cuánto vive; `programa`
// dibuja lo que está en el aire en el segundo `c` del ciclo (sube 0.9 s, revienta, vive `vida` s).
type Carcasa = { sale: number; x: number; y: number; R: number; tipo: Tipo; color: string; n: number; vida: number; sem: number };
function programa(g: CanvasRenderingContext2D, w: number, h: number, cs: Carcasa[], c: number, lw: number, piso: number){
  for(const k of cs){
    const a = c - k.sale; if(a < 0) continue;
    if(a < .9){ sube(g, w*k.x, h*k.y, piso, a/.9, lw); continue; }
    const e = (a - .9)/k.vida; if(e > 1) continue;
    estallido(g, w*k.x, h*k.y, h*k.R, k.tipo, k.color, lw, k.sem, k.n, e);
  }
}

// el cielo de la noche, el río y la orilla con sus faroles; el reflejo de lo de arriba, partido en tiras por el agua
let cieloLienzo: HTMLCanvasElement | null = null;
function noche(g: CanvasRenderingContext2D, w: number, h: number, horizonte: number, cielo: (g: CanvasRenderingContext2D) => void, t = 0){
  if(!cieloLienzo || cieloLienzo.width !== w || cieloLienzo.height !== Math.round(horizonte)){ cieloLienzo = document.createElement('canvas'); cieloLienzo.width = w; cieloLienzo.height = Math.round(horizonte); }
  const arriba = cieloLienzo, ga = arriba.getContext('2d')!;
  ga.lineCap = 'round'; ga.globalCompositeOperation = 'source-over';
  const f = ga.createLinearGradient(0, 0, 0, horizonte); f.addColorStop(0, '#000'); f.addColorStop(1, '#1a0806');
  ga.fillStyle = f; ga.fillRect(0, 0, w, horizonte);
  cielo(ga);
  g.drawImage(arriba, 0, 0);
  g.fillStyle = '#050202'; g.fillRect(0, horizonte, w, h - horizonte);
  // el reflejo: la imagen de arriba volteada, en tiras finas desplazadas por las ondas, más tenue al alejarse
  const alto = h - horizonte, tira = Math.max(2, h/180);
  for(let y = 0; y < alto; y += tira){
    const q = y/alto, desde = horizonte - y*(horizonte/alto)*.9 - tira, dx = Math.sin(y*.21 - t*2.4)*w*.006*(1 + q*3) + (hash(y + Math.floor(t*3)) - .5)*w*.01*q;
    g.globalAlpha = .55*(1 - q*.7);
    g.drawImage(arriba, 0, Math.max(0, desde), w, tira, dx, horizonte + y, w, tira);
  }
  g.globalAlpha = 1;
  // la orilla de enfrente: una línea oscura con los techos y unos faroles chicos
  g.fillStyle = '#0c0403'; g.beginPath(); g.moveTo(0, horizonte);
  for(let x = 0; x <= w; x += w/40){ const tejado = hash(x*.37) < .35; g.lineTo(x, horizonte - h*(tejado ? .03 + hash(x)*.02 : .012)); }
  g.lineTo(w, horizonte + h*.008); g.lineTo(0, horizonte + h*.008); g.closePath(); g.fill();
  for(let k = 0; k < 14; k++){ const x = w*(.03 + k*.07 + hash(k)*.03), y = horizonte - h*.006; g.beginPath(); g.arc(x, y, h*.004, 0, TAU); g.fillStyle = C.naranja; g.fill(); }
}

const RIO = 16;
const RIO_CARCASAS: Carcasa[] = [
  { sale: .3, x: .86, y: .44, R: .1, tipo: 'botan', color: C.naranja, n: 45, vida: 2.2, sem: 4 },
  { sale: 1.4, x: .25, y: .24, R: .2, tipo: 'yanagi', color: '#ffcf7a', n: 90, vida: 4.6, sem: 3 },
  { sale: 3.6, x: .62, y: .3, R: .24, tipo: 'kiku', color: C.oro, n: 130, vida: 3.2, sem: 1 },
  { sale: 3.6, x: .62, y: .3, R: .12, tipo: 'botan', color: C.rojo, n: 50, vida: 2.8, sem: 2 },
  { sale: 6.8, x: .4, y: .22, R: .17, tipo: 'kiku', color: C.rojo, n: 100, vida: 3, sem: 5 },
  { sale: 7.6, x: .8, y: .28, R: .14, tipo: 'yanagi', color: '#ffcf7a', n: 70, vida: 4, sem: 6 },
  ...Array.from({ length: 9 }, (_, k) => ({ sale: 10.2 + k*.22, x: .2 + hash(k*3.1)*.6, y: .2 + hash(k*5.3)*.3, R: .03 + hash(k)*.025, tipo: 'kiku' as Tipo, color: [C.claro, C.rojo, C.oro][k % 3], n: 26, vida: 1.8, sem: 10 + k })),
];
export const hanabiRio: Elemento = {
  id: 'hanabi-rio', grupo: GRUPO, nombre: 'Hanabi sobre el río',
  descripcion: 'Una noche de verano: un crisantemo de corazón doble, un sauce dorado que cae, peonías y mil flores chicas, reflejados en el río.',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    // animado, en un ciclo de `RIO` s: las carcasas suben desde la orilla y revientan una tras otra (la peonía, el sauce
    // dorado que cae largo, el gran crisantemo con su corazón doble, el final de mil flores chicas casi a la vez), cada
    // estallido se abre, cae y se apaga; el río refleja todo, con las ondas moviéndose
    const lw = Math.max(1.6, w/600), c = t % RIO, piso = h*.7;
    noche(g, w, h, piso, ga => programa(ga, w, h, RIO_CARCASAS, c, lw, piso), t);
  },
};

export const hanabiKiku: Elemento = {
  id: 'hanabi-kiku', grupo: GRUPO, nombre: 'Kiku · el crisantemo',
  descripcion: 'Un solo crisantemo enorme, la esfera perfecta de los maestros japoneses, con su corazón en otro color.',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    // animado, en un ciclo de 7 s: sube, revienta en sus tres capas (la de adentro un instante después, como en las
    // carcasas de corazón doble), se abre, cae y se apaga; una pausa a oscuras
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    const lw = Math.max(2, w/480), c = t % 7;
    programa(g, w, h, [
      { sale: .2, x: .5, y: .47, R: .44, tipo: 'kiku', color: C.naranja, n: 220, vida: 3.6, sem: 5 },
      { sale: .35, x: .5, y: .47, R: .3, tipo: 'kiku', color: C.oro, n: 150, vida: 3.2, sem: 6 },
      { sale: .5, x: .5, y: .47, R: .14, tipo: 'botan', color: C.rojo, n: 60, vida: 2.6, sem: 7 },
    ], c, lw, h*1.05);
  },
};

// una chispa de la bengala: una línea que se abre en ramas, y las ramas en ramitas (las agujas de pino, matsuba)
function chispa(g: CanvasRenderingContext2D, x: number, y: number, ang: number, largo: number, nivel: number, lw: number, sem: number, ramas0 = 3){
  const x2 = x + Math.cos(ang)*largo, y2 = y + Math.sin(ang)*largo + largo*largo*.0006;
  g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2);
  g.strokeStyle = nivel === 0 ? 'rgba(255,214,140,.9)' : `rgba(255,${190 + nivel*20},${110 + nivel*40},${.9 - nivel*.18})`; g.lineWidth = lw*(1.3 - nivel*.3); g.stroke();
  if(nivel >= ramas0) return;
  const ramas = 2 + Math.floor(hash(sem)*3);
  for(let k = 0; k < ramas; k++){
    const a = ang + (hash(sem + k*1.7) - .5)*1.6, f = .3 + hash(sem*2 + k)*.6;
    chispa(g, x + (x2 - x)*f, y + (y2 - y)*f, a, largo*(.35 + hash(sem*3 + k)*.25), nivel + 1, lw, sem*1.3 + k*7.1, ramas0);
  }
}

const SENKO = 19;
export const senko: Elemento = {
  id: 'hanabi-senko', grupo: GRUPO, nombre: 'Senkō hanabi · la bengala',
  descripcion: 'La bengalita japonesa de papel: una bola de fuego colgando que suelta chispas ramificadas como agujas de pino. La escala de una mesa.',
  animacion: ANIMACION,
  dibujar(g, w, h, t){
    // animado: la vida entera de una bengala, en `SENKO` s, como la cuentan en Japón: la bola se forma (tsubomi, el
    // brote), crepita cada vez más (botan, la peonía), revienta en agujas de pino a pleno (matsuba), se calma en chispas
    // finas que caen como sauce (yanagi), y se apaga en pétalos sueltos (chiri-giku); al final la bola cae. Cada chispa
    // vive un instante y nace otra distinta (su semilla cambia en cada vida).
    const cs = t % SENKO, fuerza = cs < 2 ? 0 : cs < 7 ? (cs - 2)/5 : cs < 11 ? 1 : cs < 17 ? 1 - (cs - 11)/6.5 : 0;
    const cae = cs > 17.2 ? Math.min(1, (cs - 17.2)/.6) : 0, bolaR = cs < 2 ? cs/2 : cs > 17.2 ? 1 - cae : 1;
    const c = g;
    c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
    const lw = Math.max(1.5, w/700), x = w*.5 + Math.sin(t*1.1)*w*.004, bola = { x, y: h*.5 + cae*cae*h*.6 };
    // el papel retorcido del que cuelga, en sus colores (rojo y oro), un poco curvo, meciéndose apenas
    c.beginPath(); c.moveTo(w*.48, -h*.02); c.bezierCurveTo(x - w*.01, h*.2, x + w*.01, h*.32, x, h*.48);
    c.strokeStyle = C.rojoOsc; c.lineWidth = lw*5; c.stroke(); c.strokeStyle = C.oro; c.lineWidth = lw*1.6; c.setLineDash([lw*6, lw*8]); c.stroke(); c.setLineDash([]);
    c.globalCompositeOperation = 'lighter';
    // el resplandor y las chispas, con la fuerza de la etapa
    const halo = c.createRadialGradient(bola.x, bola.y, 0, bola.x, bola.y, h*.4); halo.addColorStop(0, `rgba(255,170,80,${(.08 + .3*fuerza)*bolaR})`); halo.addColorStop(1, 'rgba(255,170,80,0)');
    c.fillStyle = halo; c.fillRect(0, 0, w, h);
    // a pleno, ramas de tres niveles (matsuba); al calmarse, más finas y cayendo (yanagi)
    const activas = Math.round(34*fuerza), ramas = cs < 11 ? 3 : 2, lentas = cs > 11;
    for(let k = 0; k < activas; k++){
      // cada chispa vive ~0.3 s: crece y se apaga, y la siguiente sale con otra semilla (otra dirección, otras ramas)
      const vida = .28 + hash(k*1.9)*.15, fase = t/vida + hash(k*4.7), edad = fase % 1, vez = Math.floor(fase), sem = 50 + k*3.3 + vez*7.13;
      const a = hash(sem*2.3)*TAU, d = h*(.03 + hash(sem*4.1)*.02), largo = h*(.12 + hash(sem*6.7)*.16)*(lentas ? .7 : 1)*(.35 + .65*edad);
      c.globalAlpha = 1 - edad*edad;
      chispa(c, bola.x + Math.cos(a)*d, bola.y + Math.sin(a)*d + (lentas ? edad*h*.05 : 0), a + (lentas ? .6*Math.sign(Math.cos(a))*edad : 0), largo, 0, lw, sem, ramas);
    }
    c.globalAlpha = 1;
    // la bola de fuego: un núcleo casi blanco, naranja, rojo; tiembla apenas, y al final se apaga mientras cae
    const rb = h*.035*bolaR*(1 + .06*Math.sin(t*23));
    if(rb > 0){
      const b = c.createRadialGradient(bola.x, bola.y, 0, bola.x, bola.y, rb); b.addColorStop(0, '#fff6e0'); b.addColorStop(.4, C.oro); b.addColorStop(.75, C.naranja); b.addColorStop(1, 'rgba(232,67,46,0)');
      c.fillStyle = b; c.beginPath(); c.arc(bola.x, bola.y, rb, 0, TAU); c.fill();
    }
    c.globalCompositeOperation = 'source-over';
  },
};
