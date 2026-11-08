// Star dust: what the whale leaves behind as she swims, and what she breathes out. One Points object, a ring of
// particles each with where and when it was born and how it drifts; only the ones just born are written each frame.
// Its clock is the whale's (the universe's), so it holds still when the universe does.
import * as THREE from 'three';

const VERT = /* glsl */`
  attribute vec3 aVel;
  attribute vec4 aLife; // birth, life, size, seed
  uniform float uTime, uView;
  varying float vA, vSeed;
  void main(){
    float age = uTime - aLife.x, k = age/aLife.y;
    if(age < 0. || k >= 1.){ gl_Position = vec4(2., 2., 2., 1.); gl_PointSize = 0.; return; }
    // drifts out and slows down, with a slight swirl of its own
    vec3 p = position + aVel*(1. - exp(-age*.7))/.7;
    p += vec3(sin(age*.9 + aLife.w*6.3), cos(age*.7 + aLife.w*4.1), sin(age*.6 + aLife.w*2.7))*.35*k;
    vec4 mv = modelViewMatrix*vec4(p, 1.);
    gl_Position = projectionMatrix*mv;
    gl_PointSize = aLife.z*uView/max(.1, -mv.z)*(1. - k*.6);
    vA = smoothstep(0., .08, k)*pow(1. - k, 1.6);
    vSeed = aLife.w;
  }`;
const FRAG = /* glsl */`
  precision highp float;
  varying float vA, vSeed;
  void main(){
    float d = length(gl_PointCoord - .5)*2.;
    float a = (exp(-d*d*5.) + .5*smoothstep(.35, 0., d))*vA;
    vec3 c = mix(vec3(.78, .86, 1.), vec3(1., .94, .84), vSeed);
    gl_FragColor = vec4(c*a*.7, 1.);
  }`;

export class Dust {
  readonly points: THREE.Points;
  private pos: Float32Array; private vel: Float32Array; private life: Float32Array;
  private next = 0; private from = Infinity; private to = -1;
  private uniforms = { uTime: { value: 0 }, uView: { value: 800 } };
  constructor(private n: number){
    this.pos = new Float32Array(n*3); this.vel = new Float32Array(n*3); this.life = new Float32Array(n*4);
    for(let i = 0; i < n; i++) this.life[i*4 + 1] = 1e-3; // all dead until born
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aVel', new THREE.BufferAttribute(this.vel, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aLife', new THREE.BufferAttribute(this.life, 4).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
  }
  emit(at: THREE.Vector3, vel: THREE.Vector3, time: number, life: number, size: number){
    const i = this.next; this.next = (this.next + 1) % this.n;
    this.pos.set([at.x, at.y, at.z], i*3);
    this.vel.set([vel.x, vel.y, vel.z], i*3);
    this.life.set([time, life, size, Math.random()], i*4);
    this.from = Math.min(this.from, i); this.to = Math.max(this.to, i);
  }
  update(time: number, viewH: number, fovY: number){
    this.uniforms.uTime.value = time;
    this.uniforms.uView.value = viewH*.5/Math.tan(fovY*Math.PI/360);
    if(this.to < 0) return;
    const g = this.points.geometry;
    for(const name of ['position', 'aVel', 'aLife']){
      const a = g.getAttribute(name) as THREE.BufferAttribute, k = a.itemSize;
      a.clearUpdateRanges(); a.addUpdateRange(this.from*k, (this.to - this.from + 1)*k); a.needsUpdate = true;
    }
    this.from = Infinity; this.to = -1;
  }
}
