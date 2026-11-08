// Tanu. In the Selk'nam telling a woman of the ancestors who became a small whale; here one being with two forms.
// Stage A (2026-11-08): the whale, alive. She swims her own slow way through the galaxy (`idle`), turns to look at
// the balloon when it comes near and follows it gently if it drifts off (`curious`), breathes star dust and leaves
// a wake of it. Everything she does can be asked of her from outside, through one controller with a queue (the
// "brain" comes later): each action returns a promise that settles when the movement is done, one at a time.
// Song (B), the constellation she blows and guiding the balloon (C) and the transformation into Tanu (D) come next;
// their calls exist already and say so.
import * as THREE from 'three';
import { buildWhale, FLUKE_AT, BLOWHOLE_AT } from './whale';
import { Dust } from './trail';

export type Emotion = 'calm' | 'curious' | 'joyful' | 'nostalgic';
export type TanuState = 'idle' | 'guide' | 'curious' | 'sing' | 'blow' | 'transform' | 'swim' | 'look';

// what she needs to know about the universe she swims in (all of it read live, every frame)
export interface TanuHost {
  zone(id: string): { at: THREE.Vector3; stand: number } | null; // a place by name; `stand`: how far from it she stops
  balloon(): THREE.Vector3 | null;   // the balloon while someone flies it (null otherwise)
  radius(): number;                  // how far the galaxy reaches
  reduced: boolean;                  // prefers-reduced-motion
  lowPower(): boolean;
}

const LENGTH = 22;                   // the balloon is about 6 tall
const CRUISE = 4, TRAVEL = 7.5;      // units a second: slow, as a whale
const CURIOUS_NEAR = 48, CURIOUS_LEAVE = 135, STAND = 21; // she notices, gives up, keeps this far from the basket
const MAX_TURN = .55;                // radians a second

type Task = { run: () => Promise<void> };

export class Tanu {
  readonly group = new THREE.Group();
  state: TanuState = 'idle';
  mood: Emotion = 'calm';
  form: 'whale' | 'tanu' = 'whale';
  private body: THREE.Mesh;
  private skin: ReturnType<typeof buildWhale>['skin'];
  private dust: Dust;
  private pos = new THREE.Vector3();
  private fwd = new THREE.Vector3(1, 0, 0);
  private want = new THREE.Vector3(1, 0, 0);
  private speed = CRUISE;
  private roll = 0;
  private yawRate = 0;
  private phase = 0;
  private clock = 0;                 // her own time: the universe's, stopped when it stops
  private path: { curve: THREE.CatmullRomCurve3; u: number; len: number; speed: number; done?: () => void } | null = null;
  private looking: { target: () => THREE.Vector3 | null; until: number; done: () => void } | null = null;
  private curiousAt = -1e9;          // when she last gave up on the balloon (she waits a while before the next time)
  private busy = false;              // an action from outside is running: her own whims wait
  private queue: Promise<void> = Promise.resolve();
  private nextBreath = 8;
  private dustDebt = 0;
  private blinkAt = 4;
  private rng = Math.random;

  constructor(private host: TanuHost){
    const w = buildWhale();
    this.body = w.mesh; this.skin = w.skin;
    this.body.scale.setScalar(LENGTH);
    this.group.add(this.body);
    this.dust = new Dust(host.reduced ? 160 : 520);
    const R = host.radius();
    const a = this.rng()*Math.PI*2;
    this.pos.set(Math.cos(a)*R*.55, 6, Math.sin(a)*R*.55);
    this.fwd.set(-Math.sin(a), 0, Math.cos(a)); // already swimming, round the galaxy
    this.want.copy(this.fwd);
    this.place();
  }
  /** the star dust lives in world space, beside her group */
  get wake(){ return this.dust.points; }
  get position(){ return this.pos; }

  // ── the controller (what the brain will call) ──────────────────────────────
  private enqueue(state: TanuState, run: () => Promise<void>){
    const go = async () => { this.busy = true; this.state = state; try { await run(); } finally { this.busy = false; this.state = 'idle'; this.path = null; this.looking = null; } };
    const p = this.queue.then(go, go);
    this.queue = p.catch(() => {});
    return p;
  }
  /** swim to a named place: 'logo', 'sun', a barrio 'YYYY-MM', 'gas-0'…, 'balloon' */
  swimTo(zoneId: string): Promise<void> {
    return this.enqueue('swim', () => new Promise<void>((done) => {
      const z = this.host.zone(zoneId);
      if(!z){ console.warn(`[tanu] no place called "${zoneId}"`); done(); return; }
      const to = z.at.clone().add(this.pos.clone().sub(z.at).setY(0).normalize().multiplyScalar(z.stand)); // stop short, on her side
      to.y = z.at.y + 4;
      this.swimPath(to, THREE.MathUtils.clamp(this.pos.distanceTo(to)/22, TRAVEL, 14), done); // from far, she hurries a little
    }));
  }
  /** turn to look at the balloon (or a place) for a few seconds */
  lookAt(target: 'balloon' | string): Promise<void> {
    return this.enqueue('look', () => new Promise<void>((done) => {
      const get = () => target === 'balloon' ? this.host.balloon() : this.host.zone(target)?.at ?? null;
      if(!get()){ done(); return; }
      this.path = null;
      this.looking = { target: get, until: this.clock + 6, done };
    }));
  }
  sing(emotion: Emotion): Promise<void> { this.mood = emotion; return this.later('sing', 'B'); }
  blowConstellation(label: string): Promise<void> { return this.later('blow', 'C', label); }
  transform(form: 'whale' | 'tanu'): Promise<void> { return this.later('transform', 'D', form); }
  setMood(emotion: Emotion){ this.mood = emotion; }
  private later(state: TanuState, stage: string, what = ''){
    return this.enqueue(state, async () => { console.info(`[tanu] ${state}${what ? ` (${what})` : ''}: comes in stage ${stage}`); });
  }

  // ── her own life ────────────────────────────────────────────────────────────
  private swimPath(to: THREE.Vector3, speed: number, done?: () => void){
    const from = this.pos.clone(), dist = from.distanceTo(to);
    const ahead = from.clone().addScaledVector(this.fwd, THREE.MathUtils.clamp(dist*.3, 10, 34));
    const side = new THREE.Vector3().crossVectors(this.fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const mid = ahead.clone().lerp(to, .5).addScaledVector(side, (this.rng() - .5)*dist*.45);
    mid.y += (this.rng() - .5)*dist*.08;
    const curve = new THREE.CatmullRomCurve3([from, ahead, mid, to], false, 'centripetal');
    this.path = { curve, u: 0, len: curve.getLength(), speed, done };
  }
  private wander(){
    const R = this.host.radius();
    let to = new THREE.Vector3();
    for(let k = 0; k < 8; k++){ // somewhere else in the galaxy, not too near where she is
      const a = this.rng()*Math.PI*2, r = R*(.3 + .8*this.rng());
      to.set(Math.cos(a)*r, (this.rng() - .5)*42, Math.sin(a)*r);
      if(to.distanceTo(this.pos) > 70) break;
    }
    this.swimPath(to, CRUISE);
  }

  /** every frame: `dt` real seconds, `simDt` the universe's (0 while it stands still) */
  update(simDt: number, viewH: number, fovY: number){
    const dt = Math.min(simDt, .1);
    this.clock += dt;
    if(dt > 0) this.live(dt);
    this.place();
    this.dust.update(this.clock, viewH, fovY);
  }
  private live(dt: number){
    const B = this.host.balloon();
    const dB = B ? B.distanceTo(this.pos) : Infinity;
    // curiosity: her own, so only when nobody has asked her for anything
    if(!this.busy){
      if(this.state === 'idle' && dB < CURIOUS_NEAR && this.clock - this.curiousAt > 20){ this.state = 'curious'; this.path = null; }
      if(this.state === 'curious' && dB > CURIOUS_LEAVE){ this.state = 'idle'; this.curiousAt = this.clock; }
    }
    let target = this.speed;
    if(this.state === 'curious' && B){
      // to a spot STAND from the basket, on her side, a little lower; once there she turns to face it and hovers
      const goal = B.clone().add(this.pos.clone().sub(B).normalize().multiplyScalar(STAND)); goal.y = B.y - 3;
      const toGoal = goal.clone().sub(this.pos), gd = toGoal.length();
      const face = B.clone().sub(this.pos).normalize();
      const near = THREE.MathUtils.smoothstep(gd, 2, 12);
      this.want.copy(face).lerp(toGoal.clone().normalize(), near).normalize();
      // she glides to that spot and stops there (never into the balloon); if it moves away she follows, slowly
      const ahead = toGoal.dot(this.fwd);
      target = THREE.MathUtils.clamp(ahead*.28, 0, dB > 70 ? 3 : 6);
      if(dB < STAND*.8) target = 0; // too close already: she lets it drift off
    } else if(this.looking){
      const t = this.looking.target();
      if(t) this.want.copy(t.clone().sub(this.pos).normalize());
      target = .4;
      if(this.clock > this.looking.until){ const d = this.looking.done; this.looking = null; d(); }
    } else {
      if(!this.path) this.wander();
      const p = this.path!;
      const left = (1 - p.u)*p.len;
      target = p.speed*THREE.MathUtils.clamp(left/18, .25, 1); // easing in at the end of the way
    }
    this.speed += (target - this.speed)*(1 - Math.exp(-dt*(this.state === 'curious' ? (target < this.speed ? 2.4 : 1.1) : .6))); // curious, she brakes in time
    if(this.path && this.state !== 'curious' && !this.looking){
      const p = this.path;
      p.u = Math.min(1, p.u + this.speed*dt/p.len);
      const q = p.curve.getPointAt(p.u), tan = p.curve.getTangentAt(p.u);
      // the course is the curve's, the body follows a little behind, so turns are soft
      this.pos.lerp(q, 1 - Math.exp(-dt*3));
      this.want.copy(tan);
      if(p.u >= 1){ this.path = null; p.done?.(); }
    } else {
      this.pos.addScaledVector(this.fwd, this.speed*dt);
    }
    // turning: at most MAX_TURN a second, a little faster when she's slow (she turns on the spot to look)
    const before = this.fwd.clone();
    const ang = this.fwd.angleTo(this.want);
    if(ang > 1e-4){
      const k = Math.min(1, MAX_TURN*(this.speed < 1.5 ? 1.3 : 1)*dt/ang);
      this.fwd.lerp(this.want, k).normalize();
    }
    // she never quite points straight up or down
    if(Math.abs(this.fwd.y) > .55){ this.fwd.y = Math.sign(this.fwd.y)*.55; this.fwd.normalize(); }
    // banking into turns
    const yaw = Math.atan2(before.x*this.fwd.z - before.z*this.fwd.x, before.x*this.fwd.x + before.z*this.fwd.z)/dt;
    this.yawRate += (yaw - this.yawRate)*(1 - Math.exp(-dt*2));
    this.roll += (THREE.MathUtils.clamp(-this.yawRate*1.6, -.45, .45) - this.roll)*(1 - Math.exp(-dt*1.5));
    // the stroke: a few beats, then a glide (the beat fades and slows, the body coasts), never quite still;
    // harder when she speeds up, gentle when she hovers
    const red = this.host.reduced ? .35 : 1;
    const accel = THREE.MathUtils.clamp((target - this.speed)*.6, 0, .5);
    const glide = .45 + .55*THREE.MathUtils.smoothstep(Math.sin(this.clock*.21) + Math.sin(this.clock*.083 + 1.7)*.6, -.6, .5);
    const power = Math.min(1, glide + accel);
    this.phase += dt*Math.PI*2*(.07 + this.speed*.028)*(.55 + .45*power);
    const u = this.skin.uniforms;
    u.uAmp.value += ((.3 + Math.min(.75, this.speed*.13))*(.35 + .65*power)*red - u.uAmp.value)*(1 - Math.exp(-dt*.8));
    u.uPhase.value = this.phase;
    u.uFin.value = this.clock*.45;
    u.uTurn.value = THREE.MathUtils.clamp(this.yawRate*2, -1, 1);
    u.uBreath.value = Math.sin(this.clock*Math.PI*2/9);
    u.uTime.value = this.clock;
    // a slow blink now and then
    if(this.clock > this.blinkAt){ this.blinkAt = this.clock + 5 + this.rng()*9; }
    const b = this.blinkAt - this.clock;
    u.uEyeLight.value = b < .18 ? .15 : 1;
    this.breathe(dt);
  }
  private tmp = new THREE.Vector3();
  private breathe(dt: number){
    if(this.host.reduced) return;
    const m = this.body.matrixWorld;
    // the wake: dust from the flukes, more the faster she swims
    this.dustDebt += dt*this.speed*(this.host.lowPower() ? 2.5 : 6);
    const back = this.fwd.clone().multiplyScalar(-.6);
    while(this.dustDebt >= 1){
      this.dustDebt--;
      const at = this.tmp.copy(FLUKE_AT).add(new THREE.Vector3((this.rng() - .5)*.32, (this.rng() - .5)*.04, 0)).applyMatrix4(m);
      const v = back.clone().add(new THREE.Vector3(this.rng() - .5, this.rng() - .5, this.rng() - .5).multiplyScalar(.9));
      this.dust.emit(at, v, this.clock, 3 + this.rng()*4, .35 + this.rng()*.5);
    }
    // breathing out: a plume of star dust from the blowhole every half a minute or so
    if(this.clock > this.nextBreath){
      this.nextBreath = this.clock + 26 + this.rng()*20;
      const at = this.tmp.copy(BLOWHOLE_AT).applyMatrix4(m).clone();
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.group.quaternion);
      const n = this.host.lowPower() ? 30 : 70;
      for(let i = 0; i < n; i++){
        const v = up.clone().multiplyScalar(4.5 + this.rng()*4).add(new THREE.Vector3(this.rng() - .5, this.rng() - .5, this.rng() - .5).multiplyScalar(2.2)).addScaledVector(this.fwd, this.speed*.6);
        this.dust.emit(at, v, this.clock + this.rng()*.5, 2.5 + this.rng()*2, .3 + this.rng()*.45);
      }
    }
  }
  private place(){
    // her body points along fwd (+z is the head), upright but for the bank into turns
    const z = this.fwd.clone().normalize();
    const x = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), z).normalize();
    const y = new THREE.Vector3().crossVectors(z, x);
    const m = new THREE.Matrix4().makeBasis(x, y, z);
    this.group.quaternion.setFromRotationMatrix(m).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), this.roll));
    this.group.position.copy(this.pos);
    this.group.updateMatrixWorld(true);
  }
}
