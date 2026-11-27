/*
 * Las escenas de la mesa (Eze, 2026-11-27: "un módulo donde se combinen todas las animaciones, una escena; a tu
 * criterio"): composiciones de varios elementos en capas, cada una un pequeño cuadro de una noche japonesa, y una
 * función completa que las encadena con la cortina de pétalos como transición (ver /mesa/escenas/).
 *
 * El truco para apilar: cada elemento pinta su propio fondo (negro, un cielo, agua) a pantalla completa. `capa` lo
 * dibuja a través de `sinFondo`, un Proxy del contexto que ignora los fillRect/clearRect que cubren todo el lienzo: así
 * queda sólo lo que el elemento tiene encima (las grullas sin su cielo, el Fuji sin su cielo, los pétalos sin su negro),
 * y se puede poner sobre otro. Los elementos no se tocan: siguen dibujándose solos igual en /mesa/elementos/.
 */
import { ELEMENTOS, type Elemento } from '../elementos';
import { DragonPlano } from '../dragon/dragon2d';

export interface Escena { id: string; nombre: string; descripcion: string; dura: number; dibujar(g: CanvasRenderingContext2D, w: number, h: number, t: number): void }

const E = (id: string) => { const e = ELEMENTOS.find(e => e.id === id); if(!e) throw new Error('sin elemento ' + id); return e; };

// el contexto sin los fondos a pantalla completa (ver arriba); todo lo demás pasa tal cual al contexto de verdad
function sinFondo(ctx: CanvasRenderingContext2D, w: number, h: number): CanvasRenderingContext2D {
  const cubre = (x: number, y: number, a: number, b: number) => x <= 1 && y <= 1 && x + a >= w - 1 && y + b >= h - 1;
  return new Proxy(ctx, {
    get(t, k){
      if(k === 'fillRect') return (x: number, y: number, a: number, b: number) => { if(!cubre(x, y, a, b)) t.fillRect(x, y, a, b); };
      if(k === 'clearRect') return (x: number, y: number, a: number, b: number) => { if(!cubre(x, y, a, b)) t.clearRect(x, y, a, b); };
      const v = Reflect.get(t, k);
      return typeof v === 'function' ? v.bind(t) : v;
    },
    set(t, k, v){ return Reflect.set(t, k, v); },
  });
}

type Opciones = { fondo?: boolean; x?: number; y?: number; s?: number; alfa?: number; t?: number };
// dibuja un elemento como capa: con o sin su fondo, corrido y escalado (en fracciones del lienzo), con su propio reloj
function capa(g: CanvasRenderingContext2D, id: string, w: number, h: number, t: number, o: Opciones = {}){
  const e: Elemento = E(id);
  g.save();
  g.translate((o.x ?? 0)*w, (o.y ?? 0)*h); if(o.s) g.scale(o.s, o.s);
  if(o.alfa !== undefined) g.globalAlpha = o.alfa;
  g.lineJoin = 'round'; g.lineCap = 'round';
  e.dibujar(o.fondo === false ? sinFondo(g, w, h) : g, w, h, o.t ?? t);
  g.restore();
}
// un velo negro sobre lo ya dibujado (para que un fondo quede atrás)
const velo = (g: CanvasRenderingContext2D, w: number, h: number, a: number) => { g.save(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.fillStyle = `rgba(0,0,0,${a})`; g.fillRect(0, 0, w, h); g.restore(); };

// el dragón (el pez, el 8) para la escena del mar: uno por tamaño de lienzo
const dragones = new Map<string, DragonPlano>();
const dragon = (w: number, h: number) => { const k = `${w}x${h}`; if(!dragones.has(k)) dragones.set(k, new DragonPlano(w, h, w*.7, 'pez')); return dragones.get(k)!; };

export const ESCENAS: Escena[] = [
  {
    id: 'llegada', nombre: 'La llegada', dura: 26,
    descripcion: 'Se entra caminando por el túnel de torii, bajo una hilera de faroles que se mecen, con hojas de arce cayendo.',
    dibujar(g, w, h, t){
      capa(g, 'torii-tunel', w, h, t);
      capa(g, 'chochin-hilera', w, h, t, { fondo: false, x: .17, y: -.05, s: .66 });
      capa(g, 'momiji', w, h, t, { fondo: false, alfa: .85 });
    },
  },
  {
    id: 'estanque', nombre: 'El estanque', dura: 26,
    descripcion: 'Los koi nadan en el estanque dejando su tinta, y caen pétalos de cerezo sobre el agua.',
    dibujar(g, w, h, t){
      capa(g, 'koi-estanque', w, h, t);
      capa(g, 'sakura', w, h, t, { fondo: false });
    },
  },
  {
    id: 'templo', nombre: 'El templo en el agua', dura: 26,
    descripcion: 'El torii sobre el agua con sus faroles flotantes; arriba, una bandada de grullas cruza entre nubes doradas.',
    dibujar(g, w, h, t){
      capa(g, 'torii-agua', w, h, t);
      capa(g, 'tsuru-nubes', w, h, t, { fondo: false, x: .5, y: .03, s: .42 });
    },
  },
  {
    id: 'fuji', nombre: 'Amanecer en el Fuji', dura: 26,
    descripcion: 'El sol sube detrás del Fuji mientras pasan las nubes, y las grullas vuelan entre nubes de oro.',
    dibujar(g, w, h, t){
      capa(g, 'fuji-amanecer', w, h, t, { t: t + 3 });
      capa(g, 'tsuru-nubes', w, h, t, { fondo: false, x: .02, y: .04, s: .5 });
    },
  },
  {
    id: 'dragon', nombre: 'El dragón en el mar', dura: 20,
    descripcion: 'El dragón sube desde el fondo del mar de seigaiha, recorre la mesa rozando la superficie y se zambulle.',
    dibujar(g, w, h, t){
      capa(g, 'seigaiha', w, h, t);
      velo(g, w, h, .55);
      dragon(w, h).draw(g, (t % 20)/20, t);
    },
  },
  {
    id: 'matsuri', nombre: 'Matsuri', dura: 24,
    descripcion: 'La noche del festival: fuegos sobre el río, los faroles de sake y comida, y un Daruma que pasa rodando y guiña.',
    dibujar(g, w, h, t){
      capa(g, 'hanabi-rio', w, h, t);
      capa(g, 'chochin-hilera', w, h, t, { fondo: false, x: .2, y: -.07, s: .6 });
      capa(g, 'daruma-guino', w, h, t, { fondo: false, x: .3, y: .5, s: .42 });
    },
  },
  {
    id: 'kitsune', nombre: 'El espíritu del bambú', dura: 22,
    descripcion: 'En el bosque de bambú mecido por el viento aparece la máscara del zorro, flotando, y su espíritu se enciende.',
    dibujar(g, w, h, t){
      capa(g, 'bambu-bosque', w, h, t);
      velo(g, w, h, .25);
      capa(g, 'kitsune-mascara', w, h, t, { fondo: false, x: .25, y: .2, s: .5 });
    },
  },
  {
    id: 'zen', nombre: 'Zen', dura: 16,
    descripcion: 'Sobre la piedra que se quiebra y se repara con oro, el pincel escribe el ensō y se deshace en polvo dorado.',
    dibujar(g, w, h, t){
      capa(g, 'kintsugi-piedra', w, h, t);
      velo(g, w, h, .35);
      capa(g, 'enso', w, h, t, { fondo: false, t: t + 1.5 });
    },
  },
];

// La función completa: las escenas una tras otra; en cada cambio cruza la cortina de pétalos (su banda tapa el centro
// justo en el cambio) y un velo oscuro breve esconde el corte. `funcion` dibuja el segundo `t` de la función.
export const DURACION = ESCENAS.reduce((a, e) => a + e.dura, 0);
const MEDIA = 3.75;   // la cortina tarda esto en llegar al centro (ver sakura.ts: CORTINA)
export function funcion(g: CanvasRenderingContext2D, w: number, h: number, t: number){
  const c = t % DURACION;
  let desde = 0, i = 0;
  while(i < ESCENAS.length - 1 && c >= desde + ESCENAS[i].dura){ desde += ESCENAS[i].dura; i++; }
  const local = c - desde;
  ESCENAS[i].dibujar(g, w, h, local);
  // la transición: alrededor de cada cambio (también del último al primero)
  const hastaFin = ESCENAS[i].dura - local, d = local < MEDIA ? local : hastaFin < MEDIA ? -hastaFin : null;
  if(d !== null){
    velo(g, w, h, Math.max(0, .9 - Math.abs(d)/1.2*.9));
    capa(g, 'sakura-cortina', w, h, 0, { fondo: false, t: MEDIA + d });
  }
  return { escena: ESCENAS[i], local };
}
