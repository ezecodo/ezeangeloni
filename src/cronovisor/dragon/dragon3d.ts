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
  spots(): THREE.Vector3[];   // los corazones de los barrios, por donde pasa
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
const GARRAS = 5;
const VEL = 12, ARRIBA = 24;
const bulto = (f: number, donde: number, alto: number, ancho: number) => alto*Math.exp(-Math.pow((f - donde)/ancho, 2));
function perfil(f: number){
  let base = f < .45 ? .74 : .74*(1 - Math.pow((f - .45)/.55, 1.15)*.88);
  if(f < .07) base -= (.07 - f)/.07*.2;
  return base + bulto(f, .12, .26, .055) - bulto(f, .26, .06, .04) + bulto(f, .4, .2, .05);
}

// ── materiales: se iluminan solos ───────────────────────────────────────────────────────────────────────────────────
const LUZ_VERT = `
  varying vec3 vN; varying vec3 vV;
  void main(){
    vec4 p = vec4(position, 1.); vec3 nn = normal;
    #ifdef USE_INSTANCING
      p = instanceMatrix*p; nn = mat3(instanceMatrix)*nn;   // las piezas instanciadas (dedos, uñas)
    #endif
    vec4 mv = modelViewMatrix*p; vN = normalize(normalMatrix*nn); vV = -mv.xyz; gl_Position = projectionMatrix*mv;
  }`;
const LUZ_FRAG = `
  uniform vec3 uColor; uniform float uOpacity; uniform float uRim;
  varying vec3 vN; varying vec3 vV;
  void main(){
    vec3 n = normalize(vN); if(!gl_FrontFacing) n = -n;
    float l = .42 + .58*max(dot(n, normalize(vec3(-.35, .8, .5))), 0.);
    float rim = pow(1. - max(dot(n, normalize(vV)), 0.), 2.5);
    gl_FragColor = vec4((uColor*l + vec3(.55, .8, 1.)*rim*uRim)*.86, uOpacity);
  }`;
function pintura(color: number, rim = .35, doble = false){
  return new THREE.ShaderMaterial({ vertexShader: LUZ_VERT, fragmentShader: LUZ_FRAG, transparent: true,
    side: doble ? THREE.DoubleSide : THREE.FrontSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 1 }, uRim: { value: rim } } });
}
// la piel del cuerpo: aS a lo largo (0 cabeza, 1 cola), aA alrededor (0 lomo, .5 vientre)
const PIEL_VERT = `
  attribute float aS; attribute float aA;
  varying vec3 vN; varying vec3 vV; varying float vS; varying float vA;
  void main(){ vS = aS; vA = aA; vec4 mv = modelViewMatrix*vec4(position, 1.); vN = normalize(normalMatrix*normal); vV = -mv.xyz; gl_Position = projectionMatrix*mv; }`;
const PIEL_FRAG = `
  uniform vec3 uCuerpo, uLuz, uVientre, uPlaca; uniform float uOpacity;
  varying vec3 vN; varying vec3 vV; varying float vS; varying float vA;
  void main(){
    vec3 n = normalize(vN);
    float aVientre = abs(vA - .5);                      // 0 en el centro del vientre
    float vientre = smoothstep(.2, .16, aVientre);
    // placas del vientre: bandas atravesadas
    float placa = smoothstep(.06, 0., abs(fract(vS*60.) - .5) - .38);
    // escamas en media luna sobre el lomo y los flancos
    vec2 g = vec2(vS*150., vA*22.);
    g.x += step(1., mod(floor(g.y), 2.))*.5;
    vec2 f = fract(g) - vec2(.5, .3);
    float esc = smoothstep(.05, 0., abs(length(f) - .42))*step(0., f.y);
    vec3 col = uCuerpo;
    col = mix(col, uLuz, esc*.55*(1. - vientre));
    col = mix(col, uLuz, smoothstep(.12, 0., min(vA, 1. - vA))*.35);   // franja de luz sobre el lomo
    col = mix(col, mix(uVientre, uPlaca, placa*.8), vientre);
    float l = .42 + .58*max(dot(n, normalize(vec3(-.35, .8, .5))), 0.);
    float rim = pow(1. - max(dot(n, normalize(vV)), 0.), 2.5);
    gl_FragColor = vec4((col*l + vec3(.55, .8, 1.)*rim*.35)*.86, uOpacity);
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
  const Y = y.clone().normalize(), X = xHint.clone().addScaledVector(Y, -xHint.dot(Y)).normalize(), Z = X.clone().cross(Y);
  o.quaternion.setFromRotationMatrix(_m4.makeBasis(X, Y, Z));
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

export class Dragon {
  readonly mesh = new THREE.Group();          // todo el dragón (el nombre `mesh` como el 2D, para la escena)
  private mats: (THREE.ShaderMaterial | THREE.MeshBasicMaterial)[] = [];
  private clock = 0;
  private route: THREE.CatmullRomCurve3 | null = null;
  private len = 1; private u = 0; private wait = 8;
  private hist: THREE.Vector3[] = [];         // dónde estuvo la cabeza, de la más nueva a la más vieja
  private spine: THREE.Vector3[] = Array.from({ length: N + 1 }, () => new THREE.Vector3());
  private T: THREE.Vector3[] = []; private U: THREE.Vector3[] = []; private Sd: THREE.Vector3[] = [];
  // cuerpo
  private body: THREE.Mesh; private bodyPos: Float32Array; private bodyNor: Float32Array;
  private fins: THREE.Object3D[] = []; private tail: THREE.Object3D[] = [];
  private inst = new Map<string, { geo: THREE.BufferGeometry; mat: THREE.Material; piezas: THREE.Object3D[]; mesh?: THREE.InstancedMesh }>();
  // patas
  private legs: { f: number; delantera: boolean; lado: number; fase: number; brazo: THREE.Mesh; ante: THREE.Mesh; mano: THREE.Mesh; hombro: THREE.Mesh; codo: THREE.Mesh; dedos: THREE.Object3D[]; unas: THREE.Object3D[]; mechon: THREE.Object3D[] }[] = [];
  // cabeza
  private head = new THREE.Group(); private jaw = new THREE.Group(); private mane: THREE.Object3D[] = []; private whiskers: THREE.Mesh[] = []; private frame = 0;
  private tongue = new THREE.Group();
  private pearl = new THREE.Group(); private pearlFlames: THREE.Object3D[] = [];
  // una pieza de una clase instanciada, colgada de `padre`
  private pieza(clase: string, geo: THREE.BufferGeometry, mat: THREE.Material, padre: THREE.Object3D){
    const e = this.inst.get(clase) ?? this.inst.set(clase, { geo, mat, piezas: [] }).get(clase)!;
    const o = new THREE.Object3D(); e.piezas.push(o); padre.add(o); return o;
  }
  onScreen = false;

  constructor(private host: DragonHost){
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
    geo.setIndex(idx);
    const piel = mat(new THREE.ShaderMaterial({ vertexShader: PIEL_VERT, fragmentShader: PIEL_FRAG, transparent: true,
      uniforms: { uCuerpo: { value: new THREE.Color(C.cuerpo) }, uLuz: { value: new THREE.Color(C.luz) }, uVientre: { value: new THREE.Color(C.vientre) }, uPlaca: { value: new THREE.Color(C.placa) }, uOpacity: { value: 1 } } }));
    this.body = new THREE.Mesh(geo, piel);
    this.body.frustumCulled = false;
    this.mesh.add(this.body);

    const plano = new THREE.PlaneGeometry(1, 1); plano.translate(0, .5, 0); // la base en el origen, la punta hacia +y
    const llamaMat = (tex: THREE.Texture) => mat(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, color: new THREE.Color(.86, .86, .86) }));
    const LL: Record<string, THREE.MeshBasicMaterial> = { rojo: llamaMat(texturaLlama('#b8241a', '#ff6a3a')), naranja: llamaMat(texturaLlama('#e8432e', '#ffc06a')), clara: llamaMat(texturaLlama('#ff8a4a', '#fff0c0')) };
    const rojo = 'rojo', naranja = 'naranja', clara = 'clara';
    const carta = (tipo: string, padre: THREE.Object3D = this.mesh) => this.pieza('llama-' + tipo, plano, LL[tipo], padre);
    // aletas del lomo y la cola en llama
    for(let i = 6; i < N - 6; i += 3) this.fins.push(carta(rojo));
    for(let j = 0; j < 7; j++) this.tail.push(carta(j % 2 ? naranja : clara));

    // ── patas: brazo y antebrazo (cilindros que se afinan), mano, cinco dedos con su uña, mechón de llama en el codo
    const azul = mat(pintura(C.cuerpo)), azulLejos = mat(pintura(0x2f86bd)), unaMat = mat(pintura(C.cuerno, .15));
    const cil = (r0: number, r1: number) => { const g = new THREE.CylinderGeometry(r1, r0, 1, 10); g.translate(0, .5, 0); return g; }; // de la base (y=0) a la punta (y=1)
    const dedoGeo = cil(1, .8), unaGeo = new THREE.ConeGeometry(1, 1, 8); unaGeo.translate(0, .5, 0);
    for(const [f, delantera, fase] of [[.15, true, 0], [.4, false, .5]] as [number, boolean, number][]) for(const lado of [1, -1]){
      const m = lado > 0 ? azul : azulLejos, g = GROSOR*perfil(f)/2;
      // el brazo nace grueso, dentro de la masa del hombro (o del anca), y se afina; el codo, redondeado
      const brazo = new THREE.Mesh(cil(g*.62, g*.3), m), ante = new THREE.Mesh(cil(g*.3, g*.2), m), mano = new THREE.Mesh(new THREE.SphereGeometry(g*.24, 10, 8), m);
      const hombro = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), m), codo = new THREE.Mesh(new THREE.SphereGeometry(g*.31, 12, 8), m);
      const dedos: THREE.Object3D[] = [], unas: THREE.Object3D[] = [], mechon: THREE.Object3D[] = [];
      for(let k = 0; k < GARRAS + 1; k++){ // el último es el espolón; radio 1, se escalan al grosor de la pata
        const d = this.pieza(lado > 0 ? 'dedo' : 'dedoLejos', dedoGeo, m, this.mesh), u = this.pieza('una', unaGeo, unaMat, this.mesh);
        d.userData.r = g*.085; u.userData.r = g*.07;
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
    const amarillo = mat(pintura(C.hocico, .25)), claro = mat(pintura(C.luz, .2)), boca = mat(pintura(C.boca, 0)), blanco = mat(pintura(C.diente, .1)),
      iris = mat(pintura(C.ojo, .1)), negro = mat(pintura(0x120808, 0)), lengua = mat(pintura(C.lengua, .1));
    H.add(pieza(esfera(.32), azul, .2, .3, 0, 1.3, 1, .95));               // cráneo
    H.add(pieza(esfera(.22), azul, .68, .25, 0, 1.65, .78, .85));          // hocico
    H.add(pieza(esfera(.14), amarillo, 1.02, .3, 0, 1, .9, 1.15));          // hocico bulboso
    for(const z of [.07, -.07]) H.add(pieza(esfera(.03), boca, 1.12, .32, z));
    for(const z of [.21, -.21]){
      H.add(pieza(esfera(.16), claro, .1, .14, z*1.05, 1.1, .9, .5));       // mejillas
      H.add(pieza(esfera(.085), blanco, .45, .4, z*1.1));                    // ojo
      H.add(pieza(esfera(.05), iris, .49, .41, z*1.32));
      H.add(pieza(esfera(.028), negro, .5, .41, z*1.44));
      H.add(pieza(esfera(.012), blanco, .48, .44, z*1.5));
      H.add(pieza(esfera(.1), amarillo, .42, .52, z*1.05, 1.6, .38, .45, .15)); // ceja
    }
    H.add(pieza(esfera(.2), boca, .55, .06, 0, 2, .32, .62));               // interior de la boca
    for(let k = 0; k < 4; k++) for(const z of [.11, -.11]){                 // dientes de arriba
      const d = pieza(new THREE.ConeGeometry(.025, .09, 6), blanco, .55 + k*.13, .06, z*(1 - k*.12)); d.rotation.z = Math.PI; H.add(d);
    }
    // la mandíbula, que gira sobre su bisagra
    this.jaw.position.set(.22, .02, 0);
    this.jaw.add(pieza(esfera(.2), azul, .38, -.08, 0, 2.1, .45, .8));
    this.jaw.add(pieza(esfera(.16), claro, .35, -.14, 0, 1.8, .3, .6));
    for(let k = 0; k < 3; k++) for(const z of [.1, -.1]) this.jaw.add(pieza(new THREE.ConeGeometry(.022, .08, 6), blanco, .4 + k*.14, .0, z*(1 - k*.15)));
    fusionar(this.jaw);
    // la lengua: sale un poco y se enrosca hacia abajo
    const lc = new THREE.CatmullRomCurve3([new THREE.Vector3(.3, 0, 0), new THREE.Vector3(.72, -.02, 0), new THREE.Vector3(.98, -.13, 0), new THREE.Vector3(1.06, -.05, 0), new THREE.Vector3(1.0, .0, 0)]);
    this.tongue.add(new THREE.Mesh(new THREE.TubeGeometry(lc, 24, .024, 6), lengua));
    this.jaw.add(this.tongue);
    // cuernos que se enroscan, con una rama adelante
    for(const z of [.17, -.17]){
      const base = new THREE.CatmullRomCurve3([[.22, .5, z], [.08, .84, z*1.2], [-.22, 1.0, z*1.4], [-.43, 1.1, z*1.5]].map(p => new THREE.Vector3(...p)));
      const punta = new THREE.CatmullRomCurve3([[-.43, 1.1, z*1.5], [-.46, 1.26, z*1.55], [-.4, 1.36, z*1.55], [-.3, 1.32, z*1.5]].map(p => new THREE.Vector3(...p)));
      const rama = new THREE.CatmullRomCurve3([[.06, .82, z*1.2], [.18, .98, z*1.25], [.3, 1.05, z*1.3]].map(p => new THREE.Vector3(...p)));
      H.add(new THREE.Mesh(new THREE.TubeGeometry(base, 16, .05, 8), amarillo));
      H.add(new THREE.Mesh(new THREE.TubeGeometry(punta, 10, .035, 8), amarillo));
      H.add(new THREE.Mesh(new THREE.TubeGeometry(rama, 8, .03, 8), amarillo));
    }
    fusionar(H); // las piezas fijas de la cabeza: una malla por material
    H.add(this.jaw);
    // melena de llamas alrededor de la nuca, en dos capas, hacia atrás; y la barba bajo la mandíbula
    for(let k = 0; k < 14; k++){
      const f = carta(k % 2 ? rojo : naranja, H), a = (k/14)*TAU;
      f.userData = { a, l: .55 + (k % 3)*.15 };
      this.mane.push(f);
    }
    for(let k = 0; k < 4; k++){ const f = carta(k % 2 ? naranja : rojo, this.jaw); f.userData = { barba: k }; this.mane.push(f); }
    this.head.scale.setScalar(S);
    this.mesh.add(this.head);
    // bigotes: los rehace cada tanto, ondeando
    for(let k = 0; k < 2; k++){ const w = new THREE.Mesh(new THREE.BufferGeometry(), amarillo); this.whiskers.push(w); this.mesh.add(w); }

    // ── la perla en llamas
    const perla = new THREE.Mesh(esfera(.42), mat(new THREE.MeshBasicMaterial({ color: new THREE.Color(.95, .92, .82), transparent: true })));
    this.pearl.add(perla);
    for(let k = 0; k < 8; k++){ const f = carta(k % 2 ? naranja : clara, this.pearl); f.scale.set(.6, 1.3, 1); this.pearlFlames.push(f); }
    this.mesh.add(this.pearl);

    for(let i = 0; i <= N; i++){ this.T.push(new THREE.Vector3()); this.U.push(new THREE.Vector3()); this.Sd.push(new THREE.Vector3()); }
    for(const e of this.inst.values()){
      e.mesh = new THREE.InstancedMesh(e.geo, e.mat, e.piezas.length);
      e.mesh.frustumCulled = false;
      this.mesh.add(e.mesh);
    }
    this.mesh.visible = false;
  }

  get position(){ return this.head.position; }
  get flying(){ return !!this.route; }

  private newRoute(){
    const R = this.host.radius(), spots = this.host.spots();
    const a = Math.random()*TAU, out = (ang: number, h: number) => new THREE.Vector3(Math.cos(ang)*R*1.35, h, Math.sin(ang)*R*1.35);
    const pts = [out(a, ARRIBA + 20)];
    const pool = spots.slice().sort(() => Math.random() - .5).slice(0, 3).sort((p, q) => p.distanceTo(pts[0]) - q.distanceTo(pts[0]));
    for(const s of pool) pts.push(new THREE.Vector3(s.x, s.y + ARRIBA + Math.random()*10, s.z));
    pts.push(out(a + Math.PI + (Math.random() - .5)*1.2, ARRIBA + 30));
    this.route = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    this.len = this.route.getLength();
    this.u = 0;
    // la historia: el cuerpo empieza estirado detrás de la cabeza, por donde venía
    const back = this.route.getTangentAt(0).negate();
    this.hist = Array.from({ length: 220 }, (_, k) => pts[0].clone().addScaledVector(back, k*.2));
  }

  // la columna: N+1 puntos a lo largo de la historia de la cabeza, cada L/N, más la onda que recorre el cuerpo
  private columna(t: number){
    const paso = L/N;
    let k = 0, acc = 0, prev = this.hist[0];
    this.spine[0].copy(prev);
    for(let i = 1; i <= N; i++){
      const need = i*paso;
      while(k + 1 < this.hist.length && acc + prev.distanceTo(this.hist[k + 1]) < need){ acc += prev.distanceTo(this.hist[k + 1]); k++; prev = this.hist[k]; }
      const nx = this.hist[Math.min(k + 1, this.hist.length - 1)], dd = prev.distanceTo(nx) || 1;
      this.spine[i].copy(prev).lerp(nx, lim((need - acc)/dd, 0, 1));
    }
    // marcos: adelante (hacia la cabeza), arriba (el lomo, hacia el cielo) y el costado
    const up = new THREE.Vector3(0, 1, 0);
    for(let i = 0; i <= N; i++){
      const a = this.spine[Math.max(0, i - 1)], b = this.spine[Math.min(N, i + 1)];
      this.T[i].copy(a).sub(b).normalize();
      this.U[i].copy(up).addScaledVector(this.T[i], -up.dot(this.T[i])).normalize();
      this.Sd[i].crossVectors(this.T[i], this.U[i]).normalize();
    }
    // la onda: de lado y arriba-abajo, pequeña en el cuello y cada vez más amplia hacia la cola
    const k2 = TAU/(L*.55), w = t*2.2;
    for(let i = 1; i <= N; i++){
      const s = i/N*L, env = suave(lim(i/(N*.3), 0, 1))*(1 - .3*i/N);
      this.spine[i].addScaledVector(this.Sd[i], Math.sin(k2*s - w)*GROSOR*.9*env).addScaledVector(this.U[i], Math.sin(k2*s - w + 1.7)*GROSOR*.55*env);
    }
    for(let i = 0; i <= N; i++){ // marcos de nuevo, sobre la columna ondulada
      const a = this.spine[Math.max(0, i - 1)], b = this.spine[Math.min(N, i + 1)];
      this.T[i].copy(a).sub(b).normalize();
      this.U[i].copy(up).addScaledVector(this.T[i], -up.dot(this.T[i])).normalize();
      this.Sd[i].crossVectors(this.T[i], this.U[i]).normalize();
    }
  }

  private dibujarCuerpo(t: number){
    const p = this.bodyPos, n = this.bodyNor, dir = new THREE.Vector3();
    for(let i = 0; i <= N; i++){
      const r = GROSOR*perfil(i/N)/2;
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
      const i = 6 + j*3, r = GROSOR*perfil(i/N)/2, h = r*(1.3 + .4*Math.sin(i*1.7));
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
      const i = Math.round(lg.f*N), g = GROSOR*perfil(lg.f)/2, T = this.T[i], U = this.U[i], Sd = this.Sd[i];
      const a = PATA*.53, b = PATA*.47, R = a + b;
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
      const base = lg.delantera ? -.45 + .5*alc : Math.PI + .25, abre = .16 + .3*abierta, dobla = .25 + (1 - abierta)*1.05;
      lg.dedos.forEach((dd, k) => {
        const espolon = k === GARRAS, lado = espolon ? 0 : k - (GARRAS - 1)/2;
        const an = espolon ? base + Math.PI*.82 : base + lado*abre*.6;
        const abanico = Sd.clone().multiplyScalar(espolon ? 0 : lado*.25*abierta);
        const dir = T.clone().multiplyScalar(Math.cos(an)).addScaledVector(U, Math.sin(an)).add(abanico).normalize();
        const largo = (espolon ? .14 : .2 - Math.abs(lado)*.02)*PATA;
        const J = F.clone().addScaledVector(dir, largo);
        pon(dd, F, J, dd.userData.r);
        const dirU = T.clone().multiplyScalar(Math.cos(an - dobla)).addScaledVector(U, Math.sin(an - dobla)).add(abanico).normalize();
        const u = lg.unas[k]; u.position.copy(J); u.quaternion.setFromUnitVectors(Y, dirU); u.scale.set(u.userData.r, largo*1.1, u.userData.r);
      });
      // mechón de llama en el codo, hacia atrás
      lg.mechon.forEach((fl, k) => {
        const atras = T.clone().negate().addScaledVector(U, (k - 1)*.35 + Math.sin(t*8 + k)*.15).normalize();
        fl.position.copy(E);
        orienta(fl, atras, U); fl.scale.set(.5, 1.2 + k*.25, 1);
      });
    }
  }

  private dibujarCabeza(t: number){
    // estable: mira por la línea del cuello (no del último segmento), así no cabecea
    const T = this.spine[0].clone().sub(this.spine[6]).normalize(), up = new THREE.Vector3(0, 1, 0);
    const U = up.clone().addScaledVector(T, -up.dot(T)).normalize(), Sd = new THREE.Vector3().crossVectors(T, U);
    this.head.position.copy(this.spine[0]).addScaledVector(T, -S*.05);
    this.head.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(T, U, Sd));
    const abre = .26 + .06*Math.sin(t*3);
    this.jaw.rotation.z = -abre*1.1;
    this.tongue.rotation.z = Math.sin(t*2.5)*.08;
    // melena: llamas alrededor de la nuca, hacia atrás y hacia afuera, ondeando
    for(const f of this.mane){
      const ud = f.userData as { a?: number; l?: number; barba?: number };
      if(ud.barba !== undefined){
        const k = ud.barba, d = new THREE.Vector3(-.5, -1, 0).normalize();
        f.position.set(.25 + k*.1, -.2, (k - 1.5)*.05);
        f.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.applyAxisAngle(new THREE.Vector3(0, 0, 1), Math.sin(t*5 + k)*.15));
        f.scale.set(.12, .3 + (k % 2)*.08, 1);
        continue;
      }
      const a = ud.a!, l = ud.l!;
      const radial = new THREE.Vector3(0, Math.cos(a), Math.sin(a)); // alrededor del eje del cuello
      const d = new THREE.Vector3(-.85, 0, 0).addScaledVector(radial, .7 + Math.sin(t*5 + a*3)*.12).normalize();
      f.position.set(.02, .18, 0).addScaledVector(radial, .26);
      orienta(f, d, new THREE.Vector3(1, 0, 0).cross(radial)); // de canto alrededor del cuello, como pétalos
      f.scale.set(.24, l, 1);
    }
    // bigotes: desde el hocico, ondeando hacia atrás (en coordenadas del mundo)
    if(this.frame++ % 3 === 0) this.whiskers.forEach((w, k) => {
      const z = k ? -.14 : .14, ola = (j: number) => Math.sin(t*4.5 + j + k*1.7);
      const loc = [[.95, .18, z], [.6, .45 + ola(0)*.15, z*2.5], [-.2, .5 + ola(1)*.2, z*4], [-.9, .75 + ola(2)*.2, z*5], [-1.6, .5 + ola(3)*.2, z*5.5]];
      const pts = loc.map(([x, y, zz]) => new THREE.Vector3(x, y, zz).multiplyScalar(S).applyQuaternion(this.head.quaternion).add(this.head.position));
      w.geometry.dispose();
      w.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, S*.012, 5);
    });
    // la perla, delante: flota y sus llamas giran
    this.pearl.position.copy(this.head.position).addScaledVector(T, S*1.9).addScaledVector(U, S*.35 + Math.sin(t*4)*.3);
    this.pearlFlames.forEach((f, k) => {
      const a = k/8*TAU + t*2;
      f.position.set(0, 0, 0);
      f.rotation.set(0, 0, a); f.scale.set(.5, 1.1 + .3*Math.sin(t*9 + k), 1);
    });
    this.pearl.quaternion.copy(this.head.quaternion);
  }

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
    if(this.u >= 1){ this.route = null; this.wait = 25 + Math.random()*35; this.mesh.visible = false; this.onScreen = false; return; }
    const cabeza = this.route.getPointAt(this.u);
    if(cabeza.distanceTo(this.hist[0]) > .15){ this.hist.unshift(cabeza); if(this.hist.length > 400) this.hist.pop(); }
    else this.hist[0].copy(cabeza);
    const fade = Math.min(1, this.u/.06, (1 - this.u)/.06), op = fade*(1 - dim);
    this.mesh.visible = op > .01;
    // ¿se ve?
    const d = camera.position.distanceTo(cabeza), sc = cabeza.clone().project(camera);
    const px = L*viewH/(2*d*Math.tan(camera.fov*Math.PI/360));
    const inView = sc.z < 1 && Math.abs(sc.x) < 1.6 && Math.abs(sc.y) < 1.6;
    this.onScreen = this.mesh.visible && inView && px > 60;
    if(!this.mesh.visible) return;
    for(const m of this.mats){
      if(m instanceof THREE.ShaderMaterial) m.uniforms.uOpacity.value = op;
      else m.opacity = op;
    }
    this.columna(this.clock);
    this.dibujarCuerpo(this.clock);
    this.dibujarPatas(this.clock);
    this.dibujarCabeza(this.clock);
    this.mesh.updateMatrixWorld(true);
    for(const e of this.inst.values()){
      e.piezas.forEach((o, k) => e.mesh!.setMatrixAt(k, o.matrixWorld));
      e.mesh!.instanceMatrix.needsUpdate = true;
    }
  }
}
