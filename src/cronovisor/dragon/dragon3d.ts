/*
 * El dragón en 3D (Eze, 2026-11-24): el dragón oriental de la mesa del restaurante (~/Desktop/dev/dragon-mesa, 2D de
 * perfil), construido en 3D con sus mismas proporciones, piezas y colores, para volar libre en la galaxia además de
 * Tanu. Hecho en código, como empezó Tanu: no hay modelo, todo sale de primitivas.
 *
 * - Cuerpo: un tubo que pasa por donde pasó la cabeza (su historia de posiciones, tomada por distancia) con la anatomía
 *   del 2D (cuello, pecho y hombros, cintura, ancas, cola que se afina), y una onda que lo recorre de la cabeza a la cola,
 *   de lado y arriba-abajo, como nadando en el aire. Pintado en el shader: lomo azul con escamas en media luna, franja
 *   de luz sobre el lomo, vientre amarillo con placas. Aletas rojas en llama sobre el lomo, cola en llama.
 * - Patas: brazo y antebrazo (codo y rodilla por cinemática inversa, como en el 2D), garras de cinco dedos con uñas, y
 *   el gesto de estirarse hacia la perla de vez en cuando.
 * - Cabeza por piezas: cráneo y hocico, hocico bulboso amarillo con orificios, dos ojos con iris y brillo y su ceja,
 *   mandíbula que se abre, dientes, lengua, dos cuernos que se enroscan, melena de llamas alrededor de la nuca, barba y
 *   bigotes que ondean.
 * - La perla en llamas, delante.
 * No hay luces en la escena: cada material se ilumina solo (una luz fija desde arriba y un brillo de borde), bajo el
 * umbral del bloom. Vuela como el 2D: de vez en cuando cruza la galaxia por encima de los barrios y se va.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export interface DragonHost {
  spots(): THREE.Vector3[];   // los corazones de los barrios, por donde pasa, del más viejo al más nuevo
  radius(): number;           // el radio de la galaxia
  reduced: boolean;           // movimiento reducido: no vuela
}

const TAU = Math.PI*2;
const suave = (q: number) => q*q*(3 - 2*q);
const lim = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// la paleta festiva (la de la referencia de Eze)
const C = { cuerpo: 0x3a9fd8, luz: 0xa6e4ff, vientre: 0xffd35a, placa: 0xd98a2a, trazo: 0x1d5a8c, aleta: 0xe8432e, melena2: 0xf6744a,
  cuerno: 0xfff6e0, hocico: 0xffd03a, ojo: 0x1f5f9e, boca: 0x7a1418, lengua: 0xe8432e, diente: 0xfffaf0 };

// medidas (en unidades del mundo), en las proporciones del diseño de la mesa
const L = 30;                   // largo del cuerpo
const N = 90, M = 14;           // anillos y lados del tubo
const GROSOR = L*.071;          // grosor máximo
const S = L*.15;                // largo de la cabeza
const PATA = L*.095;
const VEL = 12, ARRIBA = 24;
// Dos dragones con la misma paleta (Eze, 2026-11-25, para el restaurante de cocina japonesa, coreana y del sudeste
// asiático): el chino (long: cinco garras, astas de ciervo, cabeza robusta) y el japonés (ryū: tres garras, como cuenta
// la leyenda del dragón que perdía garras al alejarse de China; más delgado y serpentino, cabeza larga y estilizada,
// astas largas y finas, melena que fluye hacia atrás como agua, bigotes largos).
export type Estilo = 'chino' | 'japones';
const ESTILOS = {
  chino:   { garras: 5, espolon: true,  grosor: 1,   pata: 1,   ondaL: .55, ondaA: 1,   aletas: 1,   perla: 2.15 },
  japones: { garras: 3, espolon: false, grosor: .8,  pata: .85, ondaL: .4,  ondaA: 1.3, aletas: .8,  perla: 2.5 },
};
const bulto = (f: number, donde: number, alto: number, ancho: number) => alto*Math.exp(-Math.pow((f - donde)/ancho, 2));
function perfil(f: number){
  const base = f < .45 ? .74 : .74*(1 - Math.pow((f - .45)/.55, 1.15)*.88);
  // el cuello: un poco más fino a media altura y ensanchándose hacia la cabeza, hasta el tamaño del cráneo (antes se
  // afinaba justo antes de la cabeza y el cráneo quedaba como una bola pegada; Eze pidió continuidad)
  return base - bulto(f, .085, .06, .03) + bulto(f, 0, .3, .055) + bulto(f, .12, .26, .055) - bulto(f, .26, .06, .04) + bulto(f, .4, .2, .05);
}

// ── materiales: se iluminan solos ───────────────────────────────────────────────────────────────────────────────────
// No hay luces en la escena (ni en el Cronovisor ni en la mesa): cada material lleva su luz, en el espacio de la vista.
// Una luz principal cálida desde arriba a la izquierda, un relleno frío y suave desde abajo, un brillo especular
// (Blinn-Phong, que corre por el cuerpo cuando se mueve) y un borde de luz. Todo bajo el umbral del bloom, y a prueba de
// NaN (un NaN que llegue al bloom ennegrece la pantalla entera).
const LUZ_COMUN = `
  vec3 luz(vec3 base, vec3 n, vec3 v, float brillo, float dureza, float borde){
    vec3 L1 = normalize(vec3(-.35, .8, .5)), L2 = normalize(vec3(.4, -.7, .3));
    float d1 = max(dot(n, L1), 0.), d2 = max(dot(n, L2), 0.);
    vec3 h = normalize(L1 + v);
    float sp = pow(max(dot(n, h), 0.), dureza)*brillo;
    float rim = pow(1. - max(dot(n, v), 0.), 2.5)*borde;
    vec3 c = base*(.44 + .62*d1*vec3(1., .97, .9) + .22*d2*vec3(.6, .75, 1.)) + vec3(1., .96, .86)*sp*.45 + vec3(.55, .8, 1.)*rim;
    return min(c*.9, vec3(.94));   // luminoso (se proyecta sobre madera), sin pasar el umbral del bloom
  }
  vec3 relieve(vec3 n, float h, vec3 pos){
    vec3 sx = dFdx(pos), sy = dFdy(pos), r1 = cross(sy, n), r2 = cross(n, sx);
    float det = dot(sx, r1);
    vec3 g = sign(det)*(dFdx(h)*r1 + dFdy(h)*r2);
    vec3 m = abs(det)*n - g;
    return dot(m, m) > 1e-12 ? normalize(m) : n;
  }`;
const LUZ_VERT = `
  varying vec3 vN; varying vec3 vV; varying vec3 vP; varying vec3 vO;
  void main(){
    vec4 p = vec4(position, 1.); vec3 nn = normal; vO = position;
    #ifdef USE_INSTANCING
      p = instanceMatrix*p; nn = mat3(instanceMatrix)*nn;   // las piezas instanciadas (dedos, uñas)
    #endif
    vec4 mv = modelViewMatrix*p; vN = normalize(normalMatrix*nn); vV = -mv.xyz; vP = mv.xyz; gl_Position = projectionMatrix*mv;
  }`;
const LUZ_FRAG = `
  uniform vec3 uColor; uniform float uOpacity; uniform float uRim; uniform float uBrillo; uniform float uDureza; uniform float uEsc; uniform vec3 uLuzEsc;
  varying vec3 vN; varying vec3 vV; varying vec3 vP; varying vec3 vO;
  ${LUZ_COMUN}
  void main(){
    vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n;
    vec3 base = uColor;
    if(uEsc > 0.){ // escamas en la cabeza y las patas: cúpulas en media luna, como en el cuerpo
      vec2 g = vec2(vO.x + vO.z*.6, vO.y - vO.z*.3)*uEsc;
      g.x += step(1., mod(floor(g.y), 2.))*.5;
      vec2 f = fract(g) - vec2(.5, .3);
      float d = length(f), h = (1. - smoothstep(0., .48, d))*(.6 + .4*step(0., f.y));
      n = relieve(n, h*.01, vP);
      base = mix(base*(.92 + .16*h), uLuzEsc, smoothstep(.05, 0., abs(d - .42))*step(0., f.y)*.4);
    }
    vec3 col = luz(base, n, normalize(vV), uBrillo, uDureza, uRim);
    if(any(isnan(col))) discard; // un NaN nunca llega al bloom
    gl_FragColor = vec4(col, uOpacity);
  }`;
// brillo: cuánto brilla (0 mate, 1 pulido); dureza: cuán chico el brillo (cuernos y uñas pulidos, ojos vidriosos)
function pintura(color: number, rim = .35, doble = false, brillo = .35, dureza = 28, escamas = 0){
  return new THREE.ShaderMaterial({ vertexShader: LUZ_VERT, fragmentShader: LUZ_FRAG, transparent: true,
    side: doble ? THREE.DoubleSide : THREE.FrontSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 1 }, uRim: { value: rim }, uBrillo: { value: brillo }, uDureza: { value: dureza },
      uEsc: { value: escamas }, uLuzEsc: { value: new THREE.Color(C.luz) } } });
}
// la piel del cuerpo: aS a lo largo (0 cabeza, 1 cola), aA alrededor (0 lomo, .5 vientre). Las escamas y las placas
// tienen relieve (bump mapping sin tangentes, con derivadas de pantalla): cada escama es una cúpula que capta la luz
const PIEL_VERT = `
  attribute float aS; attribute float aA; attribute float aV;
  varying vec3 vN; varying vec3 vV; varying vec3 vP; varying float vS; varying float vA; varying float vVi;
  void main(){ vS = aS; vA = aA; vVi = aV; vec4 mv = modelViewMatrix*vec4(position, 1.); vP = mv.xyz; vN = normalize(normalMatrix*normal); vV = -mv.xyz; gl_Position = projectionMatrix*mv; }`;
const PIEL_FRAG = `
  uniform vec3 uCuerpo, uLuz, uVientre, uPlaca; uniform float uOpacity;
  varying vec3 vN; varying vec3 vV; varying vec3 vP; varying float vS; varying float vA; varying float vVi;
  ${LUZ_COMUN}
  void main(){
    vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n;
    float aVientre = abs(vA - .5);                      // 0 en el centro del vientre
    float vientre = smoothstep(.2, .16, aVientre)*vVi;  // aV: cuánto vientre (en la cabeza se desvanece hacia el hocico)
    // placas del vientre: bandas atravesadas, abombadas
    float fp = fract(vS*60.);
    float placa = smoothstep(.06, 0., abs(fp - .5) - .38);
    float hPlaca = sin(fp*3.14159)*.9;
    // escamas en media luna sobre el lomo y los flancos, cada una una cúpula
    vec2 g = vec2(vS*150., vA*22.);
    g.x += step(1., mod(floor(g.y), 2.))*.5;
    vec2 f = fract(g) - vec2(.5, .3);
    float d = length(f);
    float esc = smoothstep(.05, 0., abs(d - .42))*step(0., f.y);
    float hEsc = (1. - smoothstep(0., .48, d))*(.6 + .4*step(0., f.y));
    float h = mix(hEsc*.9, hPlaca, vientre);
    n = relieve(n, h*.012, vP);
    vec3 col = uCuerpo*(.92 + .16*hEsc);
    col = mix(col, uLuz, esc*.5*(1. - vientre));
    col = mix(col, uLuz, smoothstep(.12, 0., min(vA, 1. - vA))*.3);   // franja de luz sobre el lomo
    col = mix(col, mix(uVientre, uPlaca, placa*.8), vientre);
    col = luz(col, n, normalize(vV), mix(.45, .25, vientre), mix(36., 18., vientre), .32);
    if(any(isnan(col))) discard; // un NaN nunca llega al bloom
    gl_FragColor = vec4(col, uOpacity);
  }`;

// una llama dibujada (para la melena, las aletas, la cola, la barba, los codos y la perla)
function texturaLlama(base: string, punta: string){
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128;
  const c = cv.getContext('2d')!;
  const g = c.createLinearGradient(0, 128, 0, 0); g.addColorStop(0, base); g.addColorStop(1, punta);
  c.fillStyle = g;
  c.beginPath(); c.moveTo(10, 128); c.quadraticCurveTo(-6, 60, 34, 0); c.quadraticCurveTo(30, 52, 56, 128); c.closePath(); c.fill();
  const t = new THREE.CanvasTexture(cv); return t;
}
// orienta una llama (o cualquier carta): su +y hacia `y`, su ancho (+x) lo más cerca posible de `xHint`
const _m4 = new THREE.Matrix4();
function orienta(o: THREE.Object3D, y: THREE.Vector3, xHint: THREE.Vector3){
  const Y = y.clone().normalize();
  let X = xHint.clone().addScaledVector(Y, -xHint.dot(Y));
  if(X.lengthSq() < 1e-6) X = Math.abs(Y.x) < .9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1), X.addScaledVector(Y, -X.dot(Y)); // alineados: cualquier perpendicular
  X.normalize();
  const Z = X.clone().cross(Y);
  o.quaternion.setFromRotationMatrix(_m4.makeBasis(X, Y, Z));
}
// un tubo que se afina a lo largo de una curva (de r0 en la base a r1 en la punta, cerrado en la punta): las astas
function tuboAfinado(curva: THREE.Curve<THREE.Vector3>, seg: number, lados: number, r0: number, r1: number){
  const marcos = curva.computeFrenetFrames(seg, false), pos: number[] = [], nor: number[] = [], idx: number[] = [];
  for(let i = 0; i <= seg; i++){
    const t = i/seg, p = curva.getPointAt(t), r = r0 + (r1 - r0)*Math.pow(t, .8);
    for(let j = 0; j <= lados; j++){
      const a = j/lados*TAU, n = marcos.normals[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(marcos.binormals[i], Math.sin(a));
      pos.push(p.x + n.x*r, p.y + n.y*r, p.z + n.z*r); nor.push(n.x, n.y, n.z);
    }
  }
  for(let i = 0; i < seg; i++) for(let j = 0; j < lados; j++){ const a = i*(lados + 1) + j, b = a + lados + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const punta = curva.getPointAt(1), tg = curva.getTangentAt(1), c = pos.length/3; // la punta, cerrada
  pos.push(punta.x + tg.x*r1, punta.y + tg.y*r1, punta.z + tg.z*r1); nor.push(tg.x, tg.y, tg.z);
  for(let j = 0; j < lados; j++){ const a = seg*(lados + 1) + j; idx.push(a, a + 1, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(pos.length/3*2).fill(0), 2));
  g.setIndex(idx);
  return g;
}

// Una superficie esculpida por secciones (la cabeza, la mandíbula): en vez de óvalos pegados, una sola piel continua
// (Eze, 2026-11-25: la cara eran "esferas alargadas", todo círculos). Cada sección, a lo largo de x, es una superelipse
// (más cuadrada cuanto mayor `pt`/`pb`, arriba y abajo por separado) con su centro `cy`, medio ancho `w`, alto arriba
// `top` y abajo `bot`, más rasgos: una cresta en el lomo (`cresta`), los arcos de las cejas (`ceja`) y los pómulos
// (`pomulo`). Entre secciones se interpola con suavidad (Catmull-Rom), y los dos extremos se cierran.
type Seccion = { x: number; cy: number; w: number; top: number; bot: number; pt?: number; pb?: number; cresta?: number; ceja?: number; pomulo?: number; labio?: number; labioSup?: number; cuello?: boolean };
function esculpir(sec: Seccion[], anillos = 56, lados = 32){
  const claves = ['x', 'cy', 'w', 'top', 'bot', 'pt', 'pb', 'cresta', 'ceja', 'pomulo', 'labio', 'labioSup'] as const;
  const val = (i: number, k: typeof claves[number]) => { const q = sec[Math.max(0, Math.min(sec.length - 1, i))]; return (q[k] as number | undefined) ?? (k === 'pt' || k === 'pb' ? 2 : 0); };
  const en = (u: number, k: typeof claves[number]) => { // Catmull-Rom entre las secciones, u de 0 a sec.length - 1
    const i = Math.min(sec.length - 2, Math.floor(u)), f = u - i;
    const p0 = val(i - 1, k), p1 = val(i, k), p2 = val(i + 1, k), p3 = val(i + 2, k);
    return .5*((2*p1) + (-p0 + p2)*f + (2*p0 - 5*p1 + 4*p2 - p3)*f*f + (-p0 + 3*p1 - 3*p2 + p3)*f*f*f);
  };
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const sp = (c: number, e: number) => Math.sign(c)*Math.pow(Math.abs(c), 2/e);
  for(let r = 0; r <= anillos; r++){
    const u = r/anillos*(sec.length - 1);
    const x = en(u, 'x'), cy = en(u, 'cy'), w = Math.max(1e-3, en(u, 'w')), top = Math.max(1e-3, en(u, 'top')), bot = Math.max(1e-3, en(u, 'bot'));
    const pt = Math.max(1.6, en(u, 'pt')), pb = Math.max(1.6, en(u, 'pb')), cresta = en(u, 'cresta'), ceja = en(u, 'ceja'), pomulo = en(u, 'pomulo');
    const labio = en(u, 'labio'), labioSup = en(u, 'labioSup');
    for(let j = 0; j <= lados; j++){
      const a = j/lados*TAU, ca = Math.cos(a), sa = Math.sin(a), arriba = ca >= 0, e = arriba ? pt : pb;
      let y = cy + (arriba ? top : bot)*sp(ca, e), z = w*sp(sa, e);
      const ad = Math.min(a, TAU - a); // 0 arriba, π abajo, simétrico
      y += cresta*Math.exp(-Math.pow(ad/.22, 2)) + ceja*Math.exp(-Math.pow((ad - .8)/.42, 2));
      z += Math.sign(sa)*pomulo*Math.exp(-Math.pow((ad - 1.75)/.4, 2));
      // los labios: el de arriba cae sobre la mandíbula por el costado de abajo; el de abajo, por el de arriba de la mandíbula
      const lb = Math.exp(-Math.pow((ad - 2.3)/.28, 2)), ls = Math.exp(-Math.pow((ad - .95)/.3, 2));
      z += Math.sign(sa)*(labio*lb + labioSup*ls); y -= labio*lb*.5;
      pos.push(x, y, z); uv.push(r/anillos, j/lados);
    }
  }
  for(let r = 0; r < anillos; r++) for(let j = 0; j < lados; j++){
    const a = r*(lados + 1) + j, b = a + lados + 1;
    idx.push(a, a + 1, b, b, a + 1, b + 1);
  }
  // las tapas: un punto en el centro de cada extremo
  for(const [r, sentido] of [[0, -1], [anillos, 1]] as [number, number][]){
    const u = r/anillos*(sec.length - 1), c = pos.length/3;
    pos.push(en(u, 'x') + sentido*.002, en(u, 'cy'), 0); uv.push(r/anillos, .5);
    for(let j = 0; j < lados; j++){ const a = r*(lados + 1) + j; if(sentido < 0) idx.push(a + 1, a, c); else idx.push(a, a + 1, c); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// Para no dibujar cientos de piezas sueltas (llamas, dedos, uñas), cada clase es un InstancedMesh: las piezas son
// Object3D vacíos colgados donde corresponde (para heredar las transformaciones de la cabeza o la perla) y en cada
// cuadro sus matrices pasan a la instancia. Las piezas fijas de la cabeza se funden en una malla por material.
function fusionar(g: THREE.Object3D){
  const porMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for(const o of [...g.children]){
    if(!(o instanceof THREE.Mesh) || o.userData.vivo) continue;
    o.updateMatrix();
    const geo = (o.geometry as THREE.BufferGeometry).clone().applyMatrix4(o.matrix);
    for(const k of Object.keys(geo.attributes)) if(!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
    if(!geo.index) continue;
    (porMat.get(o.material as THREE.Material) ?? porMat.set(o.material as THREE.Material, []).get(o.material as THREE.Material)!).push(geo);
    g.remove(o);
  }
  for(const [m, geos] of porMat){ const merged = mergeGeometries(geos, false); if(merged) g.add(new THREE.Mesh(merged, m)); }
}

// ── El cuerpo del dragón: todo lo que se dibuja, sin saber por dónde vuela. Quien lo usa le da, en cada cuadro, la curva
// por la que pasa (`pose`: una función que llena la columna con puntos cada `paso`, de la cabeza hacia la cola), y él
// la ondula, arma su piel, sus patas, su cabeza y su perla. Lo usan el Cronovisor (`Dragon`, abajo: vuela rutas por la
// galaxia) y la mesa del restaurante (src/pages/dragon.astro: la diagonal de esquina a esquina, en bucle).
export const LARGO = L;
export class DragonCuerpo {
  readonly mesh = new THREE.Group();          // todo el dragón
  private mats: (THREE.ShaderMaterial | THREE.MeshBasicMaterial)[] = [];
  readonly spine: THREE.Vector3[] = Array.from({ length: N + 1 }, () => new THREE.Vector3());
  readonly T: THREE.Vector3[] = []; readonly U: THREE.Vector3[] = []; readonly Sd: THREE.Vector3[] = [];
  // cuerpo
  private body: THREE.Mesh; private bodyPos: Float32Array; private bodyNor: Float32Array;
  private fins: THREE.Object3D[] = []; private tail: THREE.Object3D[] = [];
  private inst = new Map<string, { geo: THREE.BufferGeometry; mat: THREE.Material; piezas: THREE.Object3D[]; mesh?: THREE.InstancedMesh }>();
  // patas
  private legs: { f: number; delantera: boolean; lado: number; fase: number; brazo: THREE.Mesh; ante: THREE.Mesh; mano: THREE.Mesh; hombro: THREE.Mesh; codo: THREE.Mesh; dedos: THREE.Object3D[]; unas: THREE.Object3D[]; mechon: THREE.Object3D[] }[] = [];
  // cabeza
  private head = new THREE.Group(); private jaw = new THREE.Group(); private mane: THREE.Object3D[] = []; private whiskers: THREE.Mesh[] = []; private ojos: THREE.Group[] = []; private bigotes: THREE.Vector3[][] = []; private tPrev = 0; private tBig = 0; private roll = new Float32Array(N + 1); private frame = 0; private ultimaCabeza = new THREE.Vector3(1e9, 0, 0);
  private tongue = new THREE.Group();
  // la piel de la cabeza, que en la nuca se dobla con el cuello (ver `doblarNuca`)
  private nuca!: { geo: THREE.BufferGeometry; base: Float32Array };
  private pielMat!: THREE.ShaderMaterial;
  // La piel del cuerpo en una superficie esculpida (cabeza, mandíbula): las mismas escamas, que siguen sin corte desde el
  // cuello (Eze vio el "corte" donde cambiaba el dibujo): aS es la distancia detrás del frente del cuello, en largos
  // del cuerpo (la que tendría ese punto en el tubo), aA la vuelta alrededor (0 el lomo, .5 el vientre, como el tubo),
  // aV cuánto vientre (las placas claras), que se apaga hacia el hocico.
  private conPiel(g: THREE.BufferGeometry, desde: number, vientre: (x: number) => number){
    const pos = g.attributes.position as THREE.BufferAttribute, uv = g.attributes.uv as THREE.BufferAttribute, n = pos.count;
    const aS = new Float32Array(n), aA = new Float32Array(n), aV = new Float32Array(n);
    for(let k = 0; k < n; k++){ const x = pos.getX(k); aS[k] = (desde - x)*S/L; aA[k] = uv.getY(k); aV[k] = vientre(x); }
    g.setAttribute('aS', new THREE.BufferAttribute(aS, 1)); g.setAttribute('aA', new THREE.BufferAttribute(aA, 1)); g.setAttribute('aV', new THREE.BufferAttribute(aV, 1));
    return g;
  }
  private pearl = new THREE.Group(); private pearlFlames: THREE.Object3D[] = []; private halo!: THREE.Sprite; private chispas!: THREE.Points;
  // una pieza de una clase instanciada, colgada de `padre`
  private pieza(clase: string, geo: THREE.BufferGeometry, mat: THREE.Material, padre: THREE.Object3D){
    const e = this.inst.get(clase) ?? this.inst.set(clase, { geo, mat, piezas: [] }).get(clase)!;
    const o = new THREE.Object3D(); e.piezas.push(o); padre.add(o); return o;
  }
  private E: typeof ESTILOS.chino; private G: number; private P: number;
  constructor(readonly estilo: Estilo = 'chino'){
    this.E = ESTILOS[estilo]; this.G = GROSOR*this.E.grosor; this.P = PATA*this.E.pata;
    const J = estilo === 'japones';
    const mat = <T extends THREE.ShaderMaterial | THREE.MeshBasicMaterial>(m: T) => { this.mats.push(m); return m; };
    // ── el cuerpo: un tubo de N+1 anillos de M lados
    const verts = (N + 1)*(M + 1);
    this.bodyPos = new Float32Array(verts*3); this.bodyNor = new Float32Array(verts*3);
    const aS = new Float32Array(verts), aA = new Float32Array(verts), idx: number[] = [];
    for(let i = 0; i <= N; i++) for(let j = 0; j <= M; j++){ const k = i*(M + 1) + j; aS[k] = i/N; aA[k] = j/M; }
    for(let i = 0; i < N; i++) for(let j = 0; j < M; j++){
      const a = i*(M + 1) + j, b = a + M + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.bodyPos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(this.bodyNor, 3));
    geo.setAttribute('aS', new THREE.BufferAttribute(aS, 1)); geo.setAttribute('aA', new THREE.BufferAttribute(aA, 1));
    geo.setAttribute('aV', new THREE.BufferAttribute(new Float32Array(verts).fill(1), 1));
    geo.setIndex(idx);
    const piel = this.pielMat = mat(new THREE.ShaderMaterial({ vertexShader: PIEL_VERT, fragmentShader: PIEL_FRAG, transparent: true,
      uniforms: { uCuerpo: { value: new THREE.Color(C.cuerpo) }, uLuz: { value: new THREE.Color(C.luz) }, uVientre: { value: new THREE.Color(C.vientre) }, uPlaca: { value: new THREE.Color(C.placa) }, uOpacity: { value: 1 } } }));
    this.body = new THREE.Mesh(geo, piel);
    this.body.frustumCulled = false;
    this.mesh.add(this.body);

    // la llama: no un plano, una lengua de fuego que se curva hacia atrás a lo largo y se ahueca a lo ancho, así no
    // desaparece cuando se la ve de canto
    const plano = new THREE.PlaneGeometry(1, 1, 4, 10); plano.translate(0, .5, 0); // la base en el origen, la punta hacia +y
    { const pp = plano.attributes.position as THREE.BufferAttribute;
      for(let v = 0; v < pp.count; v++){ const x = pp.getX(v), y = pp.getY(v); pp.setZ(v, -.35*y*y + .22*x*x); }
      plano.computeVertexNormals(); }
    const llamaMat = (tex: THREE.Texture) => mat(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, color: new THREE.Color(.86, .86, .86) }));
    const LL: Record<string, THREE.MeshBasicMaterial> = { rojo: llamaMat(texturaLlama('#b8241a', '#ff6a3a')), naranja: llamaMat(texturaLlama('#e8432e', '#ffc06a')), clara: llamaMat(texturaLlama('#ff8a4a', '#fff0c0')) };
    const rojo = 'rojo', naranja = 'naranja', clara = 'clara';
    const carta = (tipo: string, padre: THREE.Object3D = this.mesh) => this.pieza('llama-' + tipo, plano, LL[tipo], padre);
    // aletas del lomo y la cola en llama
    for(let i = 6; i < N - 6; i += 3) this.fins.push(carta(rojo));
    for(let j = 0; j < 7; j++) this.tail.push(carta(j % 2 ? naranja : clara));

    // ── patas: brazo y antebrazo (cilindros que se afinan), mano, cinco dedos con su uña, mechón de llama en el codo
    const azul = mat(pintura(C.cuerpo, .35, false, .4, 30, 26)), azulLejos = mat(pintura(0x2f86bd, .35, false, .4, 30, 26)), unaMat = mat(pintura(C.cuerno, .15, false, .9, 70)); // uñas pulidas
    const cil = (r0: number, r1: number) => { const g = new THREE.CylinderGeometry(r1, r0, 1, 10); g.translate(0, .5, 0); return g; }; // de la base (y=0) a la punta (y=1)
    const dedoGeo = cil(1, .8), unaGeo = new THREE.ConeGeometry(1, 1, 10, 6); unaGeo.translate(0, .5, 0);
    { // la uña, curva en gancho (como la de un águila): se dobla hacia -x a medida que sube
      const up = unaGeo.attributes.position as THREE.BufferAttribute;
      for(let v = 0; v < up.count; v++){ const y = up.getY(v); up.setX(v, up.getX(v) - .55*y*y); }
      unaGeo.computeVertexNormals(); }
    for(const [f, delantera, fase] of [[.15, true, 0], [.4, false, .5]] as [number, boolean, number][]) for(const lado of [1, -1]){
      const m = lado > 0 ? azul : azulLejos, g = this.G*perfil(f)/2;
      // el brazo nace grueso, dentro de la masa del hombro (o del anca), y se afina; el codo, redondeado
      const brazo = new THREE.Mesh(cil(g*.62, g*.3), m), ante = new THREE.Mesh(cil(g*.3, g*.2), m), mano = new THREE.Mesh(new THREE.SphereGeometry(g*.24, 10, 8), m);
      const hombro = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), m), codo = new THREE.Mesh(new THREE.SphereGeometry(g*.31, 12, 8), m);
      const dedos: THREE.Object3D[] = [], unas: THREE.Object3D[] = [], mechon: THREE.Object3D[] = [];
      for(let k = 0; k < this.E.garras + (this.E.espolon ? 1 : 0); k++){ // el último es el espolón; radio 1, se escalan al grosor de la pata
        const d = this.pieza(lado > 0 ? 'dedo' : 'dedoLejos', dedoGeo, m, this.mesh), u = this.pieza('una', unaGeo, unaMat, this.mesh);
        d.userData.r = g*(J ? .1 : .085); u.userData.r = g*(J ? .085 : .07);
        dedos.push(d); unas.push(u);
      }
      for(let k = 0; k < 3; k++) mechon.push(carta(rojo));
      this.mesh.add(brazo, ante, mano, hombro, codo);
      this.legs.push({ f, delantera, lado, fase: fase + (lado < 0 ? .5 : 0), brazo, ante, mano, hombro, codo, dedos, unas, mechon });
    }

    // ── la cabeza, por piezas (x adelante, y arriba, z al costado; en largos de cabeza, y la escala S)
    const H = this.head;
    const pieza = (geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rz = 0) => {
      const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); o.rotation.z = rz; return o;
    };
    const esfera = (r: number) => new THREE.SphereGeometry(r, 20, 14);
    const amarillo = mat(pintura(C.hocico, .25, false, .6, 40)), claro = mat(pintura(C.luz, .2)), boca = mat(pintura(C.boca, 0, false, .15, 12)),
      blanco = mat(pintura(C.diente, .1, false, .7, 50)), iris = mat(pintura(C.ojo, .1, false, 1, 90)), negro = mat(pintura(0x120808, 0, false, 1, 90)),
      lengua = mat(pintura(C.lengua, .1, false, .8, 45)), ojoBlanco = mat(pintura(C.diente, .05, false, 1, 90)); // ojos vidriosos, lengua húmeda
    // Cabeza de dragón chino, no de perro (Eze, 2026-11-24: "se parece a la de un perro"): frente baja y plana con
    // crestas, hocico largo y plano que se ensancha en la punta, narinas de león (dos orificios abultados que miran
    // arriba) en vez de una bola, ojos grandes y saltones bajo cejas pesadas en ángulo, orejas de buey hacia atrás,
    // aletas de llama en las mejillas, y una boca larga llena de dientes.
    // La cabeza, una sola piel esculpida (`esculpir`) de la nuca a la punta del hocico: la nuca nace del grosor del cuello
    // (sin escalón), el cráneo bajo con su cresta, los arcos de las cejas y los pómulos, el hocico que se afina y vuelve a
    // ensancharse en la nariz, y abajo la línea recta de la boca (más cuadrada). El ryū, con el hocico más largo y fino.
    // la nuca empieza bien atrás, en el cuello, y crece poco a poco hasta el cráneo (medido: antes se inflaba un 25-40 %
    // en muy poco trecho, y ese "hombro" era el borde que se veía)
    const NUCA = -1.6, rCuello = (x: number) => this.G*perfil((.05 - x)*S/L)/2/S;
    const largo = (x: number) => J && x > .5 ? .5 + (x - .5)*1.12 : x, fino = J ? .88 : 1;
    const CABEZA: Seccion[] = [
      // atrás, el anillo del cuello en cada punto (mismo centro, mismo grosor, un pelo adentro), y de ahí creciendo
      // nace adentro del cuello (más fina) y sale hacia afuera muy de a poco: el cruce con el tubo es casi paralelo
      ...[[NUCA, .9], [-1.32, .985], [-1.06, 1.03], [-.78, 1.06], [-.5, 1.11]].map(([x, g]) => { const r = rCuello(x)*g; return { x, cy: Math.max(0, g - 1)*.3, w: r, top: r*1.05, bot: r*1.05, cuello: true }; }),
      { x: -.26, cy: .07,  w: .26, top: .26, bot: .27, cresta: .015 },
      // la cara: pómulos marcados detrás y debajo del ojo, una zona hundida entre el pómulo y el hocico, y el labio de
      // arriba que sobresale por encima de la mandíbula a lo largo de la boca (Eze: la boca era plana, muy redonda)
      { x: -.08, cy: .13,  w: .28, top: .28, bot: .29, pt: 2.05, cresta: .025, pomulo: .02 },
      { x: .1,   cy: .21,  w: .3,  top: .28, bot: .28, pt: 2.15, pb: 2.1, cresta: .03, ceja: .02, pomulo: .09 },
      { x: .34,  cy: .24,  w: .27, top: .25, bot: .2,  pt: 2.3, pb: 2.5, cresta: .02, ceja: .06, pomulo: .1, labio: .025 },
      { x: .52,  cy: .235, w: .21, top: .2,  bot: .16, pt: 2.4, pb: 3,   cresta: .018, ceja: .04, pomulo: -.03, labio: .038 },
      { x: .7,   cy: .22,  w: .17, top: .15, bot: .13, pt: 2.6, pb: 3.6, cresta: .03, pomulo: -.035, labio: .045 },
      { x: .95,  cy: .21,  w: .165, top: .13, bot: .12, pt: 2.8, pb: 4,  cresta: .025, pomulo: -.02, labio: .048 },
      { x: 1.18, cy: .215, w: .185, top: .13, bot: .125, pt: 2.8, pb: 4, cresta: .015, labio: .05 },
      { x: 1.34, cy: .225, w: .2,  top: .13, bot: .12, pt: 2.6, pb: 3.4, labio: .035 },
      { x: 1.46, cy: .23,  w: .15, top: .1,  bot: .1,  pt: 2.3, pb: 2.8, labio: .015 },
      { x: 1.53, cy: .23,  w: .05, top: .04, bot: .04 },
    ].map(q => {
      // la nuca, del grosor de su propio cuello (el ryū es más delgado): de ese grosor atrás al de la cabeza en el cráneo
      const k = 'cuello' in q ? 1 : 1 + (this.E.grosor - 1)*Math.min(1, Math.max(0, (.25 - q.x)/.6));
      return { ...q, x: largo(q.x), w: q.w*k*(q.x > .5 ? fino : 1), top: q.top*k, bot: q.bot*k, cy: q.cy*(q.x < .1 ? k : 1) };
    });
    { const piel = new THREE.Mesh(this.conPiel(esculpir(CABEZA, 64, 36), .05, x => 1 - suave(lim((x + .1)/.4, 0, 1))), this.pielMat); piel.userData.vivo = true; piel.frustumCulled = false; H.add(piel);
      this.nuca = { geo: piel.geometry, base: (piel.geometry.attributes.position.array as Float32Array).slice() }; }
    if(!J){
      for(const z of [.085, -.085]){                                         // narinas de león: abultadas, mirando arriba
        H.add(pieza(esfera(.075), amarillo, 1.3, .34, z, 1.15, .85, 1));
        const hueco = pieza(esfera(.032), boca, 1.33, .4, z*1.05, 1, .55, 1); H.add(hueco);
        const borde = pieza(new THREE.TorusGeometry(.04, .014, 6, 14), amarillo, 1.33, .395, z*1.05); borde.rotation.x = Math.PI/2; H.add(borde);
      }
      for(const z of [.21, -.21]){
        // el ojo, aparte (no se funde): grande y saltón; parpadea
        const ojo = new THREE.Group(); ojo.position.set(.44, .42, z*1.12);
        ojo.add(pieza(esfera(.1), ojoBlanco, 0, 0, 0));
        ojo.add(pieza(esfera(.06), iris, .045, .01, z*.25));
        ojo.add(pieza(esfera(.034), negro, .06, .01, z*.38));
        ojo.add(pieza(esfera(.014), blanco, .035, .045, z*.45));
        // el párpado de arriba, caído sobre el tercio de arriba del ojo: la mirada feroz
        // el párpado de arriba, amarillo, que tapa casi la mitad de arriba del ojo (Eze: más caricaturesco)
        const parp = pieza(new THREE.SphereGeometry(.116, 20, 10, 0, TAU, 0, 1.3), amarillo, 0, 0, 0); parp.rotation.z = -.38; ojo.add(parp);
        this.ojos.push(ojo); H.add(ojo);
        H.add(this.cejaArco(z > 0 ? 1 : -1, amarillo, 1));
      }
    } else {
      // el ryū: hocico largo y fino, punta estrecha, narinas pequeñas, ojos algo menores bajo cejas finas y largas,
      // crestas en la frente, orejas pequeñas
      for(const z of [.06, -.06]){
        H.add(pieza(esfera(.045), amarillo, 1.58, .31, z, 1.3, .8, 1));
        H.add(pieza(esfera(.022), boca, 1.61, .34, z*1.05, 1, .6, 1));
      }
      for(const z of [.19, -.19]){
        const ojo = new THREE.Group(); ojo.position.set(.46, .38, z*1.08);
        ojo.add(pieza(esfera(.085), ojoBlanco, 0, 0, 0));
        ojo.add(pieza(esfera(.052), iris, .04, .01, z*.26));
        ojo.add(pieza(esfera(.03), negro, .052, .01, z*.38));
        ojo.add(pieza(esfera(.012), blanco, .03, .04, z*.45));
        const parp = pieza(new THREE.SphereGeometry(.098, 20, 10, 0, TAU, 0, 1.25), amarillo, 0, 0, 0); parp.rotation.z = -.32; ojo.add(parp);
        this.ojos.push(ojo); H.add(ojo);
        H.add(this.cejaArco(z > 0 ? 1 : -1, amarillo, .86, .9));
      }
    }
    H.add(pieza(esfera(.2), boca, J ? .8 : .68, .08, 0, J ? 3.4 : 2.9, .3, J ? .56 : .66)); // el interior de la boca, largo
    const largoBoca = J ? 1.2 : 1, anchoBoca = J ? .82 : 1;
    for(let k = 0; k < 6; k++) for(const z of [.13, -.13]){                // dientes de arriba, a lo largo de la boca
      const d = pieza(new THREE.ConeGeometry(.024, .09, 6), blanco, (.5 + k*.13)*largoBoca, .07, z*(1.05 - k*.07)*anchoBoca); d.rotation.z = Math.PI; H.add(d);
    }
    for(const z of [.14, -.14]){ const c = pieza(new THREE.ConeGeometry(.036, .22, 8), blanco, 1.08*largoBoca, .05, z*.9*anchoBoca); c.rotation.z = Math.PI - .12; H.add(c); } // colmillos de adelante
    // la mandíbula, que gira sobre su bisagra: larga, como el hocico
    this.jaw.position.set(.2, .02, 0);
    // una sola pieza esculpida: el borde de arriba plano (la línea de la boca), redondeada abajo, afinándose hacia el
    // mentón, que vuelve a ensancharse un poco, como la punta del hocico
    this.jaw.add(new THREE.Mesh(esculpir([
      // atrás, los carrillos donde se articula; a lo largo, el labio de abajo; el mentón, firme
      { x: -.12, cy: -.07, w: .24, top: .07, bot: .16, pt: 3,   pb: 2.2, pomulo: .035 },
      { x: .2,   cy: -.07, w: .2,  top: .055, bot: .13, pt: 3.5, pb: 2.4, pomulo: .02, labioSup: .022 },
      { x: .5,   cy: -.065, w: .165, top: .045, bot: .105, pt: 4, pb: 2.6, labioSup: .026 },
      { x: .78,  cy: -.065, w: .145, top: .04, bot: .09, pt: 4,  pb: 2.6, labioSup: .026 },
      { x: .98,  cy: -.07, w: .16, top: .04, bot: .095, pt: 3.5, pb: 2.6, labioSup: .02 },
      { x: 1.1,  cy: -.065, w: .1,  top: .03, bot: .055 },
      { x: 1.15, cy: -.065, w: .03, top: .01, bot: .02 },
    ], 40, 28).applyMatrix4(new THREE.Matrix4()), azul));
    { // la mandíbula, con la misma piel y las placas claras debajo (como el vientre), hasta el mentón
      const m = this.jaw.children[this.jaw.children.length - 1] as THREE.Mesh;
      m.geometry = this.conPiel(m.geometry, -.15, x => .85 - .35*suave(lim((x - .6)/.5, 0, 1)));
      m.material = this.pielMat; m.userData.vivo = true; }
    for(const z of [.13, -.13]){ const c = pieza(new THREE.ConeGeometry(.032, .18, 8), blanco, .92, .0, z); c.rotation.z = -.1; this.jaw.add(c); } // colmillos de abajo
    for(let k = 0; k < 5; k++) for(const z of [.11, -.11]) this.jaw.add(pieza(new THREE.ConeGeometry(.022, .08, 6), blanco, .4 + k*.12, .0, z*(1.05 - k*.06)));
    if(J) this.jaw.scale.set(1.18, .85, .85);   // más larga y fina, como el hocico
    fusionar(this.jaw);
    // la lengua: sale un poco y se enrosca hacia abajo
    const lc = new THREE.CatmullRomCurve3([new THREE.Vector3(.35, 0, 0), new THREE.Vector3(.85, -.02, 0), new THREE.Vector3(1.18, -.14, 0), new THREE.Vector3(1.27, -.05, 0), new THREE.Vector3(1.2, .0, 0)]);
    this.tongue.add(new THREE.Mesh(new THREE.TubeGeometry(lc, 24, .024, 6), lengua));
    this.jaw.add(this.tongue);
    // Los cuernos: astas de ciervo (una de las «nueve semejanzas»), no tubos con gancho (Eze, 2026-11-24: no
    // convencían). Gruesas en la base y afinándose hasta la punta, barridas hacia atrás y abiertas hacia los costados,
    // siguiendo la línea de la melena y del vuelo, con tres ramas que suben hacia adelante, y un anillo rugoso donde nacen.
    const hueso = mat(pintura(0xf0ad32, .2, false, .6, 36)); // dorado cálido, pulido
    const v3 = (p: number[]) => new THREE.Vector3(p[0], p[1], p[2]);
    for(const z of [.16, -.16]){
      if(J){ // el ryū: astas largas y finas, barridas hacia atrás casi a ras del cuello, con una sola rama
        const asta = new THREE.CatmullRomCurve3([[.1, .46, z*.9], [-.04, .66, z*1.1], [-.4, .82, z*1.3], [-.9, .88, z*1.48], [-1.45, .82, z*1.6], [-1.8, .72, z*1.65]].map(v3));
        H.add(new THREE.Mesh(tuboAfinado(asta, 32, 10, .05, .008), hueso));
        H.add(pieza(new THREE.TorusGeometry(.054, .018, 8, 16), hueso, .09, .48, z*.9).rotateX(Math.PI/2).rotateY(.4));
        const o = asta.getPointAt(.3), f = z > 0 ? 1 : -1;
        H.add(new THREE.Mesh(tuboAfinado(new THREE.CatmullRomCurve3([o, o.clone().add(new THREE.Vector3(.02, .18, f*.05)), o.clone().add(new THREE.Vector3(.1, .3, f*.08))]), 12, 8, .026, .006), hueso));
        continue;
      }
      const asta = new THREE.CatmullRomCurve3([[.14, .5, z], [.04, .74, z*1.22], [-.2, .94, z*1.5], [-.5, 1.04, z*1.78], [-.8, 1.02, z*1.95], [-1.02, .94, z*2.02]].map(v3));
      H.add(new THREE.Mesh(tuboAfinado(asta, 28, 10, .062, .012), hueso));
      H.add(pieza(new THREE.TorusGeometry(.066, .022, 8, 16), hueso, .13, .52, z).rotateX(Math.PI/2).rotateY(.4)); // el anillo rugoso de la base
      // las ramas: nacen del asta y suben hacia adelante, cada una más corta
      for(const [t, largo, abre] of [[.3, .3, .2], [.55, .26, .28], [.78, .2, .34]] as [number, number, number][]){
        const o = asta.getPointAt(t), f = z > 0 ? 1 : -1;
        const rama = new THREE.CatmullRomCurve3([o, o.clone().add(new THREE.Vector3(.04, largo*.55, f*abre*.25)), o.clone().add(new THREE.Vector3(.1, largo, f*abre*.45))]);
        H.add(new THREE.Mesh(tuboAfinado(rama, 12, 8, .034 - t*.012, .008), hueso));
      }
    }
    fusionar(H); // las piezas fijas de la cabeza: una malla por material
    H.add(this.jaw);
    // melena de llamas alrededor de la nuca, en dos capas, hacia atrás; y la barba bajo la mandíbula
    const capas = J ? [[0, 12, .95, .22, rojo], [1, 9, .75, .18, naranja], [2, 6, .5, .14, clara]] : [[0, 16, .62, .26, rojo], [1, 13, .48, .22, naranja], [2, 9, .34, .17, clara]];
    for(const [capa, n, largo, radio, color] of capas as [number, number, number, number, string][])
      for(let k = 0; k < n; k++){
        const f = carta(color, H), a = (((k*.618 + capa*.31) % 1) - .5)*2.3; // repartidas por arriba y los costados altos
        f.userData = { a, l: largo + (k % 3)*.12, r: radio, capa, k: k/n };
        this.mane.push(f);
        // cada crin, dos láminas cruzadas: de canto una lámina sola se volvía una línea y parecía desaparecer
        const g = carta(color, H); g.userData = { ...f.userData, cruz: true }; this.mane.push(g);
      }
    for(let k = 0; k < 4; k++){ const f = carta(k % 2 ? naranja : rojo, this.jaw); f.userData = { barba: k, larga: J ? 1.6 : 1 }; this.mane.push(f); }
    for(const z of [1, -1]) for(let k = 0; k < 3; k++){ const f = carta(k % 2 ? naranja : rojo, H); f.userData = { mejilla: k, z }; this.mane.push(f); } // aletas de llama en las mejillas
    // las crines: desde las mejillas y el ángulo de la mandíbula, barridas hacia atrás sobre el cuello, tapando la unión
    // de la cabeza con el cuerpo (como en la referencia de Eze)
    for(const z of [1, -1]) for(let k = 0; k < 8; k++) for(const cruz of [false, true]){ const f = carta(k % 3 === 0 ? naranja : clara, H); f.userData = { crin: k, z, cruz }; this.mane.push(f); }
    this.head.scale.setScalar(S);
    this.mesh.add(this.head);
    // bigotes: los rehace cada tanto, ondeando
    for(let k = 0; k < 2; k++){ const w = new THREE.Mesh(new THREE.BufferGeometry(), amarillo); this.whiskers.push(w); this.mesh.add(w); }

    // ── la perla en llamas
    const perla = new THREE.Mesh(esfera(.42), mat(new THREE.MeshBasicMaterial({ color: new THREE.Color(.95, .92, .82), transparent: true })));
    this.pearl.add(perla);
    for(let k = 0; k < 8; k++){ const f = carta(k % 2 ? naranja : clara, this.pearl); f.scale.set(.6, 1.3, 1); this.pearlFlames.push(f); }
    // su resplandor (un halo que late) y las chispas de fuego que se desprenden hacia atrás
    const halo = document.createElement('canvas'); halo.width = halo.height = 128;
    { const c = halo.getContext('2d')!, g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,240,200,.9)'); g.addColorStop(.25, 'rgba(255,170,80,.45)'); g.addColorStop(1, 'rgba(255,90,30,0)');
      c.fillStyle = g; c.fillRect(0, 0, 128, 128); }
    const haloTex = new THREE.CanvasTexture(halo);
    this.halo = new THREE.Sprite(mat(new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(.85, .85, .85) })) as unknown as THREE.SpriteMaterial);
    this.pearl.add(this.halo);
    const nCh = 70, chPos = new Float32Array(nCh*3), chCol = new Float32Array(nCh*3);
    const chGeo = new THREE.BufferGeometry();
    chGeo.setAttribute('position', new THREE.BufferAttribute(chPos, 3)); chGeo.setAttribute('color', new THREE.BufferAttribute(chCol, 3));
    this.chispas = new THREE.Points(chGeo, mat(new THREE.PointsMaterial({ size: .5, map: haloTex, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })) as unknown as THREE.PointsMaterial);
    this.chispas.frustumCulled = false; this.chispas.renderOrder = 3; this.halo.renderOrder = 3;
    this.mesh.add(this.pearl, this.chispas);

    for(let i = 0; i <= N; i++){ this.T.push(new THREE.Vector3()); this.U.push(new THREE.Vector3()); this.Sd.push(new THREE.Vector3()); }
    for(const e of this.inst.values()){
      e.mesh = new THREE.InstancedMesh(e.geo, e.mat, e.piezas.length);
      e.mesh.frustumCulled = false;
      // Las llamas (melena, crines, aletas, cola, barba) se dibujan después de todo lo sólido. Todo el dragón es
      // semitransparente (para aparecer y desvanecerse), y en ese pase three.js ordena por distancia de cada malla: según
      // se movía el cuello, el cuerpo a veces se pintaba después y borraba las crines que tenía delante (las llamas no
      // escriben profundidad). Medido en la mesa: uno de cada cinco cuadros perdía más del 15 % de la melena.
      if(e.mat instanceof THREE.MeshBasicMaterial) e.mesh.renderOrder = 2;
      this.mesh.add(e.mesh);
    }
    this.mesh.visible = false;
  }

  get position(){ return this.head.position; }

  // la columna: N+1 puntos a lo largo de la historia de la cabeza, cada L/N, más la onda que recorre el cuerpo
  private columna(t: number, llenar: (out: THREE.Vector3[], paso: number) => void){
    llenar(this.spine, L/N);
    // marcos: adelante (hacia la cabeza), arriba (el lomo, hacia el cielo) y el costado
    this.marcos();
    // cuánto gira el recorrido en cada punto (antes de la onda): el cuerpo se inclina hacia la curva, como un avión
    const dt = lim(t - this.tPrev, 0, .1); this.tPrev = t;
    const giro = new Float32Array(N + 1);
    for(let i = 0; i <= N; i++){
      const a = this.T[Math.max(0, i - 4)], b = this.T[Math.min(N, i + 4)];
      giro[i] = lim((a.x - b.x)*this.Sd[i].x + (a.y - b.y)*this.Sd[i].y + (a.z - b.z)*this.Sd[i].z, -1, 1)*2.4;
    }
    // la onda: de lado y arriba-abajo, pequeña en el cuello y cada vez más amplia hacia la cola
    const k2 = TAU/(L*this.E.ondaL), w = t*2.2, G = this.G*this.E.ondaA;
    for(let i = 1; i <= N; i++){
      const s = i/N*L, env = suave(lim(i/(N*.3), 0, 1))*(1 - .3*i/N);
      this.spine[i].addScaledVector(this.Sd[i], Math.sin(k2*s - w)*G*.9*env).addScaledVector(this.U[i], Math.sin(k2*s - w + 1.7)*G*.55*env);
    }
    this.marcos(); // de nuevo, sobre la columna ondulada
    // la inclinación: suavizada a lo largo del cuerpo y en el tiempo, y aplicada girando el lomo alrededor del eje
    for(let i = 0; i <= N; i++){
      let m = 0, n = 0;
      for(let j = Math.max(0, i - 5); j <= Math.min(N, i + 5); j++){ m += giro[j]; n++; }
      const meta = lim(m/n, -.6, .6);
      this.roll[i] += (meta - this.roll[i])*(dt > 0 ? 1 - Math.exp(-dt*3) : 1);
      const r = this.roll[i], c = Math.cos(r), sn = Math.sin(r), U = this.U[i].clone(), Sd = this.Sd[i];
      this.U[i].multiplyScalar(c).addScaledVector(Sd, sn);
      this.Sd[i].multiplyScalar(c).addScaledVector(U, -sn);
    }
  }
  // Los marcos, a prueba de NaN: si el cuerpo queda casi vertical (subiendo o bajando a pique), proyectar el "arriba" del
  // mundo da un vector nulo, y un solo NaN en la geometría deja la pantalla entera en negro (el bloom lo desparrama;
  // pasó grabando el video). Entonces se usa el "arriba" del segmento anterior, o el del cuadro anterior.
  private marcos(){
    const up = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3();
    for(let i = 0; i <= N; i++){
      const a = this.spine[Math.max(0, i - 1)], b = this.spine[Math.min(N, i + 1)];
      tmp.copy(a).sub(b);
      if(tmp.lengthSq() > 1e-10) this.T[i].copy(tmp).normalize();
      else if(i) this.T[i].copy(this.T[i - 1]);
      const ref = i ? this.U[i - 1] : (this.U[0].lengthSq() > .5 ? this.U[0] : up);
      tmp.copy(up).addScaledVector(this.T[i], -up.dot(this.T[i]));
      if(tmp.lengthSq() < .01) tmp.copy(ref).addScaledVector(this.T[i], -ref.dot(this.T[i]));
      if(tmp.lengthSq() < 1e-6) tmp.set(1, 0, 0).addScaledVector(this.T[i], -this.T[i].x);
      this.U[i].copy(tmp.normalize());
      this.Sd[i].crossVectors(this.T[i], this.U[i]).normalize();
    }
  }

  private dibujarCuerpo(t: number){
    const p = this.bodyPos, n = this.bodyNor, dir = new THREE.Vector3();
    for(let i = 0; i <= N; i++){
      // respira (el pecho se infla); y bajo la cabeza, desde la nuca hacia adelante, el tubo se mete adentro de la piel
      // de la cabeza, así no se cruzan dos superficies (dibujaban un borde): sólo se ve la piel continua
      // el tubo se mete de a poco, a lo largo de todo el tramo donde la piel de la cabeza crece (antes, de golpe)
      const xc = .05 - i/N*L/S;                                       // dónde cae este anillo en la cabeza
      const dentro = 1 - .1*suave(lim((xc + 1.25)/.4, 0, 1)) - .18*suave(lim((xc + .85)/.5, 0, 1));
      const r = this.G*perfil(i/N)/2*(1 + .05*Math.sin(t*1.6)*bulto(i/N, .16, 1, .1))*dentro;
      for(let j = 0; j <= M; j++){
        const a = j/M*TAU, k = (i*(M + 1) + j)*3;
        dir.copy(this.U[i]).multiplyScalar(Math.cos(a)).addScaledVector(this.Sd[i], Math.sin(a));
        p[k] = this.spine[i].x + dir.x*r; p[k+1] = this.spine[i].y + dir.y*r*1.05; p[k+2] = this.spine[i].z + dir.z*r;
        n[k] = dir.x; n[k+1] = dir.y; n[k+2] = dir.z;
      }
    }
    (this.body.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (this.body.geometry.attributes.normal as THREE.BufferAttribute).needsUpdate = true;
    // aletas: de pie sobre el lomo, inclinadas hacia la cola, meciéndose
    // aletas: de pie sobre el lomo (en el plano del cuerpo, de perfil se ven enteras), inclinadas hacia la cola
    this.fins.forEach((f, j) => {
      const i = 6 + j*3, r = this.G*perfil(i/N)/2, h = r*(1.3 + .4*Math.sin(i*1.7))*this.E.aletas;
      f.position.copy(this.spine[i]).addScaledVector(this.U[i], r*.85);
      const inclina = this.U[i].clone().multiplyScalar(.75).addScaledVector(this.T[i], -.55 - .15*Math.sin(t*6 - i*.3));
      orienta(f, inclina, this.T[i]); f.scale.set(r*1.1, h, 1);
    });
    // la cola en llama: un abanico hacia atrás, en el plano vertical del cuerpo
    this.tail.forEach((f, j) => {
      const a = (j - 3)*.28 + Math.sin(t*7 + j)*.12;
      const d = this.T[N].clone().negate().applyAxisAngle(this.Sd[N], a);
      f.position.copy(this.spine[N]);
      orienta(f, d, this.U[N]); f.scale.set(.9, 2.2 + (j % 3)*.6, 1);
    });
  }

  // patas: postura de vuelo casi quieta, con balanceo y el gesto de alcanzar la perla (cada ~13 s)
  private dibujarPatas(t: number){
    const Y = new THREE.Vector3(0, 1, 0);
    const pon = (o: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, r = 1) => { // un cilindro de a hasta b (de radio r si es de radio 1)
      const d = b.clone().sub(a), l = d.length() || 1e-3;
      o.position.copy(a); o.quaternion.setFromUnitVectors(Y, d.divideScalar(l)); o.scale.set(r, l, r);
    };
    const ciclo = 13, uu = (t % ciclo)/ciclo;
    for(const lg of this.legs){
      const i = Math.round(lg.f*N), g = this.G*perfil(lg.f)/2, T = this.T[i], U = this.U[i], Sd = this.Sd[i];
      const PATA = this.P, GARRAS = this.E.garras, a = PATA*.53, b = PATA*.47, R = a + b;
      // la masa del hombro (o del anca): un óvalo a lo largo del cuerpo, pegado al costado y asomando un poco hacia abajo,
      // que funde la pata con el cuerpo; el brazo nace adentro de ella
      const centro = this.spine[i].clone().addScaledVector(U, -g*.22).addScaledVector(Sd, g*.42*lg.lado).addScaledVector(T, lg.delantera ? g*.1 : -g*.15);
      lg.hombro.position.copy(centro);
      lg.hombro.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(T, U, Sd));
      lg.hombro.scale.set(g*(lg.delantera ? 1.15 : 1.3), g*.82, g*.66);
      const A = this.spine[i].clone().addScaledVector(U, -g*.48).addScaledVector(Sd, g*.55*lg.lado);
      // el gesto: entre el 55 y el 95 % de cada ciclo, dos alcances (la pata del otro lado, un poco desfasada)
      let e = 0, fase = 0;
      if(uu > .55 && uu < .95){ const qq = (uu - .55)/.4; e = Math.pow(Math.sin(qq*Math.PI), 2); fase = qq*TAU*2 - (lg.lado < 0 ? .6 : 0); }
      const alc = e*(.5 - .5*Math.cos(fase)), r = Math.sin(t*2.6 + lg.fase*TAU);
      let fx = lg.delantera ? (.62 + .04*r + .3*alc)*R : (-.86 - .02*r + .1*alc)*R;
      let fy = lg.delantera ? (-.5 + .04*r + .42*alc)*R : (-.26 + .02*r - .12*alc)*R;
      let d = Math.hypot(fx, fy); if(d > R*.98){ fx *= R*.98/d; fy *= R*.98/d; d = R*.98; }
      const th = Math.atan2(fy, fx), al = Math.acos(lim((a*a + d*d - b*b)/(2*a*d), -1, 1));
      const ang = lg.delantera ? th - al : th + al;
      const side = Sd.clone().multiplyScalar(g*.25*lg.lado);
      const E = A.clone().addScaledVector(T, Math.cos(ang)*a).addScaledVector(U, Math.sin(ang)*a).add(side);
      const F = A.clone().addScaledVector(T, fx).addScaledVector(U, fy).add(side.clone().multiplyScalar(1.6));
      pon(lg.brazo, A, E); pon(lg.ante, E, F); lg.mano.position.copy(F); lg.codo.position.copy(E);
      // garras: abiertas al estirarse (y siempre las delanteras en vuelo), cerradas en las traseras
      const abierta = lg.delantera ? (e > .02 ? .25 + .7*alc : .85) : .2;
      const base = lg.delantera ? -.45 + .5*alc : Math.PI + .25, abre = (.16 + .3*abierta)*(GARRAS < 5 ? 1.5 : 1), dobla = .25 + (1 - abierta)*1.05;
      lg.dedos.forEach((dd, k) => {
        const espolon = k === GARRAS, lado = espolon ? 0 : k - (GARRAS - 1)/2;
        const an = espolon ? base + Math.PI*.82 : base + lado*abre*.6;
        const abanico = Sd.clone().multiplyScalar(espolon ? 0 : lado*.25*abierta);
        const dir = T.clone().multiplyScalar(Math.cos(an)).addScaledVector(U, Math.sin(an)).add(abanico).normalize();
        const largo = (espolon ? .14 : .2 - Math.abs(lado)*.02)*PATA;
        const J = F.clone().addScaledVector(dir, largo);
        pon(dd, F, J, dd.userData.r);
        const dirU = T.clone().multiplyScalar(Math.cos(an - dobla)).addScaledVector(U, Math.sin(an - dobla)).add(abanico).normalize();
        const u = lg.unas[k]; u.position.copy(J); orienta(u, dirU, U); u.scale.set(u.userData.r*1.15, largo*1.35, u.userData.r*1.15); // el gancho, hacia abajo
      });
      // mechón de llama en el codo, hacia atrás
      lg.mechon.forEach((fl, k) => {
        const atras = T.clone().negate().addScaledVector(U, (k - 1)*.35 + Math.sin(t*8 + k)*.15).normalize();
        fl.position.copy(E);
        orienta(fl, atras, U); fl.scale.set(.5, 1.2 + k*.25, 1);
      });
    }
  }

  // La unión de la cabeza con el cuello (Eze: "se nota el recorte"). La cabeza es rígida y el cuello se curva, así que
  // atrás las dos superficies se cruzaban en ángulo. Ahora la parte de atrás de la piel de la cabeza se dobla con el
  // cuello: cada punto detrás de los ojos se coloca también sobre la columna, a la distancia que le toca detrás de la
  // cabeza (con el marco y la inclinación del cuello en ese punto), y se mezcla con su lugar rígido, del todo en la nuca
  // (donde coincide con el anillo del cuello) y nada a la altura de los ojos.
  // La ceja, estilo caricatura: un arco grueso que abraza el ojo por arriba, grueso adelante (sobre el lagrimal) y
  // afinándose hacia atrás, con la punta levantada. `k` la escala con el ojo, `alto` la baja para el ryū.
  private cejaArco(lado: number, m: THREE.Material, k = 1, alto = 1){
    const z = lado*.235*k/1, v = (x: number, y: number, zz: number) => new THREE.Vector3(x, y*alto, zz);
    const c = new THREE.CatmullRomCurve3([v(.6, .47, z*.8), v(.5, .56, z*1.02), v(.36, .58, z*1.12), v(.22, .58, z*1.12), v(.1, .66, z*1.02), v(.04, .74, z*.92)]);
    return new THREE.Mesh(tuboAfinado(c, 30, 10, .055*k, .01), m);
  }
  private mNuca = new THREE.Matrix4(); private iNuca = new THREE.Matrix4();
  private _v = new THREE.Vector3(); private _r = new THREE.Vector3(); private _P = new THREE.Vector3(); private _U = new THREE.Vector3(); private _Sd = new THREE.Vector3(); private _T = new THREE.Vector3();
  // un punto de la cabeza (en sus coordenadas) llevado a donde lo pone el cuello doblado: lo usan la piel y la melena
  private alCuello(p: THREE.Vector3){
    const x = p.x, w = suave(lim((.2 - x)/.75, 0, 1));             // 0 en los ojos, 1 en el cuello
    if(w <= 0) return p;
    const r = this._r.copy(p).applyMatrix4(this.mNuca);              // su lugar rígido
    const d = (.05 - x)*S, fi = lim(d/(L/N), 0, N - 1), i = Math.floor(fi), f = fi - i;
    const P = this._P.copy(this.spine[i]).lerp(this.spine[i + 1], f);
    const Tv = this._T.copy(this.T[i]).lerp(this.T[i + 1], f).normalize();
    const Uv = this._U.copy(this.U[i]).lerp(this.U[i + 1], f).normalize(), Sv = this._Sd.copy(this.Sd[i]).lerp(this.Sd[i + 1], f).normalize();
    if(d < 0) P.addScaledVector(Tv, -d);                             // delante del primer anillo
    const v = this._v.copy(P).addScaledVector(Uv, p.y*S).addScaledVector(Sv, p.z*S); // su lugar sobre el cuello
    return p.copy(r.lerp(v, w).applyMatrix4(this.iNuca));
  }
  private doblarNuca(){
    const { geo, base } = this.nuca, pos = geo.attributes.position as THREE.BufferAttribute, arr = pos.array as Float32Array;
    this.head.updateMatrix();
    this.mNuca.copy(this.head.matrix); this.iNuca.copy(this.head.matrix).invert();
    const q = new THREE.Vector3();
    for(let k = 0; k < pos.count; k++){
      this.alCuello(q.set(base[k*3], base[k*3 + 1], base[k*3 + 2]));
      arr[k*3] = q.x; arr[k*3 + 1] = q.y; arr[k*3 + 2] = q.z;
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }
  // una crin que nace en `raiz` hacia `d` (en la cabeza), puesta sobre el cuello doblado: no se hunde cuando se dobla
  private crinSobreCuello(f: THREE.Object3D, raiz: THREE.Vector3, d: THREE.Vector3, hint: THREE.Vector3){
    const punta = raiz.clone().addScaledVector(d, .3);
    this.alCuello(raiz); this.alCuello(punta);
    f.position.copy(raiz);
    orienta(f, punta.sub(raiz).normalize(), hint);
  }

  private dibujarCabeza(t: number){
    // estable: mira por la línea del cuello (no del último segmento), así no cabecea
    const Tc = this.spine[0].clone().sub(this.spine[6]).normalize(), up = new THREE.Vector3(0, 1, 0);
    // la perla zigzaguea delante, y la cabeza la sigue con la mirada (hasta un punto: el cuello manda)
    let Uc = up.clone().addScaledVector(Tc, -up.dot(Tc)); if(Uc.lengthSq() < .01) Uc = this.U[0].clone(); Uc.normalize();
    const Sc = new THREE.Vector3().crossVectors(Tc, Uc).normalize();
    const perla = this.spine[0].clone().addScaledVector(Tc, S*this.E.perla).addScaledVector(Sc, Math.sin(t*.8)*S*.55).addScaledVector(Uc, S*.3 + Math.sin(t*1.3)*S*.22);
    const T = Tc.clone().lerp(perla.clone().sub(this.spine[0]).normalize(), .35).normalize();
    let U = up.clone().addScaledVector(T, -up.dot(T));
    if(U.lengthSq() < .01) U = this.U[0].clone().addScaledVector(T, -this.U[0].dot(T)); // a pique: el arriba del cuello
    U.normalize();
    const Sd = new THREE.Vector3().crossVectors(T, U).normalize();
    this.head.position.copy(this.spine[0]).addScaledVector(T, -S*.05);
    this.head.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(T, U, Sd));
    this.doblarNuca();
    const parpado = (t % 4.7) < .14 ? .12 : 1;    // parpadea cada tanto
    for(const o of this.ojos) o.scale.y = parpado;
    const abre = .26 + .06*Math.sin(t*3);
    this.jaw.rotation.z = -abre*1.1;
    this.tongue.rotation.z = Math.sin(t*2.5)*.08;
    // melena: llamas alrededor de la nuca, hacia atrás y hacia afuera, ondeando
    for(const f of this.mane){
      const ud = f.userData as { a?: number; l?: number; barba?: number; r?: number; capa?: number; mejilla?: number; z?: number; larga?: number; crin?: number; k?: number; cruz?: boolean };
      if(ud.crin !== undefined){
        const k = ud.crin, z = ud.z!, fila = k % 4, cap = Math.floor(k/4);
        // escalonadas (no en una misma fila, que dibujaba una línea): cada una nace en otro punto de la mejilla y del
        // costado del cuello, metida en la piel
        const sx = [.2, .1, -.02, -.12, .15, .04, -.07, .26][k], sy = [.2, .12, .17, .08, .05, .14, .03, .11][k];
        this.crinSobreCuello(f, new THREE.Vector3(sx, sy, z*.25), new THREE.Vector3(-1, .08 - fila*.07 + Math.sin(t*3.2 + k*.9)*.07, z*(.32 + cap*.1)).normalize(), new THREE.Vector3(0, 1, 0));
        f.scale.set(.11 - cap*.02, .85 + fila*.1 + cap*.2, 1);
        if(ud.cruz) f.rotateY(Math.PI/2);
        continue;
      }
      if(ud.mejilla !== undefined){ // abanico en la mejilla, hacia atrás y abajo
        const k = ud.mejilla, z = ud.z!;
        f.position.set(.08 - k*.04, .1 - k*.05, z*.27);
        orienta(f, new THREE.Vector3(-1, -.35 - k*.25 + Math.sin(t*5 + k)*.08, z*.35), new THREE.Vector3(0, 1, 0));
        f.scale.set(.13, .32 - k*.05, 1);
        continue;
      }
      if(ud.barba !== undefined){
        const k = ud.barba, d = new THREE.Vector3(-.5, -1, 0).normalize();
        f.position.set(.25 + k*.1, -.2, (k - 1.5)*.05);
        f.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.applyAxisAngle(new THREE.Vector3(0, 0, 1), Math.sin(t*5 + k)*.15));
        f.scale.set(.12, (.3 + (k % 2)*.08)*(ud.larga ?? 1), 1);
        continue;
      }
      // La melena: no un collar en anillo alrededor de la nuca (Eze vio ahí el "recorte": una línea dura de llamas
      // saliendo en todas direcciones en un mismo punto), sino crines que nacen a lo largo de la nuca y la parte alta del
      // cuello, escalonadas hacia atrás, tendidas sobre el lomo y ondeando, como en su referencia.
      const a = ud.a!, l = ud.l!, capa = ud.capa ?? 0, q = (ud as { k?: number }).k ?? 0;
      const J = this.estilo === 'japones';
      const radial = new THREE.Vector3(0, Math.cos(a), Math.sin(a));
      const x = .06 - q*.5 - capa*.05;                                   // de la nuca hacia atrás
      const cy = .06 + (x + .36)*.33, rr = .24*(J ? .85 : 1)*(1 - capa*.04);
      const d = new THREE.Vector3(-1, 0, 0).addScaledVector(radial, (J ? .22 : .32) - capa*.06 + Math.sin(t*(J ? 3 : 4) + a*2 + q*6 + capa)*.08).normalize();
      this.crinSobreCuello(f, new THREE.Vector3(x, cy, 0).addScaledVector(radial, rr), d, new THREE.Vector3(1, 0, 0).cross(radial));
      f.scale.set(J ? .16 : .2, l*(1.15 - q*.35), 1);
      if(ud.cruz) f.rotateY(Math.PI/2);
    }
    // bigotes: desde el hocico, ondeando hacia atrás (en coordenadas del mundo)
    // los bigotes se rehacen cada tres cuadros; si la cabeza saltó (el bucle de la mesa vuelve a empezar), en el acto
    const salto = this.ultimaCabeza.distanceTo(this.head.position) > S; this.ultimaCabeza.copy(this.head.position);
    const dtb = lim(t - this.tBig, 0, .1); this.tBig = t;
    this.whiskers.forEach((w, k) => {
      const z = k ? -.14 : .14, ola = (j: number) => Math.sin(t*4.5 + j + k*1.7);
      const loc = this.estilo === 'japones'
        ? [[1.48, .18, z*.9], [.9, .45 + ola(0)*.15, z*2.4], [-.1, .4 + ola(1)*.25, z*3.6], [-1.0, .6 + ola(2)*.3, z*4.4], [-2.0, .4 + ola(3)*.35, z*4.8], [-2.9, .55 + ola(4)*.35, z*5]]
        : [[1.2, .2, z*1.1], [.7, .5 + ola(0)*.15, z*2.6], [-.2, .5 + ola(1)*.2, z*4], [-.9, .75 + ola(2)*.2, z*5], [-1.6, .5 + ola(3)*.2, z*5.5]];
      const meta = loc.map(([x, y, zz]) => new THREE.Vector3(x, y, zz).multiplyScalar(S).applyQuaternion(this.head.quaternion).add(this.head.position));
      // inercia: cada punto sigue a su lugar con retraso, más hacia la punta
      if(!this.bigotes[k] || salto) this.bigotes[k] = meta.map(p => p.clone());
      else this.bigotes[k].forEach((p, j) => j === 0 ? p.copy(meta[0]) : p.lerp(meta[j], 1 - Math.exp(-dtb*(16 - j*3))));
      if(this.frame % 2 === 0 || salto){
        w.geometry.dispose();
        w.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(this.bigotes[k]), 24, S*.012, 5);
      }
    });
    this.frame++;
    // la perla, delante: flota y sus llamas giran
    this.pearl.position.copy(perla).addScaledVector(Uc, Math.sin(t*4)*.3);
    this.pearlFlames.forEach((f, k) => {
      const a = k/8*TAU + t*2;
      f.position.set(0, 0, 0);
      f.rotation.set(0, 0, a); f.scale.set(.5, 1.1 + .3*Math.sin(t*9 + k), 1);
    });
    this.pearl.quaternion.copy(this.head.quaternion);
    this.halo.scale.setScalar(3.2 + .5*Math.sin(t*3.1) + .25*Math.sin(t*7.3));   // late
    // chispas: cada una nace en la perla y se va hacia atrás y arriba, apagándose; su edad sale del reloj (sin estado:
    // el bucle de la mesa y los videos cuadro por cuadro salen iguales)
    const pa = this.chispas.geometry.attributes.position as THREE.BufferAttribute, ca = this.chispas.geometry.attributes.color as THREE.BufferAttribute;
    const atras = T.clone().negate(), P0 = this.pearl.position;
    for(let k = 0; k < pa.count; k++){
      const sem = Math.sin(k*12.9898)*43758.5453, r1 = sem - Math.floor(sem), r2 = (r1*7.13) % 1, r3 = (r1*3.71) % 1;
      const edad = (t*.9 + k/pa.count) % 1;
      const lado = new THREE.Vector3().addScaledVector(Sd, (r2 - .5)*2).addScaledVector(U, (r3 - .5)*2);
      const q = P0.clone().addScaledVector(atras, edad*4.2).addScaledVector(lado, edad*1.6 + .3).addScaledVector(U, edad*edad*1.2);
      pa.setXYZ(k, q.x, q.y, q.z);
      const v = (1 - edad)*(1 - edad);
      ca.setXYZ(k, v, v*(.55 + .3*r2), v*.25);
    }
    pa.needsUpdate = true; ca.needsUpdate = true;
  }

  // un cuadro: la curva por donde pasa (de la cabeza a la cola), su reloj (segundos) y su opacidad
  pose(llenar: (out: THREE.Vector3[], paso: number) => void, t: number, op = 1){
    this.mesh.visible = op > .01;
    if(!this.mesh.visible) return;
    for(const m of this.mats){
      if(m instanceof THREE.ShaderMaterial) m.uniforms.uOpacity.value = op;
      else m.opacity = op;
    }
    this.columna(t, llenar);
    this.dibujarCuerpo(t);
    this.dibujarPatas(t);
    this.dibujarCabeza(t);
    this.mesh.updateMatrixWorld(true);
    for(const e of this.inst.values()){
      e.piezas.forEach((o, k) => e.mesh!.setMatrixAt(k, o.matrixWorld));
      e.mesh!.instanceMatrix.needsUpdate = true;
    }
  }
}

// ── En el Cronovisor: de vez en cuando cruza la galaxia por encima de los barrios y se va
export class Dragon {
  readonly cuerpo = new DragonCuerpo();
  get mesh(){ return this.cuerpo.mesh; }
  get position(){ return this.cuerpo.position; }
  get spine(){ return this.cuerpo.spine; } get T(){ return this.cuerpo.T; } get U(){ return this.cuerpo.U; } get Sd(){ return this.cuerpo.Sd; }
  private clock = 0;
  route: THREE.CatmullRomCurve3 | null = null;
  private len = 1; u = 0; wait = 8;
  private next: THREE.Vector3 | null = null;  // donde termina la vuelta y empieza la siguiente
  private shown = 0;                          // aparece una sola vez, con un fundido; después ya no se va
  private hist: THREE.Vector3[] = [];         // dónde estuvo la cabeza, de la más nueva a la más vieja
  onScreen = false;
  constructor(private host: DragonHost){ this.cuerpo.mesh.visible = false; }
  get flying(){ return !!this.route; }

  // Su recorrido (Eze, 2026-11-25: que no desaparezca, que recorra la galaxia de lo más viejo a lo más nuevo y el globo
  // pueda seguirlo, sin correa): una vuelta por los barrios en orden, del mes más viejo (afuera, en la punta de la
  // espiral) al más nuevo (cerca del centro), por encima; al llegar sigue de largo, rodea la galaxia por fuera en un arco
  // amplio y empieza otra vez desde lo más viejo. Cada vuelta empalma con la anterior, sin cortes.
  private newRoute(){
    const spots = this.host.spots();            // en orden cronológico, del más viejo al más nuevo
    const viejo = spots[0];
    const afuera = viejo.clone().setY(0).normalize();
    if(!afuera.lengthSq()) afuera.set(1, 0, 0);
    const salida = viejo.clone().addScaledVector(afuera, 30).setY(viejo.y + ARRIBA); // un poco afuera de lo más viejo
    // Una navegación sostenida, no un sube y baja (Eze: pasar por el corazón exacto de cada barrio, cada uno a su
    // altura, lo hacía abrupto): la espiral en orden, suavizada (cada punto, el promedio de sus vecinos en el tiempo),
    // la altura casi plana (un promedio mucho más ancho), y un punto cada 45 como mucho, para curvas amplias.
    const n = spots.length, liso: THREE.Vector3[] = [];
    const media = (i: number, w: number, eje: 'x' | 'y' | 'z') => {
      let a = 0, p = 0;
      for(let k = -w; k <= w; k++){ const j = Math.min(n - 1, Math.max(0, i + k)), g = Math.exp(-(k*k)/(w*w*.5)); a += spots[j][eje]*g; p += g; }
      return a/p;
    };
    for(let i = 0; i < n; i++) liso.push(new THREE.Vector3(media(i, 3, 'x'), media(i, 14, 'y') + ARRIBA, media(i, 3, 'z')));
    const pts = [this.next ? this.next.clone() : salida.clone()];
    for(const p of liso) if(p.distanceTo(pts[pts.length - 1]) > 45) pts.push(p);
    const fin = liso[n - 1];
    if(pts.length > 1 && fin.distanceTo(pts[pts.length - 1]) < 30) pts[pts.length - 1] = fin; else pts.push(fin);
    // la vuelta: sigue de largo y abre un arco amplio que rodea la galaxia por fuera, girando hacia el mismo lado que
    // venía, hasta volver por afuera de lo más viejo y entrar de nuevo; la altura cambia despacio (una loma suave)
    const R = this.host.radius();
    const dir = fin.clone().sub(pts[Math.max(0, pts.length - 2)]).setY(0).normalize();
    const E = fin.clone().addScaledVector(dir, 60);
    const llegada = salida.clone().addScaledVector(afuera, 60);
    const aE = Math.atan2(E.z, E.x), aS = Math.atan2(llegada.z, llegada.x);
    const lado = Math.sign(E.x*dir.z - E.z*dir.x) || 1;  // hacia dónde giraba
    let D = aS - aE; while(lado*D <= .4) D += lado*TAU;  // siempre en el mismo sentido, nunca dando marcha atrás
    const rE = Math.hypot(E.x, E.z), rS = Math.max(Math.hypot(llegada.x, llegada.z), R*.9);
    pts.push(E);
    const K = Math.max(6, Math.round(Math.abs(D)/.45));
    for(let k = 1; k < K; k++){
      const t = k/K, f = t*t*(3 - 2*t), a = aE + D*t, r = rE + (rS - rE)*f;
      pts.push(new THREE.Vector3(Math.cos(a)*r, E.y + (llegada.y - E.y)*f + Math.sin(Math.PI*t)*18, Math.sin(a)*r));
    }
    pts.push(llegada);
    pts.push(salida.clone());
    this.next = salida.clone();
    this.route = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    this.len = this.route.getLength();
    this.u = 0;
    // la primera vez, el cuerpo empieza estirado detrás de la cabeza, por donde venía; después sigue su propia estela
    if(!this.hist.length){
      const back = this.route.getTangentAt(0).negate();
      this.hist = Array.from({ length: 220 }, (_, k) => pts[0].clone().addScaledVector(back, k*.2));
    }
  }
  // la columna: puntos a lo largo de la historia de la cabeza, cada `paso`
  private porLaHistoria = (out: THREE.Vector3[], paso: number) => {
    let k = 0, acc = 0, prev = this.hist[0];
    out[0].copy(prev);
    for(let i = 1; i < out.length; i++){
      const need = i*paso;
      while(k + 1 < this.hist.length && acc + prev.distanceTo(this.hist[k + 1]) < need){ acc += prev.distanceTo(this.hist[k + 1]); k++; prev = this.hist[k]; }
      const nx = this.hist[Math.min(k + 1, this.hist.length - 1)], dd = prev.distanceTo(nx) || 1;
      out[i].copy(prev).lerp(nx, lim((need - acc)/dd, 0, 1));
    }
  };

  update(dt: number, camera: THREE.Camera & { fov: number }, _w: number, viewH: number, dim = 0){
    if(this.host.reduced){ this.mesh.visible = false; return; }
    this.clock += dt;
    if(!this.route){
      this.wait -= dt;
      this.mesh.visible = false; this.onScreen = false;
      if(this.wait <= 0 && this.host.spots().length) this.newRoute();
      return;
    }
    this.u += dt*VEL/this.len;
    if(this.u >= 1){ const sobra = (this.u - 1)*this.len; this.newRoute(); this.u = Math.min(.99, sobra/this.len); } // otra vuelta
    const cabeza = this.route!.getPointAt(this.u);
    if(cabeza.distanceTo(this.hist[0]) > .15){ this.hist.unshift(cabeza); if(this.hist.length > 400) this.hist.pop(); }
    else this.hist[0].copy(cabeza);
    this.shown = Math.min(1, this.shown + dt/3);
    const op = this.shown*this.shown*(1 - dim);
    // ¿se ve?
    const d = camera.position.distanceTo(cabeza), sc = cabeza.clone().project(camera);
    const px = L*viewH/(2*d*Math.tan(camera.fov*Math.PI/360));
    const inView = sc.z < 1 && Math.abs(sc.x) < 1.6 && Math.abs(sc.y) < 1.6;
    this.onScreen = op > .01 && inView && px > 60;
    this.cuerpo.pose(this.porLaHistoria, this.clock, op);
  }
}
