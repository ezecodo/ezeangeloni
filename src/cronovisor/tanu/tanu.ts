// Tanu. In the Selk'nam telling a woman of the ancestors who became a small whale; here one being with two forms.
// Stage A (2026-11-08): the whale, alive. She swims her own slow way through the galaxy (`idle`), turns to look at
// the balloon when it comes near and follows it gently if it drifts off (`curious`), breathes star dust and leaves
// a wake of it. Everything she does can be asked of her from outside, through one controller with a queue (the
// "brain" comes later): each action returns a promise that settles when the movement is done, one at a time.
// Song (B), the constellation she blows and guiding the balloon (C) and the transformation into Tanu (D) come next;
// their calls exist already and say so.
import * as THREE from 'three';
import { buildWhale, FLUKE_AT, BLOWHOLE_AT } from './whale';
import { loadWhale } from './model';
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
  model?: string;                    // a sculpted body (GLB) to wear instead of the procedural one; she waits hidden until it's in
}

const LENGTH = 22;                   // the balloon is about 6 tall
const CRUISE = 6.5, TRAVEL = 10;     // units a second: unhurried, but alive (Eze, 2026-11-09: 4 and 7.5 felt "hiperlento")
const CURIOUS_NEAR = 48, CURIOUS_LEAVE = 135, STAND = 21; // she notices, gives up, keeps this far from the basket
const MAX_TURN = .5;                 // radians a second, at most (reached slowly)
const MAX_PITCH = .42;               // the steepest she climbs or dives (radians)

type Task = { run: () => Promise<void> };


export class Tanu {
  readonly group = new THREE.Group();
  state: TanuState = 'idle';
  mood: Emotion = 'calm';
  form: 'whale' | 'tanu' = 'whale';
  private body: THREE.Mesh;
  private skin: ReturnType<typeof buildWhale>['skin'];
  private dust: Dust;
  private flukeAt = FLUKE_AT.clone();
  private blowholeAt = BLOWHOLE_AT.clone();
  private pos = new THREE.Vector3();
  private fwd = new THREE.Vector3(1, 0, 0);
  private want = new THREE.Vector3(1, 0, 0);
  private speed = CRUISE;
  private roll = 0;
  private yawRate = 0;
  private pitchRate = 0;
  private turnRate = 0;              // how fast she's turning now: it builds up and dies down, a heavy body
  private vel = new THREE.Vector3(); // where her body is actually going (it can lead her heading a little)
  private phase = 0;
  private finClock = 0;              // the fins' own slow rhythm (faster while she hovers and sculls)
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
    if(host.model){
      // the sculpted body: she appears once it's in; if it can't load, the procedural one swims instead
      this.body.visible = false;
      loadWhale(host.model).then(m => {
        this.body.geometry.dispose();
        this.body.geometry = m.geometry;
        const u = this.skin.uniforms;
        u.uFinRoot.value.copy(m.finRoot);
        u.uEye.value.copy(m.eye);
        u.uEyeR.value = m.eyeR;
        u.uFlukeS.value = m.flukeS;
        u.uFinRest.value = m.finRest;
        if(m.normalMap){ u.uNormalMap.value = m.normalMap; u.uHasNormalMap.value = 1; }
        this.flukeAt.copy(m.fluke); this.blowholeAt.copy(m.blowhole);
      }).catch(e => console.warn('[tanu] the sculpted body did not load, the procedural one swims', e))
        .finally(() => { this.body.visible = true; });
    }
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
      this.swimPath(to, THREE.MathUtils.clamp(this.pos.distanceTo(to)/20, TRAVEL, 16), done); // from far, she hurries a little
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
    let course: THREE.Vector3 | null = null; // curious: the way to her spot, which her body may start along before she's turned
    if(this.state === 'curious' && B){
      // to a spot STAND from the basket, on her side, a little lower; once there she turns to face it and hovers
      // (beside it, never under or over it: the way out from the basket is taken level)
      const side = this.pos.clone().sub(B).setY(0);
      if(side.lengthSq() < 1) side.set(-this.fwd.z, 0, this.fwd.x); // right under it: she moves off to one side
      const goal = B.clone().add(side.normalize().multiplyScalar(STAND)); goal.y = B.y - 3;
      const toGoal = goal.clone().sub(this.pos), gd = toGoal.length();
      const face = B.clone().sub(this.pos).normalize();
      const near = THREE.MathUtils.smoothstep(gd, 2, 12);
      this.want.copy(face).lerp(toGoal.clone().normalize(), near).normalize();
      // she glides to that spot and stops there (never into the balloon); if it moves away she follows, slowly
      course = gd > .5 ? toGoal.clone().normalize() : null;
      target = THREE.MathUtils.clamp(gd*.3, 0, dB > 70 ? 4.5 : 8)*THREE.MathUtils.clamp(.35 + .65*this.fwd.dot(face), .25, 1); // slower while she's still turning
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
    // speed eases (she brakes a little sooner than she speeds up)
    this.speed += (target - this.speed)*(1 - Math.exp(-dt*(target < this.speed ? 1.5 : .7)));
    // she climbs and dives at a gentle slope (at most ~24°): the course is softened before she turns to it, so
    // there's no wall to hit; straight up or down, she keeps her own way round and only tilts
    {
      const h = Math.hypot(this.want.x, this.want.z);
      const flat = h > 1e-3 ? new THREE.Vector2(this.want.x/h, this.want.z/h) : new THREE.Vector2(this.fwd.x, this.fwd.z).normalize();
      const el = THREE.MathUtils.clamp(Math.atan2(this.want.y, h), -MAX_PITCH, MAX_PITCH);
      this.want.set(flat.x*Math.cos(el), Math.sin(el), flat.y*Math.cos(el));
    }
    // turning: the turn builds up and dies down (a heavy body), and slows as she comes round
    // (heading and slope turn separately, so a turn right round never swings through straight up)
    const before = this.fwd.clone();
    let yaw0 = Math.atan2(this.fwd.x, this.fwd.z), el0 = Math.asin(THREE.MathUtils.clamp(this.fwd.y, -1, 1));
    const yawW = Math.atan2(this.want.x, this.want.z), elW = Math.asin(THREE.MathUtils.clamp(this.want.y, -1, 1));
    const dYaw = Math.atan2(Math.sin(yawW - yaw0), Math.cos(yawW - yaw0)), dEl = elW - el0;
    const ang = Math.hypot(dYaw*Math.cos(el0), dEl);
    const wantRate = Math.min(MAX_TURN*(this.speed < 1.5 ? 1.15 : 1), ang*.8);
    this.turnRate += (wantRate - this.turnRate)*(1 - Math.exp(-dt*.9));
    if(ang > 1e-4){
      const k = Math.min(1, this.turnRate*dt/ang);
      yaw0 += dYaw*k; el0 = THREE.MathUtils.clamp(el0 + dEl*k, -MAX_PITCH - .05, MAX_PITCH + .05);
      this.fwd.set(Math.sin(yaw0)*Math.cos(el0), Math.sin(el0), Math.cos(yaw0)*Math.cos(el0));
    }
    if(this.path && this.state !== 'curious' && !this.looking){
      const p = this.path, from = this.pos.clone();
      p.u = Math.min(1, p.u + this.speed*dt/p.len);
      const q = p.curve.getPointAt(p.u), tan = p.curve.getTangentAt(p.u);
      // the course is the curve's, the body follows a little behind, so turns are soft
      this.pos.lerp(q, 1 - Math.exp(-dt*3));
      this.want.copy(tan);
      this.vel.copy(this.pos).sub(from).divideScalar(dt);
      if(p.u >= 1){ this.path = null; p.done?.(); }
    } else {
      // her body carries her: it goes mostly where she's heading, but can lead it a little towards where she means
      // to go, so she starts rising as she begins to pitch up instead of turning first and moving after
      const dir = course ? course.clone().lerp(this.fwd, .5).normalize() : this.fwd.clone();
      this.vel.lerp(dir.multiplyScalar(this.speed), 1 - Math.exp(-dt*1.1));
      this.pos.addScaledVector(this.vel, dt);
    }
    // banking into turns, and the body bowing into them (sideways and up or down)
    const yaw = Math.atan2(before.x*this.fwd.z - before.z*this.fwd.x, before.x*this.fwd.x + before.z*this.fwd.z)/dt;
    this.yawRate += (yaw - this.yawRate)*(1 - Math.exp(-dt*2));
    const pitch = (Math.asin(THREE.MathUtils.clamp(this.fwd.y, -1, 1)) - Math.asin(THREE.MathUtils.clamp(before.y, -1, 1)))/dt;
    this.pitchRate += (pitch - this.pitchRate)*(1 - Math.exp(-dt*2));
    this.roll += (THREE.MathUtils.clamp(-this.yawRate*1.6, -.45, .45) - this.roll)*(1 - Math.exp(-dt*1.5));
    // the stroke: a few beats, then a glide (the beat fades and slows, the body coasts), never quite still;
    // harder when she speeds up, gentle when she hovers
    const red = this.host.reduced ? .35 : 1;
    const accel = THREE.MathUtils.clamp((target - this.speed)*.6, 0, .5);
    const glide = .45 + .55*THREE.MathUtils.smoothstep(Math.sin(this.clock*.21) + Math.sin(this.clock*.083 + 1.7)*.6, -.6, .5);
    const power = Math.min(1, glide + accel);
    this.phase += dt*Math.PI*2*(.12 + this.speed*.033)*(.55 + .45*power); // a stroke every ~3 s at cruise
    const u = this.skin.uniforms;
    u.uAmp.value += ((.3 + Math.min(.75, this.speed*.13))*(.35 + .65*power)*red - u.uAmp.value)*(1 - Math.exp(-dt*.8));
    u.uPhase.value = this.phase;
    const hover = THREE.MathUtils.clamp(1 - this.speed/2.5, 0, 1);
    u.uHover.value += (hover - u.uHover.value)*(1 - Math.exp(-dt*.8));
    this.finClock += dt*(.45 + .55*u.uHover.value);
    u.uFin.value = this.finClock;
    u.uTurn.value = THREE.MathUtils.clamp(this.yawRate*2, -1, 1);
    u.uPitch.value = THREE.MathUtils.clamp(this.pitchRate*2.5, -1, 1);
    u.uBreath.value = Math.sin(this.clock*Math.PI*2/9);
    u.uTime.value = this.clock;
    // a slow blink now and then
    // (the lid comes down and lifts in a third of a second)
    if(this.clock > this.blinkAt){ this.blinkAt = this.clock + 5 + this.rng()*9; }
    const b = this.blinkAt - this.clock, BLINK = .34;
    const shut = b < BLINK ? Math.sin(Math.PI*(1 - b/BLINK)) : 0;
    u.uBlink.value = shut;
    u.uEyeLight.value = 1 - .85*shut;
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
      const at = this.tmp.copy(this.flukeAt).add(new THREE.Vector3((this.rng() - .5)*.32, (this.rng() - .5)*.04, 0)).applyMatrix4(m);
      const v = back.clone().add(new THREE.Vector3(this.rng() - .5, this.rng() - .5, this.rng() - .5).multiplyScalar(.9));
      this.dust.emit(at, v, this.clock, 3 + this.rng()*4, .35 + this.rng()*.5);
    }
    // breathing out: a plume of star dust from the blowhole every half a minute or so
    if(this.clock > this.nextBreath){
      this.nextBreath = this.clock + 26 + this.rng()*20;
      const at = this.tmp.copy(this.blowholeAt).applyMatrix4(m).clone();
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
